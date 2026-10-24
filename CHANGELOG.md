# Changelog

## 0.15.0 — M12 Discover + Creator System (candidate)

- Replaced production Discover fixture truth with durable Worker/Workflow/Capability supply and runtime-readiness projection.
- Added durable creator Workers, Workflows, imported capabilities, publication lifecycle, lineage and creator test records.
- Added generic Agent Builder, real sandbox Worker tests, private install, versioned edits and public publication.
- Added durable per-Worker Agent Builder conversations, user-turn quick actions, non-terminal private save, clean New Worker behavior, and reopen/continue continuity across refreshes.
- Replaced the Agent Builder regex/keyword interpreter with AgentPlace Auto structured LLM turns, deterministic Creator-operation validation, durable turn metadata, parent-linked draft revisions and conversational undo.
- Replaced Workflow Studio's one-shot local intent template with AgentPlace Auto structured Workflow turns plus deterministic capability/Worker eligibility and mandatory no-authority safety validation; compact layouts now surface the live Draft explicitly and later conversational edits are processed rather than ignored.
- Added durable Workflow Studio creator sessions/messages and refresh-safe creator asset routes so saved Workflow transcript + Draft restore together from My creations and survive hard refresh.
- Builder discussion, edit, Teach Mode, test, save/publish intent and undo are distinct; test scenarios no longer fall through into Method / Expertise.
- Added Worker-version pinning through installations and Job assignments.
- Added real server-side OpenAPI/MCP inspection with SSRF controls and bounded read-only OpenAPI sandbox invocation.
- Kept creator imports isolated from trusted AgentPlace capability routing, with no new signer, custody, paid acquisition or Mainnet autonomy.
- OpenAPI sandbox eligibility now excludes auth-required and obvious session-mutating GET operations, resolves declared runtime bases, and surfaces upstream provider/network failures truthfully.
- Unsafe remote imports now return explicit fail-closed validation messages for credential-bearing, private/loopback, non-HTTPS and other rejected endpoints instead of a generic internal-error message; rejected URLs are blocked before fetch.

## 0.14.0 — M11 Routines + Background Work (candidate)

- Fixed the Worker Workspace **Set up a routine** control so it opens and focuses the Routine composer path instead of being a no-op placeholder.
- Added durable owner-scoped Routines, immutable Routine revisions, exactly-once RoutineRuns, service budgets and durable in-app Notifications.
- Activated `apps/scheduler` as a dedicated Railway background scheduler using PostgreSQL leases and `FOR UPDATE SKIP LOCKED`; browser timers are not part of the production Routine path.
- Added scheduled, deterministic market-condition and AgentPlace-domain event triggers with cooldown/deduplication. False conditions create no Job and require no LLM call.
- Added Routine → Job orchestration with explicit `ROUTINE` intelligence provenance so background work never fabricates a user-authored message.
- Added Run now, Pause, Resume, Stop, retry-once, Limited/Needs-you handling, durable Routine history and notification preference/read persistence.
- Added production `Make this recurring` handoff from a suitable Job to a prefilled Routine Draft; activation remains explicit.
- Kept financial authority unchanged: M11 rejects autonomous Routine execution, does not add a signer, and keeps Mainnet execution/autonomy disabled by default.

## 0.13.0 — M10 Settlement Verification + Verified Outcomes + Verified Receipts

