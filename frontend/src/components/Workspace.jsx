import { useState } from "react";
import PreviewPanel from "./PreviewPanel";
import CodePanel from "./CodePanel";
import RefinePanel from "./RefinePanel";

export default function Workspace({ 
  result, 
  device, 
  setDevice, 
  instruction, 
  setInstruction, 
  onRefine, 
  loading, 
  history, 
  onUndo, 
  onRegenerate,
  showToast
}) {
  const [activeTab, setActiveTab] = useState("preview"); // "preview" or "code"

  return (
    <div className="mt-8">
      {/* Mobile Tabs */}
      <div className="lg:hidden flex border-b border-slate-200 mb-6">
        <button
          onClick={() => setActiveTab("preview")}
          className={`flex-1 py-3 text-sm font-semibold transition border-b-2 ${
            activeTab === "preview" 
              ? "border-indigo-600 text-indigo-600" 
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Preview & Refine
        </button>
        <button
          onClick={() => setActiveTab("code")}
          className={`flex-1 py-3 text-sm font-semibold transition border-b-2 ${
            activeTab === "code" 
              ? "border-indigo-600 text-indigo-600" 
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Generated Code
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Column: Preview & Refine */}
        <div className={`flex-1 flex-col gap-6 ${activeTab === "preview" ? "flex" : "hidden lg:flex"}`}>
          <PreviewPanel 
            result={result} 
            device={device} 
            setDevice={setDevice} 
          />
          <RefinePanel 
            instruction={instruction}
            setInstruction={setInstruction}
            onRefine={onRefine}
            loading={loading}
            history={history}
            onUndo={onUndo}
          />
        </div>

        {/* Right Column: Code */}
        <div className={`lg:w-[45%] flex-col ${activeTab === "code" ? "flex" : "hidden lg:flex"}`}>
          <CodePanel 
            result={result}
            onRegenerate={onRegenerate}
            loading={loading}
            showToast={showToast}
          />
        </div>
      </div>
    </div>
  );
}
