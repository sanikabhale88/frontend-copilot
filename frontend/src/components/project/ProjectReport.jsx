const statusStyles = {
  pass: { icon: "✓", text: "text-emerald-600" },
  fixed: { icon: "↻", text: "text-sky-600" },
  fail: { icon: "✕", text: "text-rose-600" },
  warn: { icon: "!", text: "text-amber-600" },
  skipped: { icon: "–", text: "text-slate-400" },
};

// `action` is an optional button shown on the right (e.g. "Fix this error")
function CheckRow({ check, action = null }) {
  const style = statusStyles[check.status] ?? statusStyles.skipped;

  return (
    <li className="flex items-start gap-2 text-sm">
      <span className={`${style.text} font-bold w-4 shrink-0 text-center`} aria-hidden="true">{style.icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-slate-800">
          {check.label}
          <span className="sr-only"> ({check.status})</span>
        </div>
        {check.message && <div className="text-xs text-slate-500 break-words mt-0.5">{check.message}</div>}
      </div>
      {action}
    </li>
  );
}

// Verification of a generated project: does every page render (runtime), does the
// code match the blueprint (drift), and does every file pass the code checks (and
// the team playbook)? "Verified" only when all of them pass.
// `runtime` comes from the per-page audits; `previewError` from the visible preview.
export default function ProjectReport({ report, runtime, previewError = "", onFixError, onRecheck, busy = false }) {
  const drift = report.drift.filter((check) => check.status !== "warn");
  const driftPassed = drift.filter((check) => check.status === "pass" || check.status === "fixed").length;
  const warnings = report.drift.filter((check) => check.status === "warn");

  const files = Object.entries(report.files).sort(([a], [b]) => a.localeCompare(b));
  const failing = (checks) => checks.filter((check) => check.status === "fail");
  const codeIssues = files.reduce((total, [, checks]) => total + failing(checks).length, 0);

  // The visible preview can crash on something the audits don't reach (e.g. after a click)
  const extraPreviewError = previewError && !runtime.failures.some((f) => f.message === previewError);
  const runtimeIssues = runtime.failures.length + (extraPreviewError ? 1 : 0);
  const issues = codeIssues + (drift.length - driftPassed) + runtimeIssues;

  const badge = issues
    ? { text: `⚠ ${issues} issue${issues === 1 ? "" : "s"}`, style: "bg-rose-50 text-rose-700 border-rose-200" }
    : runtime.status === "pending"
      ? { text: "… Checking every page", style: "bg-slate-50 text-slate-600 border-slate-200" }
      : runtime.status === "incomplete"
        ? {
            text: `! ${runtime.unchecked.length} page${runtime.unchecked.length === 1 ? "" : "s"} not checked`,
            style: "bg-amber-50 text-amber-700 border-amber-200",
          }
        : { text: "✓ Verified", style: "bg-emerald-50 text-emerald-700 border-emerald-200" };

  const fixButton = (failure) =>
    onFixError && (
      <button
        type="button"
        onClick={() => onFixError(failure)}
        disabled={busy}
        className="shrink-0 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white px-2.5 py-1 rounded-lg text-xs font-semibold transition"
      >
        {busy ? "Working..." : "Fix this error"}
      </button>
    );

  return (
    <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6" aria-labelledby="project-report-title">
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <h3 id="project-report-title" className="font-semibold text-slate-900 text-lg">Verification</h3>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${badge.style}`} aria-live="polite">
          {badge.text}
        </span>
        <span className="text-sm text-slate-500">
          Blueprint match <strong className="text-slate-800">{driftPassed}/{drift.length}</strong>
          {report.repairs > 0 && ` · ${report.repairs} repair ${report.repairs === 1 ? "pass" : "passes"}`}
          {report.playbook && ` · Playbook: ${report.playbook.name}`}
        </span>
      </div>

      {/* Runtime: every page rendered in the background audits */}
      <div className="mb-6">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
          Live check ·{" "}
          {runtime.status === "pending"
            ? `checking pages (${runtime.passed + runtime.failures.length}/${runtime.total})...`
            : `${runtime.passed}/${runtime.total} pages render${runtime.unchecked.length ? ` · ${runtime.unchecked.length} not checked` : ""}`}
        </h4>
        <ul className="space-y-2.5">
          {runtime.failures.map((failure) => (
            <CheckRow
              key={failure.page.route}
              check={{ id: failure.page.route, label: `${failure.page.name} (${failure.page.route}) crashes`, status: "fail", message: failure.message }}
              action={fixButton(failure)}
            />
          ))}
          {extraPreviewError && (
            <CheckRow
              check={{ id: "preview", label: "The live preview crashed", status: "fail", message: previewError }}
              action={fixButton({ message: previewError, fromPreview: true })}
            />
          )}
          {runtime.unchecked.map((unchecked, index) => (
            <CheckRow
              key={`unchecked-${unchecked.route}`}
              check={{
                id: unchecked.route,
                label: `${unchecked.name} (${unchecked.route}) not checked`,
                status: "warn",
                message: "Loading timed out (often a slow connection). This is not a crash.",
              }}
              action={
                index === 0 && onRecheck ? (
                  <button
                    type="button"
                    onClick={onRecheck}
                    className="shrink-0 bg-white border border-slate-300 hover:border-slate-400 text-slate-700 px-2.5 py-1 rounded-lg text-xs font-semibold transition"
                  >
                    Check again
                  </button>
                ) : null
              }
            />
          ))}
          {runtime.status === "pass" && !extraPreviewError && (
            <CheckRow check={{ id: "runtime", label: "Every page renders without errors", status: "pass", message: "" }} />
          )}
        </ul>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Drift */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Code matches the blueprint</h4>
          <ul className="space-y-2.5">
            {[...drift, ...warnings].map((check) => (
              <CheckRow key={check.id} check={check} />
            ))}
          </ul>
        </div>

        {/* Per-file code checks */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Code checks per file</h4>
          <ul className="space-y-1.5">
            {files.map(([path, checks]) => {
              const failed = failing(checks);
              const fixed = checks.filter((check) => check.status === "fixed");
              const notable = [...failed, ...fixed];

              return (
                <li key={path}>
                  <details className="group border border-slate-200 rounded-lg">
                    <summary className="flex items-center justify-between gap-3 px-3 py-2 cursor-pointer text-sm">
                      <span className="font-mono text-slate-700 truncate">{path}</span>
                      <span className={`shrink-0 text-xs font-semibold ${failed.length ? "text-rose-600" : "text-emerald-600"}`}>
                        {failed.length ? `${failed.length} issue${failed.length === 1 ? "" : "s"}` : `✓ ${checks.length} checks${fixed.length ? ` · ${fixed.length} fixed` : ""}`}
                      </span>
                    </summary>
                    <ul className="px-3 pb-3 pt-1 space-y-2">
                      {(notable.length ? notable : checks).map((check) => (
                        <CheckRow key={check.id} check={check} />
                      ))}
                    </ul>
                  </details>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {report.playbook?.guided?.length > 0 && (
        <p className="text-xs text-slate-400 mt-4">
          Guided playbook rules (sent to the AI, not checked): {report.playbook.guided.join("; ")}
        </p>
      )}
    </section>
  );
}
