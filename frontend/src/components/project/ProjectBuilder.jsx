import { useCallback, useMemo, useState } from "react";
import axios from "axios";
import BlueprintEditor from "./BlueprintEditor";
import ProjectWorkspace from "./ProjectWorkspace";
import ProjectQualityAuditor from "./ProjectQualityAuditor";
import sampleProject from "../../project/sampleProject";
import { issueText, summarizeProjectAudit } from "../../preview/qualityReport";
import { revertHunks } from "../../diff/codeChanges";

const API = import.meta.env.VITE_API_URL;

const EXAMPLES = [
  "A recipe site with a home page, a recipe list, recipe details and favourites",
  "A personal finance tracker with a dashboard, transactions and budgets",
  "A small online bookstore with a catalogue, book details and a cart",
];

const fileName = (path) => path.split("/").pop();
const firstLine = (text) => String(text).split("\n")[0];

// Project mode: describe an app → review/edit the AI's blueprint → generate the
// project from it → view, verify, audit and update it (refine a file, fix errors,
// auto-fix quality issues, revert changes, undo). Owns all project-mode state
// (component mode's state lives in Home).
export default function ProjectBuilder({ playbook, showToast }) {
  const [stage, setStage] = useState("prompt"); // "prompt" | "sample" | "blueprint" | "project"
  const [prompt, setPrompt] = useState("");
  const [blueprint, setBlueprint] = useState(null);
  // The generated project: `blueprint` is the one it was generated from (later
  // updates are checked against it); `version` changes on every update; `sessionId`
  // only on a new generation
  const [generated, setGenerated] = useState(null); // { blueprint, project, report, version, sessionId }
  const [history, setHistory] = useState([]); // [{ label, request, files, report, score }], newest first
  const [preview, setPreview] = useState(null); // { version, status, message, where } from the visible preview
  const [audits, setAudits] = useState(null); // { version, byRoute: { [route]: { [width]: result } } }
  const [review, setReview] = useState(null); // { key: "version:path", status, items, message }
  const [busy, setBusy] = useState(null); // null | "planning" | "generating" | "updating"
  const [auditRun, setAuditRun] = useState(0); // bumped by "Check again" to restart the audits

  const errorMessage = (error, fallback) => error.response?.data?.message || fallback;

  const version = generated?.version;
  const project = generated?.project;

  // ---------- Live preview + per-page audits (keyed to the version they belong to) ----------

  const handlePreviewStatus = useCallback(
    (status, message, where) => setPreview({ version, status, message, where }),
    [version]
  );

  const handleAuditResult = useCallback(
    (route, width, data) =>
      setAudits((prev) => {
        const byRoute = prev && prev.version === version ? prev.byRoute : {};
        return { version, byRoute: { ...byRoute, [route]: { ...byRoute[route], [width]: data } } };
      }),
    [version]
  );

  const projectAudit = useMemo(
    // `audits &&`: before any project, both versions are undefined
    () => summarizeProjectAudit(audits && audits.version === version ? audits.byRoute : {}, project?.pages ?? []),
    [audits, version, project]
  );

  const previewError = preview && preview.version === version && preview.status === "error" ? preview.message : "";

  // ---------- Updates ----------

  // Make `files`/`report` the current version; the old one goes to the history
  const applyVersion = (files, report, label, request) => {
    setHistory((prev) => [
      {
        label,
        request,
        files: project.files,
        report: generated.report,
        score: projectAudit.quality.status === "done" ? projectAudit.quality.score : null,
      },
      ...prev,
    ]);
    setGenerated((current) => ({ ...current, project: { ...current.project, files }, report, version: Date.now() }));
  };

  const runUpdate = async (request, label, requestText) => {
    try {
      setBusy("updating");
      const response = await axios.post(`${API}/api/update-project`, {
        blueprint: generated.blueprint,
        files: project.files,
        request,
        playbook,
      });

      const { files, report, changed } = response.data;
      if (!changed.length) {
        showToast("The AI didn't change any files. Try describing it differently.", "error");
        return;
      }

      applyVersion(files, report, label, requestText);
      showToast(`Updated ${changed.map(fileName).join(", ")}`, "success");
    } catch (error) {
      showToast(errorMessage(error, "Could not update the project. Please try again."), "error");
    } finally {
      setBusy(null);
    }
  };

  // Which file an error came from: the module that failed, else the innermost
  // component of the project in React's component stack, else `fallback`
  const errorFile = (where, fallback) => {
    if (where?.file && project.files[where.file] !== undefined) return where.file;

    const byName = new Map([
      ["App", "src/App.jsx"],
      ...project.pages.map((page) => [page.name, page.file]),
      ...project.components.map((component) => [component.name, component.file]),
    ]);
    const name = (where?.components ?? []).find((n) => byName.has(n));
    if (name) return byName.get(name);

    return fallback && project.files[fallback] !== undefined ? fallback : undefined;
  };

  // `failure` is a crashed page from the audits, or { message, fromPreview } for the visible preview
  const handleFixError = (failure) => {
    const where = failure.fromPreview ? preview?.where : failure.where;
    const file = errorFile(where, failure.file);

    runUpdate({ type: "fix-error", message: failure.message, file }, `Fix error: ${firstLine(failure.message)}`, failure.message);
  };

  const handleRefineFile = (path, instruction) =>
    runUpdate({ type: "refine", file: path, instruction }, `Refine ${fileName(path)}: ${instruction}`, instruction);

  const handleAutoFix = () => {
    const { issues } = projectAudit.quality;
    if (!issues?.length) return;

    const text = issues.map((issue) => issueText(issue)).join("\n");
    runUpdate(
      { type: "fix-quality", issues: issues.map((issue) => ({ file: issue.file, message: issueText(issue) })) },
      `Auto-fix ${issues.length} quality issue${issues.length === 1 ? "" : "s"}`,
      text
    );
  };

  // Undo some of the last update's changes in one file locally (no Gemini), then
  // re-run the checks without AI
  const handleRevertHunks = async (path, changes, ids, label) => {
    const files = { ...project.files, [path]: revertHunks(changes.segments, ids) };

    try {
      setBusy("updating");
      const response = await axios.post(`${API}/api/verify-project`, { blueprint: generated.blueprint, files, playbook });
      applyVersion(response.data.files, response.data.report, `${label} in ${fileName(path)}`, label);
      showToast(`${label} in ${fileName(path)}`, "success");
    } catch {
      applyVersion(files, generated.report, `${label} in ${fileName(path)}`, label);
      showToast("Reverted, but the checks could not be re-run.", "error");
    } finally {
      setBusy(null);
    }
  };

  const handleUndo = () => {
    const [last, ...rest] = history;
    if (!last) return;

    setGenerated((current) => ({ ...current, project: { ...current.project, files: last.files }, report: last.report, version: Date.now() }));
    setHistory(rest);
    showToast("Change undone", "success");
  };

  // On-demand AI review of the last update's changes in one file
  const reviewKey = (path) => `${version}:${path}`;

  const handleReviewChanges = async (path, changes) => {
    const key = reviewKey(path);
    setReview({ key, status: "loading" });

    try {
      const response = await axios.post(`${API}/api/review-changes`, {
        instruction: history[0].request || history[0].label,
        hunks: changes.hunks.map(({ removed, added }) => ({ removed, added })),
      });
      setReview({ key, status: "done", items: response.data.items });
    } catch (error) {
      setReview({ key, status: "error", message: errorMessage(error, "Could not review the changes. Please try again.") });
    }
  };

  // `current` set = re-plan from the edited blueprint and the answered questions
  const plan = async (current = null) => {
    if (!prompt.trim()) {
      showToast("Describe the app you want to build", "error");
      return;
    }

    try {
      setBusy("planning");
      const response = await axios.post(`${API}/api/plan`, { prompt, playbook, blueprint: current });
      setBlueprint(response.data.blueprint);
      setStage("blueprint");
      showToast(current ? "Blueprint updated with your answers" : "Blueprint ready: review it before generating", "success");
    } catch (error) {
      showToast(errorMessage(error, "Could not plan the app. Please try again."), "error");
    } finally {
      setBusy(null);
    }
  };

  const generate = async () => {
    try {
      setBusy("generating");
      const response = await axios.post(`${API}/api/generate-project`, { blueprint, playbook });
      const now = Date.now();
      setGenerated({ blueprint, project: response.data.project, report: response.data.report, version: now, sessionId: now });
      setHistory([]);
      setStage("project");
      showToast(response.data.report.verified ? "Project generated and verified" : "Project generated with issues: see Verification", response.data.report.verified ? "success" : "error");
    } catch (error) {
      showToast(errorMessage(error, "Could not generate the project. Please try again."), "error");
    } finally {
      setBusy(null);
    }
  };

  const startOver = () => {
    if (blueprint && !window.confirm("Start over? The current blueprint and project will be cleared.")) return;
    setBlueprint(null);
    setGenerated(null);
    setHistory([]);
    setStage("prompt");
  };

  if (stage === "sample") {
    return (
      <>
        <button type="button" onClick={() => setStage("prompt")} className="mt-6 text-sm font-medium text-slate-500 hover:text-slate-800">
          ← Back to project builder
        </button>
        <ProjectWorkspace project={sampleProject} showToast={showToast} />
      </>
    );
  }

  if (stage === "blueprint" && blueprint) {
    return (
      <BlueprintEditor
        blueprint={blueprint}
        onChange={setBlueprint}
        onReplan={() => plan(blueprint)}
        onGenerate={generate}
        onStartOver={startOver}
        busy={busy}
        playbook={playbook}
      />
    );
  }

  if (stage === "project" && generated) {
    const session = {
      report: generated.report,
      runtime: projectAudit.runtime,
      previewError,
      onPreviewStatus: handlePreviewStatus,
      onFixError: handleFixError,
      quality: projectAudit.quality,
      previousScore: history[0]?.score ?? null,
      onAutoFix: handleAutoFix,
      previousFiles: history[0]?.files ?? null,
      changeLabel: history[0]?.label,
      reviewFor: (path) => (review?.key === reviewKey(path) ? review : { status: "idle" }),
      onReviewChanges: handleReviewChanges,
      onRevertHunks: handleRevertHunks,
      onRefineFile: handleRefineFile,
      history,
      onUndo: handleUndo,
      onEditBlueprint: () => setStage("blueprint"),
      onRecheck: () => {
        setAudits(null);
        setAuditRun((run) => run + 1);
      },
      busy: busy === "updating",
    };

    return (
      <>
        {/* Off-screen, page-by-page audits of this version (restart on every update) */}
        {/* Prefixed keys: version and sessionId are equal right after a generation */}
        <ProjectQualityAuditor key={`audit-${version}-${auditRun}`} files={project.files} pages={project.pages} onResult={handleAuditResult} />
        <ProjectWorkspace key={`workspace-${generated.sessionId}`} project={project} showToast={showToast} session={session} />
      </>
    );
  }

  // ---------- Prompt ----------
  return (
    <div className="mt-6 md:mt-10 flex flex-col items-center">
      <div className="text-center mb-8">
        <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">Design first. Then build.</h2>
        <p className="text-lg text-slate-500 max-w-2xl mx-auto px-4">
          Describe an app. The AI plans its pages, components and data flow as a blueprint you can edit, then generates
          the code from it and checks the code matches the plan.
        </p>
      </div>

      <div className="w-full max-w-3xl bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-500/10">
        <label htmlFor="project-prompt" className="sr-only">Describe your app</label>
        <textarea
          id="project-prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Describe the app you want to build..."
          className="w-full min-h-[110px] resize-none outline-none px-5 pt-4 pb-2 text-base text-slate-800 placeholder-slate-400"
        />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 bg-slate-50 border-t border-slate-100">
          <span className="text-xs text-slate-400">Planning uses 1 AI request. Nothing is generated until you approve the blueprint.</span>
          <button
            type="button"
            onClick={() => plan()}
            disabled={Boolean(busy) || !prompt.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white px-5 py-2 rounded-lg font-medium transition shadow-sm"
          >
            {busy === "planning" ? "Planning the architecture..." : "Plan architecture"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-2 mt-5 max-w-3xl">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => setPrompt(example)}
            className="text-xs font-medium px-3 py-1.5 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-slate-600 hover:text-indigo-700 rounded-lg transition"
          >
            {example}
          </button>
        ))}
      </div>

      <button type="button" onClick={() => setStage("sample")} className="mt-8 text-sm font-medium text-indigo-600 hover:text-indigo-800">
        Or explore the sample project →
      </button>
    </div>
  );
}
