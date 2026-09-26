import { createHash } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import {
  getAuthAvailability,
  getAuthNodeHandler,
  requireAgentPlaceIdentity,
  toAuthHeaders,
} from '@agent-place/auth';
import {
  addMessage,
  createConversation,
  getConversation,
  importConversations,
  listConversations,
  patchConversation,
  patchMessage,
  type ConversationDraft,
  type DurableConversationMessage,
} from '@agent-place/context';
import { checkDatabase } from '@agent-place/db';
import { createJob, getJob, jobStatuses, listActivity, listJobs, setJobConversation, type JobDraft } from '@agent-place/jobs';
import { getUserWorker, installWorker, listUserWorkers, listWorkerCatalog, updateUserWorker, type UserWorkerStatus } from '@agent-place/workers';
import {
  createRequestId,
  parseEnvironmentContract,
  type ApiHealthResponse,
  type PublicRuntimeConfig,
} from '@agent-place/shared';
import { service } from './index.js';

const environment = parseEnvironmentContract(process.env);
const host = process.env.API_HOST?.trim() || (process.env.RAILWAY_ENVIRONMENT ? '0.0.0.0' : '127.0.0.1');
const port = Number.parseInt(process.env.API_PORT ?? process.env.PORT ?? '8787', 10);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`Invalid API_PORT: ${process.env.API_PORT ?? ''}`);
}

const allowedOrigins = new Set(
  (process.env.WEB_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
);

function writeCors(req: IncomingMessage, res: ServerResponse): void {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('access-control-allow-origin', origin);
    res.setHeader('access-control-allow-credentials', 'true');
    res.setHeader('vary', 'Origin');
  }
  res.setHeader('access-control-allow-methods', 'GET,POST,PATCH,OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type,x-agent-place-trace-id');
}

function writeJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(`${JSON.stringify(body)}\n`);
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  let total = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > 2 * 1024 * 1024) throw new Error('PAYLOAD_TOO_LARGE');
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new Error('INVALID_JSON');
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_BODY');
  return value as Record<string, unknown>;
}

function isMessage(value: unknown): value is DurableConversationMessage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string'
    && (v.role === 'user' || v.role === 'manager' || v.role === 'specialist')
    && typeof v.content === 'string'
    && typeof v.createdAt === 'string'
    && typeof v.updatedAt === 'string';
}

function isConversationDraft(value: unknown): value is ConversationDraft {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string'
    && v.id.length <= 128
    && (v.scope === 'manager' || v.scope === 'worker' || v.scope === 'job')
    && typeof v.title === 'string'
    && v.title.length > 0
    && v.title.length <= 200
    && (v.titleSource === 'auto' || v.titleSource === 'user')
    && typeof v.pinned === 'boolean'
    && typeof v.archived === 'boolean'
    && typeof v.createdAt === 'string'
    && (v.scope !== 'worker' || (typeof v.workerId === 'string' && v.workerId.length > 0 && v.workerId.length <= 128))
    && (v.scope !== 'job' || (typeof v.jobId === 'string' && v.jobId.length > 0 && v.jobId.length <= 128))
    && Array.isArray(v.messages)
    && v.messages.length <= 500
    && v.messages.every(isMessage);
}



const workerStatuses = new Set<UserWorkerStatus>(['working','monitoring','standby','needs-you','paused','limited','blocked','issue','removed']);
const jobStatusSet = new Set<string>(jobStatuses);

function asOptionalString(value: unknown, max = 500): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string' || value.length > max) throw new Error('INVALID_STRING');
  return value;
}

function isJobDraft(value: unknown): value is JobDraft {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== 'string' || !v.id || v.id.length > 128) return false;
  if (typeof v.title !== 'string' || !v.title.trim() || v.title.length > 200) return false;
  if (typeof v.goal !== 'string' || !v.goal.trim() || v.goal.length > 4000) return false;
  if (typeof v.status !== 'string' || !jobStatusSet.has(v.status)) return false;
  if (v.environment !== 'mainnet' && v.environment !== 'testnet') return false;
  if (v.kind !== 'research' && v.kind !== 'operational' && v.kind !== 'financial') return false;
  if (v.originType !== 'user' && v.originType !== 'worker' && v.originType !== 'routine' && v.originType !== 'agentplace') return false;
  if (typeof v.leadWorkerId !== 'string' || !v.leadWorkerId || v.leadWorkerId.length > 128) return false;
  if (!Array.isArray(v.supportingWorkerIds) || v.supportingWorkerIds.length > 16 || !v.supportingWorkerIds.every((x) => typeof x === 'string' && x.length > 0 && x.length <= 128)) return false;
  if (typeof v.currentStage !== 'string' || !v.currentStage || v.currentStage.length > 200) return false;
  if (!Array.isArray(v.stages) || v.stages.length > 64) return false;
  if (!v.stages.every((stage) => {
    if (!stage || typeof stage !== 'object' || Array.isArray(stage)) return false;
    const row = stage as Record<string, unknown>;
    return typeof row.id === 'string' && row.id.length > 0 && row.id.length <= 128
      && typeof row.label === 'string' && row.label.length > 0 && row.label.length <= 200
      && Number.isInteger(row.ordinal) && Number(row.ordinal) >= 0
      && (row.status === 'done' || row.status === 'active' || row.status === 'pending');
  })) return false;
  for (const key of ['originWorkerId','originConversationId','jobConversationId','createdAt','updatedAt']) {
    if (v[key] !== undefined && v[key] !== null && typeof v[key] !== 'string') return false;
  }
  return true;
}


