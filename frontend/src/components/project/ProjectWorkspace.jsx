import { useMemo, useState } from "react";
import FileTree from "./FileTree";
import FileViewer from "./FileViewer";
import ProjectPreview from "./ProjectPreview";
import ProjectReport from "./ProjectReport";
import ProjectHistory from "./ProjectHistory";
import QualityPanel from "../QualityPanel";
import { buildFileTree, getFolderPaths, getParentFolders } from "../../project/fileTree";
import { computeChanges } from "../../diff/codeChanges";

// Shows a project: overview, preview, explorer, pages and components.
// `session` is set for a generated project (ProjectBuilder) and adds verification,
// the Quality Gate, refine/fix, history and per-file Changes; without it this shows
// the built-in sample.
export default function ProjectWorkspace({ project, showToast, session = null }) {
  const tree = useMemo(() => buildFileTree(Object.keys(project.files)), [project.files]);
  const previousFiles = session?.previousFiles ?? null;

  const [selectedPath, setSelectedPath] = useState(() =>
    "src/App.jsx" in project.files ? "src/App.jsx" : Object.keys(project.files)[0] ?? null
  );

  // Folder paths that are open; every folder starts expanded
  const [expandedFolders, setExpandedFolders] = useState(() => new Set(getFolderPaths(tree)));

  const toggleFolder = (path) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  // Select a file and make sure the folders above it are open
  const openFile = (path) => {
    setSelectedPath(path);
    setExpandedFolders((prev) => new Set([...prev, ...getParentFolders(path)]));
  };

  const selectedCode = selectedPath ? project.files[selectedPath] : undefined;

  // Files the last update changed (or added), and the selected file's diff
  const changedPaths = useMemo(
    () =>
      previousFiles
        ? new Set(Object.keys(project.files).filter((path) => previousFiles[path] !== project.files[path]))
        : null,
    [previousFiles, project.files]
  );

  const selectedChanges = useMemo(
    () =>
      changedPaths?.has(selectedPath) ? computeChanges(previousFiles[selectedPath] ?? "", project.files[selectedPath]) : null,
    [changedPaths, previousFiles, project.files, selectedPath]
  );

  const stats = [
    { label: "Pages", value: project.pages.length },
    { label: "Components", value: project.components.length },
    { label: "Files", value: Object.keys(project.files).length },
  ];

  const rowClass = (file) =>
    `w-full text-left rounded-lg px-3 py-2 transition min-w-0 ${
      file === selectedPath ? "bg-indigo-50" : "hover:bg-slate-50"
    }`;

  return (
    <div className="mt-8 flex flex-col gap-6">
      {/* Overview */}
      <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            {session ? (
              <span className="text-xs font-medium text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                Generated from your blueprint
              </span>
            ) : (
              <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                Sample project
              </span>
            )}
            <h2 className="mt-3 text-2xl font-bold text-slate-900 tracking-tight">
              {project.name}
            </h2>
            <p className="mt-1 text-slate-500">{project.description}</p>
          </div>

          <div className="flex flex-col items-end gap-3">
            <div className="flex gap-3">
              {stats.map((stat) => (
                <div key={stat.label} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-center">
                  <div className="text-xl font-bold text-slate-900">{stat.value}</div>
                  <div className="text-xs font-medium text-slate-500">{stat.label}</div>
                </div>
              ))}
            </div>
            {session && (
              <button
                type="button"
                onClick={session.onEditBlueprint}
                className="text-sm font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg"
              >
                ← Edit blueprint
              </button>
            )}
          </div>
        </div>
      </section>

      {session && (
        <ProjectReport
          report={session.report}
          runtime={session.runtime}
          previewError={session.previewError}
          onFixError={session.onFixError}
          onRecheck={session.onRecheck}
          busy={session.busy}
        />
      )}

      {/* Live preview of the whole project */}
      <ProjectPreview
        files={project.files}
        onStatus={session?.onPreviewStatus}
        onFixError={session ? () => session.onFixError({ message: session.previewError, fromPreview: true }) : undefined}
        fixing={session?.busy}
      />

      {session && (
        <QualityPanel
          quality={session.quality}
          previousScore={session.previousScore}
          onAutoFix={session.onAutoFix}
          loading={session.busy}
        />
      )}

      {/* Explorer */}
      <section className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col max-h-[320px] lg:max-h-none lg:h-[560px]">
          <h3 className="px-4 py-3 border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500 shrink-0">
            Explorer
          </h3>
          <div className="flex-1 overflow-auto p-2">
            <FileTree
              nodes={tree}
              selectedPath={selectedPath}
              expandedFolders={expandedFolders}
              onSelectFile={setSelectedPath}
              onToggleFolder={toggleFolder}
              changedPaths={changedPaths}
            />
          </div>
        </div>

        <FileViewer
          path={selectedPath}
          code={selectedCode}
          showToast={showToast}
          changes={selectedChanges}
          changeLabel={session?.changeLabel}
          review={session?.reviewFor(selectedPath) ?? { status: "idle" }}
          onReviewChanges={() => session.onReviewChanges(selectedPath, selectedChanges)}
          onRevertHunks={(ids, label) => session.onRevertHunks(selectedPath, selectedChanges, ids, label)}
          onRefine={session?.onRefineFile}
          busy={session?.busy}
        />
      </section>

      {session && <ProjectHistory history={session.history} onUndo={session.onUndo} busy={session.busy} />}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Pages */}
        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <h3 className="font-semibold text-slate-800 mb-4">Pages</h3>
          <ul className="flex flex-col gap-1">
            {project.pages.map((page) => (
              <li key={page.file}>
                <button
                  onClick={() => openFile(page.file)}
                  className={`${rowClass(page.file)} flex items-center justify-between gap-3`}
                >
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900">{page.name}</div>
                    <div className="text-xs font-mono text-slate-500 truncate">{page.file}</div>
                  </div>
                  <code className="shrink-0 text-xs font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                    {page.route}
                  </code>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* Components */}
        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <h3 className="font-semibold text-slate-800 mb-4">Components</h3>
          <ul className="flex flex-col gap-1">
            {project.components.map((component) => (
              <li key={component.file}>
                <button onClick={() => openFile(component.file)} className={`${rowClass(component.file)} block`}>
                  <div className="font-medium text-slate-900">{component.name}</div>
                  <div className="text-sm text-slate-500">{component.purpose}</div>
                  <div className="text-xs font-mono text-slate-400 truncate">{component.file}</div>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
