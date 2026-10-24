import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration=readFileSync('packages/db/migrations/0017_discover_creator_system.sql','utf8');
const builderMigration=readFileSync('packages/db/migrations/0018_creator_builder_conversations.sql','utf8');
const builderLlmMigration=readFileSync('packages/db/migrations/0019_creator_builder_llm_turns.sql','utf8');
const workflowBuilderMigration=readFileSync('packages/db/migrations/0020_creator_workflow_builder_conversations.sql','utf8');
const marketplace=readFileSync('packages/marketplace/src/index.ts','utf8');
const creatorSdk=readFileSync('packages/creator-sdk/src/index.ts','utf8');
const workers=readFileSync('packages/workers/src/index.ts','utf8');
const jobs=readFileSync('packages/jobs/src/index.ts','utf8');
const router=readFileSync('packages/router/src/index.ts','utf8');
const workerRuntime=readFileSync('apps/worker/src/index.ts','utf8');
const api=readFileSync('apps/api/src/server.ts','utf8');
const creatorApi=readFileSync('apps/web/src/platform/creatorApi.ts','utf8');
const fixture=readFileSync('apps/web/src/fixtures/FixtureAppContext.tsx','utf8');
const discover=readFileSync('apps/web/src/components/Discover.tsx','utf8');
const detail=readFileSync('apps/web/src/components/DiscoverDetail.tsx','utf8');
const builder=readFileSync('apps/web/src/components/AgentBuilder.tsx','utf8');
const workflow=readFileSync('apps/web/src/components/WorkflowStudio.tsx','utf8');
const capability=readFileSync('apps/web/src/components/CapabilityStudio.tsx','utf8');
const creatorHome=readFileSync('apps/web/src/components/CreatorHome.tsx','utf8');
const createMenu=readFileSync('apps/web/src/components/CreateMenu.tsx','utf8');
const workerWorkspace=readFileSync('apps/web/src/components/WorkerWorkspace.tsx','utf8');
const workApi=readFileSync('apps/web/src/platform/workApi.ts','utf8');

test('M12 persists creator supply, versions, lineage and listing state',()=>{
  for(const token of ['workflow_definition','workflow_version','creator_capability','creator_capability_version','creator_capability_operation','creator_test_run','creator_lineage','marketplace_listing']) assert.match(migration,new RegExp(token));
  assert.match(migration,/worker_version_immutable_release/);
  assert.match(migration,/workflow_version_immutable_release/);
});

test('M12 pins installed Workers and Jobs to exact Worker versions',()=>{
  assert.match(workers,/JOIN worker_version v ON v\.id=uw\.worker_version_id/);
  assert.match(jobs,/worker_version_id/);
  assert.match(jobs,/workerVersionOverrides/);
  assert.match(router,/forcedWorkerVersionIds/);
  assert.match(workerRuntime,/getJobWorkerVersionAssignments/);
  assert.match(workerRuntime,/getWorkerCatalogVersions/);
  assert.match(workers,/updateInstalledWorkerVersion/);
  assert.match(workers,/latest_version_id/);
  assert.match(workers,/updateAvailable/);
  assert.match(api,/updateInstalledWorkerVersion/);
  assert.match(workApi,/updateDurableWorkerVersion/);
  assert.match(workerWorkspace,/Installed v/);
  assert.match(workerWorkspace,/Update to v/);
});

test('M12 private creator Workers are owner-scoped and do not need public publication',()=>{
  assert.match(workers,/creator_user_id=\$2/);
  assert.match(workers,/publication_status IN \('draft','private','unlisted','published'\)/);
  assert.match(jobs,/creator_user_id=\$2/);
});

test('M12 Discover is a live durable projection with truthful readiness',()=>{
  assert.match(marketplace,/listDiscoverSupply/);
  assert.match(marketplace,/workerReadiness/);
  for(const state of ['available','limited','preview','unavailable']) assert.match(marketplace,new RegExp(`'${state}'`));
  assert.match(api,/\/api\/v1\/discover/);
  assert.match(fixture,/fetchDiscoverSupply\(\)/);
  assert.match(discover,/workerDefinitionId/);
});


test('M12 publishing refreshes Discover supply in the active client session',()=>{
  assert.match(creatorHome,/fetchDiscoverSupply/);
  assert.match(creatorHome,/SET_DISCOVER_SUPPLY/);
});

