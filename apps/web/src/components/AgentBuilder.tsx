import { useState, useRef, useEffect } from 'react';
import { useAppState, useDispatch, uid } from '../state/AppContext';
import { ResearchMarkdown } from './ResearchMarkdown';
import { scrollConversationToEnd } from '../platform/scroll';
import type { WorkerDraftData, CollaboratorConfig } from '../state/types';
import { createCreatorWorker, createCreatorWorkerVersion, publishCreatorAsset, testCreatorWorker } from '../platform/creatorApi';
import { installDurableWorker } from '../platform/workApi';

// ── Draft initial state ───────────────────────────────────────────────────────

const EMPTY_DRAFT: WorkerDraftData = {
  name: '',
  jobContract: '',
  responsibilities: [],
  antiJobs: [],
  method: [],
  collaborators: [],
  capabilities: [],
  routineTemplates: [],
  authorityDefault: 'Research & recommend only · No wallet authority',
  serviceBudget: 'Configured separately per user or Routine',
  testCases: [],
  testResults: [],
  networks: [],
  pricing: { type: 'free' },
};

function titleFromIntent(text:string):string {
  const cleaned=text.replace(/^(build|create|make)\s+(me\s+)?(a|an)?\s*(worker|agent)?\s*(that|which|to)?\s*/i,'').trim();
  const words=cleaned.split(/\s+/).filter(Boolean).slice(0,4).map((word)=>word.replace(/[^a-z0-9-]/gi,''));
  const base=words.join(' ')||'Custom Research Worker';
  return base.replace(/\b\w/g,(char)=>char.toUpperCase()).slice(0,60);
}

function draftFromIntent(text:string):WorkerDraftData {
  const lower=text.toLowerCase();
  const meme=/meme|token|bonk|launch/.test(lower);
  const smart=/wallet|whale|smart.money|flow|accumul/.test(lower);
  const protocol=/protocol|defi|yield|stablecoin|tvl/.test(lower);
  const capabilities:string[]=[];
  if(meme)capabilities.push('token.market.read','token.liquidity.analyze','token.holders.analyze','token.security.assess');
  if(smart)capabilities.push('wallet.profile','wallet.performance.analyze','wallet.activity.analyze');
  if(protocol)capabilities.push('protocol.tvl.read','protocol.yield.read','protocol.metrics.read');
  if(capabilities.length===0)capabilities.push('research.web.search','research.web.read','research.source.extract');
  const unique=[...new Set(capabilities)];
  return {
    name:titleFromIntent(text),jobContract:text,responsibilities:['Research the requested domain using available evidence','Separate observed evidence from inference','Return a concise result with limitations'],antiJobs:['Do not move funds or sign transactions','Do not present unsupported claims as facts'],method:[],collaborators:[],capabilities:unique,routineTemplates:[],authorityDefault:'Research & recommend only · No wallet authority',serviceBudget:'Configured separately per user or Routine',testCases:[],testResults:[],networks:[],pricing:{type:'free'}
  };
}

// ── Builder conversation ─────────────────────────────────────────────────────

type BuilderStep = 'idle' | 'initial-response' | 'collaborators-added' | 'teach-prompt' | 'teach-response' | 'testing' | 'runtime-test-launched' | 'published';

interface BuilderMessage {
  id: string;
  role: 'user' | 'builder';
  content: string;
}

// ── Live Worker Draft Panel ───────────────────────────────────────────────────

