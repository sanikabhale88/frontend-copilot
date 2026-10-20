import { splitLines } from "../diff/codeChanges";

// Unchanged lines shown around each change
const CONTEXT = 2;

const stripNewline = (line) => line.replace(/\n$/, "");

// Unchanged lines to show for one "same" segment: a little context next to the
// changes around it, with everything in between collapsed into a gap
function contextRows(text, hasPrevHunk, hasNextHunk) {
  const lines = splitLines(text);
  const head = hasPrevHunk ? lines.slice(0, CONTEXT) : [];
  const tailStart = hasNextHunk ? Math.max(head.length, lines.length - CONTEXT) : lines.length;
  const hidden = tailStart - head.length;

  return [
    ...head.map((line) => ({ kind: "same", text: line })),
    ...(hidden > 0 ? [{ kind: "gap", count: hidden }] : []),
    ...lines.slice(tailStart).map((line) => ({ kind: "same", text: line })),
  ];
}

function CodeLine({ kind, text }) {
  const styles = {
    same: "text-slate-500",
    removed: "bg-rose-500/10 text-rose-300",
    added: "bg-emerald-500/10 text-emerald-300",
  };
  const marks = { same: " ", removed: "-", added: "+" };

  return (
    <div className={`flex ${styles[kind]}`}>
      <span className="w-5 shrink-0 select-none text-center opacity-70" aria-hidden="true">{marks[kind]}</span>
      <span className="whitespace-pre-wrap break-all flex-1">
        {stripNewline(text) || " "}
        <span className="sr-only">{kind === "same" ? "" : ` (${kind})`}</span>
      </span>
    </div>
  );
}

function ReviewTag({ item }) {
  if (!item) return null;

  if (item.requested === true) {
    return <span className="text-xs font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">✓ Requested</span>;
  }

  if (item.requested === false) {
    return <span className="text-xs font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full">⚠ Not requested</span>;
  }

  return <span className="text-xs font-semibold text-slate-400 bg-slate-500/10 border border-slate-500/30 px-2 py-0.5 rounded-full">? Unknown</span>;
}

// Diff of the last refine with per-change Revert, plus an on-demand AI review of
// which changes were actually requested
export default function ChangesView({ changes, changeLabel, review, onReviewChanges, onRevertHunks, busy }) {
  const { segments, hunks } = changes;

  if (!hunks.length) {
    return <p className="text-sm text-slate-400">The last refine didn&apos;t change the code.</p>;
  }

  const items = review.status === "done" ? review.items : null;
  const unrequested = items?.filter((item) => item.requested === false) ?? [];
  const unknown = items?.filter((item) => item.requested === null) ?? [];

  const revertUnrequested = () =>
    onRevertHunks(
      unrequested.map((item) => item.hunk),
      `Revert ${unrequested.length} unrequested change${unrequested.length === 1 ? "" : "s"}`
    );

  return (
    <div className="flex flex-col gap-4">
      {/* Header: what this refine was, and the review */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Last change</div>
        <div className="text-sm text-slate-200 mt-1 break-words">{changeLabel}</div>

        <div className="mt-3">
          {(review.status === "idle" || review.status === "error") && (
            <>
              <button
                onClick={onReviewChanges}
                disabled={busy}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 disabled:text-slate-400 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition"
              >
                Check for unrequested changes
              </button>
              {review.status === "error" && (
                <p role="alert" className="text-sm text-rose-300 mt-2">{review.message}</p>
              )}
              {review.status === "idle" && (
                <p className="text-xs text-slate-500 mt-2">Uses one AI request to compare each change with what you asked for.</p>
              )}
            </>
          )}

          {review.status === "loading" && (
            <p className="text-sm text-slate-300" aria-live="polite">Reviewing {hunks.length} change{hunks.length === 1 ? "" : "s"}...</p>
          )}

          {items && (
            <div aria-live="polite">
              {unrequested.length > 0 ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-semibold text-amber-300">
                    ⚠ {unrequested.length} of {hunks.length} change{hunks.length === 1 ? "" : "s"} {unrequested.length === 1 ? "wasn't" : "weren't"} requested
                  </span>
                  <button
                    onClick={revertUnrequested}
                    disabled={busy}
                    className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-900 px-3 py-1.5 rounded-lg text-sm font-semibold transition"
                  >
                    Revert unrequested
                  </button>
                </div>
              ) : (
                <span className="text-sm font-semibold text-emerald-300">✓ Every change was part of the request</span>
              )}
              {unknown.length > 0 && (
                <p className="text-xs text-slate-400 mt-2">
                  {unknown.length} change{unknown.length === 1 ? "" : "s"} couldn&apos;t be classified.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Diff */}
      <div className="font-mono text-[13px] leading-relaxed">
        {segments.map((segment, index) => {
          if (segment.type === "same") {
            const rows = contextRows(
              segment.value,
              segments[index - 1]?.type === "hunk",
              segments[index + 1]?.type === "hunk"
            );

            return rows.map((row, rowIndex) =>
              row.kind === "gap" ? (
                <div key={`${index}-${rowIndex}`} className="text-xs text-slate-600 py-1 pl-5 select-none">
                  ⋯ {row.count} unchanged line{row.count === 1 ? "" : "s"}
                </div>
              ) : (
                <CodeLine key={`${index}-${rowIndex}`} kind="same" text={row.text} />
              )
            );
          }

          const item = items?.[segment.id];

          return (
            <div
              key={`hunk-${segment.id}`}
              className={`my-2 rounded-lg border ${item?.requested === false ? "border-amber-500/40" : "border-slate-700"} overflow-hidden`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-slate-800/80 font-sans">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-300">Change {segment.id + 1}</span>
                  <ReviewTag item={item} />
                </div>
                <button
                  onClick={() => onRevertHunks([segment.id], `Revert change ${segment.id + 1}`)}
                  disabled={busy}
                  className="text-xs font-medium text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 disabled:opacity-50 px-2 py-1 rounded transition"
                >
                  Revert
                </button>
              </div>

              {splitLines(segment.removed).map((line, i) => (
                <CodeLine key={`r${i}`} kind="removed" text={line} />
              ))}
              {splitLines(segment.added).map((line, i) => (
                <CodeLine key={`a${i}`} kind="added" text={line} />
              ))}

              {item && (item.summary || item.reason) && (
                <div className="px-3 py-1.5 bg-slate-800/40 font-sans text-xs text-slate-400 border-t border-slate-700">
                  {item.summary && <span className="text-slate-300">{item.summary}. </span>}
                  {item.reason}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
