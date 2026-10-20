// Blueprint: the planned architecture of a multi-page project (pages, routes,
// components, props, decisions), produced by the model and edited by the user
// before any code is generated. Everything here treats the blueprint as untrusted.

const { playbookPromptSection } = require("./playbook");

const LIMITS = { pages: 6, components: 12, props: 8, state: 6, uses: 12, questions: 4, options: 4, decisions: 8 };

const text = (value, max) => (typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "");
const list = (value, max) => (Array.isArray(value) ? value.slice(0, max) : []);

// "recipe card" / "recipe-card" / "RecipeCard" → "RecipeCard"
function toPascalCase(value) {
  const words = String(value ?? "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);

  const name = words.map((word) => word[0].toUpperCase() + word.slice(1)).join("");
  return /^[0-9]/.test(name) ? `C${name}` : name;
}

const toKebabCase = (name) => name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

// "/Recipes/:id" stays, "recipes" → "/recipes", junk characters are removed
function cleanRoute(value) {
  const route = `/${String(value ?? "").trim().replace(/^\/+/, "")}`
    .replace(/[^A-Za-z0-9/:_-]/g, "")
    .replace(/\/{2,}/g, "/");
  return route.length > 1 ? route.replace(/\/$/, "").slice(0, 60) : "/";
}

const isIdentifier = (value) => /^[A-Za-z_$][\w$]*$/.test(value);

// Cleans a blueprint from the model or the user. File paths are always derived
// from names, never taken from input. Returns a blueprint with at least one page.
function normalizeBlueprint(raw) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};

  // Names are unique across pages and components ("App" is reserved)
  const used = new Set(["App"]);
  const uniqueName = (value, fallback) => {
    const base = toPascalCase(value) || fallback;
    let name = base;
    for (let n = 2; used.has(name); n++) name = `${base}${n}`;
    used.add(name);
    return name;
  };

  // Raw component name → normalized name, to resolve `uses` afterwards
  const componentNames = new Map();

  const components = list(source.components, LIMITS.components).map((component, index) => {
    const name = uniqueName(component?.name, `Component${index + 1}`);
    componentNames.set(toPascalCase(component?.name), name);

    const seenProps = new Set();
    const props = list(component?.props, LIMITS.props)
      .map((prop) => (typeof prop === "string" ? { name: prop } : prop))
      .map((prop) => ({ name: text(prop?.name, 40), description: text(prop?.description, 120) }))
      .filter((prop) => isIdentifier(prop.name) && !seenProps.has(prop.name) && seenProps.add(prop.name));

    return {
      name,
      file: `src/components/${name}.jsx`,
      purpose: text(component?.purpose, 200),
      props,
      state: list(component?.state, LIMITS.state).map((item) => text(item, 80)).filter(Boolean),
      rawUses: list(component?.uses, LIMITS.uses),
    };
  });

  const resolveUses = (rawUses, self) => [
    ...new Set(
      rawUses
        .map((use) => componentNames.get(toPascalCase(use)))
        .filter((name) => name && name !== self)
    ),
  ];

  const routes = new Set();
  const pages = list(source.pages, LIMITS.pages).map((page, index) => {
    const name = uniqueName(page?.name, `Page${index + 1}`);
    let route = cleanRoute(page?.route ?? toKebabCase(name));
    if (routes.has(route)) route = `/${toKebabCase(name)}`;
    for (let n = 2; routes.has(route); n++) route = `/${toKebabCase(name)}-${n}`;
    routes.add(route);

    return {
      name,
      route,
      file: `src/pages/${name}.jsx`,
      purpose: text(page?.purpose, 200),
      uses: resolveUses(list(page?.uses, LIMITS.uses), null),
    };
  });

  // A project needs at least one page, and "/" must lead somewhere
  if (!pages.length) {
    const name = uniqueName("Home", "Home");
    pages.push({ name, route: "/", file: `src/pages/${name}.jsx`, purpose: "Landing page", uses: [] });
  }
  if (!pages.some((page) => page.route === "/")) pages[0].route = "/";

  const questions = list(source.questions, LIMITS.questions)
    .map((question, index) => {
      const options = [...new Set(list(question?.options, LIMITS.options).map((option) => text(option, 60)).filter(Boolean))];
      const answer = text(question?.answer, 60) || text(question?.default, 60);

      return {
        id: `q${index + 1}`,
        question: text(question?.question, 200),
        options,
        answer: options.includes(answer) ? answer : options[0],
      };
    })
    .filter((question) => question.question && question.options.length >= 2);

  const decisions = list(source.decisions, LIMITS.decisions)
    .map((decision) => ({
      topic: text(decision?.topic, 60),
      choice: text(decision?.choice, 120),
      reason: text(decision?.reason, 240),
    }))
    .filter((decision) => decision.topic && decision.choice);

  return {
    name: text(source.name, 60) || "My App",
    description: text(source.description, 240),
    questions,
    pages,
    components: components.map(({ rawUses, ...component }) => ({ ...component, uses: resolveUses(rawUses, component.name) })),
    decisions,
  };
}

