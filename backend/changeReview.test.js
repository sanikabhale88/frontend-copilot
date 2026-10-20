const test = require("node:test");
const assert = require("node:assert/strict");
const { reviewChanges, MAX_HUNKS } = require("./changeReview");

const HUNKS = [
  { removed: "<h2>Welcome</h2>\n", added: "<h2>Hello there</h2>\n" },
  { removed: '<button className="bg-blue-500">Go</button>\n', added: '<button className="bg-pink-500">Go</button>\n' },
];

const fakeModel = (output) => {
  const calls = [];
  const run = async (prompt, config) => {
    calls.push({ prompt, config });
    if (output instanceof Error) throw output;
    return typeof output === "string" ? output : JSON.stringify(output);
  };
  return { run, calls };
};

test("classifies each change and asks for JSON output", async () => {
  const model = fakeModel({
    changes: [
      { hunk: 1, requested: true, summary: "Button color blue to pink", reason: "This is the requested change." },
      { hunk: 0, requested: false, summary: "Heading text changed", reason: "The user didn't ask to change the heading." },
    ],
  });

  const items = await reviewChanges(model.run, "make the button pink", HUNKS);

  // Returned in hunk order regardless of the model's order
  assert.deepEqual(items.map((i) => [i.hunk, i.requested]), [[0, false], [1, true]]);
  assert.equal(items[0].summary, "Heading text changed");

  const { prompt, config } = model.calls[0];
  assert.equal(config.responseMimeType, "application/json");
  assert.ok(config.responseSchema);
  assert.match(prompt, /make the button pink/);
  assert.match(prompt, /CHANGE 0:\nREMOVED:\n<h2>Welcome<\/h2>/);
  assert.match(prompt, /CHANGE 1:/);
});

test("changes the model skipped are marked unknown, not guessed", async () => {
  const model = fakeModel({ changes: [{ hunk: 1, requested: true, summary: "Pink button", reason: "Requested." }] });
  const items = await reviewChanges(model.run, "make the button pink", HUNKS);

  assert.equal(items.length, 2);
  assert.equal(items[0].requested, null);
  assert.match(items[0].reason, /didn't cover/);
});

test("ignores out-of-range hunks and malformed entries", async () => {
  const model = fakeModel({
    changes: [
      { hunk: 7, requested: false, summary: "x", reason: "y" },
      { hunk: 0, requested: "no", summary: "x", reason: "y" },
      { hunk: 1, requested: true, summary: "Pink button", reason: "Requested." },
    ],
  });
  const items = await reviewChanges(model.run, "make the button pink", HUNKS);

  assert.equal(items.length, 2);
  assert.equal(items[0].requested, null);
  assert.equal(items[1].requested, true);
});

test("invalid JSON from the model gives a clear error", async () => {
  const model = fakeModel("not json at all");
  await assert.rejects(reviewChanges(model.run, "make the button pink", HUNKS), /invalid JSON/);
});

test("rejects bad input before calling the model", async () => {
  const model = fakeModel({ changes: [] });

  await assert.rejects(reviewChanges(model.run, "", HUNKS), (error) => error.status === 400);
  await assert.rejects(reviewChanges(model.run, "x", []), (error) => error.status === 400);
  const tooMany = Array.from({ length: MAX_HUNKS + 1 }, () => HUNKS[0]);
  await assert.rejects(reviewChanges(model.run, "x", tooMany), (error) => error.status === 400);

  assert.equal(model.calls.length, 0);
});
