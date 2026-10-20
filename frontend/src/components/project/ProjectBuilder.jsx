import { useState } from "react";
import axios from "axios";
import BlueprintEditor from "./BlueprintEditor";
import ProjectWorkspace from "./ProjectWorkspace";
import sampleProject from "../../project/sampleProject";

const API = import.meta.env.VITE_API_URL;

const EXAMPLES = [
  "A recipe site with a home page, a recipe list, recipe details and favourites",
  "A personal finance tracker with a dashboard, transactions and budgets",
  "A small online bookstore with a catalogue, book details and a cart",
];

// Project mode: describe an app → review/edit the AI's blueprint → generate the
// project from it → view it with its verification report. Owns all project-mode
// state (component mode's state lives in Home).
export default function ProjectBuilder({ playbook, showToast }) {
  const [stage, setStage] = useState("prompt"); // "prompt" | "sample" | "blueprint" | "project"
  const [prompt, setPrompt] = useState("");
  const [blueprint, setBlueprint] = useState(null);
  const [generated, setGenerated] = useState(null); // { project, report, id }
  const [busy, setBusy] = useState(null); // null | "planning" | "generating"

  const errorMessage = (error, fallback) => error.response?.data?.message || fallback;

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
      setGenerated({ project: response.data.project, report: response.data.report, id: Date.now() });
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
    return (
      <ProjectWorkspace
        key={generated.id}
        project={generated.project}
        report={generated.report}
        onEditBlueprint={() => setStage("blueprint")}
        showToast={showToast}
      />
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
