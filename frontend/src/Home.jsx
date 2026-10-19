import { useCallback, useState } from "react";
import axios from "axios";
import Header from "./components/Header";
import EmptyState from "./components/EmptyState";
import PromptComposer from "./components/PromptComposer";
import Workspace from "./components/Workspace";
import Toast from "./components/Toast";
import ProjectWorkspace from "./components/project/ProjectWorkspace";
import sampleProject from "./project/sampleProject";

const API = import.meta.env.VITE_API_URL;

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [report, setReport] = useState(null); // backend verification report for `result`
  const [loading, setLoading] = useState(false);
  const [instruction, setInstruction] = useState("");

  // New States
  const [history, setHistory] = useState([]); // [{ instruction, code, report }, ...]
  const [preview, setPreview] = useState(null); // { code, status, message } last reported by the live preview
  const [device, setDevice] = useState("desktop");
  const [toast, setToast] = useState({ message: "", type: "" }); // { message, type }
  const [mode, setMode] = useState("component"); // "component" | "project"

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: "", type: "" }), 3000);
  };

  const handleSubmit = async () => {
    if (!prompt.trim()) {
      showToast("Please enter a prompt", "error");
      return;
    }

    try {
      setLoading(true);
      setInstruction(""); 
      setHistory([]);

      const response = await axios.post(`${API}/api/generate`, {
        prompt,
      });

      setResult(response.data.result);
      setReport(response.data.report ?? null);
      showToast("Component generated successfully", "success");
    } catch (error) {
      showToast(error.response?.data?.message || "Failed to generate component. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  // `request` overrides the typed instruction (used by "Fix this error");
  // `label` is what the refinement history shows for it
  const handleRefine = async (request, label) => {
    const isOverride = typeof request === "string";
    const text = isOverride ? request : instruction;

    if (!text.trim() || !result) {
      if (!text.trim()) showToast("Please enter a refinement instruction", "error");
      return;
    }

    try {
      setLoading(true);

      const response = await axios.post(`${API}/api/generate`, {
        existingCode: result,
        instruction: text,
      });

      // Save previous state to history before updating
      setHistory((prev) => [{ instruction: label || text, code: result, report }, ...prev]);

      setResult(response.data.result);
      setReport(response.data.report ?? null);
      if (!isOverride) setInstruction("");
      showToast("Component updated successfully", "success");
    } catch (error) {
      showToast(error.response?.data?.message || "Failed to refine component.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    
    const lastState = history[0];
    setResult(lastState.code);
    setReport(lastState.report ?? null);
    setHistory((prev) => prev.slice(1));
    showToast("Changes reverted", "success");
  };

  // Remember the preview status together with the code it belongs to, so a status
  // from an older version is never shown for the current one
  const handlePreviewStatus = useCallback(
    (status, message) => {
      setPreview({ code: result, status, message });
    },
    [result]
  );

  const previewStatus = preview?.code === result ? preview.status : "loading"; // "loading" | "ready" | "error"
  const previewError = previewStatus === "error" ? preview.message : "";

  const handleFixError = () => {
    if (!previewError) return;

    handleRefine(
      `The component throws this error in the live preview:\n\n${previewError}\n\n` +
        "Fix the cause of this error. Change only what is needed to fix it.",
      `Fix error: ${previewError.split("\n")[0]}`
    );
  };

  const handleNewComponent = () => {
    if (result && !window.confirm("Start a new component? Your current component will be cleared.")) {
      return;
    }
    
    setResult("");
    setReport(null);
    setPrompt("");
    setInstruction("");
    setHistory([]);
    setDevice("desktop");
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-indigo-100 selection:text-indigo-900 overflow-x-hidden">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <Header
          onNewComponent={handleNewComponent}
          mode={mode}
          onModeChange={setMode}
          modeDisabled={loading}
        />

        {mode === "project" ? (
          <ProjectWorkspace project={sampleProject} showToast={showToast} />
        ) : !result ? (
          <div className="flex flex-col items-center justify-center mt-6 md:mt-10 w-full relative z-10">
            {/* Glow background */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-2xl h-[300px] bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none -z-10"></div>
            
            {/* Hero */}
            <div className="text-center mb-8">
              <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
                Build interfaces with AI.
              </h2>
              <p className="text-lg text-slate-500 max-w-xl mx-auto px-4">
                Generate React components, preview them instantly, and refine them with natural language.
              </p>
            </div>

            {/* Prompt Composer */}
            <div className="w-full px-2 sm:px-0">
              <PromptComposer 
                prompt={prompt}
                setPrompt={setPrompt}
                onSubmit={handleSubmit}
                loading={loading}
              />
            </div>

            {/* Examples, Workflow, Preview */}
            <EmptyState onSelectPrompt={(selectedPrompt) => setPrompt(selectedPrompt)} />
          </div>
        ) : (
          <Workspace
            result={result}
            device={device}
            setDevice={setDevice}
            instruction={instruction}
            setInstruction={setInstruction}
            onRefine={handleRefine}
            loading={loading}
            history={history}
            onUndo={handleUndo}
            onRegenerate={handleSubmit}
            showToast={showToast}
            report={report}
            onPreviewStatus={handlePreviewStatus}
            previewStatus={previewStatus}
            previewError={previewError}
            onFixError={handleFixError}
          />
        )}

        {toast.message && (
          <Toast message={toast.message} type={toast.type} />
        )}
      </div>

      <footer className="mt-16 py-8 text-center text-slate-400 text-sm border-t border-slate-200 bg-white w-full">
        <p>Frontend Copilot • Built with React + Tailwind + Gemini</p>
      </footer>
    </div>
  );
}