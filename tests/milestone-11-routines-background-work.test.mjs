import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const migration = readFileSync('packages/db/migrations/0016_routines_background_work.sql', 'utf8');
const routines = readFileSync('packages/routines/src/index.ts', 'utf8');
const notifications = readFileSync('packages/notifications/src/index.ts', 'utf8');
const scheduler = readFileSync('apps/scheduler/src/index.ts', 'utf8');
const worker = readFileSync('apps/worker/src/index.ts', 'utf8');
const api = readFileSync('apps/api/src/server.ts', 'utf8');
const routineApi = readFileSync('apps/web/src/platform/routineApi.ts', 'utf8');
const routineWorkspace = readFileSync('apps/web/src/components/RoutineWorkspace.tsx', 'utf8');
const workerWorkspace = readFileSync('apps/web/src/components/WorkerWorkspace.tsx', 'utf8');
const jobWorkspace = readFileSync('apps/web/src/components/JobWorkspace.tsx', 'utf8');
const notificationInbox = readFileSync('apps/web/src/components/NotificationInbox.tsx', 'utf8');
const mainnetEnv = readFileSync('config/environments/production-mainnet.env.example', 'utf8');


test('M11 persists owner-scoped Routines, immutable revisions, runs and notifications', () => {
  for (const token of ['routine (','routine_revision (','routine_run (','notification (','notification_preference (']) assert.match(migration, new RegExp(token.replace('(','\\(')));
  assert.match(migration, /routine_revision_immutable_update/);
  assert.match(migration, /UNIQUE\(routine_id,routine_revision,occurrence_key\)/);
  assert.match(migration, /routine_run_event_once_idx/);
});


