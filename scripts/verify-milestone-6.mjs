import { readFile } from 'node:fs/promises';

const read = (path) => readFile(path, 'utf8');
const [rootRaw, migration, wallets, api, walletApi, walletUi, fixtureContext, stateTypes, roadmap, milestone, security, guestHome, shell, indexCss] = await Promise.all([
  read('package.json'),
  read('packages/db/migrations/0010_wallet_foundation.sql'),
  read('packages/wallets/src/index.ts'),
  read('apps/api/src/server.ts'),
  read('apps/web/src/platform/walletApi.ts'),
  read('apps/web/src/components/WalletsView.tsx'),
  read('apps/web/src/fixtures/FixtureAppContext.tsx'),
  read('apps/web/src/state/types.ts'),
  read('docs/ROADMAP.md'),
  read('docs/MILESTONE-6.md'),
  read('docs/SECURITY-BOUNDARIES.md'),
  read('apps/web/src/components/GuestHome.tsx'),
  read('apps/web/src/components/Shell.tsx'),
  read('apps/web/src/index.css'),
]);
const root = JSON.parse(rootRaw);
if (root.version !== '0.9.1') throw new Error('Milestone 6 hardening candidate must be version 0.9.1.');
if (!root.scripts?.['verify:milestone-6'] || !root.scripts?.check?.includes('verify:milestone-6')) throw new Error('Milestone 6 verifier must be part of pnpm check.');
for (const table of ['wallet_resource','wallet_network_state','agent_account']) if (!migration.includes(`CREATE TABLE IF NOT EXISTS ${table}`)) throw new Error(`Missing durable ${table} table.`);
for (const boundary of ["mode IN ('watch-only','connected','agent-account')", "namespace IN ('eip155','solana')", "lifecycle_status text NOT NULL DEFAULT 'setup'", "deployment_status text NOT NULL DEFAULT 'not-deployed'"]) if (!migration.includes(boundary)) throw new Error(`Missing wallet schema boundary: ${boundary}`);
for (const fn of ['createWatchWallet','connectWallet','observeWalletNetwork','createAgentAccount','listWallets','listAgentAccounts']) if (!wallets.includes(`function ${fn}`) && !wallets.includes(`function ${fn}(`) && !wallets.includes(`function ${fn}<`) && !wallets.includes(`function ${fn} `) && !wallets.includes(`function ${fn}:`) && !wallets.includes(`function ${fn}\n`) && !wallets.includes(`function ${fn}\r`) && !wallets.includes(`function ${fn}`) && !wallets.includes(` ${fn}(`)) throw new Error(`Wallet runtime missing ${fn}.`);
if (!wallets.includes("if (!EVM_ADDRESS.test(value))") || !wallets.includes("if (!SOLANA_ADDRESS.test(value))")) throw new Error('Wallet runtime must validate EVM and Solana public addresses.');
if (!api.includes("'/api/v1/wallets/watch'") || !api.includes("'/api/v1/wallets/connect'") || !api.includes("'/api/v1/agent-accounts'")) throw new Error('Wallet APIs are incomplete.');
if (!walletApi.includes("eth_requestAccounts") || !walletApi.includes("eth_chainId") || !walletApi.includes("eth_getBalance")) throw new Error('Connected EVM wallet must use real browser provider state.');
if (!walletApi.includes('updateDurableWallet') || !walletApi.includes('removeDurableWallet')) throw new Error('Watch-only lifecycle must support durable rename/remove.');
if (walletUi.includes("0x7c9a...e3f1") || walletUi.includes('AA-0x')) throw new Error('Wallet UI must not fabricate connected or Agent Account addresses.');
if (!walletUi.includes('No onchain address yet') || !/no smart account has been deployed/i.test(walletUi)) throw new Error('Agent Account UI must disclose undeployed state truthfully.');
if (!walletUi.includes('An EVM address does not reveal which chain you mean') || !walletUi.includes('Robinhood Chain')) throw new Error('Watch-only and Agent Account UX must preserve explicit multichain network context.');
if (!walletUi.includes('Remove saved watch-only wallet') || !walletUi.includes('Rename')) throw new Error('Watch-only UX must expose rename/remove lifecycle.');
if (!walletUi.includes('Why use an Agent Account?') || !walletUi.includes('Ready for deployment')) throw new Error('Agent Account setup must explain its role and truthful lifecycle.');
if (!fixtureContext.includes("WEB_RUNTIME_SETTINGS.dataMode === 'api'") || !fixtureContext.includes('Financial action preparation and signature handoff are not enabled in this build yet') || !fixtureContext.includes('Funding, Mandates and deterministic Authority Grants are separate later milestones')) throw new Error('Production/API mode must not convert M6 wallet state into fixture financial actions.');
if (!stateTypes.includes("walletStatus?: 'active' | 'disconnected' | 'setup' | 'removed'")) throw new Error('Frontend wallet state must preserve durable status.');
if (!roadmap.includes('Milestone 6 — Wallet Foundation')) throw new Error('Roadmap must retain Milestone 6 Wallet Foundation.');
if (!milestone.includes('No raw private keys') || !milestone.includes('Connected Wallet is not authority') || !milestone.includes('Agent Account setup is not deployment') || !milestone.includes('ready-for-deployment')) throw new Error('Milestone 6 documentation must state wallet safety boundaries and lifecycle.');
if (!security.includes('Wallet Foundation')) throw new Error('Security boundaries must include Wallet Foundation.');
if (!guestHome.includes('data-page-scroll className="h-full min-h-0 overflow-y-auto overscroll-contain bg-bg"')) throw new Error('Guest Home must own vertical scrolling inside the fixed shell.');
if (!guestHome.includes('min-h-full w-full flex px-4 py-6 sm:py-8 lg:py-10') || !guestHome.includes('max-w-2xl mx-auto my-auto')) throw new Error('Guest Home must center only with overflow-safe auto margins.');
if (guestHome.includes('h-full flex flex-col items-center justify-center px-4 bg-bg')) throw new Error('Guest Home must not vertically center a potentially taller page directly in the fixed viewport.');
if (!shell.includes('flex-1 min-h-0 min-w-0 overflow-hidden')) throw new Error('Shell main content must remain constrained so route pages own their scrolling.');
if (!indexCss.includes('[data-page-scroll]') || !indexCss.includes('scrollbar-gutter: stable')) throw new Error('Page scroll-owner CSS guard is missing.');
console.log('PASS: Milestone 6 Wallet Foundation provides durable watch-only, connected-wallet and undeployed Agent Account state without creating financial authority.');
