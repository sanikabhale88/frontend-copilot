import { useMemo, useRef, useState } from "react";
import DeviceSwitcher from "../DeviceSwitcher";
import { buildProjectPreview } from "../../preview/buildProjectPreview.js";
import { usePreviewMessages } from "../../preview/usePreviewMessages.js";
import { deviceWidths, statusStyles } from "../../preview/previewUi.js";

// `onStatus(status, error, where)` reports ready/errors to the parent; `onFixError`
// (generated projects only) adds a "Fix this error" button to the error bar
export default function ProjectPreview({ files, onStatus, onFixError, fixing = false }) {
  const iframeRef = useRef(null);
  const srcDoc = useMemo(() => buildProjectPreview(files), [files]);

  const [reloadKey, setReloadKey] = useState(0);
  const [device, setDevice] = useState("desktop");

  // Status, error and route reset on their own whenever the iframe reloads
  const { status, error, route } = usePreviewMessages(iframeRef, `${reloadKey}:${srcDoc}`, onStatus);

  const refresh = () => {
    setReloadKey((key) => key + 1);
  };

  const statusStyle = statusStyles[status];

  return (
    <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[640px]">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-3 border-b bg-slate-50 shrink-0">
        <div className="flex items-center gap-2 shrink-0">
          <div className={`w-2.5 h-2.5 rounded-full ${statusStyle.dot}`} />
          <h3 className="font-semibold text-slate-800">Project Preview</h3>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ml-1 ${statusStyle.badge}`}>
            {statusStyle.label}
          </span>
        </div>

        {/* Address bar (read-only) */}
        <div
          className="flex-1 min-w-0 bg-white border border-slate-200 rounded-lg px-3 py-1.5 font-mono text-sm text-slate-600 truncate"
          title="Current route"
        >
          {route}
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <DeviceSwitcher device={device} onChange={setDevice} />

          <button
            onClick={refresh}
            className="p-1.5 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            title="Refresh preview"
            aria-label="Refresh preview"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Error bar: first line only; the full message is shown inside the iframe */}
      {status === "error" && (
        <div role="alert" className="flex items-center gap-3 px-5 py-2 bg-rose-50 border-b border-rose-200 shrink-0">
          <span className="flex-1 min-w-0 text-sm text-rose-700 font-mono truncate">{error.split("\n")[0]}</span>
          {onFixError && (
            <button
              type="button"
              onClick={onFixError}
              disabled={fixing}
              className="shrink-0 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white px-3 py-1 rounded-lg text-xs font-semibold transition"
            >
              {fixing ? "Fixing..." : "Fix this error"}
            </button>
          )}
        </div>
      )}

      {/* Preview area */}
      <div className="flex-1 bg-slate-100/50 flex justify-center overflow-auto p-4 sm:p-6">
        <div
          className={`${deviceWidths[device]} transition-all duration-300 ease-in-out h-full bg-white shadow-sm border border-slate-200 rounded-lg overflow-hidden flex flex-col`}
        >
          <iframe
            key={reloadKey}
            ref={iframeRef}
            title="Project preview"
            sandbox="allow-scripts allow-forms allow-modals"
            srcDoc={srcDoc}
            className="w-full flex-1 border-0 bg-white"
          />
        </div>
      </div>
    </section>
  );
}
