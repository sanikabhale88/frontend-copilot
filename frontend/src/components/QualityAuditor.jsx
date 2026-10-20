import { useEffect, useMemo, useRef } from "react";
import { buildProjectPreview } from "../preview/buildProjectPreview.js";
import { ensureReactImports } from "../preview/ensureReactImports.js";
import { AUDIT_WIDTHS, AXE_WIDTH } from "../preview/qualityReport.js";

const ENTRY = "src/App.jsx";

// Renders the component off-screen at each audit width (no visible UI) and passes
// every iframe's result to `onResult(code, width, result)`. A preview error counts
// as a result too, so the audit never waits forever.
export default function QualityAuditor({ code, onResult }) {
  const iframeRefs = useRef({});

  const docs = useMemo(() => {
    if (!code) return {};

    const files = { [ENTRY]: ensureReactImports(code) };

    return Object.fromEntries(
      AUDIT_WIDTHS.map((width) => [
        width,
        buildProjectPreview(files, ENTRY, {
          bodyClass: "p-4 bg-white min-h-screen",
          audit: { width, axe: width === AXE_WIDTH },
        }),
      ])
    );
  }, [code]);

  useEffect(() => {
    const handleMessage = (event) => {
      const width = AUDIT_WIDTHS.find((w) => iframeRefs.current[w]?.contentWindow === event.source);
      if (!width) return;

      const data = event.data;
      if (data?.source !== "project-preview") return;

      if (data.type === "audit") {
        onResult(code, width, data);
      } else if (data.type === "error") {
        onResult(code, width, { failed: true, message: data.message });
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [code, onResult]);

  if (!code) return null;

  return (
    <div aria-hidden="true" className="fixed top-0 -left-[20000px] pointer-events-none">
      {AUDIT_WIDTHS.map((width) => (
        <iframe
          key={width}
          ref={(el) => {
            iframeRefs.current[width] = el;
          }}
          title={`Quality audit at ${width}px`}
          tabIndex={-1}
          sandbox="allow-scripts allow-forms"
          srcDoc={docs[width]}
          style={{ width, height: 800 }}
          className="border-0 block"
        />
      ))}
    </div>
  );
}
