// Team Playbook presets and rule definitions. The backend (backend/playbook.js)
// normalizes the same shape and does the actual checking; `checked` here only
// tells the UI which rules are verified and which are prompt guidance.

export const RULES = [
  {
    key: "componentStyle",
    label: "Component style",
    checked: true,
    type: "select",
    options: [
      { value: "any", label: "Any" },
      { value: "function", label: "Function declarations" },
      { value: "arrow", label: "Arrow functions" },
    ],
  },
  { key: "maxLines", label: "Max lines per file", checked: true, type: "number", min: 20, max: 2000 },
  { key: "maxProps", label: "Max props per component", checked: true, type: "number", min: 1, max: 30 },
  { key: "handlerNaming", label: "Event handlers named handle*", checked: true, type: "toggle" },
  { key: "booleanNaming", label: "Boolean state named is*/has*", checked: true, type: "toggle" },
  { key: "noArbitraryValues", label: "No Tailwind arbitrary values (w-[350px])", checked: true, type: "toggle" },
  { key: "noInlineStyles", label: "No inline style={...}", checked: true, type: "toggle" },
  {
    key: "comments",
    label: "Comments",
    checked: false,
    type: "select",
    options: [
      { value: "none", label: "No requirement" },
      { value: "jsdoc", label: "JSDoc on components" },
      { value: "explain", label: "Explain logic for beginners" },
    ],
  },
];

const EMPTY_RULES = {
  componentStyle: "any",
  maxLines: null,
  maxProps: null,
  handlerNaming: false,
  booleanNaming: false,
  noArbitraryValues: false,
  noInlineStyles: false,
  comments: "none",
  extraRules: "",
};

export const PRESETS = [
  {
    id: "startup",
    name: "Startup MVP",
    description: "Move fast: few rules, arrow functions welcome.",
    rules: { ...EMPTY_RULES, componentStyle: "any", maxLines: 300 },
  },
  {
    id: "enterprise",
    name: "Enterprise strict",
    description: "Consistent, reviewable code with strict naming and styling rules.",
    rules: {
      ...EMPTY_RULES,
      componentStyle: "function",
      maxLines: 150,
      maxProps: 5,
      handlerNaming: true,
      booleanNaming: true,
      noArbitraryValues: true,
      noInlineStyles: true,
      comments: "jsdoc",
    },
  },
  {
    id: "beginner",
    name: "Beginner-friendly",
    description: "Simple, well-commented code that is easy to learn from.",
    rules: { ...EMPTY_RULES, componentStyle: "function", maxLines: 200, noArbitraryValues: true, comments: "explain" },
  },
];

const STORAGE_KEY = "frontend-copilot:playbook";

const clampInt = (value, min, max) => {
  const number = Number(value);
  if (value === null || value === "" || !Number.isFinite(number)) return null;
  return Math.min(max, Math.max(min, Math.round(number)));
};

// Keeps only known keys with valid values (for imported files and stored data).
// Returns a playbook { name, ...rules } or null.
export function normalizePlaybook(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const pick = (key, allowed) => (allowed.includes(raw[key]) ? raw[key] : EMPTY_RULES[key]);

  return {
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name.trim().slice(0, 60) : "Custom",
    componentStyle: pick("componentStyle", ["any", "function", "arrow"]),
    maxLines: clampInt(raw.maxLines, 20, 2000),
    maxProps: clampInt(raw.maxProps, 1, 30),
    handlerNaming: raw.handlerNaming === true,
    booleanNaming: raw.booleanNaming === true,
    noArbitraryValues: raw.noArbitraryValues === true,
    noInlineStyles: raw.noInlineStyles === true,
    comments: pick("comments", ["none", "jsdoc", "explain"]),
    extraRules: typeof raw.extraRules === "string" ? raw.extraRules.slice(0, 500) : "",
  };
}

export const playbookFromPreset = (preset) => ({ name: preset.name, ...preset.rules });

// The preset a playbook matches exactly, or null when it was customised
export function matchingPreset(playbook) {
  if (!playbook) return null;

  return (
    PRESETS.find((preset) =>
      Object.keys(EMPTY_RULES).every((key) => (playbook[key] ?? EMPTY_RULES[key]) === preset.rules[key])
    ) ?? null
  );
}

// Storage can be unavailable (private mode, blocked cookies): fall back to Off
export function loadPlaybook() {
  try {
    return normalizePlaybook(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch {
    return null;
  }
}

export function savePlaybook(playbook) {
  try {
    if (playbook) localStorage.setItem(STORAGE_KEY, JSON.stringify(playbook));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Not persisted; the playbook still applies for this session
  }
}
