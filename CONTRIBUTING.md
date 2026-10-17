# Contributing to Cavalry MCP

Thanks for your interest in improving Cavalry MCP! This guide covers the workflow for issues and pull requests.

## Ground rules

- Be respectful and constructive.
- **Never commit secrets** (API keys, tokens, personal paths, `.env` files). The project needs none.
- Keep the bridge (`bridge/cavalry-mcp-bridge.js`) dependency-free and in plain ES2017. It runs inside Cavalry's
  JavaScript engine, not Node.

## Reporting bugs

Open an issue using the **Bug report** template and include:

- Cavalry version (`cavalry_ping` prints it), OS and Node.js version
- The MCP client you use (Claude Desktop, Claude Code, …)
- The failing tool call and the error text
- Whether the bridge panel showed "Listening on …"

## Development setup

```bash
git clone https://github.com/Pinyi333/cavalry-mcp.git
cd cavalry-mcp
npm install
npm run check   # typecheck + lint + format check + tests
```

The test suite loads the real bridge script into a Node `vm` sandbox with a fake Cavalry `api`, and serves it over HTTP
the way Cavalry's `api.WebServer` does. You can work on most features without Cavalry installed. Please still try
changes in a real Cavalry session before opening a PR when you can.

## Adding a tool

1. **Bridge:** add an operation to the `ops` table in `bridge/cavalry-mcp-bridge.js`. Validate arguments with the
   `require*` helpers and return a JSON-serialisable object.
2. **Server:** add a `ToolDefinition` to `src/tools.ts` with a clear description, a zod input schema and accurate
   annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`). If it should be usable in `cavalry_batch`, add the
   op to `BATCHABLE_OPS`.
3. **Fake API:** if the op uses a new Cavalry API function, add it to `test/helpers/fake-cavalry.ts`.
4. **Tests:** cover the happy path and the main failure modes in `test/bridge.test.ts`.
5. **Docs:** update the tool tables in `README.md`, `README.zh-TW.md` and `docs/protocol.md`, plus `CHANGELOG.md`.

Check function names against the official
[Cavalry API Module reference](https://cavalry.studio/docs/tech-info/scripting/api-module/).

## Pull requests

- Branch from `main` and keep each PR focused on one change.
- Use [Conventional Commits](https://www.conventionalcommits.org/) for messages (`feat:`, `fix:`, `docs:`, …).
- Make sure `npm run check` passes. CI runs the same command on Node 20, 22 and 24.
- If you change the request/response shape, bump `PROTOCOL_VERSION` in both `src/bridge-client.ts` and the bridge,
  and document it in `docs/protocol.md`.

## Releasing (maintainers)

1. Update `version` in `package.json`, `src/version.ts` and `BRIDGE_VERSION` in the bridge.
2. Move the `Unreleased` notes in `CHANGELOG.md` under the new version.
3. Tag `vX.Y.Z` and create a GitHub release that attaches `bridge/cavalry-mcp-bridge.js`.
