import { useEffect, useState } from "react";

const freshState = (loadKey) => ({ loadKey, status: "loading", error: "", route: "/" });

// Tracks what the preview iframe reports through postMessage (see previewRuntime.js).
// `loadKey` must change whenever the iframe reloads: state from an earlier load is
// then ignored, so the status falls back to "loading" until the new load reports.
// `onStatus(status, error, where)` is optional and lets a parent react to ready/error;
// `where` = { file?, components? } tells where an error happened (project previews).
export function usePreviewMessages(iframeRef, loadKey, onStatus) {
  const [state, setState] = useState(() => freshState(loadKey));

  useEffect(() => {
    const current = (prev) => (prev.loadKey === loadKey ? prev : freshState(loadKey));

    const handleMessage = (event) => {
      // Only trust messages that come from our own iframe
      if (event.source !== iframeRef.current?.contentWindow) return;

      const data = event.data;
      if (data?.source !== "project-preview") return;

      if (data.type === "ready") {
        // A render error can't be undone by a later "ready"
        setState((prev) => {
          const next = current(prev);
          return next.status === "error" ? next : { ...next, status: "ready" };
        });
        onStatus?.("ready", "", {});
      } else if (data.type === "route") {
        setState((prev) => ({ ...current(prev), route: data.route }));
      } else if (data.type === "error") {
        setState((prev) => ({ ...current(prev), status: "error", error: data.message }));
        onStatus?.("error", data.message, { file: data.file, components: data.components });
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [iframeRef, loadKey, onStatus]);

  const { status, error, route } = state.loadKey === loadKey ? state : freshState(loadKey);

  return { status, error, route };
}
