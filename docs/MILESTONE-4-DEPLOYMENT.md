# Milestone 4 Deployment — Railway + Vercel

## Database

The existing API pre-deploy command remains:

```text
pnpm migrate
```

It applies `0004_intelligence_capabilities.sql`.

## API service

Build command:

```text
pnpm build:api
```

Start command:

```text
pnpm --filter @agent-place/api start
```

The API needs the existing auth/database variables plus the same AI provider configuration used by the Worker so it can expose only configured model choices.

## Worker service

Milestone 4 is the first milestone that requires the Railway Worker service to run continuously.

Build command:

```text
pnpm build:worker
```

Start command:

```text
pnpm --filter @agent-place/worker start
```

Minimum Worker variables:

```text
DATABASE_URL=${{Postgres.DATABASE_URL}}
DATABASE_POOL_MAX=10
AGENTPLACE_DEFAULT_MODEL_PROVIDER=gemini
GEMINI_API_KEY=<secret>
```

To enable OpenAI choices too:

```text
OPENAI_API_KEY=<secret>
```

Do not expose provider keys to Vercel or to variables beginning with `VITE_`.

## Recommended M4 limits

```text
AI_MODEL_TIMEOUT_MS=90000
AI_MAX_OUTPUT_TOKENS=2500
AI_MAX_CALLS_PER_TASK=3
AI_DAILY_COST_LIMIT_USD=0
AI_WORKER_POLL_MS=1500
```

`AI_DAILY_COST_LIMIT_USD=0` means disabled. Before enabling production traffic, set an intentional non-zero ceiling after configuring current provider cost rates if you want cost-based enforcement.

Cost-rate variables are telemetry inputs and should be updated when provider pricing changes:

```text
GEMINI_INPUT_USD_PER_MILLION=0
GEMINI_OUTPUT_USD_PER_MILLION=0
OPENAI_INPUT_USD_PER_MILLION=0
OPENAI_OUTPUT_USD_PER_MILLION=0
```

## Vercel

No provider secret is required on Vercel. Keep the existing `/api` rewrite to Railway. A normal Git deployment is sufficient after the API/Worker/database are ready.
