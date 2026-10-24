# M12 — Discover + Creator System

Release candidate: AgentPlace v0.15.0.

## Goal

Turn the approved Discover/Create experience into durable production supply without weakening AgentPlace trust boundaries. Creators can define responsibility and methodology; they cannot redefine signing, wallet authority, trusted capability classification, or execution policy.

## Production scope

- Discover is hydrated from durable Worker, Workflow and creator-capability supply. Marketplace remains a backend economic/supply subsystem, not a separate primary navigation destination.
- Worker listings expose publication separately from calculated runtime readiness: Available, Limited, Preview or Unavailable.
- Installing a Worker pins the exact Worker version until an explicit update. Jobs record exact Worker-version assignments for reproducibility.
- Creator-owned private Workers can be installed and tested without public publication. Adding/installing never grants financial authority.
- Agent Builder creates generic durable creator Workers, supports Teach Mode, reuse of existing specialist Workers, real sandbox Jobs, private use, publication, reopening/versioning and fork lineage. Builder choices are recorded as user turns, and Builder chat/draft continuity persists per creator Worker once a durable asset exists.
- Workflow Studio persists versioned Workflow definitions. Its saved creator transcript and draft snapshot reopen together, and saved Workflow routes preserve the active creation across hard refresh. A Workflow defines how work is done; it is not a Routine and grants no authority.
- Capability Studio performs real server-side OpenAPI inspection and remote MCP tool discovery. Imports remain creator-scoped and isolated from the trusted canonical implementation registry.
- Public/no-auth, parameter-free OpenAPI GET operations may be invoked through a bounded server-side creator sandbox. Mutating/imported MCP operations remain blocked from trusted routing.
- Remote imports require public HTTPS and reject embedded credentials, loopback/private/link-local DNS results, unsafe redirects, oversized responses and excessive redirects.
- Saving privately is non-terminal: creators can continue editing/testing, reopen the same Builder conversation from My creations, or publish later. New Worker always starts a clean Builder.
- Paid acquisition, creator revenue and payouts remain disabled until Billing + Security Completion.

## Trust rules

1. Publication is not AgentPlace verification.
2. Adding a Worker grants zero wallet authority.
3. Creator Workers in M12 are research/recommendation oriented. Existing AgentPlace financial capabilities still require normal Action → Risk → Authority → Approval → Execution → Verification.
4. Creator-imported capability operations never enter `capability_implementation` automatically.
5. No arbitrary creator code is executed.
6. No provider API secret is collected by Capability Studio in M12.
7. `MAINNET_EXECUTION_ENABLED=false` and `MAINNET_AUTONOMY_ENABLED=false` remain the production defaults.

## Deliberately deferred

Paid subscriptions, creator payouts/revenue splits, arbitrary authenticated external tools, secret vaulting, creator-defined economic-write implementations, autonomous Mainnet execution, generated executable code, and a universal visual workflow engine.

## Agent Builder intelligence correction

Agent Builder conversation is LLM-backed in v0.15.0 rather than a regex/keyword wizard. Authenticated Builder turns use the existing AgentPlace model gateway (`AgentPlace Auto`) to return a strict structured proposal. The model may classify the turn as discussion, draft modification, Teach Mode guidance, test, private save, publication, undo, or reuse of existing expertise, and may propose only a bounded set of Creator operations.

The LLM is not trusted to mutate production state directly. `@agent-place/creator-sdk` deterministically validates and applies the proposal. Capability additions are limited to registered read-only canonical capabilities, collaborators must resolve to eligible AgentPlace Workers, and the Creator core always restores the research/recommend-only authority default. Builder model calls, applied/rejected operations and draft revision lineage are durable through `creator_builder_turn` and `creator_builder_revision`.

Draft undo follows parent revisions and changes only the current Builder draft. It never rewrites an immutable released Worker version or an historical Job.
