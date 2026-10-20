// Checks generated component code before it reaches the frontend, so hallucinated
// imports, undefined components and broken output are caught (and repaired) here
// instead of showing up as a blank preview.

const { parse } = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const { checkPlaybook } = require("./playbook");

// React APIs the model often uses without importing; missing imports get added
const REACT_APIS = new Set([
  "useState",
  "useEffect",
  "useMemo",
  "useRef",
  "useCallback",
  "useReducer",
  "useContext",
  "useLayoutEffect",
  "useId",
  "useTransition",
  "useDeferredValue",
  "useImperativeHandle",
  "useSyncExternalStore",
  "useInsertionEffect",
  "useDebugValue",
  "createContext",
  "forwardRef",
  "memo",
  "lazy",
  "Fragment",
  "Suspense",
  "StrictMode",
]);

// Browser globals that Node's globalThis doesn't have (the preview runs in a browser;
// React is a global there too)
const BROWSER_GLOBALS = new Set([
  "React",
  "window",
  "document",
  "localStorage",
  "sessionStorage",
  "history",
  "location",
  "screen",
  "alert",
  "confirm",
  "prompt",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "getComputedStyle",
  "matchMedia",
  "innerWidth",
  "innerHeight",
  "scrollX",
  "scrollY",
  "scrollTo",
  "open",
  "Image",
  "Audio",
  "Option",
  "IntersectionObserver",
  "ResizeObserver",
  "MutationObserver",
  "HTMLElement",
  "Element",
  "Node",
  "KeyboardEvent",
  "MouseEvent",
  "FileReader",
  "arguments",
]);

// On Node's globalThis but not in a browser
const NODE_ONLY_GLOBALS = new Set(["process", "Buffer", "global", "setImmediate", "clearImmediate"]);

const isKnownGlobal = (name) =>
  BROWSER_GLOBALS.has(name) || (name in globalThis && !NODE_ONLY_GLOBALS.has(name));

// Keeps only the code: takes the inside of a ``` fence and drops any prose before it
function cleanCode(raw) {
  let code = String(raw ?? "").trim();
  let changed = false;

  const fence = code.match(/```[\w-]*\s*\n([\s\S]*?)```/);
  if (fence) {
    code = fence[1].trim();
    changed = true;
  }

  // Prose before the first line that looks like code ("Here is your component:")
  const firstCodeLine = code.search(/^\s*(import|export|function|const|let|var|\/\/|\/\*)/m);
  if (firstCodeLine > 0) {
    code = code.slice(firstCodeLine).trim();
    changed = true;
  }

  return { code, changed };
}

// Name of the default-exported component, or "" when it can't be found
function getComponentName(code) {
  try {
    const ast = parse(code, { sourceType: "module", plugins: ["jsx"] });
    const node = ast.program.body.find((n) => n.type === "ExportDefaultDeclaration");
    return node?.declaration.id?.name || node?.declaration.name || "";
  } catch {
    return "";
  }
}

