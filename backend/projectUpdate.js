// Changes an existing generated project: refine one file, fix a runtime error, or
// fix Quality Gate issues. One targeted JSON-mode call, then the same verify →
// repair loop as generation (finalizeProject).

const {
  buildRules,
  specification,
  parseFiles,
  plannedFiles,
  finalizeProject,
  JSON_CONFIG,
} = require("./projectGeneration");
const { playbookPromptSection } = require("./playbook");

const MAX_ISSUES = 20;

const badRequest = (message) => Object.assign(new Error(message), { status: 400 });
const text = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");

// Turns the request into { task, targets, repairDrift, label }. `targets` are the
// files the model may return; they are also shown in full as "files to change".
function planRequest(request, files, blueprint) {
  const existing = Object.keys(files);
  const planned = [...plannedFiles(blueprint)].filter((path) => existing.includes(path));
  const knownFile = (path) => typeof path === "string" && existing.includes(path);

  switch (request?.type) {
    case "refine": {
      const instruction = text(request.instruction, 2000);
      if (!knownFile(request.file)) throw badRequest("Choose a file of the project to refine.");
      if (!instruction) throw badRequest("Describe the change you want.");

      return {
        targets: [request.file],
        // The user may change props on purpose: report drift, don't "repair" it back
        repairDrift: false,
        task:
          `The user asked for this change in ${request.file}:\n"""\n${instruction}\n"""\n` +
          "Apply ONLY this change. Keep everything else in the file exactly the same: layout, styling, text and behaviour.",
      };
    }

    case "fix-error": {
      const message = text(request.message, 2000);
      if (!message) throw badRequest("The error message is missing.");

      // The cause isn't always where the error shows up (a page can pass bad props to
      // a component), so any planned file may change; the likely file comes first
      const likely = knownFile(request.file) ? request.file : null;

      return {
        targets: likely ? [likely, ...planned.filter((path) => path !== likely)] : planned,
        repairDrift: true,
        task:
          `The app throws this error in the browser${likely ? ` (it shows up in ${likely})` : ""}:\n"""\n${message}\n"""\n` +
          "Find the cause and fix it; it may be in a different file. Change only what is needed to fix the error. " +
          "Return only the files you actually changed.",
      };
    }

    case "fix-quality": {
      const issues = (Array.isArray(request.issues) ? request.issues : [])
        .slice(0, MAX_ISSUES)
        .map((issue) => ({ file: knownFile(issue?.file) ? issue.file : null, message: text(issue?.message, 1000) }))
        .filter((issue) => issue.message);
      if (!issues.length) throw badRequest("There are no quality issues to fix.");

      // Layout issues often live in a component the page renders, so components may change too
      const pageFiles = [...new Set(issues.map((issue) => issue.file).filter(Boolean))];
      const targets = [...new Set([...pageFiles, ...planned])];

      return {
        targets,
        repairDrift: true,
        task:
          "Fix these issues found by automated accessibility and responsive-layout checks. Keep the same design, " +
          "content and behaviour; change only what is needed. Return only the files you actually changed.\n\n" +
          issues.map((issue, index) => `${index + 1}. ${issue.file ? `[${issue.file}] ` : ""}${issue.message}`).join("\n"),
      };
    }

    default:
      throw badRequest('Unknown update type (expected "refine", "fix-error" or "fix-quality").');
  }
}

function buildUpdatePrompt(blueprint, files, plan, playbook) {
  const targetSet = new Set(plan.targets);
  const section = (path) => `FILE ${path}\n${files[path]}`;

  const toChange = plan.targets.map(section).join("\n\n---\n\n");
  const context = Object.keys(files)
    .filter((path) => !targetSet.has(path))
    .map(section)
    .join("\n\n---\n\n");

  return `
You are a senior React engineer updating an existing generated app.
Return ONLY changed files as JSON { "files": [{ "path": "...", "code": "..." }] }, each with its COMPLETE new code.
You may only return these files: ${plan.targets.join(", ")}.

TASK:
${plan.task}
${buildRules(playbook)}${playbookPromptSection(playbook)}
BLUEPRINT:
${specification(blueprint)}

FILES YOU MAY CHANGE:

${toChange}
${context ? `\nOTHER FILES (context only, do not return them):\n\n${context}\n` : ""}`;
}

// `files` is the current project ({ path: code }, already sanitized).
// Returns { files, report, changed: [paths] }.
async function updateProject(run, blueprint, files, request, { playbook = null } = {}) {
  if (!Object.keys(files).length) throw badRequest("The project has no files.");

  const plan = planRequest(request, files, blueprint);
  const returned = parseFiles(await run(buildUpdatePrompt(blueprint, files, plan, playbook), JSON_CONFIG));

  const next = { ...files };
  for (const path of plan.targets) {
    if (typeof returned[path] === "string") next[path] = returned[path];
  }

  const { project, report } = await finalizeProject(run, blueprint, next, {
    playbook,
    previousFiles: files,
    repairDrift: plan.repairDrift,
  });

  const changed = Object.keys(project.files).filter((path) => project.files[path] !== files[path]);

  return { files: project.files, report, changed };
}

module.exports = { updateProject, planRequest, buildUpdatePrompt };
