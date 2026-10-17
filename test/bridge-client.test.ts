import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import {
  BridgeFrozenError,
  BridgeOperationError,
  BridgeProtocolError,
  BridgeTimeoutError,
  BridgeUnavailableError,
  CavalryBridgeClient,
} from "../src/bridge-client.js";
import { startFakeCavalry } from "./helpers/fake-cavalry.js";

const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (closers.length) await closers.pop()!();
});

function client(port: number, timeoutMs = 2000, frozenMs = 0) {
  return new CavalryBridgeClient({ host: "127.0.0.1", port, timeoutMs, pollIntervalMs: 5, frozenMs });
}

async function serveText(text: string): Promise<number> {
  const server = createServer((_req, res) => res.end(text));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  closers.push(() => new Promise((resolve) => server.close(() => resolve())));
  return (server.address() as AddressInfo).port;
}

describe("CavalryBridgeClient", () => {
  it("round-trips a call through the real bridge script", async () => {
    const cavalry = await startFakeCavalry();
    closers.push(cavalry.close);
    const result = await client(cavalry.port).call<{ bridge: string }>("ping");
    expect(result.bridge).toBe("cavalry-mcp");
  });

  it("keeps concurrent calls apart", async () => {
    const cavalry = await startFakeCavalry();
    closers.push(cavalry.close);
    const c = client(cavalry.port);
    const names = ["A", "B", "C", "D", "E"];
    const created = await Promise.all(
      names.map((name) => c.call<{ name: string }>("create_primitive", { shape: "ellipse", name })),
    );
    expect(created.map((l) => l.name)).toEqual(names);
  });

  it("surfaces bridge-side failures as BridgeOperationError", async () => {
    const cavalry = await startFakeCavalry();
    closers.push(cavalry.close);
    await expect(client(cavalry.port).call("rename_layer", { layerId: "x#1", name: "y" })).rejects.toThrow(
      new BridgeOperationError("Layer 'x#1' does not exist."),
    );
  });

  it("reports an unreachable bridge", async () => {
    const port = await serveText("");
    await closers.pop()!();
    await expect(client(port).call("ping")).rejects.toBeInstanceOf(BridgeUnavailableError);
  });

  it("detects a foreign service on the port", async () => {
    const port = await serveText("<html>hello</html>");
    await expect(client(port).call("ping")).rejects.toBeInstanceOf(BridgeProtocolError);
  });

  it("detects a protocol mismatch", async () => {
    const port = await serveText(JSON.stringify({ bridge: "cavalry-mcp", protocol: 99, results: {} }));
    await expect(client(port).call("ping")).rejects.toThrow(/protocol mismatch/);
  });

  it("fails fast when Cavalry stops processing (backgrounded)", async () => {
    const cavalry = await startFakeCavalry();
    closers.push(cavalry.close);
    cavalry.setPaused(true);
    const started = Date.now();
    await expect(client(cavalry.port, 5000, 200).call("ping")).rejects.toBeInstanceOf(BridgeFrozenError);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it("skips frozen detection for long-running calls", async () => {
    const cavalry = await startFakeCavalry();
    closers.push(cavalry.close);
    cavalry.setPaused(true);
    setTimeout(() => cavalry.setPaused(false), 400);
    const result = await client(cavalry.port, 3000, 100).call<{ bridge: string }>("ping", {}, { detectFrozen: false });
    expect(result.bridge).toBe("cavalry-mcp");
  });

  it("times out when the bridge never answers", async () => {
    const port = await serveText(JSON.stringify({ bridge: "cavalry-mcp", protocol: 1, results: {} }));
    await expect(client(port, 500).call("ping")).rejects.toBeInstanceOf(BridgeTimeoutError);
  });
});
