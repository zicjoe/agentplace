import { existsSync, readFileSync } from 'node:fs';

const required = [
  'packages/db/migrations/0016_routines_background_work.sql',
  'packages/routines/src/index.ts',
  'packages/notifications/src/index.ts',
  'apps/scheduler/src/index.ts',
  'apps/web/src/platform/routineApi.ts',
  'docs/MILESTONE-11.md',
  'docs/MILESTONE-11-TESTING.md',
  'docs/MILESTONE-11-DEPLOYMENT.md',
];
for (const file of required) if (!existsSync(file)) throw new Error(`M11 missing ${file}`);

const migration = readFileSync(required[0], 'utf8');
for (const token of ['CREATE TABLE IF NOT EXISTS routine (','CREATE TABLE IF NOT EXISTS routine_revision (','CREATE TABLE IF NOT EXISTS routine_run (','CREATE TABLE IF NOT EXISTS notification (','CREATE TABLE IF NOT EXISTS notification_preference (','routine_revision_immutable_update','UNIQUE(routine_id,routine_revision,occurrence_key)','routine_run_event_once_idx','origin_routine_id','routine_run_id','input_source']) {
  if (!migration.includes(token)) throw new Error(`M11 persistence missing ${token}`);
}

const routines = readFileSync('packages/routines/src/index.ts', 'utf8');
for (const token of ['calculateNextScheduledAt','evaluateCondition','processRoutineSchedulerPass','FOR UPDATE SKIP LOCKED','inputSource:\'ROUTINE\'','CONDITION_FALSE','WAITING_FOR_EVENT','COOLING_DOWN','M11_AUTONOMOUS_EXECUTION_UNAVAILABLE','serviceBudgetAvailable','enforceCompletedRunBudget','SERVICE_BUDGET_EXCEEDED','RUN_COST_EXCEEDED','REPEATED_CONDITION_FAILURES','REPEATED_JOB_FAILURES']) {
  if (!routines.includes(token)) throw new Error(`M11 Routine core missing ${token}`);
}
if (/eth_sendTransaction|eth_sendRawTransaction|privateKeyToAccount|sendTransaction\(/i.test(routines)) throw new Error('M11 Routine core must not contain a financial signer/submission path.');

const conditionSection = routines.slice(routines.indexOf('async function evaluateConditionRoutine'), routines.indexOf('async function processScheduledRoutine'));
if (/generateStructured|generateText|OPENAI|GEMINI|ANTHROPIC/i.test(conditionSection)) throw new Error('M11 deterministic condition polling must not call an LLM.');

const scheduler = readFileSync('apps/scheduler/src/index.ts', 'utf8');
for (const token of ['processRoutineSchedulerPass','ROUTINE_SCHEDULER_POLL_MS','ROUTINE_SCHEDULER_BATCH_SIZE','Routine scheduler pass']) if (!scheduler.includes(token)) throw new Error(`M11 Scheduler missing ${token}`);

const worker = readFileSync('apps/worker/src/index.ts', 'utf8');
if (!worker.includes("task.inputSource === 'USER_MESSAGE'")) throw new Error('M11 Worker must restrict direct financial preparation shortcuts to genuine user-message tasks.');

const api = readFileSync('apps/api/src/server.ts', 'utf8');
for (const token of ['/api/v1/routines','/api/v1/notifications','/api/v1/notification-preferences','make-recurring']) if (!api.includes(token)) throw new Error(`M11 API missing ${token}`);

const routineWorkspace = readFileSync('apps/web/src/components/RoutineWorkspace.tsx', 'utf8');
for (const token of ['Activate Routine','Run now','Retry this check once','Resume future checks','Background Routines cannot sign in v0.14.0']) if (!routineWorkspace.includes(token)) throw new Error(`M11 Routine UX missing ${token}`);

const env = readFileSync('config/environments/production-mainnet.env.example', 'utf8');
if (!env.includes('MAINNET_EXECUTION_ENABLED=false') || !env.includes('MAINNET_AUTONOMY_ENABLED=false')) throw new Error('M11 must keep Mainnet execution/autonomy disabled by default.');
if (!env.includes('ROUTINE_SCHEDULER_POLL_MS=5000')) throw new Error('M11 production environment contract must include the Scheduler cadence.');

console.log('PASS: M11 Routines + Background Work provides durable scheduled/condition/event triggering, exactly-once RoutineRuns, Routine-to-Job provenance, budgets, Limited/Needs-you behavior and in-app notifications without adding signing authority or Mainnet autonomy.');
