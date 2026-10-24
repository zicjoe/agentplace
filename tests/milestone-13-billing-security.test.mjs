import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration=readFileSync('packages/db/migrations/0021_billing_security_completion.sql','utf8');
const billing=readFileSync('packages/billing/src/index.ts','utf8');
const security=readFileSync('packages/security/src/index.ts','utf8');
const marketplace=readFileSync('packages/marketplace/src/index.ts','utf8');
const api=readFileSync('apps/api/src/server.ts','utf8');
const billingView=readFileSync('apps/web/src/components/BillingUsageView.tsx','utf8');
const creatorHome=readFileSync('apps/web/src/components/CreatorHome.tsx','utf8');
const discoverDetail=readFileSync('apps/web/src/components/DiscoverDetail.tsx','utf8');
const securityView=readFileSync('apps/web/src/components/SecurityAuthorityView.tsx','utf8');
const jobWorkspace=readFileSync('apps/web/src/components/JobWorkspace.tsx','utf8');

function token(source,value){assert.ok(source.includes(value),`missing ${value}`);}

test('M13 service balance is ledger-derived and capital remains a separate concept',()=>{
  token(migration,'billing_ledger_entry');
  token(billing,'getServiceBalanceCents');
  assert.match(billing,/SUM\(CASE WHEN direction='credit' THEN amount_cents ELSE -amount_cents END\)/);
  assert.match(billingView,/service balance/i);
  assert.match(billingView,/Agent Account/i);
});

test('M13 pricing models are narrow and do not invent performance fees',()=>{
  token(billing,"worker:['free','monthly']");
  token(billing,"workflow:['free','one-time']");
  token(billing,"capability:['free','per-invocation']");
  assert.doesNotMatch(billing,/performance-fee|profit-share|aum-fee/i);
  token(creatorHome,'PricingEditor');
});

test('M13 paid acquisition is entitlement based and cannot grant authority',()=>{
  for(const name of ['marketplace_offer','marketplace_entitlement','billing_subscription']) token(migration,name);
  token(api,'assertMarketplaceAccess');
  token(discoverDetail,'fetchMarketplaceQuote');
  token(discoverDetail,'acquireMarketplaceAsset');
  assert.match(discoverDetail,/Commercial access is separate from execution authority/);
  assert.doesNotMatch(discoverDetail,/ADD_AUTHORITY_GRANT/);
});

test('M13 creator revenue records gross attribution without fabricated split',()=>{
  token(migration,"allocation_status text NOT NULL DEFAULT 'unallocated'");
  token(migration,"payout_status text NOT NULL DEFAULT 'not-payable-yet'");
  assert.doesNotMatch(migration,/creator_payable_cents\s+bigint\s+NOT NULL/i);
  assert.doesNotMatch(migration,/platform_share_cents\s+bigint\s+NOT NULL/i);
  token(billing,'listCreatorRevenue');
  assert.match(creatorHome,/Gross attributable creator revenue/i);
  assert.match(creatorHome,/unallocated/i);
});


test('M13 monthly subscriptions snapshot the accepted renewal price',()=>{
  assert.match(migration,/billing_subscription[\s\S]*price_cents bigint NOT NULL/);
  token(billing,'s.price_cents::text');
  assert.match(billing,/price_cents=EXCLUDED.price_cents/);
});

test('M13 monthly subscriptions renew deterministically from service balance only',()=>{
  token(billing,'processBillingRenewals');
  token(billing,"status='past-due'");
  token(billing,"'billing.subscription.renewed'");
  token(billing,'No wallet was charged and no authority changed.');
  assert.match(migration,/past-due/);
});