- Added durable `VerificationContract`, `SettlementObservation`, immutable `VerifiedOutcome`, immutable `VerifiedReceipt`, and asynchronous `ProofAnchorQueue` persistence.
- Activated deterministic post-confirmation verification for direct EVM `asset.transfer` actions with zero routine LLM polling.
- Native transfers now require exact historical approval/action lineage, chain, sender, recipient, atomic value, empty calldata, successful receipt, wallet-request correspondence and receipt gas evidence.
- Supported ERC-20 transfers additionally require an allowlisted production token contract, exact `transfer(address,uint256)` calldata and matching `Transfer` event semantics.
- Added historical backfill: confirmed M9 direct transfers are eligible for M10 verification without a new wallet signature or transaction.
- Added exact EVM gas accounting from `gasUsed × effectiveGasPrice`, separated from transferred capital, external service cost and AgentPlace service cost.
- Added fail-closed `VERIFYING`, `VERIFIED`, `NOT_VERIFIED`, `UNKNOWN` and future-ready `PARTIAL` settlement states; only `VERIFIED` may create a receipt.
- Added authenticated verification/receipt APIs and production hydration of verified outcomes/receipts across browser refresh.
- Replaced the fixture-only receipt path for production transfers with a responsive Verified Receipt surface containing action lineage, economic result, transaction evidence, verification checks, costs and technical commitments.
- Added salted, domain-separated privacy-safe receipt commitments and a durable Arbitrum batch proof queue that stops at `PENDING`; no production proof signer/private key is introduced.
- Mainnet execution and Mainnet autonomy remain fail-closed by default.

## 0.12.0 — M9 Connected Wallet Execution + Transaction Observation

- Fixed M9 pre-sign RPC diagnostics so a reachable RPC that rejects `eth_estimateGas` (for example insufficient gas funds or a revert) is reported as a transaction preflight failure instead of being misreported as an RPC outage; transport/provider outages remain fail-closed and distinct.
- Fixed M9 direct-transfer preparation to derive and persist deterministic USD value-at-risk before authority evaluation (nominal USD for USDC/USDT; Chainlink onchain feeds for supported native assets), so `asset.transfer` can reach approval without weakening M7 limits.

- Fixed M9 observer TypeScript control-flow narrowing in UNKNOWN-state transitions without changing runtime safety behavior.
- Added durable idempotent `transaction_attempt` records bound to the exact prepared revision, action digest, one-time approval, account and network.
- Added exact pre-sign revalidation of preparation freshness, quote/safety state, current deterministic authority, account mode, environment gate and server-side RPC gas estimation.
- Added browser-only EIP-1193 `eth_sendTransaction`; user private keys/seed phrases never enter AgentPlace API, Worker or LLM context.
- Added deterministic Railway transaction observation with primary/secondary RPC fallback and zero LLM calls for polling.
- Added independent transaction-by-hash payload comparison before confirmation is accepted; definite mismatches become `MISMATCH`.
- Added fail-closed `UNKNOWN` handling and duplicate-signature/submission protection; AgentPlace never automatically resubmits an uncertain financial action.
- Added direct EVM transfer preparation in Manager for supported native assets and explicitly configured token contracts.
- Wired Action Review to durable signing/submission/observation progress while keeping transaction confirmation separate from `AgentPlace Verified` economic completion.
- Mainnet user-signed execution is supported only behind `MAINNET_EXECUTION_ENABLED`; the safe production default remains false and Mainnet autonomy remains disabled.
- Testnet remains available as an environment but is no longer the M9 milestone prerequisite.

 Fixed M8 Action Review responsive technical details so long unbroken identifiers such as action digests, wallet IDs, and network refs wrap within the modal instead of forcing horizontal scrolling.
- Added M8 Agent Account disambiguation and setup management: Agent Account setups can be named, renamed, and removed; Manager can select an exact setup by name and fails closed on duplicate/unknown names without substituting another wallet.
- Fixed M8 Manager account-mode selection for explicit Agent Account requests: undeployed Agent Account setups now fail closed with truthful deployment/signer messaging and can never silently fall back to a Connected Wallet.
- Fixed M8 Manager account selection so an explicit watch-only wallet request uses the user’s watch-only EVM resource instead of silently substituting a connected wallet; Action Review now labels watch-only accounts as preview-only and never presents them as signable/executable.
- Hardened the M8 LI.FI adapter so supported quotes can fall back to LI.FI token symbols, deterministically derive USDC/USDT atomic amounts, accept legacy EVM namespace aliases, and expose the exact quote-unavailable/provider-failure reason in Action Review.
- Fixed M8 exact-action approval gating so a quote/preflight-incomplete action cannot expose Approve once; approval conflicts now return a clear refresh/readiness message instead of a generic internal error.
- Fixed M8 EVM network-family normalization so bridge actions use canonical `eip155` network refs matching mandate policy, eliminating false `NETWORK_NOT_ALLOWED` denials for Arbitrum/Base mandates.
- Fixed Execution Operator Discover installation to use the durable backend worker definition `w-execution`, so Add Worker persists in the production workforce instead of being reverted after a failed install.
- Fixed a syntax error in the M8 Execution Operator Discover fixture caused by an unescaped apostrophe in the listing description.
- Fixed M8 production action preparation JSONB persistence so PostgreSQL receives explicit JSON for authority reasons, prepared payloads, risk checks, quote evidence, and simulation evidence.
- Fixed the M8 authority-test handoff by publishing Execution Operator in Discover and deep-linking contextual specialist views to the matching installable Worker listing.

