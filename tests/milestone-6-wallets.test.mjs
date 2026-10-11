import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('M6 persists wallet resources without wallet secrets', async () => {
  const migration = await read('packages/db/migrations/0010_wallet_foundation.sql');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS wallet_resource/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS wallet_network_state/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS agent_account/);
  assert.doesNotMatch(migration, /private_key|seed_phrase|mnemonic/i);
  assert.match(migration, /lifecycle_status text NOT NULL DEFAULT 'setup'/);
  assert.match(migration, /ready-for-deployment/);
});

test('M6 connected wallet reads real browser provider state and does not fabricate addresses', async () => {
  const [api, ui] = await Promise.all([
    read('apps/web/src/platform/walletApi.ts'),
    read('apps/web/src/components/WalletsView.tsx'),
  ]);
  assert.match(api, /eth_requestAccounts/);
  assert.match(api, /eth_chainId/);
  assert.match(api, /eth_getBalance/);
  assert.doesNotMatch(ui, /0x7c9a\.\.\.e3f1/);
  assert.doesNotMatch(ui, /AA-0x/);
  assert.match(ui, /No onchain address yet/);
});

test('M6 keeps Agent Account setup separate from deployment and authority', async () => {
  const [wallets, milestone] = await Promise.all([
    read('packages/wallets/src/index.ts'),
    read('docs/MILESTONE-6.md'),
  ]);
  assert.match(wallets, /deployment_status/);
  assert.match(wallets, /'not-deployed'/);
  assert.match(milestone, /Connected Wallet is not authority/);
  assert.match(milestone, /Agent Account setup is not deployment/);
});


test('M6 production mode cannot turn wallet setup into a fixture financial action', async () => {
  const context = await read('apps/web/src/fixtures/FixtureAppContext.tsx');
  assert.match(context, /WEB_RUNTIME_SETTINGS\.dataMode === 'api'/);
  assert.match(context, /Financial action preparation and signature handoff are not enabled in this build yet/);
  assert.match(context, /Funding, Mandates and deterministic Authority Grants are separate later milestones/);
});


test('M6 watch-only flow stores explicit network context and supports rename/remove', async () => {
  const [api, ui] = await Promise.all([
    read('apps/web/src/platform/walletApi.ts'),
    read('apps/web/src/components/WalletsView.tsx'),
  ]);
  assert.match(api, /networks: Array<\{ networkId: string; chainReference: string \}>/);
  assert.match(api, /updateDurableWallet/);
  assert.match(api, /removeDurableWallet/);
  assert.match(ui, /An EVM address does not reveal which chain you mean/);
  assert.match(ui, /Remove saved watch-only wallet/);
  assert.match(ui, /Robinhood Chain/);
});

test('M6 Agent Account foundation has a truthful ready-for-deployment lifecycle with zero authority', async () => {
  const [wallets, ui] = await Promise.all([
    read('packages/wallets/src/index.ts'),
    read('apps/web/src/components/WalletsView.tsx'),
  ]);
  assert.match(wallets, /'ready-for-deployment'/);
  assert.match(ui, /Why use an Agent Account\?/);
  assert.match(ui, /Worker authority/);
  assert.match(ui, /None/);
});
