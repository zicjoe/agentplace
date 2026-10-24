import { randomUUID } from 'node:crypto';
import { getDatabasePool, withTransaction, type SqlExecutor } from '@agent-place/db';

export type AssetType = 'worker'|'workflow'|'capability';
export type PricingModel = 'free'|'monthly'|'one-time'|'per-invocation';
export type BillingUsageCategory = 'agentplace-service'|'external-worker'|'external-capability'|'external-provider'|'onchain-gas'|'bridge-fee'|'protocol-fee'|'subscription';
export type PaidBy = 'service-balance'|'included-in-plan'|'user-wallet'|'agent-account'|'covered-by-agentplace'|'external-subscription';

export interface CommercialOffer {
  id:string; assetType:AssetType; assetId:string; creatorUserId?:string; pricingModel:PricingModel; priceCents:number; currency:'USD'; active:boolean;
}
export interface BillingAccountSnapshot {
  planId:'free'|'pro'|'builder'; planName:string; serviceBalanceCents:number; variableSpendThisMonthCents:number;
  billingPeriodStart:string; billingPeriodEnd:string; monthlyVariableLimitCents:number; singleJobThresholdCents:number;
}
export interface BillingLedgerEntry {
  id:string; direction:'credit'|'debit'; category:string; amountCents:number; description:string; paidBy:string; sourceType:string; sourceId:string;
  jobId?:string; routineId?:string; workerId?:string; creatorAssetType?:AssetType; creatorAssetId?:string; occurredAt:string;
}
export interface BillingSubscription {
  id:string; entitlementId:string; offerId:string; assetType:AssetType; assetId:string; name:string; creatorName:string; status:'active'|'past-due'|'pending-cancel'|'cancelled'; currentPeriodStart:string; currentPeriodEnd:string; cancelledAt?:string; priceCents:number;
}
export interface CreatorRevenueEntry {
  id:string; assetType:AssetType; assetId:string; assetName:string; grossCents:number; creatorPayableCents?:number; platformShareCents?:number;
  allocationStatus:'unallocated'|'allocated'; payoutStatus:'not-payable-yet'|'pending'|'settled'; sourceType:string; sourceId:string; occurredAt:string;
}
export interface UsageEvent {
  id:string; category:BillingUsageCategory; amountCents:number; description:string; paidBy:PaidBy; jobId?:string; routineId?:string; workerId?:string;
  creatorAssetType?:AssetType; creatorAssetId?:string; occurredAt:string;
}
export interface Entitlement { id:string; assetType:AssetType; assetId:string; offerId:string; status:'active'|'expired'|'cancelled'|'revoked'; acquiredAt:string; accessExpiresAt?:string; }
export interface BillingState {
  account:BillingAccountSnapshot; ledger:BillingLedgerEntry[]; usage:UsageEvent[]; subscriptions:BillingSubscription[]; entitlements:Entitlement[];
  topUp:{enabled:boolean;networkId:'arbitrum-sepolia';chainId:421614;assetSymbol:'USDC';assetAddress?:string;treasuryAddress?:string};
}

function id(prefix:string){return `${prefix}_${randomUUID()}`;}
function cents(value:unknown):number{const n=typeof value==='number'?value:Number(value??0);return Number.isFinite(n)?Math.max(0,Math.trunc(n)):0;}
function asDate(value:Date|string):string{return new Date(value).toISOString();}
function planName(idValue:string):string{return idValue==='pro'?'Pro':idValue==='builder'?'Builder':'Free';}
function monthWindow(now=new Date()):{start:Date;end:Date}{const start=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1));const end=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,1));return {start,end};}
function nextMonth(date=new Date()):Date{
  const year=date.getUTCFullYear(),targetMonth=date.getUTCMonth()+1;
  const first=new Date(Date.UTC(year,targetMonth,1,date.getUTCHours(),date.getUTCMinutes(),date.getUTCSeconds()));
  const lastDay=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
  first.setUTCDate(Math.min(date.getUTCDate(),lastDay));
  return first;
}
function normalizeAddress(value:string):string{const v=value.trim().toLowerCase();if(!/^0x[0-9a-f]{40}$/.test(v))throw new Error('BILLING_INVALID_EVM_ADDRESS');return v;}
function topicAddress(address:string):string{return `0x${address.slice(2).padStart(64,'0')}`;}
function bigintHex(value:bigint):string{return value.toString(16).padStart(64,'0');}
function transferCalldata(treasury:string,amountAtomic:bigint):string{return `0xa9059cbb${treasury.slice(2).padStart(64,'0')}${bigintHex(amountAtomic)}`;}
function requiredTopupConfig(){
  const enabled=(process.env.BILLING_TESTNET_TOPUP_ENABLED??'false').trim().toLowerCase()==='true';
  const asset=process.env.BILLING_TESTNET_USDC_ADDRESS?.trim();
  const treasury=process.env.BILLING_SERVICE_TREASURY_ADDRESS?.trim();
  const rpc=process.env.ARBITRUM_SEPOLIA_RPC_URL?.trim()||process.env.AGENTPLACE_EVM_RPC_421614?.trim();
  if(!enabled)return {enabled:false as const};
  if(!asset||!treasury||!rpc)throw new Error('BILLING_TESTNET_TOPUP_CONFIG_INCOMPLETE');
  return {enabled:true as const,assetAddress:normalizeAddress(asset),treasuryAddress:normalizeAddress(treasury),rpcUrl:rpc};
}

async function ensureAccount(ownerUserId:string, db:SqlExecutor=getDatabasePool()):Promise<void>{
  await db.query(`INSERT INTO billing_account(owner_user_id) VALUES($1) ON CONFLICT(owner_user_id) DO NOTHING`,[ownerUserId]);
}

export async function getServiceBalanceCents(ownerUserId:string, db:SqlExecutor=getDatabasePool()):Promise<number>{
  await ensureAccount(ownerUserId,db);
  const result=await db.query<{balance:string}>(`SELECT COALESCE(SUM(CASE WHEN direction='credit' THEN amount_cents ELSE -amount_cents END),0)::text AS balance FROM billing_ledger_entry WHERE owner_user_id=$1`,[ownerUserId]);
  return Math.max(0,Number(result.rows[0]?.balance??0));
}

