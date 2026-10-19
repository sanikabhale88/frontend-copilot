import { useState } from "react";

const statusStyles = {
  pass: { icon: "✓", text: "text-emerald-400" },
  fixed: { icon: "↻", text: "text-sky-400" },
  fail: { icon: "✕", text: "text-rose-400" },
  pending: { icon: "…", text: "text-slate-400" },
  skipped: { icon: "–", text: "text-slate-500" },
};

const badgeStyles = {
  verified: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20",
  checking: "bg-slate-500/10 text-slate-300 border-slate-500/30 hover:bg-slate-500/20",
  failed: "bg-rose-500/10 text-rose-300 border-rose-500/30 hover:bg-rose-500/20",
};

// The live preview's result as one more check: the backend's code checks can't
// tell whether the component actually renders
function runtimeCheck(previewStatus, previewError) {
  if (previewStatus === "error") {
    return { id: "runtime", label: "Renders without errors", status: "fail", message: previewError.split("\n")[0] };
  }

  if (previewStatus === "ready") {
    return { id: "runtime", label: "Renders without errors", status: "pass", message: "" };
  }

  return { id: "runtime", label: "Renders without errors", status: "pending", message: "Waiting for the live preview..." };
}

function CheckList({ title, checks }) {
  return (
    <>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">{title}</h4>

      <ul className="space-y-2.5">
        {checks.map((check) => {
          const style = statusStyles[check.status] ?? statusStyles.skipped;

          return (
            <li key={check.id} className="flex items-start gap-2 text-sm">
              <span className={`${style.text} font-bold w-4 shrink-0 text-center`} aria-hidden="true">
                {style.icon}
              </span>
              <div className="min-w-0">
                <div className="text-slate-200">
                  {check.label}
                  <span className="sr-only"> ({check.status})</span>
                </div>
                {check.message && (
                  <div className="text-xs text-slate-400 break-words mt-0.5">{check.message}</div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

// Shows the verification result for the current code: the backend's code checks
// plus whether the live preview rendered. "Verified" only when both pass.
export default function VerificationBadge({ report, previewStatus, previewError }) {
  const [open, setOpen] = useState(false);

  if (!report) return null;

  const runtime = runtimeCheck(previewStatus, previewError);
  const allChecks = [...report.checks, runtime];

  const failed = allChecks.filter((check) => check.status === "fail").length;
  const fixed = report.checks.filter((check) => check.status === "fixed").length;

  let state, icon, summary;

  if (failed) {
    state = "failed";
    icon = "⚠";
    summary =
      failed === 1 && runtime.status === "fail" ? "Runtime error" : `${failed} issue${failed === 1 ? "" : "s"} found`;
  } else if (runtime.status === "pending") {
    state = "checking";
    icon = "…";
    summary = "Checking preview";
  } else {
    state = "verified";
    icon = "✓";
    summary = `Verified${fixed ? ` · ${fixed} auto-fixed` : ""}`;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className={`flex items-center gap-1.5 border px-2.5 py-1 rounded-full text-xs font-semibold transition ${badgeStyles[state]}`}
      >
        <span aria-hidden="true">{icon}</span>
        {summary}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-3 w-3 transition ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 z-20 w-80 max-w-[calc(100vw-2rem)] bg-slate-800 border border-slate-700 rounded-xl shadow-xl p-4">
          <CheckList
            title={`Code checks${report.repairs > 0 ? ` · ${report.repairs} repair ${report.repairs === 1 ? "pass" : "passes"}` : ""}`}
            checks={report.checks}
          />

          <div className="border-t border-slate-700 my-4" />

          <CheckList title="Live preview" checks={[runtime]} />
        </div>
      )}
    </div>
  );
}