function scopedId(prefix: string, ownerUserId: string, objectId: string): string {
  const digest = createHash('sha256').update(`${ownerUserId}:${objectId}`).digest('hex').slice(0, 24);
  return `${prefix}_${digest}`;
}

async function requireIdentity(req: IncomingMessage) {
  return requireAgentPlaceIdentity(toAuthHeaders(req.headers));
}

async function handleApi(req: IncomingMessage, res: ServerResponse, url: URL, requestId: string): Promise<void> {
  if (req.method === 'GET' && url.pathname === '/health') {
    const auth = getAuthAvailability();
    const dbOk = !process.env.DATABASE_URL?.trim() ? false : await checkDatabase();
    const body: ApiHealthResponse = {
      service: service.name,
      version: service.version,
      milestone: service.milestone,
      status: auth.configured && !dbOk ? 'degraded' : 'ok',
      environment: environment.environment,
      timestamp: new Date().toISOString(),
    };
    writeJson(res, 200, body);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/v1/config') {
    const body: PublicRuntimeConfig = {
      apiVersion: 'v1',
      serviceVersion: service.version,
      milestone: service.milestone,
      deploymentEnvironment: environment.environment,
      execution: {
        testnetEnabled: environment.testnetExecutionEnabled,
        mainnetEnabled: environment.mainnetExecutionEnabled,
        mainnetAutonomyEnabled: environment.mainnetAutonomyEnabled,
      },
      auth: getAuthAvailability(),
    };
    writeJson(res, 200, body);
    return;
  }

  if (url.pathname.startsWith('/api/auth/')) {
    if (!getAuthAvailability().configured) {
      writeJson(res, 503, { error: 'auth_not_configured', message: 'AgentPlace authentication is not configured.', requestId });
      return;
    }
    await getAuthNodeHandler()(req, res);
    return;
  }

  if (url.pathname === '/api/v1/me' && req.method === 'GET') {
    const identity = await requireIdentity(req);
    writeJson(res, 200, { user: identity });
    return;
  }



  if (url.pathname === '/api/v1/worker-catalog' && req.method === 'GET') {
    await requireIdentity(req);
    const workers = await listWorkerCatalog();
    writeJson(res, 200, { workers });
    return;
  }

  if (url.pathname === '/api/v1/workers' && req.method === 'GET') {
    const identity = await requireIdentity(req);
    const workers = await listUserWorkers(identity.appUserId);
    writeJson(res, 200, { workers });
    return;
  }

  if (url.pathname === '/api/v1/workers' && req.method === 'POST') {
    const identity = await requireIdentity(req);
    const body = asRecord(await readJson(req));
    if (typeof body.definitionId !== 'string' || !body.definitionId || body.definitionId.length > 128) throw new Error('INVALID_WORKER_DEFINITION');
    let worker = await installWorker(identity.appUserId, body.definitionId);
    const conversationId = scopedId('workerconv', identity.appUserId, worker.id);
    await createConversation(identity.appUserId, {
      id: conversationId,
      scope: 'worker',
      workerId: worker.id,
      title: worker.name,
      titleSource: 'auto',
      pinned: false,
      archived: false,
      createdAt: new Date().toISOString(),
      messages: [],
    });
    worker = (await updateUserWorker(identity.appUserId, worker.id, { primaryConversationId: conversationId })) ?? worker;
    writeJson(res, 201, { worker });
    return;
  }

  const workerMatch = url.pathname.match(/^\/api\/v1\/workers\/([^/]+)$/);
  if (workerMatch) {
    const workerId = decodeURIComponent(workerMatch[1] ?? '');
    const identity = await requireIdentity(req);
    if (req.method === 'GET') {
      const worker = await getUserWorker(identity.appUserId, workerId);
      if (!worker || worker.status === 'removed') return writeJson(res, 404, { error: 'not_found', message: 'Worker not found.', requestId });
      writeJson(res, 200, { worker });
      return;
    }
    if (req.method === 'PATCH') {
      const body = asRecord(await readJson(req));
      const patch: { status?: UserWorkerStatus; currentFocus?: string | null; currentJobId?: string | null } = {};
      if (body.status !== undefined) {
        if (typeof body.status !== 'string' || !workerStatuses.has(body.status as UserWorkerStatus)) throw new Error('INVALID_WORKER_STATUS');
        patch.status = body.status as UserWorkerStatus;
      }
      if (body.currentFocus !== undefined) {
        if (body.currentFocus === null) patch.currentFocus = null;
        else { const value = asOptionalString(body.currentFocus, 1000); if (value !== undefined) patch.currentFocus = value; }
      }
      if (body.currentJobId !== undefined) {
        if (body.currentJobId === null) patch.currentJobId = null;
        else { const value = asOptionalString(body.currentJobId, 128); if (value !== undefined) patch.currentJobId = value; }
      }
      const worker = await updateUserWorker(identity.appUserId, workerId, patch);
      if (!worker) return writeJson(res, 404, { error: 'not_found', message: 'Worker not found.', requestId });
      writeJson(res, 200, { worker });
      return;
    }
  }

  if (url.pathname === '/api/v1/jobs' && req.method === 'GET') {
    const identity = await requireIdentity(req);
    const jobs = await listJobs(identity.appUserId);
    writeJson(res, 200, { jobs });
    return;
  }

  if (url.pathname === '/api/v1/jobs' && req.method === 'POST') {
    const identity = await requireIdentity(req);
    const body = asRecord(await readJson(req));
    if (!isJobDraft(body.job)) throw new Error('INVALID_JOB');
    let job = await createJob(identity.appUserId, body.job);
    const conversationId = job.jobConversationId ?? `job-${job.id}`;
    await createConversation(identity.appUserId, {
      id: conversationId,
      scope: 'job',
      jobId: job.id,
      title: job.title,
      titleSource: 'auto',
      pinned: false,
      archived: false,
      createdAt: job.createdAt,
      messages: [],
    });
    job = (await setJobConversation(identity.appUserId, job.id, conversationId)) ?? job;
    writeJson(res, 201, { job });
    return;
  }

  const jobMatch = url.pathname.match(/^\/api\/v1\/jobs\/([^/]+)$/);
  if (jobMatch && req.method === 'GET') {
    const identity = await requireIdentity(req);
    const job = await getJob(identity.appUserId, decodeURIComponent(jobMatch[1] ?? ''));
    if (!job) return writeJson(res, 404, { error: 'not_found', message: 'Job not found.', requestId });
    writeJson(res, 200, { job });
    return;
  }

  if (url.pathname === '/api/v1/activity' && req.method === 'GET') {
    const identity = await requireIdentity(req);
    const activity = await listActivity(identity.appUserId);
    writeJson(res, 200, { activity });
    return;
  }

  if (url.pathname === '/api/v1/conversations' && req.method === 'GET') {
    const identity = await requireIdentity(req);
    const query = url.searchParams.get('q')?.trim().slice(0, 200);
    const conversations = await listConversations(identity.appUserId, query || undefined);
    writeJson(res, 200, { conversations });
    return;
  }

  if (url.pathname === '/api/v1/conversations' && req.method === 'POST') {
    const identity = await requireIdentity(req);
    const body = asRecord(await readJson(req));
    if (!isConversationDraft(body.conversation)) throw new Error('INVALID_CONVERSATION');
    const conversation = await createConversation(identity.appUserId, body.conversation);
    writeJson(res, 201, { conversation });
    return;
  }

  if (url.pathname === '/api/v1/conversations/import' && req.method === 'POST') {
    const identity = await requireIdentity(req);
    const body = asRecord(await readJson(req));
    if (!Array.isArray(body.conversations) || body.conversations.length > 100 || !body.conversations.every(isConversationDraft)) {
      throw new Error('INVALID_CONVERSATION_IMPORT');
    }
    const conversations = await importConversations(identity.appUserId, body.conversations);
    writeJson(res, 200, { conversations });
    return;
  }

  const conversationMatch = url.pathname.match(/^\/api\/v1\/conversations\/([^/]+)$/);
  if (conversationMatch) {
    const id = decodeURIComponent(conversationMatch[1] ?? '');
    const identity = await requireIdentity(req);
    if (req.method === 'GET') {
      const conversation = await getConversation(identity.appUserId, id);
      if (!conversation) return writeJson(res, 404, { error: 'not_found', message: 'Conversation not found.', requestId });
      writeJson(res, 200, { conversation });
      return;
    }
    if (req.method === 'PATCH') {
      const body = asRecord(await readJson(req));
      const patch: { title?: string; titleSource?: 'auto' | 'user'; pinned?: boolean; archived?: boolean } = {};
      if (body.title !== undefined) {
        if (typeof body.title !== 'string' || !body.title.trim() || body.title.length > 200) throw new Error('INVALID_TITLE');
        patch.title = body.title.trim();
      }
      if (body.titleSource !== undefined) {
        if (body.titleSource !== 'auto' && body.titleSource !== 'user') throw new Error('INVALID_TITLE_SOURCE');
        patch.titleSource = body.titleSource;
      }
      if (body.pinned !== undefined) {
        if (typeof body.pinned !== 'boolean') throw new Error('INVALID_PIN');
        patch.pinned = body.pinned;
      }
      if (body.archived !== undefined) {
        if (typeof body.archived !== 'boolean') throw new Error('INVALID_ARCHIVE');
        patch.archived = body.archived;
      }
      const conversation = await patchConversation(identity.appUserId, id, patch);
      if (!conversation) return writeJson(res, 404, { error: 'not_found', message: 'Conversation not found.', requestId });
      writeJson(res, 200, { conversation });
      return;
    }
  }

  const messagesMatch = url.pathname.match(/^\/api\/v1\/conversations\/([^/]+)\/messages$/);
  if (messagesMatch && req.method === 'POST') {
    const conversationId = decodeURIComponent(messagesMatch[1] ?? '');
    const identity = await requireIdentity(req);
    const body = asRecord(await readJson(req));
    if (!isMessage(body.message)) throw new Error('INVALID_MESSAGE');
    const message = await addMessage(identity.appUserId, conversationId, body.message);
    if (!message) return writeJson(res, 404, { error: 'not_found', message: 'Conversation not found.', requestId });
    writeJson(res, 201, { message });
    return;
  }

  const messageMatch = url.pathname.match(/^\/api\/v1\/conversations\/([^/]+)\/messages\/([^/]+)$/);
  if (messageMatch && req.method === 'PATCH') {
    const conversationId = decodeURIComponent(messageMatch[1] ?? '');
    const messageId = decodeURIComponent(messageMatch[2] ?? '');
    const identity = await requireIdentity(req);
    const body = asRecord(await readJson(req));
    if (typeof body.content !== 'string' || typeof body.updatedAt !== 'string') throw new Error('INVALID_MESSAGE_UPDATE');
    const updated = await patchMessage(identity.appUserId, conversationId, messageId, { content: body.content, updatedAt: body.updatedAt });
    if (!updated) return writeJson(res, 404, { error: 'not_found', message: 'Message not found.', requestId });
    writeJson(res, 200, { ok: true });
    return;
  }

  writeJson(res, 404, {
    error: 'not_found',
    message: 'The requested AgentPlace API resource does not exist.',
    requestId,
  });
}