export async function getBillingState(ownerUserId:string):Promise<BillingState>{
  await ensureAccount(ownerUserId);
  const {start,end}=monthWindow();
  const [accountResult,balance,spendResult,ledgerResult,usageResult,subscriptionResult,entitlementResult,modelUsageResult,externalUsageResult]=await Promise.all([
    getDatabasePool().query<{plan_id:'free'|'pro'|'builder';monthly_variable_limit_cents:string;single_job_threshold_cents:string}>(`SELECT plan_id,monthly_variable_limit_cents::text,single_job_threshold_cents::text FROM billing_account WHERE owner_user_id=$1`,[ownerUserId]),
    getServiceBalanceCents(ownerUserId),
    getDatabasePool().query<{spent:string}>(`SELECT COALESCE(SUM(amount_cents),0)::text AS spent FROM billing_ledger_entry WHERE owner_user_id=$1 AND direction='debit' AND occurred_at >= $2 AND occurred_at < $3`,[ownerUserId,start,end]),
    getDatabasePool().query<any>(`SELECT id,direction,category,amount_cents::text,description,paid_by,source_type,source_id,job_id,routine_id,worker_id,creator_asset_type,creator_asset_id,occurred_at FROM billing_ledger_entry WHERE owner_user_id=$1 ORDER BY occurred_at DESC LIMIT 200`,[ownerUserId]),
    getDatabasePool().query<any>(`SELECT id,category,amount_cents::text,description,paid_by,job_id,routine_id,worker_id,creator_asset_type,creator_asset_id,occurred_at FROM billing_usage_event WHERE owner_user_id=$1 ORDER BY occurred_at DESC LIMIT 300`,[ownerUserId]),
    getDatabasePool().query<any>(`SELECT s.id,s.entitlement_id,s.offer_id,e.asset_type,e.asset_id,s.status,s.current_period_start,s.current_period_end,s.cancelled_at,s.price_cents::text,COALESCE(w.name,wf.name,c.name,'Creator asset') AS name,COALESCE(w.creator_name,ml.creator_name,'Creator') AS creator_name FROM billing_subscription s JOIN marketplace_entitlement e ON e.id=s.entitlement_id JOIN marketplace_offer o ON o.id=s.offer_id LEFT JOIN worker_definition w ON e.asset_type='worker' AND w.id=e.asset_id LEFT JOIN workflow_definition wf ON e.asset_type='workflow' AND wf.id=e.asset_id LEFT JOIN creator_capability c ON e.asset_type='capability' AND c.id=e.asset_id LEFT JOIN marketplace_listing ml ON ml.asset_type=e.asset_type AND ml.asset_id=e.asset_id WHERE s.owner_user_id=$1 ORDER BY s.updated_at DESC`,[ownerUserId]),
    getDatabasePool().query<any>(`SELECT id,asset_type,asset_id,offer_id,status,acquired_at,access_expires_at FROM marketplace_entitlement WHERE owner_user_id=$1 ORDER BY acquired_at DESC`,[ownerUserId]),
    getDatabasePool().query<any>(`SELECT id,job_id,worker_id,provider,model,estimated_cost_usd::text,created_at FROM model_run WHERE owner_user_id=$1 AND estimated_cost_usd>0 ORDER BY created_at DESC LIMIT 200`,[ownerUserId]),
    getDatabasePool().query<any>(`SELECT id,job_id,service_id,amount_atomic::text,status,created_at FROM telegraph_service_payment WHERE owner_user_id=$1 AND status IN ('settled','unknown') ORDER BY created_at DESC LIMIT 100`,[ownerUserId]),
  ]);
  const row=accountResult.rows[0]; if(!row)throw new Error('BILLING_ACCOUNT_NOT_FOUND');
  let topUp:BillingState['topUp']={enabled:false,networkId:'arbitrum-sepolia',chainId:421614,assetSymbol:'USDC'};
  try{const cfg=requiredTopupConfig();if(cfg.enabled)topUp={enabled:true,networkId:'arbitrum-sepolia',chainId:421614,assetSymbol:'USDC',assetAddress:cfg.assetAddress,treasuryAddress:cfg.treasuryAddress};}catch{topUp={enabled:false,networkId:'arbitrum-sepolia',chainId:421614,assetSymbol:'USDC'};}
  return {
    account:{planId:row.plan_id,planName:planName(row.plan_id),serviceBalanceCents:balance,variableSpendThisMonthCents:Number(spendResult.rows[0]?.spent??0),billingPeriodStart:start.toISOString(),billingPeriodEnd:end.toISOString(),monthlyVariableLimitCents:Number(row.monthly_variable_limit_cents),singleJobThresholdCents:Number(row.single_job_threshold_cents)},
    ledger:ledgerResult.rows.map((r:any)=>({id:r.id,direction:r.direction,category:r.category,amountCents:Number(r.amount_cents),description:r.description,paidBy:r.paid_by,sourceType:r.source_type,sourceId:r.source_id,...(r.job_id?{jobId:r.job_id}:{}),...(r.routine_id?{routineId:r.routine_id}:{}),...(r.worker_id?{workerId:r.worker_id}:{}),...(r.creator_asset_type?{creatorAssetType:r.creator_asset_type}:{}),...(r.creator_asset_id?{creatorAssetId:r.creator_asset_id}:{}),occurredAt:asDate(r.occurred_at)})),
    usage:[
      ...usageResult.rows.map((r:any)=>({id:r.id,category:r.category,amountCents:Number(r.amount_cents),description:r.description,paidBy:r.paid_by,...(r.job_id?{jobId:r.job_id}:{}),...(r.routine_id?{routineId:r.routine_id}:{}),...(r.worker_id?{workerId:r.worker_id}:{}),...(r.creator_asset_type?{creatorAssetType:r.creator_asset_type}:{}),...(r.creator_asset_id?{creatorAssetId:r.creator_asset_id}:{}),occurredAt:asDate(r.occurred_at)} as UsageEvent)),
      ...modelUsageResult.rows.map((r:any)=>({id:`model:${r.id}`,category:'agentplace-service' as const,amountCents:Math.round(Number(r.estimated_cost_usd)*100),description:`Model runtime · ${r.provider}/${r.model}`,paidBy:'included-in-plan' as const,...(r.job_id?{jobId:r.job_id}:{}),...(r.worker_id?{workerId:r.worker_id}:{}),occurredAt:asDate(r.created_at)})),
      ...externalUsageResult.rows.map((r:any)=>({id:`telegraph:${r.id}`,category:'external-provider' as const,amountCents:Math.round(Number(BigInt(r.amount_atomic))/10_000),description:`External provider · ${r.service_id}${r.status==='unknown'?' · settlement status unknown':''}`,paidBy:'covered-by-agentplace' as const,jobId:r.job_id,occurredAt:asDate(r.created_at)})),
    ].sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt)).slice(0,300),
    subscriptions:subscriptionResult.rows.map((r:any)=>({id:r.id,entitlementId:r.entitlement_id,offerId:r.offer_id,assetType:r.asset_type,assetId:r.asset_id,name:r.name,creatorName:r.creator_name,status:r.status,currentPeriodStart:asDate(r.current_period_start),currentPeriodEnd:asDate(r.current_period_end),...(r.cancelled_at?{cancelledAt:asDate(r.cancelled_at)}:{}),priceCents:Number(r.price_cents)})),
    entitlements:entitlementResult.rows.map((r:any)=>({id:r.id,assetType:r.asset_type,assetId:r.asset_id,offerId:r.offer_id,status:r.status,acquiredAt:asDate(r.acquired_at),...(r.access_expires_at?{accessExpiresAt:asDate(r.access_expires_at)}:{})})),
    topUp,
  };
}

