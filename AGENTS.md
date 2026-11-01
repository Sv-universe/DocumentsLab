# AGENTS.md

DocumentsLab is a local-only Electron + React desktop app for a PDF/image library. Releases target Linux (AppImage); the app is alpha.

## Commands

Requires Node.js 22+ and npm (CI uses Node 24).

- `npm run dev` — electron-vite dev server + GUI. Needs a display; use `npm run typecheck`, `npm test`, or `npm run build` for headless verification.
- `npm run typecheck` — runs both TS projects: `tsconfig.node.json` (main/preload/shared) and `tsconfig.web.json` (renderer/shared).
- `npm test` — Vitest in a node environment. Run one file with `npm test -- src/renderer/src/lib/selection.test.ts`.
- `npm run build` — typecheck then electron-vite build. No display needed.
- `npm run dist` — build then electron-builder Linux AppImage into `dist/`.

No lint or formatter script/config exists. CI (`.github/workflows/ci.yml`) only runs `npm run typecheck` and `npm run build`; tests are not run in CI.

## Architecture

- `src/main/index.ts` — Electron main: window, `doclab://` protocol (thumbnails only), library storage, IPC handlers.
- `src/preload/index.ts` — exposes `window.doclab`; the contract is `DoclabApi` in `src/shared/types.ts`.
- `src/renderer/src` — React UI. It has no Node/fs access; all file/system operations go through `window.doclab`.
- `src/shared` — types and constants shared by both sides. Imports use `@shared/*`; renderer code may also use `@renderer/*`.

Adding a file/system operation needs three coordinated edits: extend `DoclabApi` in `src/shared/types.ts`, handle the channel in `src/main/index.ts` with `ipcMain.handle`, and expose it in `src/preload/index.ts`. The renderer then calls the preload method.

Vitest only aliases `@shared`; renderer tests import relative paths (for example `./selection`), not `@renderer`.

PDF annotation/signature coordinates are display points. Convert through `mapDisplayPoint`/`mapSignatureRect` in `src/renderer/src/lib/pdf-export.ts` so pages with `/Rotate` export correctly. Edits are flattened into the saved PDF; there are no interactive form layers.

## Storage and manual runs

Runtime data is in Electron `userData`: `library.json` (metadata), `library/` (copied documents), `thumbnails/`. Set `DOCLAB_USER_DATA=/tmp/doclab-data` to use an isolated directory for manual testing.

## OpenSpec workflow

`openspec/` is tracked and is the behavioral source of truth: `openspec/specs/` holds capability specs; `openspec/changes/` holds proposals/designs/tasks and archived changes. Use the local `.opencode/commands/opsx-*.md` commands (`/opsx-propose`, `/opsx-apply`, `/opsx-archive`, etc.) for spec-driven changes. Those commands are untracked, so a fresh clone may lack them; use the `openspec` CLI directly if needed. OpenSpec artifacts and user-facing UI text are French.

## Release

Push a `v*` tag to trigger `.github/workflows/release.yml`: typecheck, build, package a Linux AppImage, write `SHA256SUMS.txt`, and publish the GitHub release. Version bumps are manual: update `package.json`, `CHANGELOG.md`, and the README download links.
