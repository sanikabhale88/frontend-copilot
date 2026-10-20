// Turns the audit iframes' messages into a quality score and issue list, and the
// issues into a refine instruction for "Auto-fix".

// Widths the component is audited at; axe (accessibility) runs at the desktop width only
export const AUDIT_WIDTHS = [375, 768, 1280];
export const AXE_WIDTH = 1280;

const DEVICES = { 375: "mobile", 768: "tablet", 1280: "desktop" };

// Score penalty per accessibility rule violated, by axe impact
const IMPACT_PENALTY = { critical: 15, serious: 10, moderate: 5, minor: 2 };

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

// `byWidth` maps each audit width to the message its iframe reported:
// { overflow, smallTargets, a11y } on success, { skipped } / { error } / { failed, message } otherwise.
// Returns { status: "running" | "unavailable" | "done", score, issues, notes, message }.
export function summarizeAudit(byWidth = {}) {
  const results = AUDIT_WIDTHS.map((width) => byWidth[width]);

  if (results.some((result) => result?.failed || result?.skipped)) {
    return {
      status: "unavailable",
      message: "The quality check runs once the preview renders without errors.",
    };
  }

  if (results.some((result) => !result)) {
    return { status: "running" };
  }

  const issues = [];
  const notes = [];

  // ---------- Accessibility ----------
  const a11y = byWidth[AXE_WIDTH].a11y;

  if (a11y?.error) notes.push(a11y.error);

  for (const violation of a11y?.violations ?? []) {
    issues.push({
      key: `a11y-${violation.id}`,
      category: "accessibility",
      severity: violation.impact || "moderate",
      title: violation.help,
      detail: `${plural(violation.count, "element")} (rule: ${violation.id})`,
      example: violation.example,
      penalty: IMPACT_PENALTY[violation.impact] ?? 5,
    });
  }

  // ---------- Responsive ----------
  for (const width of AUDIT_WIDTHS) {
    const result = byWidth[width];
    if (result.error) notes.push(`Audit at ${width}px failed: ${result.error}`);

    const overflow = result.overflow;
    if (!overflow) continue;

    issues.push({
      key: `overflow-${width}`,
      category: "responsive",
      severity: width === 375 ? "serious" : "moderate",
      title: `Horizontal scrolling on ${DEVICES[width]} (${width}px)`,
      detail: `Content is ${overflow.pageWidth}px wide in a ${overflow.viewport}px wide screen.`,
      example: overflow.elements.map((el) => `${el.html} is ${el.width}px wide`).join("\n"),
      penalty: width === 375 ? 15 : 10,
    });
  }

  // ---------- Touch targets ----------
  const targets = byWidth[375].smallTargets;

  if (targets?.count) {
    issues.push({
      key: "touch-375",
      category: "touch",
      severity: "moderate",
      title: `${plural(targets.count, "tap target")} smaller than 24×24px on mobile`,
      detail: "Small buttons and links are hard to tap accurately.",
      example: targets.examples.join("\n"),
      penalty: Math.min(10, targets.count * 2),
    });
  }

  issues.sort((a, b) => b.penalty - a.penalty);

  const score = Math.max(0, 100 - issues.reduce((total, issue) => total + issue.penalty, 0));

  return { status: "done", score, issues, notes };
}

const FIX_HINTS = {
  accessibility: "",
  responsive: " Make it fit narrow screens (for example responsive grid columns, flex-wrap, max-w-full or responsive widths instead of fixed ones).",
  touch: " Make each of them at least 24×24px (for example with padding or min-h/min-w).",
};

// Refine instruction asking the model to fix exactly the listed issues
export function buildFixInstruction(issues) {
  const lines = issues.map((issue, index) => {
    const example = issue.example ? `\n   Example: ${issue.example.replace(/\n/g, "\n   ")}` : "";
    return `${index + 1}. [${issue.category}] ${issue.title}. ${issue.detail}${FIX_HINTS[issue.category] ?? ""}${example}`;
  });

  return (
    "Fix these issues found by automated accessibility and responsive-layout checks. " +
    "Keep the same design, layout, content and functionality; change only what is needed to fix each issue.\n\n" +
    lines.join("\n")
  );
}