test('M11 preserves Mainnet/Testnet as an explicit Routine trust boundary', () => {
  assert.match(migration, /environment text NOT NULL CHECK \(environment IN \('mainnet','testnet'\)\)/);
  assert.match(routines, /environment:RoutineEnvironment/);
  assert.doesNotMatch(routines, /environment\s*=\s*['"]mainnet['"]/);
});


test('M11 supports scheduled condition and event triggers with production states', () => {
  for (const state of ['ACTIVE','WATCHING','WAITING_FOR_EVENT','COOLING_DOWN','PAUSED','LIMITED','NEEDS_USER','EXPIRED','STOPPED']) assert.match(migration, new RegExp(`'${state}'`));
  for (const trigger of ['SCHEDULED','CONDITION','EVENT']) assert.match(migration, new RegExp(`'${trigger}'`));
  assert.match(routines, /calculateNextScheduledAt/);
  assert.match(routines, /evaluateCondition/);
});


test('M11 scheduling is server-side and duplicate-safe across scheduler replicas', () => {
  assert.match(routines, /FOR UPDATE SKIP LOCKED/);
  assert.match(routines, /lease_expires_at/);
  assert.match(scheduler, /processRoutineSchedulerPass/);
  assert.match(scheduler, /ROUTINE_SCHEDULER_POLL_MS/);
  assert.match(scheduler, /ROUTINE_SCHEDULER_BATCH_SIZE/);
  assert.match(migration, /UNIQUE\(routine_id,routine_revision,occurrence_key\)/);
});


test('M11 condition false path does not create a Job or call an LLM', () => {
  const start = routines.indexOf('async function evaluateConditionRoutine');
  const end = routines.indexOf('async function processScheduledRoutine', start);
  const section = routines.slice(start, end);
  assert.match(section, /CONDITION_FALSE/);
  assert.match(section, /NO_CHANGE/);
  const falseStart = section.indexOf('if(!matched)');
  const falseEnd = section.indexOf('return;', falseStart);
  const falseBranch = section.slice(falseStart, falseEnd);
  assert.doesNotMatch(falseBranch, /launchRoutineJob|enqueueIntelligenceTask|generateStructured|generateText/);
  assert.doesNotMatch(section, /OPENAI|GEMINI|ANTHROPIC/i);
});


test('M11 event triggers consume AgentPlace facts exactly once and block routine-job recursion', () => {
  assert.match(routines, /ROUTINE_EVENT_TYPES/);
  assert.match(routines, /routine_run rr WHERE rr\.routine_id=\$4 AND rr\.event_id=e\.id/);
  assert.match(routines, /e\.event_type<>'job\.completed'/);
  assert.match(routines, /j\.origin_type='routine'/);
  assert.match(migration, /UNIQUE INDEX IF NOT EXISTS routine_run_event_once_idx/);
});


test('M11 Routine generated Jobs carry explicit Routine provenance without fabricated user messages', () => {
  assert.match(migration, /input_source text NOT NULL DEFAULT 'USER_MESSAGE'/);
  assert.match(migration, /CHECK \(input_source IN \('USER_MESSAGE','ROUTINE','SYSTEM'\)\)/);
  assert.match(routines, /originType:'routine'/);
  assert.match(routines, /originRoutineId:routine\.id/);
  assert.match(routines, /routineRunId:run\.id/);
  assert.match(routines, /inputSource:'ROUTINE'/);
  assert.doesNotMatch(routines, /role:'user'/);
});


test('M11 Routine research understands server-side recurrence instead of denying active monitoring', () => {
  assert.match(worker, /routineOccurrenceResearchRequest/);
  assert.match(worker, /Routine runtime contract: This Job is one occurrence of an already-created AgentPlace Routine/);
  assert.match(worker, /Do not tell the user that recurring monitoring or alerts are unavailable/);
  assert.match(worker, /Timing and notification clauses in the stored Routine instruction are orchestration metadata, not research requirements/);
  assert.match(worker, /task\.inputSource === 'ROUTINE' \? routineOccurrenceResearchRequest\(rawRequest\) : rawRequest/);
  assert.match(routines, /instruction:scheduledRoutineWorkInstruction\(text\)/);
});


test('M11 financial shortcuts cannot be reached by Routine intelligence tasks', () => {
  assert.match(worker, /task\.inputSource === 'USER_MESSAGE'/);
  assert.match(worker, /tryPrepareTransferRequest/);
  assert.match(worker, /tryPrepareBridgeRequest/);
  assert.match(routines, /M11_AUTONOMOUS_EXECUTION_UNAVAILABLE/);
  assert.doesNotMatch(routines, /eth_sendTransaction|eth_sendRawTransaction|privateKeyToAccount|sendTransaction\(/i);
});


test('M11 service budget is reserved before work and reconciled against actual run cost', () => {
  assert.match(routines, /serviceBudgetAvailable/);
  assert.match(routines, /SERVICE_BUDGET/);
  assert.match(routines, /markLimited\(routine,'SERVICE_BUDGET'/);
  assert.match(routines, /enforceCompletedRunBudget/);
  assert.match(routines, /RUN_COST_EXCEEDED/);
  assert.match(routines, /SERVICE_BUDGET_EXCEEDED/);
  assert.match(migration, /service_budget_limit_usd numeric/);
  assert.match(migration, /max_cost_per_run_usd numeric/);
});


test('M11 scheduler reconciliation does not overwrite an explicit pause stop or expiry', () => {
  assert.match(routines, /status NOT IN \('PAUSED','STOPPED','EXPIRED'\)/);
  assert.match(routines, /if\(!changed\.rowCount\)return/);
});


test('M11 repeated failures become Limited and need user attention', () => {
  assert.match(routines, /REPEATED_CONDITION_FAILURES/);
  assert.match(routines, /REPEATED_JOB_FAILURES/);
  assert.match(routines, /status='LIMITED'/);
  assert.match(routines, /level:'NEEDS_USER'/);
  assert.match(routineWorkspace, /Retry this check once/);
  assert.match(routineWorkspace, /Resume future checks/);
});


test('M11 in-app notifications persist read state and preferences', () => {
  for (const token of ['listNotifications','createNotification','markNotificationRead','markAllNotificationsRead','getNotificationPreferences','updateNotificationPreferences']) assert.match(notifications, new RegExp(token));
  assert.match(notificationInbox, /markNotificationReadApi/);
  assert.match(notificationInbox, /markAllNotificationsReadApi/);
  assert.match(notificationInbox, /updateNotificationPreferencesApi/);
});


test('M11 exposes authenticated Routine and Notification API surfaces', () => {
  for (const token of ["'/api/v1/routines'","'/api/v1/notifications'","'/api/v1/notification-preferences'"]) assert.ok(api.includes(token));
  assert.match(api, /\(activate\|pause\|resume\|run\|retry\|stop\)/);
  assert.match(api, /make-recurring/);
  assert.match(routineApi, /credentials:'include'/);
});


test('M11 production UX requires explicit activation and supports durable controls', () => {
  assert.match(routines, /ROUTINE_NOT_ACTIVATED/);
  assert.match(routines, /ROUTINE_RETRY_REQUIRED/);
  assert.match(routineWorkspace, /Activate Routine/);
  assert.match(routineWorkspace, /Run now/);
  assert.match(routineWorkspace, /Pause/);
  assert.match(routineWorkspace, /Resume/);
  assert.match(routineWorkspace, /Stop/);
  assert.match(routineWorkspace, /Background Routines cannot sign in v0\.14\.0/);
  assert.match(workerWorkspace, /createRoutineFromText/);
});


test('M11 Worker Workspace Set up a routine control opens an explicit Routine composer path', () => {
  assert.match(workerWorkspace, /onClick=\{onSetupRoutine\}/);
  assert.match(workerWorkspace, /handleSetupRoutine/);
  assert.match(workerWorkspace, /setRoutineComposerMode\(true\)/);
  assert.match(workerWorkspace, /routineComposerMode \|\| detectRoutineIntent\(text\)/);
  assert.match(workerWorkspace, /setRoutineComposerMode\(false\)/);
  assert.match(workerWorkspace, /composerRef\.current\?\.focus\(\)/);
  assert.match(workerWorkspace, /ref=\{composerRef\}/);
  assert.match(workerWorkspace, /\\bevery\\s\+\\d\+\\s\+\(minutes\?\|hours\?\|days\?\|weeks\?\)/);
  assert.doesNotMatch(workerWorkspace, /const setupHint\s*=\s*["']Set up a routine["']/);
});


test('M11 Make this recurring creates a draft rather than silently activating it', () => {
  assert.match(jobWorkspace, /makeJobRecurring/);
  assert.match(api, /createRoutineDraft/);
  const start = api.indexOf('const makeRecurringMatch');
  const end = api.indexOf("if (url.pathname === '/api/v1/jobs'", start);
  const section = api.slice(start, end);
  assert.doesNotMatch(section, /activateRoutine/);
});


test('M11 keeps Mainnet execution and autonomy disabled and introduces no signer', () => {
  assert.match(mainnetEnv, /MAINNET_EXECUTION_ENABLED=false/);
  assert.match(mainnetEnv, /MAINNET_AUTONOMY_ENABLED=false/);
  assert.doesNotMatch(routines, /privateKey|mnemonic|seed phrase|walletClient/i);
});


test('M11 pure trigger helpers behave deterministically after the workspace build', async (t) => {
  const built = 'packages/routines/dist/index.js';
  if (!existsSync(built)) return t.skip('Run after build; pnpm check builds workspace packages before tests.');
  const mod = await import(`../${built}?m11=${Date.now()}`);
  assert.equal(mod.evaluateCondition('GT', 11, 10), true);
  assert.equal(mod.evaluateCondition('LTE', 10, 10), true);
  assert.equal(mod.evaluateCondition('LT', 11, 10), false);
  const next = mod.calculateNextScheduledAt({kind:'interval',intervalMinutes:15,timeZone:'UTC',humanReadable:'Every 15 minutes'}, new Date('2026-10-16T10:00:00.000Z'));
  assert.equal(next.toISOString(), '2026-10-16T10:15:00.000Z');
  const draft = mod.draftRoutineFromNaturalLanguage({workerId:'w-meme',workerName:'Meme Scout',environment:'mainnet',instruction:'Check BONK market activity every 5 minutes and only notify me when something materially changes.',timeZone:'UTC'});
  assert.equal(draft.instruction, 'Check BONK market activity');
  assert.equal(draft.triggerType, 'SCHEDULED');
  assert.equal(draft.triggerConfig.intervalMinutes, 5);
});
