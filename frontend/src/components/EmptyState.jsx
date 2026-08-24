export default function EmptyState({ onSelectPrompt }) {
  const examples = [
    "Login page",
    "Analytics dashboard",
    "Pricing page",
    "Navbar",
    "Product card",
    "Landing page"
  ];

  return (
    <div className="flex flex-col items-center w-full mt-4">
      
      {/* Example Prompts */}
      <div className="mb-12 text-center w-full px-4">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-4">
          Try an example
        </h3>
        <div className="flex flex-wrap justify-center gap-2 max-w-2xl mx-auto">
          {examples.map((example) => (
            <button
              key={example}
              onClick={() => onSelectPrompt(example)}
              className="px-4 py-1.5 bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 rounded-full text-sm font-medium transition shadow-sm"
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      {/* Product Workflow */}
      <div className="w-full max-w-3xl px-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 sm:gap-4 border border-slate-200 bg-white/50 backdrop-blur-sm rounded-2xl p-6 sm:p-8 shadow-sm">
          
          <div className="flex flex-col items-center text-center flex-1">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <h4 className="font-semibold text-slate-800 mb-1">Generate</h4>
            <p className="text-xs text-slate-500 font-medium">Create React UI from natural language</p>
          </div>

          <div className="hidden sm:block text-slate-300">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </div>
          <div className="sm:hidden text-slate-300">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>

          <div className="flex flex-col items-center text-center flex-1">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <h4 className="font-semibold text-slate-800 mb-1">Preview</h4>
            <p className="text-xs text-slate-500 font-medium">See your component instantly</p>
          </div>

          <div className="hidden sm:block text-slate-300">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </div>
          <div className="sm:hidden text-slate-300">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>

          <div className="flex flex-col items-center text-center flex-1">
            <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <h4 className="font-semibold text-slate-800 mb-1">Refine</h4>
            <p className="text-xs text-slate-500 font-medium">Modify it without starting over</p>
          </div>

        </div>
      </div>
      
    </div>
  );
}
