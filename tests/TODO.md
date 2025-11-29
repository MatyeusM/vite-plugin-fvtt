# Test Suite Refactor TODO

This document tracks planned refactors and structural improvements for the test suite. Items are
grouped by scope and expected refactor depth.

---

## 1. Per-Test Temporary Directories

**Objective:** Ensure strict filesystem isolation.

- Replace global directory allocation with per-test temporary directories.
- Use `os.tmpdir()` as the top-level base.
- Pass `testDir` explicitly into all helpers instead of mocking `process.cwd()`.
- Update:
  - `createTestFiles`
  - `writeManifest`
  - custom matchers to accept `testDir` as an argument.

---

## 2. Extract Common Matchers and Helpers

**Objective:** Centralize shared logic to reduce local duplication.

- Move all custom matchers into `test/setup-matchers.ts`.
- Register via Vitest `setupFiles`.
- Extract shared utilities:
  - `fileExistsAbs`
  - `checkFiles`
  - `makeMatcherResult`
  - `resolveOutputPath`
- Rewrite matchers as thin declarative shells composed from these helpers.

---

## 3. Unified File Retrieval Utility (`fetchFile`)

**Objective:** Provide a single entry point for reading files from the dev server or filesystem.

Proposed API:

```ts
fetchFile({
  url?: string,
  filePath?: string,
  json?: boolean
})
```

- Use dev-server fetch when `url` is given.
- Use `fs.readFile` when `filePath` is given.
- Handle JSON parsing internally.
- Replace per-test JSON reads and ad-hoc file resolution.
- Allow use as a file-existence probe.

---

## 4. Dynamic Language Reference Selection

**Objective:** Remove static `"i18n/en.json"` assumptions.

- Select the reference language by choosing the `en` entry.
- Load and flatten it as the canonical key set.
- Validate all other language files relative to this reference.

---

## 5. Fixture Factories Instead of Static Constants

**Objective:** Avoid shared mutable state and enable parameterized fixtures.

Introduce:

```ts
makeManifest(overrides)
makeViteConfig(overrides)
makeLanguageFiles(...)
```

Benefits:

- No shared global objects.
- Controlled variations without duplicating entire fixture trees.
- Cleaner future extension.

---

## 6. Test Directory and Constants Decoupling

**Objective:** Remove global directory and mock coupling.

- Delete global `TEMPORARY_TEST_DIRECTORY`.
- Bind directory lifecycle to each test.
- Reduce `process.cwd()` mocking by passing explicit root paths into the plugin configuration.

---

## 7. Consolidate Build and Dev-Server Test Logic

**Objective:** Deduplicate shared mechanisms between `build.test.ts` and `serve.test.ts`.

Shared components:

- `fetchFile` for both modes.
- Shared language-verification routines.
- Shared path- and output-resolution helpers.

---

## 8. Long-Term: Structured Test Layout

**Objective:** Provide clear test-suite topology.

Proposed layout:

```
tests/
  fixtures/
    manifest.ts
    languages.ts
    css.ts
    js.ts
    configs.ts
    factories.ts
  helpers/
    fs.ts
    server.ts
    matchers.ts
  build.test.ts
  serve.test.ts
  self.test.ts
  setup.ts
```
