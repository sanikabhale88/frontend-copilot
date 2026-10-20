const { validateComponent } = require("./validator");
const { exportStyleLine, playbookPromptSection, playbookSummary } = require("./playbook");

const MAX_REPAIRS = 2;

// Sent when the validator finds problems: lists them and asks for a minimal fix.
// The team playbook (if any) decides the export style and is repeated as context.
function buildRepairPrompt(code, errors, originalName, playbook = null) {
  return `
You are a senior React engineer fixing a React component that failed automatic checks.

PROBLEMS FOUND:
${errors.map((error, index) => `${index + 1}. ${error}`).join("\n")}

STRICT RULES:

1. Fix ONLY the problems listed above.
2. Keep everything else exactly the same: layout, styling, text and functionality.
3. ${originalName ? `Keep the component name "${originalName}".` : "Keep the same component name."}
4. Use React + Tailwind CSS only. The only allowed import is from "react".
5. Use inline SVG if icons are needed.
6. Export the component as: ${exportStyleLine(playbook)}
7. Return the COMPLETE fixed component.
8. Return ONLY JSX.
9. No markdown.
10. No code fences.
11. No explanation.
${playbookPromptSection(playbook)}
COMPONENT:
${code}
`;
}

// Runs `prompt` through `run` (prompt → model text), validates the code, and asks
// the model to fix failed checks up to MAX_REPAIRS times. Returns the final code
// plus a report: { verified, repairs, checks }.
// `playbook` adds the team's rules to the checks; `baseline` lists playbook rules the
// code broke before a refine (reported, not repaired).
async function generateVerified(run, prompt, { originalName, playbook = null, baseline = [] } = {}) {
  const validateOptions = { originalName, playbook, baseline };
  let validation = validateComponent(await run(prompt), validateOptions);

  // First failure message per check, so the report can say what was repaired
  const firstFailures = new Map();
  const rememberFailures = () => {
    for (const check of validation.checks) {
      if (check.status === "fail" && !firstFailures.has(check.id)) {
        firstFailures.set(check.id, check.message);
      }
    }
  };
  rememberFailures();

  let repairs = 0;

  while (validation.errors.length && repairs < MAX_REPAIRS) {
    let repaired;
    try {
      repaired = await run(buildRepairPrompt(validation.code, validation.errors, originalName, playbook));
    } catch (error) {
      // Keep the last result; the report will show the remaining failures
      console.error("Repair error:", error);
      break;
    }

    repairs++;
    validation = validateComponent(repaired, validateOptions);
    rememberFailures();
  }

  const checks = validation.checks.map((check) =>
    check.status === "pass" && firstFailures.has(check.id)
      ? { ...check, status: "fixed", message: `Auto-repaired: ${firstFailures.get(check.id)}` }
      : check
  );

  return {
    result: validation.code,
    report: {
      verified: validation.errors.length === 0,
      repairs,
      checks,
      playbook: playbookSummary(playbook),
    },
  };
}

module.exports = { generateVerified, buildRepairPrompt, MAX_REPAIRS };
