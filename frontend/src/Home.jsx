import { useState, useMemo } from "react";
import axios from "axios";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [instruction, setInstruction] = useState("");

  const previewDoc = useMemo(() => {
    if (!result) return "";

    const componentName =
      result.match(/export\s+default\s+function\s+(\w+)/)?.[1] ||
      result.match(/export\s+default\s+const\s+(\w+)/)?.[1] ||
      "Component";

    const cleanedCode = result
      .replace(/import.*?;\n?/g, "")
      .replace("export default ", "");

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
          <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
          <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
          <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
        </head>

        <body class="p-4 bg-white">
          <div id="root"></div>

          <script type="text/babel">
            const { useState, useEffect, useMemo } = React;

            ${cleanedCode}

            const root = ReactDOM.createRoot(document.getElementById("root"));
            root.render(<${componentName} />);
          </script>
        </body>
      </html>
    `;
  }, [result]);

 const handleSubmit = async () => {
  if (!prompt.trim()) return;

  try {
    setLoading(true);
    setError("");
    setInstruction(""); // clear old refine text

    const response = await axios.post(
      "http://localhost:5000/api/generate",
      {
        prompt,
      }
    );

    setResult(response.data.result);
  } catch {
    setError("Failed to generate component.");
  } finally {
    setLoading(false);
  }
};

const handleRefine = async () => {
  if (!instruction.trim() || !result) return;

  try {
    setLoading(true);
    setError("");

    const response = await axios.post(
      "http://localhost:5000/api/generate",
      {
        existingCode: result,
        instruction,
      }
    );

    setResult(response.data.result);
    setInstruction("");
  } catch {
    setError("Failed to refine component.");
  } finally {
    setLoading(false);
  }
};

  const copyCode = async () => {
    await navigator.clipboard.writeText(result);
    setCopied(true);

    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-5">
      <div className="max-w-[1500px] mx-auto bg-white rounded-3xl shadow-xl p-8 lg:p-10">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-2xl">
            ✨
          </div>

          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-bold text-slate-900">
                Frontend Copilot
              </h1>

              <span className="px-2 py-1 text-xs font-semibold bg-emerald-100 text-emerald-700 rounded-full">
                BETA
              </span>
            </div>

            <p className="text-slate-500 mt-1">
              Generate, preview and refine beautiful React components instantly.
            </p>
          </div>
        </div>

        {/* Prompt Bar */}
        <div className="flex items-center gap-3 border border-slate-200 rounded-2xl p-2 bg-white shadow-sm">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-5 h-5 text-slate-400 ml-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-4.35-4.35M10 18a8 8 0 100-16 8 8 0 000 16z"
            />
          </svg>

          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe any React component..."
            className="flex-1 outline-none text-lg py-3"
          />

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-medium transition"
          >
            {loading ? "Generating..." : "Generate"}
          </button>
        </div>

        {error && (
          <p className="mt-4 text-red-600 font-medium">{error}</p>
        )}

        {/* RESULT */}
        {result && (
          <div className="mt-8 space-y-6">

            {/* Live Preview */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b bg-slate-50">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                  <h3 className="font-semibold text-slate-800">
                    Live Preview
                  </h3>
                </div>

                <span className="text-xs text-slate-500">
                  Rendered with React
                </span>
              </div>

              <iframe
                title="preview"
                srcDoc={previewDoc}
                className="w-full h-[650px] bg-white border-0"
              />
            </div>

            {/* AI Refine */}
<div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
  <div className="flex items-center gap-2 mb-3">
    <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
      ✨
    </div>
    <div>
      <h3 className="font-semibold text-slate-800">AI Refine</h3>
      <p className="text-sm text-slate-500">
        Modify the current component without starting over.
      </p>
    </div>
  </div>

  <div className="flex gap-3">
    <input
      type="text"
      value={instruction}
      onChange={(e) => setInstruction(e.target.value)}
      placeholder="e.g. Make it dark mode with glassmorphism"
      className="flex-1 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-violet-500"
    />

    <button
  onClick={handleRefine}
  disabled={loading}
  className="bg-violet-600 hover:bg-violet-700 text-white px-5 rounded-xl font-medium disabled:bg-gray-400"
>
  {loading ? "Refining..." : "Refine"}
</button>
  </div>
</div>

            {/* Generated Code */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="bg-slate-900 text-white flex justify-between items-center px-5 py-3">
                <h3 className="font-medium">Generated Code</h3>

                <div className="flex gap-2">
                  <button
                    onClick={copyCode}
                    className="bg-emerald-500 hover:bg-emerald-600 px-3 py-1 rounded-lg text-sm"
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>

                  <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="bg-indigo-500 hover:bg-indigo-600 px-3 py-1 rounded-lg text-sm"
                  >
                    {loading ? "Generating..." : "Regenerate"}
                  </button>
                </div>
              </div>

              <pre className="bg-[#0B1220] text-green-400 p-5 overflow-x-auto text-sm whitespace-pre-wrap">
                {result}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}