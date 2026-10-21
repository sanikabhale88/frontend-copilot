// Generates every file of a project from its blueprint in one JSON-mode call, then
// validates each file and checks it against the blueprint (drift). Failing files
// are sent back for repair, only those, up to MAX_REPAIRS times. The same
// verify → repair loop (finalizeProject) also runs after every project update.

const { validateProjectFile } = require("./projectValidator");
const { checkDrift, APP_FILE } = require("./driftCheck");
const { failedPlaybookRules } = require("./validator");
const { exportStyleLine, playbookPromptSection, playbookSummary } = require("./playbook");

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

// The export style follows the team playbook (function declarations by default)
function buildRules(playbook) {
  return `
RULES:
1. Return JSON: { "files": [{ "path": "...", "code": "..." }] }.
2. Create exactly the files listed in the blueprint, at exactly those paths, plus ${APP_FILE}.
3. Each page and component file default-exports ONE component with exactly the planned name, written as: ${exportStyleLine(playbook).replace(/ComponentName/g, "Name")}
4. Components accept exactly the planned props (destructure them: Name({ propA, propB })) and render the components listed in "uses".
5. Import project files with relative paths, e.g. import RecipeCard from "../components/RecipeCard";
6. ${APP_FILE} renders <Routes> with one <Route path="..." element={<Page />} /> per page, with exactly the planned routes, plus any shared layout components (for example a Navbar).
7. Do NOT use BrowserRouter, HashRouter or any router wrapper: the app is already inside a router. Use Link and useNavigate/useParams from react-router-dom.
8. Allowed packages: react, react-router-dom. Nothing else. Use inline SVG for icons.
9. Use Tailwind CSS classes for all styling.
10. Put sample data in the files that use it. Do not create extra files.
11. Code only inside "code": no markdown, no code fences.
`;
}

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
${buildRules(playbook)}${playbookPromptSection(playbook)}
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
${buildRules(playbook)}${playbookPromptSection(playbook)}
BLUEPRINT:
${specification(blueprint)}

FILES TO FIX:

${sections}
`;
}

const isSafePath = (path) => /^src\/[\w/.-]+\.jsx?$/.test(path) && !path.includes("..");

// { path: code } from untrusted input (the browser), keeping only sane paths and sizes
function sanitizeFiles(raw) {
  const files = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return files;

  for (const [path, code] of Object.entries(raw).slice(0, MAX_FILES)) {
    if (isSafePath(path) && typeof code === "string" && code.length <= MAX_FILE_CHARS) files[path] = code;
  }
  return files;
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

    if (isSafePath(path) && typeof file.code === "string" && file.code.length <= MAX_FILE_CHARS) {
      files[path] = file.code;
    }
  }
  return files;
}

const plannedFiles = (blueprint) =>
  new Set([APP_FILE, ...blueprint.pages.map((p) => p.file), ...blueprint.components.map((c) => c.file)]);

// Validates every file and checks drift. Cleaned code (fences removed, React
// imports added) replaces the original. `previousFiles` makes playbook rules a file
// already broke "pre-existing"; `repairDrift: false` reports drift without sending
// it to repair (the user changed the code on purpose).
// Returns { files, fileChecks, drift, problemsByFile }.
function verifyProject(blueprint, rawFiles, playbook, { previousFiles = null, repairDrift = true } = {}) {
  const planned = plannedFiles(blueprint);
  const files = { ...rawFiles };
  const fileChecks = {};
  const problemsByFile = {};

  const addProblems = (path, problems) => {
    if (!problems.length) return;
    problemsByFile[path] = [...(problemsByFile[path] ?? []), ...problems];
  };

  for (const path of Object.keys(rawFiles)) {
    const previous = previousFiles?.[path];
    const result = validateProjectFile(path, rawFiles[path], rawFiles, {
      playbook,
      requireComponent: planned.has(path),
      baseline: typeof previous === "string" ? failedPlaybookRules(previous, playbook) : [],
    });
    files[path] = result.code;
    fileChecks[path] = result.checks;
    addProblems(path, result.errors);
  }

  const drift = checkDrift(blueprint, files);
  if (repairDrift) {
    for (const check of drift) {
      if (check.status === "fail" && check.file) addProblems(check.file, [check.message]);
    }
  }

  return { files, fileChecks, drift, problemsByFile };
}

const toProject = (blueprint, files) => ({
  name: blueprint.name,
  description: blueprint.description,
  pages: blueprint.pages.map(({ name, route, file, purpose }) => ({ name, route, file, purpose })),
  components: blueprint.components.map(({ name, file, purpose }) => ({ name, file, purpose })),
  files,
});

// Verify → repair (only failing files) → verify ..., then build the report.
// With `maxRepairs: 0` (and no `run`) it only verifies.
async function finalizeProject(run, blueprint, startFiles, { playbook = null, previousFiles = null, repairDrift = true, maxRepairs = MAX_REPAIRS } = {}) {
  const verifyOptions = { previousFiles, repairDrift };
  let verification = verifyProject(blueprint, startFiles, playbook, verifyOptions);

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

  while (Object.keys(verification.problemsByFile).length && repairs < maxRepairs) {
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
    const files = { ...verification.files };
    for (const path of Object.keys(verification.problemsByFile)) {
      if (typeof repaired[path] === "string") files[path] = repaired[path];
    }

    verification = verifyProject(blueprint, files, playbook, verifyOptions);
    remember();
  }

  const markFixed = (check, key) =>
    check.status === "pass" && everFailed.has(key) ? { ...check, status: "fixed", message: "Auto-repaired." } : check;

  const fileReports = Object.fromEntries(
    Object.entries(verification.fileChecks).map(([path, checks]) => [path, checks.map((c) => markFixed(c, `${path}::${c.id}`))])
  );

  const failingDrift = verification.drift.some((check) => check.status === "fail");

  return {
    project: toProject(blueprint, verification.files),
    report: {
      verified: Object.keys(verification.problemsByFile).length === 0 && !failingDrift,
      repairs,
      files: fileReports,
      drift: verification.drift.map((c) => markFixed(c, `drift::${c.id}`)),
      playbook: playbookSummary(playbook),
    },
  };
}

// `run(prompt, config)` → model text. Returns { project, report }.
async function generateProject(run, blueprint, { playbook = null } = {}) {
  const files = parseFiles(await run(buildProjectPrompt(blueprint, playbook), JSON_CONFIG));
  return finalizeProject(run, blueprint, files, { playbook });
}

module.exports = {
  generateProject,
  finalizeProject,
  buildProjectPrompt,
  buildRules,
  specification,
  parseFiles,
  sanitizeFiles,
  plannedFiles,
  verifyProject,
  JSON_CONFIG,
  MAX_REPAIRS,
};
