const test = require("node:test");
const assert = require("node:assert/strict");
const { generateProject, parseFiles, MAX_REPAIRS } = require("./projectGeneration");
const { normalizeBlueprint } = require("./blueprint");
const { normalizePlaybook } = require("./playbook");
const { validateProjectFile } = require("./projectValidator");

const BLUEPRINT = normalizeBlueprint({
  name: "Mini",
  pages: [{ name: "Home", route: "/", uses: ["Hello"] }],
  components: [{ name: "Hello", props: [{ name: "name" }] }],
});

const APP = `import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
export default function App() { return <Routes><Route path="/" element={<Home />} /></Routes>; }`;
const HOME = 'import Hello from "../components/Hello";\nexport default function Home() { return <Hello name="Sam" />; }';
const HELLO = "export default function Hello({ name }) { return <p>Hi {name}</p>; }";

const asJson = (files) => JSON.stringify({ files: Object.entries(files).map(([path, code]) => ({ path, code })) });

const fakeModel = (...outputs) => {
  const calls = [];
  const run = async (prompt, config) => {
    calls.push({ prompt, config });
    const next = outputs.shift();
    if (next instanceof Error) throw next;
    return next;
  };
  return { run, calls };
};

const GOOD = { "src/App.jsx": APP, "src/pages/Home.jsx": HOME, "src/components/Hello.jsx": HELLO };

test("a correct project is verified without repairs", async () => {
  const model = fakeModel(asJson(GOOD));
  const { project, report } = await generateProject(model.run, BLUEPRINT);

  assert.equal(report.verified, true);
  assert.equal(report.repairs, 0);
  assert.deepEqual(Object.keys(project.files).sort(), Object.keys(GOOD).sort());
  assert.deepEqual(project.pages, [{ name: "Home", route: "/", file: "src/pages/Home.jsx", purpose: "" }]);
  assert.equal(model.calls[0].config.responseMimeType, "application/json");
  assert.match(model.calls[0].prompt, /"name": "Hello"/);
});

test("only failing files are sent for repair, and fixes are merged in", async () => {
  const broken = { ...GOOD, "src/components/Hello.jsx": 'import { Smile } from "lucide-react";\nexport default function Hello({ name }) { return <p><Smile />{name}</p>; }' };
  const model = fakeModel(asJson(broken), asJson({ "src/components/Hello.jsx": HELLO, "src/App.jsx": "SHOULD BE IGNORED" }));

  const { project, report } = await generateProject(model.run, BLUEPRINT);

  assert.equal(report.verified, true);
  assert.equal(report.repairs, 1);
  assert.match(model.calls[1].prompt, /FILE src\/components\/Hello\.jsx/);
  assert.doesNotMatch(model.calls[1].prompt, /FILE src\/pages\/Home\.jsx/);
  assert.equal(project.files["src/App.jsx"], APP, "files that weren't asked for are not replaced");
  assert.equal(report.files["src/components/Hello.jsx"].find((c) => c.id === "imports").status, "fixed");
});

test("drift problems (missing file, wrong props) go to repair against the right file", async () => {
  const { ["src/components/Hello.jsx"]: _, ...missing } = GOOD;
  const model = fakeModel(asJson(missing), asJson({ "src/components/Hello.jsx": HELLO }));

  const { report } = await generateProject(model.run, BLUEPRINT);

  assert.match(model.calls[1].prompt, /FILE src\/components\/Hello\.jsx\nPROBLEMS:\n- Missing file/);
  assert.match(model.calls[1].prompt, /\(this file does not exist yet\)/);
  assert.equal(report.verified, true);
  assert.equal(report.drift.find((c) => c.id === "component-Hello").status, "fixed");
});

test("gives up after MAX_REPAIRS and reports what still fails", async () => {
  const wrongProps = { ...GOOD, "src/components/Hello.jsx": "export default function Hello({ who }) { return <p>{who}</p>; }" };
  const model = fakeModel(...Array.from({ length: MAX_REPAIRS + 1 }, () => asJson(wrongProps)));

  const { report } = await generateProject(model.run, BLUEPRINT);

  assert.equal(report.verified, false);
  assert.equal(report.repairs, MAX_REPAIRS);
  assert.equal(model.calls.length, MAX_REPAIRS + 1);
  assert.equal(report.drift.find((c) => c.id === "component-Hello").status, "fail");
});

test("a failing repair call keeps the last result", async () => {
  const { ["src/components/Hello.jsx"]: _, ...missing } = GOOD;
  const model = fakeModel(asJson(missing), new Error("503"));
  const { report } = await generateProject(model.run, BLUEPRINT);

  assert.equal(report.verified, false);
  assert.equal(report.repairs, 0);
});

test("playbook rules are checked per file", async () => {
  const playbook = normalizePlaybook({ noInlineStyles: true });
  const styled = { ...GOOD, "src/components/Hello.jsx": 'export default function Hello({ name }) { return <p style={{ color: "red" }}>{name}</p>; }' };
  const model = fakeModel(asJson(styled), asJson({ "src/components/Hello.jsx": HELLO }));

  const { report } = await generateProject(model.run, BLUEPRINT, { playbook });

  assert.match(model.calls[0].prompt, /TEAM PLAYBOOK/);
  assert.equal(report.files["src/components/Hello.jsx"].find((c) => c.id === "playbook-no-inline-styles").status, "fixed");
  assert.equal(report.playbook.name, "Custom");
});

test("parseFiles keeps only safe paths and rejects invalid JSON", () => {
  const files = parseFiles(
    JSON.stringify({
      files: [
        { path: "src/App.jsx", code: "a" },
        { path: "./src/pages/Home.jsx", code: "b" },
        { path: "../server.js", code: "x" },
        { path: "src/../../etc.jsx", code: "x" },
        { path: "/etc/passwd", code: "x" },
        { path: "src/styles.css", code: "x" },
        { path: "src/x.jsx", code: 42 },
      ],
    })
  );

  assert.deepEqual(Object.keys(files), ["src/App.jsx", "src/pages/Home.jsx"]);
  assert.throws(() => parseFiles("nope"), /invalid JSON/);
  assert.deepEqual(parseFiles("{}"), {});
});

test("project file checks: router wrappers and unresolved imports", () => {
  const files = { "src/App.jsx": "x" };
  const result = validateProjectFile(
    "src/App.jsx",
    'import { BrowserRouter } from "react-router-dom";\nimport Nav from "./components/Nav";\nexport default function App() { return <BrowserRouter><Nav /></BrowserRouter>; }',
    files
  );

  assert.equal(result.checks.find((c) => c.id === "no-router-wrapper").status, "fail");
  assert.match(result.checks.find((c) => c.id === "imports-resolve").message, /"\.\/components\/Nav"/);
  assert.equal(result.checks.find((c) => c.id === "imports").status, "pass", "react-router-dom and relative imports are allowed");
  assert.equal(result.errors.length, 2);
});
