import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import {
  createRequestId,
  parseEnvironmentContract,
  type ApiHealthResponse,
  type PublicRuntimeConfig,
} from '@agent-place/shared';
import { service } from './index.js';

const environment = parseEnvironmentContract(process.env);
const host = process.env.API_HOST?.trim() || '127.0.0.1';
const port = Number.parseInt(process.env.API_PORT ?? '8787', 10);

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
    res.setHeader('vary', 'Origin');
  }
  res.setHeader('access-control-allow-methods', 'GET,OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type,x-agent-place-trace-id');
}

function writeJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(`${JSON.stringify(body)}\n`);
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

  if (req.method === 'GET' && url.pathname === '/health') {
    const body: ApiHealthResponse = {
      service: service.name,
      version: service.version,
      milestone: service.milestone,
      status: 'ok',
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
    };
    writeJson(res, 200, body);
    return;
  }

  writeJson(res, 404, {
    error: 'not_found',
    message: 'The requested AgentPlace API resource does not exist.',
    requestId,
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
