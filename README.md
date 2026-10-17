<div align="center">

# Cavalry MCP

**Let Claude and other AI assistants drive [Cavalry](https://cavalry.studio/), the 2D procedural motion-design app, through the Model Context Protocol.**

[![CI](https://github.com/Pinyi333/cavalry-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Pinyi333/cavalry-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/github/package-json/v/Pinyi333/cavalry-mcp?label=version)](CHANGELOG.md)
[![GitHub stars](https://img.shields.io/github/stars/Pinyi333/cavalry-mcp?style=flat)](https://github.com/Pinyi333/cavalry-mcp/stargazers)
![Node](https://img.shields.io/badge/node-%3E%3D18.17-339933)
![MCP](https://img.shields.io/badge/MCP-stdio-8A2BE2)

**English** · [繁體中文](README.zh-TW.md)

</div>

---

## Contents

- [Overview](#overview)
- [How it works](#how-it-works)
- [Requirements](#requirements)
- [Installation](#installation)
- [Connect your MCP client](#connect-your-mcp-client)
- [Usage examples](#usage-examples)
- [Tool reference](#tool-reference)
- [Configuration](#configuration)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

## Overview

Cavalry MCP is an MCP server that gives an AI assistant a set of **typed, validated tools** for Cavalry. You can create layers, set attributes, wire up connections, keyframe with Magic Easing, render PNG previews and save scenes, all in plain language:

> "Make a 1920×1080 title card: an orange rounded rectangle that springs in from below over 24 frames, then render frame 30 to my desktop."

Design principles:

- **Typed tools.** Every argument is schema-checked before it reaches Cavalry. Arbitrary code execution is off by default.
- **Local only.** Everything stays on your machine. The bridge binds to `127.0.0.1` and makes no outbound network calls.
- **Clear errors.** Failures say what went wrong and how to fix it, for example "bridge not running", "layer does not exist" or "port mismatch".
- **No dependencies inside Cavalry.** The bridge is a single plain JavaScript file that uses Cavalry's built-in `api.WebServer`.

## How it works

```
┌──────────────┐  stdio (MCP)  ┌────────────────────┐  HTTP 127.0.0.1:37650  ┌──────────────────────────┐
│ Claude / MCP │ ────────────▶ │  cavalry-mcp       │ ─────────────────────▶ │ cavalry-mcp-bridge.js    │
│ client       │ ◀──────────── │  (Node.js server)  │ ◀───────────────────── │ (runs inside Cavalry)    │
└──────────────┘               └────────────────────┘   POST /post, GET /get  └──────────────────────────┘
```

1. The **MCP server** (`src/`) exposes tools to the client over stdio.
2. Each tool call becomes a JSON request `{id, op, args}` POSTed to the **bridge** running inside Cavalry.
3. Cavalry's WebServer cannot reply to a POST directly. The bridge runs the operation through Cavalry's scripting API and publishes the result under the request id, and the server polls `GET /get` until that result appears.

The wire protocol is documented in [docs/protocol.md](docs/protocol.md).

## Requirements

| Component                          | Version                                                                                |
| ---------------------------------- | -------------------------------------------------------------------------------------- |
| [Cavalry](https://cavalry.studio/) | **2.7 or later** (free for individuals since 2.7, scripting included)                  |
| [Node.js](https://nodejs.org/)     | **22 LTS recommended**. The server runs on 18.17+, but `npm test` and lint need 22.12+ |
| MCP client                         | Claude Desktop, Claude Code, Cursor, or any stdio MCP client                           |
| OS                                 | macOS 12+ or Windows 10+ (the platforms Cavalry supports)                              |

> Cavalry 2.6.1 and earlier only let paid _Professional_ licences run unencrypted scripts, and the bridge is an unencrypted script. Use Cavalry 2.7+.

## Installation

### 1. Build the MCP server

```bash
git clone https://github.com/Pinyi333/cavalry-mcp.git
cd cavalry-mcp
npm install        # also builds dist/ through the "prepare" script
```

Optionally confirm everything works (no Cavalry needed):

```bash
npm test
```

### 2. Install the Cavalry bridge

Copy [`bridge/cavalry-mcp-bridge.js`](bridge/cavalry-mcp-bridge.js) into Cavalry's Scripts folder. You can also open the folder from inside Cavalry with **Help > Scripts**.

| OS      | Scripts folder                                   |
| ------- | ------------------------------------------------ |
| macOS   | `~/Library/Application Support/Cavalry/Scripts/` |
| Windows | `%APPDATA%\Cavalry\Scripts\`                     |

### 3. Start the bridge

In Cavalry, choose **Window > Scripts > cavalry-mcp-bridge**. A small panel opens showing `Listening on 127.0.0.1:37650`. Cavalry may ask for permission the first time the script uses its Web APIs; allow it.

> The bridge stops when the panel or Cavalry closes. Start it again after each restart.

## Connect your MCP client

Replace `/ABSOLUTE/PATH/TO/cavalry-mcp` with the folder you cloned into. Ready-to-copy files are in [`examples/`](examples/).

<details open>
<summary><b>Claude Desktop</b></summary>

Edit `claude_desktop_config.json`:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "cavalry": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/cavalry-mcp/dist/index.js"]
    }
  }
}
```

Restart Claude Desktop. The Cavalry tools appear in the tools menu.

</details>

<details>
<summary><b>Claude Code</b></summary>

```bash
claude mcp add cavalry -- node /ABSOLUTE/PATH/TO/cavalry-mcp/dist/index.js
```

Or add a project-level `.mcp.json`:

```json
{
  "mcpServers": {
    "cavalry": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/cavalry-mcp/dist/index.js"]
    }
  }
}
```

</details>

<details>
<summary><b>Cursor and other clients</b></summary>

Any client that launches stdio MCP servers works. Use `node` as the command and `dist/index.js` as the argument, plus any [environment variables](#configuration) you need.

</details>

Then ask your assistant: **"Ping Cavalry."** You should get the bridge and Cavalry versions back.

## Usage examples

| Ask                                                | What happens                                                                                           |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| "What's in my current scene?"                      | `cavalry_scene_info` and `cavalry_list_layers`                                                         |
| "Add a blue circle of radius 120 in the centre."   | `cavalry_create_primitive` with `generator.radius` and `material.materialColor`                        |
| "Make it bounce in from the top over 20 frames."   | `cavalry_set_keyframes` with `"easing": "BounceOut"`                                                   |
| "Duplicate 12 circles around a ring."              | `cavalry_create_layer` (duplicator), `cavalry_connect`, `cavalry_set_generator` (`circleDistribution`) |
| "Render frame 30 at 50% to ~/Desktop/preview.png." | `cavalry_render_png`                                                                                   |
| "Save this as ~/Projects/intro.cv."                | `cavalry_save_scene`                                                                                   |

More step-by-step demos (with fallbacks) are in [examples/demo-prompts.md](examples/demo-prompts.md).

Tips for good results:

- If a write is rejected with _"has no attribute"_, the path is wrong. Cavalry would otherwise ignore it silently, so the server checks every path first. Use `cavalry_list_attributes` to find the right one. In 2D, rotate with `rotation.z`.
- Ask the assistant to **render a PNG and look at it** after big changes. Clients that can read local files (such as Claude Code) can check their own work.
- Attribute paths match Cavalry's **Copy Scripting Path** (right-click an attribute in the Attribute Editor), for example `position.x` or `generator.dimensions`.
- For multi-step builds, the assistant can use `cavalry_batch` to do everything in one round-trip.

## Tool reference

| Tool                                     | Purpose                                                                                   | Kind               |
| ---------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------ |
| `cavalry_ping`                           | Check connectivity and versions                                                           | read               |
| `cavalry_scene_info`                     | Scene path, unsaved state, frame, comps, active comp settings                             | read               |
| `cavalry_set_frame`                      | Move the playhead                                                                         | edit               |
| `cavalry_playback`                       | Play / stop                                                                               | edit               |
| `cavalry_list_layers`                    | List layers (optionally top-level only or by type)                                        | read               |
| `cavalry_get_selection`                  | Currently selected layers                                                                 | read               |
| `cavalry_select`                         | Replace the selection                                                                     | edit               |
| `cavalry_create_primitive`               | Create rectangle / ellipse / star / polygon… with attributes                              | create             |
| `cavalry_create_layer`                   | Create any layer type (text, null, group, duplicator, material…)                          | create             |
| `cavalry_duplicate_layer`                | Duplicate a layer, returning the new ids                                                  | create             |
| `cavalry_rename_layer`                   | Rename a layer                                                                            | edit               |
| `cavalry_set_parent`                     | Parent / un-parent a layer                                                                | edit               |
| `cavalry_delete_layers`                  | Delete layers                                                                             | destructive        |
| `cavalry_list_attributes`                | List attribute paths (optionally with types and values)                                   | read               |
| `cavalry_get_attributes`                 | Read attribute values                                                                     | read               |
| `cavalry_set_attributes`                 | Set attribute values (paths are validated first)                                          | edit               |
| `cavalry_get_bounding_box`               | Layer bounds for layout and alignment                                                     | read               |
| `cavalry_inspect_connections`            | Incoming / outgoing connections of a layer                                                | read               |
| `cavalry_add_dynamic_attribute`          | Add a dynamic attribute (e.g. on JavaScript layers)                                       | create             |
| `cavalry_set_generator`                  | Swap a layer's generator                                                                  | edit               |
| `cavalry_set_expression`                 | Set / clear an attribute expression                                                       | edit               |
| `cavalry_connect` / `cavalry_disconnect` | Wire attributes together                                                                  | edit / destructive |
| `cavalry_set_keyframes`                  | Keyframe one or more attributes, with Magic Easing                                        | edit               |
| `cavalry_delete_keyframes`               | Delete keyframes or all animation on an attribute                                         | destructive        |
| `cavalry_render_png`                     | Render a frame to PNG                                                                     | create             |
| `cavalry_save_scene`                     | Save / Save As                                                                            | edit               |
| `cavalry_open_scene`                     | Open a `.cv` file                                                                         | destructive        |
| `cavalry_batch`                          | Run many operations in one round-trip, with `$0`-style references (fail-fast, not atomic) | destructive        |
| `cavalry_run_script`                     | Run arbitrary JavaScript in Cavalry (**opt-in**, see [Security](#security))               | destructive        |

**Resource:** `cavalry://guide/attributes` is a built-in guide to common layer types, attribute paths (`rotation.z`, `shapeScale.x`, `startFrame`, …), Magic Easing names and known gotchas. Clients that support MCP resources can attach it as context.

**Batch references:** later operations in `cavalry_batch` can use results from earlier ones. `"$0"` means the id created by operation 0, and `"$1.created.0.id"` walks into a result:

```json
[
  { "op": "create_primitive", "args": { "shape": "ellipse", "attributes": { "hidden": true } } },
  { "op": "create_layer", "args": { "type": "duplicator" } },
  { "op": "connect", "args": { "fromLayerId": "$0", "toLayerId": "$1", "toAttrId": "shapes" } },
  { "op": "set_generator", "args": { "layerId": "$1", "type": "circleDistribution" } }
]
```

**Magic Easing names:** `SlowIn`, `SlowOut`, `SlowInSlowOut`, `VerySlowIn`, `VerySlowOut`, `VerySlowInVerySlowOut`, `SpringIn`, `SpringOut`, `SpringInSpringOut`, `SmallSpringIn`, `SmallSpringOut`, `SmallSpringInSmallSpringOut`, `AnticipateIn`, `OvershootOut`, `AnticipateInOvershootOut`, `BounceIn`, `BounceOut`, `BounceInBounceOut`, `Custom` (with an expression such as `1 - pow(1 - x, 5)`), `None`.

## Configuration

The server reads these environment variables. All are optional.

| Variable                       | Default     | Description                                                                                                                                        |
| ------------------------------ | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CAVALRY_MCP_HOST`             | `127.0.0.1` | Host the bridge listens on. Keep it on loopback.                                                                                                   |
| `CAVALRY_MCP_PORT`             | `37650`     | Must match `CONFIG.port` in the bridge script.                                                                                                     |
| `CAVALRY_MCP_TIMEOUT_MS`       | `15000`     | Max wait for a single operation (raise it for heavy renders).                                                                                      |
| `CAVALRY_MCP_POLL_INTERVAL_MS` | `40`        | How often the server polls the bridge for results.                                                                                                 |
| `CAVALRY_MCP_FROZEN_MS`        | `5000`      | Fail fast with `BridgeFrozenError` when Cavalry processes nothing for this long (`0` disables). Rendering, saving, opening and batches are exempt. |
| `CAVALRY_MCP_ALLOW_SCRIPT`     | `false`     | Registers `cavalry_run_script`. The bridge must also allow it.                                                                                     |

Pass them through your client config:

```json
{
  "mcpServers": {
    "cavalry": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/cavalry-mcp/dist/index.js"],
      "env": { "CAVALRY_MCP_PORT": "37650", "CAVALRY_MCP_TIMEOUT_MS": "30000" }
    }
  }
}
```

The bridge has its own settings in the `CONFIG` block at the top of `cavalry-mcp-bridge.js`: `host`, `port`, `allowScript` and `maxResults`.

## Security

- The bridge **has no authentication**. Any process on your computer that can reach `127.0.0.1:37650` can send it commands. It binds to loopback only, so other machines cannot reach it. Never change `CONFIG.host` to `0.0.0.0` or a LAN address.
- **Arbitrary JavaScript is disabled on both sides by default.** To enable `cavalry_run_script` you must set `CAVALRY_MCP_ALLOW_SCRIPT=true` _and_ `CONFIG.allowScript = true` in the bridge. Enable it only while you need it.
- The project stores no credentials, API keys or telemetry, and needs none.
- Stop the bridge (close its panel) when you are not using it.

Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

## Troubleshooting

| Symptom                                                   | Fix                                                                                                                                      |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `BridgeUnavailableError: Cannot reach the Cavalry bridge` | Cavalry is not running, or the bridge panel isn't open. Run **Window > Scripts > cavalry-mcp-bridge**. Check that the ports match.       |
| `BridgeFrozenError`                                       | Cavalry is in the background or a dialog is open. Bring Cavalry to the front; the request is still queued and runs once Cavalry resumes. |
| `BridgeTimeoutError`                                      | The operation took too long. For long renders, raise `CAVALRY_MCP_TIMEOUT_MS`.                                                           |
| `BridgeProtocolError: ... not the cavalry-mcp bridge`     | Another app is using the port. Change `CONFIG.port` and `CAVALRY_MCP_PORT` to the same free port.                                        |
| `Bridge protocol mismatch`                                | Copy the `cavalry-mcp-bridge.js` from the same release as your server into Cavalry again.                                                |
| `Layer '…' does not exist`                                | Ids change when layers are deleted or scenes reopen. Ask the assistant to call `cavalry_list_layers` again.                              |
| Tools don't appear in Claude                              | Check that the path in the config is absolute and that `dist/index.js` exists (`npm run build`), then restart the client.                |

To debug the server without an AI client, use the MCP Inspector:

```bash
npm run inspector
```

## Development

```bash
npm install
npm run dev          # tsc --watch
npm test             # vitest (runs the real bridge against an emulated Cavalry)
npm run check        # typecheck + lint + format check + tests (what CI runs)
```

Project layout:

```
cavalry-mcp/
├── bridge/cavalry-mcp-bridge.js   # Runs inside Cavalry (plain ES2017, no dependencies)
├── src/
│   ├── index.ts                   # CLI entry: config, stdio transport
│   ├── server.ts                  # Registers tools on the MCP server
│   ├── tools.ts                   # Declarative tool catalogue (schemas, annotations)
│   ├── guide.ts                   # cavalry://guide/attributes resource
│   ├── bridge-client.ts           # HTTP POST-then-poll client + typed errors
│   └── config.ts                  # Environment variable parsing
├── test/                          # Unit + end-to-end tests with a fake Cavalry api
├── docs/protocol.md               # Bridge wire protocol
└── examples/                      # MCP client config templates
```

To add a tool: implement the operation in the bridge's `ops` table, add its definition to `src/tools.ts`, and cover it in `test/bridge.test.ts`. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Roadmap

- Render-queue tools (render a composition range to video or image sequence)
- Composition management (create comps, set resolution, frame range and fps)
- Asset import (images, SVG, Google Sheets / Canva Sheets data)
- MCP resources for scene structure, and prompts for common motion recipes
- Optional shared-secret token between server and bridge

## Contributing

Issues and pull requests are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) first. Everyone taking part is expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md). The automated tests run against an emulated Cavalry, so reports from real Cavalry sessions, including version, OS and the failing tool call, are especially valuable.

## Acknowledgements

These community projects shaped this one, and their ideas are credited here:

- [ZHUYUFAN3-33/cavalry-mcp](https://github.com/ZHUYUFAN3-33/cavalry-mcp): typed tools instead of raw eval, the POST-then-poll protocol with request ids, fail-fast "frozen" detection, bounding box and connection inspection, and community-verified attribute paths (which feed the attribute guide).
- [kacperchlebowicz/Cavalry-mcp](https://github.com/kacperchlebowicz/Cavalry-mcp): dynamic attributes, and the reference list of layer types and attribute paths.
- [matthewobanla/Calvary-MCP](https://github.com/matthewobanla/Calvary-MCP): node-graph and render-pipeline workflows (render-queue tools are on the roadmap).

No code was copied; all implementations here are original.

## License

[MIT](LICENSE) © Piny

Cavalry is a product of Canva / Scene Group. This project is an independent community integration and is not affiliated with or endorsed by Canva or Scene Group.
