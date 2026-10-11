import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAuthorityPolicy, translateMandateIntent } from '../packages/authority/dist/index.js';

const baseRevision = {
  mandateId: 'm1', workerId: 'w1', accountId: 'a1', environment: 'testnet', status: 'ACTIVE', revision: 1,
  title: 'Stablecoin mandate', purpose: 'Manage USDC safely', authorityLevel: 'ACT_WITHIN_MANDATE',
  allowedCapabilities: ['wallet.balance.read','swap.execute','swap.quote'],
  allowedNetworks: [{family:'eip155',networkId:'base'}],
  assetScope: 'ALLOW_LIST', allowedAssets: ['USDC'], protocolScope: 'ALLOW_LIST', allowedProtocols: ['uniswap'],
  destinationScope: 'ALLOW_LIST', allowedDestinations: [], capitalLimitUsd: '500', perActionLimitUsd: '25',
  periodBudget: {limitUsd:'100',period:'day'}, serviceBudget: {limitUsd:'2',period:'day'},
  approvalPolicy: {mode:'WITHIN_LIMITS',askForNewProtocols:true,askForNewDestinations:true}, borrowingAllowed:false, leverageAllowed:false,
  validFrom: '2026-01-01T00:00:00.000Z', validUntil: '2027-01-01T00:00:00.000Z', changeSummary:'initial', createdAt:'2026-01-01T00:00:00.000Z',
};
const baseEnvelope = { workerId:'w1', accountId:'a1', capabilityId:'swap.execute', operation:'EXECUTE', environment:'testnet', network:{family:'eip155',networkId:'base'}, asset:'USDC', protocol:'uniswap', valueUsd:'20' };
const evaluate = (overrides={}) => evaluateAuthorityPolicy({ mandate: baseRevision, envelope: baseEnvelope, capabilityKnown:true, capabilityEffect:'economic-write', accountMode:'agent-account', globalAutonomyPaused:false, mainnetAutonomyEnabled:false, periodSpentUsd:'0', now:new Date('2026-10-11T12:00:00Z'), ...overrides });

test('missing mandate fails closed', () => assert.equal(evaluate({mandate:null}).decision, 'DENIED'));
test('observe allows read but denies financial operation', () => {
  const mandate={...baseRevision,authorityLevel:'OBSERVE',allowedCapabilities:['wallet.balance.read']};
  assert.equal(evaluate({mandate,envelope:{...baseEnvelope,capabilityId:'wallet.balance.read',operation:'OBSERVE',valueUsd:undefined,asset:undefined,protocol:undefined},capabilityEffect:'read'}).decision,'ALLOWED');
  assert.equal(evaluate({mandate}).decision,'DENIED');
});
test('prepare permits preparation but requires approval for execution', () => {
  const mandate={...baseRevision,authorityLevel:'PREPARE'};
  assert.equal(evaluate({mandate,envelope:{...baseEnvelope,operation:'PREPARE',valueUsd:undefined}}).decision,'ALLOWED');
  assert.equal(evaluate({mandate}).decision,'APPROVAL_REQUIRED');
});
test('act within mandate allows a bounded testnet action', () => assert.equal(evaluate().decision,'ALLOWED'));
test('per-action and period hard budgets deny', () => {
  assert.equal(evaluate({envelope:{...baseEnvelope,valueUsd:'26'}}).reasons[0].code,'PER_ACTION_LIMIT_EXCEEDED');
  assert.equal(evaluate({periodSpentUsd:'90'}).reasons[0].code,'PERIOD_BUDGET_EXCEEDED');
});
test('network, asset, capability, protocol and destination restrictions are fail closed', () => {
  assert.equal(evaluate({envelope:{...baseEnvelope,network:{family:'eip155',networkId:'arbitrum'}}}).reasons[0].code,'NETWORK_NOT_ALLOWED');
  assert.equal(evaluate({envelope:{...baseEnvelope,asset:'ETH'}}).reasons[0].code,'ASSET_NOT_ALLOWED');
  assert.equal(evaluate({envelope:{...baseEnvelope,capabilityId:'bridge.execute'}}).reasons[0].code,'CAPABILITY_NOT_ALLOWED');
  assert.equal(evaluate({envelope:{...baseEnvelope,protocol:'aave'}}).reasons[0].code,'PROTOCOL_NOT_ALLOWED');
  assert.equal(evaluate({envelope:{...baseEnvelope,asset:undefined}}).reasons[0].code,'ASSET_NOT_ALLOWED');
  assert.equal(evaluate({envelope:{...baseEnvelope,protocol:undefined}}).reasons[0].code,'PROTOCOL_NOT_ALLOWED');
  const mandate={...baseRevision,destinationScope:'ALLOW_LIST',allowedDestinations:['0xabc']};
  assert.equal(evaluate({mandate,envelope:{...baseEnvelope,destination:'0xdef'}}).reasons[0].code,'DESTINATION_NOT_ALLOWED');
});
test('paused, revoked and expired mandates immediately deny', () => {
  for (const status of ['PAUSED','REVOKED','EXPIRED']) assert.equal(evaluate({mandate:{...baseRevision,status}}).decision,'DENIED');
});
test('connected wallet and mainnet safety gate require approval rather than inventing autonomy', () => {
  assert.equal(evaluate({accountMode:'connected'}).decision,'APPROVAL_REQUIRED');
  assert.equal(evaluate({mandate:{...baseRevision,environment:'mainnet'},envelope:{...baseEnvelope,environment:'mainnet'}}).decision,'APPROVAL_REQUIRED');
});
test('global autonomy pause requires approval and does not mutate mandate', () => assert.equal(evaluate({globalAutonomyPaused:true}).decision,'APPROVAL_REQUIRED'));
test('read capability cannot be smuggled into EXECUTE', () => assert.equal(evaluate({capabilityEffect:'read'}).reasons[0].code,'CAPABILITY_NOT_EXECUTABLE'));
test('natural language translation is a conservative draft', () => {
  const draft=translateMandateIntent('Let my Stablecoin Worker optimize my USDC on Base, but never move more than $50 without asking me. No leverage.');
  assert.equal(draft.authorityLevel,'ACT_WITHIN_MANDATE');
  assert.equal(draft.approvalPolicy.mode,'THRESHOLD');
  assert.equal(draft.approvalPolicy.thresholdUsd,'50');
  assert.equal(draft.perActionLimitUsd,undefined);
  assert.equal(draft.leverageAllowed,false);
  assert.equal(draft.borrowingAllowed,false);
  assert.ok(draft.warnings.some((warning)=>warning.includes('hard per-action ceiling')));
});
