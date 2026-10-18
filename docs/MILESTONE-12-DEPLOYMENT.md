# M12 Deployment — AgentPlace v0.15.0

## Order

1. Railway API — apply additive migration `0017_discover_creator_system.sql`.
2. Railway Worker — redeploy so Job routing/execution honors exact Worker-version assignments.
3. Railway Scheduler — normal redeploy; M12 does not change its signer/custody posture.
4. Vercel Web.

## Environment

No new signing credential or wallet secret is required.

Keep:

```text
MAINNET_EXECUTION_ENABLED=false
MAINNET_AUTONOMY_ENABLED=false
```

Capability Studio remote inspection uses outbound HTTPS from the API. Do not add provider secrets for creator imports in M12.

## Rollout checks

- migration completes without mutating historical Worker versions;
- existing installed Workers remain visible and pinned;
- API `/api/v1/discover` works for guest/public reads;
- creator endpoints remain authenticated/owner-scoped;
- Worker and Scheduler start normally;
- production Discover does not fall back to fixture supply in API mode;
- no paid-acquisition or creator-payout path is enabled.
