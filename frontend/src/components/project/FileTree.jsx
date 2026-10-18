export default function FileTree({
  nodes,
  depth = 0,
  selectedPath,
  expandedFolders,
  onSelectFile,
  onToggleFolder,
}) {
  return (
    <ul>
      {nodes.map((node) => {
        // Tailwind can't generate padding classes at runtime, so indent with an inline style
        const indent = { paddingLeft: 8 + depth * 14 };

        if (node.type === "folder") {
          const isOpen = expandedFolders.has(node.path);

          return (
            <li key={node.path}>
              <button
                onClick={() => onToggleFolder(node.path)}
                aria-expanded={isOpen}
                style={indent}
                className="w-full flex items-center gap-1.5 pr-2 py-1.5 rounded-md text-sm text-slate-700 hover:bg-slate-100 transition text-left"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-90" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 shrink-0 text-amber-500"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M3 6a2 2 0 012-2h4l2 2h8a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V6z" />
                </svg>
                <span className="truncate font-medium">{node.name}</span>
              </button>

              {/* Recursive case: render this folder's children one level deeper */}
              {isOpen && (
                <FileTree
                  nodes={node.children}
                  depth={depth + 1}
                  selectedPath={selectedPath}
                  expandedFolders={expandedFolders}
                  onSelectFile={onSelectFile}
                  onToggleFolder={onToggleFolder}
                />
              )}
            </li>
          );
        }

        // Base case: a file has no children
        const isSelected = node.path === selectedPath;

        return (
          <li key={node.path}>
            <button
              onClick={() => onSelectFile(node.path)}
              aria-current={isSelected ? "true" : undefined}
              style={{ paddingLeft: indent.paddingLeft + 20 }}
              className={`w-full flex items-center gap-1.5 pr-2 py-1.5 rounded-md text-sm transition text-left ${
                isSelected
                  ? "bg-indigo-50 text-indigo-700 font-medium"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-4 w-4 shrink-0 ${isSelected ? "text-indigo-500" : "text-slate-400"}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
              <span className="truncate">{node.name}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