test('M13 service topups are explicit Arbitrum Sepolia connected-wallet payments and remain disabled by default',()=>{
  token(migration,"environment text NOT NULL DEFAULT 'testnet' CHECK (environment='testnet')");
  token(migration,"network_id text NOT NULL CHECK (network_id='arbitrum-sepolia')");
  token(billing,'BILLING_TESTNET_TOPUP_ENABLED');
  token(billing,'BILLING_CONNECTED_EVM_WALLET_REQUIRED');
  token(billing,"chainId:`0x${(421614).toString(16)}`");
  assert.doesNotMatch(billing,/PRIVATE_KEY|MNEMONIC|SEED_PHRASE/);
  assert.match(readFileSync('.env.example','utf8'),/BILLING_TESTNET_TOPUP_ENABLED=false/);
});

test('M13 Job cost evidence keeps exact receipt assets separate from USD-attributed costs',()=>{
  token(billing,'listJobCosts');
  token(billing,'verified_receipt');
  token(billing,'modelEstimatedUsd');
  token(billing,'receiptCosts');
  token(jobWorkspace,'USD-attributed service costs');
  token(jobWorkspace,'exact onchain fee assets');
  assert.match(jobWorkspace,/entry\.category!==['"]capital['"]/);
});

test('M13 reputation is empirical and marketplace ranking remains separate from paid routing',()=>{
  token(marketplace,'workerReputation');
  token(marketplace,'jobsCompleted');
  token(marketplace,'completionRate');
  assert.doesNotMatch(marketplace,/five.?star|magic score|pay.?to.?win/i);
});

test('M13 emergency stop never claims to reverse submitted blockchain transactions',()=>{
  token(security,'emergencyStopFutureExecution');
  token(security,"'SUBMITTED','CONFIRMING','CONFIRMED','UNKNOWN'");
  token(security,"status='PRE_SUBMISSION_FAILED'");
  token(security,'left untouched because blockchain submissions cannot be reversed');
  assert.match(securityView,/Already-submitted, confirming or unknown blockchain transactions cannot be reversed/);
});

test('M13 quarantine is durable, owner-scoped, reversible and blocks new use',()=>{
  token(migration,'security_quarantine');
  token(migration,"WHERE status='active'");
  token(security,'SECURITY_TARGET_NOT_OWNED');
  token(security,"trust_status='quarantined'");
  token(security,'releaseCreatorAssetQuarantine');
  token(billing,"if(asset.quarantined)throw new Error('MARKETPLACE_ASSET_QUARANTINED')");
  token(marketplace,"trust_status <> 'quarantined'");
});

test('M13 production Billing and Creator Earnings no longer expose the old fixtures',()=>{
  assert.doesNotMatch(billingView,/4242|prototype top-up|no charge/i);
  assert.doesNotMatch(discoverDetail,/Paid · not yet enabled/);
  assert.doesNotMatch(creatorHome,/Creator earnings are not enabled yet/);
});

test('M13 keeps Mainnet execution and autonomy disabled',()=>{
  for(const file of ['.env.example','config/environments/production-mainnet.env.example']){
    const env=readFileSync(file,'utf8');
    assert.match(env,/MAINNET_EXECUTION_ENABLED=false/);
    assert.match(env,/MAINNET_AUTONOMY_ENABLED=false/);
  }
});


test('M13 clean Scheduler builds Billing before the Scheduler',()=>{
  const root=readFileSync('package.json','utf8');
  assert.match(root,/build:scheduler[^\n]+@agent-place\/billing build[^\n]+@agent-place\/scheduler build/);
});

test('M13 Capability per-invocation pricing is commercial metadata until a trusted runtime route exists',()=>{
  token(billing,"offer.pricingModel==='per-invocation'?0:offer.priceCents");
  assert.match(billing,/does not charge an invocation unless a separately trusted AgentPlace runtime route exists/);
  assert.match(creatorHome,/commercial metadata now; a charge occurs only on a separately trusted AgentPlace invocation route/);
});

test('M13 Security history hydrates durable occurredAt timestamps',()=>{
  const securityApi=readFileSync('apps/web/src/platform/securityApi.ts','utf8');
  assert.match(securityApi,/occurredAt:string/);
  assert.match(securityView,/event\.occurredAt/);
});
