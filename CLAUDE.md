# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Frontend Copilot: users describe a UI in natural language, Gemini generates a React + Tailwind component, and the app renders it live and lets the user refine it iteratively. Two independent npm packages, no root package.json. Only the backend has tests.

## Commands

Backend (`backend/`, CommonJS, Express 5):
- `npm install` then `node server.js` (or `npm start`) — listens on `PORT` (default 5000)
- `npm test` — `node --test` over `*.test.js` (validator + repair loop, fake model, no API key needed)
- Requires `backend/.env` with `GEMINI_API_KEY` (and optionally `PORT`)

Frontend (`frontend/`, ESM, React 19 + Vite + Tailwind v4 via `@tailwindcss/vite`):
- `npm run dev` — dev server on http://localhost:5173
- `npm run build` / `npm run preview`
- `npm run lint` — ESLint (flat config, react-hooks + react-refresh plugins)
- Requires `frontend/.env` with `VITE_API_URL=http://localhost:5000`

## Architecture

**Single API endpoint.** `POST /api/generate` in `backend/server.js` handles both modes, chosen by request body shape:
- Generate: `{ prompt }` → wrapped in a prompt demanding one default-exported component, Tailwind only, no external/icon libraries (inline SVG instead), raw JSX with no markdown or fences.
- Refine: `{ existingCode, instruction }` (both non-empty) → wrapped in a strict "code editor" prompt that must keep the component name and change only what was asked.
- Response: `{ success, result, report }`. Model output is never passed through raw: `verifiedGeneration.js` runs it through `validator.js` (Babel AST: strips fences/prose, syntax, only-`react` imports, undefined identifiers via scope globals, auto-adds missing React hook imports, named default export, refine keeps the component name). Failed checks are sent back to Gemini in a repair prompt, up to `MAX_REPAIRS` (2) times. `report` is `{ verified, repairs, checks: [{ id, label, status: pass|fixed|fail|skipped, message }] }`.
- `@babel/parser`/`@babel/traverse` are v8 (ESM-only) and loaded with `require()`, which needs Node 22+.
- `runCompilation(prompt, config)` retries Gemini 503s twice (2s, 5s); the model comes from `GEMINI_MODEL` (default `gemini-3.6-flash`). `sendError` maps 429/503 to friendly messages and passes through errors marked `status: 400`.

**Team Playbook:** an optional `playbook` in the `/api/generate` and `/api/validate` body (null = Off), normalized by `normalizePlaybook` in `backend/playbook.js` (untrusted input: unknown keys dropped, numbers clamped). `playbookPromptSection` adds the rules to the generate, refine and repair prompts; `checkPlaybook` verifies the *checked* rules on the AST (component style, max lines, max props, `handle*` handlers, `is*` boolean state, no Tailwind arbitrary values, no inline styles) as checks with `group: "playbook"`, so failures go through the normal repair loop. *Guided* rules (comments, extra rules) are prompt-only and listed as such via `report.playbook = { name, guided }`. On refine, rules the existing code already broke (`failedPlaybookRules`) are reported with `preexisting: true` but not repaired. Frontend: presets and the rule list in `src/playbook/presets.js` (kept in sync with the backend by hand), `PlaybookDialog` (native `<dialog>`), stored in `localStorage`.

**Project mode, blueprint-first** (`POST /api/plan`, `POST /api/generate-project`): `blueprint.js` asks Gemini (JSON mode) for a blueprint (pages, components with props/state/uses, decisions, 2–4 questions with default answers) and `normalizeBlueprint` cleans it, since it's untrusted model or user input (unique PascalCase names, file paths always derived as `src/pages/X.jsx` / `src/components/Y.jsx`, unique routes with `/` present, limits). A re-plan sends the edited blueprint with answered questions. `projectGeneration.js` generates all files in one JSON-mode call, validates each with `projectValidator.js` (`validateComponent` with `allowImport` for react-router-dom and relative imports, plus relative imports resolving via a backend copy of `resolvePath`, and no `BrowserRouter`, because the preview already provides `MemoryRouter`), runs `driftCheck.js` (files exist, export names, props, rendered `uses`, `<Route>`s vs pages; unplanned files are a `warn`), and repairs only the failing files (`MAX_REPAIRS` 2). Frontend: `components/project/ProjectBuilder.jsx` owns project-mode state (an exception to "state lives in Home") and stays mounted while hidden; `BlueprintEditor` (+ `blueprint/lintBlueprint.js`, free warnings), `ProjectReport`, and `ProjectWorkspace` reused for both generated and sample projects.