// ---------- Gemini ----------

const STRING = { type: "STRING" };
const STRINGS = { type: "ARRAY", items: STRING };

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    name: STRING,
    description: STRING,
    questions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { question: STRING, options: STRINGS, answer: STRING },
        required: ["question", "options", "answer"],
      },
    },
    pages: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { name: STRING, route: STRING, purpose: STRING, uses: STRINGS },
        required: ["name", "route", "purpose", "uses"],
      },
    },
    components: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: STRING,
          purpose: STRING,
          props: {
            type: "ARRAY",
            items: { type: "OBJECT", properties: { name: STRING, description: STRING }, required: ["name", "description"] },
          },
          state: STRINGS,
          uses: STRINGS,
        },
        required: ["name", "purpose", "props", "state", "uses"],
      },
    },
    decisions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { topic: STRING, choice: STRING, reason: STRING },
        required: ["topic", "choice", "reason"],
      },
    },
  },
  required: ["name", "description", "questions", "pages", "components", "decisions"],
};

const JSON_CONFIG = { responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA };

// For a re-plan: the current (possibly user-edited) blueprint and the answers
function replanSection(current) {
  if (!current) return "";

  const answers = current.questions
    .map((question) => `- ${question.question} → ${question.answer}`)
    .join("\n");
  const { questions, ...plan } = current;

  return `
The user reviewed a first blueprint, possibly edited it, and answered your questions.

ANSWERS:
${answers || "(none)"}

CURRENT BLUEPRINT (keep the user's edits unless an answer requires a change):
${JSON.stringify(plan, null, 2)}

Update the blueprint to reflect the answers. Only ask new questions if something important is still unclear.
`;
}

function buildPlanPrompt(prompt, current, playbook) {
  return `
You are a senior frontend architect. Plan the architecture of a small React app BEFORE any code is written.

The app runs in the browser with React 18, react-router-dom v6 and Tailwind CSS only (no other packages, no backend).

Produce a blueprint:
- pages: 2 to ${LIMITS.pages} pages. Each has a PascalCase name, a route ("/" for the first one), its purpose, and the components it uses.
- components: up to ${LIMITS.components} reusable PascalCase components (for example Navbar, RecipeCard). Each has a purpose, its props (camelCase names with a short description), the state it owns, and the other components it uses. Prefer small, reusable components with at most 5 props.
- decisions: the important architecture choices (where state lives, how data flows, how navigation works), each with the reason.
- questions: 2 to 4 short questions ONLY about choices that change the architecture (for example "Where are favourites stored?"). Give 2 to 4 options each and set "answer" to the option you recommend.
- name and description: a short name and one sentence describing the app.

Keep it small and realistic: sample data lives in the pages/components that use it.
${playbookPromptSection(playbook)}${replanSection(current)}
USER REQUEST:
${prompt}
`;
}

// `run(prompt, config)` → model text. `current` is the blueprint to update on a re-plan.
async function planBlueprint(run, prompt, { current = null, playbook = null } = {}) {
  if (typeof prompt !== "string" || !prompt.trim()) {
    throw Object.assign(new Error("Describe the app you want to build."), { status: 400 });
  }

  const raw = await run(buildPlanPrompt(prompt.trim().slice(0, 2000), current, playbook), JSON_CONFIG);

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("The architecture plan came back as invalid JSON. Please try again.");
  }

  return normalizeBlueprint(parsed);
}

module.exports = { normalizeBlueprint, planBlueprint, buildPlanPrompt, toPascalCase, LIMITS };
