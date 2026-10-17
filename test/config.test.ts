import { describe, expect, it } from "vitest";
import { ConfigError, DEFAULT_CONFIG, isLoopbackHost, loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("uses defaults when nothing is set", () => {
    expect(loadConfig({})).toEqual(DEFAULT_CONFIG);
  });

  it("reads every variable", () => {
    expect(
      loadConfig({
        CAVALRY_MCP_HOST: "localhost",
        CAVALRY_MCP_PORT: "9000",
        CAVALRY_MCP_TIMEOUT_MS: "2000",
        CAVALRY_MCP_POLL_INTERVAL_MS: "10",
        CAVALRY_MCP_FROZEN_MS: "0",
        CAVALRY_MCP_ALLOW_SCRIPT: "true",
      }),
    ).toEqual({ host: "localhost", port: 9000, timeoutMs: 2000, pollIntervalMs: 10, frozenMs: 0, allowScript: true });
  });

  it.each([["0"], ["70000"], ["abc"], ["80.5"]])("rejects port %s", (port) => {
    expect(() => loadConfig({ CAVALRY_MCP_PORT: port })).toThrow(ConfigError);
  });

  it("rejects an unrecognised boolean", () => {
    expect(() => loadConfig({ CAVALRY_MCP_ALLOW_SCRIPT: "maybe" })).toThrow(ConfigError);
  });

  it("treats blank values as unset", () => {
    expect(loadConfig({ CAVALRY_MCP_PORT: " ", CAVALRY_MCP_HOST: "" })).toEqual(DEFAULT_CONFIG);
  });
});

describe("isLoopbackHost", () => {
  it.each([
    ["127.0.0.1", true],
    ["localhost", true],
    ["::1", true],
    ["0.0.0.0", false],
    ["192.168.1.20", false],
  ])("%s -> %s", (host, expected) => {
    expect(isLoopbackHost(host)).toBe(expected);
  });
});
