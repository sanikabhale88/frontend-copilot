const express = require("express");
const { GoogleGenAI } = require("@google/genai");
const dotenv = require("dotenv");
const { getComponentName, validateComponent, failedPlaybookRules } = require("./validator");
const { generateVerified } = require("./verifiedGeneration");
const { reviewChanges } = require("./changeReview");
const { normalizePlaybook, playbookPromptSection, playbookSummary } = require("./playbook");
const { planBlueprint, normalizeBlueprint } = require("./blueprint");
const { generateProject } = require("./projectGeneration");

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;

// --------------------
// CORS
// --------------------

app.use((req, res, next) => {
  const origin = req.headers.origin;

  // Allow production frontend and local development
  if (
    origin === "https://frontend-copilot.vercel.app" ||
    origin === "http://localhost:5173"
  ) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  // Handle preflight request
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  next();
});

app.use(express.json());

// --------------------
// Gemini
// --------------------

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// Can be switched (e.g. to a less busy model) without code changes
const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

// Waits before each retry when Gemini is overloaded (503); overloads are usually brief
const OVERLOAD_RETRY_DELAYS_MS = [2000, 5000];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// `config` is passed through to Gemini, e.g. for JSON output
async function runCompilation(prompt, config) {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: prompt,
        ...(config && { config }),
      });

      return response.text;
    } catch (error) {
      const delay = OVERLOAD_RETRY_DELAYS_MS[attempt];
      if (error.status !== 503 || delay === undefined) throw error;

      console.warn(`Gemini overloaded (503), retrying in ${delay / 1000}s...`);
      await sleep(delay);
    }
  }
}

// --------------------
// Prompts
// --------------------

// The playbook only governs the code the edit touches, so a small refine doesn't
// turn into a rewrite of unrelated code
function buildRefinePrompt(existingCode, instruction, playbook = null) {
  const playbookSection = playbook
    ? `${playbookPromptSection(playbook)}Apply the team playbook to the code you add or change. Do NOT rewrite unrelated code just to follow it.
`
    : "";

  return `
You are a senior React engineer acting strictly as a CODE EDITOR.

Modify the EXISTING React component.

STRICT RULES:

1. Modify the existing component.
2. DO NOT create a new component.
3. Keep the SAME component name.
4. Preserve the existing layout.
5. Preserve all existing functionality.
6. DO NOT redesign the UI.
7. DO NOT change unrelated parts.
8. Apply ONLY the user's requested change.
9. If the user asks to change a color, change ONLY that color.
10. If the user asks to change text, change ONLY that text.
11. If the user asks to change spacing, change ONLY that spacing.
12. Do not remove existing functionality unless explicitly requested.
13. Return the COMPLETE updated component.
14. Return ONLY JSX.
15. No markdown.
16. No code fences.
17. No explanation.

Example:

User:
"make the background color pink"

You should:
- Keep the same component.
- Keep the same layout.
- Keep the same buttons.
- Keep the same text.
- Keep the same functionality.
- Change only the relevant background color to pink.
${playbookSection}
USER INSTRUCTION:
${instruction}

EXISTING COMPONENT:
${existingCode}
`;
}

function buildGeneratePrompt(prompt, playbook = null) {
  return `
You are an expert React developer.

Generate ONE production-ready React functional component.

RULES:

- Use React + Tailwind CSS only.
- Export a default React component.
- Do NOT use external libraries.
- Do NOT use react-icons.
- Do NOT use lucide-react.
- Do NOT use heroicons.
- Use inline SVG if icons are needed.
- Return ONLY JSX.
- No markdown.
- No explanation.
- No code fences.
${playbookPromptSection(playbook)}
USER REQUEST:
${prompt}
`;
}

// --------------------
// Errors
// --------------------

// Gemini's quota/overload errors are common on the free tier: pass them on with
// their status and a message the user can act on. Errors marked with status 400
// are bad requests whose message is safe to show.
const friendlyMessages = {
  429: "Gemini API quota exceeded. The free tier allows a limited number of requests per day, so try again later or use another API key.",
  503: "Gemini is still overloaded after several retries. Please try again in a minute.",
};

