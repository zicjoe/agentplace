import { existsSync, readFileSync } from 'node:fs';

const required = [
  'packages/db/migrations/0021_billing_security_completion.sql',
  'packages/billing/src/index.ts',
  'packages/security/src/index.ts',
  'apps/web/src/platform/billingApi.ts',
  'apps/web/src/platform/securityApi.ts',
  'apps/web/src/components/BillingUsageView.tsx',
  'apps/web/src/components/SecurityAuthorityView.tsx',
  'docs/MILESTONE-13.md',
  'docs/MILESTONE-13-TESTING.md',
  'docs/MILESTONE-13-DEPLOYMENT.md',
];
for (const file of required) if (!existsSync(file)) throw new Error(`M13 missing ${file}`);

const migration = readFileSync(required[0], 'utf8');
for (const token of [
  'CREATE TABLE IF NOT EXISTS billing_account',
  'CREATE TABLE IF NOT EXISTS billing_ledger_entry',
  'CREATE TABLE IF NOT EXISTS billing_usage_event',
  'CREATE TABLE IF NOT EXISTS marketplace_offer',
  'CREATE TABLE IF NOT EXISTS marketplace_entitlement',
  'CREATE TABLE IF NOT EXISTS billing_subscription',
  'CREATE TABLE IF NOT EXISTS creator_revenue_entry',
  'CREATE TABLE IF NOT EXISTS billing_service_payment',
  'CREATE TABLE IF NOT EXISTS security_quarantine',
  "WHERE status='active'",
  "allocation_status text NOT NULL DEFAULT 'unallocated'",
  "payout_status text NOT NULL DEFAULT 'not-payable-yet'",
  "environment text NOT NULL DEFAULT 'testnet' CHECK (environment='testnet')",
  "network_id text NOT NULL CHECK (network_id='arbitrum-sepolia')",
]) if (!migration.includes(token)) throw new Error(`M13 persistence missing ${token}`);
if (/creator_payable_cents\s+bigint\s+NOT NULL/i.test(migration) || /platform_share_cents\s+bigint\s+NOT NULL/i.test(migration)) throw new Error('M13 must not invent a creator/platform split before the commercial decision is locked.');
if (!/CREATE TABLE IF NOT EXISTS billing_subscription[\s\S]*price_cents bigint NOT NULL/.test(migration)) throw new Error('M13 subscriptions must snapshot the price accepted at checkout.');

const billing = readFileSync('packages/billing/src/index.ts', 'utf8');
for (const token of [
  'getServiceBalanceCents','getBillingState','updateSpendControls','setMarketplaceOffer','getMarketplaceQuote','acquireMarketplaceAsset','assertMarketplaceAccess','listCreatorRevenue','listJobCosts','createTestnetTopupIntent','confirmTestnetTopup','processBillingRenewals','processBillingRenewals',
  "worker:['free','monthly']","workflow:['free','one-time']","capability:['free','per-invocation']",
  'BILLING_TESTNET_TOPUP_ENABLED','421614','BILLING_SERVICE_TREASURY_ADDRESS','BILLING_TESTNET_USDC_ADDRESS',
  "if(asset.quarantined)throw new Error('MARKETPLACE_ASSET_QUARANTINED')",
]) if (!billing.includes(token)) throw new Error(`M13 billing core missing ${token}`);
if (/MAINNET_EXECUTION_ENABLED\s*=\s*true|MAINNET_AUTONOMY_ENABLED\s*=\s*true/.test(billing)) throw new Error('M13 billing must not enable Mainnet execution/autonomy.');
if (/PRIVATE_KEY|MNEMONIC|SEED_PHRASE/.test(billing)) throw new Error('M13 service funding must not introduce custody/private signing secrets.');

const scheduler = readFileSync('apps/scheduler/src/index.ts', 'utf8');
for (const token of ['processBillingRenewals','Billing renewal pass']) if (!scheduler.includes(token)) throw new Error(`M13 Scheduler missing ${token}`);

