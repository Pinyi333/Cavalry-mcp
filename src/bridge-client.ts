import { randomUUID } from "node:crypto";

/** The protocol version this client speaks; must match the bridge script. */
export const PROTOCOL_VERSION = 1;

export interface BridgeClientOptions {
  host: string;
  port: number;
  timeoutMs: number;
  pollIntervalMs: number;
  /** Injectable for tests. Defaults to the global fetch. */
  fetch?: typeof fetch;
}

interface BridgeSnapshot {
  bridge?: string;
  protocol?: number;
  results?: Record<string, BridgeResult | undefined>;
}

type BridgeResult = { ok: true; result: unknown } | { ok: false; error: string };

/** Base class for every error raised while talking to Cavalry. */
export class BridgeError extends Error {
  override name = "BridgeError";
}

/** The bridge could not be reached at all (Cavalry closed, bridge not started, wrong port). */
export class BridgeUnavailableError extends BridgeError {
  override name = "BridgeUnavailableError";
}

/** The bridge accepted the request but did not answer in time. */
export class BridgeTimeoutError extends BridgeError {
  override name = "BridgeTimeoutError";
}

/** Cavalry ran the operation and reported a failure. */
export class BridgeOperationError extends BridgeError {
  override name = "BridgeOperationError";
}

/** Something answered on the port, but it is not a compatible cavalry-mcp bridge. */
export class BridgeProtocolError extends BridgeError {
  override name = "BridgeProtocolError";
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Talks to `bridge/cavalry-mcp-bridge.js` running inside Cavalry.
 *
 * Cavalry's WebServer queues POST bodies and serves a single shared text on
 * GET, so each call posts `{id, op, args}` and then polls /get until the
 * result for that id shows up.
 */
export class CavalryBridgeClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: BridgeClientOptions) {
    const host = options.host.includes(":") && !options.host.startsWith("[") ? `[${options.host}]` : options.host;
    this.baseUrl = `http://${host}:${options.port}`;
    this.fetchImpl = options.fetch ?? fetch;
  }

  get endpoint(): string {
    return this.baseUrl;
  }

  async call<T = unknown>(op: string, args: Record<string, unknown> = {}): Promise<T> {
    const id = randomUUID();
    const deadline = Date.now() + this.options.timeoutMs;

    await this.request("/post", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ id, op, args }),
    });

    for (;;) {
      const snapshot = await this.readSnapshot();
      const result = snapshot.results?.[id];
      if (result) {
        if (result.ok) return result.result as T;
        throw new BridgeOperationError(result.error);
      }
      if (Date.now() >= deadline) {
        throw new BridgeTimeoutError(
          `Cavalry did not answer "${op}" within ${this.options.timeoutMs} ms. ` +
            "Keep the Cavalry window in the foreground (background windows pause script callbacks) " +
            "and make sure the long-running operation has finished.",
        );
      }
      await sleep(this.options.pollIntervalMs);
    }
  }

  private async readSnapshot(): Promise<BridgeSnapshot> {
    const response = await this.request("/get", { method: "GET" });
    const text = await response.text();
    let snapshot: BridgeSnapshot;
    try {
      snapshot = JSON.parse(text) as BridgeSnapshot;
    } catch {
      throw new BridgeProtocolError(
        `The service on ${this.baseUrl} is not the cavalry-mcp bridge (non-JSON response). ` +
          "Check that CAVALRY_MCP_PORT matches CONFIG.port in cavalry-mcp-bridge.js.",
      );
    }
    if (snapshot.bridge !== "cavalry-mcp") {
      throw new BridgeProtocolError(`The service on ${this.baseUrl} is not the cavalry-mcp bridge.`);
    }
    if (snapshot.protocol !== PROTOCOL_VERSION) {
      throw new BridgeProtocolError(
        `Bridge protocol mismatch: server speaks v${PROTOCOL_VERSION}, bridge speaks v${String(snapshot.protocol)}. ` +
          "Copy the cavalry-mcp-bridge.js that ships with this server version into Cavalry.",
      );
    }
    return snapshot;
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, init);
    } catch (cause) {
      throw new BridgeUnavailableError(
        `Cannot reach the Cavalry bridge at ${this.baseUrl}. ` +
          "Open Cavalry, run Window > Scripts > cavalry-mcp-bridge, and check that the ports match.",
        { cause },
      );
    }
    if (!response.ok) {
      throw new BridgeProtocolError(`The Cavalry bridge answered ${path} with HTTP ${response.status}.`);
    }
    return response;
  }
}
