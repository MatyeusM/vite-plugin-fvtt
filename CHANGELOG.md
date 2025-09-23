# Changelog

## [0.2.5] - 2025-09-24

### Fixed

- `system.json` or `module.json` in root due to missing wait condition for the check not properly copying.

## [0.2.4] - 2025-09-23

### Changed

- Removed dependencies of `fs-extra` and `dotenv` to shrink the dependencies.
- Async file loading should improve the performance for a large number of language files significantly.

## [0.2.3] - 2025-09-20

### Fixed

- Return absolute paths from globbing.
- Refactor path-utils import and usage across codebase, for better Windows support.
- Refactor logger to use static Logger class methods.
- Bump dependencies.

### Added

- Add Vitest and fixture-based build test.

## [0.2.2] - 2025-09-10

### Fixed

- Improve windows path resolution.

## [0.2.1] - 2025-09-09

### Fixed

- Fixed language generation to not error out on mixed entries.

## [0.2.0] - 2025-09-08

### Added

- Automatic compiling of packs for watch and build mode, when discovered.
- Option to skip the automatic compilation of packs `{ buildPacks: false }`.
- Documenting the changes in a `CHANGELOG.md` for the plugin.

## [0.1.4] - 2025-09-06

### Added

- In watch mode, the plugin now automatically avoids cleaning the output directory, if `emptyOutDir`
  is not set.

### Fixed

- By using rollupOptions, the output files are now correctly named as specified by the foundry vtt
  manifest, even in case `{ "type": "module" }` is not set in the `package.json`.

### Changed

- Defaults in case of unspecified `esmodules`, `scripts`, or `styles` in the foundry vtt manifest
  now default to the folder structure suggested by foundry vtt.

## [0.1.3] - 2025-09-04

### Added

- Manifest and language files not in the public directory are now watched during `--watch`.

### Changed

- Updated the documentation.

### Fixed

- HMR for language files only manually reloads all active translations for the current module.
- HMR for templates now manually reassigns them on successful compilation instead of using
  `getTemplate`. This prevents an missing template from appearing after a failed HMR compilation.

## [0.1.2] - 2025-09-03

### Added

- Automatic npm deployment on tag push.

### Changed

- Replaced glob with tinyglobby to match vite's dependencies and not add more unnecessary modules.
- Default to `bundle.css` if no style file is specified in the manifest, but one was found during
  compilation as an asset.

### Fixed

- Add typechecks to guard against missing manifest entries.

## [0.1.1] - 2025-09-02

### Added

- Initial Release

[unreleased]: https://github.com/MatyeusM/vite-plugin-fvtt/compare/v0.2.5...HEAD
[0.2.5]: https://github.com/MatyeusM/vite-plugin-fvtt/compare/v0.2.4...v0.2.5
[0.2.4]: https://github.com/MatyeusM/vite-plugin-fvtt/compare/v0.2.3...v0.2.4
[0.2.3]: https://github.com/MatyeusM/vite-plugin-fvtt/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/MatyeusM/vite-plugin-fvtt/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/MatyeusM/vite-plugin-fvtt/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/MatyeusM/vite-plugin-fvtt/compare/v0.1.4...v0.2.0
[0.1.4]: https://github.com/MatyeusM/vite-plugin-fvtt/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/MatyeusM/vite-plugin-fvtt/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/MatyeusM/vite-plugin-fvtt/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/MatyeusM/vite-plugin-fvtt/releases/tag/v0.1.1