export async function updateSpendControls(ownerUserId:string,input:{monthlyVariableLimitCents:number;singleJobThresholdCents:number}):Promise<BillingAccountSnapshot>{
  const monthly=cents(input.monthlyVariableLimitCents),single=cents(input.singleJobThresholdCents);
  if(monthly>100_000_000||single>100_000_000)throw new Error('BILLING_SPEND_CONTROL_TOO_LARGE');
  await ensureAccount(ownerUserId);
  await getDatabasePool().query(`UPDATE billing_account SET monthly_variable_limit_cents=$2,single_job_threshold_cents=$3,updated_at=now() WHERE owner_user_id=$1`,[ownerUserId,monthly,single]);
  return (await getBillingState(ownerUserId)).account;
}

async function assetOwnerAndName(db:SqlExecutor,assetType:AssetType,assetId:string):Promise<{creatorUserId?:string;name:string;creatorName:string;published:boolean;quarantined:boolean}> {
  if(assetType==='worker'){
    const r=await db.query<any>(`SELECT creator_user_id,name,creator_name,publication_status,trust_status FROM worker_definition WHERE id=$1`,[assetId]);const row=r.rows[0];if(!row)throw new Error('MARKETPLACE_ASSET_NOT_FOUND');return {creatorUserId:row.creator_user_id??undefined,name:row.name,creatorName:row.creator_name,published:row.publication_status==='published',quarantined:row.trust_status==='quarantined'};
  }
  if(assetType==='workflow'){
    const r=await db.query<any>(`SELECT d.creator_user_id,d.name,d.publication_status,COALESCE(l.creator_name,'Creator') creator_name FROM workflow_definition d LEFT JOIN marketplace_listing l ON l.asset_type='workflow' AND l.asset_id=d.id WHERE d.id=$1`,[assetId]);const row=r.rows[0];if(!row)throw new Error('MARKETPLACE_ASSET_NOT_FOUND');return {creatorUserId:row.creator_user_id,name:row.name,creatorName:row.creator_name,published:row.publication_status==='published',quarantined:false};
  }
  const r=await db.query<any>(`SELECT c.creator_user_id,c.name,c.publication_status,c.trust_status,COALESCE(l.creator_name,'Creator') creator_name FROM creator_capability c LEFT JOIN marketplace_listing l ON l.asset_type='capability' AND l.asset_id=c.id WHERE c.id=$1`,[assetId]);const row=r.rows[0];if(!row)throw new Error('MARKETPLACE_ASSET_NOT_FOUND');return {creatorUserId:row.creator_user_id,name:row.name,creatorName:row.creator_name,published:row.publication_status==='published',quarantined:row.trust_status==='quarantined'};
}

function validatePricingModel(assetType:AssetType,model:PricingModel,priceCents:number):void{
  const allowed:Record<AssetType,PricingModel[]>={worker:['free','monthly'],workflow:['free','one-time'],capability:['free','per-invocation']};
  if(!allowed[assetType].includes(model))throw new Error('BILLING_PRICING_MODEL_NOT_ALLOWED');
  if(model==='free'&&priceCents!==0)throw new Error('BILLING_FREE_PRICE_MUST_BE_ZERO');
  if(model!=='free'&&(priceCents<1||priceCents>10_000_000))throw new Error('BILLING_INVALID_PRICE');
}

export async function setMarketplaceOffer(ownerUserId:string,assetType:AssetType,assetId:string,input:{pricingModel:PricingModel;priceCents:number}):Promise<CommercialOffer>{
  const price=cents(input.priceCents);validatePricingModel(assetType,input.pricingModel,price);
  const asset=await assetOwnerAndName(getDatabasePool(),assetType,assetId);if(asset.creatorUserId!==ownerUserId)throw new Error('BILLING_ASSET_NOT_OWNED');
  const offerId=`offer_${assetType}_${assetId}`;
  await getDatabasePool().query(`INSERT INTO marketplace_offer(id,asset_type,asset_id,creator_user_id,pricing_model,price_cents) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(asset_type,asset_id) DO UPDATE SET pricing_model=EXCLUDED.pricing_model,price_cents=EXCLUDED.price_cents,active=true,updated_at=now()`,[offerId,assetType,assetId,ownerUserId,input.pricingModel,price]);
  await getDatabasePool().query(`UPDATE marketplace_listing SET pricing_type=$3,pricing_label=$4,updated_at=now() WHERE asset_type=$1 AND asset_id=$2`,[assetType,assetId,input.pricingModel==='free'?'free':'paid',priceLabel(input.pricingModel,price)]);
  return {id:offerId,assetType,assetId,creatorUserId:ownerUserId,pricingModel:input.pricingModel,priceCents:price,currency:'USD',active:true};
}

export function priceLabel(model:PricingModel,price:number):string{
  if(model==='free')return 'Free';const usd=`$${(price/100).toFixed(2)}`;return model==='monthly'?`${usd}/month`:model==='one-time'?`${usd} one-time`:`${usd}/invocation`;
}

export async function getMarketplaceOffer(assetType:AssetType,assetId:string,db:SqlExecutor=getDatabasePool()):Promise<CommercialOffer>{
  const result=await db.query<any>(`SELECT id,asset_type,asset_id,creator_user_id,pricing_model,price_cents::text,currency,active FROM marketplace_offer WHERE asset_type=$1 AND asset_id=$2 AND active=true`,[assetType,assetId]);
  const row=result.rows[0];if(!row)return {id:`free_${assetType}_${assetId}`,assetType,assetId,pricingModel:'free',priceCents:0,currency:'USD',active:true};
  return {id:row.id,assetType:row.asset_type,assetId:row.asset_id,...(row.creator_user_id?{creatorUserId:row.creator_user_id}:{}),pricingModel:row.pricing_model,priceCents:Number(row.price_cents),currency:'USD',active:row.active};
}

