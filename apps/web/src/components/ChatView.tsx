import { useState, useEffect, useRef } from 'react';
import {
  useAppState,
  useDispatch,
  makeMemeScoutWorker,
  runGenericManagerResponse,
  runStablecoinRecommendationsOnly,
  runStablecoinApproveEachMove,
  runStablecoinManageWithRules,
  activateStablecoinMandate,
  createAgentFundingAction,
  uid,
} from '../state/AppContext';
import { PERPS_ACTION_ID } from './ActionReview';
import type { ChatMessage } from '../state/types';

function RenderContent({ text }: { text: string }) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let key = 0;
  for (const line of lines) {
    if (!line.trim()) {
      elements.push(<div key={key++} className="h-2" />);
    } else if (line.startsWith('## ')) {
      elements.push(
        <h4 key={key++} className="text-text font-semibold text-sm mt-3 mb-1 first:mt-0">
          {line.slice(3)}
        </h4>
      );
    } else {
      elements.push(
        <p key={key++} className="text-sm leading-relaxed">
          <InlineMd text={line} />
        </p>
      );
    }
  }
  return <div className="space-y-0.5">{elements}</div>;
}

function InlineMd({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <strong key={i} className="font-semibold text-text">{part.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

function StreamingDots() {
  return (
    <span className="inline-flex gap-1 items-center h-4">
      <span className="w-1 h-1 rounded-full bg-text-muted animate-pulse" style={{ animationDelay: '0ms' }} />
      <span className="w-1 h-1 rounded-full bg-text-muted animate-pulse" style={{ animationDelay: '150ms' }} />
      <span className="w-1 h-1 rounded-full bg-text-muted animate-pulse" style={{ animationDelay: '300ms' }} />
    </span>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-xl bg-panel-raised border border-border rounded-lg px-4 py-3">
          <p className="text-sm text-text leading-relaxed">{msg.content}</p>
        </div>
      </div>
    );
  }

  if (msg.role === 'specialist' && msg.specialist) {
    return (
      <div className="flex gap-3">
        <div className="shrink-0 mt-0.5">
          <div className="w-6 h-6 rounded border border-border bg-panel-raised flex items-center justify-center">
            <span className="text-[9px] font-mono font-medium text-text-sub">
              {msg.specialist.name.slice(0, 2).toUpperCase()}
            </span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-medium text-text-sub">{msg.specialist.name}</span>
            <span className="text-xs text-text-dim">{msg.specialist.role}</span>
          </div>
          <div className="text-text-sub">
            {msg.isStreaming ? <StreamingDots /> : <RenderContent text={msg.content} />}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <div className="shrink-0 mt-0.5">
        <div className="w-6 h-6 rounded bg-primary-dim flex items-center justify-center">
          <span className="text-[9px] font-bold text-primary">AP</span>
        </div>
      </div>
      <div className="flex-1 min-w-0 text-text">
        {msg.isStreaming ? <StreamingDots /> : <RenderContent text={msg.content} />}
      </div>
    </div>
  );
}

function WatchAddressFormCard({ convId }: { convId: string }) {
  const dispatch = useDispatch();
  const state = useAppState();
  const [address, setAddress] = useState('');
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);

  function submit() {
    if (!address.trim()) return;
    const walletId = uid();
    dispatch({
      type: 'ADD_WALLET',
      wallet: {
        id: walletId,
        name: name.trim() || 'Watched Address',
        mode: 'watch-only',
        address: address.trim(),
        networks: ['ethereum', 'base', 'arbitrum'],
        balances: [],
        connectedWorkerIds: [],
        createdAt: new Date(),
      },
    });
    dispatch({
      type: 'ADD_ACTIVITY_EVENT',
      event: {
        id: uid(),
        eventType: 'wallet',
        title: `${name.trim() || 'Watched Address'} added`,
        summary: 'Watch-only wallet connected',
        walletId,
        timestamp: new Date(),
        status: 'complete',
      },
    });
    setSubmitted(true);
    setTimeout(() => {
      dispatch({ type: 'SET_VIEW', view: 'wallets' });
      dispatch({ type: 'SET_ACTIVE_WALLET', id: walletId });
    }, 1200);
  }

  if (submitted) {
    return (
      <div className="flex justify-center pt-2">
        <div className="border border-accent/20 rounded-lg px-5 py-4 bg-accent-dim/10 max-w-md w-full">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm font-medium text-text">Address added — opening Wallets…</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center pt-2">
      <div className="border border-border rounded-lg px-5 py-4 bg-panel max-w-md w-full">
        <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">
          Watch an address
        </p>
        <div className="space-y-2.5">
          <div>
            <label className="text-xs text-text-sub block mb-1">EVM address or ENS</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="0x… or vitalik.eth"
              className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-text placeholder-text-muted outline-none focus:border-primary/50 transition-colors font-mono"
            />
          </div>
          <div>
            <label className="text-xs text-text-sub block mb-1">Label (optional)</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Smart Money Whale"
              className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-text placeholder-text-muted outline-none focus:border-primary/50 transition-colors"
            />
          </div>
          <button
            onClick={submit}
            disabled={!address.trim()}
            className={`w-full px-4 py-2.5 text-sm rounded font-medium transition-colors ${
              address.trim()
                ? 'bg-primary text-white hover:bg-primary-hover'
                : 'bg-panel-raised text-text-dim cursor-not-allowed'
            }`}
          >
            Watch this address
          </button>
        </div>
      </div>
    </div>
  );
}

function FundAgentAccountCard({ convId }: { convId: string }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const account = (state.agentAccounts ?? [])[0];

  if (!account) return null;

  return (
    <div className="flex justify-center pt-2">
      <div className="border border-border rounded-lg px-5 py-4 bg-panel max-w-md w-full">
        <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Fund Agent Account</p>
        <div className="space-y-1.5 text-xs mb-4">
          <div className="flex justify-between">
            <span className="text-text-sub">Account</span>
            <span className="text-text">{account.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-sub">Current balance</span>
            <span className="text-text font-mono">{account.totalBalance}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-sub">Worker authority</span>
            <span className="text-warn">None</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-sub">Proposed amount</span>
            <span className="text-text font-mono">2,000 USDC</span>
          </div>
        </div>
        <p className="text-[10px] text-text-dim mb-3 leading-relaxed">
          No Worker has authority over these funds. You must explicitly activate a mandate after funding.
        </p>
        <button
          onClick={() => createAgentFundingAction(dispatch, account.id, account.name, state.environment)}
          className="w-full px-4 py-2.5 bg-primary text-white text-sm rounded font-medium hover:bg-primary-hover transition-colors"
        >
          Add 2,000 USDC
        </button>
      </div>
    </div>
  );
}

function MandateReviewCard({ convId }: { convId: string }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const [activating, setActivating] = useState(false);
  const [activated, setActivated] = useState(false);

  // Read the DRAFT grant + mandate
  const draftGrant = (state.authorityGrants ?? []).find(
    (g) => g.workerId === 'w-stablecoin' && g.status === 'draft'
  );
  const draftMandate = draftGrant
    ? (state.mandates ?? []).find((m) => m.id === draftGrant.mandateId)
    : null;

  // Also accept already-active (e.g. RESET_ACTIVE state)
  const activeGrant = (state.authorityGrants ?? []).find(
    (g) => g.workerId === 'w-stablecoin' && g.status === 'active'
  );
  const grant = draftGrant ?? activeGrant;
  const mandate = draftMandate ?? (activeGrant ? (state.mandates ?? []).find((m) => m.id === activeGrant.mandateId) : null);

  if (!grant || !mandate) return null;

  const isDraft = grant.status === 'draft';

  function handleActivate() {
    if (!grant || !mandate) return;
    setActivating(true);
    setTimeout(() => {
      activateStablecoinMandate(dispatch, mandate.id, grant.id, convId);
      setActivated(true);
      setActivating(false);
    }, 600);
  }

  if (activated) {
    return (
      <div className="flex justify-center pt-2">
        <div className="border border-accent/30 rounded-lg px-5 py-4 bg-accent-dim/10 max-w-md w-full">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm font-medium text-text">Mandate activated.</span>
          </div>
          <p className="text-xs text-text-sub mt-2">Stablecoin Manager can now act within these rules.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center pt-2">
      <div className="border border-border rounded-lg px-5 py-5 bg-panel max-w-md w-full">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim">
            Stablecoin Manager Mandate
          </p>
          {isDraft && (
            <span className="text-[10px] font-mono border border-warn/40 text-warn rounded px-1.5 py-0.5">Draft</span>
          )}
        </div>

        <p className="text-xs text-text-sub mb-4 leading-relaxed">{mandate.goal}</p>

        <div className="space-y-3 text-xs mb-4">
          {/* Capital */}
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-1.5">Capital</p>
            <div className="space-y-1">
              <div className="flex justify-between"><span className="text-text-muted">Manage up to</span><span className="text-text font-mono">{grant.totalManagedCapital}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Keep liquid</span><span className="text-text font-mono">{mandate.reserveCapital.replace('At least ', '')}</span></div>
            </div>
          </div>

          {/* Risk + Networks + Protocols */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            <div><span className="text-text-muted block mb-0.5">Risk posture</span><span className="text-text">{mandate.riskPosture}</span></div>
            <div><span className="text-text-muted block mb-0.5">Autonomous limit</span><span className="text-text font-mono">{grant.singleActionLimit}</span></div>
            <div><span className="text-text-muted block mb-0.5">Networks</span><span className="text-text">{grant.networks.join(' · ')}</span></div>
            <div><span className="text-text-muted block mb-0.5">Protocols</span><span className="text-text">{grant.allowedProtocols.join(' · ')}</span></div>
          </div>

          {/* Permitted actions */}
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-1.5">Permitted actions</p>
            <div className="flex flex-wrap gap-1">
              {grant.allowedActions.map((a) => (
                <span key={a} className="text-[10px] border border-border rounded px-1.5 py-0.5 text-text-sub">{a}</span>
              ))}
            </div>
          </div>

          {/* Restrictions */}
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-1.5">Restrictions</p>
            <div className="space-y-0.5">
              {mandate.restrictions.map((r) => (
                <div key={r} className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-danger/60 shrink-0" />
                  <span className="text-text-muted">{r}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Expiry */}
          <div className="flex justify-between">
            <span className="text-text-muted">Expires</span>
            <span className="text-text">{mandate.expiry.toLocaleDateString()}</span>
          </div>
        </div>

        <p className="text-[10px] text-text-dim mb-4 leading-relaxed border-t border-border-dim pt-3">
          <strong className="text-text-muted">Mandate</strong> defines what Stablecoin Manager is asked to do.{' '}
          <strong className="text-text-muted">Authority</strong> defines what AgentPlace will actually allow it to execute. Until you activate, Stablecoin Manager has no financial authority.
        </p>

        {isDraft ? (
          <div className="space-y-2">
            <p className="text-[10px] text-text-dim text-center">
              Stablecoin Manager will act only within these rules. You can pause or revoke later.
            </p>
            <button
              onClick={handleActivate}
              disabled={activating}
              className="w-full px-4 py-2.5 bg-accent text-white text-sm rounded font-medium hover:bg-accent/90 transition-colors disabled:opacity-60"
            >
              {activating ? 'Activating…' : 'Activate mandate'}
            </button>
            <button
              onClick={() => dispatch({ type: 'SET_VIEW', view: 'security' })}
              className="w-full px-3 py-2 border border-border rounded text-xs text-text-muted hover:text-text hover:bg-panel-raised transition-colors"
            >
              Edit rules
            </button>
          </div>
        ) : (
          <button
            onClick={() => dispatch({ type: 'SET_VIEW', view: 'security' })}
            className="w-full px-4 py-2 border border-border rounded text-sm text-text-sub hover:text-text hover:bg-panel-raised transition-colors"
          >
            Review full authority →
          </button>
        )}
      </div>
    </div>
  );
}

function BridgeQuoteCard({ jobId, convId }: { jobId?: string; convId: string }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const job = jobId ? (state.jobs ?? []).find((j) => j.id === jobId) : null;
  const action = job?.actionId ? (state.financialActions ?? []).find((a) => a.id === job.actionId) : null;
  const quote = action?.quote;

  if (!quote) return null;

  const isExpired = state.scenario === 'quote-expired';

  return (
    <div className="flex justify-center pt-2">
      <div className="border border-border rounded-lg px-5 py-4 bg-panel max-w-md w-full">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim">Bridge 500 USDC</p>
          <span className="text-[10px] text-text-dim font-mono">Prototype · illustrative quote</span>
        </div>
        <p className="text-xs text-text-sub mb-3">Arbitrum → Base</p>

        {isExpired && (
          <div className="mb-3 border border-warn/30 rounded bg-warn/5 px-3 py-2">
            <p className="text-xs text-warn font-medium">Quote expired — refresh required</p>
          </div>
        )}

        <div className="space-y-1.5 text-xs mb-4">
          {([
            ['Source account', 'Main Wallet'],
            ['Amount', '500 USDC'],
            ['Estimated received', quote.estimatedReceive],
            ['Minimum received', quote.minimumReceive],
            ['Estimated total route cost', quote.estimatedTotalCost],
            ['Estimated arrival', quote.estimatedDuration],
            ['Environment', 'Mainnet'],
          ] as [string, string][]).map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span className="text-text-muted">{k}</span>
              <span className="text-text-sub font-mono">{v}</span>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <button
            onClick={() => action && dispatch({ type: 'SET_ACTIVE_ACTION', id: action.id })}
            className="w-full py-2.5 text-sm font-medium bg-primary text-white rounded hover:bg-primary-hover transition-colors"
          >
            Review action
          </button>
          {job && (
            <button
              onClick={() => dispatch({ type: 'SET_ACTIVE_JOB', id: job.id })}
              className="w-full py-2 text-sm border border-border rounded text-text-sub hover:bg-panel hover:text-text transition-colors"
            >
              Open job
            </button>
          )}
        </div>

        <p className="text-[10px] text-text-dim mt-3">
          Provider: {quote.provider ?? 'Across · prototype route'}
        </p>
      </div>
    </div>
  );
}

function BridgeCompletionCard({ jobId, convId }: { jobId?: string; convId: string }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const job = jobId ? (state.jobs ?? []).find((j) => j.id === jobId) : null;
  const receipt = job?.receiptId ? (state.verifiedReceipts ?? []).find((r) => r.id === job.receiptId) : null;

  return (
    <div className="flex justify-center pt-2">
      <div className="border border-accent/30 rounded-lg px-5 py-4 bg-accent-dim/10 max-w-md w-full">
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-4 h-4 text-accent shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-sm font-semibold text-accent">Completed · AgentPlace Verified</span>
        </div>
        <p className="text-xs text-text-sub mb-4">498.92 USDC independently verified in Main Wallet on Base.</p>
        <div className="flex gap-2">
          {job && (
            <button
              onClick={() => dispatch({ type: 'SET_ACTIVE_JOB', id: job.id })}
              className="flex-1 py-2 text-xs border border-border rounded text-text-sub hover:bg-panel hover:text-text transition-colors"
            >
              Open job
            </button>
          )}
          {receipt && (
            <button
              onClick={() => dispatch({ type: 'SET_ACTIVE_RECEIPT', id: receipt.id })}
              className="flex-1 py-2 text-xs border border-accent/30 rounded text-accent hover:bg-accent-dim/10 transition-colors"
            >
              View receipt
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ChatView() {
  const state = useAppState();
  const dispatch = useDispatch();
  const [input, setInput] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleVal, setTitleVal] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const conv = state.conversations.find((c) => c.id === state.activeConversationId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conv?.messages.length, conv?.messages.at(-1)?.isStreaming]);

  if (!conv) {
    return (
      <div className="h-full flex items-center justify-center text-text-muted text-sm">
        Conversation not found
      </div>
    );
  }

  function startEditTitle() {
    setTitleVal(conv!.title);
    setEditingTitle(true);
  }

  function commitTitle() {
    if (titleVal.trim()) {
      dispatch({ type: 'RENAME_CONV', convId: conv!.id, title: titleVal.trim() });
    }
    setEditingTitle(false);
  }

  function sendMessage() {
    if (!input.trim()) return;
    const msg: ChatMessage = {
      id: uid(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };
    dispatch({ type: 'ADD_MSG', convId: conv!.id, msg });
    runGenericManagerResponse(dispatch, conv!.id, input.trim());
    setInput('');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const hasMemeScout = state.workers.some((w) => w.id === 'w-memescout');
  const hasSpecialistOutput = conv.messages.some(
    (m) => m.role === 'specialist' && m.specialist?.name === 'Meme Scout' && !m.isStreaming
  );
  const showAddMemeScout = !hasMemeScout && hasSpecialistOutput;
  const showMemeScoutConfirmation = hasMemeScout && hasSpecialistOutput;

  function addMemeScout() {
    const convId = conv!.id;
    const doAdd = (userId?: string) => {
      dispatch({ type: 'ADD_WORKER', worker: makeMemeScoutWorker() });
      dispatch({
        type: 'ADD_ACTIVITY_EVENT',
        event: {
          id: uid(),
          eventType: 'worker-added',
          title: 'Meme Scout added to your workforce',
          summary: 'Operational change',
          workerId: 'w-memescout',
          workerName: 'Meme Scout',
          timestamp: new Date(),
          status: 'operational',
        },
      });
    };

    if (!state.user) {
      dispatch({
        type: 'SET_IDENTITY_CHECKPOINT',
        checkpoint: {
          reason: 'add-worker',
          feature: 'add Meme Scout and keep it working for you',
          onComplete: (user) => {
            dispatch({ type: 'SET_USER', user });
            doAdd(user.id);
          },
        },
      });
    } else {
      doAdd();
    }
  }

  const isStreaming = conv.messages.some((m) => m.isStreaming);

  // ── uiCard detection ─────────────────────────────────────────────────────

  // stablecoin-mode-select card
  const stablecoinCardMsg = [...conv.messages].reverse().find((m) => m.uiCard === 'stablecoin-mode-select');
  const showStablecoinModeSelect =
    !!stablecoinCardMsg &&
    !isStreaming &&
    !conv.messages.some((m) => m.role === 'user' && m.timestamp > stablecoinCardMsg.timestamp);

  // watch-address-form card
  const watchFormMsg = [...conv.messages].reverse().find((m) => m.uiCard === 'watch-address-form');
  const showWatchAddressForm =
    !!watchFormMsg &&
    !isStreaming &&
    !conv.messages.some((m) => m.role === 'user' && m.timestamp > watchFormMsg.timestamp);

  // perps-action-trigger card
  const perpsCardMsg = [...conv.messages].reverse().find((m) => m.uiCard === 'perps-action-trigger');
  const showPerpsCard =
    !!perpsCardMsg &&
    !isStreaming &&
    !conv.messages.some((m) => m.role === 'user' && m.timestamp > perpsCardMsg.timestamp);

  // mandate-review card
  const mandateCardMsg = [...conv.messages].reverse().find((m) => m.uiCard === 'mandate-review');
  const showMandateReview =
    !!mandateCardMsg &&
    !isStreaming &&
    !conv.messages.some((m) => m.role === 'user' && m.timestamp > mandateCardMsg.timestamp);

  // connect-wallet-cta
  const connectWalletCtaMsg = [...conv.messages].reverse().find((m) => m.uiCard === 'connect-wallet-cta');
  const showConnectWalletCta =
    !!connectWalletCtaMsg &&
    !isStreaming &&
    !conv.messages.some((m) => m.role === 'user' && m.timestamp > connectWalletCtaMsg.timestamp);

  // create-agent-account-cta
  const createAgentCtaMsg = [...conv.messages].reverse().find((m) => m.uiCard === 'create-agent-account-cta');
  const showCreateAgentCta =
    !!createAgentCtaMsg &&
    !isStreaming &&
    !conv.messages.some((m) => m.role === 'user' && m.timestamp > createAgentCtaMsg.timestamp);

  // fund-agent-account-cta
  const fundAgentCtaMsg = [...conv.messages].reverse().find((m) => m.uiCard === 'fund-agent-account-cta');
  const showFundAgentCta =
    !!fundAgentCtaMsg &&
    !isStreaming &&
    !conv.messages.some((m) => m.role === 'user' && m.timestamp > fundAgentCtaMsg.timestamp);

  // bridge-quote
  const bridgeQuoteMsg = [...conv.messages].reverse().find((m) => m.uiCard === 'bridge-quote');
  const showBridgeQuote = !!bridgeQuoteMsg && !isStreaming;

  // bridge-completion
  const bridgeCompletionMsg = [...conv.messages].reverse().find((m) => m.uiCard === 'bridge-completion');
  const showBridgeCompletion = !!bridgeCompletionMsg && !isStreaming;

  return (
    <div className="h-full flex flex-col bg-bg">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border shrink-0">
        <button
          onClick={() => dispatch({ type: 'SET_ACTIVE_CONV', id: null })}
          className="text-text-muted hover:text-text p-1 -ml-1 rounded transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>

        {editingTitle ? (
          <input
            autoFocus
            className="flex-1 bg-panel-raised border border-primary/50 rounded px-2 py-0.5 text-sm text-text outline-none"
            value={titleVal}
            onChange={(e) => setTitleVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitTitle();
              if (e.key === 'Escape') setEditingTitle(false);
            }}
            onBlur={commitTitle}
          />
        ) : (
          <button
            onClick={startEditTitle}
            className="flex-1 text-left text-sm font-medium text-text hover:text-text-sub truncate transition-colors"
            title="Click to rename"
          >
            {conv.title}
          </button>
        )}

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={startEditTitle}
            className="text-text-muted hover:text-text p-1.5 rounded transition-colors"
            title="Rename"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => dispatch({ type: 'PIN_CONV', convId: conv.id, pinned: !conv.pinned })}
            className={`p-1.5 rounded transition-colors ${conv.pinned ? 'text-primary' : 'text-text-muted hover:text-text'}`}
            title={conv.pinned ? 'Unpin' : 'Pin'}
          >
            <svg className="w-3.5 h-3.5" fill={conv.pinned ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-6">
        <div className="max-w-2xl mx-auto space-y-5">
          {conv.messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}

          {/* Add Meme Scout CTA */}
          {showAddMemeScout && !isStreaming && (
            <div className="flex justify-center pt-2">
              <div className="border border-border rounded-lg px-5 py-4 bg-panel max-w-md text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded border border-border bg-panel-raised flex items-center justify-center">
                    <span className="text-[9px] font-mono font-medium text-text-sub">MS</span>
                  </div>
                  <span className="text-sm font-medium text-text">Add Meme Scout</span>
                </div>
                <p className="text-xs text-text-sub mb-3 leading-relaxed">
                  Keep Meme Scout monitoring BONK and other opportunities in the background.
                  No approval needed to start.
                </p>
                <button
                  onClick={addMemeScout}
                  className="px-4 py-2 bg-primary text-white text-sm rounded font-medium hover:bg-primary-hover transition-colors"
                >
                  Add Meme Scout
                </button>
                {!state.user && (
                  <p className="text-xs text-text-muted mt-2">Requires an account for persistence</p>
                )}
              </div>
            </div>
          )}

          {/* Confirmation after adding */}
          {showMemeScoutConfirmation && !isStreaming && (
            <div className="flex justify-center pt-2">
              <div className="border border-accent/20 rounded-lg px-5 py-4 bg-accent-dim/10 max-w-md">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-accent shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm font-medium text-text">Meme Scout is now in your workforce.</span>
                </div>
                <p className="text-xs text-text-sub mb-3 leading-relaxed">
                  Meme Scout will monitor BONK and surface other meme opportunities. Open its workspace to give it instructions or review findings.
                </p>
                <button
                  onClick={() => dispatch({ type: 'SET_ACTIVE_WORKER', id: 'w-memescout' })}
                  className="text-xs text-primary border border-primary/30 rounded px-3 py-1.5 hover:bg-primary-dim/20 transition-colors"
                >
                  Open Meme Scout
                </button>
              </div>
            </div>
          )}

          {/* stablecoin-mode-select */}
          {showStablecoinModeSelect && (
            <div className="flex justify-center pt-2">
              <div className="border border-border rounded-lg px-5 py-4 bg-panel max-w-md w-full">
                <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">
                  How should Stablecoin Manager work?
                </p>
                <div className="space-y-2">
                  <button
                    onClick={() => runStablecoinRecommendationsOnly(dispatch, conv.id)}
                    className="w-full text-left px-4 py-3 rounded border border-border hover:border-primary/40 hover:bg-primary-dim/10 transition-colors group"
                  >
                    <div className="text-sm font-medium text-text mb-0.5">Recommendations only</div>
                    <div className="text-xs text-text-sub">Surfaces opportunities. You decide what to do.</div>
                  </button>
                  <button
                    onClick={() => {
                      const connectedWallet = (state.wallets ?? []).find((w) => w.mode === 'connected' && !w.disconnected);
                      runStablecoinApproveEachMove(dispatch, conv.id, !!connectedWallet, connectedWallet?.id);
                    }}
                    className="w-full text-left px-4 py-3 rounded border border-border hover:border-primary/40 hover:bg-primary-dim/10 transition-colors group"
                  >
                    <div className="text-sm font-medium text-text mb-0.5">I approve each move</div>
                    <div className="text-xs text-text-sub">Worker plans and proposes. You sign off every time.</div>
                  </button>
                  <button
                    onClick={() => {
                      const agentAccount = (state.agentAccounts ?? [])[0] ?? null;
                      const hasActiveAuthority = (state.authorityGrants ?? []).some(
                        (g) => g.workerId === 'w-stablecoin' && g.status === 'active'
                      );
                      runStablecoinManageWithRules(dispatch, conv.id, agentAccount, hasActiveAuthority);
                    }}
                    className="w-full text-left px-4 py-3 rounded border border-border hover:border-primary/40 hover:bg-primary-dim/10 transition-colors group"
                  >
                    <div className="text-sm font-medium text-text mb-0.5">Manage within my rules</div>
                    <div className="text-xs text-text-sub">Set a mandate with limits. Worker acts autonomously within them.</div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* watch-address-form */}
          {showWatchAddressForm && (
            <WatchAddressFormCard convId={conv.id} />
          )}

          {/* perps-action-trigger */}
          {showPerpsCard && (
            <div className="flex justify-center pt-2">
              <div className="border border-border rounded-lg px-5 py-4 bg-panel max-w-md w-full">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded bg-warn/10 border border-warn/30 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-warn" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-text">2× ETH Long</div>
                    <div className="text-xs text-text-sub">500 USDC collateral · GMX v2 · Arbitrum</div>
                  </div>
                </div>
                <p className="text-xs text-text-muted mb-3 leading-relaxed">
                  Review the full position details, fees, and liquidation price before proceeding.
                </p>
                <button
                  onClick={() => dispatch({ type: 'SET_ACTIVE_ACTION', id: PERPS_ACTION_ID })}
                  className="w-full px-4 py-2.5 bg-primary text-white text-sm rounded font-medium hover:bg-primary-hover transition-colors"
                >
                  Review 2× ETH long
                </button>
              </div>
            </div>
          )}

          {/* mandate-review */}
          {showMandateReview && (
            <MandateReviewCard convId={conv.id} />
          )}

          {/* connect-wallet-cta */}
          {showConnectWalletCta && (
            <div className="flex justify-center pt-2">
              <div className="border border-primary/20 rounded-lg px-5 py-4 bg-primary-dim/5 max-w-md w-full">
                <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Required</p>
                <p className="text-sm font-medium text-text mb-1">Connect a wallet</p>
                <p className="text-xs text-text-sub mb-4 leading-relaxed">
                  You will approve and sign every financial action. Connecting does not create standing authority.
                </p>
                <button
                  onClick={() => {
                    dispatch({
                      type: 'SET_FINANCIAL_SETUP_RETURN',
                      context: { convId: conv.id, flow: 'stablecoin-approve-each', requiredMode: 'connected' },
                    });
                    dispatch({ type: 'SET_VIEW', view: 'wallets' });
                  }}
                  className="w-full px-4 py-2.5 bg-primary text-white text-sm rounded font-medium hover:bg-primary-hover transition-colors"
                >
                  Connect wallet
                </button>
              </div>
            </div>
          )}

          {/* create-agent-account-cta */}
          {showCreateAgentCta && (
            <div className="flex justify-center pt-2">
              <div className="border border-accent/20 rounded-lg px-5 py-4 bg-accent-dim/5 max-w-md w-full">
                <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Required</p>
                <p className="text-sm font-medium text-text mb-1">Create Agent Account</p>
                <p className="text-xs text-text-sub mb-4 leading-relaxed">
                  You remain the ultimate owner. Worker authority starts with none — you grant it in a separate step.
                </p>
                <button
                  onClick={() => {
                    dispatch({
                      type: 'SET_FINANCIAL_SETUP_RETURN',
                      context: { convId: conv.id, flow: 'stablecoin-manage-rules', requiredMode: 'agent-account' },
                    });
                    dispatch({ type: 'SET_VIEW', view: 'wallets' });
                  }}
                  className="w-full px-4 py-2.5 bg-accent text-white text-sm rounded font-medium hover:bg-accent/90 transition-colors"
                >
                  Create Agent Account
                </button>
              </div>
            </div>
          )}

          {/* fund-agent-account-cta */}
          {showFundAgentCta && (
            <FundAgentAccountCard convId={conv.id} />
          )}

          {/* bridge-quote */}
          {showBridgeQuote && (
            <BridgeQuoteCard jobId={bridgeQuoteMsg!.jobId} convId={conv.id} />
          )}

          {/* bridge-completion */}
          {showBridgeCompletion && (
            <BridgeCompletionCard jobId={bridgeCompletionMsg!.jobId} convId={conv.id} />
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border px-5 py-4 shrink-0">
        <div className="max-w-2xl mx-auto">
          <div className="relative rounded-lg border border-border bg-panel focus-within:border-primary/40 transition-colors">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Continue the conversation..."
              rows={2}
              className="w-full bg-transparent resize-none px-4 pt-3 pb-2 text-sm text-text placeholder-text-muted outline-none leading-relaxed"
            />
            <div className="flex items-center justify-between px-4 pb-3">
              <span className="text-xs text-text-dim font-mono">Shift+Enter for new line</span>
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isStreaming}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-all ${
                  input.trim() && !isStreaming
                    ? 'bg-primary text-white hover:bg-primary-hover'
                    : 'bg-panel-raised text-text-dim cursor-not-allowed'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                </svg>
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
