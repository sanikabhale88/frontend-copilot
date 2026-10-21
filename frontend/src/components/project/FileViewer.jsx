import { useState } from "react";
import ChangesView from "../ChangesView";

// Shows one project file. For generated projects (onRefine set) it can also refine
// the file and, after an update, show its Changes with per-change Revert.
export default function FileViewer({
  path,
  code,
  showToast,
  changes = null,
  changeLabel,
  review,
  onReviewChanges,
  onRevertHunks,
  onRefine,
  busy = false,
}) {
  const [view, setView] = useState("code"); // "code" | "changes"
  const [instruction, setInstruction] = useState("");

  const hasFile = Boolean(path) && code !== undefined;
  const activeView = changes ? view : "code";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      showToast("Code copied to clipboard", "success");
    } catch {
      showToast("Failed to copy code", "error");
    }
  };

  const handleDownload = () => {
    const fileName = path.split("/").pop();
    const blob = new Blob([code], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`${fileName} downloaded`, "success");
  };

  const handleRefine = (event) => {
    event.preventDefault();
    if (!instruction.trim() || busy) return;
    onRefine(path, instruction.trim());
    setInstruction("");
  };

  return (
    <div className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 flex flex-col h-[560px] min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-3 border-b border-slate-800 gap-3 shrink-0">
        <span className="font-mono text-sm text-slate-300 break-all">
          {hasFile ? path : "No file selected"}
        </span>

        {hasFile && (
          <div className="flex gap-2 self-end sm:self-auto shrink-0">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-sm font-medium transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-sm font-medium transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </button>
          </div>
        )}
      </div>

      {hasFile && changes && (
        <div className="flex gap-1 px-5 pt-3 bg-[#0B1220] shrink-0" role="tablist" aria-label="File view">
          {[
            { value: "code", label: "Code" },
            {
              value: "changes",
              label: (
                <>
                  Changes <span className="text-emerald-400">+{changes.stats.added}</span>{" "}
                  <span className="text-rose-400">−{changes.stats.removed}</span>
                </>
              ),
            },
          ].map((tab) => (
            <button
              key={tab.value}
              role="tab"
              aria-selected={activeView === tab.value}
              onClick={() => setView(tab.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                activeView === tab.value ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-auto bg-[#0B1220] p-5">
        {!hasFile ? (
          <p className="text-sm text-slate-500">Select a file to view its code.</p>
        ) : activeView === "changes" ? (
          <ChangesView
            changes={changes}
            changeLabel={changeLabel}
            review={review}
            onReviewChanges={onReviewChanges}
            onRevertHunks={onRevertHunks}
            busy={busy || review.status === "loading"}
          />
        ) : (
          <pre className="text-emerald-400 text-[13px] leading-relaxed font-mono whitespace-pre-wrap break-words">
            {code}
          </pre>
        )}
      </div>

      {hasFile && onRefine && (
        <form onSubmit={handleRefine} className="flex gap-2 px-4 py-3 border-t border-slate-800 bg-slate-900 shrink-0">
          <label htmlFor="refine-file" className="sr-only">Refine {path}</label>
          <input
            id="refine-file"
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            placeholder={`Refine ${path.split("/").pop()}, e.g. "make the cards rounder"`}
            className="flex-1 min-w-0 bg-slate-800 border border-slate-700 focus:border-violet-500 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none"
          />
          <button
            type="submit"
            disabled={busy || !instruction.trim()}
            className="shrink-0 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:text-slate-400 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
          >
            {busy ? "Working..." : "Refine"}
          </button>
        </form>
      )}
    </div>
  );
}
