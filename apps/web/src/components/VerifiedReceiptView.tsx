import { useAppState, useDispatch } from '../state/AppContext';

export function VerifiedReceiptView() {
  const state = useAppState();
  const dispatch = useDispatch();
  const receipt = (state.verifiedReceipts ?? []).find((r) => r.id === state.activeReceiptId);
  const job = receipt ? (state.jobs ?? []).find((j) => j.id === receipt.jobId) : null;

  function close() {
    dispatch({ type: 'SET_ACTIVE_RECEIPT', id: null });
  }

  if (!receipt) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-bg/90 backdrop-blur-sm px-4 py-8 overflow-y-auto">
      <div className="w-full max-w-lg bg-panel border border-border rounded-xl shadow-2xl">
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-1">Verified Receipt</p>
              <h2 className="text-sm font-semibold text-text">{receipt.userGoal}</h2>
              <p className="text-xs text-text-muted font-mono mt-0.5">
                {receipt.environment === 'mainnet' ? 'Mainnet' : 'Testnet'} · {new Date(receipt.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono border border-accent/30 rounded px-1.5 py-0.5 text-accent">AgentPlace Verified</span>
              <button onClick={close} className="text-text-muted hover:text-text p-1 rounded transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="px-5 py-5 space-y-5">
          <div className="border border-accent/20 rounded-lg bg-accent-dim/5 px-4 py-4">
            <p className="text-[10px] font-mono uppercase tracking-wider text-accent mb-1">Actual outcome</p>
            <p className="text-base font-semibold text-text">{receipt.actualEconomicOutcome}</p>
          </div>

          <section>
            <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-2">Worker</p>
            <p className="text-sm text-text-sub">{receipt.workerName}</p>
          </section>

          <section>
            <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-2">Authorized action</p>
            <div className="space-y-1 text-xs">
              {receipt.authorizedActionSummary.split('|').map((part, i) => {
                const [k, v] = part.split(':').map((s) => s.trim());
                return (
                  <div key={i} className="flex justify-between">
                    <span className="text-text-muted">{k}</span>
                    <span className="text-text-sub">{v}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-2">Cost</p>
            <div className="space-y-1 text-xs">
              {receipt.costs.map((cost, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-text-muted">{cost.label}</span>
                  <span className={`${cost.label === 'AgentPlace service' ? 'text-text-dim' : 'text-text-sub font-mono'}`}>{cost.amount}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-2">Transactions</p>
            <div className="space-y-2">
              {receipt.transactionReferences.map((ref, i) => (
                <div key={i} className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-text-sub">{ref.label}</p>
                    {ref.hash && (
                      <p className="text-[10px] font-mono text-text-dim mt-0.5 truncate max-w-xs">{ref.hash.slice(0, 20)}…</p>
                    )}
                  </div>
                  <span className={`text-[10px] font-mono shrink-0 ${ref.status === 'confirmed' || ref.status === 'observed' ? 'text-accent' : 'text-text-muted'}`}>
                    {ref.status}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-2">Verification</p>
            <p className="text-xs text-text-sub mb-2">{receipt.verificationMethod}</p>
            <div className="border border-border rounded px-3 py-2.5 space-y-1 text-xs">
              {receipt.verificationEvidence.split('·').map((part, i) => (
                <p key={i} className="text-text-muted">{part.trim()}</p>
              ))}
            </div>
          </section>

          <section>
            <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-2">Proof</p>
            <div className="flex items-center justify-between">
              <p className="text-xs text-text-sub">Receipt proof anchor</p>
              <span className={`text-[10px] font-mono border rounded px-1.5 py-0.5 ${
                receipt.proofAnchorStatus === 'anchored'
                  ? 'text-accent border-accent/30'
                  : 'text-text-dim border-border'
              }`}>
                {receipt.proofAnchorStatus === 'anchored' ? 'Arbitrum Anchored' : 'Arbitrum proof anchor pending'}
              </span>
            </div>
            {receipt.proofAnchorNote && (
              <p className="text-[10px] text-text-dim mt-1.5 leading-relaxed">{receipt.proofAnchorNote}</p>
            )}
          </section>

          {job && (
            <button
              onClick={() => {
                close();
                dispatch({ type: 'SET_ACTIVE_JOB', id: job.id });
              }}
              className="w-full py-2.5 border border-border rounded text-sm text-text-sub hover:bg-panel hover:text-text transition-colors"
            >
              Open job
            </button>
          )}

          <p className="text-[10px] text-text-dim text-center">Prototype · illustrative values</p>
        </div>
      </div>
    </div>
  );
}
