import { useState } from 'react';
import { useAppState, useDispatch } from '../state/AppContext';
import { WEB_RUNTIME_SETTINGS } from '../platform/runtime';

export function VerifiedReceiptView() {
  const state = useAppState();
  const dispatch = useDispatch();
  const [showTechnical, setShowTechnical] = useState(false);
  const receipt = (state.verifiedReceipts ?? []).find((r) => r.id === state.activeReceiptId);
  const job = receipt?.jobId ? (state.jobs ?? []).find((j) => j.id === receipt.jobId) : null;

  function close() { dispatch({ type: 'SET_ACTIVE_RECEIPT', id: null }); }
  if (!receipt) return null;

  const proofLabel = receipt.proofAnchorStatus === 'anchored'
    ? 'Arbitrum Anchored'
    : receipt.proofAnchorStatus === 'failed'
      ? 'Arbitrum proof anchor delayed'
      : 'Arbitrum proof anchor pending';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-bg/90 backdrop-blur-sm px-4 py-6 sm:py-8 overflow-y-auto">
      <div className="w-full max-w-lg bg-panel border border-border rounded-xl shadow-2xl">
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-1">Verified Receipt</p>
              <h2 className="text-sm font-semibold text-text break-words">{receipt.userGoal}</h2>
              <p className="text-xs text-text-muted font-mono mt-0.5">
                {receipt.environment === 'mainnet' ? 'Mainnet · Real funds' : 'Testnet · Test funds'} · {new Date(receipt.createdAt).toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] sm:text-xs font-mono border border-accent/30 rounded px-1.5 py-0.5 text-accent">AgentPlace Verified</span>
              <button aria-label="Close receipt" onClick={close} className="text-text-muted hover:text-text p-1 rounded transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
        </div>

        <div className="px-5 py-5 space-y-5">
          <div className="border border-accent/20 rounded-lg bg-accent-dim/5 px-4 py-4">
            <p className="text-[10px] font-mono uppercase tracking-wider text-accent mb-1">Actual outcome</p>
            <p className="text-base font-semibold text-text break-words">{receipt.actualEconomicOutcome}</p>
          </div>

          <section>
            <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-2">Worker</p>
            <p className="text-sm text-text-sub">{receipt.workerName}</p>
            {receipt.workerAttribution === 'execution-path-default' && <p className="text-[10px] text-text-dim mt-1">Execution-path attribution · no historical Worker ID was manufactured.</p>}
          </section>

          <section>
            <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-2">Authorized action</p>
            <div className="space-y-1 text-xs">
              {receipt.authorizedActionSummary.split('|').map((part, i) => {
                const separator = part.indexOf(':');
                const k = separator >= 0 ? part.slice(0, separator).trim() : part.trim();
                const v = separator >= 0 ? part.slice(separator + 1).trim() : '';
                return <div key={i} className="flex flex-col sm:flex-row sm:justify-between gap-0.5 sm:gap-3"><span className="text-text-muted shrink-0">{k}</span><span className="text-text-sub font-mono text-left sm:text-right break-all">{v}</span></div>;
              })}
            </div>
          </section>

          <section>
            <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-2">Costs</p>
            <div className="space-y-2 text-xs">
              {receipt.costs.map((cost, i) => <div key={i} className="border-b border-border-dim/60 last:border-0 pb-2 last:pb-0">
                <div className="flex justify-between gap-3"><span className="text-text-muted">{cost.label}</span><span className="text-text-sub font-mono text-right">{cost.amount}</span></div>
                {cost.note && <p className="text-[10px] text-text-dim mt-0.5 leading-relaxed">{cost.note}</p>}
              </div>)}
            </div>
          </section>

          <section>
            <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-2">Transaction evidence</p>
            <div className="space-y-2">
              {receipt.transactionReferences.map((ref, i) => <div key={i} className="border border-border rounded px-3 py-2.5">
                <div className="flex items-start justify-between gap-3"><p className="text-xs text-text-sub">{ref.label}</p><span className="text-[10px] font-mono text-accent shrink-0">{ref.status}</span></div>
                <p className="text-[10px] font-mono text-text-dim mt-1 break-all">{ref.hash}</p>
                {ref.blockNumber && <p className="text-[10px] text-text-dim mt-1">Block {ref.blockNumber}</p>}
              </div>)}
            </div>
          </section>

          <section>
            <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-2">Independent verification</p>
            <p className="text-xs text-text-sub mb-2">{receipt.verificationMethod}</p>
            {receipt.verificationChecks?.length ? <div className="border border-border rounded px-3 py-2.5 space-y-2">
              {receipt.verificationChecks.map((item) => <div key={item.code} className="flex items-start gap-2"><span className={`text-[10px] font-mono mt-0.5 ${item.status === 'PASS' ? 'text-accent' : 'text-danger'}`}>{item.status}</span><div><p className="text-xs text-text-sub">{item.label}</p><p className="text-[10px] text-text-dim leading-relaxed">{item.message}</p></div></div>)}
            </div> : <div className="border border-border rounded px-3 py-2.5 text-xs text-text-muted">{receipt.verificationEvidence}</div>}
          </section>

          <section>
            <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-2">Proof</p>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <p className="text-xs text-text-sub">Receipt commitment</p>
              <span className={`text-[10px] font-mono border rounded px-1.5 py-0.5 w-fit ${receipt.proofAnchorStatus === 'anchored' ? 'text-accent border-accent/30' : receipt.proofAnchorStatus === 'failed' ? 'text-warn border-warn/30' : 'text-text-dim border-border'}`}>{proofLabel}</span>
            </div>
            {receipt.proofAnchorNote && <p className="text-[10px] text-text-dim mt-1.5 leading-relaxed">{receipt.proofAnchorNote}</p>}
          </section>

          <section>
            <button onClick={() => setShowTechnical((value) => !value)} className="text-[10px] font-mono uppercase tracking-wider text-text-dim hover:text-text-muted">{showTechnical ? 'Hide' : 'Show'} technical proof detail</button>
            {showTechnical && <div className="mt-2 border border-border rounded px-3 py-2.5 space-y-2 text-[10px] font-mono text-text-dim">
              {receipt.network && <p>Network: {receipt.network.family}:{receipt.network.networkId} · chain {receipt.network.chainId}</p>}
              {receipt.receiptCommitment && <p className="break-all">Receipt commitment: {receipt.receiptCommitment}</p>}
              {receipt.evidenceRoot && <p className="break-all">Evidence root: {receipt.evidenceRoot}</p>}
              {receipt.receiptSalt && <p className="break-all">Receipt salt: {receipt.receiptSalt}</p>}
              {receipt.proofAnchorTransactionHash && <p className="break-all">Anchor transaction: {receipt.proofAnchorTransactionHash}</p>}
            </div>}
          </section>

          {job && <button onClick={() => { close(); dispatch({ type: 'SET_ACTIVE_JOB', id: job.id }); }} className="w-full py-2.5 border border-border rounded text-sm text-text-sub hover:bg-panel hover:text-text transition-colors">Open job</button>}

          <p className="text-[10px] text-text-dim text-center">{WEB_RUNTIME_SETTINGS.dataMode === 'api' ? 'Production verification evidence · proof anchoring is asynchronous' : 'Prototype · illustrative values'}</p>
        </div>
      </div>
    </div>
  );
}
