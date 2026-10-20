# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Bilingual (English / 繁體中文) landing page in `docs/`, built with plain HTML, CSS, GSAP and canvas, with animated
  previews of the four demos and slots for recorded videos.
- `Deploy site` workflow that publishes `docs/` to GitHub Pages.

### Changed

- The landing page now uses Cavalry's brand violet (`#6437ff`) on a white background.

## [0.1.0] - 2026-10-17

### Added

- MCP server (stdio) with 28 typed tools covering scene inspection, layer creation and management, attributes,
  generators, connections, expressions, keyframes with Magic Easing, playback, PNG rendering and scene save/open.
- `cavalry_batch` for running many operations in one round-trip, with `$0`-style references to earlier results.
- `cavalry_get_bounding_box`, `cavalry_inspect_connections` and `cavalry_add_dynamic_attribute`.
- Attribute-path validation before writes (Cavalry otherwise ignores unknown paths silently).
- Fail-fast `BridgeFrozenError` when Cavalry stops processing requests (`CAVALRY_MCP_FROZEN_MS`).
- `cavalry://guide/attributes` MCP resource with layer types, verified attribute paths and gotchas.
- Opt-in `cavalry_run_script`, gated on both the server and the bridge.
- Cavalry bridge script built on `api.WebServer` with a POST-then-poll protocol (v1) and a start/stop panel.
- Clear, typed errors for unreachable bridge, timeouts, protocol mismatch and Cavalry-side failures.
- Test suite that runs the real bridge against an emulated Cavalry, plus CI on Node 22/24.
- English and Traditional Chinese documentation.

[Unreleased]: https://github.com/Pinyi333/cavalry-mcp/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Pinyi333/cavalry-mcp/releases/tag/v0.1.0