export async function getMarketplaceQuote(ownerUserId:string,assetType:AssetType,assetId:string):Promise<{offer:CommercialOffer;assetName:string;creatorName:string;serviceBalanceCents:number;monthlyRemainingCents:number;entitled:boolean;authorityNotice:string}> {
  const asset=await assetOwnerAndName(getDatabasePool(),assetType,assetId);if(!asset.published)throw new Error('MARKETPLACE_ASSET_NOT_PUBLIC');if(asset.quarantined)throw new Error('MARKETPLACE_ASSET_QUARANTINED');
  const [offer,state,entitlement]=await Promise.all([getMarketplaceOffer(assetType,assetId),getBillingState(ownerUserId),getDatabasePool().query(`SELECT id FROM marketplace_entitlement WHERE owner_user_id=$1 AND asset_type=$2 AND asset_id=$3 AND status='active'`,[ownerUserId,assetType,assetId])]);
  return {offer,assetName:asset.name,creatorName:asset.creatorName,serviceBalanceCents:state.account.serviceBalanceCents,monthlyRemainingCents:Math.max(0,state.account.monthlyVariableLimitCents-state.account.variableSpendThisMonthCents),entitled:Boolean(entitlement.rowCount),authorityNotice:offer.pricingModel==='per-invocation'?'Activating metered access records commercial eligibility only. M13 does not charge an invocation unless a separately trusted AgentPlace runtime route exists. No wallet authority, mandate or permission to move funds is created.':'Buying or subscribing grants marketplace access only. It creates no wallet authority, mandate or permission to move funds.'};
}

export async function acquireMarketplaceAsset(ownerUserId:string,assetType:AssetType,assetId:string):Promise<{entitlement:Entitlement;subscription?:BillingSubscription;chargedCents:number}> {
  let output:{entitlement:Entitlement;subscription?:BillingSubscription;chargedCents:number}|undefined;
  await withTransaction(async(db)=>{
    await ensureAccount(ownerUserId,db);
    const asset=await assetOwnerAndName(db,assetType,assetId);if(!asset.published)throw new Error('MARKETPLACE_ASSET_NOT_PUBLIC');if(asset.quarantined)throw new Error('MARKETPLACE_ASSET_QUARANTINED');
    const offer=await getMarketplaceOffer(assetType,assetId,db);
    const existing=await db.query<any>(`SELECT id,offer_id,status,acquired_at,access_expires_at FROM marketplace_entitlement WHERE owner_user_id=$1 AND asset_type=$2 AND asset_id=$3 FOR UPDATE`,[ownerUserId,assetType,assetId]);
    if(existing.rows[0]?.status==='active'){
      output={entitlement:{id:existing.rows[0].id,assetType,assetId,offerId:existing.rows[0].offer_id,status:'active',acquiredAt:asDate(existing.rows[0].acquired_at),...(existing.rows[0].access_expires_at?{accessExpiresAt:asDate(existing.rows[0].access_expires_at)}:{})},chargedCents:0};return;
    }
    const account=await db.query<{monthly_variable_limit_cents:string}>(`SELECT monthly_variable_limit_cents::text FROM billing_account WHERE owner_user_id=$1 FOR UPDATE`,[ownerUserId]);
    const {start,end}=monthWindow();
    const spent=await db.query<{spent:string}>(`SELECT COALESCE(SUM(amount_cents),0)::text spent FROM billing_ledger_entry WHERE owner_user_id=$1 AND direction='debit' AND occurred_at >= $2 AND occurred_at < $3`,[ownerUserId,start,end]);
    const balance=await getServiceBalanceCents(ownerUserId,db);
    const charge=offer.pricingModel==='per-invocation'?0:offer.priceCents;
    if(charge>balance)throw new Error('BILLING_INSUFFICIENT_SERVICE_BALANCE');
    const monthlyLimit=Number(account.rows[0]?.monthly_variable_limit_cents??0),monthSpent=Number(spent.rows[0]?.spent??0);
    if(charge>0&&monthlyLimit>0&&monthSpent+charge>monthlyLimit)throw new Error('BILLING_MONTHLY_LIMIT_EXCEEDED');
    const entitlementId=id('ent');
    await db.query(`INSERT INTO marketplace_entitlement(id,owner_user_id,offer_id,asset_type,asset_id,status,access_expires_at) VALUES($1,$2,$3,$4,$5,'active',$6) ON CONFLICT(owner_user_id,asset_type,asset_id) DO UPDATE SET offer_id=EXCLUDED.offer_id,status='active',access_expires_at=EXCLUDED.access_expires_at,acquired_at=now()`,[entitlementId,ownerUserId,offer.id,assetType,assetId,offer.pricingModel==='monthly'?nextMonth():null]);
    const ent=await db.query<any>(`SELECT id,offer_id,status,acquired_at,access_expires_at FROM marketplace_entitlement WHERE owner_user_id=$1 AND asset_type=$2 AND asset_id=$3`,[ownerUserId,assetType,assetId]);const er=ent.rows[0];
    let subscription:BillingSubscription|undefined;
    if(charge>0){
      const key=`marketplace-acquire:${assetType}:${assetId}:${offer.id}`;
      await db.query(`INSERT INTO billing_ledger_entry(id,owner_user_id,direction,category,amount_cents,description,paid_by,source_type,source_id,creator_asset_type,creator_asset_id,idempotency_key) VALUES($1,$2,'debit',$3,$4,$5,'service-balance','marketplace-acquisition',$6,$7,$8,$9) ON CONFLICT(owner_user_id,idempotency_key) DO NOTHING`,[id('ble'),ownerUserId,offer.pricingModel==='monthly'?'subscription':'external-worker',charge,`${asset.name} · ${priceLabel(offer.pricingModel,offer.priceCents)}`,offer.id,assetType,assetId,key]);
      await db.query(`INSERT INTO billing_usage_event(id,owner_user_id,category,amount_cents,description,paid_by,creator_asset_type,creator_asset_id,idempotency_key) VALUES($1,$2,$3,$4,$5,'service-balance',$6,$7,$8) ON CONFLICT(owner_user_id,idempotency_key) DO NOTHING`,[id('bue'),ownerUserId,offer.pricingModel==='monthly'?'subscription':'external-worker',charge,`${asset.name} acquisition`,assetType,assetId,key]);
      if(asset.creatorUserId&&asset.creatorUserId!==ownerUserId){
        await db.query(`INSERT INTO creator_revenue_entry(id,creator_user_id,asset_type,asset_id,entitlement_id,gross_cents,allocation_status,payout_status,source_type,source_id,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,'unallocated','not-payable-yet','marketplace-acquisition',$7,$8) ON CONFLICT(creator_user_id,idempotency_key) DO NOTHING`,[id('crev'),asset.creatorUserId,assetType,assetId,er.id,charge,offer.id,`marketplace-acquire:${ownerUserId}:${assetType}:${assetId}:${offer.id}`]);
      }
    }
    if(offer.pricingModel==='monthly'){
      const subscriptionId=id('sub');const periodStart=new Date(),periodEnd=nextMonth(periodStart);
      await db.query(`INSERT INTO billing_subscription(id,owner_user_id,entitlement_id,offer_id,price_cents,status,current_period_start,current_period_end) VALUES($1,$2,$3,$4,$5,'active',$6,$7) ON CONFLICT(owner_user_id,entitlement_id) DO UPDATE SET offer_id=EXCLUDED.offer_id,price_cents=EXCLUDED.price_cents,status='active',current_period_start=EXCLUDED.current_period_start,current_period_end=EXCLUDED.current_period_end,cancelled_at=NULL,updated_at=now()`,[subscriptionId,ownerUserId,er.id,offer.id,offer.priceCents,periodStart,periodEnd]);
      const sr=await db.query<any>(`SELECT id,status,current_period_start,current_period_end,cancelled_at FROM billing_subscription WHERE owner_user_id=$1 AND entitlement_id=$2`,[ownerUserId,er.id]);const s=sr.rows[0];
      subscription={id:s.id,entitlementId:er.id,offerId:offer.id,assetType,assetId,name:asset.name,creatorName:asset.creatorName,status:s.status,currentPeriodStart:asDate(s.current_period_start),currentPeriodEnd:asDate(s.current_period_end),priceCents:offer.priceCents};
      if(asset.creatorUserId&&asset.creatorUserId!==ownerUserId)await db.query(`UPDATE creator_revenue_entry SET subscription_id=$3 WHERE creator_user_id=$1 AND idempotency_key=$2`,[asset.creatorUserId,`marketplace-acquire:${ownerUserId}:${assetType}:${assetId}:${offer.id}`,s.id]);
    }
    output={entitlement:{id:er.id,assetType,assetId,offerId:er.offer_id,status:er.status,acquiredAt:asDate(er.acquired_at),...(er.access_expires_at?{accessExpiresAt:asDate(er.access_expires_at)}:{})},...(subscription?{subscription}:{}),chargedCents:charge};
  });
  if(!output)throw new Error('BILLING_ACQUISITION_FAILED');return output;
}


