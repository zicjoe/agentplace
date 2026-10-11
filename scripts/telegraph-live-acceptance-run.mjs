import { createHash, randomUUID } from 'node:crypto';
import { closeDatabasePool, getDatabasePool } from '../packages/db/dist/index.js';
import {
  bindTelegraphSubjectPayload,
  loadTelegraphRuntimeCatalog,
  normalizeTelegraphMappedInvocation,
  telegraphServicePaymentStatusFromEnv,
} from '../packages/telegraph/dist/runtime.js';

const CONFIRMATION = 'ONE_BOUNDED_TESTNET_X402_CALL';

function enabled(value) {
  return ['1', 'true', 'yes', 'on'].includes((value ?? '').trim().toLowerCase());
}

function requireLiveGate(env = process.env) {
  if (!enabled(env.TELEGRAPH_LIVE_ACCEPTANCE_ENABLED)) {
    throw new Error('Live acceptance is disarmed. Set TELEGRAPH_LIVE_ACCEPTANCE_ENABLED=true only for the deliberate M5B.2.4 testnet acceptance run.');
  }
  if ((env.TELEGRAPH_LIVE_ACCEPTANCE_CONFIRM ?? '').trim() !== CONFIRMATION) {
    throw new Error(`Set TELEGRAPH_LIVE_ACCEPTANCE_CONFIRM=${CONFIRMATION} to acknowledge that this command may spend one bounded testnet x402 service payment.`);
  }
}

function subjectFromEnv(env = process.env) {
  const kind = (env.TELEGRAPH_ACCEPTANCE_SUBJECT_KIND ?? 'token').trim().toLowerCase();
  if (!['token', 'wallet', 'protocol', 'stablecoin'].includes(kind)) {
    throw new Error('TELEGRAPH_ACCEPTANCE_SUBJECT_KIND must be token, wallet, protocol or stablecoin.');
  }
  const query = (env.TELEGRAPH_ACCEPTANCE_QUERY ?? '').trim();
  if (!query) throw new Error('TELEGRAPH_ACCEPTANCE_QUERY is required.');
  const network = (env.TELEGRAPH_ACCEPTANCE_NETWORK ?? '').trim();
  const address = (env.TELEGRAPH_ACCEPTANCE_ADDRESS ?? '').trim();
  return {
    kind,
    query,
    ...(network ? { network } : {}),
    ...(address ? { address } : {}),
  };
}

function safePayment(value) {
  const telegraph = value?.data?.telegraph;
  const payment = telegraph && typeof telegraph === 'object' ? telegraph.servicePayment : undefined;
  if (!payment || typeof payment !== 'object' || Array.isArray(payment)) return undefined;
  return {
    status: payment.status ?? null,
    protocol: payment.protocol ?? null,
    environment: payment.environment ?? null,
    network: payment.network ?? null,
    caip2Network: payment.caip2Network ?? null,
    asset: payment.asset ?? null,
    amountAtomic: payment.amountAtomic ?? null,
    amountUsdc: payment.amountUsdc ?? null,
    payTo: payment.payTo ?? null,
    payerAddress: payment.payerAddress ?? null,
    transactionHash: payment.transactionHash ?? null,
  };
}

function safeService(value) {
  const telegraph = value?.data?.telegraph;
  const service = telegraph && typeof telegraph === 'object' ? telegraph.service : undefined;
  if (!service || typeof service !== 'object' || Array.isArray(service)) return undefined;
  return {
    id: service.id ?? null,
    slug: service.slug ?? null,
    name: service.name ?? null,
    endpoint: service.endpoint ?? null,
  };
}

