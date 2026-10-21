const test = require("node:test");
const assert = require("node:assert/strict");
const { updateProject, planRequest } = require("./projectUpdate");
const { finalizeProject, buildProjectPrompt, sanitizeFiles } = require("./projectGeneration");
const { normalizeBlueprint } = require("./blueprint");
const { normalizePlaybook } = require("./playbook");

const BLUEPRINT = normalizeBlueprint({
  pages: [{ name: "Home", route: "/", uses: ["Hello"] }],
  components: [{ name: "Hello", props: [{ name: "name" }] }],
});

const FILES = {
  "src/App.jsx": `import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
export default function App() { return <Routes><Route path="/" element={<Home />} /></Routes>; }`,
  "src/pages/Home.jsx": 'import Hello from "../components/Hello";\nexport default function Home() { return <Hello name="Sam" />; }',
  "src/components/Hello.jsx": "export default function Hello({ name }) { return <p>Hi {name}</p>; }",
};

const asJson = (files) => JSON.stringify({ files: Object.entries(files).map(([path, code]) => ({ path, code })) });

const fakeModel = (...outputs) => {
  const prompts = [];
  const run = async (prompt) => {
    prompts.push(prompt);
    return outputs.shift();
  };
  return { run, prompts };
};

test("export style follows the playbook (arrow functions)", () => {
  const arrow = buildProjectPrompt(BLUEPRINT, normalizePlaybook({ componentStyle: "arrow" }));
  assert.match(arrow, /written as: const Name = \(\) => \{ \.\.\. \}; export default Name;/);
  assert.doesNotMatch(arrow, /written as: export default function/);

  assert.match(buildProjectPrompt(BLUEPRINT, null), /written as: export default function Name\(\) \{ \.\.\. \}/);
});

