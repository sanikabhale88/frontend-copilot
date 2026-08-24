import { useMemo, useState } from "react";

export default function PreviewPanel({ result, device, setDevice }) {
  const [key, setKey] = useState(0);

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
          <meta charset="UTF-8" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          />

          <script src="https://cdn.tailwindcss.com"></script>

          <script src="https://unpkg.com/react@18/umd/react.development.js"></script>

          <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>

          <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
        </head>

        <body class="p-4 bg-white min-h-screen">
          <div id="root"></div>

          <script type="text/babel">
            // Make common React hooks available to generated components
            const {
              useState,
              useEffect,
              useMemo,
              useRef,
              useCallback,
              useReducer,
              useContext,
              useLayoutEffect
            } = React;

            ${cleanedCode}

            const root = ReactDOM.createRoot(
              document.getElementById("root")
            );

            root.render(<${componentName} />);
          </script>
        </body>
      </html>
    `;
  }, [result]);

  const refreshPreview = () => {
    setKey((previousKey) => previousKey + 1);
  };

  const deviceWidths = {
    desktop: "w-full",
    tablet: "w-[768px] max-w-full",
    mobile: "w-[375px] max-w-full",
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[700px]">

      {/* =========================
          TOOLBAR
      ========================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-3 border-b bg-slate-50 gap-3 shrink-0">

        {/* Title */}
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />

          <h3 className="font-semibold text-slate-800">
            Live Preview
          </h3>

          <span className="text-xs font-medium text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full ml-1">
            Ready
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 self-end sm:self-auto">

          {/* Device Switcher */}
          <div className="flex bg-slate-200 p-1 rounded-lg">

            {/* Desktop */}
            <button
              onClick={() => setDevice("desktop")}
              className={`
                p-1.5 rounded-md transition
                ${
                  device === "desktop"
                    ? "bg-white shadow-sm text-indigo-600"
                    : "text-slate-500 hover:text-slate-700"
                }
              `}
              title="Desktop preview"
              aria-label="Desktop preview"
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
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </button>

            {/* Tablet */}
            <button
              onClick={() => setDevice("tablet")}
              className={`
                p-1.5 rounded-md transition
                ${
                  device === "tablet"
                    ? "bg-white shadow-sm text-indigo-600"
                    : "text-slate-500 hover:text-slate-700"
                }
              `}
              title="Tablet preview"
              aria-label="Tablet preview"
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
                  d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
            </button>

            {/* Mobile */}
            <button
              onClick={() => setDevice("mobile")}
              className={`
                p-1.5 rounded-md transition
                ${
                  device === "mobile"
                    ? "bg-white shadow-sm text-indigo-600"
                    : "text-slate-500 hover:text-slate-700"
                }
              `}
              title="Mobile preview"
              aria-label="Mobile preview"
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
                  d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
            </button>
          </div>

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
            key={key}
            title="Generated React component preview"
            srcDoc={previewDoc}
            className="w-full flex-1 border-0 bg-white"
          />
        </div>

      </div>
    </div>
  );
}