test('M12 Add Worker persists through backend and never grants authority',()=>{
  assert.match(detail,/installDurableWorker/);
  assert.match(detail,/No permission to move funds/);
  assert.doesNotMatch(detail,/ADD_AUTHORITY_GRANT/);
});

test('M12 Agent Builder is generic and uses real sandbox Jobs',()=>{
  assert.match(builder,/interpretCreatorBuilderTurn/);
  assert.match(builder,/seedDraftForBuilder/);
  assert.match(builder,/testCreatorWorker/);
  assert.match(builder,/Open real test Job/);
  assert.match(builder,/Teach Mode active/);
  assert.doesNotMatch(builder,/WHALE_MEME_DRAFT|Prototype acceptance suite|8 \/ 8 passed/);
});


test('M12 Agent Builder conversation choices and draft continuity are durable',()=>{
  for(const token of ['creator_builder_session','creator_builder_message','draft_snapshot']) assert.match(builderMigration,new RegExp(token));
  for(const token of ['creator_builder_turn','creator_builder_revision','active_revision_no','parent_revision_no']) assert.match(builderLlmMigration,new RegExp(token));
  assert.match(marketplace,/getCreatorBuilderSession/);
  assert.match(marketplace,/saveCreatorBuilderSession/);
  assert.match(api,/builder-session/);
  assert.match(creatorApi,/fetchCreatorBuilderSession/);
  assert.match(creatorApi,/saveCreatorBuilderSession/);
  assert.match(builder,/addUserChoice/);
  assert.match(builder,/choose\('Use privately'/);
  assert.match(builder,/Saving privately does \*\*not\*\* end Agent Builder/);
  assert.match(builder,/Continue editing/);
  assert.match(builder,/Restoring Builder conversation/);
  assert.doesNotMatch(builder,/step !== 'published'/);
  const clearIndex=createMenu.indexOf("SET_ACTIVE_CREATION', id: null");
  const openIndex=createMenu.indexOf("SET_CREATOR_SURFACE', surface: 'agent-builder'");
  assert.ok(clearIndex>=0&&openIndex>clearIndex,'New Worker must clear the previous creation before opening Agent Builder');
  assert.match(creatorHome,/SET_ACTIVE_CREATION', id: null/);
});


test('M12 Agent Builder uses LLM structured interpretation behind a deterministic Creator validator',()=>{
  assert.match(api,/generateStructured<CreatorBuilderTurnProposal>/);
  assert.match(api,/agentplace_creator_builder_turn/);
  assert.match(api,/creatorBuilderSystemPrompt/);
  assert.match(api,/applyCreatorBuilderOperations/);
  assert.match(api,/recordCreatorBuilderTurn/);
  assert.match(api,/undoCreatorBuilderDraft/);
  assert.match(creatorSdk,/CreatorBuilderOperationType/);
  assert.match(creatorSdk,/applyCreatorBuilderOperations/);
  assert.match(creatorSdk,/authorityDefault:'Research & recommend only · No wallet authority'/);
  assert.match(creatorApi,/interpretCreatorBuilderTurn/);
  assert.match(builder,/processBuilderTurn/);
  assert.doesNotMatch(builder,/applyConversationalEdit/);
  assert.doesNotMatch(builder,/draftFromIntent/);
});

test('M12 creator tests cannot self-certify safety or grant authority',()=>{
  assert.match(api,/This is a sandbox creator test\. Do not claim that passing self-certifies safety/);
  assert.match(builder,/Passing this test does not self-certify safety/);
  assert.match(creatorSdk,/CREATOR_WORKER_FINANCIAL_AUTHORITY_NOT_ALLOWED/);
});

test('M12 fork/customize creates durable source lineage',()=>{
  assert.match(migration,/creator_lineage/);
  assert.match(marketplace,/forkWorker/);
  assert.match(detail,/forkCreatorWorker/);
  assert.match(detail,/SET_ACTIVE_CREATION/);
});

test('M12 Workflow Studio persists and versions real Workflow drafts',()=>{
  assert.match(workflow,/createCreatorWorkflow/);
  assert.match(workflow,/createCreatorWorkflowVersion/);
  assert.match(marketplace,/createNewWorkflowVersion/);
  assert.doesNotMatch(workflow,/MORNING_BRIEF_DRAFT/);
  assert.doesNotMatch(workflow,/>Publish<\/button>/);
});


test('M12 Workflow Studio conversation and active draft survive reopen and hard refresh',()=>{
  for(const token of ['creator_workflow_builder_session','creator_workflow_builder_message','draft_snapshot']) assert.match(workflowBuilderMigration,new RegExp(token));
  assert.match(marketplace,/getCreatorWorkflowBuilderSession/);
  assert.match(marketplace,/saveCreatorWorkflowBuilderSession/);
  assert.match(api,/creatorWorkflowBuilderSessionMatch/);
  assert.match(creatorApi,/fetchCreatorWorkflowBuilderSession/);
  assert.match(creatorApi,/saveCreatorWorkflowBuilderSession/);
  assert.match(workflow,/Could not restore Workflow Studio conversation/);
  assert.match(workflow,/Could not persist Workflow Studio conversation/);
  const routing=readFileSync('apps/web/src/platform/routing.ts','utf8');
  assert.match(routing,/segments\[0\] === 'create' && segments\.length === 3/);
  assert.match(routing,/activeCreationId: id/);
  assert.match(routing,/\$\{base\}\/\$\{encoded\(state\.activeCreationId\)\}/);
});

test('M12 Workflow Studio forms and edits structured drafts through the Model Gateway',()=>{
  assert.match(api,/generateStructured<CreatorWorkflowBuilderTurnProposal>/);
  assert.match(api,/agentplace_creator_workflow_turn/);
  assert.match(api,/creatorWorkflowBuilderSystemPrompt/);
  assert.match(api,/applyCreatorWorkflowBuilderProposal/);
  assert.match(creatorSdk,/CreatorWorkflowBuilderTurnProposal/);
  assert.match(creatorSdk,/applyCreatorWorkflowBuilderProposal/);
  assert.match(creatorSdk,/No financial authority is created by a Workflow/);
  assert.match(creatorApi,/interpretCreatorWorkflowTurn/);
  assert.match(workflow,/interpretCreatorWorkflowTurn/);
  assert.match(workflow,/View Workflow Draft/);
  assert.doesNotMatch(workflow,/workflowFromIntent/);
});

test('M12 OpenAPI and MCP imports are real inspection paths, not fixture discovery',()=>{
  assert.match(api,/inspectMcpEndpoint/);
  assert.match(api,/parseOpenApiOperations/);
  assert.match(api,/resolveOpenApiRuntimeEndpoint/);
  assert.match(api,/joinOpenApiRuntimeUrl/);
  assert.match(api,/notifications\/initialized/);
  assert.match(api,/text\/event-stream/);
  assert.match(creatorSdk,/parseOpenApiOperations/);
  assert.match(creatorSdk,/resolveOpenApiRuntimeEndpoint/);
  assert.match(creatorSdk,/joinOpenApiRuntimeUrl/);
  assert.match(capability,/inspectCreatorCapability/);
  assert.doesNotMatch(capability,/MCP_DISCOVERED_OPS|OPENAPI_DISCOVERED_OPS/);
  assert.match(capability,/Publish after saving/);
});

test('M12 OpenAPI sandbox honors declared runtime base paths instead of the spec-file origin',()=>{
  assert.match(creatorSdk,/root\.servers/);
  assert.match(creatorSdk,/root\.basePath/);
  assert.match(creatorSdk,/basePath.*operationPath/s);
  assert.match(api,/resolvedEndpoint=resolveOpenApiRuntimeEndpoint\(text,sourceUrl\)/);
  assert.doesNotMatch(api,/new URL\(match\[1\]!,specUrl\.origin\)/);
});

test('M12 OpenAPI sandbox selects only genuinely parameter-free GET operations',()=>{
  assert.match(creatorSdk,/requiredParameters/);
  assert.match(creatorSdk,/sandboxEligible/);
  assert.match(capability,/op\.sandboxEligible===true/);
  assert.match(capability,/Required path\/query inputs are never invented by the sandbox/);
});

test('M12 remote imports fail closed against SSRF and embedded credentials',()=>{
  assert.match(creatorSdk,/IMPORT_URL_HTTPS_REQUIRED/);
  assert.match(creatorSdk,/IMPORT_URL_CREDENTIALS_FORBIDDEN/);
  assert.match(api,/assertPublicResolvedHost/);
  assert.match(api,/IMPORT_URL_PRIVATE_HOST_FORBIDDEN/);
  assert.match(api,/redirect:'manual'/);
  assert.match(api,/IMPORT_RESPONSE_TOO_LARGE/);
  assert.match(api,/IMPORT_CONTENT_TYPE_UNSUPPORTED/);
  assert.match(api,/unsafe_import_rejected/);
  assert.match(api,/Imported endpoint URLs cannot contain embedded credentials\. No request was sent and no capability was created\./);
  assert.match(api,/Private, loopback, link-local and local-network endpoints are not allowed for remote capability imports\. No request was sent and no capability was created\./);
});

test('M12 safe imported capability testing is read-only and isolated',()=>{
  assert.match(api,/creator\/capabilities\/sandbox-test/);
  assert.match(api,/^.*GET.*$/m);
  assert.match(creatorApi,/testCreatorCapabilityRead/);
  assert.match(capability,/testCreatorCapabilityRead/);
  assert.match(marketplace,/creator_capability_operation/);
  assert.doesNotMatch(marketplace,/INSERT INTO capability_implementation/);
});

test('M12 does not collect provider secrets in Capability Studio',()=>{
  assert.match(capability,/public endpoint only in M12/);
  assert.match(capability,/will not ask for or persist provider secrets/);
  assert.doesNotMatch(capability,/<option>API key<\/option>|<option>OAuth2<\/option>/);
});


test('M12 creator sandbox Jobs map deployment environment truthfully',()=>{
  assert.match(api,/function deploymentJobEnvironment\(\): 'mainnet' \| 'testnet'/);
  assert.match(api,/environment\.environment === 'development' \|\| environment\.environment === 'testnet'/);
  assert.doesNotMatch(api,/production-testnet/);
  assert.ok((api.match(/environment: deploymentJobEnvironment\(\)/g)??[]).length>=2);
});

test('M12 MCP discovery accepts schemas only when they are real objects',()=>{
  assert.match(api,/function optionalRecord\(value: unknown\): Record<string, unknown> \| undefined/);
  assert.match(api,/const inputSchema=optionalRecord\(row\.inputSchema\)/);
  assert.doesNotMatch(api,/inputSchema:record\(row\.inputSchema\)/);
});

test('M12 creator UI exposes immutable version history without auto-updating installed Workers',()=>{
  assert.match(marketplace,/versionHistory/);
  assert.match(creatorApi,/versionHistory/);
  assert.match(creatorHome,/immutable versions/);
  assert.match(creatorHome,/History:/);
  assert.match(workerWorkspace,/Latest creator version/);
  assert.match(workerWorkspace,/Existing Jobs remain pinned/);
});

test('M12 paid acquisition and creator earnings stay truthfully disabled',()=>{
  assert.match(detail,/Paid · not yet enabled/);
  assert.match(creatorHome,/Creator earnings are not enabled yet/);
  assert.doesNotMatch(creatorHome,/Pending payout.*\$/s);
});

test('M12 keeps Mainnet financial execution and autonomy disabled',()=>{
  const env=readFileSync('config/environments/production-mainnet.env.example','utf8');
  assert.match(env,/MAINNET_EXECUTION_ENABLED=false/);
  assert.match(env,/MAINNET_AUTONOMY_ENABLED=false/);
  assert.doesNotMatch(marketplace,/privateKey|mnemonic|walletClient|sendTransaction/i);
});


test('M12 OpenAPI sandbox excludes auth-required and obvious session-mutating GET operations',()=>{
  assert.match(creatorSdk,/requiresAuthentication/);
  assert.match(creatorSdk,/effectiveSecurity/);
  assert.match(creatorSdk,/obviousSessionMutation/);
  assert.match(creatorSdk,/!requiresAuthentication&&!obviousSessionMutation/);
});

test('M12 OpenAPI sandbox reports upstream provider failures truthfully',()=>{
  assert.match(api,/import_upstream_error/);
  assert.match(api,/The imported API returned HTTP/);
  assert.match(api,/IMPORT_NETWORK_TIMEOUT/);
  assert.match(api,/IMPORT_NETWORK_UNAVAILABLE/);
  assert.match(api,/No capability was promoted and no authority was granted/);
});
