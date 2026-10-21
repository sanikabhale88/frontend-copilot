import { resolvePath } from "./resolvePath.js";
import { runProject } from "./previewRuntime.js";
import { runAudit } from "./auditRuntime.js";

// Pinned browser (UMD) builds, in dependency order: each reads the globals of the
// ones before it. React 18 / Router v6 because React 19 and Router v7 no longer
// publish UMD builds. These only load inside the preview iframe.
const LIBRARIES = [
  "https://unpkg.com/react@18.3.1/umd/react.development.js",
  "https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js",
  "https://unpkg.com/@remix-run/router@1.23.0/dist/router.umd.min.js",
  "https://unpkg.com/react-router@6.30.1/dist/umd/react-router.development.js",
  "https://unpkg.com/react-router-dom@6.30.1/dist/umd/react-router-dom.development.js",
  "https://unpkg.com/@babel/standalone@7.26.10/babel.min.js",
];

// Accessibility checker, only loaded into audit iframes
const AXE = "https://unpkg.com/axe-core@4.10.2/axe.min.js";

// Escaping "<" keeps a "</script>" inside some file's code from closing the tag early
const toSafeJson = (value) => JSON.stringify(value).replace(/</g, "\\u003c");

// `bodyClass` lets a single component get some breathing room (a whole app sets its own layout).
// `audit: { width, axe }` turns the preview into a quality audit (see auditRuntime.js).
// `initialRoute` is where the app starts (audits check one route each).
export function buildProjectPreview(
  files,
  entry = "src/App.jsx",
  { bodyClass = "", audit = null, initialRoute = "/" } = {}
) {
  const libraries = audit?.axe ? [...LIBRARIES, AXE] : LIBRARIES;
  const scripts = libraries.map((src) => `<script src="${src}"></script>`).join("\n    ");
  const auditCall = audit ? `(${runAudit.toString()})(${audit.width}, ${Boolean(audit.axe)});` : "";

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script src="https://cdn.tailwindcss.com"></script>
    ${scripts}
  </head>
  <body class="${bodyClass}">
    <div id="root"></div>

    <script type="application/json" id="project-files">${toSafeJson(files)}</script>

    <script>
      (function () {
        if (!window.React || !window.ReactDOM || !window.ReactRouterDOM || !window.Babel) {
          window.parent.postMessage({
            source: "project-preview",
            type: "error",
            message: "Could not load the preview libraries. Check your internet connection and refresh."
          }, "*");
          return;
        }

        var files = JSON.parse(document.getElementById("project-files").textContent);

        (${runProject.toString()})(files, ${toSafeJson(entry)}, ${resolvePath.toString()}, ${toSafeJson(initialRoute)});
        ${auditCall}
      })();
    </script>
  </body>
</html>`;
}
