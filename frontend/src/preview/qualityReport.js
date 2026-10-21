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
// `widths` are the widths that were audited (they must include AXE_WIDTH and 375).
// Returns { status: "running" | "unavailable" | "done", score, issues, notes, message }.
export function summarizeAudit(byWidth = {}, widths = AUDIT_WIDTHS) {
  const results = widths.map((width) => byWidth[width]);

  if (results.some((result) => result?.timedOut)) {
    return { status: "unavailable", message: "The audit timed out before the page finished loading." };
  }

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
  for (const width of widths) {
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

// One issue as fix text: what's wrong, a hint, and where
export function issueText(issue) {
  const example = issue.example ? `\n   Example: ${issue.example.replace(/\n/g, "\n   ")}` : "";
  return `[${issue.category}] ${issue.title}. ${issue.detail}${FIX_HINTS[issue.category] ?? ""}${example}`;
}

// Refine instruction asking the model to fix exactly the listed issues
export function buildFixInstruction(issues) {
  const lines = issues.map((issue, index) => `${index + 1}. ${issueText(issue)}`);

  return (
    "Fix these issues found by automated accessibility and responsive-layout checks. " +
    "Keep the same design, layout, content and functionality; change only what is needed to fix each issue.\n\n" +
    lines.join("\n")
  );
}

// ---------- Projects: one audit per page ----------

// A project page is audited at mobile and desktop only (fewer iframes per route)
export const PROJECT_AUDIT_WIDTHS = [375, AXE_WIDTH];

// The URL to audit a route at: route params get a sample value (/recipes/:id → /recipes/1)
export const auditRoute = (route) => route.replace(/:[^/]+/g, "1");

// `byRoute` maps each page route to its { [width]: result }. Returns
// - quality: the same shape as summarizeAudit (for QualityPanel), score = average of
//   the audited pages, issues prefixed with their page and tagged with its file;
// - runtime: { status: "pending" | "pass" | "fail" | "incomplete", total, passed, failures, unchecked },
//   i.e. whether every page renders, not only the one in the visible preview.
//   failures: [{ page, file, message, where }] where `where` ({ file?, components? })
//   says where the error happened, when known. unchecked: pages whose audit timed out
//   (not checked, which is not the same as crashed).
export function summarizeProjectAudit(byRoute = {}, pages = []) {
  const results = pages.map((page) => {
    const byWidth = byRoute[page.route] ?? {};
    const widthResults = PROJECT_AUDIT_WIDTHS.map((width) => byWidth[width]);
    const failure = widthResults.find((r) => r?.failed) ?? widthResults.find((r) => r?.skipped);

    return {
      page,
      summary: summarizeAudit(byWidth, PROJECT_AUDIT_WIDTHS),
      crash: failure
        ? { message: failure.message || "The page rendered nothing (it probably crashed).", where: failure.where ?? {} }
        : null,
      timedOut: !failure && widthResults.some((r) => r?.timedOut),
    };
  });

  const finished = results.filter((r) => r.summary.status !== "running");
  const failures = results
    .filter((r) => r.crash)
    .map((r) => ({ page: r.page, file: r.page.file, message: r.crash.message, where: r.crash.where }));
  const unchecked = results.filter((r) => r.timedOut).map((r) => r.page);

  const runtime = {
    status: failures.length
      ? "fail"
      : finished.length < results.length
        ? "pending"
        : unchecked.length
          ? "incomplete"
          : "pass",
    total: results.length,
    passed: finished.length - failures.length - unchecked.length,
    failures,
    unchecked,
  };

  const audited = results.filter((r) => r.summary.status === "done");

  let quality;
  if (finished.length < results.length) {
    quality = { status: "running" };
  } else if (!audited.length) {
    quality = { status: "unavailable", message: "The quality check runs once the pages render without errors." };
  } else {
    const issues = audited.flatMap(({ page, summary }) =>
      summary.issues.map((issue) => ({
        ...issue,
        key: `${page.route}-${issue.key}`,
        title: `${page.name} (${page.route}): ${issue.title}`,
        file: page.file,
      }))
    );
    issues.sort((a, b) => b.penalty - a.penalty);

    const notes = [...new Set(audited.flatMap(({ summary }) => summary.notes))];
    if (unchecked.length) {
      notes.push(`${unchecked.length} page${unchecked.length === 1 ? "" : "s"} not audited because loading timed out.`);
    }
    if (failures.length) {
      notes.push(`${failures.length} page${failures.length === 1 ? "" : "s"} not audited because ${failures.length === 1 ? "it crashes" : "they crash"}.`);
    }

    quality = {
      status: "done",
      score: Math.round(audited.reduce((total, r) => total + r.summary.score, 0) / audited.length),
      issues,
      notes,
    };
  }

  return { quality, runtime };
}
