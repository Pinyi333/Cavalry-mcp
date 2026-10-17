# Security Policy

## Supported versions

Only the latest release receives security fixes.

## Threat model

- The bridge listens on `127.0.0.1` and **has no authentication**. Any local process can send it commands. This is a
  known limitation; see the roadmap for an optional shared-secret token.
- Arbitrary JavaScript execution (`run_script`) is disabled by default on **both** the server
  (`CAVALRY_MCP_ALLOW_SCRIPT`) and the bridge (`CONFIG.allowScript`).
- The project makes no outbound network requests and stores no credentials or telemetry.

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Instead, report privately through
[GitHub Security Advisories](https://github.com/Pinyi333/cavalry-mcp/security/advisories/new).

Include a description, reproduction steps, affected versions and the impact you expect. You should receive an initial
response within 7 days. Once a fix is released, we will credit you in the advisory unless you ask us not to.