- M8 production Manager bridge handoff now creates/prepares the durable action and exposes Action Review instead of falling through to the legacy read-only Router response.

## v0.11.0 — M8 Action Preparation + Action Review

- Added durable Financial Actions and immutable preparation revisions.
- Added real LI.FI quote adapter with truthful unavailable/failure states.
- Added RPC preflight, structured risk evidence, M7 Authority binding and exact-action approvals.
- Added quote refresh/revision invalidation and separate Service Cost Review persistence.
- Production Action Review now states explicitly that M8 does not sign or submit transactions.
- Added migration `0012_action_preparation_review.sql`, M8 verifier and manual testing guide.

## 0.10.0 — Milestone 7 Mandates + Authority Engine

- Added durable owner-scoped Mandates with immutable revisions and Draft/Active/Paused/Expired/Revoked lifecycle.
- Added deterministic Authority Engine decisions (`ALLOWED`, `APPROVAL_REQUIRED`, `DENIED`) over structured action envelopes with fail-closed network, capability, asset, protocol/destination, limits, validity and account-mode checks.
- Added separate capital authority, per-action limits, cumulative period budgets and service budgets plus explicit approval policies.
- Added permanent revocation guards, per-environment global autonomy pause, durable authority decisions/reasons and period-usage accounting.
- Added review-first natural-language mandate drafting; model assistance cannot activate authority or self-grant borrowing/leverage.
- Added production authority UX to Worker Workspace, Wallet/Agent Account details and Security & Authority, with authority events flowing into Activity.
- Added migration `0011_mandates_authority.sql`, M7 automated acceptance coverage and mandate-dialog viewport regression coverage.
- M7 does not add smart-account deployment, signing, session keys, arbitrary contract calls or unrestricted autonomous mainnet execution.

## 0.9.1 — M6 Viewport + Layout Hardening

- Fixed Guest Home at normal browser zoom so content never gets pushed above or below the visible workspace by full-height vertical centering.
- Made Guest Home own vertical scrolling while retaining centered composition on taller viewports through overflow-safe auto margins.
- Hardened primary route/workspace flex shells with `min-h-0` and explicit owned scroll regions so page content remains reachable inside the fixed application shell.
- Hardened Wallet, Create, Sign-in, Discover sandbox, Billing, Security and action-confirmation dialogs for short viewports with bounded height and vertical scrolling.
- Restored viewport regression coverage against `GuestHome.tsx` and added cross-surface scroll-owner assertions so later milestones cannot silently reintroduce the zoom-out requirement.
- No wallet domain, authority, execution, migration, Router, intelligence or payment behavior changed.

## 0.9.0 — Milestone 6 Wallet Foundation

- Added durable owner-scoped `wallet_resource`, `wallet_network_state` and `agent_account` persistence.
- Replaced prototype connected-wallet fixtures with real EIP-1193 browser account, chain and native-balance observations.
- Added durable EVM and Solana watch-only public-address resources.
- Added Agent Account setup records that recheck the selected browser EVM owner account, accept user-selected preferred EVM networks, enter a truthful `ready-for-deployment` lifecycle state and remain explicitly `not-deployed`; no fake account address or balance is generated.
- Added explicit watch-only network context plus durable rename/remove controls; AgentPlace never guesses an EVM chain from an address.
- Added authenticated Wallet APIs and account rehydration after sign-in/reload.
- Kept wallet connection separate from cryptographic ownership proof, Mandates, Authority Grants, signing and execution. Production/API mode cannot turn M6 wallet state into fixture financial actions. No raw private keys or seed phrases are accepted or stored.
- Telegraph M5B.2.4 paid live acceptance remains deferred and is not represented as fully live-accepted.

