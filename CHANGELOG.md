# Changelog

## 0.7.0 — Milestone 5B.1 Core Crypto Intelligence Fabric

- Added provider-backed read-only crypto intelligence behind canonical Router capabilities.
- Added durable owner-scoped `intelligence_evidence` provenance with provider, implementation, subject, network/address, timestamps, normalized data, derivation metadata and limitations.
- Added direct adapters for CoinGecko, DEX Screener, Nansen, GoPlus, Birdeye, Bubblemaps, DefiLlama and Blockscout.
- Corrected GoPlus authentication to support console-issued app key/app secret credentials and automatically mint/refresh expiring bearer tokens server-side; static bearer tokens remain an optional override.
- Added token market/liquidity/holders/deployer/security, wallet profile/performance/activity, Smart Money, protocol/DeFi and stablecoin capability families.
- Added bounded AgentPlace-derived Smart Money accumulation from preserved provider evidence without creating a proprietary Smart Money score.
- Kept wallet clustering experimental/test-only and prohibited ownership inference from related-wallet/cluster evidence.
- Fed structured provider evidence into the existing grounded research synthesis and exposed it progressively in Job Workspace.
- Added no wallet authority, signing, trading, bridging or autonomous capital movement.

## 0.6.0 — Production Milestone 5 Router v1

- Added durable Route Decisions linking intelligence tasks to validated Worker/capability/provider routing state.
- Added deterministic capability eligibility across lifecycle, effect, environment, network, provider configuration, trust and health.
- Added Worker/capability compatibility and deterministic lead/support selection/validation, including minimal specialist completion of uncovered requirements.
- Added capability implementation priority, enablement and environment-eligibility metadata.
- Added explicit-provider preservation and bounded fallback for AgentPlace Auto hosted web research.
- Added progressive Job Workspace route disclosure without exposing financial authority.
- Wired the M4 Research Coverage Contract to deterministic route availability rather than model claims alone.
- Preserved the M5 read-only boundary; write/economic-write capabilities remain blocked.

## 0.5.0 — Milestone 4 research coverage contract

- Added explicit per-Job research requirements so Manager planning preserves every material dimension of the user's request.
- Kept the original request and Job goal authoritative alongside optimized search wording.
- Added a required research `Coverage` table with truthful verified/partial/unverified statuses.
- Added a bounded no-new-research coverage correction pass and deterministic safe fallback before `Research complete`.
- Recorded requested/non-live capability context in ModelRun provenance without making planned capabilities executable.
- Scheduled Milestone 5B for real provider-backed read-only crypto intelligence after Router v1.

## v0.5.0 — M4 Job-to-Worker cross-link correction (acceptance pending)

- Make Lead and Supporting Worker references in Job Workspace explicitly navigable.
- Allow a Job-used first-party specialist to open in a contextual Worker Workspace even when the user has not added that Worker to their persistent workforce.
- Keep contextual Worker views read-only with respect to workforce membership and financial authority; adding a Worker remains a separate Discover action.
- Show the Worker’s related Jobs and provide a direct return to the same authoritative Job Workspace.
- No database migration, new dependency, new paid service or authority change. M4 remains open pending live acceptance.

## v0.5.0 — M4 conversation-history grouping correction (acceptance pending)

- Display one primary Manager thread for each research request; retain the linked Job conversation in PostgreSQL and open it from the Job Workspace rather than as a duplicate sidebar entry.
- Preserve Job discussion retrieval through Search, label Job search results and direct them to the authoritative Job Workspace. Legacy Job-conversation URLs redirect to the Job route.
- Give new Manager threads a useful first-prompt title and display meaningful fallback titles for older generic threads, without overwriting manual titles or changing historical messages.
- No migration, deletions, new service, new dependency or financial authority change. M4 remains open pending live acceptance.

## v0.5.0 — Hybrid research presentation refinement (acceptance pending)

- Added saved-answer excerpts and expandable inline research cards in Manager and Job conversations, with direct access to the existing Job Result.
- Added a navigable full report and structured persisted source references; corrected display-only malformed emphasis and initial Job conversation scrolling.
- Made Job progress and stage labels readable at normal zoom while preserving detailed underlying stage state.
- No new backend state, database migration, dependency, credentials or execution authority. M4 remains open.

## v0.5.0 — Milestone 4 production corrections (acceptance pending)