export async function assertMarketplaceAccess(ownerUserId:string,assetType:AssetType,assetId:string,db:SqlExecutor=getDatabasePool()):Promise<void>{
  const asset=await assetOwnerAndName(db,assetType,assetId);
  if(asset.quarantined)throw new Error('MARKETPLACE_ASSET_QUARANTINED');
  const offer=await getMarketplaceOffer(assetType,assetId,db);
  if(offer.pricingModel==='free')return;
  const entitlement=await db.query<{status:string;access_expires_at:Date|null}>(`SELECT status,access_expires_at FROM marketplace_entitlement WHERE owner_user_id=$1 AND asset_type=$2 AND asset_id=$3`,[ownerUserId,assetType,assetId]);
  const row=entitlement.rows[0];
  if(!row||row.status!=='active'||(row.access_expires_at&&row.access_expires_at.getTime()<=Date.now()))throw new Error('BILLING_MARKETPLACE_ENTITLEMENT_REQUIRED');
}

export async function cancelSubscription(ownerUserId:string,subscriptionId:string):Promise<void>{
  await withTransaction(async(db)=>{
    const current=await db.query<{status:string;entitlement_id:string}>(`SELECT status,entitlement_id FROM billing_subscription WHERE owner_user_id=$1 AND id=$2 FOR UPDATE`,[ownerUserId,subscriptionId]);
    const row=current.rows[0];if(!row||!['active','past-due'].includes(row.status))throw new Error('BILLING_SUBSCRIPTION_NOT_ACTIVE');
    if(row.status==='past-due'){
      await db.query(`UPDATE billing_subscription SET status='cancelled',cancelled_at=now(),updated_at=now() WHERE owner_user_id=$1 AND id=$2`,[ownerUserId,subscriptionId]);
      await db.query(`UPDATE marketplace_entitlement SET status='cancelled' WHERE owner_user_id=$1 AND id=$2`,[ownerUserId,row.entitlement_id]);
    }else{
      await db.query(`UPDATE billing_subscription SET status='pending-cancel',cancelled_at=now(),updated_at=now() WHERE owner_user_id=$1 AND id=$2`,[ownerUserId,subscriptionId]);
    }
  });
}

