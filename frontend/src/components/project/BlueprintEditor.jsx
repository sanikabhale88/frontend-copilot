import { useMemo, useState } from "react";
import { lintBlueprint } from "../../blueprint/lintBlueprint";

// Same limits as backend/blueprint.js
const LIMITS = { pages: 6, components: 12, props: 8 };

// Width is set where it's used (w-full / flex-1 / fixed), so classes don't conflict
const inputClass =
  "min-w-0 border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20";

function Card({ title, subtitle, children, action }) {
  return (
    <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

// Toggle chips for the components a page/component renders
function UsesPicker({ options, selected, onToggle, label }) {
  if (!options.length) return <p className="text-xs text-slate-400">Add components to choose what this uses.</p>;

  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
      {options.map((name) => {
        const isOn = selected.includes(name);
        return (
          <button
            key={name}
            type="button"
            aria-pressed={isOn}
            onClick={() => onToggle(name)}
            className={`text-xs font-medium px-2 py-1 rounded-md border transition ${
              isOn ? "bg-indigo-50 border-indigo-300 text-indigo-700" : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
            }`}
          >
            {isOn ? "✓ " : ""}
            {name}
          </button>
        );
      })}
    </div>
  );
}

function PropsEditor({ component, onAdd, onRemove }) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const name = draft.trim();
    if (/^[A-Za-z_$][\w$]*$/.test(name) && !component.props.some((p) => p.name === name)) onAdd(name);
    setDraft("");
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {component.props.map((prop) => (
        <span key={prop.name} className="inline-flex items-center gap-1 text-xs font-mono bg-slate-100 text-slate-700 pl-2 pr-1 py-0.5 rounded-md" title={prop.description}>
          {prop.name}
          <button
            type="button"
            onClick={() => onRemove(prop.name)}
            aria-label={`Remove prop ${prop.name} from ${component.name}`}
            className="text-slate-400 hover:text-rose-600 px-1"
          >
            ×
          </button>
        </span>
      ))}
      {component.props.length < LIMITS.props && (
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          onBlur={() => draft && add()}
          placeholder="+ prop"
          aria-label={`Add a prop to ${component.name}`}
          className="w-20 text-xs font-mono border border-dashed border-slate-300 rounded-md px-1.5 py-0.5 focus:outline-none focus:border-indigo-400"
        />
      )}
    </div>
  );
}