function sendError(res, error, label) {
  console.error(`${label}:`, error);

  const status = (friendlyMessages[error.status] || error.status === 400) ? error.status : 500;

  res.status(status).json({
    success: false,
    message: friendlyMessages[status] || error.message,
  });
}

// --------------------
// Generate / Refine
// --------------------

app.post("/api/generate", async (req, res) => {
  try {
    const {
      prompt,
      existingCode,
      instruction,
    } = req.body;

    const playbook = normalizePlaybook(req.body.playbook);

    const isRefine =
      Boolean(existingCode?.trim()) &&
      Boolean(instruction?.trim());

    // The generated code is validated and auto-repaired before it is sent back.
    // On refine, playbook rules the existing code already broke are not repaired.
    const { result, report } = isRefine
      ? await generateVerified(runCompilation, buildRefinePrompt(existingCode, instruction, playbook), {
          originalName: getComponentName(existingCode),
          playbook,
          baseline: failedPlaybookRules(existingCode, playbook),
        })
      : await generateVerified(runCompilation, buildGeneratePrompt(prompt, playbook), { playbook });

    res.status(200).json({
      success: true,
      result,
      report,
    });

  } catch (error) {
    sendError(res, error, "Generation error");
  }
});

// --------------------
// Review a refine's changes (on demand)
// --------------------

// Body: { instruction, hunks: [{ removed, added }] }
// Returns { items: [{ hunk, requested: true|false|null, summary, reason }] }
app.post("/api/review-changes", async (req, res) => {
  try {
    const { instruction, hunks } = req.body;
    const items = await reviewChanges(runCompilation, instruction, hunks);

    res.status(200).json({ success: true, items });
  } catch (error) {
    sendError(res, error, "Review error");
  }
});

// --------------------
// Project mode: plan a blueprint, then generate the project from it
// --------------------

// Body: { prompt, blueprint?, playbook? } → { blueprint }
// `blueprint` (the current, possibly edited one, with answered questions) makes this a re-plan
app.post("/api/plan", async (req, res) => {
  try {
    const { prompt } = req.body;
    const current = req.body.blueprint ? normalizeBlueprint(req.body.blueprint) : null;

    const blueprint = await planBlueprint(runCompilation, prompt, {
      current,
      playbook: normalizePlaybook(req.body.playbook),
    });

    res.status(200).json({ success: true, blueprint });
  } catch (error) {
    sendError(res, error, "Plan error");
  }
});

// Body: { blueprint, playbook? } → { project, report }
app.post("/api/generate-project", async (req, res) => {
  try {
    if (!req.body.blueprint || typeof req.body.blueprint !== "object") {
      throw Object.assign(new Error("A blueprint is required."), { status: 400 });
    }

    // The user may have edited it: clean it up again before generating from it
    const blueprint = normalizeBlueprint(req.body.blueprint);
    const { project, report } = await generateProject(runCompilation, blueprint, {
      playbook: normalizePlaybook(req.body.playbook),
    });

    res.status(200).json({ success: true, project, report });
  } catch (error) {
    sendError(res, error, "Project generation error");
  }
});

// --------------------
// Validate code without Gemini (e.g. after a local revert)
// --------------------

// Body: { code, originalName?, playbook?, baselineCode? } → { result, report } like
// /api/generate, without repairs. Playbook rules `baselineCode` already broke are
// marked as pre-existing, as on refine.
app.post("/api/validate", (req, res) => {
  try {
    const { code, originalName, baselineCode } = req.body;
    const playbook = normalizePlaybook(req.body.playbook);

    if (typeof code !== "string" || !code.trim()) {
      throw Object.assign(new Error("Code is required."), { status: 400 });
    }

    const baseline = typeof baselineCode === "string" ? failedPlaybookRules(baselineCode, playbook) : [];
    const validation = validateComponent(code, { originalName, playbook, baseline });

    res.status(200).json({
      success: true,
      result: validation.code,
      report: {
        verified: validation.errors.length === 0,
        repairs: 0,
        checks: validation.checks,
        playbook: playbookSummary(playbook),
      },
    });
  } catch (error) {
    sendError(res, error, "Validation error");
  }
});

// --------------------
// Health Check
// --------------------

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Frontend Copilot API is running",
  });
});

// --------------------
// Start Server
// --------------------

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});