export async function processBillingRenewals(limit=25):Promise<{due:number;renewed:number;pastDue:number;cancelled:number}>{
  const summary={due:0,renewed:0,pastDue:0,cancelled:0};
  await withTransaction(async(db)=>{
    const subscriptions=await db.query<any>(`SELECT s.id,s.owner_user_id,s.entitlement_id,s.offer_id,s.status,s.current_period_end,s.price_cents::text,o.asset_type,o.asset_id,o.creator_user_id,o.pricing_model FROM billing_subscription s JOIN marketplace_offer o ON o.id=s.offer_id WHERE s.current_period_end<=now() AND s.status IN ('active','past-due','pending-cancel') AND (s.status<>'past-due' OR s.updated_at < now()-interval '1 hour') ORDER BY s.current_period_end ASC LIMIT $1 FOR UPDATE OF s SKIP LOCKED`,[Math.max(1,Math.min(100,Math.trunc(limit)))]);
    summary.due=subscriptions.rowCount??0;
    for(const sub of subscriptions.rows){
      if(sub.status==='pending-cancel'){
        await db.query(`UPDATE billing_subscription SET status='cancelled',updated_at=now() WHERE id=$1`,[sub.id]);
        await db.query(`UPDATE marketplace_entitlement SET status='cancelled' WHERE id=$1 AND owner_user_id=$2`,[sub.entitlement_id,sub.owner_user_id]);
        await db.query(`INSERT INTO domain_event(id,owner_user_id,event_type,object_type,object_id,title,summary,effect,status,origin_type,metadata) VALUES($1,$2,'billing.subscription.cancelled','subscription',$3,'Subscription ended','The paid period ended and renewal was cancelled.','Marketplace access ended. Wallet authority was never affected.','cancelled','scheduler',$4::jsonb)`,[id('evt'),sub.owner_user_id,sub.id,JSON.stringify({assetType:sub.asset_type,assetId:sub.asset_id})]);
        summary.cancelled++;continue;
      }
      if(sub.pricing_model!=='monthly'||Number(sub.price_cents)<=0){
        await db.query(`UPDATE billing_subscription SET status='cancelled',updated_at=now() WHERE id=$1`,[sub.id]);
        await db.query(`UPDATE marketplace_entitlement SET status='cancelled' WHERE id=$1 AND owner_user_id=$2`,[sub.entitlement_id,sub.owner_user_id]);
        summary.cancelled++;continue;
      }
      await ensureAccount(sub.owner_user_id,db);
      const account=await db.query<{monthly_variable_limit_cents:string}>(`SELECT monthly_variable_limit_cents::text FROM billing_account WHERE owner_user_id=$1 FOR UPDATE`,[sub.owner_user_id]);
      const {start,end}=monthWindow();
      const spent=await db.query<{spent:string}>(`SELECT COALESCE(SUM(amount_cents),0)::text spent FROM billing_ledger_entry WHERE owner_user_id=$1 AND direction='debit' AND occurred_at >= $2 AND occurred_at < $3`,[sub.owner_user_id,start,end]);
      const balance=await getServiceBalanceCents(sub.owner_user_id,db),price=Number(sub.price_cents),limitCents=Number(account.rows[0]?.monthly_variable_limit_cents??0),spentCents=Number(spent.rows[0]?.spent??0);
      const insufficient=price>balance||(limitCents>0&&spentCents+price>limitCents);
      if(insufficient){
        const wasPastDue=sub.status==='past-due';
        await db.query(`UPDATE billing_subscription SET status='past-due',updated_at=now() WHERE id=$1`,[sub.id]);
        if(!wasPastDue)await db.query(`INSERT INTO domain_event(id,owner_user_id,event_type,object_type,object_id,title,summary,effect,status,origin_type,metadata) VALUES($1,$2,'billing.subscription.past_due','subscription',$3,'Subscription needs service balance','AgentPlace could not renew this subscription inside the current service-balance/spend limits.','Access is not renewed. No wallet was charged and no authority changed.','needs-you','scheduler',$4::jsonb)`,[id('evt'),sub.owner_user_id,sub.id,JSON.stringify({assetType:sub.asset_type,assetId:sub.asset_id,priceCents:price})]);
        summary.pastDue++;continue;
      }
      const oldEnd=new Date(sub.current_period_end),newEnd=nextMonth(oldEnd),renewalKey=`subscription-renewal:${sub.id}:${oldEnd.toISOString()}`;
      await db.query(`INSERT INTO billing_ledger_entry(id,owner_user_id,direction,category,amount_cents,description,paid_by,source_type,source_id,creator_asset_type,creator_asset_id,idempotency_key,metadata) VALUES($1,$2,'debit','subscription',$3,'Marketplace subscription renewal','service-balance','subscription-renewal',$4,$5,$6,$7,$8::jsonb) ON CONFLICT(owner_user_id,idempotency_key) DO NOTHING`,[id('ble'),sub.owner_user_id,price,sub.id,sub.asset_type,sub.asset_id,renewalKey,JSON.stringify({offerId:sub.offer_id})]);
      await db.query(`INSERT INTO billing_usage_event(id,owner_user_id,category,amount_cents,description,paid_by,creator_asset_type,creator_asset_id,idempotency_key,metadata) VALUES($1,$2,'subscription',$3,'Marketplace subscription renewal','service-balance',$4,$5,$6,$7::jsonb) ON CONFLICT(owner_user_id,idempotency_key) DO NOTHING`,[id('bue'),sub.owner_user_id,price,sub.asset_type,sub.asset_id,renewalKey,JSON.stringify({offerId:sub.offer_id})]);
      if(sub.creator_user_id&&sub.creator_user_id!==sub.owner_user_id)await db.query(`INSERT INTO creator_revenue_entry(id,creator_user_id,asset_type,asset_id,entitlement_id,subscription_id,gross_cents,source_type,source_id,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7,'subscription-renewal',$6,$8) ON CONFLICT(creator_user_id,idempotency_key) DO NOTHING`,[id('rev'),sub.creator_user_id,sub.asset_type,sub.asset_id,sub.entitlement_id,sub.id,price,renewalKey]);
      await db.query(`UPDATE billing_subscription SET status='active',current_period_start=$2,current_period_end=$3,updated_at=now() WHERE id=$1`,[sub.id,oldEnd,newEnd]);
      await db.query(`UPDATE marketplace_entitlement SET status='active',access_expires_at=$3 WHERE id=$1 AND owner_user_id=$2`,[sub.entitlement_id,sub.owner_user_id,newEnd]);
      await db.query(`INSERT INTO domain_event(id,owner_user_id,event_type,object_type,object_id,title,summary,effect,status,origin_type,metadata) VALUES($1,$2,'billing.subscription.renewed','subscription',$3,'Subscription renewed',$4,'Service balance was charged. Wallet capital and financial authority were unchanged.','complete','scheduler',$5::jsonb)`,[id('evt'),sub.owner_user_id,sub.id,`$${(price/100).toFixed(2)} renewed through ${newEnd.toISOString().slice(0,10)}.`,JSON.stringify({assetType:sub.asset_type,assetId:sub.asset_id,priceCents:price})]);
      summary.renewed++;
    }
  });
  return summary;
}

export async function recordUsage(input:{ownerUserId:string;category:BillingUsageCategory;amountCents:number;description:string;paidBy:PaidBy;idempotencyKey:string;jobId?:string;routineId?:string;workerId?:string;creatorAssetType?:AssetType;creatorAssetId?:string;metadata?:Record<string,unknown>;debitServiceBalance?:boolean}):Promise<void>{
  const amount=cents(input.amountCents);if(amount===0)return;
  await withTransaction(async(db)=>{
    await ensureAccount(input.ownerUserId,db);
    await db.query(`INSERT INTO billing_usage_event(id,owner_user_id,category,amount_cents,description,paid_by,job_id,routine_id,worker_id,creator_asset_type,creator_asset_id,idempotency_key,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb) ON CONFLICT(owner_user_id,idempotency_key) DO NOTHING`,[id('bue'),input.ownerUserId,input.category,amount,input.description,input.paidBy,input.jobId??null,input.routineId??null,input.workerId??null,input.creatorAssetType??null,input.creatorAssetId??null,input.idempotencyKey,JSON.stringify(input.metadata??{})]);
    if(input.debitServiceBalance){
      const balance=await getServiceBalanceCents(input.ownerUserId,db);if(amount>balance)throw new Error('BILLING_INSUFFICIENT_SERVICE_BALANCE');
      await db.query(`INSERT INTO billing_ledger_entry(id,owner_user_id,direction,category,amount_cents,description,paid_by,source_type,source_id,job_id,routine_id,worker_id,creator_asset_type,creator_asset_id,idempotency_key,metadata) VALUES($1,$2,'debit',$3,$4,$5,'service-balance','usage',$6,$7,$8,$9,$10,$11,$12,$13::jsonb) ON CONFLICT(owner_user_id,idempotency_key) DO NOTHING`,[id('ble'),input.ownerUserId,input.category==='subscription'?'subscription':input.category,amount,input.description,input.idempotencyKey,input.jobId??null,input.routineId??null,input.workerId??null,input.creatorAssetType??null,input.creatorAssetId??null,`ledger:${input.idempotencyKey}`,JSON.stringify(input.metadata??{})]);
    }
  });
}

