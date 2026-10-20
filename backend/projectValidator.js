// Validates one file of a generated multi-file project: the normal component
// checks (validator.js) with project imports allowed, plus checks that only make
// sense in a project (relative imports resolve, no router wrapper).

const { validateComponent } = require("./validator");
const { resolvePath } = require("./resolvePath");

// Packages the project preview provides (see frontend/src/preview/previewRuntime.js)
const PACKAGES = new Set(["react", "react-dom", "react-dom/client", "react-router-dom"]);

// The preview already wraps the app in a MemoryRouter
const ROUTER_WRAPPERS = new Set(["BrowserRouter", "HashRouter", "MemoryRouter", "Router", "RouterProvider"]);

const isRelative = (source) => source.startsWith("./") || source.startsWith("../");
const allowImport = (source) => PACKAGES.has(source) || isRelative(source);

// `files` is the whole project ({ path: code }), to resolve relative imports.
// `requireComponent: false` skips the default-exported-component check (helper or
// data files the model added on its own).
// Returns { code, checks, errors } like validateComponent.
function validateProjectFile(path, code, files, { playbook = null, requireComponent = true } = {}) {
  const validation = validateComponent(code, { playbook, allowImport });
  const checks = validation.checks.filter((check) => requireComponent || check.id !== "export");

  if (validation.ast) {
    const imports = validation.ast.program.body.filter((node) => node.type === "ImportDeclaration");

    // ---------- Relative imports point at real files ----------
    const unresolved = imports
      .map((node) => node.source.value)
      .filter((source) => isRelative(source) && !resolvePath(path, source, files));

    checks.push({
      id: "imports-resolve",
      group: "code",
      label: "Imports point to project files",
      status: unresolved.length ? "fail" : "pass",
      message: unresolved.length
        ? `Imports ${unresolved.map((s) => `"${s}"`).join(", ")} from ${path}, but no such file exists in the project. ` +
          "Fix the path or remove the import."
        : "",
    });

    // ---------- No router wrapper ----------
    const wrappers = imports
      .filter((node) => node.source.value === "react-router-dom")
      .flatMap((node) => node.specifiers)
      .map((specifier) => specifier.imported?.name)
      .filter((name) => ROUTER_WRAPPERS.has(name));

    checks.push({
      id: "no-router-wrapper",
      group: "code",
      label: "No router wrapper",
      status: wrappers.length ? "fail" : "pass",
      message: wrappers.length
        ? `Uses ${[...new Set(wrappers)].join(", ")}. The app is already wrapped in a router: remove it and render <Routes> directly.`
        : "",
    });
  }

  const errors = checks.filter((c) => c.status === "fail" && !c.preexisting).map((c) => c.message);

  return { code: validation.code, checks, errors };
}

module.exports = { validateProjectFile, PACKAGES };
