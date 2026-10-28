import { closeDatabasePool, recordRuntimeHeartbeat } from '@agent-place/db';
import { processRoutineSchedulerPass } from '@agent-place/routines';
import { processBillingRenewals } from '@agent-place/billing';
import { defineService } from '@agent-place/shared';
import { createServiceLogger } from '@agent-place/observability';

export const service = defineService({
  name: 'agent-place-scheduler',
  runtimeClass: 'scheduler',
  version: '0.17.0',
  milestone: 14,
});

const logger = createServiceLogger(service.name);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const pollMs = Math.max(1000, Number.parseInt(process.env.ROUTINE_SCHEDULER_POLL_MS ?? '5000', 10) || 5000);
const batchSize = Math.min(100, Math.max(1, Number.parseInt(process.env.ROUTINE_SCHEDULER_BATCH_SIZE ?? '25', 10) || 25));
const leaseOwner = process.env.RAILWAY_REPLICA_ID?.trim() || `${service.name}:${process.pid}`;
const heartbeatInstanceId = process.env.RAILWAY_REPLICA_ID?.trim() || `scheduler:${process.pid}`;
let stopping = false;
async function heartbeat(): Promise<void> {
  await recordRuntimeHeartbeat({
    instanceId: heartbeatInstanceId,
    serviceName: service.name,
    runtimeClass: 'scheduler',
    version: service.version,
    milestone: service.milestone,
    metadata: { pollMs, batchSize },
  }).catch((error: unknown) => logger.warn('Scheduler heartbeat failed', { error:error instanceof Error?error.message:String(error) }));
}

async function heartbeatLoop(): Promise<void> {
  while (!stopping) {
    await heartbeat();
    await sleep(30_000);
  }
}

async function loop(): Promise<void> {
  logger.info('AgentPlace scheduler started', { version:service.version, milestone:service.milestone, pollMs, batchSize });
  while (!stopping) {
    try {
      const [result,billing] = await Promise.all([processRoutineSchedulerPass({ limit: batchSize, leaseOwner }),processBillingRenewals(batchSize)]);
      if (result.due || result.events || result.completed || result.failed || result.needsUser || result.expired || result.cooldownsReleased) {
        logger.info('Routine scheduler pass', { ...result });
      }
      if (billing.due || billing.renewed || billing.pastDue || billing.cancelled) {
        logger.info('Billing renewal pass', { ...billing });
      }
    } catch (error) {
      logger.error('Scheduler pass failed', { error:error instanceof Error?error.message:String(error) });
    }
    await sleep(pollMs);
  }
}

for (const signal of ['SIGINT','SIGTERM'] as const) process.on(signal,()=>{stopping=true;});

if (process.env.NODE_ENV !== 'test') {
  void Promise.all([loop(), heartbeatLoop()]).finally(async()=>{await closeDatabasePool();});
}
