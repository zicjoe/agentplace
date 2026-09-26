# Production Milestone 3 — Workers + Jobs

AgentPlace v0.4.0 replaces the prototype Worker/Job substrate with durable PostgreSQL-backed production objects while preserving UX Baseline v1.

## Production-backed in this milestone

- versioned Worker Definitions and Job Contracts;
- AgentPlace Original catalog records seeded by migration;
- per-user Worker installation state;
- truthful Worker operational states, defaulting to Standing by;
- persistent Worker Conversations;
- durable Jobs with environment, goal, origin, stages and state;
- Lead Worker and Supporting Worker relationships;
- persistent Job Conversations and origin Conversation links;
- factual domain events and Activity projection;
- authenticated owner isolation across Worker/Job/Activity APIs;
- idempotent Worker installation and Job identity handling.

## AgentPlace Originals seeded

Portfolio Guardian, Meme Scout, Smart Money Scout, Stablecoin Manager, DeFi Manager, Perps Operator, Crypto Researcher, Execution Operator and Agent Builder.

## Deliberately not production-backed yet

Milestone 3 does not make model reasoning, capability execution, wallets, mandates, financial authority, transactions, settlement or verified outcomes real. Prototype financial/demo branches remain isolated from the durable Milestone 3 Worker/Job write path. Adding a Worker grants no wallet authority.

## Next roadmap

The reconciled production roadmap now continues with:

1. M4 — Capability Standard + Intelligence Foundation
2. M5 — Router v1
3. M6 — Wallet Foundation
4. M7 — Mandates + Authority
5. M8 — Action Preparation + Review
6. M9 — Testnet Execution + Observation
7. M10 — Settlement + Verification + Receipts
