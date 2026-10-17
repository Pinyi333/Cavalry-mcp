#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CavalryBridgeClient } from "./bridge-client.js";
import { ConfigError, isLoopbackHost, loadConfig } from "./config.js";
import { createServer } from "./server.js";
import { VERSION } from "./version.js";

// stdout carries the MCP protocol; all diagnostics go to stderr.
const log = (message: string) => process.stderr.write(`[cavalry-mcp] ${message}\n`);

async function main(): Promise<void> {
  const config = loadConfig();
  if (!isLoopbackHost(config.host)) {
    log(`Warning: CAVALRY_MCP_HOST is "${config.host}". The bridge has no authentication; keep it on loopback.`);
  }

  const bridge = new CavalryBridgeClient(config);
  const server = createServer(bridge, { allowScript: config.allowScript });
  await server.connect(new StdioServerTransport());

  log(
    `v${VERSION} ready (bridge ${bridge.endpoint}, timeout ${config.timeoutMs} ms, ` +
      `run_script ${config.allowScript ? "enabled" : "disabled"}).`,
  );

  const shutdown = () => {
    void server.close().finally(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error: unknown) => {
  log(error instanceof ConfigError ? error.message : `Fatal: ${String(error)}`);
  process.exit(1);
});
