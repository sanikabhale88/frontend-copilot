export default function RefinePanel({ 
  instruction, 
  setInstruction, 
  onRefine, 
  loading, 
  history, 
  onUndo 
}) {
  const quickActions = [
    "Change Colors",
    "Dark Mode",
    "Make Responsive",
    "Improve Spacing",
    "Modernize UI",
    "Add Hover Effects"
  ];

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onRefine();
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 sm:p-6 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-xl shadow-inner">
          ✨
        </div>
        <div>
          <h3 className="font-semibold text-slate-900 text-lg">AI Refine</h3>
          <p className="text-sm text-slate-500 font-medium">
            Modify the current component without starting over.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. Make it dark mode with glassmorphism"
          className="flex-1 border-2 border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-violet-500 transition text-slate-800 placeholder-slate-400"
        />

        <button
          onClick={onRefine}
          disabled={loading || !instruction.trim()}
          className="bg-violet-600 hover:bg-violet-700 text-white px-6 py-3 rounded-xl font-semibold disabled:bg-slate-300 transition shadow-sm whitespace-nowrap"
        >
          {loading ? "Refining..." : "Refine"}
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {quickActions.map((action) => (
          <button
            key={action}
            onClick={() => setInstruction(action)}
            className="text-xs font-medium px-3 py-1.5 bg-slate-50 hover:bg-violet-50 border border-slate-200 hover:border-violet-200 text-slate-600 hover:text-violet-700 rounded-lg transition"
          >
            {action}
          </button>
        ))}
      </div>

      {history.length > 0 && (
        <div className="border-t border-slate-100 pt-5 mt-2">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Refinement History</h4>
            <button
              onClick={onUndo}
              disabled={loading}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 transition disabled:opacity-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              Undo last change
            </button>
          </div>
          
          <ul className="space-y-2">
            {history.map((item, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-slate-600">
                <span className="text-violet-500 mt-0.5">•</span>
                <span className={index === 0 ? "font-medium text-slate-800" : ""}>{item.instruction}</span>
              </li>
            ))}
            <li className="flex items-start gap-2 text-sm text-slate-500">
              <span className="text-slate-300 mt-0.5">•</span>
              Initial generation
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
