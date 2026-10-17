import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it } from "vitest";
import { CavalryBridgeClient } from "../src/bridge-client.js";
import { createServer, type BridgeCaller } from "../src/server.js";
import { TOOLS } from "../src/tools.js";
import { startFakeCavalry } from "./helpers/fake-cavalry.js";

const closers: Array<() => Promise<void>> = [];

/** A bridge stub that records whether it was called. */
function stubBridge(): BridgeCaller & { called: boolean } {
  const stub = {
    called: false,
    call: async <T>() => {
      stub.called = true;
      return {} as T;
    },
  };
  return stub;
}
afterEach(async () => {
  while (closers.length) await closers.pop()!();
});

async function connect(bridge: BridgeCaller, allowScript = false) {
  const server = createServer(bridge, { allowScript });
  const client = new Client({ name: "test", version: "0.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  closers.push(() => client.close());
  return client;
}

function text(result: Awaited<ReturnType<Client["callTool"]>>): string {
  const content = result.content as Array<{ type: string; text: string }>;
  return content[0]!.text;
}

describe("MCP server", () => {
  it("hides cavalry_run_script unless enabled", async () => {
    const fake = stubBridge();
    const off = (await (await connect(fake)).listTools()).tools.map((t) => t.name);
    const on = (await (await connect(fake, true)).listTools()).tools.map((t) => t.name);
    expect(off).not.toContain("cavalry_run_script");
    expect(on).toContain("cavalry_run_script");
    expect(on).toHaveLength(TOOLS.length);
  });

  it("gives every tool a description and annotations", async () => {
    const { tools } = await (await connect(stubBridge(), true)).listTools();
    for (const tool of tools) {
      expect(tool.description, tool.name).toBeTruthy();
      expect(tool.annotations?.readOnlyHint, tool.name).toBeTypeOf("boolean");
    }
  });

  it("validates input before reaching the bridge", async () => {
    const bridge = stubBridge();
    const client = await connect(bridge);
    const result = await client.callTool({ name: "cavalry_set_frame", arguments: { frame: "ten" } });
    expect(result.isError).toBe(true);
    expect(bridge.called).toBe(false);
  });

  it("drives the real bridge end to end", async () => {
    const cavalry = await startFakeCavalry();
    closers.push(cavalry.close);
    const client = await connect(
      new CavalryBridgeClient({
        host: "127.0.0.1",
        port: cavalry.port,
        timeoutMs: 2000,
        pollIntervalMs: 5,
        frozenMs: 0,
      }),
    );

    const created = await client.callTool({
      name: "cavalry_create_primitive",
      arguments: { shape: "rectangle", name: "Card", attributes: { rotation: 15 } },
    });
    expect(JSON.parse(text(created))).toMatchObject({ id: "basicShape#1", name: "Card" });

    const keyed = await client.callTool({
      name: "cavalry_set_keyframes",
      arguments: {
        layerId: "basicShape#1",
        keyframes: [
          { frame: 0, values: { "position.y": 200 }, easing: "OvershootOut" },
          { frame: 24, values: { "position.y": 0 } },
        ],
      },
    });
    expect(keyed.isError).toBeFalsy();
    expect(cavalry.api.layers.get("basicShape#1")!.easings).toEqual({ "position.y@0": "OvershootOut" });
  });

  it("returns bridge errors as tool errors", async () => {
    const cavalry = await startFakeCavalry();
    closers.push(cavalry.close);
    const client = await connect(
      new CavalryBridgeClient({
        host: "127.0.0.1",
        port: cavalry.port,
        timeoutMs: 2000,
        pollIntervalMs: 5,
        frozenMs: 0,
      }),
    );
    const result = await client.callTool({ name: "cavalry_rename_layer", arguments: { layerId: "x#1", name: "y" } });
    expect(result.isError).toBe(true);
    expect(text(result)).toBe("BridgeOperationError: Layer 'x#1' does not exist.");
  });

  it("serves the attribute guide resource", async () => {
    const client = await connect(stubBridge());
    const { resources } = await client.listResources();
    expect(resources.map((r) => r.uri)).toContain("cavalry://guide/attributes");
    const read = await client.readResource({ uri: "cavalry://guide/attributes" });
    expect((read.contents[0] as { text: string }).text).toContain("rotation.z");
  });

  it("disables frozen detection only for long-running tools", async () => {
    const seen: Record<string, boolean | undefined> = {};
    const client = await connect({
      call: async <T>(op: string, _args?: Record<string, unknown>, options?: { detectFrozen?: boolean }) => {
        seen[op] = options?.detectFrozen;
        return {} as T;
      },
    });
    await client.callTool({ name: "cavalry_ping", arguments: {} });
    await client.callTool({ name: "cavalry_render_png", arguments: { filePath: "/tmp/x" } });
    expect(seen).toEqual({ ping: true, render_png: false });
  });
});
