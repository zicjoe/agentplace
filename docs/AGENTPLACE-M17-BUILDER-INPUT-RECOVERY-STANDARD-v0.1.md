# AgentPlace — Conversational Builder, Long-Input & Recovery Standard

**Version:** 0.1 — proposed product/engineering contract for review, **not yet implemented or accepted**
**Workstream:** Milestone 17 — unified Agent Builder and persistent expertise
**Scope:** Describe, Template, Teach My Expertise, Fork/Combine, Import and continuing existing private drafts

## 1. Product promise and non-negotiable invariants

AgentPlace lets a user create and refine a Worker through short dialogue, long detailed instructions, supporting documents, or any combination of these. The user chooses the depth. The interface does not force anyone to learn Job Contracts, tooling or prompts before beginning.

- **No silent loss:** Never silently truncate, discard, summarize away, overwrite or partially apply user input. Preserve accepted original text as an inspectable private source, and label any derived summary.
- **Conversation is primary:** All entry paths converge on one durable, owner-scoped Builder conversation and a contextual, inspectable Worker Draft.
- **Proposals are not commitments:** Interpretations create reviewable proposals. Only approved/saved changes become canonical draft versions. An AI acknowledgement must not claim changes were persisted if they were not.
- **No authority by teaching:** Knowledge and instructions cannot grant wallet permissions, activate a routine, spend on services, publish a Worker, or execute actions.
- **Safety enforcement is deterministic:** Model instructions are not a substitute for runtime permission policies, scoring calculators or capability eligibility checks.
- **Creator IP stays private:** Separate ownership, confidentiality, and permissions for creator methodology versus end-user data. Public profile and publication must not reveal private methodology.
- **Know the difference:** Clearly label desired, available-but-unconfigured, configured-and-tested, and unsupported capabilities; separately label AI-guidance vs deterministically enforced rules.
- **Idempotency and recovery:** Duplicate sends, retries, timeouts and stale browser tabs must not accidentally create duplicate Worker drafts or duplicate paid work.
- **Auditability:** Retain source lineage, accepted changes, model interpretation outcome, Job Contract version, testing evidence and actor/time metadata without recording secrets or needlessly exposing private content.

These principles extend the AgentPlace master engineering specification's Teach Mode, publication lifecycle, trust boundaries and anti-authority-expansion controls.

## 2. Proposed v1 input limits (product decisions to validate with load tests)

These are initial design values, not industry-wide standards or claims about the current deployed code.

| Input channel | Proposed v1 boundary | Experience at boundary |
|---|---|---|
| Ordinary Builder chat turn | **16,000 Unicode characters** | Live count; typed text and pasted text preserved. If longer, offer **Use as a private source** without losing any content. |
| Large text paste as private source | **100,000 Unicode characters** per source | Stage the complete paste, preview it, choose how to interpret; do not send the entire text as an ordinary chat message. |
| Document upload | **20 MB** per file initially | Validate type/size; preserve original securely; parse/index asynchronously with progress and recoverable failures. |
| Knowledge files | **50 files** per Worker initially | Show explicit per-Worker count and quota; allow revision/replacement and removal. |
| Total stored source files | **100 MB** per Worker initially | Show remaining space; retain already accepted content; support expansion/plan-based quotas later. |
| Builder conversations | **No short cumulative message/turn limit by design** | Maintain durable transcript and committed decision history; cap model context *per request*, not historical knowledge. Apply defined retention/storage quotas transparently. |
| Extracted structured expertise | **No single flat 8,000-character cumulative ceiling** | Store independently versioned rules, examples, exceptions, provenance, knowledge documents and capability bindings. |

Important: For implementation, define exactly how character counts work (Unicode code points vs UTF-16 units), distinguish bytes from characters, and enforce compatible server-side validation. UI counts are advisory; the server remains authoritative. Prove the agreed measurements against emoji, combining marks, right-to-left text, mixed language, markup and multiline input.

The deployed/pending M17 Teach Mode candidate currently exposes an **8,000-character per-turn limit**. It must not be presented as the long-term AgentPlace knowledge limit. Moving to the proposed v1 standard requires a separate implementation and migration review.

### 2.1 Example: an over-limit paste

