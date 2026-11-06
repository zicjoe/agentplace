# M14 Stage 3 — Worker selection and execution truth correction

## Acceptance failure
A BONK Job claimed that Crypto Researcher and Meme Scout completed research in the Job Progress timeline. The persisted Job team listed only Meme Scout as Lead, with no supporting Worker and no `job_orchestration_step` rows. The planned stages were not reliable evidence that both Workers ran.

## Correction
- Manager's installed Worker inventory now uses canonical `worker_definition_id`, the ID accepted by Router/Job/WorkerVersion. `user_worker.id` is an installation key and must not be assumed interchangeable by future migrations/imports.
- Known public Workers explicitly named in a multi-Worker request but not installed are identified before planning, with a clear user-facing block; no silent replacement.
- A Worker-scoped conversation that requests a named multi-Worker team must hand off to Start work (Manager), never launch a misleading one-Worker Job.
- Explicit installed Worker selection is passed with pinned versions to Router. Router still validates compatibility/eligibility; omitted Workers fail closed without creating a Job.
- Explicit actionable requests involving multiple selected Workers cannot be converted into model-only answers merely because the model returns `direct`.
- Research Job stage labels are determined by the trusted execution path, not generated from LLM prose. Real specialist outputs are saved and attributed; skipped or failed specialist work stays incomplete and is marked partial.
- Structured provider evidence steps now report no usable evidence when no verified/partial provider result exists.
- Each collaboration checkpoint is keyed to the exact task as well as Job, so later Job conversation follow-ups cannot replay stale specialist results from a previous task.
- Job-scoped follow-ups pin the original persisted Job team and fail closed if current routing would omit an assigned Worker; the LLM cannot rewrite the Job team.
- Job progress only marks runtime-completed phases as done; there is no blanket completion of every stage.
- For historical Jobs with unverified multi-Worker progress prose but only one recorded Worker, Job Workspace warns and does not display those old team claims as completed.

## Validation
1. Both Workers installed/eligible → fresh Manager BONK request → both IDs in Router and Job team, specialist step recorded and completed, Lead synthesis completed.
2. One named Worker not installed → no Job, explicit instruction to add Worker, no fabricated team.
3. Paused/quarantined Worker → no silent activation or substitution.
4. Specialist fails or budget exhausted → actual step `failed` / `skipped`, partial Worker status and no false green specialist completion.
5. Browser refresh → persisted Worker assignments, executed steps and report remain coherent.
6. Prior legacy Jobs retain historical evidence; the UI marks unverified plan claims without manufacturing execution records.

No new migration, custody, authority, mainnet, x402 or external payment change. This is same-M14 v0.17.0 correction. `pnpm check` remains mandatory before deployment.
