export default function Toast({ message, type }) {
  if (!message) return null;

  const bgColors = {
    success: "bg-emerald-500",
    error: "bg-red-500",
    info: "bg-indigo-500"
  };

  const bgColor = bgColors[type] || bgColors.info;

  return (
    <div className={`fixed bottom-6 right-6 md:right-10 max-w-sm px-6 py-4 rounded-xl text-white shadow-xl transform transition-all duration-300 translate-y-0 opacity-100 flex items-center gap-3 z-50 ${bgColor}`}>
      {type === "success" && (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      )}
      {type === "error" && (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      )}
      <span className="font-medium text-sm md:text-base">{message}</span>
    </div>
  );
}
