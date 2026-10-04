import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const contractPath = 'contracts/agentplace-receipt-registry/src/AgentPlaceReceiptRegistry.sol';
const deploymentPath = 'contracts/agentplace-receipt-registry/deployments/robinhood-chain-testnet.json';

const source = await readFile(contractPath, 'utf8');
const deployment = JSON.parse(await readFile(deploymentPath, 'utf8'));

test('submission contract preserves the narrow receipt-proof boundary', () => {
  for (const token of [
    'contract AgentPlaceReceiptRegistry',
    'function anchorReceipt',
    'function isAnchored',
    'function getAnchor',
    'function setAnchorer',
    'function transferOwnership',
    'function acceptOwnership',
    'ReceiptAlreadyAnchored',
    'onlyAuthorizedAnchorer',
    'REGISTRY_VERSION = 1',
  ]) {
    assert.ok(source.includes(token), `missing contract safety token: ${token}`);
  }

  for (const forbidden of ['delegatecall', 'selfdestruct', 'tx.origin', 'call{value:', 'transfer(', 'send(']) {
    assert.equal(source.includes(forbidden), false, `forbidden contract primitive present: ${forbidden}`);
  }
});

test('Robinhood Chain Testnet deployment manifest records only safe public deployment metadata', () => {
  assert.equal(deployment.network, 'Robinhood Chain Testnet');
  assert.equal(deployment.chainId, 46630);
  assert.equal(deployment.contract, 'AgentPlaceReceiptRegistry');
  assert.equal(deployment.verificationStatus, 'verified-partial-match');
  assert.match(deployment.contractAddress, /^0x[0-9a-fA-F]{40}$/);
  assert.equal(
    deployment.contractAddress,
    '0xa7AFd49f777ec937B73e5A2FAAaabbF383987Ecd',
  );
  assert.equal(
    deployment.explorerUrl,
    `https://explorer.testnet.chain.robinhood.com/address/${deployment.contractAddress}`,
  );
  assert.equal(deployment.compilerVersion, 'v0.8.24+commit.e11b9ed9');
  assert.equal(deployment.optimizationEnabled, false);

  const serialized = JSON.stringify(deployment).toLowerCase();
  for (const forbidden of ['privatekey', 'private_key', 'seedphrase', 'seed_phrase', 'mnemonic']) {
    assert.equal(serialized.includes(forbidden), false, `deployment manifest must not contain ${forbidden}`);
  }
});
