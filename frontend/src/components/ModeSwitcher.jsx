const modes = [
  { value: "component", label: "Component" },
  { value: "project", label: "Project" },
];

export default function ModeSwitcher({ mode, onChange, disabled }) {
  return (
    <div className="flex bg-slate-200 p-1 rounded-lg" role="group" aria-label="Generation mode">
      {modes.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => onChange(value)}
          disabled={disabled}
          aria-pressed={mode === value}
          className={`px-3 py-1 rounded-md text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${
            mode === value
              ? "bg-white shadow-sm text-indigo-600"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