User pastes 31,000 characters into chat. **Do not truncate** and **do not send an invalid 31,000-character chat turn**. Keep the full input staged and show:

> “This is longer than a chat message. I've kept the entire text. You can attach it as a private methodology source, review it, and ask me to extract rules from it. Nothing has been discarded or applied.”

Actions: **Use as private source** / **Edit text** / **Cancel**. On confirmation, create one owner-scoped source record and a Builder message referencing it. Show extraction progress and an eventual proposed diff. If import fails, leave the source available for retry.

If a paste exceeds the text-source ceiling, preserve it in the draft editor where feasible and offer document upload or a safe split into named parts. Never imply a successful save before the server confirms.

### 2.2 Why not use model context as storage?

A model has a finite input/output token budget. A 100,000-character source is *not* guaranteed to fit in one call. Save originals, parse into traceable sections, index, extract candidates, detect overlaps/conflicts, and compile only relevant approved rules for runtime. Never silently drop the tail or treat an incomplete model response as complete parsing.

## 3. Unified conversational creation experience

All creation entry points lead to the same Builder conversation, with an adjacent or on-demand Worker Draft panel. Mobile uses a separate sheet or screen for Draft rather than narrowing the chat.

- **Describe:** A short goal leads to a provisional Worker name/mission, then one or two useful questions. No large setup form.
- **Template:** Load an explicitly versioned template, label its defaults, and ask what to adapt. Do not present template defaults as creator-authored rules.
- **Teach:** Invite ordinary conversation, cases, and counterexamples. Proposed methodology items appear as reviewable changes, not as a wall of YAML/JSON.
- **Long brief:** Accept deliberate, detailed input. Recognize it as one source; ask only consequential unanswered questions rather than requesting a rewrite.
- **Import:** Treat external files, URLs, API schemas or third-party Workers as untrusted input. Show provenance, supported/unsupported features, and explicit consent before connecting remote systems or using credentials.
- **Continue:** Reopen the existing draft, history, unresolved proposals, and last test results. Opening the Builder is free of automatic model calls.

Suggested conversational state vocabulary: **Draft saved**, **Changes proposed**, **Needs review**, **Interpreting**, **Retry available**, **Ready to test**, **Tested**, **Private use eligible**, **Publish eligibility pending**. Avoid ambiguous “created” or “learned” when only a transient interpretation exists.

## 4. Methodology formalization and consistency

Store separately: mission, responsibilities/anti-jobs, inputs/outputs, knowledge sources, methodology, decision rules, exceptions, examples, capabilities, runtime authority and test cases. Every structured item needs a stable ID, source span/citation, version, status, owner, and optional approval event.

An interpretation should return a **proposed diff** against the accepted version. User can accept all, accept selected items, edit, reject, or ask for clarification. For ambiguous, contradictory or unsupported rules, explicitly flag them rather than inventing reconciliation. Keep older versions and offer undo/restore.

Accepted AI instructions are distinct from **deterministic enforcement**. For numeric risk scores, policy limits, permissions, budgets, or chain execution, require code-backed validation/test evidence before labeling a rule “enforced.” Do not allow uploaded material or generated content to grant additional privileges.

## 5. Long-conversation behavior

- Keep the full **durable, owner-scoped transcript**, plus accepted structured decisions and original sources.
- When the live model context budget is insufficient, build a bounded *working context* using accepted rules, relevant source extracts, a labeled conversation summary and recent turns. Do not overwrite full history with a summary.
- Users can ask “what have I taught this Worker?” and receive a review of accepted rules with links to their original teaching turns.
- Contradictions (e.g. “never trade” versus “trade automatically”) require conflict surfacing and explicit creator decision. The latest message does not silently supersede deterministic safety restrictions.
- If two tabs edit the same Worker, use version checks or conflict-resolution UI. One stale response cannot overwrite newer accepted data.
- Distinguish “source is saved” from “source is indexed,” “rule proposed,” “rule accepted,” and “rule applied to runtime.”

## 6. Failure, safety and cost behavior

