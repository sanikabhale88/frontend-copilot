const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeBlueprint, planBlueprint, toPascalCase, LIMITS } = require("./blueprint");

const RAW = {
  name: "Recipe Box",
  description: "Browse recipes and save favourites.",
  questions: [
    { question: "Where are favourites stored?", options: ["In memory", "localStorage"], answer: "localStorage" },
    { question: "Only one option?", options: ["Yes"], answer: "Yes" },
  ],
  pages: [
    { name: "home", route: "/", purpose: "Landing", uses: ["navbar", "RecipeCard"] },
    { name: "recipe list", route: "recipes", purpose: "All recipes", uses: ["RecipeCard", "Unknown"] },
    { name: "Details", route: "/recipes", purpose: "Duplicate route", uses: [] },
  ],
  components: [
    { name: "navbar", purpose: "Top nav", props: [{ name: "links", description: "Nav links" }], state: [], uses: [] },
    {
      name: "Recipe Card",
      purpose: "Card",
      props: [{ name: "title" }, { name: "title" }, { name: "bad name" }, "onFavourite"],
      state: ["isHovered"],
      uses: ["RecipeCard", "Navbar"],
    },
  ],
  decisions: [{ topic: "State", choice: "Favourites in App", reason: "Shared by pages" }, { topic: "", choice: "x" }],
};

test("names become unique PascalCase and files are derived, never taken from input", () => {
  const bp = normalizeBlueprint({ ...RAW, pages: [...RAW.pages, { name: "../../etc/passwd", route: "/x" }] });

  assert.deepEqual(bp.components.map((c) => c.name), ["Navbar", "RecipeCard"]);
  assert.deepEqual(bp.pages.map((p) => p.name), ["Home", "RecipeList", "Details", "EtcPasswd"]);
  assert.ok(bp.pages.every((p) => p.file === `src/pages/${p.name}.jsx`));
  assert.ok(bp.components.every((c) => c.file === `src/components/${c.name}.jsx`));
});

test("routes are cleaned and unique, and '/' always exists", () => {
  const bp = normalizeBlueprint(RAW);
  assert.deepEqual(bp.pages.map((p) => p.route), ["/", "/recipes", "/details"]);

  const noRoot = normalizeBlueprint({ pages: [{ name: "About", route: "/about" }] });
  assert.equal(noRoot.pages[0].route, "/");

  const junk = normalizeBlueprint({ pages: [{ name: "A", route: "/" }, { name: "B", route: "<script>alert(1)</script>" }] });
  assert.match(junk.pages[1].route, /^\/[A-Za-z0-9/:_-]*$/);
});

test("props are valid unique identifiers; uses resolve to known components, never self", () => {
  const bp = normalizeBlueprint(RAW);
  const card = bp.components.find((c) => c.name === "RecipeCard");

  assert.deepEqual(card.props.map((p) => p.name), ["title", "onFavourite"]);
  assert.deepEqual(card.uses, ["Navbar"]);
  assert.deepEqual(bp.pages[0].uses, ["Navbar", "RecipeCard"]);
  assert.deepEqual(bp.pages[1].uses, ["RecipeCard"]);
});

test("questions need 2+ options and keep a valid answer; empty decisions are dropped", () => {
  const bp = normalizeBlueprint(RAW);

  assert.equal(bp.questions.length, 1);
  assert.equal(bp.questions[0].answer, "localStorage");
  assert.equal(normalizeBlueprint({ questions: [{ question: "Q", options: ["a", "b"], answer: "zzz" }] }).questions[0].answer, "a");
  assert.equal(bp.decisions.length, 1);
});

test("hostile or empty input still gives a usable blueprint within limits", () => {
  for (const raw of [null, "text", [], { pages: "nope" }]) {
    const bp = normalizeBlueprint(raw);
    assert.equal(bp.pages.length, 1);
    assert.equal(bp.pages[0].route, "/");
  }

  const huge = normalizeBlueprint({
    pages: Array.from({ length: 20 }, (_, i) => ({ name: `P${i}` })),
    components: Array.from({ length: 30 }, (_, i) => ({ name: `C${i}`, props: Array.from({ length: 20 }, (_, j) => `p${j}`) })),
  });
  assert.equal(huge.pages.length, LIMITS.pages);
  assert.equal(huge.components.length, LIMITS.components);
  assert.ok(huge.components.every((c) => c.props.length <= LIMITS.props));
});

test("a page can't take the name of a component or App", () => {
  const bp = normalizeBlueprint({ pages: [{ name: "Navbar" }, { name: "App" }], components: [{ name: "Navbar" }] });
  assert.deepEqual(bp.pages.map((p) => p.name), ["Navbar2", "App2"]);
});

test("toPascalCase", () => {
  assert.equal(toPascalCase("recipe card"), "RecipeCard");
  assert.equal(toPascalCase("recipe-card"), "RecipeCard");
  assert.equal(toPascalCase("RecipeCard"), "RecipeCard");
  assert.equal(toPascalCase("3d viewer"), "C3dViewer");
});

test("planBlueprint asks for JSON, includes re-plan answers, and rejects an empty prompt", async () => {
  const prompts = [];
  const run = async (prompt, config) => {
    prompts.push({ prompt, config });
    return JSON.stringify(RAW);
  };

  const bp = await planBlueprint(run, "a recipe site");
  assert.equal(bp.name, "Recipe Box");
  assert.equal(prompts[0].config.responseMimeType, "application/json");

  await planBlueprint(run, "a recipe site", { current: { ...bp, questions: [{ ...bp.questions[0], answer: "In memory" }] } });
  assert.match(prompts[1].prompt, /Where are favourites stored\? → In memory/);
  assert.match(prompts[1].prompt, /CURRENT BLUEPRINT/);

  await assert.rejects(planBlueprint(run, "  "), (error) => error.status === 400);
  await assert.rejects(planBlueprint(async () => "not json", "x"), /invalid JSON/);
});
