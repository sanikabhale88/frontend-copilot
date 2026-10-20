const categoryLabels = {
  accessibility: "Accessibility",
  responsive: "Responsive",
  touch: "Touch targets",
};

const severityStyles = {
  critical: "text-rose-700 bg-rose-100",
  serious: "text-rose-700 bg-rose-100",
  moderate: "text-amber-700 bg-amber-100",
  minor: "text-slate-600 bg-slate-100",
};

const scoreColor = (score) =>
  score >= 90 ? "text-emerald-600 border-emerald-200 bg-emerald-50" : score >= 70 ? "text-amber-600 border-amber-200 bg-amber-50" : "text-rose-600 border-rose-200 bg-rose-50";

// Shows the automated quality audit (accessibility, responsive layout, touch
// targets) for the current component, with an Auto-fix for the issues found
export default function QualityPanel({ quality, previousScore, onAutoFix, loading }) {
  const { status } = quality;
  const issueCount = quality.issues?.length ?? 0;
  const delta = status === "done" && previousScore != null ? quality.score - previousScore : null;

  const countFor = (category) => quality.issues?.filter((issue) => issue.category === category).length ?? 0;

  return (
    <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 sm:p-6" aria-live="polite">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-xl shadow-inner">
            🛡️
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 text-lg">Quality Gate</h3>
            <p className="text-sm text-slate-500 font-medium">
              Accessibility, responsive layout and touch targets, checked automatically.
            </p>
          </div>
        </div>

        {status === "done" && (
          <div className="flex flex-col items-end shrink-0">
            <div className={`border rounded-xl px-3 py-1.5 text-2xl font-bold tabular-nums ${scoreColor(quality.score)}`}>
              {quality.score}
              <span className="text-sm font-semibold opacity-70">/100</span>
            </div>
            {delta !== null && delta !== 0 && (
              <span className={`text-xs font-semibold mt-1 ${delta > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {delta > 0 ? "▲" : "▼"} {Math.abs(delta)} from {previousScore}
              </span>
            )}
          </div>
        )}
      </div>

      {status === "running" && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <svg className="animate-spin h-4 w-4 text-emerald-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
          Auditing at mobile, tablet and desktop widths...
        </div>
      )}

      {status === "unavailable" && (
        <p className="text-sm text-slate-500">{quality.message}</p>
      )}

      {status === "done" && (
        <>
          {/* Category summary */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {Object.entries(categoryLabels).map(([category, label]) => {
              const count = countFor(category);
              return (
                <div key={category} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                  <div className="text-xs font-medium text-slate-500 truncate">{label}</div>
                  <div className={`text-sm font-semibold ${count ? "text-rose-600" : "text-emerald-600"}`}>
                    {count ? `${count} issue${count === 1 ? "" : "s"}` : "✓ Pass"}
                  </div>
                </div>
              );
            })}
          </div>

          {issueCount === 0 ? (
            <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              No issues found by the automated checks.
            </p>
          ) : (
            <>
              <ul className="space-y-2 mb-4">
                {quality.issues.map((issue) => (
                  <li key={issue.key} className="border border-slate-200 rounded-xl px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-800">{issue.title}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {categoryLabels[issue.category]} · {issue.detail}
                        </div>
                      </div>
                      <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${severityStyles[issue.severity] ?? severityStyles.minor}`}>
                        {issue.severity}
                      </span>
                    </div>

                    {issue.example && (
                      <details className="mt-2">
                        <summary className="text-xs font-medium text-slate-500 cursor-pointer hover:text-slate-700">
                          Show where
                        </summary>
                        <pre className="mt-1.5 text-xs text-slate-600 bg-slate-50 rounded-lg p-2 whitespace-pre-wrap break-all font-mono">
                          {issue.example}
                        </pre>
                      </details>
                    )}
                  </li>
                ))}
              </ul>

              <button
                onClick={onAutoFix}
                disabled={loading}
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white px-5 py-2.5 rounded-xl font-semibold transition shadow-sm"
              >
                {loading ? "Fixing..." : `Auto-fix ${issueCount} issue${issueCount === 1 ? "" : "s"}`}
              </button>
            </>
          )}

          {quality.notes?.length > 0 && (
            <ul className="mt-3 text-xs text-slate-400 space-y-1">
              {quality.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
