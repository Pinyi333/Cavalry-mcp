# Project instructions for Claude

## Git conventions

- **Branch names must be semantic:** `<type>/<short-kebab-description>`, e.g. `feat/render-queue-tools`,
  `fix/bridge-timeout-message`, `docs/readme-update`. Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`,
  `perf`. Do not use auto-generated or session-id branch names; if the environment assigns one, rename it before pushing.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat: …`, `fix: …`).
- Never commit secrets, tokens, `.env` files or personal absolute paths — this is a public open-source repo.

## Before pushing

Run `npm run check` (typecheck, lint, format check, tests) and make sure it passes.

## Docs

User-facing changes must update both `README.md` (English) and `README.zh-TW.md` (Traditional Chinese), plus
`CHANGELOG.md` and, for bridge operations, `docs/protocol.md`.
