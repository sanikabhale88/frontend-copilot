import { devices } from "../preview/previewUi.js";

export default function DeviceSwitcher({ device, onChange }) {
  return (
    <div className="flex bg-slate-200 p-1 rounded-lg">
      {devices.map(({ value, label, icon }) => (
        <button
          key={value}
          onClick={() => onChange(value)}
          className={`p-1.5 rounded-md transition ${
            device === value
              ? "bg-white shadow-sm text-indigo-600"
              : "text-slate-500 hover:text-slate-700"
          }`}
          title={label}
          aria-label={label}
          aria-pressed={device === value}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
          </svg>
        </button>
      ))}
    </div>
  );
}
