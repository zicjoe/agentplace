# Contributing

1. Use Node.js 22+ and pnpm 10.
2. Create a focused branch and keep changes scoped.
3. Never add secrets or signing material.
4. Run `pnpm check` before opening a pull request.
5. Document new environment variables in `.env.example` and `docs/ENVIRONMENTS.md`.
6. Database changes are append-only migrations; never edit a migration already applied outside disposable local development.
7. Financial/trusted-core changes require explicit tests covering denial/failure behavior, not only success paths.
