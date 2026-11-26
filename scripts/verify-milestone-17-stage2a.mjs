import { readFileSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';
const read=(name)=>readFileSync(name,'utf8');
for (const name of [
  'apps/web/src/platform/builderConversation.ts',
  'tests/m17-builder-flexible-conversation.test.mjs',
  'docs/MILESTONE-17-STAGE2A-UNIFIED-CONVERSATIONAL-BUILDER.md',
  'docs/MILESTONE-17-STAGE2A-PRODUCTION-TESTING.md',
]) assert.ok(existsSync(name),`Missing M17 Stage 2A file: ${name}`);
const app=read('apps/web/src/components/AgentBuilder.tsx');
for (const phrase of [
  'Detailed setup (optional)',
  'Browse templates',
  'Teach a rule',
  'Edit or combine',
  'copyCompleteInput',
  'builderTurnMode(',
  'builderTemplateInstruction(',
  'await saveCreatorBuilderSession(assetId',
  'explicitActionOnly',
  'saveSequenceRef',
  'Your text has not been cut',
]) assert.ok(app.includes(phrase),`Builder missing ${phrase}`);
assert.ok(app.includes('await interpretCreatorBuilderTurn(assetId'));
assert.ok(app.indexOf('await saveCreatorBuilderSession(assetId')<app.indexOf('await interpretCreatorBuilderTurn(assetId'), 'User turn must be persisted before the model call');
const api=read('apps/api/src/server.ts');
assert.ok(api.includes('explicitUndoRequest'));
assert.ok(api.includes('MAINNET') || read('.env.example').includes('MAINNET_AUTONOMY_ENABLED=false'));
const scripts=JSON.parse(read('package.json')).scripts;
assert.ok(scripts.check.includes('verify:milestone-17-stage2a'));
assert.ok(scripts['verify:milestone-17-stage2a']);
assert.match(read('.env.example'),/MAINNET_EXECUTION_ENABLED=false/);
assert.match(read('.env.example'),/MAINNET_AUTONOMY_ENABLED=false/);
console.log('PASS: M17 Stage 2A reuses one safe Builder conversation, preserves input, and requires explicit action controls.');