## 0.8.5 — M5B.2.4 Telegraph Live-Catalog Merge Compatibility

- Fixed a live-discovery merge bug where a repeated endpoint from a later Telegraph catalogue surface could overwrite the richer `input_schema`/`output_schema` already discovered for the same Miner endpoint.
- Reconciles duplicate endpoints conservatively: exact method/path matches merge metadata; method-less duplicates merge only when the path has one unambiguous counterpart; explicitly different HTTP methods remain distinct.
- Preserves the preferred live catalogue schema while filling missing endpoint metadata from complementary dispatcher/Engine discovery surfaces.
- Added no-payment semantic-mapping diagnostics to the acceptance plan so rejected mappings expose schema/network/binding readiness without sending a payment authorization.
- Added a regression test reproducing the richer-API-schema + thinner-dispatcher-duplicate condition.
- M5B.2 remains unfrozen. A real paid testnet settlement is still forbidden until the no-payment plan returns an exact router-ready candidate.

## 0.8.4 — M5B.2.4 Telegraph Live-Catalog Compatibility

- Preserved the fail-closed acceptance boundary after live discovery found zero router-ready mappings and correctly refused all paid calls.
- Added exact aliases for current Telegraph Web3 Intents that fit existing AgentPlace canonical capabilities: `CRYPTO_PRICE`, `LIQUIDITY_DEPTH_VERIFY`, `SMART_CONTRACT_AUDIT`, `TVL_LOOKUP`, and `CRYPTO_YIELD_RATE`.
- Extended live miner normalization to read `semantics.supported_intents`, nested signal mappings, on-chain minimum pricing, and top-level input/output schemas used by current catalogue representations.
- Added no-payment acceptance diagnostics for relevant live Intent availability and declared relevant miner supply.
- Did not map narrower or broader current Telegraph Intents such as `TOKEN_HOLDER_COUNT`, `ONCHAIN_METRIC_VERIFY`, transfer verification, cross-chain verification, reserve attestations, or wash-trading detection where AgentPlace does not yet have an exact canonical capability boundary.
- No user-wallet authority, unrestricted provider secrets, or automatic paid acceptance was introduced.

## 0.8.3 — M5B.2.4 Telegraph Live Acceptance Candidate

- Added a no-payment `telegraph:acceptance:plan` command that refreshes current Telegraph discovery/mapping and lists only router-ready mappings that can deterministically bind the chosen public acceptance subject.
- Updated Telegraph discovery compatibility to read the current documented `/api/miners` live catalog while retaining legacy Engine/dispatcher surfaces only as additive fallback.
- Hardened x402 resource validation for Telegraph's documented Engine-internal resource URL shape (`/v1/ask/{minerId}` without `/engine`, including the documented http/https presentation difference) while still requiring the same host and exact internal request path.
- Added an explicitly armed `telegraph:acceptance:run` command requiring two independent live-test gates, an exact planned implementation ID, the dedicated Worker-only service-payment key and a migrated database.
- The live runner permits one successful bounded testnet x402 purchase, requires a confirmed settlement transaction and normalized Telegraph evidence provenance, then verifies exact-request replay rejection and same-Job budget rejection without allowing a second settled payment.
- Added safe acceptance reporting that omits private keys, EIP-3009 signatures/nonces, raw queries and raw provider results while preserving public settlement/evidence metadata needed for review.
- Added the M5B.2.4 acceptance runbook and kept the milestone explicitly unfrozen until a real live pass is reviewed.
- No user-wallet authority, Agent Account authority, mainnet payment path, automatic top-up, provider-secret forwarding or product/UI behavior was added.