| Failure or risk | Required behavior |
|---|---|
| Over-limit ordinary message | Preserve all text; offer one-step conversion to private source; don't silently truncate. |
| File exceeds upload limit or quota | Explain exact boundary and available alternatives; keep existing draft untouched. |
| Invalid/unsupported/corrupt/password-protected file | Explain what cannot be read; preserve original if safely stored; ask for accessible format without fabricating content. |
| Image-only PDF or partial extraction | Report unreadable pages/coverage; never claim full import. OCR can be an optional explicitly disclosed path. |
| Expensive long interpretation | Display expected paid/credit impact or budget class before consumption; no surprise automatic paid provider calls. |
| Provider 429, timeout, invalid JSON, output truncation | Classify error, bounded retries/backoff, preserve source and unsent proposals, offer manual retry without duplicate draft writes. |
| Browser refresh, back navigation, dropped connectivity | Keep previously confirmed saves; retain pending input locally or in a draft safely; resume idempotently after reconnect. |
| Duplicate click or concurrent submit | Use idempotency keys and request status to avoid duplicate charges/versions. |
| Unauthorized read, shared link, tenant confusion | Deny by default; enforce server-side owner/role checks for every source, rule, version and draft. |
| API keys, wallets, addresses and PII pasted into content | Detect likely secrets and warn/redact before persistence or model use where possible; never put private signing keys in LLM context. |
| Prompt injection in uploaded documents or webpages | Treat imported text as data, not authority; prevent tool invocations and privilege changes during ingestion; review output before enabling actions. |
| Unsupported tools/chains/external integrations | Record as requested/unavailable; do not imply functional coverage. |
| Source conflicts with accepted creator rules | Show conflict and provenance; require explicit revision approval. |
| Safe/read-only draft asks to trade or spend | No execution, financial approval, publication or implicit delegation via Builder conversation. Route to separate explicit authority workflow. |
| Source deleted, permission revoked, subscription expires | Respect permissions and retention policy; reflect stale/unavailable source instead of continuing to claim fresh evidence. |

Security design should follow defense-in-depth; external knowledge and model outputs must never be promoted to financial authority. For high-consequence Workflows, a conversational instruction is insufficient evidence of deterministic compliance.

## 7. Acceptance matrix: release-blocking scenarios

The QA plan should exercise all of the following scenario groups before Stage 2 production acceptance. Implement automated tests first, then controlled end-to-end and accessibility testing. The numbers below are **test IDs**, not claims of existing coverage.

| Group | Required test cases |
|---|---|
| A. Entry | A01 short description; A02 template customisation; A03 teach expertise; A04 reopen existing draft; A05 fork/combine with provenance; A06 switching creation style mid-conversation. |
| B. Input limits | B01 empty input; B02 exactly 16,000 chars; B03 16,001; B04 31,000 paste; B05 exactly 100,000 source; B06 >100,000; B07 emoji/combining/RTL; B08 multiline code/JSON; B09 pasted HTML; B10 clipboard text persists after cancel/failure. |
| C. Files/URLs | C01 PDF; C02 DOCX; C03 Markdown/TXT; C04 CSV/XLSX; C05 malformed; C06 password-protected; C07 image-only; C08 oversized; C09 at quota; C10 URL denied/404/blocked; C11 malicious embedded prompt; C12 deleted/restricted source. |
| D. Long conversations | D01 100+ teaching turns; D02 come back next day; D03 browser hard refresh; D04 multiple tabs; D05 contradictory rules; D06 later correction; D07 restore previous version; D08 review original provenance; D09 model context overflow; D10 no loss of exact numeric thresholds. |
| E. Interpretation | E01 good structured output; E02 no matching capability; E03 incomplete extraction; E04 ambiguous instruction; E05 proposed rules not accepted; E06 partial acceptance; E07 exact calculations; E08 false enforcement claim prevented; E09 duplicate rule detection. |
| F. Failures/cost | F01 429; F02 upstream 500; F03 timeout; F04 truncated model response; F05 malformed JSON; F06 network disconnect; F07 duplicate submit; F08 retry idempotency; F09 insufficient credits; F10 cancellation during processing; F11 provider fallback respecting cost choice. |
| G. Security/privacy | G01 cross-owner access denied; G02 secret paste; G03 prompt injection; G04 private expertise not leaked to listing; G05 document not converted to financial authority; G06 no wallet signature; G07 testnet/mainnet separation; G08 financial spend requires explicit authorization; G09 audit and deletion/retention policies. |
| H. Test/publish lifecycle | H01 sandbox test with no authority; H02 synthetic example; H03 test fails and draft survives; H04 install privately; H05 version pinning; H06 public publication explicitly reviewed; H07 published worker never auto-updates unsafely; H08 revoke/quarantine independently. |
| I. Accessibility & devices | I01 mobile paste/upload; I02 keyboard only; I03 screen reader and errors; I04 reduced motion; I05 slow network; I06 old/small devices; I07 multilingual; I08 long code and wide text wrapping. |

