# Security boundaries

Milestone 0 establishes boundaries before financial execution exists.

1. The application API is **not** the future secure signer.
2. LLMs and external capabilities are untrusted inputs, never final authorization authorities.
3. Mainnet writes/autonomy default to off.
4. Secret-bearing files are ignored and rejected by repository verification.
5. Audit records and transactional outbox events carry trace IDs.
6. Signing material must later live behind an isolated signer/KMS/HSM/MPC/passkey/smart-account boundary.
7. Creator code and provider responses will never directly receive unrestricted user signing authority.
8. Onchain receipt anchoring will be asynchronous unless the onchain action itself is required to complete the user's job.

## Milestone 6 Wallet Foundation

- Wallet connection stores public account/network observations only; it is not a financial authorization event.
- Watch-only resources never contain signing material.
- Agent Account setup is durable metadata until a later gated deployment path creates a real account.
- No raw private key, seed phrase or recovery secret belongs in the web app, API payloads, database, logs, Worker context or LLM context.
- A browser wallet remains the user's signer. M6 does not create delegated or autonomous execution authority.

## Milestone 7 Mandates + Authority Engine

- Default authority is none. Worker creation, wallet connection, Agent Account existence/funding and Routine creation do not grant Worker financial power.
- Mandates are structured, owner-scoped and versioned. Historical revisions are immutable; revoked mandates cannot silently resurrect.
- The deterministic Authority Engine evaluates structured action envelopes. LLM/model prose is not an authority source and cannot override hard rules.
- Missing, expired, paused, revoked or scope-mismatched authority fails closed.
- ACT_WITHIN_MANDATE activation is restricted to Agent Accounts in M7 and requires explicit assets, networks/capabilities, per-action limit, period budget and expiry. Drafts remain non-authoritative until deliberately activated.
- Service budget, capital authority, per-action limit and period budget remain separate concepts.
- Mainnet autonomy remains behind the production runtime safety gate even if a mandate is otherwise valid.
- M7 stores no private keys, seed phrases, signing secrets or session keys and adds no arbitrary signer/contract-call path.
- Every authority evaluation is durably recorded with structured reasons; authority/mandate lifecycle facts project into Activity.
