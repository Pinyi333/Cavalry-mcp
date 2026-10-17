# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-10-17

### Added

- MCP server (stdio) with 24 typed tools covering scene inspection, layer creation and management, attributes,
  generators, connections, expressions, keyframes with Magic Easing, playback, PNG rendering and scene save/open.
- `cavalry_batch` for running many operations in one round-trip.
- Opt-in `cavalry_run_script`, gated on both the server and the bridge.
- Cavalry bridge script built on `api.WebServer` with a POST-then-poll protocol (v1) and a start/stop panel.
- Clear, typed errors for unreachable bridge, timeouts, protocol mismatch and Cavalry-side failures.
- Test suite that runs the real bridge against an emulated Cavalry, plus CI on Node 20/22/24.
- English and Traditional Chinese documentation.

[Unreleased]: https://github.com/Pinyi333/cavalry-mcp/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Pinyi333/cavalry-mcp/releases/tag/v0.1.0
