import { useMemo, useRef, useState } from "react";
import DeviceSwitcher from "./DeviceSwitcher";
import { buildProjectPreview } from "../preview/buildProjectPreview.js";
import { ensureReactImports } from "../preview/ensureReactImports.js";
import { usePreviewMessages } from "../preview/usePreviewMessages.js";
import { deviceWidths, statusStyles } from "../preview/previewUi.js";

const ENTRY = "src/App.jsx";

// Previews one generated component by running it as a one-file project on the
// project preview runtime, so it gets real import handling and error reporting.
export default function PreviewPanel({ result, device, setDevice, onStatus, canFixError, onFixError, fixing }) {
  const iframeRef = useRef(null);
  const [reloadKey, setReloadKey] = useState(0);

  const srcDoc = useMemo(
    () =>
      result
        ? buildProjectPreview({ [ENTRY]: ensureReactImports(result) }, ENTRY, {
            bodyClass: "p-4 bg-white min-h-screen",
          })
        : "",
    [result]
  );

  const { status, error } = usePreviewMessages(iframeRef, `${reloadKey}:${srcDoc}`, onStatus);
  const statusStyle = statusStyles[status];

  const refreshPreview = () => {
    setReloadKey((previousKey) => previousKey + 1);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[700px]">

      {/* =========================
          TOOLBAR
      ========================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-3 border-b bg-slate-50 gap-3 shrink-0">

        {/* Title */}
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${statusStyle.dot}`} />

          <h3 className="font-semibold text-slate-800">
            Live Preview
          </h3>

          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ml-1 ${statusStyle.badge}`}>
            {statusStyle.label}
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <DeviceSwitcher device={device} onChange={setDevice} />

          {/* Refresh */}
          <button
            onClick={refreshPreview}
            className="p-1.5 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            title="Refresh preview"
            aria-label="Refresh preview"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Error bar: first line only; the full message is shown inside the iframe */}
      {status === "error" && (
        <div role="alert" className="flex items-center gap-3 px-5 py-2 bg-rose-50 border-b border-rose-200 shrink-0">
          <span className="flex-1 min-w-0 text-sm text-rose-700 font-mono truncate">
            {error.split("\n")[0]}
          </span>

          {canFixError && (
            <button
              onClick={onFixError}
              disabled={fixing}
              className="shrink-0 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white px-3 py-1 rounded-lg text-xs font-semibold transition"
            >
              {fixing ? "Fixing..." : "Fix this error"}
            </button>
          )}
        </div>
      )}

      {/* =========================
          PREVIEW AREA
      ========================= */}
      <div className="flex-1 bg-slate-100/50 flex justify-center overflow-auto p-4 sm:p-8">

        <div
          className={`
            ${deviceWidths[device]}
            transition-all
            duration-300
            ease-in-out
            h-full
            bg-white
            shadow-sm
            border
            border-slate-200
            rounded-lg
            overflow-hidden
            flex
            flex-col
          `}
        >
          <iframe
            key={reloadKey}
            ref={iframeRef}
            title="Generated React component preview"
            sandbox="allow-scripts allow-forms allow-modals"
            srcDoc={srcDoc}
            className="w-full flex-1 border-0 bg-white"
          />
        </div>

      </div>
    </div>
  );
}
