export default function PromptComposer({ prompt, setPrompt, onSubmit, loading }) {
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto mb-8">
      <div className="relative group">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-violet-500/20 rounded-2xl blur-lg transition duration-500"></div>
        <div className="relative flex flex-col border border-slate-200 focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-500/10 rounded-2xl bg-white shadow-sm transition overflow-hidden">
          
          <div className="flex px-4 pt-4 pb-2 items-start gap-3">
            <div className="text-indigo-500 mt-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe the interface you want to build..."
              className="flex-1 outline-none text-base py-1 min-h-[100px] resize-none bg-transparent text-slate-800 placeholder-slate-400 leading-relaxed"
            />
          </div>

          <div className="flex justify-between items-center px-4 py-3 bg-slate-50 border-t border-slate-100">
            <div className="text-xs text-slate-400 font-medium">
              Press <kbd className="font-sans px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded">Enter</kbd> to generate, <kbd className="font-sans px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded">Shift + Enter</kbd> for new line
            </div>
            <button
              onClick={onSubmit}
              disabled={loading || !prompt.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg font-medium transition shadow-sm flex items-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating...
                </>
              ) : "Generate"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
