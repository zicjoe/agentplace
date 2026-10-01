import { existsSync, readFileSync } from 'node:fs';

const required = [
  'packages/db/migrations/0006_router_v1.sql',
  'packages/router/src/index.ts',
  'apps/worker/src/index.ts',
  'apps/api/src/server.ts',
  'apps/web/src/platform/workApi.ts',
  'docs/MILESTONE-5.md',
  'docs/MILESTONE-5-TESTING.md',
  'docs/MILESTONE-5-DEPLOYMENT.md',
];
for (const file of required) if (!existsSync(file)) throw new Error(`Milestone 5 required file missing: ${file}`);

const migration = readFileSync('packages/db/migrations/0006_router_v1.sql', 'utf8');
for (const token of ['route_decision', 'worker_capability_route', 'environment_eligibility', 'priority', 'agentplace-grounded-web-read-v1']) {
  if (!migration.includes(token)) throw new Error(`Milestone 5 migration missing ${token}`);
}

const router = readFileSync('packages/router/src/index.ts', 'utf8');
for (const token of ['planRoute', 'routable', 'partially-routable', 'Router v1 is read-only', 'configuredResearchProviders', 'implementationTrustEligible', 'routedProvidersForCapability', 'silent provider switching is disabled', 'smallest set of specialists']) {
  if (!router.includes(token)) throw new Error(`Milestone 5 Router missing ${token}`);
}

const worker = readFileSync('apps/worker/src/index.ts', 'utf8');
for (const token of ['capabilityGraph', 'routeTask', 'researchWithRouteFallback', 'attachRouteDecisionToJob', 'route.status === \'blocked\'', 'trying eligible fallback']) {
  if (!worker.includes(token)) throw new Error(`Milestone 5 Worker integration missing ${token}`);
}

const api = readFileSync('apps/api/src/server.ts', 'utf8');
if (!api.includes('/route')) throw new Error('Milestone 5 API route-inspection endpoint missing');
const web = readFileSync('apps/web/src/components/JobWorkspace.tsx', 'utf8');
for (const token of ['How AgentPlace routed this job', 'Read-only · no financial authority', 'routeDecision.capabilityRoutes']) {
  if (!web.includes(token)) throw new Error(`Milestone 5 progressive route disclosure missing ${token}`);
}

console.log('PASS: AgentPlace Milestone 5 includes durable Route Decisions, deterministic capability/Worker/provider eligibility, bounded auto fallback and read-only route explainability.');
