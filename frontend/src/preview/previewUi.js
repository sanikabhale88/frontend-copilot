// Shared look of the preview panels (component preview and project preview)

export const deviceWidths = {
  desktop: "w-full",
  tablet: "w-[768px] max-w-full",
  mobile: "w-[375px] max-w-full",
};

export const devices = [
  {
    value: "desktop",
    label: "Desktop preview",
    icon: "M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
  },
  {
    value: "tablet",
    label: "Tablet preview",
    icon: "M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z",
  },
  {
    value: "mobile",
    label: "Mobile preview",
    icon: "M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z",
  },
];

export const statusStyles = {
  loading: { label: "Loading", dot: "bg-amber-400", badge: "text-amber-700 bg-amber-100" },
  ready: { label: "Ready", dot: "bg-emerald-500 animate-pulse", badge: "text-emerald-600 bg-emerald-100" },
  error: { label: "Error", dot: "bg-rose-500", badge: "text-rose-700 bg-rose-100" },
};
