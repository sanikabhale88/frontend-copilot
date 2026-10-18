export default function FileViewer({ path, code, showToast }) {
  const hasFile = Boolean(path) && code !== undefined;

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

      <div className="flex-1 overflow-auto bg-[#0B1220] p-5">
        {hasFile ? (
          <pre className="text-emerald-400 text-[13px] leading-relaxed font-mono whitespace-pre-wrap break-words">
            {code}
          </pre>
        ) : (
          <p className="text-sm text-slate-500">Select a file to view its code.</p>
        )}
      </div>
    </div>
  );
}
