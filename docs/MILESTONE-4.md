# AgentPlace Production Milestone 4 — Capability Standard + Intelligence Foundation

Version: **0.5.0**

Milestone 4 makes AgentPlace's intelligence layer real without introducing financial execution.

## Delivered

- Canonical Capability Registry with provider-neutral capability IDs and implementation metadata.
- Initial live read-only Research Pack: `research.web.search`, `research.web.read`, `research.source.extract`.
- Planned capability vocabulary for later wallet/onchain/action milestones without falsely marking it available.
- Provider-neutral Model Gateway with OpenAI and Gemini adapters.
- AgentPlace Auto as the default model-selection mode.
- User-selectable configured models in Manager, Worker and Job conversation composers.
- Per-conversation model preference persistence.
- Structured Manager planning through schema-constrained model output.
- Specialist Worker research through grounded provider web search.
- Durable PostgreSQL intelligence task queue with leasing and retry.
- Railway Worker runtime for browser-independent AI work.
- Source/evidence persistence per Job.
- ModelRun provenance, token usage, latency and optional estimated-cost telemetry.
- Context assembly that is scoped to the current user, conversation, Worker and Job.
- AI timeout, per-task call ceiling, daily estimated-cost ceiling and bounded context/output.
- Prompt-injection trust boundary: web content is evidence, never authority.

## Explicit boundaries

Milestone 4 does **not** add connected wallet state, Agent Accounts, Mandates, transaction signing, swap/bridge execution, autonomous financial authority, or AgentPlace Verified economic outcomes.

The Model Gateway is untrusted reasoning infrastructure. Deterministic authority and execution remain later milestones.

## Provider architecture

The server-side environment may configure Gemini, OpenAI, or both. API keys stay on Railway services and must never be exposed as `VITE_*` variables.

`AgentPlace Auto` chooses the configured default provider. Explicit conversation-level selections are persisted and respected. A missing explicit provider fails clearly rather than silently switching providers.

## Runtime flow

1. Browser persists the user's message.
2. API validates identity, conversation ownership and model preference.
3. API enqueues a durable `intelligence_task`.
4. Railway Worker claims the task with a lease.
5. Manager planning or Worker reasoning occurs through the Model Gateway.
6. Research uses the live read-only web capability.
7. Sources and ModelRun provenance are persisted.
8. Job/Conversation/Activity state is updated in PostgreSQL.
9. Web periodically rehydrates durable state; browser closure does not cancel the Job.
