import { closeDatabasePool } from '@agent-place/db';
import { processRoutineSchedulerPass } from '@agent-place/routines';
import { defineService } from '@agent-place/shared';

export const service = defineService({
  name: 'agent-place-scheduler',
  runtimeClass: 'scheduler',
  version: '0.14.0',
  milestone: 11,
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const pollMs = Math.max(1000, Number.parseInt(process.env.ROUTINE_SCHEDULER_POLL_MS ?? '5000', 10) || 5000);
const batchSize = Math.min(100, Math.max(1, Number.parseInt(process.env.ROUTINE_SCHEDULER_BATCH_SIZE ?? '25', 10) || 25));
const leaseOwner = process.env.RAILWAY_REPLICA_ID?.trim() || `${service.name}:${process.pid}`;
let stopping = false;

async function loop(): Promise<void> {
  process.stdout.write(`${JSON.stringify({ level:'info',service:service.name,message:'AgentPlace scheduler started',version:service.version,pollMs,batchSize })}\n`);
  while (!stopping) {
    try {
      const result = await processRoutineSchedulerPass({ limit: batchSize, leaseOwner });
      if (result.due || result.events || result.completed || result.failed || result.needsUser || result.expired || result.cooldownsReleased) {
        process.stdout.write(`${JSON.stringify({ level:'info',service:service.name,message:'Routine scheduler pass',...result })}\n`);
      }
    } catch (error) {
      process.stderr.write(`${JSON.stringify({ level:'error',service:service.name,message:'Routine scheduler pass failed',error:error instanceof Error?error.message:String(error) })}\n`);
    }
    await sleep(pollMs);
  }
}

for (const signal of ['SIGINT','SIGTERM'] as const) process.on(signal,()=>{stopping=true;});

if (process.env.NODE_ENV !== 'test') {
  void loop().finally(async()=>{await closeDatabasePool();});
}
