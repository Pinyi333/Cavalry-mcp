import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { BridgeError, type CallOptions } from "./bridge-client.js";
import { ATTRIBUTE_GUIDE } from "./guide.js";
import { TOOLS } from "./tools.js";
import { VERSION } from "./version.js";

/** The subset of the bridge client the server needs; lets tests pass a fake. */
export interface BridgeCaller {
  call<T = unknown>(op: string, args?: Record<string, unknown>, options?: CallOptions): Promise<T>;
}

export interface ServerOptions {
  allowScript: boolean;
}

const INSTRUCTIONS = [
  "Tools in this server control a running copy of Cavalry (2D procedural motion design).",
  "Start with cavalry_scene_info, then cavalry_list_layers to discover layer ids.",
  'Layer ids look like "basicShape#1"; attribute paths look like "position.x" or "material.materialColor".',
  'In 2D, rotate with "rotation.z"; scale 1.0 means 100%; opacity is 0-100.',
  "Use cavalry_list_attributes when unsure of an attribute path, and read the cavalry://guide/attributes resource.",
  'Prefer cavalry_batch for multi-step builds; "$0" in a later operation refers to the id created by operation 0.',
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
          return toResult(await bridge.call(tool.op, args, { detectFrozen: !tool.longRunning }));
        } catch (error) {
          return toError(error);
        }
      },
    );
  }

  server.registerResource(
    "attribute-guide",
    "cavalry://guide/attributes",
    {
      title: "Cavalry attribute & layer guide",
      description: "Common layer types, attribute paths, Magic Easing names and gotchas for driving Cavalry.",
      mimeType: "text/markdown",
    },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: ATTRIBUTE_GUIDE }] }),
  );

  return server;
}
