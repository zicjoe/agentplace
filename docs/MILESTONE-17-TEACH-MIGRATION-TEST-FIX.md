# M17 Teach Mode — historical migration test correction

This follow-up corrects one repository test in the M17 complex-teaching candidate.

## Failure

The M14 token identity migration test assumed `0025_token_identity_evidence_capability.sql`
would forever be the highest-numbered migration. The M17 Teach Mode change correctly added
`0026_creator_builder_teaching_message_limit.sql`, making that historical test fail.

## Correction

The test now verifies that `0025` exists, immediately follows `0024`, and precedes `0026`.
It retains the existing checks for the migration runner and token identity registration.
Future migrations can be added without breaking an unrelated historical test.

No runtime code, migrations, wallet authority, financial execution, or Scheduler changes are
included in this follow-up. The `0026` database migration still must be applied by the
configured Railway API migration process before testing long teaching turns in production.

## Verification

Run `pnpm check` before deploying. This package has a targeted passing test run and static
format/lint checks only; a full dependency-backed `pnpm check` must be completed locally.
