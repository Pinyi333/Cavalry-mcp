/** Runtime configuration, read from environment variables. */
export interface Config {
  /** Host the Cavalry bridge listens on. */
  host: string;
  /** Port the Cavalry bridge listens on. */
  port: number;
  /** Maximum time to wait for Cavalry to answer a single request. */
  timeoutMs: number;
  /** Delay between polls of the bridge's /get endpoint. */
  pollIntervalMs: number;
  /** Whether the `cavalry_run_script` tool is registered. */
  allowScript: boolean;
}

export const DEFAULT_CONFIG: Config = {
  host: "127.0.0.1",
  port: 37650,
  timeoutMs: 15_000,
  pollIntervalMs: 40,
  allowScript: false,
};

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

export class ConfigError extends Error {
  override name = "ConfigError";
}

function parseInteger(name: string, raw: string | undefined, fallback: number, min: number, max: number): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new ConfigError(`${name} must be an integer between ${min} and ${max} (got "${raw}").`);
  }
  return value;
}

function parseBoolean(name: string, raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined || raw.trim() === "") return fallback;
  const normalised = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalised)) return true;
  if (["0", "false", "no", "off"].includes(normalised)) return false;
  throw new ConfigError(`${name} must be a boolean such as "true" or "false" (got "${raw}").`);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    host: env.CAVALRY_MCP_HOST?.trim() || DEFAULT_CONFIG.host,
    port: parseInteger("CAVALRY_MCP_PORT", env.CAVALRY_MCP_PORT, DEFAULT_CONFIG.port, 1, 65_535),
    timeoutMs: parseInteger(
      "CAVALRY_MCP_TIMEOUT_MS",
      env.CAVALRY_MCP_TIMEOUT_MS,
      DEFAULT_CONFIG.timeoutMs,
      500,
      600_000,
    ),
    pollIntervalMs: parseInteger(
      "CAVALRY_MCP_POLL_INTERVAL_MS",
      env.CAVALRY_MCP_POLL_INTERVAL_MS,
      DEFAULT_CONFIG.pollIntervalMs,
      5,
      5_000,
    ),
    allowScript: parseBoolean("CAVALRY_MCP_ALLOW_SCRIPT", env.CAVALRY_MCP_ALLOW_SCRIPT, DEFAULT_CONFIG.allowScript),
  };
}

export function isLoopbackHost(host: string): boolean {
  return LOOPBACK_HOSTS.has(host.toLowerCase());
}
