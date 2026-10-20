// Generates every file of a project from its blueprint in one JSON-mode call, then
// validates each file and checks it against the blueprint (drift). Failing files
// are sent back for repair, only those, up to MAX_REPAIRS times.

const { validateProjectFile } = require("./projectValidator");
const { checkDrift, APP_FILE } = require("./driftCheck");
const { playbookPromptSection, playbookSummary } = require("./playbook");

const MAX_REPAIRS = 2;
const MAX_FILES = 30;
const MAX_FILE_CHARS = 60000;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    files: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { path: { type: "STRING" }, code: { type: "STRING" } },
        required: ["path", "code"],
      },
    },
  },
  required: ["files"],
};

const JSON_CONFIG = { responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA };

const RULES = `
RULES:
1. Return JSON: { "files": [{ "path": "...", "code": "..." }] }.
2. Create exactly the files listed in the blueprint, at exactly those paths, plus ${APP_FILE}.
3. Each page and component file default-exports ONE component with exactly the planned name, as: export default function Name(...) { ... }
4. Components accept exactly the planned props (destructure them: function Name({ propA, propB })) and render the components listed in "uses".
5. Import project files with relative paths, e.g. import RecipeCard from "../components/RecipeCard";
6. ${APP_FILE} renders <Routes> with one <Route path="..." element={<Page />} /> per page, with exactly the planned routes, plus any shared layout components (for example a Navbar).
7. Do NOT use BrowserRouter, HashRouter or any router wrapper: the app is already inside a router. Use Link and useNavigate/useParams from react-router-dom.
8. Allowed packages: react, react-router-dom. Nothing else. Use inline SVG for icons.
9. Use Tailwind CSS classes for all styling.
10. Put sample data in the files that use it. Do not create extra files.
11. Code only inside "code": no markdown, no code fences.
`;

// The blueprint without UI-only fields, as the model's specification
const specification = (blueprint) =>
  JSON.stringify(
    {
      name: blueprint.name,
      description: blueprint.description,
      pages: blueprint.pages,
      components: blueprint.components,
      decisions: blueprint.decisions,
      answers: blueprint.questions.map((q) => ({ question: q.question, answer: q.answer })),
    },
    null,
    2
  );

function buildProjectPrompt(blueprint, playbook) {
  return `
You are a senior React engineer. Implement this app EXACTLY as planned in the blueprint below.
${RULES}${playbookPromptSection(playbook)}
BLUEPRINT:
${specification(blueprint)}
`;
}

function buildProjectRepairPrompt(blueprint, files, problemsByFile, playbook) {
  const sections = Object.entries(problemsByFile)
    .map(([path, problems]) => {
      const current = typeof files[path] === "string" ? files[path] : "(this file does not exist yet)";
      return `FILE ${path}\nPROBLEMS:\n${problems.map((p) => `- ${p}`).join("\n")}\nCURRENT CODE:\n${current}`;
    })
    .join("\n\n---\n\n");

  return `
You are a senior React engineer fixing files of a generated app that failed automatic checks.
Return ONLY the files listed below, fixed, as JSON { "files": [{ "path": "...", "code": "..." }] }.
Fix only the listed problems; keep everything else the same.
${RULES}${playbookPromptSection(playbook)}
BLUEPRINT:
${specification(blueprint)}

FILES TO FIX:

${sections}
`;
}

// Model JSON → { path: code }, keeping only sane paths and sizes
function parseFiles(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("The generated project came back as invalid JSON. Please try again.");
  }

  const files = {};
  for (const file of Array.isArray(parsed?.files) ? parsed.files.slice(0, MAX_FILES) : []) {
    const path = typeof file?.path === "string" ? file.path.trim().replace(/^\.?\//, "") : "";
    const safe = /^src\/[\w/.-]+\.jsx?$/.test(path) && !path.includes("..");

    if (safe && typeof file.code === "string" && file.code.length <= MAX_FILE_CHARS) {
      files[path] = file.code;
    }
  }
  return files;
}

// Validates every file and checks drift. Cleaned code (fences removed, React
// imports added) replaces the original. Returns { files, fileChecks, drift, problemsByFile }.
function verifyProject(blueprint, rawFiles, playbook) {
  const planned = new Set([APP_FILE, ...blueprint.pages.map((p) => p.file), ...blueprint.components.map((c) => c.file)]);
  const files = { ...rawFiles };
  const fileChecks = {};
  const problemsByFile = {};

  const addProblems = (path, problems) => {
    if (!problems.length) return;
    problemsByFile[path] = [...(problemsByFile[path] ?? []), ...problems];
  };

  for (const path of Object.keys(rawFiles)) {
    const result = validateProjectFile(path, rawFiles[path], rawFiles, {
      playbook,
      requireComponent: planned.has(path),
    });
    files[path] = result.code;
    fileChecks[path] = result.checks;
    addProblems(path, result.errors);
  }

  const drift = checkDrift(blueprint, files);
  for (const check of drift) {
    if (check.status === "fail" && check.file) addProblems(check.file, [check.message]);
  }

  return { files, fileChecks, drift, problemsByFile };
}

// `run(prompt, config)` → model text. Returns { project, report }.
async function generateProject(run, blueprint, { playbook = null } = {}) {
  let files = parseFiles(await run(buildProjectPrompt(blueprint, playbook), JSON_CONFIG));
  let verification = verifyProject(blueprint, files, playbook);

  // "path::checkId" of everything that ever failed, to mark repaired checks as fixed
  const everFailed = new Set();
  const remember = () => {
    for (const [path, checks] of Object.entries(verification.fileChecks)) {
      for (const check of checks) if (check.status === "fail") everFailed.add(`${path}::${check.id}`);
    }
    for (const check of verification.drift) if (check.status === "fail") everFailed.add(`drift::${check.id}`);
  };
  remember();

  let repairs = 0;

  while (Object.keys(verification.problemsByFile).length && repairs < MAX_REPAIRS) {
    let repaired;
    try {
      const prompt = buildProjectRepairPrompt(blueprint, verification.files, verification.problemsByFile, playbook);
      repaired = parseFiles(await run(prompt, JSON_CONFIG));
    } catch (error) {
      // Keep the last result; the report shows what is still failing
      console.error("Project repair error:", error);
      break;
    }

    repairs++;

    // Only accept files that were asked for
    const allowed = Object.keys(verification.problemsByFile);
    files = { ...verification.files };
    for (const path of allowed) if (typeof repaired[path] === "string") files[path] = repaired[path];

    verification = verifyProject(blueprint, files, playbook);
    remember();
  }

  const markFixed = (check, key) =>
    check.status === "pass" && everFailed.has(key) ? { ...check, status: "fixed", message: "Auto-repaired." } : check;

  const fileReports = Object.fromEntries(
    Object.entries(verification.fileChecks).map(([path, checks]) => [path, checks.map((c) => markFixed(c, `${path}::${c.id}`))])
  );

  return {
    project: {
      name: blueprint.name,
      description: blueprint.description,
      pages: blueprint.pages.map(({ name, route, file, purpose }) => ({ name, route, file, purpose })),
      components: blueprint.components.map(({ name, file, purpose }) => ({ name, file, purpose })),
      files: verification.files,
    },
    report: {
      verified: Object.keys(verification.problemsByFile).length === 0,
      repairs,
      files: fileReports,
      drift: verification.drift.map((c) => markFixed(c, `drift::${c.id}`)),
      playbook: playbookSummary(playbook),
    },
  };
}

module.exports = { generateProject, buildProjectPrompt, parseFiles, verifyProject, MAX_REPAIRS };
