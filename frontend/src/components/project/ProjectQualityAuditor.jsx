import { useEffect, useMemo, useRef, useState } from "react";
import { buildProjectPreview } from "../../preview/buildProjectPreview.js";
import { AXE_WIDTH, PROJECT_AUDIT_WIDTHS, auditRoute } from "../../preview/qualityReport.js";

// Gives up on a route that never reports. Sandboxed previews don't share the HTTP
// cache, so each one downloads the preview libraries (~5 MB); on a slow connection
// that takes a while. A timeout means "not checked", never "crashed".
const ROUTE_TIMEOUT_MS = 90000;

// Audits a generated project page by page, off-screen and without any visible UI:
// one route at a time, at each PROJECT_AUDIT_WIDTHS width (at most 2 iframes at once).
// Every result, or error, goes to onResult(route, width, data). Remount it (key) for
// a new version of the files.
export default function ProjectQualityAuditor({ files, pages, onResult }) {
  const [index, setIndex] = useState(0);
  const iframeRefs = useRef({});
  const received = useRef(new Set());

  // The latest callback, so a new function from the parent doesn't restart the route
  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  const page = pages[index];

  const docs = useMemo(() => {
    if (!page) return {};
    return Object.fromEntries(
      PROJECT_AUDIT_WIDTHS.map((width) => [
        width,
        buildProjectPreview(files, "src/App.jsx", {
          audit: { width, axe: width === AXE_WIDTH },
          initialRoute: auditRoute(page.route),
        }),
      ])
    );
  }, [files, page]);

  useEffect(() => {
    if (!page) return undefined;
    received.current = new Set();

    const record = (width, data) => {
      if (received.current.has(width)) return;
      received.current.add(width);
      onResultRef.current(page.route, width, data);
      if (received.current.size === PROJECT_AUDIT_WIDTHS.length) setIndex((i) => i + 1);
    };

    const handleMessage = (event) => {
      const width = PROJECT_AUDIT_WIDTHS.find((w) => iframeRefs.current[w]?.contentWindow === event.source);
      const data = event.data;
      if (!width || data?.source !== "project-preview") return;

      if (data.type === "audit") record(width, data);
      else if (data.type === "error") {
        record(width, { failed: true, message: data.message, where: { file: data.file, components: data.components } });
      }
    };

    const timer = setTimeout(() => {
      for (const width of PROJECT_AUDIT_WIDTHS) record(width, { timedOut: true });
    }, ROUTE_TIMEOUT_MS);

    window.addEventListener("message", handleMessage);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("message", handleMessage);
    };
  }, [page]);

  if (!page) return null;

  return (
    <div aria-hidden="true" className="fixed top-0 -left-[20000px] pointer-events-none">
      {PROJECT_AUDIT_WIDTHS.map((width) => (
        <iframe
          key={`${page.route}-${width}`}
          ref={(el) => {
            iframeRefs.current[width] = el;
          }}
          title={`Quality audit of ${page.route} at ${width}px`}
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
