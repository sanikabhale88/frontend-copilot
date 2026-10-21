// Updates made to a generated project, newest first, with Undo (like RefinePanel's history)
export default function ProjectHistory({ history, onUndo, busy }) {
  if (!history.length) return null;

  return (
    <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Project history</h3>
        <button
          type="button"
          onClick={onUndo}
          disabled={busy}
          className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 transition disabled:opacity-50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
          Undo last change
        </button>
      </div>

      <ul className="space-y-2">
        {history.map((entry, index) => (
          <li key={index} className="flex items-start gap-2 text-sm text-slate-600">
            <span className="text-violet-500 mt-0.5" aria-hidden="true">•</span>
            <span className={`break-words ${index === 0 ? "font-medium text-slate-800" : ""}`}>{entry.label}</span>
          </li>
        ))}
        <li className="flex items-start gap-2 text-sm text-slate-500">
          <span className="text-slate-300 mt-0.5" aria-hidden="true">•</span>
          Generated from the blueprint
        </li>
      </ul>
    </section>
  );
}
