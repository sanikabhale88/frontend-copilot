// Drift check: does the generated code match the blueprint it was generated from?
// One check per page and component, one for the routes and one for unplanned
// files: { id, group: "blueprint", label, status: "pass"|"fail"|"warn", message, file }.
// `file` says which file a repair has to change.

const { parse } = require("@babel/parser");
const traverse = require("@babel/traverse").default;

const APP_FILE = "src/App.jsx";

// Props a component may accept without them being in the blueprint
const IMPLICIT_PROPS = new Set(["children"]);

function parseFile(code) {
  try {
    return parse(code, { sourceType: "module", plugins: ["jsx"] });
  } catch {
    return null; // the code checks already report the syntax error
  }
}

const isFunctionNode = (node) =>
  node?.type === "ArrowFunctionExpression" || node?.type === "FunctionExpression" || node?.type === "FunctionDeclaration";

// Everything the drift rules need from one file, in one walk
function analyze(ast) {
  const exportNode = ast.program.body.find((node) => node.type === "ExportDefaultDeclaration");
  const declaration = exportNode?.declaration;
  const exportName = declaration?.id?.name || (declaration?.type === "Identifier" ? declaration.name : "");

  const rendered = new Set();
  const routes = [];
  let props = null; // null = the component's props couldn't be determined

  traverse(ast, {
    JSXOpeningElement(path) {
      const name = path.node.name.name;
      if (typeof name === "string" && /^[A-Z]/.test(name)) rendered.add(name);

      if (name === "Route") {
        const attribute = (attr) => path.node.attributes.find((a) => a.type === "JSXAttribute" && a.name.name === attr);
        const routePath = attribute("path")?.value;

        if (routePath?.type === "StringLiteral") routes.push(routePath.value);
        else if (attribute("index")) routes.push("/");
      }
    },

    // The default-exported component's props: destructured keys, or props.x reads
    Function(path) {
      if (props !== null || !exportName) return;

      const node = path.node;
      const parent = path.parent;
      const name = node.id?.name || (parent.type === "VariableDeclarator" ? parent.id.name : null);
      if (name !== exportName || !isFunctionNode(node)) return;

      const param = node.params[0];

      if (!param) {
        props = [];
      } else if (param.type === "ObjectPattern") {
        props = param.properties
          .map((property) => (property.type === "RestElement" ? null : property.key?.name))
          .filter(Boolean);
      } else if (param.type === "Identifier") {
        const read = new Set();
        path.traverse({
          MemberExpression(inner) {
            if (inner.node.object.name === param.name && inner.node.property.type === "Identifier") {
              read.add(inner.node.property.name);
            }
          },
        });
        props = [...read];
      }
    },
  });

  return { exportName, rendered, routes, props };
}

const normalizeRoute = (route) => (route === "/" ? "/" : `/${route.replace(/^\/+/, "").replace(/\/$/, "")}`);
const quote = (items) => items.map((item) => `"${item}"`).join(", ");

function checkDrift(blueprint, files) {
  const checks = [];
  const analyses = new Map();

  const analysisOf = (path) => {
    if (!analyses.has(path)) {
      const ast = typeof files[path] === "string" ? parseFile(files[path]) : null;
      analyses.set(path, ast ? analyze(ast) : null);
    }
    return analyses.get(path);
  };

  const add = (id, label, problems, file) =>
    checks.push({
      id,
      group: "blueprint",
      label,
      status: problems.length ? "fail" : "pass",
      message: problems.join(" "),
      file,
    });

  // ---------- Pages and components ----------
  const planned = [
    ...blueprint.pages.map((page) => ({ ...page, kind: "page" })),
    ...blueprint.components.map((component) => ({ ...component, kind: "component" })),
  ];

  for (const item of planned) {
    const problems = [];
    const label = item.kind === "page" ? `Page ${item.name} (${item.route})` : `Component ${item.name}`;

    if (typeof files[item.file] !== "string") {
      problems.push(`Missing file ${item.file}: create it with a default-exported ${item.kind} named ${item.name}.`);
      add(`${item.kind}-${item.name}`, label, problems, item.file);
      continue;
    }

    const analysis = analysisOf(item.file);

    if (analysis) {
      if (analysis.exportName !== item.name) {
        problems.push(
          `${item.file} must default-export a component named "${item.name}"` +
            (analysis.exportName ? ` (it exports "${analysis.exportName}").` : ".")
        );
      }

      const notRendered = item.uses.filter((name) => !analysis.rendered.has(name));
      if (notRendered.length) {
        problems.push(`${item.name} should render ${quote(notRendered)} as planned in the blueprint, but doesn't.`);
      }

      if (item.kind === "component" && analysis.props !== null) {
        const plannedProps = item.props.map((prop) => prop.name);
        const missing = plannedProps.filter((name) => !analysis.props.includes(name));
        const extra = analysis.props.filter((name) => !plannedProps.includes(name) && !IMPLICIT_PROPS.has(name));

        if (missing.length) problems.push(`${item.name} must accept the planned props ${quote(missing)}.`);
        if (extra.length) problems.push(`${item.name} accepts props ${quote(extra)} that aren't in the blueprint; remove them.`);
      }
    }

    add(`${item.kind}-${item.name}`, label, problems, item.file);
  }

  // ---------- Routes ----------
  const routeProblems = [];
  const app = typeof files[APP_FILE] === "string" ? analysisOf(APP_FILE) : null;

  if (typeof files[APP_FILE] !== "string") {
    routeProblems.push(`Missing ${APP_FILE}: create it with <Routes> containing a <Route> for every page.`);
  } else if (app) {
    const actual = new Set(app.routes.map(normalizeRoute));
    const expected = blueprint.pages.map((page) => page.route);
    const missing = expected.filter((route) => !actual.has(route));
    const extra = [...actual].filter((route) => route !== "/*" && route !== "*" && !expected.includes(route));

    if (missing.length) routeProblems.push(`${APP_FILE} has no <Route> for ${quote(missing)}.`);
    if (extra.length) routeProblems.push(`${APP_FILE} has routes ${quote(extra)} that aren't in the blueprint; remove them.`);
  }

  add("routes", "Routes match the pages", routeProblems, APP_FILE);

  // ---------- Unplanned files (a warning, not a failure) ----------
  const known = new Set([APP_FILE, ...planned.map((item) => item.file)]);
  const unplanned = Object.keys(files).filter((path) => !known.has(path));

  checks.push({
    id: "unplanned-files",
    group: "blueprint",
    label: "Only planned files",
    status: unplanned.length ? "warn" : "pass",
    message: unplanned.length ? `Added files that aren't in the blueprint: ${unplanned.join(", ")}.` : "",
    file: null,
  });

  return checks;
}

module.exports = { checkDrift, APP_FILE };
