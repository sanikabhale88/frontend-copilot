import { useEffect, useRef, useState } from "react";
import { PRESETS, RULES, matchingPreset, normalizePlaybook, playbookFromPreset } from "../../playbook/presets";

function RuleControl({ rule, value, onChange }) {
  const id = `playbook-${rule.key}`;

  if (rule.type === "toggle") {
    return (
      <input
        id={id}
        type="checkbox"
        checked={value}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 accent-indigo-600"
      />
    );
  }

  if (rule.type === "number") {
    return (
      <input
        id={id}
        type="number"
        min={rule.min}
        max={rule.max}
        value={value ?? ""}
        placeholder="Off"
        onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))}
        className="w-24 border border-slate-300 rounded-lg px-2 py-1 text-sm text-slate-800"
      />
    );
  }

  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="border border-slate-300 rounded-lg px-2 py-1 text-sm text-slate-800 bg-white"
    >
      {rule.options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

// Edits the Team Playbook: pick a preset (or Off), tweak rules, import/export JSON.
// Rendered only while open; Save hands the result (or null for Off) to onSave.
export default function PlaybookDialog({ playbook, onSave, onClose, showToast }) {
  const dialogRef = useRef(null);
  const fileRef = useRef(null);
  const [draft, setDraft] = useState(playbook);

  // Open as a modal (focus trap, Esc closes). Unmounting removes the element, which
  // ends the modal, so there is no cleanup; the guard covers StrictMode's re-run.
  useEffect(() => {
    if (!dialogRef.current.open) dialogRef.current.showModal();
  }, []);

  const activePreset = matchingPreset(draft);
  const selected = draft ? activePreset?.id ?? "custom" : "off";

  const setRule = (key, value) => setDraft((current) => ({ ...current, [key]: value }));

  const handleSave = () => {
    const clean = normalizePlaybook(draft);
    onSave(clean ? { ...clean, name: matchingPreset(clean)?.name ?? "Custom" } : null);
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(normalizePlaybook(draft), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "team-playbook.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const imported = normalizePlaybook(JSON.parse(await file.text()));
      if (!imported) throw new Error("not a playbook");
      setDraft(imported);
      showToast(`Imported "${imported.name}". Save to apply it.`, "success");
    } catch {
      showToast("That file isn't a valid playbook JSON.", "error");
    }
  };

  const options = [
    { id: "off", name: "Off", description: "No team rules. Default checks only." },
    ...PRESETS,
  ];

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="playbook-title"
      className="m-auto w-[min(720px,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] rounded-2xl p-0 shadow-2xl backdrop:bg-slate-900/50"
    >
      <div className="flex flex-col max-h-[calc(100vh-2rem)]">
        <div className="px-6 pt-6 pb-4 border-b border-slate-200">
          <h2 id="playbook-title" className="text-xl font-bold text-slate-900">Team Playbook</h2>
          <p className="text-sm text-slate-500 mt-1">
            Your team&apos;s coding standards. Every generation follows them, and <strong>checked</strong> rules are
            verified on the code and auto-repaired when broken.
          </p>
        </div>

        <div className="flex-1 overflow-auto px-6 py-5 space-y-6">
          {/* Presets */}
          <fieldset>
            <legend className="text-sm font-semibold text-slate-700 mb-2">Start from</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {options.map((option) => (
                <label
                  key={option.id}
                  className={`border rounded-xl px-4 py-3 cursor-pointer transition ${
                    selected === option.id ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500/20" : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="playbook-preset"
                    className="sr-only"
                    checked={selected === option.id}
                    onChange={() => setDraft(option.id === "off" ? null : playbookFromPreset(option))}
                  />
                  <div className="font-semibold text-slate-900 text-sm">{option.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{option.description}</div>
                </label>
              ))}
            </div>
            {selected === "custom" && (
              <p className="text-xs text-indigo-700 mt-2">Customised: these rules don&apos;t match a preset, so the playbook is saved as &quot;Custom&quot;.</p>
            )}
          </fieldset>

          {/* Rules */}
          {draft && (
            <fieldset>
              <legend className="text-sm font-semibold text-slate-700 mb-2">Rules</legend>
              <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
                {RULES.map((rule) => (
                  <li key={rule.key} className="flex items-center justify-between gap-4 px-4 py-2.5">
                    <label htmlFor={`playbook-${rule.key}`} className="text-sm text-slate-800 flex items-center gap-2 min-w-0">
                      <span className="truncate">{rule.label}</span>
                      <span
                        className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                          rule.checked ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                        }`}
                        title={rule.checked ? "Verified on the generated code" : "Sent to the AI as guidance, not verified"}
                      >
                        {rule.checked ? "Checked ✓" : "Guided"}
                      </span>
                    </label>
                    <RuleControl rule={rule} value={draft[rule.key]} onChange={(value) => setRule(rule.key, value)} />
                  </li>
                ))}
              </ul>

              <label htmlFor="playbook-extra" className="flex items-center gap-2 text-sm text-slate-800 mt-4 mb-1.5">
                Extra rules
                <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">Guided</span>
              </label>
              <textarea
                id="playbook-extra"
                value={draft.extraRules}
                maxLength={500}
                rows={3}
                onChange={(event) => setRule("extraRules", event.target.value)}
                placeholder="e.g. Use British spelling in UI text. Prefer CSS grid over flex for page layouts."
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 resize-none"
              />
            </fieldset>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
          <div className="flex gap-2">
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={handleImport} />
            <button
              type="button"
              onClick={() => fileRef.current.click()}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 bg-white"
            >
              Import JSON
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={!draft}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-40 px-3 py-1.5 rounded-lg border border-slate-200 bg-white"
            >
              Export JSON
            </button>
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="text-sm font-medium text-slate-600 hover:text-slate-900 px-4 py-2 rounded-lg">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition shadow-sm"
            >
              Save playbook
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
