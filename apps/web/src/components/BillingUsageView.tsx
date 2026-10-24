import { useEffect, useMemo, useState } from 'react';
import { useAppState, useDispatch } from '../state/AppContext';
import {
  cancelBillingSubscription,
  confirmBillingTopup,
  createBillingTopup,
  fetchBillingState,
  money,
  updateBillingSpendControls,
  type BillingStateSnapshot,
  type BillingUsageEvent,
} from '../platform/billingApi';
import { submitConnectedWalletRequest } from '../platform/executionApi';

function paidByLabel(value:string):string{
  return ({'service-balance':'Service balance','included-in-plan':'Included in plan','user-wallet':'User wallet','agent-account':'Agent Account','covered-by-agentplace':'Covered by AgentPlace','external-subscription':'External subscription'} as Record<string,string>)[value]??value;
}
function categoryLabel(value:string):string{
  return ({'agentplace-service':'AgentPlace runtime','external-worker':'External Worker','external-capability':'External capability/data','external-provider':'External provider','onchain-gas':'Onchain gas','bridge-fee':'Bridge fee','protocol-fee':'Protocol fee','subscription':'Subscription'} as Record<string,string>)[value]??value;
}

function TopUpModal({billing,onClose,onUpdated}:{billing:BillingStateSnapshot;onClose:()=>void;onUpdated:(next:BillingStateSnapshot)=>void}){
  const state=useAppState();
  const [amount,setAmount]=useState('10');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState<string|null>(null);
  const wallet=state.wallets.find((item)=>item.mode==='connected'&&item.namespace==='eip155'&&!item.disconnected);
  const amountCents=Math.round((Number.parseFloat(amount)||0)*100);
  async function pay(){
    if(!wallet)return setMessage('Connect an EVM wallet first. The payment must come from the exact Connected Wallet recorded in AgentPlace.');
    setBusy(true);setMessage(null);
    try{
      const intent=await createBillingTopup(wallet.id,amountCents);
      const submitted=await submitConnectedWalletRequest(intent.walletRequest);
      const next=await confirmBillingTopup(intent.paymentId,submitted.transactionHash);
      onUpdated(next);setMessage(`Confirmed. ${money(intent.amountCents)} was credited to AgentPlace service balance.`);
    }catch(error){setMessage(error instanceof Error?error.message:'The service-balance payment could not be completed.');}
    finally{setBusy(false);}
  }
  return <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-bg/80 backdrop-blur-sm px-4 py-4 sm:py-6">
    <div className="w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto my-auto bg-panel border border-border rounded-xl p-5 shadow-2xl">
      <div className="flex items-center justify-between mb-4"><div><h3 className="text-sm font-semibold text-text">Fund AgentPlace service balance</h3><p className="text-xs text-text-muted mt-1">Arbitrum Sepolia · USDC · explicit wallet payment</p></div><button onClick={onClose} className="text-text-muted hover:text-text">✕</button></div>
      {!billing.topUp.enabled&&<div className="border border-warn/30 bg-warn/5 rounded-lg px-3 py-2 mb-4"><p className="text-xs text-warn">Testnet service funding is disabled in this deployment. Billing remains ledger-backed; no fake top-up will be recorded.</p></div>}
      <div className="border border-border-dim rounded-lg px-3 py-2 mb-4"><p className="text-xs text-text-sub">Service balance pays AgentPlace/marketplace service costs. It is not your wallet balance and does not fund or authorize an Agent Account.</p></div>
      <label className="text-[10px] font-mono uppercase tracking-wider text-text-dim">Amount (USD / USDC)</label>
      <div className="flex gap-2 my-2">{['5','10','20','50'].map((value)=><button key={value} onClick={()=>setAmount(value)} className={`flex-1 py-1.5 text-xs rounded border ${amount===value?'border-primary text-primary':'border-border text-text-sub'}`}>${value}</button>)}</div>
      <input value={amount} onChange={(e)=>setAmount(e.target.value)} className="w-full bg-panel-raised border border-border rounded-lg px-3 py-2 text-sm text-text" inputMode="decimal" />
      <p className="text-[10px] text-text-dim mt-2">Wallet: {wallet?`${wallet.name} · ${wallet.address.slice(0,6)}…${wallet.address.slice(-4)}`:'No connected EVM wallet'}</p>
      {message&&<p className={`text-xs mt-3 ${message.startsWith('Confirmed')?'text-accent':'text-warn'}`}>{message}</p>}
      <div className="flex gap-2 mt-4"><button onClick={onClose} className="flex-1 py-2 border border-border text-text-sub text-sm rounded">Close</button><button disabled={!billing.topUp.enabled||busy||amountCents<100} onClick={()=>void pay()} className="flex-1 py-2 bg-primary disabled:opacity-40 text-white text-sm rounded font-medium">{busy?'Waiting for payment…':`Pay ${money(amountCents)}`}</button></div>
    </div>
  </div>;
}

