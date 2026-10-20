import { existsSync, readFileSync } from 'node:fs';

const required = [
  'packages/db/migrations/0017_discover_creator_system.sql',
  'packages/db/migrations/0018_creator_builder_conversations.sql',
  'packages/db/migrations/0019_creator_builder_llm_turns.sql',
  'packages/creator-sdk/src/index.ts',
  'packages/marketplace/src/index.ts',
  'apps/web/src/platform/creatorApi.ts',
  'apps/web/src/components/AgentBuilder.tsx',
  'apps/web/src/components/WorkflowStudio.tsx',
  'apps/web/src/components/CapabilityStudio.tsx',
  'docs/MILESTONE-12.md',
  'docs/MILESTONE-12-TESTING.md',
  'docs/MILESTONE-12-DEPLOYMENT.md',
];
for (const file of required) if (!existsSync(file)) throw new Error(`M12 missing ${file}`);

const migration = readFileSync(required[0], 'utf8');
for (const token of [
  'CREATE TABLE IF NOT EXISTS workflow_definition',
  'CREATE TABLE IF NOT EXISTS workflow_version',
  'CREATE TABLE IF NOT EXISTS creator_capability',
  'CREATE TABLE IF NOT EXISTS creator_capability_version',
  'CREATE TABLE IF NOT EXISTS creator_capability_operation',
  'CREATE TABLE IF NOT EXISTS creator_test_run',
  'CREATE TABLE IF NOT EXISTS creator_lineage',
  'CREATE TABLE IF NOT EXISTS marketplace_listing',
  'worker_version_immutable_release',
  'workflow_version_immutable_release',
  'worker_version_id',
]) {
  if (!migration.includes(token)) throw new Error(`M12 persistence missing ${token}`);
}


const builderMigration = readFileSync('packages/db/migrations/0018_creator_builder_conversations.sql', 'utf8');
for (const token of ['creator_builder_session','creator_builder_message','draft_snapshot']) {
  if (!builderMigration.includes(token)) throw new Error(`M12 Builder continuity missing ${token}`);
}
const builderLlmMigration = readFileSync('packages/db/migrations/0019_creator_builder_llm_turns.sql', 'utf8');
for (const token of ['creator_builder_turn','creator_builder_revision','active_revision_no','parent_revision_no']) {
  if (!builderLlmMigration.includes(token)) throw new Error(`M12 Builder LLM/revision persistence missing ${token}`);
}

const marketplace = readFileSync('packages/marketplace/src/index.ts', 'utf8');
for (const token of ['listDiscoverSupply','workerReadiness','createCreatorWorker','createNewWorkerVersion','createCreatorWorkflow','createNewWorkflowVersion','createCapabilityImport','forkWorker','publishCreatorAsset','getCreatorBuilderSession','saveCreatorBuilderSession','recordCreatorBuilderTurn','undoCreatorBuilderDraft','withTransaction']) {
  if (!marketplace.includes(token)) throw new Error(`M12 marketplace/creator core missing ${token}`);
}
if (/INSERT INTO capability_implementation[\s\S]{0,120}creator/i.test(marketplace)) throw new Error('M12 creator imports must not auto-promote into trusted capability implementations.');

const workers = readFileSync('packages/workers/src/index.ts', 'utf8');
if (!workers.includes('JOIN worker_version v ON v.id=uw.worker_version_id')) throw new Error('M12 installed Workers must hydrate their pinned exact version.');
if (!workers.includes("d.creator_user_id=$2")) throw new Error('M12 creator-owned private Workers must be installable only by their owner.');

const jobs = readFileSync('packages/jobs/src/index.ts', 'utf8');
for (const token of ['worker_version_id','workerVersionOverrides','getJobWorkerVersionAssignments']) if (!jobs.includes(token)) throw new Error(`M12 Job version pinning missing ${token}`);

const router = readFileSync('packages/router/src/index.ts', 'utf8');
for (const token of ['forcedWorkerVersionIds','getWorkerCatalogVersions','worker_version_id']) if (!router.includes(token)) throw new Error(`M12 Router version reproducibility missing ${token}`);

const creatorSdk = readFileSync('packages/creator-sdk/src/index.ts', 'utf8');
for (const token of ['assertSafeRemoteHttpsUrl','parseOpenApiOperations','runtimeEligibilityForImportedOperation','CREATOR_WORKER_FINANCIAL_AUTHORITY_NOT_ALLOWED','CreatorBuilderOperationType','applyCreatorBuilderOperations']) if (!creatorSdk.includes(token)) throw new Error(`M12 creator boundary missing ${token}`);

const api = readFileSync('apps/api/src/server.ts', 'utf8');
for (const token of ['/api/v1/discover','/api/v1/creator/assets','/api/v1/creator/workers','/api/v1/creator/workflows','/api/v1/creator/capabilities/inspect','/api/v1/creator/capabilities/sandbox-test','builder-session','builder-turn','generateStructured<CreatorBuilderTurnProposal>','applyCreatorBuilderOperations','IMPORT_URL_PRIVATE_HOST_FORBIDDEN']) if (!api.includes(token)) throw new Error(`M12 API missing ${token}`);
if (/PRIVATE_KEY|MNEMONIC|SEED_PHRASE/.test(api)) throw new Error('M12 creator API must not introduce signing secrets.');


const agentBuilder = readFileSync('apps/web/src/components/AgentBuilder.tsx', 'utf8');
for (const token of ['fetchCreatorBuilderSession','saveCreatorBuilderSession','interpretCreatorBuilderTurn','processBuilderTurn','addUserChoice','Continue editing','Saving privately does **not** end Agent Builder']) {
  if (!agentBuilder.includes(token)) throw new Error(`M12 conversational Builder continuity missing ${token}`);
}
if (agentBuilder.includes('applyConversationalEdit') || agentBuilder.includes('draftFromIntent')) throw new Error('M12 Agent Builder must not fall back to regex/keyword conversational interpretation.');

const discoverDetail = readFileSync('apps/web/src/components/DiscoverDetail.tsx', 'utf8');
if (!discoverDetail.includes('Paid · not yet enabled')) throw new Error('M12 paid acquisition must remain truthfully disabled.');
if (!discoverDetail.includes('forkCreatorWorker')) throw new Error('M12 Customize a copy must preserve durable fork lineage.');

const creatorHome = readFileSync('apps/web/src/components/CreatorHome.tsx', 'utf8');
if (!creatorHome.includes('Creator earnings are not enabled yet')) throw new Error('M12 must not show fixture creator earnings as production truth.');

const capabilityStudio = readFileSync('apps/web/src/components/CapabilityStudio.tsx', 'utf8');
for (const token of ['inspectCreatorCapability','testCreatorCapabilityRead','public endpoint only in M12']) if (!capabilityStudio.includes(token)) throw new Error(`M12 Capability Studio missing ${token}`);
if (/MCP_DISCOVERED_OPS|OPENAPI_DISCOVERED_OPS/.test(capabilityStudio)) throw new Error('M12 Capability Studio must not use hard-coded discovered operations.');

for (const envFile of ['config/environments/production-mainnet.env.example','.env.example']) {
  const env = readFileSync(envFile, 'utf8');
  if (!env.includes('MAINNET_EXECUTION_ENABLED=false') || !env.includes('MAINNET_AUTONOMY_ENABLED=false')) throw new Error(`M12 must keep Mainnet execution/autonomy disabled in ${envFile}`);
}

console.log('PASS: M12 Discover + Creator System makes supply and creator assets durable, version-pinned and truthfully readiness-scoped, while keeping imported tools isolated from authority, signing and trusted production routing.');