## Submission documentation + deployment record — 2026-10-04

- Reworked the root README into a judge/developer-facing product overview covering AgentPlace's Worker/Job/Router model, current provider-backed intelligence, trust boundaries, repository architecture, production deployment and honest current-vs-roadmap status.
- Recorded the deployed `AgentPlaceReceiptRegistry` address on Robinhood Chain Testnet and linked the public explorer page.
- Recorded the explorer-reported Solidity compiler, optimization posture and source-verification status without inventing unknown deployer/transaction metadata.
- Updated the receipt-registry deployment verifier and Foundry optimizer setting to match the actual deployed testnet artifact.
- No application runtime, database schema, Router, intelligence, authentication, wallet or authority behavior changed.

## Submission contract patch — Robinhood Chain Receipt Registry — 2026-10-04

- Added `AgentPlaceReceiptRegistry`, a non-custodial append-only Solidity registry for privacy-safe AgentPlace Job receipt commitments on Robinhood Chain Testnet.
- Kept full Jobs, conversations, provider evidence, user data and secrets offchain; only receipt/job/evidence hashes plus immutable anchor metadata are stored onchain.
- Added explicit anchorer authorization, duplicate/zero-hash rejection, two-step ownership transfer and no fund-transfer, proxy, upgrade, delegatecall or arbitrary-call surface.
- Added dependency-free Foundry tests, a Robinhood Chain Testnet deployment manifest, repository verification coverage and a deployment/security runbook.
- No database migration, paid service, wallet-execution authority, Router behavior or existing M5B functionality changed.


## Submission branding patch — 2026-10-04

- Replaced temporary `AP` text marks with the approved AgentPlace logo across the desktop sidebar, mobile header, Manager conversation avatar, Job Workspace and intelligence task states.
- Branded the sign-in checkpoint and Google OAuth transition window without changing authentication or authority semantics.
- Added favicon, Apple touch icon, installable web-app icons/manifest and Open Graph/Twitter share artwork for `www.agentplace.tech`.
- No Router, intelligence, Telegraph, auth, wallet, authority, migration or environment-variable behavior changed.

## 0.8.2 — M5B.2.3 Telegraph Router Integration + Bounded x402 Fallback

- Registered only live, mapping-safe Telegraph testnet implementations beneath AgentPlace Router v1; Telegraph does not replace AgentPlace planning, canonical capabilities or deterministic routing.
- Added a narrow Router trust exception for `provider=telegraph` + `invocationKind=telegraph-direct-x402` while keeping trusted existing M5B.1 implementations ordered ahead of experimental Telegraph supply.
- Added Router-ordered structured-intelligence fallback: unavailable/error evidence advances to the next eligible implementation while verified/partial evidence stops fallback.
- Added direct Telegraph service invocation through `/engine/v1/ask/{subnet_id}` so AgentPlace selects the specific service instead of delegating top-level routing to Telegraph's auto-router.
- Added a dedicated AgentPlace Base Sepolia x402 service-payment boundary using pinned test USDC and hard caps of $0.02/call, $0.10/job and 10 paid calls/job.
- Added strict x402 resource/network/asset/scheme validation, redirect rejection, EIP-3009 authorization signing, no automatic paid retry after unknown outcome, and no automatic top-up.
- Added owner/job/task-scoped `telegraph_service_payment` accounting with advisory-lock budget serialization and exact-request replay protection.
- Kept the payment key Worker-only and separate from user wallets, Agent Accounts, LLM context, provider API keys and financial authority.
- Added migration `0009_telegraph_service_payments.sql`, safe `pnpm telegraph:payment-status`, tests/verifier coverage, and deployment/security documentation.


## 0.8.1 — M5B.2.2 Telegraph Capability Mapping + Evidence Normalization