- Render live, owner-scoped Job references inside persisted Manager messages and cross-link Job/Worker/Activity/conversations.
- Scope conversation scrolling to the owned panel, fix global visible-viewport sizing and responsive shell constraints.
- Render research Markdown tables, source links and Job Result safely without untrusted HTML.
- Preserve source and research output truth; fix Activity research label and stale cross-account work refresh.
- No schema migration, service dependency or provider configuration changes.


## 0.5.0 — Production Milestone 4
- Fixed fresh-conversation first-message path: authenticated Home now persists the conversation, queues its first real intelligence task, and preserves the selected model before navigation; guest mode alone retains preview replies.
- Serialized per-conversation writes and protected optimistic messages from stale background refreshes; first-message task status now appears inline even before the queue response arrives.
- Restored in-conversation AI processing UX while preserving truthful durable task state, retries, failures, and provider diagnostics.
- M4 production diagnostic hotfix: show real queued/running/completed/failed task state in Manager/Worker/Job conversations, visibly label guest preview, log Worker task claims/completions, and stop claiming exhausted tasks will retry.
- Corrected M4 provider model defaults to current valid IDs: Gemini 3.5 Flash-Lite / 3.8 Flash and Claude Haiku 4.5 / Sonnet 5 / Opus 5.
- Added Anthropic Claude as a first-class Model Gateway provider, including model selection, structured output, hosted web research, usage telemetry, and server-side secret handling.
- Refreshed default OpenAI API model aliases to the current GPT-6 Luna/Sol/Astra family while preserving environment overrides.

- Added canonical Capability Registry and provider implementation metadata.
- Added provider-neutral OpenAI/Gemini Model Gateway with AgentPlace Auto and user model selection.
- Added durable PostgreSQL intelligence tasks, Railway Worker runtime, grounded web research, source evidence, model provenance and AI usage limits.
- Replaced Milestone 3 production placeholder responses in Manager, Worker and Job conversations with the real intelligence submission path.
- Financial authority and execution remain disabled and separated from model reasoning.


## 0.4.0 — Production Milestone 3

- Added versioned Worker Definitions, Worker Versions and Job Contracts.
- Seeded the first-party AgentPlace Originals as real catalog records.
- Added per-user persistent Worker installations with truthful operational state and no implicit financial authority.
- Added durable Jobs, stages and Lead/Supporting Worker relationships.
- Added persistent Worker and Job Conversations linked to durable objects.
- Added factual domain events and Activity projection instead of a competing activity state store.
- Added authenticated Worker, Job, catalog and Activity APIs with owner isolation.
- Preserved prototype financial/execution branches outside the Milestone 3 durable write path.
- Reconciled the production roadmap so M4 is Capability Standard + Intelligence Foundation and M5 is Router v1.

## 0.3.0 — Production Milestone 2

- Build hotfix 2: make repository lint platform-independent and add regression coverage for prohibited source patterns.

- Added self-hosted Better Auth with Railway/PostgreSQL-compatible storage.
- Added Google OAuth and SIWE wallet identity without granting execution authority.
- Added durable conversation/message/participant/object-link persistence.
- Added guest-to-account migration, account-backed rename/pin/archive/continuation, and PostgreSQL fuzzy search.
- Added first-party-cookie-safe local/Vercel API proxying for a Railway backend.
- Preserved Mainnet execution/autonomy off defaults and introduced no financial writes.

## 0.2.0 — Production Milestone 1

- Integrated the approved AgentPlace UX Baseline v1 into the real web runtime.
- Added production URL/deep-link foundations and route hydration.
- Isolated prototype fixtures/timers behind a production-facing state facade.
- Added versioned local fixture persistence for refresh-safe Milestone 1 testing.
- Gated hidden Demo Controls behind an explicit public development flag.
- Added a typed frontend/runtime API boundary and real API health/public-config endpoints.
- Added CORS allowlisting, updated environment documentation and preserved Mainnet-off safety defaults.
- Added deterministic milestone verification and reproducible dependency-lock expectations.

## 0.1.0 — Milestone 0

- Established the AgentPlace pnpm/TypeScript monorepo.
- Added environment safety contracts with Mainnet execution/autonomy disabled by default.
- Added PostgreSQL audit/outbox foundation.
- Added trace/request ID and structured log contracts.
- Added CI, CodeQL, dependency review, Dependabot and repository secret guards.
- Added public architecture/security/environment documentation while keeping the internal master specification outside the repository.