**Release gate:** 100% of designated critical safety/data-integrity cases pass; no unresolved silent truncation, cross-owner leakage, unauthorized execution, duplicate economic action, or false persistence claim. Other test cases require documented disposition and measured reliability targets before broader rollout. One happy-path AEGIS demonstration is insufficient.

## 8. Implementation sequence

1. **M17 Stage 2A — Interaction & recovery contract:** Shared conversation-first Builder, long-paste staging and conversion, clear save/proposal states, typed errors, durable retry, no silent truncation. Preserve current Worker semantics.
2. **M17 Stage 2B — Structured expertise storage:** Revisioned methodology rules, examples, exceptions, knowledge-source references and provenance; atomic change-set acceptance/undo.
3. **M17 Stage 2C — Ingestion & compiled context:** Secure files/URL ingestion, sections/indexing, coverage reporting, relevant-source retrieval, conflict resolution, cost safeguards.
4. **M17 Stage 2D — Testing & enforcement proof:** Sandbox cases, exact deterministic numeric rule tests where supported, capability readiness, safety assertions and private installation.
5. **M17 Stage 2E — Production hardening:** Load testing, latency/cost metrics, recovery tests, security review, mobile/accessibility, phased rollout and incident/rollback path.

Do not change Mainnet financial controls or the deferred Railway Scheduler optimization as a side effect of this UX work. Follow the existing full replacement ZIP → `pnpm check` → deployed release → production acceptance workflow.

## 9. Design decisions still to confirm in engineering

- Precise character/byte counting contract and storage/retention constraints.
- Model-specific token budgets and allowed request cost per plan.
- File formats and guaranteed extraction fidelity by format.
- Quotas based on actual compute/storage performance and abuse testing.
- Data deletion, export, creator-publication IP policy, encryption and access control.
- Whether first-release long-paste-to-private-source is immediate synchronous storage or a resumable staged upload.
- Usability research and test results across novice and expert creators.

No finite specification anticipates literally every possible user behavior. The standard is a **scenario register + acceptance contract + ongoing telemetry/incident-driven updates**, not a claim of exhaustive certainty.

## 10. Reference points

- AgentPlace Master Product & Engineering Spec v1.0: Teach Mode; creator IP; separate financial authority; publishing lifecycle; trust boundaries.
- OpenAI Help Center, *Creating and editing GPTs* (conversational builder vs knowledge sources): https://help.openai.com/en/articles/8554397-creating-and-editing-gpts
- Microsoft Copilot Studio, *FAQ for the agent creation from natural language experience*: https://learn.microsoft.com/microsoft-copilot-studio/faqs-agent-creation
- OWASP GenAI, *LLM01:2026 Prompt Injection*: https://genai.owasp.org/llm2026/llm012026-prompt-injection/

## 11. Mixed-mode continuity clarification (2026-11-26)

**Entry methods are not workflow locks.** Within the same owner-scoped Builder session and canonical Worker draft, a creator can alternate among short dialogue, extended teaching, template adaptation, revised instructions, detailed editing, testing, and (once available) document/URL imports. A source imported late must not replace prior accepted expertise without explicit review. Users may change goals, undo or refine prior decisions, and return after days or weeks; the saved decision history is preserved.

**Current delivery boundary:** M17 Stage 2A implements conversation-first entry, in-conversation editable templates and teaching/editing continuity; file/source ingestion and independently reviewed change-set acceptance are deferred to later stages. Never describe them as live Stage 2A features. The limits table remains a proposed **v1 target**, not the shipped backend quota.
