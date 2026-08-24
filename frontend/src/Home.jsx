import { useState } from "react";
import axios from "axios";
import Header from "./components/Header";
import EmptyState from "./components/EmptyState";
import PromptComposer from "./components/PromptComposer";
import Workspace from "./components/Workspace";
import Toast from "./components/Toast";

const API = import.meta.env.VITE_API_URL;

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [instruction, setInstruction] = useState("");
  
  // New States
  const [history, setHistory] = useState([]); // [{ instruction, code }, ...]
  const [device, setDevice] = useState("desktop");
  const [toast, setToast] = useState({ message: "", type: "" }); // { message, type }

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
      showToast("Component generated successfully", "success");
    } catch {
      showToast("Failed to generate component. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRefine = async () => {
    if (!instruction.trim() || !result) {
      if (!instruction.trim()) showToast("Please enter a refinement instruction", "error");
      return;
    }

    try {
      setLoading(true);

      const response = await axios.post(`${API}/api/generate`, {
        existingCode: result,
        instruction,
      });

      // Save previous state to history before updating
      setHistory((prev) => [{ instruction, code: result }, ...prev]);
      
      setResult(response.data.result);
      setInstruction("");
      showToast("Component updated successfully", "success");
    } catch {
      showToast("Failed to refine component.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    
    const lastState = history[0];
    setResult(lastState.code);
    setHistory((prev) => prev.slice(1));
    showToast("Changes reverted", "success");
  };

  const handleNewComponent = () => {
    if (result && !window.confirm("Start a new component? Your current component will be cleared.")) {
      return;
    }
    
    setResult("");
    setPrompt("");
    setInstruction("");
    setHistory([]);
    setDevice("desktop");
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-indigo-100 selection:text-indigo-900 overflow-x-hidden">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <Header onNewComponent={handleNewComponent} />

        {!result ? (
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