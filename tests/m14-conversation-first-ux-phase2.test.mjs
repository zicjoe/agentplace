import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const source = (path) => readFileSync(path, 'utf8');
function runTypescript(code) {
  const child = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning','--experimental-strip-types','--input-type=module','-e',code],{encoding:'utf8'});
  assert.equal(child.status,0,child.stderr || child.stdout);
}

test('named Solana BONK uses the recorded original mint and never accepts an unrelated mint', () => {
  runTypescript(`
    import assert from 'node:assert/strict';
    import { pinnedTokenFor, pinnedTokenConflict, selectUnambiguousTokenCandidate } from './packages/intelligence/src/tokenIdentity.ts';
    const original = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';
    const other = 'BonkUg9t46HnxF4erZzmnB4Ae6oEcDS4V66zqUoUhwWY';
    assert.equal(pinnedTokenFor('$BONK','solana')?.address,original);
    assert.equal(pinnedTokenFor('BONK','base'),undefined);
    assert.equal(pinnedTokenConflict('BONK','solana',original),null);
    assert.match(pinnedTokenConflict('BONK','solana',other),/does not match/);
    const poolA={network:'solana',symbol:'ALPHA',address:'Mint111'};
    assert.deepEqual(selectUnambiguousTokenCandidate('ALPHA','solana',[poolA,poolA]),poolA);
    assert.equal(selectUnambiguousTokenCandidate('ALPHA','solana',[poolA,{...poolA,address:'Mint222'}]),null);
    assert.equal(selectUnambiguousTokenCandidate('UNKNOWN','solana',[poolA]),null);
    assert.equal(selectUnambiguousTokenCandidate('ALPHA','',[poolA,{...poolA,network:'ethereum'}]),null);
  `);
});

test('historical coverage-first report becomes answer-first without inventing facts', () => {
  runTypescript(`
    import assert from 'node:assert/strict';
    import { conversationResearchLayout, mayEndMidSentence } from './apps/web/src/platform/conversationResearchLayout.ts';
    const report = '**Evidence-backed BONK investigation**\\n\\n### BONK on Solana\\n\\n## Coverage\\n\\n| Requirement | Status |\\n| --- | --- |\\n| R1 | Partially verified |\\n\\n### Identity and provider mismatch\\n\\nThe upstream pool refers to the other token, not established BONK.\\n\\n### Risks\\n\\nHolder accounts cannot prove beneficial ownership.\\n\\n**Conclusion — observation versus inference:** Smart-money accumulation is not confirmed. The wrong mint must not be used.\\n\\n## Sources\\n1. CertiK — https://skynet.certik.com/';
    const layout = conversationResearchLayout(report);
    assert.match(layout.takeaway,/accumulation is not confirmed/);
    assert.doesNotMatch(layout.takeaway,/\\| R1/);
    assert.match(layout.coverage,/\\| R1/);
    assert.match(layout.analysis,/other token/);
    assert.match(layout.sources,/CertiK/);
    assert.ok(!layout.incomplete);
    assert.ok(mayEndMidSentence('## Conclusion\\n\\nNo data showed a complete Nansen holdings'));
    const noSummary = conversationResearchLayout('Plain report with a verified fact.');
    assert.equal(noSummary.takeaway,'');
    assert.equal(noSummary.analysis,'Plain report with a verified fact.');
  `);
});

test('research runtime enforces a single token identity and answer-first synthesis while preserving audit coverage', () => {
  const intelligence = source('packages/intelligence/src/index.ts');
  const worker = source('apps/worker/src/index.ts');
  const coverage = source('apps/worker/src/researchCoverage.ts');
  const models = source('packages/models/src/index.ts');
  const component = source('apps/web/src/components/ConversationResearchAnswer.tsx');
  assert.match(intelligence,/pinnedTokenConflict/);
  assert.match(intelligence,/selectUnambiguousTokenCandidate/);
  assert.match(intelligence,/provider request was sent|provider request intentionally not sent/);
  assert.match(intelligence,/expectedAddress:resolved\.address/);
  assert.match(intelligence,/token\.identity\.resolve/);
  assert.match(worker,/scopedSubjects/);
  assert.match(worker,/Lead with "## Bottom line"/);
  assert.match(worker,/hasResearchCoverage\(coveredAnswer, requirements\)/);
  assert.match(coverage,/Lead with a concise/);
  assert.match(coverage,/\$\{answer\.trim\(\)\}\\n\\n\$\{coverage\}/);
  assert.match(models,/research_output_truncated/);
  assert.match(component,/Read full analysis/);
  assert.match(component,/Verification coverage/);
  assert.match(component,/View work and evidence/);
});
