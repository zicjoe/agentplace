# AgentPlace Production Milestone 5 — Router v1

Version: **0.6.0**

Milestone 5 makes routing a first-class deterministic runtime layer. The Manager proposes what the user appears to need; the Router decides what AgentPlace may actually route using the canonical capability registry, Worker compatibility, environment rules and provider implementation state.

## Delivered

- Durable `route_decision` records linked to the originating intelligence task and, after Job creation, the Job.
- Structured Manager routing proposal: intent domain, requested networks, required/optional capabilities and a dependency graph.
- Deterministic capability eligibility for lifecycle, read/write effect, deployment environment, network support, provider configuration, trust state, enablement and health.
- Worker/capability compatibility records through `worker_capability_route`.
- Deterministic lead/support Worker selection and validation with quarantined Workers excluded; the Router may add the smallest set of compatible specialists needed to cover proposed requirements.
- Provider implementation routing with trust, priority, health, environment eligibility and fallback order. Unknown external provider types are not routable until a provider-specific configuration contract exists.
- Conversation model/provider preference remains authoritative: an explicit provider selection is never silently switched.
- `AgentPlace Auto` may use a bounded eligible fallback provider for hosted web research when the selected route provider fails.
- Durable routing explanation and capability-level route status.
- Job Workspace progressive disclosure under **How AgentPlace routed this job**.
- M4 Research Coverage Contract now consumes the deterministic route result, so unavailable specialist capabilities are derived from registry/eligibility truth instead of model prose alone.
- Registered internal implementations for the existing grounded web-read and source-extraction portions of the M4 Research Pack.

## Core runtime doctrine

```text
User intent
  ↓
Manager / LLM proposal
  ↓
Deterministic Router
  ├─ Worker eligibility
  ├─ Capability lifecycle/effect
  ├─ Environment/network eligibility
  ├─ Provider configuration + health
  └─ implementation selection/fallback order
  ↓
Durable Route Decision
  ↓
Read-only Job runtime
```

The LLM does **not** decide whether a financial capability is authorized or executable. It only proposes structured requirements.

## Route states

- `routable` — every required capability has an eligible read-only implementation.
- `partially-routable` — the core research path is available but one or more requested specialist read capabilities are not live. The Job may continue, but missing dimensions must remain explicit limitations.
- `blocked` — the route cannot safely run in Router v1, including state-changing/economic-write requirements or loss of the core research path.

## Provider behavior

Capability implementations now carry:

- supported networks;
- trust status;
- health status;
- invocation kind;
- priority;
- enabled/disabled state;
- environment eligibility;
- known failure states.

For hosted web search:

- explicit OpenAI/Gemini/Anthropic selection is preserved and never silently switched;
- Auto selects an eligible implementation deterministically;
- Auto may try at most one additional eligible routed provider in the same research attempt;
- existing task retries remain bounded independently by the durable intelligence queue.

## Read-only boundary

Router v1 does not add:

- Connected Wallet execution;
- Agent Account signing;
- Mandates or Authority Grants;
- swap/bridge execution;
- autonomous financial authority;
- financial write provider fallback;
- AgentPlace Verified economic outcomes.

Any canonical `write` or `economic-write` capability is blocked by Router v1 even if an implementation is later registered accidentally. This is defense in depth, not a substitute for the later Authority Engine.

## Relationship to M5B

M5B remains the next capability-expansion step. Router v1 supplies the routing substrate; M5B adds real provider-backed read-only crypto intelligence such as market/liquidity, holder concentration, deployer analysis, token security, wallet performance/activity and smart-money intelligence.

Provider choices for those capabilities remain intentionally deferred to the M5B pre-milestone discussion gate.
