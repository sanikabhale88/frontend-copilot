// Team Playbook: the user's coding standards. They are added to every prompt, and
// the "checked" rules are verified on the generated code's AST (failures go through
// the normal repair loop). "Guided" rules (comments, extra rules) are prompt-only.

const traverse = require("@babel/traverse").default;

const COMPONENT_STYLES = ["function", "arrow", "any"];
const COMMENT_STYLES = ["none", "jsdoc", "explain"];

const BOOLEAN_PREFIX = /^(is|has|should|can|show|was|did|will)[A-Z0-9_]/;

const clampInt = (value, min, max) => {
  const number = Number(value);
  if (value === null || value === "" || !Number.isFinite(number)) return null;
  return Math.min(max, Math.max(min, Math.round(number)));
};

const cleanText = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");

// The playbook comes from the request body, so keep only known keys with sane
// values. Returns null when there is no playbook (the "Off" setting).
function normalizePlaybook(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  return {
    name: cleanText(raw.name, 60) || "Custom",
    componentStyle: COMPONENT_STYLES.includes(raw.componentStyle) ? raw.componentStyle : "any",
    maxLines: clampInt(raw.maxLines, 20, 2000),
    maxProps: clampInt(raw.maxProps, 1, 30),
    handlerNaming: raw.handlerNaming === true,
    booleanNaming: raw.booleanNaming === true,
    noArbitraryValues: raw.noArbitraryValues === true,
    noInlineStyles: raw.noInlineStyles === true,
    comments: COMMENT_STYLES.includes(raw.comments) ? raw.comments : "none",
    extraRules: cleanText(raw.extraRules, 500),
  };
}

// How the main component must be written, for prompts
function exportStyleLine(playbook) {
  if (playbook?.componentStyle === "arrow") {
    return "const ComponentName = () => { ... }; export default ComponentName;";
  }
  return "export default function ComponentName() { ... }";
}

// The rules as prompt text ("" when there is no playbook)
function playbookPromptSection(playbook) {
  if (!playbook) return "";

  const rules = [];

  if (playbook.componentStyle === "function") {
    rules.push("Write every component as a function declaration. Export the main one as: export default function ComponentName() { ... }");
  } else if (playbook.componentStyle === "arrow") {
    rules.push("Write every component as an arrow function. Export the main one as: const ComponentName = () => { ... }; export default ComponentName;");
  }
  if (playbook.maxLines) rules.push(`Keep the whole file at most ${playbook.maxLines} lines.`);
  if (playbook.maxProps) rules.push(`A component may take at most ${playbook.maxProps} props.`);
  if (playbook.handlerNaming) {
    rules.push("Name event handler functions handleSomething (for example handleClick) and pass them as onClick={handleClick}.");
  }
  if (playbook.booleanNaming) {
    rules.push("Name boolean state variables with an is/has/should/can/show prefix (for example isOpen, hasError).");
  }
  if (playbook.noArbitraryValues) {
    rules.push("Do not use Tailwind arbitrary values such as w-[350px] or bg-[#123456]; use the standard Tailwind scale.");
  }
  if (playbook.noInlineStyles) rules.push("Do not use inline style attributes; use Tailwind classes only.");
  if (playbook.comments === "jsdoc") rules.push("Add a JSDoc comment above each component describing what it does and its props.");
  if (playbook.comments === "explain") rules.push("Add short comments that explain non-obvious logic to a beginner.");
  if (playbook.extraRules) rules.push(`Additional team rules: ${playbook.extraRules}`);

  if (!rules.length) return "";

  return `
TEAM PLAYBOOK (the user's team coding standards; follow ALL of these):
${rules.map((rule, index) => `${index + 1}. ${rule}`).join("\n")}
`;
}

const isComponentName = (name) => /^[A-Z]/.test(name || "");
const isFunctionNode = (node) => node?.type === "ArrowFunctionExpression" || node?.type === "FunctionExpression";
const quoteList = (items) => items.slice(0, 3).map((item) => `"${item}"`).join(", ") + (items.length > 3 ? ", ..." : "");