const security = readFileSync('packages/security/src/index.ts', 'utf8');
for (const token of ['listSecurityHistory','emergencyStopFutureExecution','quarantineCreatorAsset','releaseCreatorAssetQuarantine',"'WALLET_PROMPTED'","'SUBMITTED','CONFIRMING','CONFIRMED','UNKNOWN'","trust_status='quarantined'",'historical Jobs and evidence remain intact']) if (!security.includes(token)) throw new Error(`M13 security core missing ${token}`);
if (/eth_sendTransaction|eth_sendRawTransaction|sendTransaction\(/i.test(security)) throw new Error('M13 emergency/security controls must not add a transaction submission path.');

const marketplace = readFileSync('packages/marketplace/src/index.ts', 'utf8');
for (const token of ['getMarketplaceOffer','priceLabel','workerReputation','jobsCompleted','completionRate',"trust_status <> 'quarantined'"]) if (!marketplace.includes(token)) throw new Error(`M13 marketplace projection missing ${token}`);

const api = readFileSync('apps/api/src/server.ts', 'utf8');
for (const token of ['/api/v1/billing','/api/v1/billing/spend-controls','/api/v1/billing/topups','/api/v1/creator/earnings','/api/v1/security','/api/v1/security/emergency-stop','/api/v1/security/quarantines','assertMarketplaceAccess','getMarketplaceQuote','acquireMarketplaceAsset','listJobCosts']) if (!api.includes(token)) throw new Error(`M13 API missing ${token}`);

const billingView = readFileSync('apps/web/src/components/BillingUsageView.tsx', 'utf8');
for (const token of ['fetchBillingState','createBillingTopup','confirmBillingTopup','cancelBillingSubscription','service balance','Agent Account']) if (!billingView.includes(token)) throw new Error(`M13 Billing UX missing ${token}`);
if (/4242|prototype top-up|no charge/i.test(billingView)) throw new Error('M13 Billing UX must not present prototype payment fixtures as production truth.');

const creatorHome = readFileSync('apps/web/src/components/CreatorHome.tsx', 'utf8');
for (const token of ['fetchCreatorRevenue','setCreatorPricing','PricingEditor','Gross attributable creator revenue','unallocated']) if (!creatorHome.includes(token)) throw new Error(`M13 Creator commercial UX missing ${token}`);
if (creatorHome.includes('Creator earnings are not enabled yet')) throw new Error('M13 Creator Earnings must not remain a disabled fixture.');

const discoverDetail = readFileSync('apps/web/src/components/DiscoverDetail.tsx', 'utf8');
for (const token of ['CheckoutModal','fetchMarketplaceQuote','acquireMarketplaceAsset','Commercial access is separate from execution authority']) if (!discoverDetail.includes(token)) throw new Error(`M13 paid Discover UX missing ${token}`);
if (discoverDetail.includes('Paid · not yet enabled')) throw new Error('M13 paid Discover acquisition must no longer be disabled.');

const securityView = readFileSync('apps/web/src/components/SecurityAuthorityView.tsx', 'utf8');
for (const token of ['fetchSecurityState','emergencyStopFutureExecution','quarantineCreatorSupply','releaseCreatorSupplyQuarantine','submitted, confirming, confirmed or unknown']) if (!securityView.includes(token)) throw new Error(`M13 Security UX missing ${token}`);

const jobWorkspace = readFileSync('apps/web/src/components/JobWorkspace.tsx', 'utf8');

const rootPackage = readFileSync('package.json', 'utf8');
if (!/build:scheduler[^\n]+@agent-place\/billing build[^\n]+@agent-place\/scheduler build/.test(rootPackage)) throw new Error('M13 clean Scheduler deployment must build @agent-place/billing before @agent-place/scheduler.');

const securityApi = readFileSync('apps/web/src/platform/securityApi.ts', 'utf8');
if (!securityApi.includes('occurredAt:string') || securityApi.includes('SecurityHistoryEntry { id:string;eventType:string;objectType:string;objectId:string;title:string;summary:string;effect?:string;status:string;createdAt:string')) throw new Error('M13 Security history client must hydrate the durable occurredAt field.');
if (!securityView.includes('event.occurredAt')) throw new Error('M13 Security UI must render durable Security history timestamps from occurredAt.');
for (const token of ['JobCostPanel','fetchJobCosts','USD-attributed service costs','transferred capital','exact onchain fee assets']) if (!jobWorkspace.includes(token)) throw new Error(`M13 Job cost UX missing ${token}`);

for (const envFile of ['.env.example','config/environments/production-mainnet.env.example']) {
  const env = readFileSync(envFile, 'utf8');
  for (const token of ['MAINNET_EXECUTION_ENABLED=false','MAINNET_AUTONOMY_ENABLED=false','BILLING_TESTNET_TOPUP_ENABLED=false']) if (!env.includes(token)) throw new Error(`M13 environment safety missing ${token} in ${envFile}`);
}

console.log('PASS: M13 Billing + Security Completion adds durable ledger-derived service accounting, paid marketplace entitlements, gross creator revenue attribution, Job cost truth, testnet-only service funding and durable emergency/quarantine controls without conflating capital, service spend or wallet authority.');
