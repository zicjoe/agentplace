# M17 Stage 2A — Production acceptance (no unnecessary paid research)

Test on the deployed AgentPlace web UI. Record results by test ID. **Do not click Publish, Install or run an AI test automatically.** Use an ordinary creator draft rather than any wallet-connected action.

| ID | Action | Expected |
|---|---|---|
| F01 | Open Create → Worker | Chat opens with "What would you like your Worker to do?" and an ordinary composer; no AI call until Send |
| F02 | Start with one sentence | One private draft in current Builder; answer appears in conversation |
| F03 | Reopen AEGIS | Saved draft, teaching history and editable conversation return |
| F04 | Choose Browse templates *after* initial Worker creation | Editable template instruction appears in composer, without creating another Worker or automatically submitting a request |
| F05 | Add an instruction to the staged template text | The previously typed unsent input remains present |
| F06 | Use Teach a rule, then rename AEGIS in a later message | Teaching does not lock later turns; editing stays in same session |
| F07 | Paste more than 8,000 characters | Input is retained intact; Send disabled; limit message and Copy full unsent text available |
| F08 | Close with unsent input | Confirmation warns before losing unsent content |
| F09 | Send a valid teaching instruction, then refresh | Submitted turn and confirmed saved draft/messages survive; no duplicate AI request from refresh |
| F10 | Simulate or observe an AI error | Draft remains; explicit retry available without duplicating Worker |
| F11 | Inspect save status | Shows Saving vs Saved only after API confirmation; Retry save appears when session persistence fails |
| F12 | Request a test or publication in natural language | Builder explains explicit action controls rather than starting a Job or publishing from model intent |
| F13 | Select Detailed setup (optional) at initial entry | Existing advanced create form still works, same Worker creation path |
| F14 | Inspect Worker draft on phone | Chat and Draft tabs both remain accessible |
| F15 | Verify safety | No wallet signature, financial authority, paid Worker hiring, routine activation, publication, or Mainnet execution from mere Builder instructions |

**Do not treat F09 as passed merely because Builder says "saved."** Refresh and verify actual persisted content. For F10, if no provider error occurs naturally, don't deliberately spend AI credits provoking one; leave it unverified or use the automated test results.

## Acceptance and follow-up

Stage 2A can be functionally accepted after the applicable ordinary-creation, mixed-mode, persistence and non-authority tests pass. Mark private-document ingestion, multi-tab conflict resolution, long-source storage, and deterministic expertise enforcement **pending**, never as achieved. The next development stage is persistent structured expertise, knowledge/source ingestion and explicit change-set review.
