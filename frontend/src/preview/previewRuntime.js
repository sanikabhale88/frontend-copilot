/* global React, ReactDOM, ReactRouterDOM, Babel */

// Runs INSIDE the preview iframe: a tiny module system that compiles each project
// file with Babel, resolves imports between them, and renders the entry component.
//
// Must stay self-contained (no imports, no outside variables): its source text is
// injected into the iframe with .toString(). React, ReactDOM, ReactRouterDOM and
// Babel are globals from the CDN scripts loaded by buildProjectPreview.
export function runProject(files, entry, resolvePath, initialRoute = "/") {
  const h = React.createElement;

  // ---------- Talking to the parent app ----------

  const report = (type, payload = {}) => {
    window.parent.postMessage({ source: "project-preview", type, ...payload }, "*");
  };

  // Show only the first error; later ones are usually caused by it.
  // `where` = { file } for module errors or { components } (from React's component
  // stack) for render errors, so the app can tell which file to fix.
  let errorShown = false;

  const showError = (message, where = {}) => {
    if (errorShown) return;
    errorShown = true;
    report("error", { message, ...where });

    const box = document.createElement("div");
    box.style.cssText =
      "position:fixed;inset:0;z-index:9999;padding:24px;overflow:auto;" +
      "background:#fff1f2;color:#9f1239;white-space:pre-wrap;" +
      "font:13px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;";
    box.textContent = "Preview error\n\n" + message;
    document.body.appendChild(box);
  };

  // React (development build) also reports render errors here, *before* the
  // ErrorBoundary below gets them with the component stack. Wait a moment so the
  // boundary's report, which says which component crashed, wins.
  window.addEventListener("error", (event) => {
    const message = event.error?.message || event.message;
    setTimeout(() => showError(message), 50);
  });

  window.addEventListener("unhandledrejection", (event) => {
    showError(String(event.reason?.message || event.reason));
  });

  // ---------- Module system ----------

  const externals = {
    react: React,
    "react-dom": ReactDOM,
    "react-dom/client": ReactDOM,
    "react-router-dom": ReactRouterDOM,
  };

  const cache = {};

  // Errors while compiling or running a module's top level remember their file
  class ModuleError extends Error {
    constructor(message, file) {
      super(message);
      this.file = file;
    }
  }

  function loadModule(path) {
    if (cache[path]) return cache[path].exports;

    // JSX + import/export → plain JS using require() / module.exports
    let code;
    try {
      code = Babel.transform(files[path], {
        filename: path,
        presets: ["react"],
        plugins: ["transform-modules-commonjs"],
      }).code;
    } catch (error) {
      throw new ModuleError(error.message, path);
    }

    // Cache before running, so circular imports don't loop forever
    const module = { exports: {} };
    cache[path] = module;

    const localRequire = (request) => {
      if (Object.prototype.hasOwnProperty.call(externals, request)) {
        return externals[request];
      }

      // Stylesheets are ignored; Tailwind comes from the CDN
      if (request.endsWith(".css")) return {};

      const resolved = resolvePath(path, request, files);

      if (resolved === request) {
        throw new Error(
          `Package "${request}" is not available in the preview (imported from ${path}).`
        );
      }

      if (!resolved) {
        throw new Error(`Cannot find "${request}" imported from ${path}.`);
      }

      return loadModule(resolved);
    };

    try {
      new Function("require", "module", "exports", code)(localRequire, module, module.exports);
    } catch (error) {
      // Keep the innermost file (an import that failed deeper down)
      throw error instanceof ModuleError ? error : new ModuleError(error.message, path);
    }

    return module.exports;
  }

  // ---------- Rendering ----------

  class ErrorBoundary extends React.Component {
    constructor(props) {
      super(props);
      this.state = { failed: false };
    }

    static getDerivedStateFromError() {
      return { failed: true };
    }

    // React's component stack names the components that were rendering, innermost
    // first; the app maps those names to project files
    componentDidCatch(error, info) {
      const components = [...String(info?.componentStack || "").matchAll(/at ([A-Z][\w$]*)/g)]
        .map((match) => match[1])
        .filter((name) => name !== "ErrorBoundary");

      showError(error.message, { components });
    }

    render() {
      return this.state.failed ? null : this.props.children;
    }
  }

  // Tells the parent which route is showing, for the address bar
  function RouteReporter() {
    const location = ReactRouterDOM.useLocation();

    React.useEffect(() => {
      report("route", { route: location.pathname });
    }, [location.pathname]);

    return null;
  }

  try {
    if (!Object.prototype.hasOwnProperty.call(files, entry)) {
      throw new Error(`Entry file "${entry}" was not found in the project.`);
    }

    const App = loadModule(entry).default;

    if (!App) {
      throw new Error(`${entry} must have a default export component.`);
    }

    // MemoryRouter: an srcDoc iframe has no real URL for BrowserRouter to use.
    // Audits start on a specific route.
    ReactDOM.createRoot(document.getElementById("root")).render(
      h(
        ReactRouterDOM.MemoryRouter,
        { initialEntries: [initialRoute] },
        h(ErrorBoundary, null, h(RouteReporter), h(App))
      )
    );

    report("ready");
  } catch (error) {
    showError(error.message, error.file ? { file: error.file } : {});
  }
}
