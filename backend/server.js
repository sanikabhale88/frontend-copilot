const express = require("express");
const { GoogleGenAI } = require("@google/genai");
const dotenv = require("dotenv");

dotenv.config();

const app = express();

// --------------------
// CORS
// --------------------

app.use((req, res, next) => {
  const origin = req.headers.origin;

  // Allow our frontend and local development
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

  // Handle browser preflight request
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

async function runCompilation(prompt) {
  const response = await ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: prompt,
  });

  return response.text;
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

    const isRefine =
      Boolean(existingCode?.trim()) &&
      Boolean(instruction?.trim());

    let finalPrompt = "";

    // ==========================
    // REFINE
    // ==========================

    if (isRefine) {
      finalPrompt = `
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

USER INSTRUCTION:
${instruction}

EXISTING COMPONENT:
${existingCode}
`;
    }

    // ==========================
    // GENERATE
    // ==========================

    else {
      finalPrompt = `
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

USER REQUEST:
${prompt}
`;
    }

    const result = await runCompilation(finalPrompt);

    res.status(200).json({
      success: true,
      result,
    });

  } catch (error) {
    console.error("Generation error:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
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
// Vercel
// --------------------

module.exports = app;