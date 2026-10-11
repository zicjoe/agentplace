# Milestone 7 — Mandates + Authority Engine

**Candidate version:** AgentPlace v0.10.0
**Status:** implementation candidate; not frozen until `pnpm check` and manual acceptance pass.

## Purpose

M7 answers one production question deterministically: **what exactly is this Worker allowed to do?**

The authority chain is:

`User → Wallet / Agent Account → Mandate → Authority Engine → Worker proposal → ALLOWED / APPROVAL_REQUIRED / DENIED`

Default authority = none. Creating a Worker, connecting a wallet, creating/funding an Agent Account, adding a Routine, approving one action, or receiving model output does not create standing financial authority.

## Durable model

Migration `0011_mandates_authority.sql` adds:

- `mandate` — owner-scoped stable identity and lifecycle (`DRAFT`, `ACTIVE`, `PAUSED`, `EXPIRED`, `REVOKED`).
- `mandate_revision` — immutable structured policy snapshots. Important edits create a new revision; old policy is retained.
- `authority_control_state` — per-owner, per-environment global autonomy pause.
- `authority_decision` — durable machine-readable decision, exact action envelope, reason codes and reason evidence.
- `authority_budget_usage` — cumulative financial usage linked to an allowed decision for period-budget accounting; usage recording rechecks current active revision and period capacity under a mandate lock.

Revoked mandates cannot be resurrected by status change or revision. Active policy is also guarded at the database boundary so an ACT draft cannot be activated without its required Agent Account, explicit asset scope, hard limits and expiry. A later delegation after revocation requires a new mandate.

## Authority levels

### OBSERVE

Can authorize read/monitor/research operations only. A write capability cannot be disguised as observation. No financial execution.

### PREPARE

Can authorize preparation/route/quote work inside the mandate. `EXECUTE` still returns `APPROVAL_REQUIRED`.

### ACT_WITHIN_MANDATE

Represents standing delegated authority, but M7 intentionally does **not** add signer or transaction execution infrastructure. Activation is constrained to an Agent Account and requires:

- at least one canonical capability;
- at least one network;
- explicit asset allow-list;
- positive per-action hard limit;
- positive day/week/month financial period budget;
- expiration;
- explicit approval policy.

Mainnet autonomous use remains separately gated by the existing runtime environment contract.

## Deterministic evaluation

`evaluateAuthorityPolicy()` is model-independent and fail-closed. It evaluates the structured Action Envelope against:

- mandate presence, owner binding, status and validity window;
- canonical capability existence and operation/effect compatibility;
- Worker/account/environment binding;
- allowed network;
- asset/protocol/destination policy;
- borrowing/leverage restrictions;
- capital ceiling;
- per-action hard limit;
- cumulative period budget;
- account mode;
- approval policy;
- global autonomy pause;
- mainnet autonomy safety gate.

The LLM never receives a path to change the result. Natural-language mandate assistance produces only a structured draft. Borrowing and leverage default closed unless explicitly permitted, and the user must review/save the structured policy.

## Budget separation

M7 keeps these concepts distinct:

- **Service budget** — model/API/data/provider spending.
- **Capital authority** — maximum user capital within the authority envelope.
- **Transaction limit** — hard maximum single financial action.
- **Period budget** — cumulative financial usage for day/week/month.

Service budget is never interpreted as permission to move user capital.

## UX

M7 makes the same durable authority visible from multiple projections without creating competing stores:

- **Worker Workspace:** current level, account, network scope, hard limit, edit, pause/resume and permanent revoke.
- **Wallet / Agent Account detail:** Workers with authority over that resource; review, pause/resume, revoke, and create a mandate from the account side.
- **Security & Authority:** structured mandates, standing ACT grants, per-environment pause/resume, global revoke, durable authority decisions and authority history.
- **Activity:** mandate/authority domain events project into the existing Activity ledger.

`MandateEditor` uses viewport-bounded scrolling and is covered by the M6 viewport regression contract so normal 100% browser zoom remains usable.

## Explicit non-goals

M7 does not introduce smart-account deployment, session keys, raw wallet signing, private-key/seed storage, arbitrary contract calls, broad token approvals, autonomous cross-chain execution, or unrestricted mainnet autonomy. An `ALLOWED` M7 authority result means only that the proposal is inside authority policy; a later execution layer must still satisfy all execution/risk/signing/verification gates.
