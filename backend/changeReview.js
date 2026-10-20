// On-demand review of a refine: asks the model which of the changes it made were
// actually needed for the user's instruction.

// Keeps the prompt small for huge changes
const MAX_HUNKS = 60;
const MAX_HUNK_CHARS = 1500;

// Gemini JSON mode schema for the answer
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    changes: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          hunk: { type: "INTEGER" },
          requested: { type: "BOOLEAN" },
          summary: { type: "STRING" },
          reason: { type: "STRING" },
        },
        required: ["hunk", "requested", "summary", "reason"],
      },
    },
  },
  required: ["changes"],
};

const clip = (text) =>
  text.length > MAX_HUNK_CHARS ? `${text.slice(0, MAX_HUNK_CHARS)}\n... (truncated)` : text;

function buildReviewPrompt(instruction, hunks) {
  const changes = hunks
    .map(
      (hunk, index) => `CHANGE ${index}:
REMOVED:
${clip(hunk.removed) || "(nothing)"}
ADDED:
${clip(hunk.added) || "(nothing)"}`
    )
    .join("\n\n");

  return `
You are reviewing an edit an AI made to a React component.

The user asked for this change:
"""
${instruction}
"""

Below are all the changes the AI made, numbered from 0. For EACH change decide whether it was needed to carry out the user's request.

- requested = true: the change is part of what was asked, or a direct consequence of it (for example a new variable or import that the requested code needs).
- requested = false: the change touches something the user did not ask for (other text, colors, spacing, layout, structure or logic).

Return one entry per change with:
- hunk: the change number
- requested: true or false
- summary: what changed, at most 12 words
- reason: why it is or isn't part of the request, at most 20 words

${changes}
`;
}

// Turns the model's JSON into exactly one item per hunk, in order. Hunks the model
// skipped get `requested: null` instead of a guess.
function normalizeReview(raw, hunkCount) {
  let parsed;
  try {
    parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    throw new Error("The change review returned invalid JSON. Please try again.");
  }

  const byHunk = new Map();
  for (const entry of Array.isArray(parsed?.changes) ? parsed.changes : []) {
    if (Number.isInteger(entry?.hunk) && !byHunk.has(entry.hunk)) byHunk.set(entry.hunk, entry);
  }

  return Array.from({ length: hunkCount }, (_, hunk) => {
    const entry = byHunk.get(hunk);

    if (!entry || typeof entry.requested !== "boolean") {
      return { hunk, requested: null, summary: "", reason: "The review didn't cover this change." };
    }

    return {
      hunk,
      requested: entry.requested,
      summary: String(entry.summary ?? ""),
      reason: String(entry.reason ?? ""),
    };
  });
}

// `run(prompt, config)` → model text. Returns [{ hunk, requested, summary, reason }].
async function reviewChanges(run, instruction, hunks) {
  if (!instruction?.trim()) throw Object.assign(new Error("An instruction is required."), { status: 400 });

  if (!Array.isArray(hunks) || hunks.length === 0) {
    throw Object.assign(new Error("There are no changes to review."), { status: 400 });
  }

  if (hunks.length > MAX_HUNKS) {
    throw Object.assign(new Error(`Too many changes to review (${hunks.length}, max ${MAX_HUNKS}).`), { status: 400 });
  }

  const cleanHunks = hunks.map((hunk) => ({
    removed: String(hunk?.removed ?? ""),
    added: String(hunk?.added ?? ""),
  }));

  const raw = await run(buildReviewPrompt(instruction, cleanHunks), {
    responseMimeType: "application/json",
    responseSchema: RESPONSE_SCHEMA,
  });

  return normalizeReview(raw, cleanHunks.length);
}

module.exports = { reviewChanges, buildReviewPrompt, normalizeReview, MAX_HUNKS };