**Other endpoints:** `POST /api/review-changes` (`{ instruction, hunks: [{ removed, added }] }` → `{ items: [{ hunk, requested: true|false|null, summary, reason }] }`, Gemini JSON mode via `changeReview.js`, one request, on demand only) and `POST /api/validate` (`{ code }` → `{ result, report }`, validator only, no Gemini).

**CORS is hand-rolled** middleware with a hardcoded allow-list (`https://frontend-copilot.vercel.app`, `http://localhost:5173`). The `cors` package is a dependency but unused. A new frontend origin must be added there.

**Frontend state lives entirely in `frontend/src/Home.jsx`** (prompt, result code, verification report, refine instruction, undo history, device mode, last preview status, toast). `VerificationBadge` combines the backend `report` with the preview status, so "Verified" requires both passing code checks and a preview that rendered. `handleRefine(request, label)` also serves "Fix this error", which sends the preview's runtime error as the refine instruction. Components under `src/components/` are presentational and receive state/handlers via props. `Home` shows the landing view (`PromptComposer` + `EmptyState`) when there is no result, otherwise `Workspace` (`PreviewPanel` + `RefinePanel` + `CodePanel`).

**Undo history** is a stack of `{ instruction, request, code, report, score }` entries, newest first (`instruction` is the short label shown, `request` the full text sent to the model); each refine or revert pushes the previous version via `pushHistory`. A fresh generate (including "Regenerate") clears it.

**Change verification:** after a refine, `diff/codeChanges.js` diffs `history[0].code` → `result` into hunks (jsdiff `diffLines`; N→N line runs are split per line so adjacent edits are separate). `CodePanel` shows a Changes tab (`ChangesView`) with per-hunk Revert and an on-demand "Check for unrequested changes" review. Reverts are local (`revertHunks`, no Gemini), become a new history entry, and re-run the code checks through `/api/validate`.

**Live preview pipeline** — one runtime for both modes, in `frontend/src/preview/`:
- `buildProjectPreview(files, entry)` builds an iframe `srcDoc` with pinned UMD builds (React 18, Router v6, Babel Standalone) plus the Tailwind CDN; `previewRuntime.js` runs inside the iframe as a tiny module system (Babel → CommonJS, resolves relative imports, only `react`/`react-dom`/`react-router-dom` as packages) and must stay self-contained because it is injected with `.toString()`.
- The iframe reports `ready` / `error` / `route` via `postMessage({ source: "project-preview" })`; `usePreviewMessages` consumes them and resets state when its `loadKey` (reload counter + srcDoc) changes.
- Component mode (`PreviewPanel.jsx`) runs the code as a one-file project at `src/App.jsx`, after `ensureReactImports` adds imports for hooks used without one (a client-side safety net; the backend validator normally does this already).

So generated code can only import from `react`; any other package shows a "not available in the preview" error.

**Quality Gate** (component mode): `QualityAuditor` renders the code in three hidden, off-screen iframes (375/768/1280px) built with `buildProjectPreview(..., { audit: { width, axe } })`, which appends `runAudit` (`preview/auditRuntime.js`, self-contained like `runProject`) after rendering. Each iframe posts `{ type: "audit", overflow, smallTargets, a11y }` (axe-core WCAG A/AA at 1280px only; horizontal overflow at every width; tap targets < 24×24px at 375px). `Home` collects them per code version and `preview/qualityReport.js` turns them into a score (100 minus per-issue penalties), an issue list, and the refine instruction used by "Auto-fix". History entries keep the previous version's `score` to show the change.

## Deployment

- Frontend: Vercel — https://frontend-copilot.vercel.app/ (`VITE_API_URL` set to the Render URL)
- Backend: Render — https://frontend-copilot-api.onrender.com/ (`GET /` is the health check)
