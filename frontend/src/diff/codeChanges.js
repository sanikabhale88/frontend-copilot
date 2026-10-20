import { diffLines } from "diff";

const countLines = (text) => (text ? text.split("\n").length - (text.endsWith("\n") ? 1 : 0) : 0);

// Splits text into lines that keep their "\n", so joining them gives the text back
export const splitLines = (text) => text.match(/[^\n]*\n|[^\n]+$/g) ?? [];

// A run of N removed + N added lines is an in-place edit of N lines: pair them up
// line by line, so each line can be judged and reverted on its own (e.g. a changed
// heading right above the requested button change). Other runs stay one change.
function splitInPlaceEdits(run) {
  const removed = splitLines(run.removed);
  const added = splitLines(run.added);

  if (removed.length < 2 || removed.length !== added.length) return [run];

  return removed
    .map((line, index) => ({ removed: line, added: added[index] }))
    .filter((pair) => pair.removed !== pair.added);
}

// Splits the change from `before` to `after` into segments: unchanged text
// ({ type: "same", value }) and hunks ({ type: "hunk", id, removed, added }). Joining
// every segment's unchanged text and `added` gives `after`; using `removed` instead
// gives `before`.
export function computeChanges(before, after) {
  const runs = [];
  let run = null;

  for (const part of diffLines(before, after)) {
    if (!part.added && !part.removed) {
      run = null;
      runs.push({ type: "same", value: part.value });
      continue;
    }

    if (!run) {
      run = { type: "change", removed: "", added: "" };
      runs.push(run);
    }

    if (part.added) run.added += part.value;
    else run.removed += part.value;
  }

  const segments = [];
  let nextId = 0;

  for (const item of runs) {
    if (item.type === "same") {
      segments.push(item);
      continue;
    }

    for (const piece of splitInPlaceEdits(item)) {
      segments.push({ type: "hunk", id: nextId++, removed: piece.removed, added: piece.added });
    }
  }

  const hunks = segments.filter((segment) => segment.type === "hunk");

  return {
    segments,
    hunks,
    stats: {
      added: hunks.reduce((total, h) => total + countLines(h.added), 0),
      removed: hunks.reduce((total, h) => total + countLines(h.removed), 0),
    },
  };
}

// Rebuilds the code with the hunks in `ids` undone (their `removed` text restored)
// and every other hunk kept
export function revertHunks(segments, ids) {
  const revert = new Set(ids);

  return segments
    .map((segment) => {
      if (segment.type === "same") return segment.value;
      return revert.has(segment.id) ? segment.removed : segment.added;
    })
    .join("");
}