export async function listJobCosts(ownerUserId:string,jobId:string):Promise<{totalCents:number;entries:UsageEvent[];modelEstimatedUsd:number;receiptCosts:Array<{category:string;label:string;amount:string;asset?:string;note?:string}>}> {
  const [usageResult,modelResult,externalResult,receiptResult]=await Promise.all([
    getDatabasePool().query<any>(`SELECT id,category,amount_cents::text,description,paid_by,job_id,routine_id,worker_id,creator_asset_type,creator_asset_id,occurred_at FROM billing_usage_event WHERE owner_user_id=$1 AND job_id=$2 ORDER BY occurred_at ASC`,[ownerUserId,jobId]),
    getDatabasePool().query<any>(`SELECT id,worker_id,provider,model,estimated_cost_usd::text,created_at FROM model_run WHERE owner_user_id=$1 AND job_id=$2 AND estimated_cost_usd>0 ORDER BY created_at ASC`,[ownerUserId,jobId]),
    getDatabasePool().query<any>(`SELECT id,service_id,amount_atomic::text,status,created_at FROM telegraph_service_payment WHERE owner_user_id=$1 AND job_id=$2 AND status IN ('settled','unknown') ORDER BY created_at ASC`,[ownerUserId,jobId]),
    getDatabasePool().query<any>(`SELECT receipt_core FROM verified_receipt WHERE owner_user_id=$1 AND job_id=$2 ORDER BY created_at DESC LIMIT 1`,[ownerUserId,jobId]),
  ]);
  const entries:UsageEvent[]=[
    ...usageResult.rows.map((r:any)=>({id:r.id,category:r.category,amountCents:Number(r.amount_cents),description:r.description,paidBy:r.paid_by,jobId:r.job_id,...(r.routine_id?{routineId:r.routine_id}:{}),...(r.worker_id?{workerId:r.worker_id}:{}),...(r.creator_asset_type?{creatorAssetType:r.creator_asset_type}:{}),...(r.creator_asset_id?{creatorAssetId:r.creator_asset_id}:{}),occurredAt:asDate(r.occurred_at)} as UsageEvent)),
    ...modelResult.rows.map((r:any)=>({id:`model:${r.id}`,category:'agentplace-service' as const,amountCents:Math.round(Number(r.estimated_cost_usd)*100),description:`Model runtime · ${r.provider}/${r.model}`,paidBy:'included-in-plan' as const,jobId,...(r.worker_id?{workerId:r.worker_id}:{}),occurredAt:asDate(r.created_at)})),
    ...externalResult.rows.map((r:any)=>({id:`telegraph:${r.id}`,category:'external-provider' as const,amountCents:Math.round(Number(BigInt(r.amount_atomic))/10_000),description:`External provider · ${r.service_id}${r.status==='unknown'?' · settlement status unknown':''}`,paidBy:'covered-by-agentplace' as const,jobId,occurredAt:asDate(r.created_at)})),
  ].sort((a,b)=>a.occurredAt.localeCompare(b.occurredAt));
  const modelEstimatedUsd=modelResult.rows.reduce((sum:number,r:any)=>sum+Number(r.estimated_cost_usd),0);
  const core=receiptResult.rows[0]?.receipt_core as {costs?:Array<{category?:unknown;label?:unknown;amount?:unknown;asset?:unknown;note?:unknown}>}|undefined;
  const receiptCosts=Array.isArray(core?.costs)?core!.costs!.filter((item)=>item&&typeof item.label==='string'&&typeof item.amount==='string').map((item)=>({category:typeof item.category==='string'?item.category:'other',label:item.label as string,amount:item.amount as string,...(typeof item.asset==='string'?{asset:item.asset}:{}),...(typeof item.note==='string'?{note:item.note}:{})})):[];
  return {totalCents:entries.reduce((sum,e)=>sum+e.amountCents,0),entries,modelEstimatedUsd,receiptCosts};
}

export async function listCreatorRevenue(ownerUserId:string):Promise<{grossCents:number;entries:CreatorRevenueEntry[]}> {
  const result=await getDatabasePool().query<any>(`SELECT r.id,r.asset_type,r.asset_id,r.gross_cents::text,r.creator_payable_cents::text,r.platform_share_cents::text,r.allocation_status,r.payout_status,r.source_type,r.source_id,r.occurred_at,COALESCE(w.name,wf.name,c.name,'Creator asset') asset_name FROM creator_revenue_entry r LEFT JOIN worker_definition w ON r.asset_type='worker' AND w.id=r.asset_id LEFT JOIN workflow_definition wf ON r.asset_type='workflow' AND wf.id=r.asset_id LEFT JOIN creator_capability c ON r.asset_type='capability' AND c.id=r.asset_id WHERE r.creator_user_id=$1 ORDER BY r.occurred_at DESC LIMIT 300`,[ownerUserId]);
  const entries=result.rows.map((r:any)=>({id:r.id,assetType:r.asset_type,assetId:r.asset_id,assetName:r.asset_name,grossCents:Number(r.gross_cents),...(r.creator_payable_cents!==null?{creatorPayableCents:Number(r.creator_payable_cents)}:{}),...(r.platform_share_cents!==null?{platformShareCents:Number(r.platform_share_cents)}:{}),allocationStatus:r.allocation_status,payoutStatus:r.payout_status,sourceType:r.source_type,sourceId:r.source_id,occurredAt:asDate(r.occurred_at)}));
  return {grossCents:entries.reduce((sum:number,e:CreatorRevenueEntry)=>sum+e.grossCents,0),entries};
}

