# Milestone 5B.2.1 deployment

M5B.2.1 is a normal additive AgentPlace deployment.

1. Run `pnpm check` locally.
2. Commit and push the accepted replacement repository.
3. Railway's established API pre-deploy hook runs `pnpm migrate`, applying `0009_telegraph_live_discovery.sql` automatically.
4. Configure the Worker-only Telegraph discovery variables documented in `.env.example`.
5. Redeploy/restart the Worker and verify the live discovery log.

There is no manual migration command for the normal production flow.

The discovery adapter defaults to Telegraph's current live public node but remains configuration-driven. When Telegraph Mainnet becomes publicly available, promotion must be a deliberate provider/environment decision and must not silently reuse testnet service-spend configuration.