// The planned architecture, editable before any code is generated
export default function BlueprintEditor({ blueprint, onChange, onReplan, onGenerate, onStartOver, busy, playbook }) {
  const warnings = useMemo(() => lintBlueprint(blueprint, playbook), [blueprint, playbook]);
  const componentNames = blueprint.components.map((c) => c.name);

  const update = (patch) => onChange({ ...blueprint, ...patch });

  // ---------- Questions ----------
  const setAnswer = (id, answer) =>
    update({ questions: blueprint.questions.map((q) => (q.id === id ? { ...q, answer } : q)) });

  // ---------- Pages ----------
  const setPage = (index, patch) =>
    update({ pages: blueprint.pages.map((page, i) => (i === index ? { ...page, ...patch } : page)) });

  const togglePageUse = (index, name) => {
    const uses = blueprint.pages[index].uses;
    setPage(index, { uses: uses.includes(name) ? uses.filter((n) => n !== name) : [...uses, name] });
  };

  const addPage = () =>
    update({
      pages: [...blueprint.pages, { name: `Page${blueprint.pages.length + 1}`, route: `/page-${blueprint.pages.length + 1}`, purpose: "", uses: [] }],
    });

  // ---------- Components ----------
  const setComponent = (index, patch) =>
    update({ components: blueprint.components.map((c, i) => (i === index ? { ...c, ...patch } : c)) });

  // Renaming keeps every "uses" reference pointing at the component
  const renameComponent = (index, name) => {
    const oldName = blueprint.components[index].name;
    const rename = (uses) => uses.map((n) => (n === oldName ? name : n));

    update({
      pages: blueprint.pages.map((page) => ({ ...page, uses: rename(page.uses) })),
      components: blueprint.components.map((c, i) => ({ ...c, name: i === index ? name : c.name, uses: rename(c.uses) })),
    });
  };

  const removeComponent = (index) => {
    const name = blueprint.components[index].name;
    const drop = (uses) => uses.filter((n) => n !== name);

    update({
      pages: blueprint.pages.map((page) => ({ ...page, uses: drop(page.uses) })),
      components: blueprint.components.filter((_, i) => i !== index).map((c) => ({ ...c, uses: drop(c.uses) })),
    });
  };

  const toggleComponentUse = (index, name) => {
    const uses = blueprint.components[index].uses;
    setComponent(index, { uses: uses.includes(name) ? uses.filter((n) => n !== name) : [...uses, name] });
  };

  const addComponent = () =>
    update({
      components: [
        ...blueprint.components,
        { name: `NewComponent${blueprint.components.length + 1}`, purpose: "", props: [], state: [], uses: [] },
      ],
    });

  const isBusy = Boolean(busy);

  return (
    <div className="mt-8 flex flex-col gap-6">
      {/* Overview */}
      <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex-1 min-w-0 space-y-2">
            <span className="text-xs font-medium text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
              Blueprint · review and edit before any code is written
            </span>
            <label className="block">
              <span className="sr-only">App name</span>
              <input value={blueprint.name} onChange={(e) => update({ name: e.target.value })} className={`${inputClass} w-full text-xl font-bold`} />
            </label>
            <label className="block">
              <span className="sr-only">Description</span>
              <input value={blueprint.description} onChange={(e) => update({ description: e.target.value })} className={`${inputClass} w-full`} placeholder="One sentence describing the app" />
            </label>
          </div>
          <button type="button" onClick={onStartOver} disabled={isBusy} className="shrink-0 text-sm font-medium text-slate-500 hover:text-slate-800 disabled:opacity-50">
            ← Start over
          </button>
        </div>
      </section>

      {/* Clarifying questions */}
      {blueprint.questions.length > 0 && (
        <Card
          title="A few questions"
          subtitle="The AI picked a recommended answer for each. Change any, then re-plan (1 AI request), or just continue."
          action={
            <button
              type="button"
              onClick={onReplan}
              disabled={isBusy}
              className="shrink-0 text-sm font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 px-3 py-1.5 rounded-lg"
            >
              {busy === "planning" ? "Re-planning..." : "Re-plan with my answers"}
            </button>
          }
        >
          <ul className="space-y-4">
            {blueprint.questions.map((question) => (
              <li key={question.id}>
                <p className="text-sm font-medium text-slate-800 mb-2" id={`${question.id}-label`}>{question.question}</p>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby={`${question.id}-label`}>
                  {question.options.map((option) => (
                    <button
                      key={option}
                      type="button"
                      role="radio"
                      aria-checked={question.answer === option}
                      onClick={() => setAnswer(question.id, option)}
                      className={`text-sm px-3 py-1.5 rounded-lg border transition ${
                        question.answer === option
                          ? "bg-indigo-600 border-indigo-600 text-white"
                          : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      {question.answer === option ? "✓ " : ""}
                      {option}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pages */}
        <Card
          title={`Pages (${blueprint.pages.length})`}
          subtitle="Each page gets a route and a file in src/pages."
          action={
            <button type="button" onClick={addPage} disabled={isBusy || blueprint.pages.length >= LIMITS.pages} className="text-sm font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-40">
              + Add page
            </button>
          }
        >
          <ul className="space-y-3">
            {blueprint.pages.map((page, index) => (
              <li key={index} className="border border-slate-200 rounded-xl p-3 space-y-2">
                <div className="flex gap-2">
                  <input value={page.name} onChange={(e) => setPage(index, { name: e.target.value })} aria-label={`Page ${index + 1} name`} className={`${inputClass} flex-1 font-semibold`} />
                  <input value={page.route} onChange={(e) => setPage(index, { route: e.target.value })} aria-label={`${page.name} route`} className={`${inputClass} w-32 shrink-0 font-mono`} />
                  <button
                    type="button"
                    onClick={() => update({ pages: blueprint.pages.filter((_, i) => i !== index) })}
                    disabled={isBusy || blueprint.pages.length <= 1}
                    aria-label={`Remove page ${page.name}`}
                    className="shrink-0 text-slate-400 hover:text-rose-600 disabled:opacity-30 px-1"
                  >
                    ×
                  </button>
                </div>
                <input value={page.purpose} onChange={(e) => setPage(index, { purpose: e.target.value })} aria-label={`${page.name} purpose`} placeholder="Purpose" className={`${inputClass} w-full`} />
                <UsesPicker label={`Components ${page.name} uses`} options={componentNames} selected={page.uses} onToggle={(name) => togglePageUse(index, name)} />
              </li>
            ))}
          </ul>
        </Card>

        {/* Components */}
        <Card
          title={`Components (${blueprint.components.length})`}
          subtitle="Reusable pieces in src/components, with the props they accept."
          action={
            <button type="button" onClick={addComponent} disabled={isBusy || blueprint.components.length >= LIMITS.components} className="text-sm font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-40">
              + Add component
            </button>
          }
        >
          {blueprint.components.length === 0 && <p className="text-sm text-slate-400">No components planned.</p>}
          <ul className="space-y-3">
            {blueprint.components.map((component, index) => (
              <li key={index} className="border border-slate-200 rounded-xl p-3 space-y-2">
                <div className="flex gap-2">
                  <input value={component.name} onChange={(e) => renameComponent(index, e.target.value)} aria-label={`Component ${index + 1} name`} className={`${inputClass} flex-1 font-semibold`} />
                  <button type="button" onClick={() => removeComponent(index)} disabled={isBusy} aria-label={`Remove component ${component.name}`} className="shrink-0 text-slate-400 hover:text-rose-600 disabled:opacity-30 px-1">
                    ×
                  </button>
                </div>
                <input value={component.purpose} onChange={(e) => setComponent(index, { purpose: e.target.value })} aria-label={`${component.name} purpose`} placeholder="Purpose" className={`${inputClass} w-full`} />
                <div className="flex items-start gap-2">
                  <span className="text-xs font-medium text-slate-500 pt-1 w-12 shrink-0">Props</span>
                  <PropsEditor
                    component={component}
                    onAdd={(name) => setComponent(index, { props: [...component.props, { name, description: "" }] })}
                    onRemove={(name) => setComponent(index, { props: component.props.filter((p) => p.name !== name) })}
                  />
                </div>
                {component.state.length > 0 && (
                  <p className="text-xs text-slate-500">
                    <span className="font-medium">State:</span> {component.state.join(", ")}
                  </p>
                )}
                <div className="flex items-start gap-2">
                  <span className="text-xs font-medium text-slate-500 pt-1 w-12 shrink-0">Uses</span>
                  <UsesPicker
                    label={`Components ${component.name} uses`}
                    options={componentNames.filter((name) => name !== component.name)}
                    selected={component.uses}
                    onToggle={(name) => toggleComponentUse(index, name)}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Decisions */}
        <Card title="Architecture decisions" subtitle="Why the AI planned it this way.">
          {blueprint.decisions.length === 0 ? (
            <p className="text-sm text-slate-400">No decisions recorded.</p>
          ) : (
            <ul className="space-y-3">
              {blueprint.decisions.map((decision, index) => (
                <li key={index} className="text-sm">
                  <span className="font-semibold text-slate-800">{decision.topic}:</span>{" "}
                  <span className="text-slate-700">{decision.choice}</span>
                  {decision.reason && <p className="text-xs text-slate-500 mt-0.5">{decision.reason}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Architecture warnings */}
        <Card title="Architecture review" subtitle="Checked instantly on every edit (no AI).">
          <div aria-live="polite">
            {warnings.length === 0 ? (
              <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">✓ No problems found in the plan.</p>
            ) : (
              <ul className="space-y-2">
                {warnings.map((warning) => (
                  <li key={warning.key} className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    ⚠ {warning.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      {/* Generate */}
      <div className="sticky bottom-4 z-10 bg-white/95 backdrop-blur border border-slate-200 rounded-2xl shadow-lg px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {blueprint.pages.length} pages · {blueprint.components.length} components · {blueprint.pages.length + blueprint.components.length + 1} files.
          <span className="text-slate-400"> Uses 1–3 AI requests.</span>
        </p>
        <button
          type="button"
          onClick={onGenerate}
          disabled={isBusy}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white px-5 py-2.5 rounded-xl font-semibold transition shadow-sm"
        >
          {busy === "generating" ? "Generating project..." : "Generate project"}
        </button>
      </div>
    </div>
  );
}