function UsageRow({entry}:{entry:BillingUsageEvent}){
  const dispatch=useDispatch();
  return <div className="py-3 border-b border-border-dim last:border-0 flex items-start justify-between gap-3">
    <div className="min-w-0"><p className="text-xs text-text-sub">{entry.description}</p><p className="text-[10px] text-text-dim mt-1">{categoryLabel(entry.category)} · {paidByLabel(entry.paidBy)} · {new Date(entry.occurredAt).toLocaleDateString()}</p>{entry.jobId&&<button onClick={()=>dispatch({type:'SET_ACTIVE_JOB',id:entry.jobId!})} className="text-[10px] text-primary mt-1 hover:underline">Open Job →</button>}</div>
    <span className="text-xs font-mono text-text shrink-0">{money(entry.amountCents)}</span>
  </div>;
}

type Tab='overview'|'usage'|'subscriptions'|'controls'|'ledger';
export function BillingUsageView(){
  const app=useAppState();const dispatch=useDispatch();
  const [billing,setBilling]=useState<BillingStateSnapshot|null>(null);const [tab,setTab]=useState<Tab>('overview');const [loading,setLoading]=useState(false);const [error,setError]=useState<string|null>(null);const [showTopUp,setShowTopUp]=useState(false);const [editingControls,setEditingControls]=useState(false);const [monthly,setMonthly]=useState('');const [threshold,setThreshold]=useState('');
  async function refresh(){setLoading(true);setError(null);try{const next=await fetchBillingState();setBilling(next);setMonthly(String(next.account.monthlyVariableLimitCents/100));setThreshold(String(next.account.singleJobThresholdCents/100));}catch(e){setError(e instanceof Error?e.message:'Billing could not be loaded.');}finally{setLoading(false);}}
  useEffect(()=>{if(app.user)void refresh();},[app.user?.id]);
  const grouped=useMemo(()=>{const values=new Map<string,number>();for(const item of billing?.usage??[])values.set(categoryLabel(item.category),(values.get(categoryLabel(item.category))??0)+item.amountCents);return [...values.entries()].sort((a,b)=>b[1]-a[1]);},[billing]);
  if(!app.user)return <div className="h-full flex items-center justify-center bg-bg px-6"><div className="text-center max-w-sm"><h2 className="text-base font-semibold text-text mb-2">Billing & Usage</h2><p className="text-sm text-text-sub mb-5">Sign in to see durable service billing and usage.</p><button onClick={()=>dispatch({type:'SET_IDENTITY_CHECKPOINT',checkpoint:{reason:'billing',feature:'view billing and usage',onComplete:(user)=>dispatch({type:'SET_USER',user})}})} className="px-4 py-2 bg-primary text-white text-sm rounded">Sign in</button></div></div>;
  if(!billing)return <div className="h-full flex items-center justify-center bg-bg"><div className="text-center"><p className="text-sm text-text-muted">{loading?'Loading billing…':error??'Billing unavailable.'}</p>{!loading&&<button onClick={()=>void refresh()} className="mt-3 text-xs text-primary">Retry</button>}</div></div>;
  const {account}=billing;const limit=account.monthlyVariableLimitCents;const remaining=Math.max(0,limit-account.variableSpendThisMonthCents);const pct=limit===0?0:Math.min(100,(account.variableSpendThisMonthCents/limit)*100);
  async function saveControls(){const monthlyCents=Math.round((Number(monthly)||0)*100),singleCents=Math.round((Number(threshold)||0)*100);try{const next=await updateBillingSpendControls({monthlyVariableLimitCents:monthlyCents,singleJobThresholdCents:singleCents});setBilling((current)=>current?{...current,account:next}:current);setEditingControls(false);setError(null);}catch(e){setError(e instanceof Error?e.message:'Spend controls could not be saved.');}}
  async function cancel(id:string){try{await cancelBillingSubscription(id);await refresh();}catch(e){setError(e instanceof Error?e.message:'Subscription could not be cancelled.');}}
  const tabs:Array<{id:Tab;label:string}>=[{id:'overview',label:'Overview'},{id:'usage',label:'Usage'},{id:'subscriptions',label:'Subscriptions'},{id:'controls',label:'Usage controls'},{id:'ledger',label:'Ledger'}];
  return <div className="h-full min-h-0 flex flex-col bg-bg overflow-hidden">
    <div className="px-6 pt-8 pb-0 shrink-0 border-b border-border"><div className="flex items-center justify-between mb-5"><div><h1 className="text-2xl font-semibold text-text">Billing & Usage</h1><p className="text-sm text-text-sub mt-0.5">Durable service accounting, marketplace access and spend controls.</p></div><span className="text-[10px] font-mono text-accent border border-accent/30 rounded px-2 py-0.5">Ledger-backed</span></div><div className="flex gap-0 overflow-x-auto">{tabs.map((item)=><button key={item.id} onClick={()=>setTab(item.id)} className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px shrink-0 ${tab===item.id?'border-primary text-text':'border-transparent text-text-sub'}`}>{item.label}</button>)}</div></div>
    <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6"><div className="max-w-2xl space-y-5">{error&&<div className="border border-danger/30 bg-danger/5 rounded-lg px-4 py-3 text-xs text-danger">{error}</div>}
      {tab==='overview'&&<>
        <div className="border border-border-dim rounded-lg bg-panel-raised px-4 py-3"><p className="text-xs text-text-muted">AgentPlace service balance is separate from your wallet and Agent Account capital. Buying marketplace access never creates wallet authority.</p></div>
        <div className="grid sm:grid-cols-2 gap-3"><div className="border border-border rounded-lg bg-panel px-5 py-4"><p className="text-[10px] font-mono uppercase text-text-dim">Current plan</p><p className="text-xl font-semibold text-text mt-1">{account.planName}</p><p className="text-xs text-text-muted mt-1">Billing period ends {new Date(account.billingPeriodEnd).toLocaleDateString()}</p></div><div className="border border-border rounded-lg bg-panel px-5 py-4"><p className="text-[10px] font-mono uppercase text-text-dim">Service balance</p><p className="text-2xl font-semibold text-text mt-1">{money(account.serviceBalanceCents)}</p><button onClick={()=>setShowTopUp(true)} className="mt-3 px-3 py-1.5 bg-primary text-white text-xs rounded">Fund with testnet USDC</button></div></div>
        <div className="border border-border rounded-lg bg-panel px-5 py-4"><div className="flex justify-between"><div><p className="text-[10px] font-mono uppercase text-text-dim">Variable service spend this month</p><p className="text-xl font-semibold text-text mt-1">{money(account.variableSpendThisMonthCents)}</p></div><div className="text-right"><p className="text-[10px] text-text-dim">Limit</p><p className="text-sm text-text-sub">{money(limit)}</p></div></div><div className="h-1.5 bg-panel-raised rounded-full overflow-hidden mt-3"><div className="h-full bg-primary" style={{width:`${pct}%`}} /></div><p className="text-xs text-text-muted mt-2">{money(remaining)} remaining · service spend only, not capital authority.</p></div>
        <div className="border border-border rounded-lg bg-panel px-5 py-4"><p className="text-[10px] font-mono uppercase text-text-dim mb-3">Attributed usage</p>{grouped.length===0?<p className="text-xs text-text-muted">No metered usage yet.</p>:grouped.map(([label,value])=><div key={label} className="flex justify-between text-xs py-1"><span className="text-text-sub">{label}</span><span className="font-mono text-text">{money(value)}</span></div>)}</div>
      </>}
      {tab==='usage'&&<div className="border border-border rounded-lg bg-panel px-4">{billing.usage.length===0?<p className="text-sm text-text-muted py-8 text-center">No durable usage events yet.</p>:billing.usage.map((entry)=><UsageRow key={entry.id} entry={entry}/>)}</div>}
      {tab==='subscriptions'&&<>{billing.subscriptions.length===0?<p className="text-sm text-text-muted py-8 text-center">No marketplace subscriptions.</p>:billing.subscriptions.map((sub)=><div key={sub.id} className="border border-border rounded-lg bg-panel px-5 py-4"><div className="flex justify-between gap-3"><div><p className="text-sm font-medium text-text">{sub.name}</p><p className="text-xs text-text-muted mt-1">{sub.creatorName} · {money(sub.priceCents)}/month</p><p className="text-[10px] text-text-dim mt-1">{sub.status}{sub.status==='past-due'?' · renewal needs service balance':''} · period ends {new Date(sub.currentPeriodEnd).toLocaleDateString()}</p></div>{(sub.status==='active'||sub.status==='past-due')&&<button onClick={()=>void cancel(sub.id)} className="text-xs border border-border text-text-sub rounded px-3 py-1.5 h-fit">Cancel renewal</button>}</div></div>)}<div className="border border-border-dim rounded-lg bg-panel-raised px-4 py-3"><p className="text-xs text-text-muted">Subscriptions are marketplace access. Cancellation never revokes or grants wallet authority.</p></div></>}
      {tab==='controls'&&<div className="border border-border rounded-lg bg-panel px-5 py-4 space-y-4"><div><p className="text-[10px] font-mono uppercase text-text-dim">Monthly variable-service limit</p>{editingControls?<input value={monthly} onChange={(e)=>setMonthly(e.target.value)} className="mt-2 w-full bg-panel-raised border border-border rounded px-3 py-2 text-sm text-text"/>:<p className="text-xl font-semibold text-text mt-1">{money(account.monthlyVariableLimitCents)}</p>}</div><div><p className="text-[10px] font-mono uppercase text-text-dim">Single-Job service-cost confirmation threshold</p>{editingControls?<input value={threshold} onChange={(e)=>setThreshold(e.target.value)} className="mt-2 w-full bg-panel-raised border border-border rounded px-3 py-2 text-sm text-text"/>:<p className="text-xl font-semibold text-text mt-1">{money(account.singleJobThresholdCents)}</p>}</div><p className="text-xs text-text-muted">These are service-spend controls only. The single-Job threshold applies when AgentPlace has an actual billable per-Job service charge to review; it does not invent charges for isolated capabilities. These controls cannot create, widen or revoke crypto capital authority.</p><div className="flex gap-2">{editingControls?<><button onClick={()=>void saveControls()} className="px-3 py-1.5 bg-primary text-white text-xs rounded">Save</button><button onClick={()=>setEditingControls(false)} className="px-3 py-1.5 border border-border text-text-sub text-xs rounded">Cancel</button></>:<button onClick={()=>setEditingControls(true)} className="px-3 py-1.5 border border-primary/30 text-primary text-xs rounded">Edit controls</button>}</div></div>}
      {tab==='ledger'&&<div className="border border-border rounded-lg bg-panel px-4">{billing.ledger.length===0?<p className="text-sm text-text-muted py-8 text-center">No service-ledger entries yet.</p>:billing.ledger.map((entry)=><div key={entry.id} className="py-3 border-b border-border-dim last:border-0 flex justify-between gap-3"><div><p className="text-xs text-text-sub">{entry.description}</p><p className="text-[10px] text-text-dim mt-1">{entry.category} · {paidByLabel(entry.paidBy)} · {new Date(entry.occurredAt).toLocaleString()}</p></div><span className={`text-xs font-mono ${entry.direction==='credit'?'text-accent':'text-text'}`}>{entry.direction==='credit'?'+':'−'}{money(entry.amountCents)}</span></div>)}</div>}
    </div></div>
    {showTopUp&&<TopUpModal billing={billing} onClose={()=>setShowTopUp(false)} onUpdated={(next)=>{setBilling(next);setShowTopUp(false);}}/>}
  </div>;
}
