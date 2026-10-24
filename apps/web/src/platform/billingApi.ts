import { WEB_RUNTIME_SETTINGS } from './runtime';
import type { ApiWalletTransactionRequest } from './executionApi';

export type AssetType = 'worker'|'workflow'|'capability';
export type PricingModel = 'free'|'monthly'|'one-time'|'per-invocation';
export type BillingUsageCategory = 'agentplace-service'|'external-worker'|'external-capability'|'external-provider'|'onchain-gas'|'bridge-fee'|'protocol-fee'|'subscription';
export type PaidBy = 'service-balance'|'included-in-plan'|'user-wallet'|'agent-account'|'covered-by-agentplace'|'external-subscription';

export interface BillingAccountSnapshot {
  planId:'free'|'pro'|'builder'; planName:string; serviceBalanceCents:number; variableSpendThisMonthCents:number;
  billingPeriodStart:string; billingPeriodEnd:string; monthlyVariableLimitCents:number; singleJobThresholdCents:number;
}
export interface BillingLedgerEntry {
  id:string; direction:'credit'|'debit'; category:string; amountCents:number; description:string; paidBy:string; sourceType:string; sourceId:string;
  jobId?:string; routineId?:string; workerId?:string; creatorAssetType?:AssetType; creatorAssetId?:string; occurredAt:string;
}
export interface BillingUsageEvent {
  id:string; category:BillingUsageCategory; amountCents:number; description:string; paidBy:PaidBy; jobId?:string; routineId?:string; workerId?:string;
  creatorAssetType?:AssetType; creatorAssetId?:string; occurredAt:string;
}
export interface BillingSubscriptionSnapshot {
  id:string; entitlementId:string; offerId:string; assetType:AssetType; assetId:string; name:string; creatorName:string; status:'active'|'past-due'|'pending-cancel'|'cancelled';
  currentPeriodStart:string; currentPeriodEnd:string; cancelledAt?:string; priceCents:number;
}
export interface BillingStateSnapshot {
  account:BillingAccountSnapshot; ledger:BillingLedgerEntry[]; usage:BillingUsageEvent[]; subscriptions:BillingSubscriptionSnapshot[];
  entitlements:Array<{id:string;assetType:AssetType;assetId:string;offerId:string;status:string;acquiredAt:string;accessExpiresAt?:string}>;
  topUp:{enabled:boolean;networkId:'arbitrum-sepolia';chainId:421614;assetSymbol:'USDC';assetAddress?:string;treasuryAddress?:string};
}
export interface MarketplaceQuote {
  offer:{id:string;assetType:AssetType;assetId:string;creatorUserId?:string;pricingModel:PricingModel;priceCents:number;currency:'USD';active:boolean};
  assetName:string; creatorName:string; serviceBalanceCents:number; monthlyRemainingCents:number; entitled:boolean; authorityNotice:string;
}
export interface CreatorRevenueSnapshot {
  grossCents:number;
  entries:Array<{id:string;assetType:AssetType;assetId:string;assetName:string;grossCents:number;creatorPayableCents?:number;platformShareCents?:number;allocationStatus:'unallocated'|'allocated';payoutStatus:'not-payable-yet'|'pending'|'settled';sourceType:string;sourceId:string;occurredAt:string}>;
}
export interface JobCostSnapshot {
  totalCents:number;
  entries:BillingUsageEvent[];
  modelEstimatedUsd:number;
  receiptCosts:Array<{category:string;label:string;amount:string;asset?:string;note?:string}>;
}

function endpoint(path:string):string{return `${WEB_RUNTIME_SETTINGS.apiBaseUrl}${path}`;}
async function request<T>(path:string,init?:RequestInit):Promise<T>{
  const response=await fetch(endpoint(path),{...init,credentials:'include',headers:{accept:'application/json','content-type':'application/json',...(init?.headers??{})}});
  const payload=await response.json().catch(()=>null) as ({message?:string}&T)|null;
  if(!response.ok)throw new Error(payload?.message||`AgentPlace billing request failed (${response.status})`);
  return payload as T;
}

export function money(cents:number):string{return `$${(cents/100).toFixed(2)}`;}
export function pricingLabel(model:PricingModel,cents:number):string{
  if(model==='free')return 'Free';
  if(model==='monthly')return `${money(cents)}/month`;
  if(model==='one-time')return `${money(cents)} one-time`;
  return `${money(cents)}/invocation`;
}

export async function fetchBillingState():Promise<BillingStateSnapshot>{return request<BillingStateSnapshot>('/api/v1/billing');}
export async function updateBillingSpendControls(input:{monthlyVariableLimitCents:number;singleJobThresholdCents:number}):Promise<BillingAccountSnapshot>{return (await request<{account:BillingAccountSnapshot}>('/api/v1/billing/spend-controls',{method:'PATCH',body:JSON.stringify(input)})).account;}
export async function createBillingTopup(walletId:string,amountCents:number):Promise<{paymentId:string;walletRequest:ApiWalletTransactionRequest;amountCents:number;notice:string}>{return (await request<{payment:{paymentId:string;walletRequest:ApiWalletTransactionRequest;amountCents:number;notice:string}}>('/api/v1/billing/topups',{method:'POST',body:JSON.stringify({walletId,amountCents})})).payment;}
export async function confirmBillingTopup(paymentId:string,transactionHash:string):Promise<BillingStateSnapshot>{return request<BillingStateSnapshot>(`/api/v1/billing/topups/${encodeURIComponent(paymentId)}/confirm`,{method:'POST',body:JSON.stringify({transactionHash})});}
export async function cancelBillingSubscription(id:string):Promise<void>{await request(`/api/v1/billing/subscriptions/${encodeURIComponent(id)}/cancel`,{method:'POST',body:'{}'});}
export async function fetchMarketplaceQuote(assetType:AssetType,assetId:string):Promise<MarketplaceQuote>{return (await request<{quote:MarketplaceQuote}>(`/api/v1/marketplace/${assetType}/${encodeURIComponent(assetId)}/quote`)).quote;}
export async function acquireMarketplaceAsset(assetType:AssetType,assetId:string):Promise<void>{await request(`/api/v1/marketplace/${assetType}/${encodeURIComponent(assetId)}/acquire`,{method:'POST',body:'{}'});}
export async function setCreatorPricing(assetType:AssetType,assetId:string,pricingModel:PricingModel,priceCents:number):Promise<void>{await request(`/api/v1/creator/${assetType}s/${encodeURIComponent(assetId)}/pricing`,{method:'PUT',body:JSON.stringify({pricingModel,priceCents})});}
export async function fetchCreatorRevenue():Promise<CreatorRevenueSnapshot>{return request<CreatorRevenueSnapshot>('/api/v1/creator/earnings');}
export async function fetchJobCosts(jobId:string):Promise<JobCostSnapshot>{return request<JobCostSnapshot>(`/api/v1/jobs/${encodeURIComponent(jobId)}/costs`);}
