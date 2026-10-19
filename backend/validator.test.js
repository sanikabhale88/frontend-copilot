const test = require("node:test");
const assert = require("node:assert/strict");
const { validateComponent, getComponentName } = require("./validator");

const statusOf = (result, id) => result.checks.find((c) => c.id === id)?.status;

test("clean component passes every check", () => {
  const result = validateComponent(`import { useState } from "react";

export default function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}`);

  assert.deepEqual(result.errors, []);
  assert.equal(result.componentName, "Counter");
  assert.ok(result.checks.every((c) => c.status === "pass"));
});

test("strips markdown fences and explanation text", () => {
  const result = validateComponent("Here is your component:\n```jsx\nexport default function A() { return <div /> }\n```\nEnjoy!");

  assert.equal(statusOf(result, "format"), "fixed");
  assert.equal(result.code, "export default function A() { return <div /> }");
  assert.deepEqual(result.errors, []);
});

test("flags packages the preview can't load", () => {
  const result = validateComponent(`import { Menu } from "lucide-react";
import { motion } from "framer-motion";
export default function Nav() { return <nav><Menu /></nav>; }`);

  assert.equal(statusOf(result, "imports"), "fail");
  assert.match(result.errors[0], /lucide-react.*framer-motion/);
});

test("flags components and functions that are never defined", () => {
  const result = validateComponent(`export default function Card() {
  return <div><Icon />{formatPrice(10)}</div>;
}`);

  assert.equal(statusOf(result, "identifiers"), "fail");
  assert.match(result.errors.join(" "), /"Icon", "formatPrice"/);
});

test("browser globals and lowercase HTML tags are not flagged", () => {
  const result = validateComponent(`export default function A() {
  useEffect(() => { const id = setTimeout(() => window.scrollTo(0, 0), 10); return () => clearTimeout(id); }, []);
  return <div onClick={() => localStorage.setItem("k", JSON.stringify(Math.random()))}>{new Date().getFullYear()}</div>;
}`);

  assert.equal(statusOf(result, "identifiers"), "pass");
});

test("Node-only globals are flagged", () => {
  const result = validateComponent("export default function A() { return <div>{process.env.KEY}</div>; }");

  assert.equal(statusOf(result, "identifiers"), "fail");
});

test("adds missing React hook imports", () => {
  const result = validateComponent(`export default function A() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  return <div ref={ref}>{String(open)}</div>;
}`);

  assert.equal(statusOf(result, "react-imports"), "fixed");
  assert.match(result.code, /^import \{ useState, useRef \} from "react";/);
  assert.deepEqual(result.errors, []);
});

test("reports syntax errors and skips the other checks", () => {
  const result = validateComponent("export default function A() { return <div>; }");

  assert.equal(statusOf(result, "syntax"), "fail");
  assert.equal(statusOf(result, "imports"), "skipped");
  assert.equal(result.errors.length, 1);
});

test("requires a named, capitalized default export", () => {
  assert.equal(statusOf(validateComponent("function A() { return <div /> }"), "export"), "fail");
  assert.equal(statusOf(validateComponent("export default () => <div />"), "export"), "fail");
  assert.equal(statusOf(validateComponent("export default function card() { return <div /> }"), "export"), "fail");

  const byIdentifier = validateComponent("const Card = () => <div />;\nexport default Card;");
  assert.equal(statusOf(byIdentifier, "export"), "pass");
  assert.equal(byIdentifier.componentName, "Card");
});

test("refine must keep the component name", () => {
  const renamed = validateComponent("export default function PinkCard() { return <div /> }", { originalName: "Card" });
  assert.equal(statusOf(renamed, "name"), "fail");

  const kept = validateComponent("export default function Card() { return <div /> }", { originalName: "Card" });
  assert.equal(statusOf(kept, "name"), "pass");
});

test("getComponentName reads the default export", () => {
  assert.equal(getComponentName("export default function Hero() { return <div /> }"), "Hero");
  assert.equal(getComponentName("not code at all <"), "");
});