async function assertAcceptanceSchemaReady(pool) {
  const required = ['app_user', 'job', 'conversation', 'intelligence_task', 'canonical_capability', 'telegraph_service_payment'];
  const result = await pool.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY($1::text[])`,
    [required],
  );
  const present = new Set(result.rows.map((row) => row.table_name));
  const missing = required.filter((name) => !present.has(name));
  if (missing.length) throw new Error(`Database is not migrated for M5B.2.4 acceptance. Missing: ${missing.join(', ')}`);
}

async function createFixture(pool, capabilityId, runId, suffix = 'primary') {
  const user = await pool.query(
    `INSERT INTO app_user(external_subject,display_name) VALUES($1,$2) RETURNING id`,
    [`internal:telegraph-m5b24:${runId}:${suffix}`, 'AgentPlace Telegraph Acceptance'],
  );
  const ownerUserId = user.rows[0].id;
  const jobId = `job_m5b24_${runId}_${suffix}`;
  const conversationId = `conv_m5b24_${runId}_${suffix}`;
  const taskId = `task_m5b24_${runId}_${suffix}`;
  await pool.query(
    `INSERT INTO job(id,owner_user_id,title,goal,status,environment,kind,origin_type,current_stage)
     VALUES($1,$2,$3,$4,'RUNNING','testnet','research','agentplace','telegraph-live-acceptance')`,
    [jobId, ownerUserId, '[Internal] Telegraph M5B.2.4 acceptance', 'Validate one bounded Telegraph testnet x402 intelligence purchase and its AgentPlace evidence boundary.'],
  );
  await pool.query(
    `INSERT INTO conversation(id,owner_user_id,scope,job_id,title,title_source)
     VALUES($1,$2,'job',$3,$4,'auto')`,
    [conversationId, ownerUserId, jobId, '[Internal] Telegraph M5B.2.4 acceptance'],
  );
  await pool.query(
    `INSERT INTO intelligence_task(id,owner_user_id,conversation_id,user_message_id,scope,job_id,provider_preference,status,max_attempts)
     VALUES($1,$2,$3,$4,'job',$5,'auto','running',1)`,
    [taskId, ownerUserId, conversationId, `msg_m5b24_${runId}_${suffix}`, jobId],
  );
  const capability = await pool.query(`SELECT id FROM canonical_capability WHERE id=$1`, [capabilityId]);
  if (!capability.rows[0]) throw new Error(`Canonical capability ${capabilityId} is not present in the migrated database.`);
  return { ownerUserId, jobId, conversationId, taskId };
}

async function createSecondTask(pool, fixture, runId) {
  const taskId = `task_m5b24_${runId}_budget`;
  await pool.query(
    `INSERT INTO intelligence_task(id,owner_user_id,conversation_id,user_message_id,scope,job_id,provider_preference,status,max_attempts)
     VALUES($1,$2,$3,$4,'job',$5,'auto','running',1)`,
    [taskId, fixture.ownerUserId, fixture.conversationId, `msg_m5b24_${runId}_budget`, fixture.jobId],
  );
  return taskId;
}

async function ledgerSummary(pool, fixture) {
  const result = await pool.query(
    `SELECT id,status,amount_atomic::text,payment_network,asset_address,pay_to,payer_address,transaction_hash,error_code,created_at,updated_at
     FROM telegraph_service_payment
     WHERE owner_user_id=$1 AND job_id=$2
     ORDER BY created_at,id`,
    [fixture.ownerUserId, fixture.jobId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    status: row.status,
    amountAtomic: row.amount_atomic,
    paymentNetwork: row.payment_network,
    assetAddress: row.asset_address,
    payTo: row.pay_to,
    payerAddress: row.payer_address,
    transactionHash: row.transaction_hash ?? null,
    errorCode: row.error_code ?? null,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  }));
}

function subjectFingerprint(subject) {
  return createHash('sha256').update(JSON.stringify(subject)).digest('hex');
}

async function main() {
  requireLiveGate();
  const status = telegraphServicePaymentStatusFromEnv(process.env);
  if (!status.ready) throw new Error(status.reason ?? 'Telegraph service payment is not ready.');
  const implementationId = (process.env.TELEGRAPH_ACCEPTANCE_IMPLEMENTATION_ID ?? '').trim();
  if (!implementationId) throw new Error('TELEGRAPH_ACCEPTANCE_IMPLEMENTATION_ID is required. Run pnpm telegraph:acceptance:plan first and choose one exact candidate.');
  const subject = subjectFromEnv();
  const catalog = await loadTelegraphRuntimeCatalog({ env: process.env, forceRefresh: true });
  if (catalog.snapshot.status === 'unavailable') throw new Error('Current Telegraph discovery is unavailable; live acceptance cannot proceed.');
  const mapping = catalog.mappings.find((item) => item.implementationId === implementationId && item.routerReady);
  if (!mapping) throw new Error('The chosen Telegraph implementation is not currently present as a router-ready live mapping. Re-run the acceptance plan.');
  const binding = bindTelegraphSubjectPayload(mapping, subject);
  if (!binding.ok) throw new Error(binding.reason ?? 'The selected mapping cannot safely bind the acceptance subject.');

  const runId = randomUUID().replaceAll('-', '').slice(0, 16);
  const pool = getDatabasePool();
  await assertAcceptanceSchemaReady(pool);
  const fixture = await createFixture(pool, mapping.canonicalCapabilityId, runId);

  const baseInput = {
    ownerUserId: fixture.ownerUserId,
    jobId: fixture.jobId,
    taskId: fixture.taskId,
    capabilityId: mapping.canonicalCapabilityId,
    implementationId: mapping.implementationId,
    subject,
    env: process.env,
  };

  let evidence;
  let duplicateEvidence;
  let budgetEvidence;
  let rows = [];
  try {
    evidence = await normalizeTelegraphMappedInvocation(baseInput);
    const payment = safePayment(evidence);
    if (evidence.provider !== 'telegraph') throw new Error('Normalized evidence provider mismatch.');
    if (evidence.derivationVersion !== 'telegraph-testnet-evidence-v1') throw new Error('Normalized evidence derivation version mismatch.');
    if (!payment || payment.status !== 'settled' || !payment.transactionHash) {
      throw new Error('Live paid inference did not return a confirmed settled x402 payment with transaction hash; M5B.2.4 must remain unfrozen.');
    }
    if (!['verified', 'partial'].includes(evidence.status)) {
      throw new Error(`Live Telegraph evidence status was ${evidence.status}; successful live acceptance requires verified or partial evidence.`);
    }

    // Replay the exact request. The runtime may fetch a fresh 402 challenge, but
    // the owner/job/request fingerprint reservation must prevent a second paid send.
    duplicateEvidence = await normalizeTelegraphMappedInvocation(baseInput);
    const duplicatePayment = safePayment(duplicateEvidence);
    if (duplicatePayment?.status === 'settled') {
      throw new Error('Duplicate-payment protection failed: the exact acceptance request settled a second payment.');
    }
    if (!/duplicate|not authorized by agentplace service-spend policy/i.test(duplicateEvidence.summary + ' ' + JSON.stringify(duplicateEvidence.data))) {
      throw new Error('The duplicate acceptance request did not fail through the expected replay-safe service-spend boundary.');
    }

    // A second task in the same Job is forced under a 1-atomic-unit Job cap.
    // Because the first settled payment already consumes >= 1 atomic unit, this
    // must reject before a second paid request can be sent.
    const budgetTaskId = await createSecondTask(pool, fixture, runId);
    const constrainedEnv = {
      ...process.env,
      TELEGRAPH_X402_MAX_JOB_USDC: '0.000001',
      TELEGRAPH_X402_MAX_CALLS_PER_JOB: '1',
    };
    budgetEvidence = await normalizeTelegraphMappedInvocation({ ...baseInput, taskId: budgetTaskId, env: constrainedEnv });
    const budgetPayment = safePayment(budgetEvidence);
    if (budgetPayment?.status === 'settled') {
      throw new Error('Job-budget rejection failed: the constrained probe settled an additional payment.');
    }
    if (!/TELEGRAPH_PAYMENT_JOB_LIMIT|TELEGRAPH_PAYMENT_JOB_CALL_LIMIT|service-spend policy/i.test(budgetEvidence.summary + ' ' + JSON.stringify(budgetEvidence.data))) {
      throw new Error('The constrained probe did not fail through the expected Job service-spend limit.');
    }

    rows = await ledgerSummary(pool, fixture);
    const settledRows = rows.filter((row) => row.status === 'settled');
    if (settledRows.length !== 1) throw new Error(`Expected exactly one settled service-payment row, found ${settledRows.length}.`);
    if (rows.some((row) => row.paymentNetwork !== 'eip155:84532')) throw new Error('Acceptance ledger contains a payment outside the pinned Base Sepolia network.');

    await pool.query(`UPDATE intelligence_task SET status='completed',completed_at=now(),updated_at=now() WHERE id=$1`, [fixture.taskId]);
    await pool.query(`UPDATE job SET status='COMPLETED',current_stage='telegraph-live-acceptance-passed',updated_at=now() WHERE id=$1`, [fixture.jobId]);

    const settlementPayment = safePayment(evidence);
    const output = {
      milestone: 'M5B.2.4',
      mode: 'live-testnet-acceptance',
      passed: true,
      freezeEligible: true,
      generatedAt: new Date().toISOString(),
      runId,
      discovery: {
        status: catalog.snapshot.status,
        provider: catalog.snapshot.provider,
        environment: catalog.snapshot.environment,
        trustLevel: catalog.snapshot.trustLevel,
        executionAuthority: catalog.snapshot.executionAuthority,
        protocolNetwork: catalog.snapshot.protocolNetwork,
        routerReadyMappings: catalog.mappings.filter((item) => item.routerReady).length,
      },
      paymentBoundary: {
        network: status.network,
        caip2Network: status.caip2Network,
        asset: status.asset,
        payerAddress: status.payerAddress ?? null,
        maxCallUsdc: status.maxCallUsdc,
        maxJobUsdc: status.maxJobUsdc,
        maxCallsPerJob: status.maxCallsPerJob,
      },
      selection: {
        implementationId: mapping.implementationId,
        capabilityId: mapping.canonicalCapabilityId,
        serviceId: mapping.service.id,
        serviceSlug: mapping.service.slug,
        endpoint: mapping.endpoint ? `${mapping.endpoint.method ?? 'ANY'} ${mapping.endpoint.path}` : null,
        subjectFingerprint: subjectFingerprint(subject),
      },
      settlement: settlementPayment ?? null,
      evidence: {
        provider: evidence.provider,
        status: evidence.status,
        derivationVersion: evidence.derivationVersion,
        service: safeService(evidence) ?? null,
        sourceUrl: evidence.sourceUrl ?? null,
        limitationsCount: evidence.limitations.length,
      },
      replayProtection: {
        passed: true,
        duplicateEvidenceStatus: duplicateEvidence.status,
      },
      jobBudgetProtection: {
        passed: true,
        constrainedEvidenceStatus: budgetEvidence.status,
      },
      ledger: {
        ownerUserId: fixture.ownerUserId,
        jobId: fixture.jobId,
        rows,
        settledCount: rows.filter((row) => row.status === 'settled').length,
      },
      authorityBoundary: {
        executionAuthority: 'none',
        userWalletAuthorityGranted: false,
        agentAccountAuthorityGranted: false,
        providerSecretsForwarded: false,
      },
      note: 'This report intentionally omits the private key, payment authorization signature, nonce, raw prompt/query and raw provider result.',
    };
    console.log(JSON.stringify(output, null, 2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    try {
      rows = await ledgerSummary(pool, fixture);
      await pool.query(`UPDATE intelligence_task SET status='failed',last_error=$2,completed_at=now(),updated_at=now() WHERE id=$1`, [fixture.taskId, message.slice(0, 2000)]);
      await pool.query(`UPDATE job SET status='FAILED_RECOVERABLE',current_stage='telegraph-live-acceptance-failed',updated_at=now() WHERE id=$1`, [fixture.jobId]);
    } catch {
      // Preserve the primary acceptance error; database follow-up is best effort.
    }
    console.error(JSON.stringify({
      milestone: 'M5B.2.4',
      mode: 'live-testnet-acceptance',
      passed: false,
      freezeEligible: false,
      generatedAt: new Date().toISOString(),
      runId,
      error: message,
      ledgerRows: rows,
      note: 'M5B.2 must remain unfrozen after a failed live acceptance run. Do not retry an unknown paid request automatically.',
    }, null, 2));
    process.exitCode = 1;
  }
}

try {
  await main();
} finally {
  await closeDatabasePool().catch(() => {});
}
