const test = require("node:test");
const assert = require("node:assert/strict");
const { checkDrift } = require("./driftCheck");
const { normalizeBlueprint } = require("./blueprint");

const BLUEPRINT = normalizeBlueprint({
  pages: [
    { name: "Home", route: "/", uses: ["Navbar"] },
    { name: "Recipes", route: "/recipes", uses: ["RecipeCard"] },
  ],
  components: [
    { name: "Navbar", props: [] },
    { name: "RecipeCard", props: [{ name: "title" }, { name: "onFavourite" }] },
  ],
});

const GOOD_FILES = {
  "src/App.jsx": `import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Recipes from "./pages/Recipes";
export default function App() {
  return <Routes><Route path="/" element={<Home />} /><Route path="/recipes" element={<Recipes />} /></Routes>;
}`,
  "src/pages/Home.jsx": `import Navbar from "../components/Navbar";
export default function Home() { return <div><Navbar /></div>; }`,
  "src/pages/Recipes.jsx": `import RecipeCard from "../components/RecipeCard";
export default function Recipes() { return <RecipeCard title="Soup" onFavourite={() => {}} />; }`,
  "src/components/Navbar.jsx": "export default function Navbar() { return <nav /> }",
  "src/components/RecipeCard.jsx": "export default function RecipeCard({ title, onFavourite, children }) { return <div>{title}{children}</div> }",
};

const byId = (checks, id) => checks.find((c) => c.id === id);

test("matching code passes every drift check", () => {
  const checks = checkDrift(BLUEPRINT, GOOD_FILES);
  assert.ok(checks.every((c) => c.status === "pass"), JSON.stringify(checks.filter((c) => c.status !== "pass")));
  assert.equal(checks.length, 6); // 2 pages + 2 components + routes + unplanned files
});

test("missing file", () => {
  const { ["src/components/Navbar.jsx"]: _, ...files } = GOOD_FILES;
  const check = byId(checkDrift(BLUEPRINT, files), "component-Navbar");

  assert.equal(check.status, "fail");
  assert.equal(check.file, "src/components/Navbar.jsx");
  assert.match(check.message, /Missing file src\/components\/Navbar\.jsx/);
});

test("wrong export name", () => {
  const files = { ...GOOD_FILES, "src/pages/Home.jsx": 'import Navbar from "../components/Navbar";\nexport default function Landing() { return <Navbar /> }' };
  assert.match(byId(checkDrift(BLUEPRINT, files), "page-Home").message, /named "Home" \(it exports "Landing"\)/);
});

test("planned component not rendered", () => {
  const files = { ...GOOD_FILES, "src/pages/Home.jsx": "export default function Home() { return <div /> }" };
  assert.match(byId(checkDrift(BLUEPRINT, files), "page-Home").message, /should render "Navbar"/);
});

test("props: missing and extra (children allowed), destructured or props.x", () => {
  const destructured = { ...GOOD_FILES, "src/components/RecipeCard.jsx": "export default function RecipeCard({ title, rating }) { return <div /> }" };
  const message = byId(checkDrift(BLUEPRINT, destructured), "component-RecipeCard").message;
  assert.match(message, /must accept the planned props "onFavourite"/);
  assert.match(message, /accepts props "rating" that aren't in the blueprint/);

  const propsObject = {
    ...GOOD_FILES,
    "src/components/RecipeCard.jsx": "const RecipeCard = (props) => <div onClick={props.onFavourite}>{props.title}</div>;\nexport default RecipeCard;",
  };
  assert.equal(byId(checkDrift(BLUEPRINT, propsObject), "component-RecipeCard").status, "pass");
});

test("routes: missing and extra are reported against App.jsx", () => {
  const files = {
    ...GOOD_FILES,
    "src/App.jsx": `import { Routes, Route } from "react-router-dom";
export default function App() { return <Routes><Route index element={<div />} /><Route path="/about" element={<div />} /><Route path="*" element={<div />} /></Routes>; }`,
  };
  const check = byId(checkDrift(BLUEPRINT, files), "routes");

  assert.equal(check.file, "src/App.jsx");
  assert.match(check.message, /no <Route> for "\/recipes"/);
  assert.match(check.message, /routes "\/about" that aren't in the blueprint/);
  assert.doesNotMatch(check.message, /"\*"/);
});

test("unplanned files are a warning, not a failure", () => {
  const check = byId(checkDrift(BLUEPRINT, { ...GOOD_FILES, "src/data/recipes.js": "export const recipes = [];" }), "unplanned-files");
  assert.equal(check.status, "warn");
  assert.match(check.message, /src\/data\/recipes\.js/);
});

test("unparseable files are left to the code checks", () => {
  const files = { ...GOOD_FILES, "src/pages/Home.jsx": "export default function Home( {" };
  assert.equal(byId(checkDrift(BLUEPRINT, files), "page-Home").status, "pass");
});
