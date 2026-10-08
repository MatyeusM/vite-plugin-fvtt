# AGENTS.md

## Package manager

- `pnpm` only (`preinstall` enforces it, `packageManager: pnpm@11.26.0`). Never use npm/yarn.

## Commands

- `pnpm run build` (tsdown), `pnpm run lint` (oxlint), `pnpm run fmt` / `fmt:check` (oxfmt),
  `pnpm run typecheck` (tsc), `pnpm run test` (vitest, single run). `pnpm vitest` starts watch mode.
- Pre-commit hook runs `lint-staged` + `typecheck`; every commit is checked.
- Pushes to `main` may be rejected (Dependabot moves fast) — `git pull --rebase origin main` first.

## Lint/format strictness (will fail the build)

- oxlint: `correctness`/`suspicious`/`pedantic`/`perf` are all errors. Known tripwires:
  `max-lines-per-function` (50 — extract helpers), `require-unicode-regexp` (regexes need the `u`
  flag).
- oxfmt: no semicolons, single quotes, `arrowParens: avoid`, sorted imports, `proseWrap: always`
  (also reformats Markdown).
- When verifying, don't pipe pnpm through `tail` — the pipe masks a failing exit code.
- Never change `oxlint.config.ts` without permission, and never add `oxlint` disable comments.

## Dependencies

- Add nothing new without asking. Allowed: what Vite depends on, what `@foundryvtt/foundryvtt-cli`
  depends on, and what implements Foundry behavior (e.g. `socket.io`).
- Peer range is `vite ^7.0.0 || ^8.0.0`; minification is version-dependent (oxc on 8+, esbuild
  fallback) in `src/config/vite-options.ts`.

## Architecture (`src/`, alias `@` → `src/`)

- `index.ts` — plugin entry. `config/` loads `.env.foundryvtt*` env (validated host/port), manifest
  (`module.json`/`system.json`, exactly one of `esmodules`/`scripts`), and derives the partial Vite
  config (dev server runs on `foundryPort + 1`).
- `server/` — dev-only middleware: `http-middleware.ts` (CSS blocking, language serving),
  `socket-proxy.ts` (template interception over socket.io), `trackers/` (HMR events).
- `language/` — complete files in `public/` copied as-is, else partials merged from the source dir
  with dot-notation expansion. `packs/` compiles via `foundryvtt-cli`.
- `context.ts` is a process-wide singleton (`env`/`manifest`/`config` are only set once Vite hooks
  run — `undefined` before that). Tracker instances are module-level singletons: do not refactor
  their lifecycle until the local Foundry instances (below) are running live tests.

## Tests (`tests/`, setup in `tests/setup.ts` registers custom matchers)

- Pattern: `vi.spyOn(process, 'cwd')` → temp dir, create fixture files, `createServer`/`build`.
  Dev-server fetch helper hardcodes port `30001` (mirrors `foundryPort + 1`).
- Additions come test-first: write a failing test comprehensively covering the new behavior, then
  implement. (This applies to additions, not to changes of existing behavior.)
- `pnpm run test` must stay green; CI runs Node 22/24/26.

## Local Foundry instances (`local/`, tracked by this repo)

`local/` holds the frozen v13/v14 systems and test worlds.

- `foundry-v12`/`data-v12` (port 30012, node 20), `v13` (30013, node 22), `v14` (30014, node 24).
  v12 entry is `resources/app/main.js` (Electron layout), v13/v14 use `main.js`.
- Start one via `mise run -C local start-v12|start-v13|start-v14`. v13/v14 boot `testv13`/`testv14`.
- Each `data-v*/Data/systems/shadowrun5e` symlinks to `v*-system/dist`, so build the system first.
- Single license key: **never run more than one instance at a time**.
- `local/.gitignore` keeps out `foundry-v*`, `data-v*/Config` (holds the license key), runtime logs
  under `data-v*/Logs`, `Data/modules`, `Data/assets`, `node_modules`, `dist`. Never commit those.
- Worlds live in `data-v*/Data/worlds/` for every version. Foundry reads that path and nothing else,
  so a world anywhere else (e.g. under `Logs/`) is inert and will not auto-launch. The ignore file
  re-opens `Logs/worlds/` only as a safety net for a version that does that.
- Foundry rewrites world LevelDB on every boot. The e2e harness restores the frozen worlds before
  launching and after stopping its own instance (`restoreWorldData`/`stopFoundry` in
  `tests/e2e/proc.ts`, scoped to that version's worlds dir), so the tree stays clean without manual
  steps. `mise run -C local reset-data` remains the manual escape hatch covering every version (run
  it with Foundry stopped). It uses `git clean`, so anything under `local/` that is not committed is
  destroyed - commit fixtures before running it.

## E2E tests (`tests/e2e/`, runs with the rest)

- Part of `pnpm run test`; each suite skips itself when its version is not provisioned, so CI never
  runs it. The skip reason names the missing path.
- A suite is eligible when `local/foundry-v<n>`, `local/v<n>-system/dist`,
  `local/data-v<n>/Config/license.json` and `mise` are all present. It then starts its own instance
  (`mise run start-v<n>`, booted with `--hotReload`) and stops it in teardown, so no manual step is
  needed. An instance that is already running is borrowed instead, and then left running.
- v13 and v14 never run at the same time: one licence key. `vitest.config.ts` gives the e2e project
  `fileParallelism: false`.
- `FVTT_E2E_VERSION=v13`/`v14` forces one version; the other skips.
- `foundry-v<version>.test.ts` holds only what differs per version - login widget, sheet template,
  i18n key. Everything shared lives in `support.ts` (precheck + suite), `session.ts` (the driver)
  and `proc.ts` (process/polling). Add new per-version differences to the version's own file.
- Each suite drives real Foundry through the dev server: log in, render a sheet, assert hbs HMR,
  then overwrite one locale key with `hmr`, assert the sheet shows it, and roll the file back. It
  then reuses the same instance for watch mode: start `vite build --watch`, assert a sentinel file
  in `dist/` survives the rebuilds, assert a rebuilt language file lands in `dist/`, and assert a
  rebuilt template reaches the open sheet through Foundry's own hot reload.
- Native language hot reload is not asserted on the sheet: Foundry's server prefixes the event path
  with the package dir while the client compares it against the manifest path, so package language
  events never match. Templates apply by content, so they prove the native round-trip.
- Joining retries until it sticks: Foundry listens before its startup IP discovery settles, and a
  join in that window authenticates then dies in `getInvitationLinks`, so `game.ready` never flips.
- The harness restores the world seed before boot and after teardown of its own instance, so no
  manual step is needed. `mise run -C local reset-data` covers all versions at once when needed.

## Changelog

- `CHANGELOG.md` follows [Keep a Changelog](https://keepachangelog.com) (`Unreleased` section with
  `Added`/`Changed`/`Fixed` subsections). Update it with user-facing changes.
- Only end-user changes get entries: behavior, API, peer ranges, install/publish fixes, user docs.
  Never dev-only work: devDependency bumps, test/e2e harness internals, lint/tooling, CI, or
  version-number-only dependency bumps with no behavior change. Drop a release section left empty by
  this rule.
