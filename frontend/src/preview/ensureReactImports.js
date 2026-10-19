// React APIs that generated code often calls without importing them (the old
// component preview injected the common hooks as globals)
const REACT_APIS = [
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
  "createContext",
  "forwardRef",
  "memo",
];

// Adds `import { ... } from "react"` for every React API the code calls but neither
// imports from "react" nor declares itself.
export function ensureReactImports(code) {
  const reactImports = (code.match(/import[^;]*?from\s*["']react["']/g) || []).join(" ");

  const missing = REACT_APIS.filter(
    (name) =>
      new RegExp(`\\b${name}\\s*\\(`).test(code) &&
      !new RegExp(`\\b${name}\\b`).test(reactImports) &&
      !new RegExp(`\\b(?:const|let|var|function)\\s+${name}\\b`).test(code)
  );

  return missing.length ? `import { ${missing.join(", ")} } from "react";\n${code}` : code;
}
