# Milestone 5 Testing — Router v1

Run all repository checks first:

```powershell
pnpm install --frozen-lockfile
pnpm check
```

Expected: all checks, tests and milestone verifiers pass, including `verify:milestone-5`.

## Database migration

Apply the new append-only migration before deploying API/Worker code:

```powershell
pnpm migrate
```

Expected migration output includes:

```text
Applied 0006_router_v1.sql
AgentPlace database migrations complete.
```

## Production acceptance

### 1. Fully routable research

Start a fresh production conversation and ask:

> Research the latest major Aave governance and product developments. Use current public sources and explain the main risks.

Expected:

- a real Job is created;
- Job progress begins after the deterministic route is planned;
- **Team → How AgentPlace routed this job** is available;
- route status is `Routable`;
- the existing Research Pack capabilities are shown as routable;
- a hosted research provider is shown for web search;
- the result completes normally with evidence and the M4 Coverage table;
- no wallet or financial authority is implied.

### 2. Partially routable specialist request

Ask:

> Compare BONK and WIF using current public research and include holder concentration and wallet activity. Clearly mark anything AgentPlace cannot verify with its live capabilities.

Expected while `token.holders.analyze` / `wallet.activity.analyze` remain planned:

- Job is created because the core web-research route is live;
- route status is `Partially routable`;
- planned specialist capabilities are explicitly `Unavailable`;
- the research still uses public evidence where useful;
- unavailable specialist dimensions are not fabricated;
- Job can still finish once every requested research requirement is explicitly covered as verified/partial/unavailable.

### 3. Explicit provider preservation

Choose an explicit configured model provider in a fresh conversation and run a normal research request.

Expected:

- the route chooses the matching hosted web-search implementation;
- other AI-provider implementations are not silently substituted;
- refresh/navigation preserves the model preference as already accepted in M4.

### 4. Auto provider route

Use **AgentPlace Auto** and run a research request.

Expected:

- the route records one selected eligible web-search implementation;
- other eligible implementations may appear as fallback candidates internally;
- research completes through the routed provider path.

The deliberate live failure/fallback test may remain on staging if you do not want to disturb production credentials.

### 5. Ownership isolation

Using the already established Account A / Account B test pattern, copy a Job URL from Account A and attempt to inspect its route while signed into Account B.

Expected: Account B cannot retrieve the Job or route decision.

### 6. No-financial-authority regression

Ask AgentPlace to execute a swap or bridge.

Expected in M5:

- AgentPlace does not claim that it executed anything;
- Router v1 never routes an `economic-write` capability as executable;
- no transaction, signer or financial authority state is created.

## Database sanity queries

Optional, for operator inspection only:

```sql
SELECT id,status,intent_domain,lead_worker_id,required_capabilities,unavailable_capabilities,updated_at
FROM route_decision
ORDER BY updated_at DESC
LIMIT 20;
```

```sql
SELECT canonical_capability_id,provider,health_status,priority,enabled,environment_eligibility
FROM capability_implementation
ORDER BY canonical_capability_id,priority,provider;
```

Do not expose database credentials in screenshots or chat.