// Returns { code, componentName, checks, errors }.
// `code` is the cleaned (and possibly import-fixed) code to send to the frontend,
// `checks` is [{ id, group: "code"|"playbook", label, status: "pass"|"fixed"|"fail"|"skipped", message }],
// `errors` lists the failing checks' messages, ready to go into a repair prompt.
// Pass `originalName` on refine to make sure the component wasn't renamed.
// `playbook` (normalized) adds the team's checked rules; `baseline` lists playbook
// check ids that already failed before a refine: they are reported but not sent to
// repair, so a small refine doesn't rewrite unrelated code.
function validateComponent(raw, { originalName, playbook = null, baseline = [] } = {}) {
  const checks = [];
  const add = (id, label, status, message = "") => checks.push({ id, group: "code", label, status, message });

  const cleaned = cleanCode(raw);
  let code = cleaned.code;

  add(
    "format",
    "Raw code only",
    cleaned.changed ? "fixed" : "pass",
    cleaned.changed ? "Removed markdown fences or explanation text around the code." : ""
  );

  // ---------- Syntax ----------
  let ast;
  try {
    ast = parse(code, { sourceType: "module", plugins: ["jsx"] });
    add("syntax", "Valid JSX syntax", "pass");
  } catch (error) {
    add("syntax", "Valid JSX syntax", "fail", `Syntax error: ${error.message}`);
    for (const [id, label] of [
      ["imports", "Only React imports"],
      ["identifiers", "No undefined components or variables"],
      ["react-imports", "React APIs imported"],
      ["export", "Default-exported component"],
    ]) {
      add(id, label, "skipped", "Skipped because the code doesn't parse.");
    }
    return finish(code, "", checks);
  }

  // ---------- Imports ----------
  const imports = ast.program.body.filter((n) => n.type === "ImportDeclaration");
  const badImports = [...new Set(imports.map((n) => n.source.value).filter((s) => s !== "react"))];

  add(
    "imports",
    "Only React imports",
    badImports.length ? "fail" : "pass",
    badImports.length
      ? `Imports ${badImports.map((s) => `"${s}"`).join(", ")}, which the preview can't load. ` +
          "Remove these imports and write the code yourself (inline SVG for icons)."
      : ""
  );

  // ---------- Undefined identifiers / missing React imports ----------
  let unbound = [];
  traverse(ast, {
    Program(path) {
      unbound = Object.keys(path.scope.globals);
      path.stop();
    },
  });

  const missingReact = unbound.filter((name) => REACT_APIS.has(name));
  const undefinedNames = unbound.filter((name) => !REACT_APIS.has(name) && !isKnownGlobal(name));

  add(
    "identifiers",
    "No undefined components or variables",
    undefinedNames.length ? "fail" : "pass",
    undefinedNames.length
      ? `Uses ${undefinedNames.map((n) => `"${n}"`).join(", ")} but never defines ${
          undefinedNames.length === 1 ? "it" : "them"
        }. Define them in this file or remove them.`
      : ""
  );

  if (missingReact.length) {
    code = `import { ${missingReact.join(", ")} } from "react";\n${code}`;
  }

  add(
    "react-imports",
    "React APIs imported",
    missingReact.length ? "fixed" : "pass",
    missingReact.length ? `Added the missing import for ${missingReact.join(", ")}.` : ""
  );

  // ---------- Default export ----------
  const exportNode = ast.program.body.find((n) => n.type === "ExportDefaultDeclaration");
  const componentName = exportNode?.declaration.id?.name || exportNode?.declaration.name || "";

  if (!exportNode) {
    add("export", "Default-exported component", "fail", "There is no `export default` component.");
  } else if (!componentName) {
    add(
      "export",
      "Default-exported component",
      "fail",
      "The default export has no name. Use `export default function ComponentName() { ... }`."
    );
  } else if (!/^[A-Z]/.test(componentName)) {
    add(
      "export",
      "Default-exported component",
      "fail",
      `The component "${componentName}" must start with a capital letter.`
    );
  } else {
    add("export", "Default-exported component", "pass");
  }

  // ---------- Refine: same component name ----------
  if (originalName) {
    const renamed = componentName && componentName !== originalName;
    add(
      "name",
      "Component name kept",
      renamed ? "fail" : "pass",
      renamed ? `The component was renamed from "${originalName}" to "${componentName}". Keep the name "${originalName}".` : ""
    );
  }

  // ---------- Team playbook ----------
  for (const check of checkPlaybook(ast, cleaned.code, playbook)) {
    if (check.status === "fail" && baseline.includes(check.id)) {
      checks.push({ ...check, preexisting: true, message: `Already broken before this change. ${check.message}` });
    } else {
      checks.push(check);
    }
  }

  return finish(code, componentName, checks);
}

// Pre-existing playbook violations are reported but not repaired
function finish(code, componentName, checks) {
  const errors = checks.filter((c) => c.status === "fail" && !c.preexisting).map((c) => c.message);
  return { code, componentName, checks, errors };
}

// Ids of the playbook rules `code` already breaks (the baseline for a refine)
function failedPlaybookRules(code, playbook) {
  if (!playbook) return [];

  return validateComponent(code, { playbook })
    .checks.filter((c) => c.group === "playbook" && c.status === "fail")
    .map((c) => c.id);
}

module.exports = { validateComponent, getComponentName, cleanCode, failedPlaybookRules };