export async function createTestnetTopupIntent(ownerUserId:string,walletId:string,amountCents:number):Promise<{paymentId:string;walletRequest:{from:string;to:string;chainId:string;data:string;value:string};amountCents:number;notice:string}> {
  const cfg=requiredTopupConfig();if(!cfg.enabled)throw new Error('BILLING_TESTNET_TOPUP_DISABLED');
  const amount=cents(amountCents);if(amount<100||amount>100_000)throw new Error('BILLING_TOPUP_AMOUNT_OUT_OF_RANGE');
  const wallet=await getDatabasePool().query<{address:string|null;mode:string;namespace:string;status:string}>(`SELECT address,mode,namespace,status FROM wallet_resource WHERE owner_user_id=$1 AND id=$2`,[ownerUserId,walletId]);const w=wallet.rows[0];
  if(!w||w.mode!=='connected'||w.namespace!=='eip155'||w.status!=='active'||!w.address)throw new Error('BILLING_CONNECTED_EVM_WALLET_REQUIRED');
  const from=normalizeAddress(w.address);
  if(from===cfg.treasuryAddress)throw new Error('BILLING_TOPUP_SELF_PAYMENT_FORBIDDEN');
  const amountAtomic=BigInt(amount)*10_000n,paymentId=id('spay');
  await getDatabasePool().query(`INSERT INTO billing_service_payment(id,owner_user_id,wallet_id,asset_address,treasury_address,amount_cents,amount_atomic) VALUES($1,$2,$3,$4,$5,$6,$7)`,[paymentId,ownerUserId,walletId,cfg.assetAddress,cfg.treasuryAddress,amount,amountAtomic.toString()]);
  return {paymentId,walletRequest:{from,to:cfg.assetAddress,chainId:`0x${(421614).toString(16)}`,data:transferCalldata(cfg.treasuryAddress,amountAtomic),value:'0x0'},amountCents:amount,notice:'This is an explicit Arbitrum Sepolia USDC payment for AgentPlace service balance. It does not fund or authorize an Agent Account.'};
}

async function rpc(url:string,method:string,params:unknown[]):Promise<any>{
  const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(12_000)});if(!response.ok)throw new Error('BILLING_TOPUP_RPC_UNAVAILABLE');const payload=await response.json() as any;if(payload.error)throw new Error('BILLING_TOPUP_RPC_ERROR');return payload.result;
}
const TRANSFER_TOPIC='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

export async function confirmTestnetTopup(ownerUserId:string,paymentId:string,transactionHash:string):Promise<BillingState>{
  if(!/^0x[0-9a-fA-F]{64}$/.test(transactionHash))throw new Error('BILLING_INVALID_TRANSACTION_HASH');const cfg=requiredTopupConfig();if(!cfg.enabled)throw new Error('BILLING_TESTNET_TOPUP_DISABLED');
  const normalizedHash=transactionHash.toLowerCase();
  try{
    await withTransaction(async(db)=>{
      const result=await db.query<any>(`SELECT p.*,w.address FROM billing_service_payment p JOIN wallet_resource w ON w.id=p.wallet_id AND w.owner_user_id=p.owner_user_id WHERE p.owner_user_id=$1 AND p.id=$2 FOR UPDATE`,[ownerUserId,paymentId]);const p=result.rows[0];if(!p)throw new Error('BILLING_TOPUP_NOT_FOUND');if(p.status==='confirmed')return;
      const prior=await db.query<{id:string}>(`SELECT id FROM billing_service_payment WHERE transaction_hash=$1 AND id<>$2 LIMIT 1`,[normalizedHash,paymentId]);if(prior.rows[0])throw new Error('BILLING_TOPUP_TRANSACTION_ALREADY_USED');
      const receipt=await rpc(cfg.rpcUrl,'eth_getTransactionReceipt',[normalizedHash]);if(!receipt)throw new Error('BILLING_TOPUP_NOT_CONFIRMED');if(receipt.status!=='0x1')throw new Error('BILLING_TOPUP_TRANSACTION_FAILED');
      const fromTopic=topicAddress(normalizeAddress(p.address));const toTopic=topicAddress(cfg.treasuryAddress);const minimum=BigInt(p.amount_atomic);
      const matched=Array.isArray(receipt.logs)&&receipt.logs.some((log:any)=>typeof log?.address==='string'&&log.address.toLowerCase()===cfg.assetAddress&&Array.isArray(log.topics)&&log.topics[0]?.toLowerCase()===TRANSFER_TOPIC&&log.topics[1]?.toLowerCase()===fromTopic&&log.topics[2]?.toLowerCase()===toTopic&&typeof log.data==='string'&&BigInt(log.data)>=minimum);
      if(!matched)throw new Error('BILLING_TOPUP_TRANSFER_MISMATCH');
      await db.query(`UPDATE billing_service_payment SET status='confirmed',transaction_hash=$3,confirmed_at=now() WHERE owner_user_id=$1 AND id=$2`,[ownerUserId,paymentId,normalizedHash]);
      await db.query(`INSERT INTO billing_ledger_entry(id,owner_user_id,direction,category,amount_cents,description,paid_by,source_type,source_id,idempotency_key,metadata) VALUES($1,$2,'credit','service-topup',$3,'Arbitrum Sepolia USDC service balance top-up','user-wallet','service-payment',$4,$5,$6::jsonb) ON CONFLICT(owner_user_id,idempotency_key) DO NOTHING`,[id('ble'),ownerUserId,Number(p.amount_cents),paymentId,`service-payment:${paymentId}`,JSON.stringify({transactionHash:normalizedHash,networkId:'arbitrum-sepolia',asset:'USDC'})]);
      await db.query(`INSERT INTO domain_event(id,owner_user_id,event_type,object_type,object_id,title,summary,effect,status,origin_type,metadata) VALUES($1,$2,'billing.service_balance.funded','service-payment',$3,'Service balance funded',$4,'Service balance is separate from wallet and Agent Account capital.','confirmed','user',$5::jsonb)`,[id('evt'),ownerUserId,paymentId,`$${(Number(p.amount_cents)/100).toFixed(2)} USDC payment confirmed on Arbitrum Sepolia.`,JSON.stringify({transactionHash:normalizedHash})]);
    });
  }catch(error){
    const dbError=error as {code?:string;constraint?:string};
    if(dbError.code==='23505'&&dbError.constraint==='billing_service_payment_transaction_hash_unique_idx')throw new Error('BILLING_TOPUP_TRANSACTION_ALREADY_USED');
    throw error;
  }
  return getBillingState(ownerUserId);
}

export const moduleManifest={name:'billing',layer:'trusted-core',milestone:13,status:'production-ledger-commercial-kernel'} as const;
