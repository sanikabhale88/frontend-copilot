const test = require("node:test");
const assert = require("node:assert/strict");
const { generateVerified, MAX_REPAIRS } = require("./verifiedGeneration");

const GOOD = "export default function Nav() { return <nav>Brand</nav>; }";
const BAD_IMPORT = 'import { Menu } from "lucide-react";\nexport default function Nav() { return <nav><Menu /></nav>; }';

// A fake model that returns the given outputs in order and records each prompt
function fakeModel(...outputs) {
  const prompts = [];
  const run = async (prompt) => {
    prompts.push(prompt);
    const next = outputs.shift();
    if (next instanceof Error) throw next;
    return next;
  };
  return { run, prompts };
}

test("valid output is returned without a repair", async () => {
  const model = fakeModel(GOOD);
  const { result, report } = await generateVerified(model.run, "make a navbar");

  assert.equal(result, GOOD);
  assert.equal(report.verified, true);
  assert.equal(report.repairs, 0);
  assert.equal(model.prompts.length, 1);
});

test("failed checks are sent back to the model and reported as fixed", async () => {
  const model = fakeModel(BAD_IMPORT, GOOD);
  const { result, report } = await generateVerified(model.run, "make a navbar");

  assert.equal(result, GOOD);
  assert.equal(report.verified, true);
  assert.equal(report.repairs, 1);

  // The repair prompt names the actual problem and includes the code to fix
  assert.match(model.prompts[1], /PROBLEMS FOUND:\n1\. Imports "lucide-react"/);
  assert.match(model.prompts[1], /COMPONENT:\nimport \{ Menu \}/);

  const imports = report.checks.find((c) => c.id === "imports");
  assert.equal(imports.status, "fixed");
  assert.match(imports.message, /^Auto-repaired: .*lucide-react/);
});

test("gives up after MAX_REPAIRS and reports the remaining failures", async () => {
  const model = fakeModel(BAD_IMPORT, BAD_IMPORT, BAD_IMPORT, GOOD);
  const { report } = await generateVerified(model.run, "make a navbar");

  assert.equal(report.verified, false);
  assert.equal(report.repairs, MAX_REPAIRS);
  assert.equal(model.prompts.length, 1 + MAX_REPAIRS);
  assert.equal(report.checks.find((c) => c.id === "imports").status, "fail");
});

test("a failing repair call keeps the last result instead of throwing", async () => {
  const model = fakeModel(BAD_IMPORT, new Error("503 UNAVAILABLE"));
  const { result, report } = await generateVerified(model.run, "make a navbar");

  assert.match(result, /lucide-react/);
  assert.equal(report.verified, false);
  assert.equal(report.repairs, 0);
});

test("refine repairs a renamed component back to the original name", async () => {
  const model = fakeModel(
    "export default function PinkNav() { return <nav /> }",
    "export default function Nav() { return <nav className=\"bg-pink-500\" /> }"
  );
  const { report } = await generateVerified(model.run, "make it pink", { originalName: "Nav" });

  assert.equal(report.verified, true);
  assert.match(model.prompts[1], /Keep the component name "Nav"/);
  assert.equal(report.checks.find((c) => c.id === "name").status, "fixed");
});