const server = createServer((req, res) => {
  const requestId = createRequestId();
  res.setHeader('x-agent-place-request-id', requestId);
  writeCors(req, res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? `${host}:${port}`}`);
  void handleApi(req, res, url, requestId).catch((error: unknown) => {
    if (res.headersSent) {
      res.end();
      return;
    }
    const code = error instanceof Error ? error.message : 'INTERNAL_ERROR';
    if (code === 'UNAUTHENTICATED') {
      writeJson(res, 401, { error: 'unauthenticated', message: 'Sign in to continue.', requestId });
      return;
    }
    if (['INVALID_JSON','INVALID_BODY','INVALID_CONVERSATION','INVALID_CONVERSATION_IMPORT','INVALID_TITLE','INVALID_TITLE_SOURCE','INVALID_PIN','INVALID_ARCHIVE','INVALID_MESSAGE','INVALID_MESSAGE_UPDATE','INVALID_WORKER_DEFINITION','INVALID_WORKER_STATUS','INVALID_JOB','INVALID_STRING','JOB_LEAD_REQUIRED','JOB_WORKER_NOT_AVAILABLE','WORKER_DEFINITION_NOT_FOUND'].includes(code)) {
      writeJson(res, 400, { error: 'invalid_request', message: code, requestId });
      return;
    }
    if (code === 'PAYLOAD_TOO_LARGE') {
      writeJson(res, 413, { error: 'payload_too_large', message: code, requestId });
      return;
    }
    process.stderr.write(`${JSON.stringify({ level: 'error', service: service.name, requestId, message: 'Request failed', error: code })}\n`);
    writeJson(res, 500, { error: 'internal_error', message: 'AgentPlace could not complete this request.', requestId });
  });
});

server.listen(port, host, () => {
  process.stdout.write(
    `${JSON.stringify({
      level: 'info',
      service: service.name,
      version: service.version,
      milestone: service.milestone,
      message: 'AgentPlace API listening',
      host,
      port,
      environment: environment.environment,
    })}\n`,
  );
});
