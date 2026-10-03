# Environment contract

AgentPlace deliberately separates experimentation from real-money execution.

| Environment | Testnet execution | Mainnet reads | Mainnet writes | Mainnet autonomy |
| --- | --- | --- | --- | --- |
| `development` | allowed when configured | allowed when configured | off | off |
| `testnet` | allowed | optional | off | off |
| `staging-mainnet-readonly` | optional | allowed | **forbidden** | **forbidden** |
| `production-mainnet` | optional | allowed | explicit opt-in only | separate explicit opt-in + future policy gate |

`MAINNET_EXECUTION_ENABLED=false` and `MAINNET_AUTONOMY_ENABLED=false` are safe defaults. Enabling autonomy without Mainnet execution is invalid. The read-only staging environment rejects Mainnet execution even if somebody attempts to set the flag.

## Milestone 1 browser configuration

The following values are safe browser-visible configuration, not secrets:

- `VITE_AGENT_PLACE_API_BASE_URL`
- `VITE_AGENT_PLACE_DATA_MODE`
- `VITE_AGENT_PLACE_ENABLE_DEMO_CONTROLS`
- `VITE_AGENT_PLACE_PERSIST_FIXTURES`

Anything prefixed with `VITE_` is compiled into or visible to browser code. Never place credentials, RPC secrets, signing material or private user data in those variables.

Milestone 1 uses `fixtures` data mode to preserve the approved Figma UX while production services are built. Fixture state is local browser test state only and must not be interpreted as authoritative balances, permissions or execution history.

Network RPCs and credentials are injected through deployment/local secret stores. No private key, seed phrase, service API key or signing material belongs in ordinary environment example files, Worker memory or LLM context.

A capability being Testnet-verified does not make it Mainnet-autonomy-eligible. Those statuses remain separate registry decisions in later milestones.


## Milestone 2 identity/data configuration

Production data mode is `api`. Better Auth uses `BETTER_AUTH_URL` as the public web origin and the web app keeps `/api/auth` same-origin through the local Vite proxy or the Vercel proxy. Railway hosts the core API/PostgreSQL path. `AGENT_PLACE_API_ORIGIN` belongs only in the Vercel server environment and must not be exposed as a `VITE_*` secret. Mainnet execution/autonomy remain disabled.