- Added deterministic Telegraph-to-AgentPlace capability mapping using an explicit semantic allowlist over existing canonical capabilities only.
- Unknown or semantically unmatched Telegraph intents/services remain unmapped; M5B.2.2 does not create new canonical capabilities.
- Added deterministic endpoint selection with fail-closed ambiguous/discovery-incomplete states rather than guessing which Telegraph endpoint satisfies a capability.
- Kept Telegraph's Base Sepolia protocol/payment network separate from the intelligence subject network; subject-network support is preserved only when discovery metadata actually declares it.
- Added Telegraph result normalization into the existing AgentPlace IntelligenceEvidence shape with explicit service, intent, environment, trust, signal, timing, warnings, result and limitation provenance.
- Exposed the existing owner-scoped intelligence evidence persistence helper for later M5B.2.3 wiring without adding a second evidence store.
- Added no Router registration, paid inference, x402 signing, wallet authority, database migration, paid dependency or UI change.

## 0.8.0 — M5B.2.1 Telegraph Adapter + Discovery

- Added a dedicated `@agent-place/telegraph` controlled-runtime package for free, read-only Telegraph testnet discovery.
- Discover Telegraph Node status, dispatcher health/integrations/live OpenAPI, and Engine miner/intent catalogs without invoking paid inference.
- Normalize service/miner metadata into a bounded discovery snapshot with explicit `experimental`, `testnet`, and `executionAuthority = none` posture.
- Treat the documented current Telegraph testnet intent-registry gap as degraded/partial state instead of inventing missing data.
- Added fail-closed tests/verifier coverage and a safe `pnpm telegraph:discover` smoke command.
- Added no Router capability mapping, IntelligenceEvidence persistence, wallet authority, signing, x402 payment, database migration, paid dependency, or UI change.

## 0.7.1 — M5B.1 Network Alias Routing Fix

- Chained verified deployer evidence into dependent wallet-activity intelligence so a Manager subject like `creator/deployer of ARB contract ...` is deterministically bound to the verified EVM creator address before provider execution.
- Surfaced all deterministic holder concentration metrics (top-1/top-5/top-10/top-20) in structured evidence summaries for Blockscout and Alchemy instead of showing only top-10.
- Hardened M5B.1 network routing: Manager structured output uses canonical network IDs, Router canonicalization accepts decorated mainnet labels such as `Arbitrum One (42161)`, explicit testnets stay distinct, and unavailable routes expose provider-specific eligibility reasons for diagnosis.
- Canonicalized common human network names before deterministic Router eligibility, including `Arbitrum One` -> `arbitrum`, so chain-aware providers are not incorrectly marked unavailable.
- Applied the same normalization inside the intelligence runtime so routed subjects resolve against the same canonical network identifiers used by capability manifests.
- Added regression coverage for display-name aliases and common chain IDs; no database migration, provider key, dependency or authority change.

## 0.7.1 — M5B.1 Zero-Cost Intelligence Hardening

- Added a free/no-cost-first intelligence path for Arbitrum/EVM and Solana without changing the M5B.1 read-only boundary.
- Upgraded Blockscout holder evidence to deterministic AgentPlace top-1/top-5/top-10/top-20 concentration calculations from raw holder balances and reported token supply.
- Added Etherscan V2 free-tier routing for EVM contract creator/deployer evidence and bounded wallet activity.
- Added Alchemy free-tier routing for multichain wallet profiles, Solana holder concentration and Solana wallet activity.
- Added a schema-pinned The Graph connector for Uniswap V3 on Arbitrum, activated only when both a Graph API key and explicit subgraph ID are configured.
- Evaluated Chainbase for later Data Cloud adapters; it is deliberately not a default runtime dependency because useful queries require schema/query-specific IDs.
- Kept Nansen, GoPlus, Birdeye, Bubblemaps and CoinGecko as optional enrichments rather than production prerequisites.
- No signing, wallet authority, trading, bridge execution, custody or paid-provider requirement was added.

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

### M9 transfer capability alignment

- Added the missing canonical `asset.transfer` capability so it appears in Mandate/Authority editing.
- Aligned M9 direct-transfer preparation with the Execution Operator worker contract, which already uses `asset.transfer`.
- Added migration `0014_transfer_capability_alignment.sql`; no custody/signing behavior changed.
