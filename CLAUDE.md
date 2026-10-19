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

**CORS is hand-rolled** middleware with a hardcoded allow-list (`https://frontend-copilot.vercel.app`, `http://localhost:5173`). The `cors` package is a dependency but unused. A new frontend origin must be added there.

**Frontend state lives entirely in `frontend/src/Home.jsx`** (prompt, result code, verification report, refine instruction, undo history, device mode, last preview status, toast). `VerificationBadge` combines the backend `report` with the preview status, so "Verified" requires both passing code checks and a preview that rendered. `handleRefine(request, label)` also serves "Fix this error", which sends the preview's runtime error as the refine instruction. Components under `src/components/` are presentational and receive state/handlers via props. `Home` shows the landing view (`PromptComposer` + `EmptyState`) when there is no result, otherwise `Workspace` (`PreviewPanel` + `RefinePanel` + `CodePanel`).

**Undo history** is a stack of `{ instruction, code, report }` entries, newest first; each refine pushes the previous code. A fresh generate (including "Regenerate") clears it.

**Live preview pipeline** — one runtime for both modes, in `frontend/src/preview/`:
- `buildProjectPreview(files, entry)` builds an iframe `srcDoc` with pinned UMD builds (React 18, Router v6, Babel Standalone) plus the Tailwind CDN; `previewRuntime.js` runs inside the iframe as a tiny module system (Babel → CommonJS, resolves relative imports, only `react`/`react-dom`/`react-router-dom` as packages) and must stay self-contained because it is injected with `.toString()`.
- The iframe reports `ready` / `error` / `route` via `postMessage({ source: "project-preview" })`; `usePreviewMessages` consumes them and resets state when its `loadKey` (reload counter + srcDoc) changes.
- Component mode (`PreviewPanel.jsx`) runs the code as a one-file project at `src/App.jsx`, after `ensureReactImports` adds imports for hooks used without one (a client-side safety net; the backend validator normally does this already).

So generated code can only import from `react`; any other package shows a "not available in the preview" error.

## Deployment

- Frontend: Vercel — https://frontend-copilot.vercel.app/ (`VITE_API_URL` set to the Render URL)
- Backend: Render — https://frontend-copilot-api.onrender.com/ (`GET /` is the health check)