// One check per active checked rule: { id, group: "playbook", label, status, message }
function checkPlaybook(ast, code, playbook) {
  if (!playbook) return [];

  const checks = [];
  const add = (id, label, failures, message) =>
    checks.push({
      id: `playbook-${id}`,
      group: "playbook",
      label,
      status: failures ? "fail" : "pass",
      message: failures ? message : "",
    });

  // Collect everything in one walk
  const components = []; // { name, propCount }
  const badHandlers = []; // { attribute, name }
  const badBooleans = [];
  const arbitraryClasses = [];
  let inlineStyles = 0;

  const countProps = (fn) => {
    const param = fn.params[0];
    return param?.type === "ObjectPattern" ? param.properties.length : null;
  };

  traverse(ast, {
    FunctionDeclaration(path) {
      if (isComponentName(path.node.id?.name)) {
        components.push({ name: path.node.id.name, propCount: countProps(path.node) });
      }
    },
    VariableDeclarator(path) {
      const { id, init } = path.node;

      if (id.type === "Identifier" && isComponentName(id.name) && isFunctionNode(init)) {
        components.push({ name: id.name, propCount: countProps(init) });
      }

      // const [open, setOpen] = useState(false)
      const callee = init?.type === "CallExpression" ? init.callee : null;
      const isUseState =
        callee?.name === "useState" || (callee?.type === "MemberExpression" && callee.property?.name === "useState");
      const first = id.type === "ArrayPattern" ? id.elements[0] : null;

      if (isUseState && init.arguments[0]?.type === "BooleanLiteral" && first?.type === "Identifier") {
        if (!BOOLEAN_PREFIX.test(first.name)) badBooleans.push(first.name);
      }
    },
    JSXAttribute(path) {
      const name = path.node.name.name;
      const value = path.node.value;

      if (name === "style") inlineStyles++;

      // onClick={toggle} where toggle is a function defined in this file
      if (/^on[A-Z]/.test(name) && value?.type === "JSXExpressionContainer" && value.expression.type === "Identifier") {
        const handler = value.expression.name;
        const binding = path.scope.getBinding(handler);
        const definedHere =
          binding?.path.isFunctionDeclaration() ||
          (binding?.path.isVariableDeclarator() && isFunctionNode(binding.path.node.init));

        if (definedHere && !/^handle[A-Z]/.test(handler) && !/^on[A-Z]/.test(handler)) {
          badHandlers.push({ attribute: name, name: handler });
        }
      }

      if (name === "className" && value) {
        // Every string inside the attribute: plain value, template literal, ternaries...
        const texts = [];
        path.traverse({
          StringLiteral(inner) {
            texts.push(inner.node.value);
          },
          TemplateElement(inner) {
            texts.push(inner.node.value.raw);
          },
        });

        for (const token of texts.join(" ").split(/\s+/)) {
          if (/\[[^\]]+\]/.test(token) && !arbitraryClasses.includes(token)) arbitraryClasses.push(token);
        }
      }
    },
  });

  // ---------- Component style ----------
  if (playbook.componentStyle !== "any") {
    const exportNode = ast.program.body.find((n) => n.type === "ExportDefaultDeclaration");
    const declaration = exportNode?.declaration;
    let style = null;

    if (declaration?.type === "FunctionDeclaration") {
      style = "function";
    } else if (isFunctionNode(declaration)) {
      style = "arrow";
    } else if (declaration?.type === "Identifier") {
      traverse(ast, {
        Program(path) {
          const binding = path.scope.getBinding(declaration.name);
          if (binding?.path.isFunctionDeclaration()) style = "function";
          else if (binding?.path.isVariableDeclarator() && isFunctionNode(binding.path.node.init)) style = "arrow";
          path.stop();
        },
      });
    }

    const wanted = playbook.componentStyle;
    add(
      "component-style",
      wanted === "function" ? "Components are function declarations" : "Components are arrow functions",
      style !== null && style !== wanted,
      `The main component must be written as: ${exportStyleLine(playbook)}`
    );
  }

  // ---------- File size ----------
  if (playbook.maxLines) {
    const lines = code.split("\n").length;
    add(
      "max-lines",
      `At most ${playbook.maxLines} lines`,
      lines > playbook.maxLines,
      `The file has ${lines} lines; the limit is ${playbook.maxLines}. Simplify it or remove unnecessary code.`
    );
  }

  // ---------- Props per component ----------
  if (playbook.maxProps) {
    const tooMany = components.filter((c) => c.propCount !== null && c.propCount > playbook.maxProps);
    add(
      "max-props",
      `At most ${playbook.maxProps} props per component`,
      tooMany.length > 0,
      `${tooMany.map((c) => `${c.name} takes ${c.propCount} props`).join("; ")}; the limit is ${playbook.maxProps}. ` +
        "Group related props into an object or split the component."
    );
  }

  // ---------- Handler naming ----------
  if (playbook.handlerNaming) {
    add(
      "handler-naming",
      "Event handlers named handle*",
      badHandlers.length > 0,
      badHandlers
        .slice(0, 3)
        .map((h) => `Rename "${h.name}" (used as ${h.attribute}) to "handle${h.name[0].toUpperCase()}${h.name.slice(1)}"`)
        .join("; ") + "."
    );
  }

  // ---------- Boolean naming ----------
  if (playbook.booleanNaming) {
    add(
      "boolean-naming",
      "Boolean state named is*/has*",
      badBooleans.length > 0,
      `Boolean state ${quoteList(badBooleans)} should use an is/has/should/can/show prefix (for example "is${
        (badBooleans[0] || "x")[0].toUpperCase() + (badBooleans[0] || "x").slice(1)
      }"), and its setter should match.`
    );
  }

  // ---------- Tailwind arbitrary values ----------
  if (playbook.noArbitraryValues) {
    add(
      "no-arbitrary-values",
      "No Tailwind arbitrary values",
      arbitraryClasses.length > 0,
      `Replace the arbitrary Tailwind values ${quoteList(arbitraryClasses)} with standard Tailwind scale classes.`
    );
  }

  // ---------- Inline styles ----------
  if (playbook.noInlineStyles) {
    add(
      "no-inline-styles",
      "No inline styles",
      inlineStyles > 0,
      `Found ${inlineStyles} style={...} attribute${inlineStyles === 1 ? "" : "s"}. Use Tailwind classes instead.`
    );
  }

  return checks;
}

// For the report: which playbook the code was checked against, and its guided
// (prompt-only, not verified) rules
function playbookSummary(playbook) {
  if (!playbook) return null;

  const guided = [];
  if (playbook.comments === "jsdoc") guided.push("JSDoc comments on components");
  if (playbook.comments === "explain") guided.push("Comments explaining logic for beginners");
  if (playbook.extraRules) guided.push(`Extra rules: ${playbook.extraRules}`);

  return { name: playbook.name, guided };
}

module.exports = { normalizePlaybook, playbookPromptSection, checkPlaybook, exportStyleLine, playbookSummary };
