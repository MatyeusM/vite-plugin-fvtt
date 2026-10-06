# AGENTS.md

## Package manager

- `pnpm` only (`preinstall` enforces it, `packageManager: pnpm@11.26.0`). Never use npm/yarn.

## Commands

- `pnpm run build` (tsdown), `pnpm run lint` (oxlint), `pnpm run fmt` / `fmt:check` (oxfmt),
  `pnpm run typecheck` (tsc), `pnpm run test -- --run` (vitest).
- Bare `pnpm run test` starts watch mode — always pass `-- --run` for verification.
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
- `pnpm run test -- --run` must stay green; CI runs Node 22/24/26.

## Local Foundry instances (`local/`, gitignored by this repo)

`local/` is its own git repo holding the frozen v13/v14 systems and test worlds.

- `foundry-v12`/`data-v12` (port 30012, node 20), `v13` (30013, node 22), `v14` (30014, node 24).
  v12 entry is `resources/app/main.js` (Electron layout), v13/v14 use `main.js`.
- Start one via `mise run -C local start-v12|start-v13|start-v14`. v13/v14 boot `testv13`/`testv14`.
- Each `data-v*/Data/systems/shadowrun5e` symlinks to `v*-system/dist`, so build the system first.
- Single license key: **never run more than one instance at a time**.
- `local/.gitignore` keeps out `foundry-v*`, `data-v*/Config` (holds the license key),
  `data-v*/Logs`, `node_modules`, `dist`. Never commit those.
- Foundry rewrites world LevelDB on every boot; `mise run -C local reset-data` restores the frozen
  worlds (run it with Foundry stopped).

## E2E tests (`tests/e2e/`, runs with the rest)

- Part of `pnpm run test -- --run`; skips itself when no instance is listening, so CI never runs it.
- Targets whichever version is up, or `FVTT_E2E_VERSION=v13`/`v14` to force one.
- Drives real Foundry through the dev server: log in, render a sheet, assert hbs HMR.
- v13 joins via `select[name=userid]`, v14 via `input#join-username`; sheet templates differ
  (`actor/character.hbs` vs `v2/actor/header.hbs`). Both are table-driven in the test file.

## Changelog

- `CHANGELOG.md` follows [Keep a Changelog](https://keepachangelog.com) (`Unreleased` section with
  `Added`/`Changed`/`Fixed` subsections). Update it with user-facing changes.
