import { useState } from "react";
import PreviewPanel from "./PreviewPanel";
import CodePanel from "./CodePanel";
import RefinePanel from "./RefinePanel";
import QualityPanel from "./QualityPanel";
import QualityAuditor from "./QualityAuditor";

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
  showToast,
  report,
  onPreviewStatus,
  previewStatus,
  previewError,
  onFixError,
  changes,
  review,
  onReviewChanges,
  onRevertHunks,
  quality,
  onAuditResult,
  onAutoFix
}) {
  const [activeTab, setActiveTab] = useState("preview"); // "preview" or "code"

  return (
    <div className="mt-8">
      {/* Off-screen audit previews that feed the Quality Gate */}
      <QualityAuditor code={result} onResult={onAuditResult} />

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
            onStatus={onPreviewStatus}
            canFixError={Boolean(previewError)}
            onFixError={onFixError}
            fixing={loading}
          />
          <QualityPanel
            quality={quality}
            previousScore={history[0]?.score ?? null}
            onAutoFix={onAutoFix}
            loading={loading}
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
            report={report}
            previewStatus={previewStatus}
            previewError={previewError}
            changes={changes}
            changeLabel={history[0]?.instruction}
            review={review}
            onReviewChanges={onReviewChanges}
            onRevertHunks={onRevertHunks}
            onRegenerate={onRegenerate}
            loading={loading}
            showToast={showToast}
          />
        </div>
      </div>
    </div>
  );
}
