import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { BridgeError } from "./bridge-client.js";
import { TOOLS } from "./tools.js";
import { VERSION } from "./version.js";

/** The subset of the bridge client the server needs; lets tests pass a fake. */
export interface BridgeCaller {
  call<T = unknown>(op: string, args?: Record<string, unknown>): Promise<T>;
}

export interface ServerOptions {
  allowScript: boolean;
}

const INSTRUCTIONS = [
  "Tools in this server control a running copy of Cavalry (2D procedural motion design).",
  "Start with cavalry_scene_info, then cavalry_list_layers to discover layer ids.",
  'Layer ids look like "basicShape#1"; attribute paths look like "position.x" or "material.materialColor".',
  "Use cavalry_list_attributes when unsure of an attribute path. Prefer cavalry_batch for multi-step builds.",
  "Render a PNG with cavalry_render_png to check results visually when the client can read local files.",
].join(" ");

function toResult(value: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

function toError(error: unknown): CallToolResult {
  const message =
    error instanceof BridgeError ? `${error.name}: ${error.message}` : `Unexpected error: ${String(error)}`;
  return { isError: true, content: [{ type: "text", text: message }] };
}

export function createServer(bridge: BridgeCaller, options: ServerOptions): McpServer {
  const server = new McpServer({ name: "cavalry-mcp", version: VERSION }, { instructions: INSTRUCTIONS });

  for (const tool of TOOLS) {
    if (tool.requiresScript && !options.allowScript) continue;
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: { title: tool.title, ...tool.annotations },
      },
      async (args: Record<string, unknown>) => {
        try {
          return toResult(await bridge.call(tool.op, args));
        } catch (error) {
          return toError(error);
        }
      },
    );
  }

  return server;
}