function DraftSection({ title, children, collapsible, defaultOpen = true }: {
  title: string;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border-dim last:border-0">
      <button
        onClick={() => collapsible && setOpen(!open)}
        className={`w-full flex items-center justify-between px-4 py-2.5 text-left ${collapsible ? 'hover:bg-panel-raised cursor-pointer' : 'cursor-default'}`}
      >
        <span className="text-[10px] font-mono uppercase tracking-wider text-text-dim">{title}</span>
        {collapsible && (
          <svg className={`w-3 h-3 text-text-dim transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

function LiveDraftPanel({ draft, step, testJobId }: { draft: WorkerDraftData; step: BuilderStep; testJobId?: string }) {
  const hasContent = draft.name || draft.jobContract || draft.responsibilities.length > 0;

  if (!hasContent) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center px-6">
          <div className="w-10 h-10 rounded-full bg-panel-raised border border-border flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-text-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-xs text-text-dim">Worker Draft appears here</p>
        </div>
      </div>
    );
  }


  return (
    <div className="h-full min-h-0 overflow-y-auto overscroll-contain">
      <div className="px-4 py-3 border-b border-border-dim">
        <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-0.5">Live Worker Draft</p>
        <p className="text-sm font-semibold text-text">{draft.name || 'Untitled Worker'}</p>
      </div>

      <DraftSection title="Job Contract">
        <p className="text-xs text-text-sub leading-relaxed">{draft.jobContract || '—'}</p>
      </DraftSection>

      {draft.responsibilities.length > 0 && (
        <DraftSection title="Responsibilities">
          <ul className="space-y-1">
            {draft.responsibilities.map((r) => (
              <li key={r} className="text-xs text-text-sub flex items-start gap-1.5">
                <span className="text-text-dim mt-0.5 shrink-0">·</span>{r}
              </li>
            ))}
          </ul>
        </DraftSection>
      )}

      {draft.antiJobs.length > 0 && (
        <DraftSection title="Anti-jobs" collapsible defaultOpen={false}>
          <ul className="space-y-1">
            {draft.antiJobs.map((a) => (
              <li key={a} className="text-xs text-text-sub flex items-start gap-1.5">
                <span className="text-danger mt-0.5 shrink-0">—</span>{a}
              </li>
            ))}
          </ul>
        </DraftSection>
      )}

      {draft.method.length > 0 && (
        <DraftSection title="Method / Expertise">
          <ul className="space-y-1">
            {draft.method.map((m) => (
              <li key={m} className="text-xs text-text-sub flex items-start gap-1.5">
                <span className="text-accent mt-0.5 shrink-0">→</span>{m}
              </li>
            ))}
          </ul>
        </DraftSection>
      )}

      {draft.collaborators.length > 0 && (
        <DraftSection title="Collaborators">
          <div className="space-y-2">
            {draft.collaborators.map((c) => (
              <div key={c.id} className="bg-panel-raised border border-border-dim rounded px-3 py-2">
                <p className="text-xs font-medium text-text">{c.pinnedWorkerName ?? c.role}</p>
                <p className="text-[10px] text-text-muted">{c.roleBased ? 'Role-based selection' : 'Pinned'} · {c.whenUsed}</p>
                <p className="text-[10px] text-text-dim mt-0.5">{c.authorityBoundary}</p>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-text-dim mt-2">Collaborators do not inherit this Worker's wallet authority.</p>
        </DraftSection>
      )}

      {draft.capabilities.length > 0 && (
        <DraftSection title="Capabilities" collapsible defaultOpen={false}>
          <div className="flex flex-wrap gap-1.5">
            {draft.capabilities.map((c) => (
              <span key={c} className="text-[10px] font-mono text-text-muted bg-panel border border-border-dim rounded px-2 py-0.5">{c}</span>
            ))}
          </div>
        </DraftSection>
      )}

      <DraftSection title="Routines" collapsible defaultOpen={false}>
        <p className="text-xs text-text-dim">None by default</p>
      </DraftSection>

      <DraftSection title="Authority Default">
        <p className="text-xs text-text-sub">{draft.authorityDefault}</p>
        <p className="text-[10px] text-text-dim mt-1">End-user authority is configured separately and not set by this default.</p>
      </DraftSection>

      <DraftSection title="Budget" collapsible defaultOpen={false}>
        <p className="text-xs text-text-dim">{draft.serviceBudget}</p>
      </DraftSection>

      <DraftSection title="Tests" collapsible defaultOpen={step === 'runtime-test-launched' || step === 'published'}>
        {testJobId ? (
          <div>
            <p className="text-xs text-accent">Real sandbox Job launched</p>
            <p className="text-[10px] text-text-dim mt-1">Open the Job to inspect routing, evidence and result. A test does not self-certify safety.</p>
          </div>
        ) : (
          <p className="text-xs text-text-dim">Not run yet</p>
        )}
      </DraftSection>

      <DraftSection title="Networks" collapsible defaultOpen={false}>
        <div className="flex flex-wrap gap-1.5">
          {draft.networks.map((n) => (
            <span key={n} className="text-[10px] font-mono text-text-muted bg-panel border border-border-dim rounded px-2 py-0.5">{n}</span>
          ))}
        </div>
      </DraftSection>

      <DraftSection title="Pricing" collapsible defaultOpen={false}>
        <p className="text-xs text-text-dim">{draft.pricing.type === 'free' ? 'Free' : draft.pricing.label ?? 'Paid'}</p>
      </DraftSection>
    </div>
  );
}

// ── Main AgentBuilder component ────────────────────────────────────────────────

export function AgentBuilder() {
  const state = useAppState();
  const dispatch = useDispatch();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<BuilderMessage[]>([]);
  const initialAsset = state.activeCreationId ? (state.creatorAssets ?? []).find((asset)=>asset.id===state.activeCreationId) : undefined;
  const [draft, setDraft] = useState<WorkerDraftData>(initialAsset?.workerDraft ?? EMPTY_DRAFT);
  const [savedAssetId,setSavedAssetId]=useState<string|undefined>(initialAsset?.id);
  const [testJobId,setTestJobId]=useState<string|undefined>();
  const [step, setStep] = useState<BuilderStep>(initialAsset?.workerDraft ? 'initial-response' : 'idle');
  const [teachMode, setTeachMode] = useState(false);
  const [mobileTab, setMobileTab] = useState<'chat' | 'draft'>('chat');
  const messageScrollRef = useRef<HTMLDivElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);


  useEffect(() => {
    scrollConversationToEnd(messageScrollRef.current);
  }, [messages]);

  function addBuilderMessage(content: string) {
    setMessages((prev) => [...prev, { id: uid(), role: 'builder', content }]);
    setIsStreaming(false);
  }

  function streamBuilderMessage(content: string) {
    setIsStreaming(true);
    const id = uid();
    setMessages((prev) => [...prev, { id, role: 'builder', content: '' }]);
    setTimeout(() => {
      setMessages((prev) => prev.map((m) => m.id === id ? { ...m, content } : m));
      setIsStreaming(false);
    }, 700);
  }

  function handleSend() {
    if (!input.trim() || isStreaming) return;
    const text = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { id: uid(), role: 'user', content: text }]);

    if (step === 'idle') {
      setStep('initial-response');
      const formed=draftFromIntent(text);
      setDraft(formed);
      const available=(state.discoverSupply??[]).filter((item)=>item.type==='worker'&&item.readiness==='available').slice(0,3).map((item)=>item.name);
      setTimeout(()=>{streamBuilderMessage(`Got it. I'm forming **${formed.name}** around your actual request.

I mapped a research-only Job Contract and ${formed.capabilities.length} existing AgentPlace capability requirements. Creation grants no wallet authority.

${available.length?`Reusable expertise currently available: **${available.join('**, **')}**. You can reuse existing expertise or teach your own method.`:'You can teach your own method before testing.'}`);},250);
    } else if (step === 'teach-prompt') {
      setStep('teach-response');
      setDraft((current)=>({...current,method:[...current.method,text]}));
      setTimeout(()=>streamBuilderMessage(`Understood. I added your teaching to **Method / Expertise** as creator-authored guidance.

> ${text}

This changes methodology only; it does not create authority or bypass AgentPlace capability/risk controls.`),250);
    }
  }

  function handleUseExistingExpertise() {
    setStep('collaborators-added');
    const candidates=(state.discoverSupply??[]).filter((item)=>item.type==='worker'&&item.isOriginal&&item.readiness!=='unavailable'&&item.workerDefinitionId).slice(0,2);
    const collaborators:CollaboratorConfig[]=candidates.map((item,index)=>({id:`collab-${item.workerDefinitionId}`,role:item.tagline,pinnedWorkerId:item.workerDefinitionId,pinnedWorkerName:item.name,roleBased:index>0,whenUsed:'When specialist evidence materially improves the Job',contextShared:'Only task-relevant context',required:index===0,...(index===0?{}:{fallback:'Continue without optional specialist'}),authorityBoundary:'Research only — collaborator authority never propagates'}));
    setDraft((d)=>({...d,collaborators}));
    streamBuilderMessage(collaborators.length?`I added ${collaborators.length} existing specialist ${collaborators.length===1?'Worker':'Workers'} to the draft. Collaborator financial authority does not propagate. You can teach unique expertise now or run a real sandbox test.`:'No eligible reusable specialist was found, so the Worker remains standalone. You can teach unique expertise or run a real sandbox test.');
  }

  function handleTeachExpertise() {
    setStep('teach-prompt');
    setTeachMode(true);
    streamBuilderMessage(
      `Teach Mode active. Describe the decision rules or process that make this Worker uniquely yours. For example:\n\n• What evidence do you prioritise?\n• What signals do you ignore or distrust?\n• What edge cases should the Worker handle carefully?\n\nI'll interpret your input and update the Method / Expertise section.`
    );
  }

  function handleLooksRight() {
    if (!state.user) {
      dispatch({type:'SET_IDENTITY_CHECKPOINT',checkpoint:{reason:'test-worker',feature:'save your draft and run a real sandbox Worker test',onComplete:(user)=>{dispatch({type:'SET_USER',user});void runTests();}}});
    } else { void runTests(); }
  }

  async function runTests() {
    setStep('testing');
    setIsStreaming(true);
    try {
      let assetId=savedAssetId;
      if(!assetId){const asset=await createCreatorWorker({...draft,testResults:[]});assetId=asset.id;setSavedAssetId(asset.id);dispatch({type:'ADD_CREATOR_ASSET',asset});}else if(state.activeCreationId===assetId){const asset=await createCreatorWorkerVersion(assetId,{...draft,testResults:[]});dispatch({type:'UPDATE_CREATOR_ASSET',assetId,updates:{workerDraft:asset.workerDraft,updatedAt:asset.updatedAt}});}
      const scenario=draft.testCases[0]?.scenario??`Perform a bounded test of this Job Contract: ${draft.jobContract}`;
      const expected=draft.testCases[0]?.expected??'Produce an evidence-backed result while respecting anti-jobs and no financial authority.';
      const result=await testCreatorWorker(assetId,scenario,expected);
      setTestJobId(result.jobId);
      setStep('runtime-test-launched');
      addBuilderMessage(`A real sandbox Job has been queued for **${draft.name}** using the saved creator Worker version.

Open the Job to inspect routing, evidence and the actual result. Passing this test does not self-certify safety. Creator tests never grant financial authority.`);
    } catch(value){setStep('initial-response');addBuilderMessage(value instanceof Error?`Could not start creator test: ${value.message}`:'Could not start creator test.');}
  }

  function handleUsePrivately() {
    if (!state.user) {
      dispatch({
        type: 'SET_IDENTITY_CHECKPOINT',
        checkpoint: {
          reason: 'save-worker',
          feature: 'save and use your Worker privately',
          onComplete: (user) => {
            dispatch({ type: 'SET_USER', user });
            void finalizePrivate();
          },
        },
      });
    } else {
      void finalizePrivate();
    }
  }

  async function finalizePrivate() {
    try {
      let assetId=savedAssetId;
      if(!assetId){const asset=await createCreatorWorker({...draft,testResults:[]});assetId=asset.id;setSavedAssetId(asset.id);dispatch({type:'ADD_CREATOR_ASSET',asset});}
      await publishCreatorAsset('worker',assetId,'private');
      const worker=await installDurableWorker(assetId);
      dispatch({type:'ADD_WORKER',worker});
      dispatch({type:'UPDATE_CREATOR_ASSET',assetId,updates:{visibility:'private'}});
      setStep('published');
      streamBuilderMessage(`**${draft.name}** is saved privately and added to your Workers.

Authority: ${draft.authorityDefault}.

The installed Worker is pinned to this exact version until you explicitly update it.`);
    } catch(value){addBuilderMessage(value instanceof Error?`Could not save Worker: ${value.message}`:'Could not save Worker.');}
  }

  async function handlePublish() {
    if(!savedAssetId){addBuilderMessage('Save this Worker privately before publishing.');return;}
    try{await publishCreatorAsset('worker',savedAssetId,'published');dispatch({type:'UPDATE_CREATOR_ASSET',assetId:savedAssetId,updates:{visibility:'public'}});streamBuilderMessage(`**${draft.name}** is now public in Discover. Publication does not grant end-user wallet authority, and Discover will show runtime readiness separately from publication status.`);}catch(value){addBuilderMessage(value instanceof Error?`Publishing failed: ${value.message}`:'Publishing failed.');}
  }

  function closeSurface() {
    dispatch({ type: 'SET_CREATOR_SURFACE', surface: null });
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const canSend = input.trim().length > 0 && !isStreaming;

  const ChatPanel = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border shrink-0 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-text">Agent Builder</p>
          <p className="text-xs text-text-muted">
            {teachMode ? 'Teach Mode active' : 'Design your Worker conversationally'}
          </p>
        </div>
        <button onClick={closeSurface} className="text-text-muted hover:text-text p-1 rounded transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div ref={messageScrollRef} data-workspace-scroll className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="py-8 text-center">
            <p className="text-sm text-text-sub mb-1">Describe the Worker you want to build.</p>
            <p className="text-xs text-text-muted">Agent Builder will form a Live Draft as you talk.</p>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
              m.role === 'user'
                ? 'bg-primary text-white rounded-br-sm'
                : 'bg-panel-raised border border-border text-text-sub rounded-bl-sm'
            }`}>
              <ResearchMarkdown text={m.content} />
            </div>
          </div>
        ))}

        {/* Action buttons based on step */}
        {step === 'initial-response' && !isStreaming && (
          <div className="flex flex-wrap gap-2 pl-1 pt-1">
            <button
              onClick={handleUseExistingExpertise}
              className="px-4 py-2 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
            >
              Use existing expertise
            </button>
            <button
              onClick={handleTeachExpertise}
              className="px-4 py-2 text-xs font-medium border border-border text-text-sub rounded-lg hover:bg-panel-raised transition-colors"
            >
              Teach unique expertise
            </button>
          </div>
        )}

        {step === 'collaborators-added' && !isStreaming && (
          <div className="flex flex-wrap gap-2 pl-1 pt-1">
            <button
              onClick={handleTeachExpertise}
              className="px-4 py-2 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
            >
              Teach unique expertise
            </button>
            <button
              onClick={handleLooksRight}
              className="px-4 py-2 text-xs font-medium border border-border text-text-sub rounded-lg hover:bg-panel-raised transition-colors"
            >
              Test Worker
            </button>
          </div>
        )}

        {step === 'teach-response' && !isStreaming && (
          <div className="flex flex-wrap gap-2 pl-1 pt-1">
            <button
              onClick={handleLooksRight}
              className="px-4 py-2 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
            >
              Looks right — Test Worker
            </button>
            <button
              onClick={() => {
                setStep('teach-prompt');
                streamBuilderMessage("What else would you like to teach?");
              }}
              className="px-4 py-2 text-xs font-medium border border-border text-text-sub rounded-lg hover:bg-panel-raised transition-colors"
            >
              Continue teaching
            </button>
          </div>
        )}

        {step === 'runtime-test-launched' && !isStreaming && (
          <div className="flex gap-2 flex-wrap">
            {testJobId && <button onClick={()=>dispatch({type:'SET_ACTIVE_JOB',id:testJobId})} className="px-3 py-1.5 text-xs bg-primary text-white rounded">Open real test Job</button>}
            <button onClick={handleUsePrivately} className="px-3 py-1.5 text-xs border border-border text-text-sub rounded">Use privately</button>
          </div>
        )}

        {step === 'published' && !isStreaming && (
          <div className="flex flex-wrap gap-2 pl-1 pt-1">
            <button
              onClick={() => {
                dispatch({ type: 'SET_CREATOR_SURFACE', surface: null });
                dispatch({ type: 'SET_VIEW', view: 'workers' });
              }}
              className="px-4 py-2 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
            >
              Open in Workers
            </button>
            <button
              onClick={handlePublish}
              className="px-4 py-2 text-xs font-medium border border-border text-text-sub rounded-lg hover:bg-panel-raised transition-colors"
            >
              Publish publicly
            </button>
          </div>
        )}


      </div>

      {/* Input */}
      {step !== 'published' && (
        <div className="px-5 py-4 border-t border-border shrink-0">
          {step === 'idle' && (
            <p className="text-xs text-text-dim mb-2">
              Example: "Build me a whale-driven meme scout."
            </p>
          )}
          <div className="flex gap-2">
            <input
              className="flex-1 bg-panel-raised border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-primary/50"
              placeholder={teachMode ? 'Describe your criteria…' : 'Describe what you want to build…'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            />
            <button
              onClick={handleSend}
              disabled={!canSend}
              className="px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-40 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const DraftPanelContent = (
    <LiveDraftPanel draft={draft} step={step} testJobId={testJobId} />
  );

  return (
    <div className="h-full min-h-0 flex flex-col bg-bg overflow-hidden">
      {/* Mobile tabs */}
      <div className="md:hidden flex border-b border-border shrink-0">
        {(['chat', 'draft'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setMobileTab(t)}
            className={`flex-1 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              mobileTab === t ? 'border-primary text-text' : 'border-transparent text-text-sub'
            }`}
          >
            {t === 'chat' ? 'Chat' : 'Draft'}
          </button>
        ))}
      </div>

      {/* Desktop: side by side; mobile: tabs */}
      <div className="flex-1 overflow-hidden flex">
        <div className={`${mobileTab === 'chat' ? 'flex' : 'hidden'} md:flex flex-col md:w-[55%] border-r border-border`}>
          {ChatPanel}
        </div>
        <div className={`${mobileTab === 'draft' ? 'flex' : 'hidden'} md:flex flex-col md:flex-1 bg-panel`}>
          {DraftPanelContent}
        </div>
      </div>
    </div>
  );
}
