# Milestone 17 Stage 1 — Creator long-brief hotfix

## Production observation

The initial AEGIS expertise prompt exceeded 1,000 characters after the creation form added its scaffolding. The previous `seedDraftForBuilder` copied the entire formatted brief into the initial draft Job Contract. `toWorkerDraft` then assigned that value to both `responsibility` and `mission`, although the deterministic Creator validator requires `responsibility` <= 1,000 characters and `mission` <= 2,000. The server consequently surfaced an opaque `internal_error`. The previous form also imposed a silent 1,800-character paste cap on its main description.

This reproduces a deterministic validation failure that can explain the reported symptom; production request logs have not been inspected to prove it was the only failure.

## Remediation

- Seed only a bounded provisional outline (<= 950 characters) from the creator's actual stated job, rather than the entire scaffold. This outline is not represented as the complete Worker.
- Preserve the entire accepted creator brief (up to the existing 4,000-character API request boundary) as the Builder turn for the intelligence model and in the normal Builder conversation.
- Use an explicitly bounded 1,000-character `responsibility` summary when serializing Worker drafts, while preserving `mission` separately within its 2,000-character contract.
- Allow larger kickoff input (up to 3,000-character goal and 700-character method) without silently truncating pasted text. Validate the combined request length <= 3,900 characters and show accessible inline length feedback if it cannot be submitted. Teach additional methodology in later turns.
- Distinguish initial draft persistence from intelligence interpretation failures. Provide an explicit **Retry interpreting my brief** action that reuses the saved draft if it exists instead of creating another Worker or automatically performing tests.
- Show the API request ID with safe public error messages for troubleshooting.

## Boundaries

No database migration or new environment setting. No automatic sandbox test, Worker installation, publication, paid request, transaction, capability grant, or Mainnet autonomy change. Railway Scheduler untouched. This fix does not prove the live model endpoint is healthy; production acceptance requires an actual successful AEGIS draft creation after deployment.

## Acceptance

1. Run `pnpm check` locally; do not deploy if it fails.
2. Deploy through the established GitHub, Railway, and Vercel pipeline.
3. Start a **new** Create → Worker → Teach my expertise session (the original paste was already truncated in the old UI). Enter a concise AEGIS kickoff or a brief within the visible character limits.
4. Confirm the Builder produces a named private draft with a Job Contract, responsibilities, anti-jobs, evidence rules, eligible capabilities only, and no automatic test/publication/financial authority.
5. Teach a separate rule in a second turn and confirm the existing draft version updates.
6. If interpretation fails, the UI must say whether a provisional draft was saved and offer retry without inventing a completed Worker. Copy the request ID if one is shown and inspect Railway API logs.