test("refine: only the target file may change, everything else is context", async () => {
  const pinkHello = "export default function Hello({ name }) { return <p className=\"text-pink-500\">Hi {name}</p>; }";
  const model = fakeModel(asJson({ "src/components/Hello.jsx": pinkHello, "src/App.jsx": "HACKED" }));

  const result = await updateProject(model.run, BLUEPRINT, FILES, { type: "refine", file: "src/components/Hello.jsx", instruction: "make it pink" });

  assert.equal(result.files["src/components/Hello.jsx"], pinkHello);
  assert.equal(result.files["src/App.jsx"], FILES["src/App.jsx"]);
  assert.deepEqual(result.changed, ["src/components/Hello.jsx"]);
  assert.equal(result.report.verified, true);
  assert.match(model.prompts[0], /You may only return these files: src\/components\/Hello\.jsx\./);
  assert.match(model.prompts[0], /OTHER FILES \(context only/);
  assert.match(model.prompts[0], /make it pink/);
});

test("refine: a user-requested prop change is reported as drift, not repaired back", async () => {
  const withRating = "export default function Hello({ name, rating }) { return <p>{name} {rating}</p>; }";
  const model = fakeModel(asJson({ "src/components/Hello.jsx": withRating }));

  const result = await updateProject(model.run, BLUEPRINT, FILES, { type: "refine", file: "src/components/Hello.jsx", instruction: "add a rating prop" });

  assert.equal(model.prompts.length, 1, "no repair call");
  assert.equal(result.report.verified, false);
  assert.match(result.report.drift.find((c) => c.id === "component-Hello").message, /"rating" that aren't in the blueprint/);
});

test("fix-error: any planned file may change, with the known file first", () => {
  const known = planRequest({ type: "fix-error", message: "x is undefined", file: "src/pages/Home.jsx" }, FILES, BLUEPRINT);
  assert.equal(known.targets[0], "src/pages/Home.jsx");
  assert.deepEqual([...known.targets].sort(), Object.keys(FILES).sort());
  assert.match(known.task, /shows up in src\/pages\/Home\.jsx/);

  const unknown = planRequest({ type: "fix-error", message: "x is undefined", file: "src/nope.jsx" }, FILES, BLUEPRINT);
  assert.deepEqual(unknown.targets.sort(), Object.keys(FILES).sort());
});

test("fix-error: the fix goes through the normal repair loop", async () => {
  const broken = { ...FILES, "src/pages/Home.jsx": "export default function Home() { const u = null; return <p>{u.name}</p>; }" };
  const model = fakeModel(asJson({ "src/pages/Home.jsx": FILES["src/pages/Home.jsx"] }));

  const result = await updateProject(model.run, BLUEPRINT, broken, { type: "fix-error", message: "Cannot read properties of null (reading 'name')", file: "src/pages/Home.jsx" });

  assert.equal(result.report.verified, true);
  assert.deepEqual(result.changed, ["src/pages/Home.jsx"]);
  assert.match(model.prompts[0], /Cannot read properties of null/);
});

test("fix-quality lists the issues and lets components change too", () => {
  const plan = planRequest(
    { type: "fix-quality", issues: [{ file: "src/pages/Home.jsx", message: "Horizontal scrolling on mobile" }, { message: "Buttons must have discernible text" }] },
    FILES,
    BLUEPRINT
  );

  assert.equal(plan.targets[0], "src/pages/Home.jsx");
  assert.ok(plan.targets.includes("src/components/Hello.jsx"));
  assert.match(plan.task, /1\. \[src\/pages\/Home\.jsx\] Horizontal scrolling on mobile\n2\. Buttons must have/);
});

test("bad update requests are rejected before calling the model", async () => {
  const model = fakeModel();
  const bad = [
    { type: "refine", file: "src/missing.jsx", instruction: "x" },
    { type: "refine", file: "src/App.jsx", instruction: "  " },
    { type: "fix-error", message: "" },
    { type: "fix-quality", issues: [] },
    { type: "delete-everything" },
    null,
  ];

  for (const request of bad) {
    await assert.rejects(updateProject(model.run, BLUEPRINT, FILES, request), (error) => error.status === 400);
  }
  await assert.rejects(updateProject(model.run, BLUEPRINT, {}, { type: "fix-error", message: "x" }), (error) => error.status === 400);
  assert.equal(model.prompts.length, 0);
});

test("playbook baseline: rules a file already broke are not repaired after an update", async () => {
  const playbook = normalizePlaybook({ noInlineStyles: true });
  const styled = { ...FILES, "src/components/Hello.jsx": 'export default function Hello({ name }) { return <p style={{ color: "red" }}>{name}</p>; }' };
  const stillStyled = 'export default function Hello({ name }) { return <p style={{ color: "red" }} className="font-bold">{name}</p>; }';
  const model = fakeModel(asJson({ "src/components/Hello.jsx": stillStyled }));

  const result = await updateProject(model.run, BLUEPRINT, styled, { type: "refine", file: "src/components/Hello.jsx", instruction: "make it bold" }, { playbook });
  const inline = result.report.files["src/components/Hello.jsx"].find((c) => c.id === "playbook-no-inline-styles");

  assert.equal(model.prompts.length, 1, "pre-existing violation not sent to repair");
  assert.equal(inline.preexisting, true);
});

test("verify-only finalize makes no model call", async () => {
  const { report } = await finalizeProject(null, BLUEPRINT, FILES, { maxRepairs: 0 });
  assert.equal(report.verified, true);
  assert.equal(report.repairs, 0);

  const { report: broken } = await finalizeProject(null, BLUEPRINT, { ...FILES, "src/components/Hello.jsx": "export default function Hello() { return <p /> }" }, { maxRepairs: 0 });
  assert.equal(broken.verified, false);
});

test("sanitizeFiles keeps only safe paths and string code", () => {
  const files = sanitizeFiles({ "src/App.jsx": "a", "../x.jsx": "b", "src/a.css": "c", "src/b.jsx": 5, "/etc/passwd": "d" });
  assert.deepEqual(Object.keys(files), ["src/App.jsx"]);
  assert.deepEqual(sanitizeFiles(null), {});
  assert.deepEqual(sanitizeFiles(["src/App.jsx"]), {});
});
