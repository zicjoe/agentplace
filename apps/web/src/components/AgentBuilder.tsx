import { useState, useRef, useEffect } from 'react';
import { useAppState, useDispatch, uid } from '../state/AppContext';
import { ResearchMarkdown } from './ResearchMarkdown';
import { scrollConversationToEnd } from '../platform/scroll';
import type { WorkerDraftData, CollaboratorConfig } from '../state/types';
import { createCreatorWorker, createCreatorWorkerVersion, fetchCreatorBuilderSession, interpretCreatorBuilderTurn, publishCreatorAsset, saveCreatorBuilderSession, testCreatorWorker, type CreatorBuilderTurnResult, CREATOR_BUILDER_MESSAGE_LIMIT } from '../platform/creatorApi';
import { installDurableWorker } from '../platform/workApi';
import { WorkerCreateStart } from './WorkerCreateStart';
import { initialWorkerJobContract, WORKER_CREATION_STARTERS } from '../platform/workerCreationStart';
import { appendBuilderSuggestion, builderInputProblem, builderTemplateInstruction, builderTurnMode } from '../platform/builderConversation';

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

function seedDraftForBuilder(text:string):WorkerDraftData {
  return {
    ...EMPTY_DRAFT,
    name:'Untitled Creator Worker',
    jobContract:initialWorkerJobContract(text),
    responsibilities:['Research the requested domain using available evidence','Separate observed evidence from inference','Return a concise result with limitations'],
    antiJobs:['Do not move funds or sign transactions','Do not present unsupported claims as facts'],
    capabilities:[],
  };
}

// ── Builder conversation ─────────────────────────────────────────────────────

type BuilderStep = 'idle' | 'initial-response' | 'collaborators-added' | 'teach-prompt' | 'teach-response' | 'testing' | 'runtime-test-launched' | 'editing' | 'private-saved' | 'public-saved';

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

function CreatorUserMessage({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);
  const longBrief = content.length > 450;
  return (
    <div className="rounded-xl px-4 py-3 text-sm leading-relaxed bg-primary text-white rounded-br-sm min-w-0">
      <div
        className="whitespace-pre-wrap break-words"
        style={longBrief && !expanded ? { display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : undefined}
      >
        {content}
      </div>
      {longBrief && (
        <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}
          className="text-xs font-medium mt-2 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-white">
          {expanded ? 'Show less' : 'Show full brief'}
        </button>
      )}
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

      <DraftSection title="Tests" collapsible defaultOpen={step === 'runtime-test-launched' || step === 'private-saved' || step === 'public-saved'}>
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


function stepForVisibility(visibility: string | undefined): BuilderStep {
  return visibility === 'public' ? 'public-saved' : visibility === 'private' || visibility === 'unlisted' ? 'private-saved' : 'initial-response';
}

function normalizeBuilderStep(value: string, visibility: string | undefined, hasTestJob: boolean): BuilderStep {
  const supported: BuilderStep[] = ['idle','initial-response','collaborators-added','teach-prompt','teach-response','testing','runtime-test-launched','editing','private-saved','public-saved'];
  if (!supported.includes(value as BuilderStep)) return stepForVisibility(visibility);
  if (value === 'testing') return hasTestJob ? 'runtime-test-launched' : stepForVisibility(visibility);
  return value as BuilderStep;
}

function draftSignature(draft: WorkerDraftData): string {
  return JSON.stringify({
    name:draft.name,jobContract:draft.jobContract,responsibilities:draft.responsibilities,antiJobs:draft.antiJobs,method:draft.method,
    collaborators:draft.collaborators.map((item)=>({role:item.role,pinnedWorkerId:item.pinnedWorkerId??null,roleBased:item.roleBased,whenUsed:item.whenUsed,contextShared:item.contextShared,required:item.required,fallback:item.fallback??null,authorityBoundary:item.authorityBoundary})),
    capabilities:draft.capabilities,authorityDefault:draft.authorityDefault,networks:draft.networks,lineageSourceId:draft.lineageSourceId??null,lineageSourceName:draft.lineageSourceName??null,lineageSourceCreator:draft.lineageSourceCreator??null,
  });
}

export function AgentBuilder() {
  const state = useAppState();
  const dispatch = useDispatch();
  const initialAsset = state.activeCreationId ? (state.creatorAssets ?? []).find((asset) => asset.id === state.activeCreationId) : undefined;
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<BuilderMessage[]>([]);
  const [draft, setDraft] = useState<WorkerDraftData>(initialAsset?.workerDraft ?? EMPTY_DRAFT);
  const [savedAssetId, setSavedAssetId] = useState<string | undefined>(initialAsset?.id);
  const [testJobId, setTestJobId] = useState<string | undefined>();
  const [step, setStep] = useState<BuilderStep>(initialAsset?.workerDraft ? stepForVisibility(initialAsset.visibility) : 'idle');
  const [teachMode, setTeachMode] = useState(false);
  const [showDetailedSetup, setShowDetailedSetup] = useState(false);
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);
  const [composerNotice, setComposerNotice] = useState('');
  const [saveStatus, setSaveStatus] = useState<'unsaved' | 'saving' | 'saved' | 'error'>('unsaved');
  const [mobileTab, setMobileTab] = useState<'chat' | 'draft'>('chat');
  const [isStreaming, setIsStreaming] = useState(false);
  const [failedInitialBrief, setFailedInitialBrief] = useState<string | null>(null);
  const [failedBuilderTurn, setFailedBuilderTurn] = useState<{ text:string; mode:'teach'|'edit' } | null>(null);
  const [sessionReady, setSessionReady] = useState(!state.activeCreationId);
  const messageScrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const assetCreationPromiseRef = useRef<Promise<string> | null>(null);
  const saveQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const saveSequenceRef = useRef(0);
  const lastPersistedDraftSignatureRef = useRef(initialAsset?.workerDraft ? draftSignature(initialAsset.workerDraft) : '');

  useEffect(() => {
    scrollConversationToEnd(messageScrollRef.current);
  }, [messages, showTemplateLibrary]);

  useEffect(() => {
    if (!input.trim()) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [input]);

  useEffect(() => {
    const assetId = state.activeCreationId;
    if (!assetId) {
      setSessionReady(true);
      return;
    }
    const asset = (state.creatorAssets ?? []).find((item) => item.id === assetId);
    if (!asset?.workerDraft) {
      setSessionReady(true);
      return;
    }
    let cancelled = false;
    setSessionReady(false);
    setSavedAssetId(asset.id);
    setDraft(asset.workerDraft);
    lastPersistedDraftSignatureRef.current = draftSignature(asset.workerDraft);
    void fetchCreatorBuilderSession(asset.id).then((session) => {
      if (cancelled) return;
      if (session) {
        setMessages(session.messages);
        setDraft(session.draft);
        setStep(normalizeBuilderStep(session.step, asset.visibility, Boolean(session.testJobId)));
        setTeachMode(session.teachMode);
        setTestJobId(session.testJobId);
        setSaveStatus('saved');
      } else {
        setSaveStatus('unsaved');
        setMessages([{
          id: uid(),
          role: 'builder',
          content: `Reopened **${asset.workerDraft?.name ?? 'your Worker'}**. Your saved draft${asset.workerDraft?.method.length ? ' and creator-authored Method / Expertise' : ''} are intact. You can keep editing, run a real sandbox test, or change its visibility.`,
        }]);
        setStep(stepForVisibility(asset.visibility));
        setTeachMode(false);
        setTestJobId(undefined);
      }
    }).catch((error) => {
      if (cancelled) return;
      console.error('Could not restore Agent Builder conversation', error);
      setSaveStatus('error');
      setMessages([{
        id: uid(),
        role: 'builder',
        content: `Reopened **${asset.workerDraft?.name ?? 'your Worker'}**. The saved draft is available, but the earlier Builder transcript could not be restored. You can continue editing from here.`,
      }]);
      setStep(stepForVisibility(asset.visibility));
    }).finally(() => {
      if (!cancelled) setSessionReady(true);
    });
    return () => { cancelled = true; };
  }, [state.activeCreationId]);

  useEffect(() => {
    if (!sessionReady || !savedAssetId || !state.user || isStreaming) return;
    if (messages.some((message) => !message.content.trim())) return;
    const saveSequence = ++saveSequenceRef.current;
    setSaveStatus('saving');
    const timer = window.setTimeout(() => {
      const snapshot = { step, teachMode, ...(testJobId ? { testJobId } : {}), draft, messages };
      saveQueueRef.current = saveQueueRef.current.catch(() => undefined).then(async () => {
        await saveCreatorBuilderSession(savedAssetId, snapshot);
        if (saveSequence === saveSequenceRef.current) setSaveStatus('saved');
      }).catch((error) => {
        console.error('Could not persist Agent Builder conversation', error);
        if (saveSequence === saveSequenceRef.current) setSaveStatus('error');
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [sessionReady, savedAssetId, state.user, isStreaming, messages, draft, step, teachMode, testJobId]);

  function addBuilderMessage(content: string) {
    setMessages((prev) => [...prev, { id: uid(), role: 'builder', content }]);
    setIsStreaming(false);
  }

  function addUserChoice(content: string) {
    setMessages((prev) => [...prev, { id: uid(), role: 'user', content }]);
  }

  function streamBuilderMessage(content: string) {
    setIsStreaming(true);
    const id = uid();
    setMessages((prev) => [...prev, { id, role: 'builder', content: '' }]);
    window.setTimeout(() => {
      setMessages((prev) => prev.map((message) => message.id === id ? { ...message, content } : message));
      setIsStreaming(false);
    }, 700);
  }

  async function ensureSavedWorker(draftToSave: WorkerDraftData): Promise<string> {
    if (savedAssetId) return savedAssetId;
    if (assetCreationPromiseRef.current) return assetCreationPromiseRef.current;
    const promise = createCreatorWorker({ ...draftToSave, testResults: [] }).then((asset) => {
      setSavedAssetId(asset.id);
      dispatch({ type: 'ADD_CREATOR_ASSET', asset });
      lastPersistedDraftSignatureRef.current = draftSignature(asset.workerDraft ?? draftToSave);
      setSessionReady(true);
      return asset.id;
    }).finally(() => {
      assetCreationPromiseRef.current = null;
    });
    assetCreationPromiseRef.current = promise;
    return promise;
  }

  async function ensureCurrentWorkerVersion(assetId: string, draftToSave: WorkerDraftData): Promise<void> {
    const nextSignature = draftSignature(draftToSave);
    if (nextSignature === lastPersistedDraftSignatureRef.current) return;
    const asset = await createCreatorWorkerVersion(assetId, { ...draftToSave, testResults: [] });
    lastPersistedDraftSignatureRef.current = draftSignature(asset.workerDraft ?? draftToSave);
    dispatch({
      type: 'UPDATE_CREATOR_ASSET',
      assetId,
      updates: { workerDraft: asset.workerDraft, version: asset.version, visibility: asset.visibility, versionHistory: asset.versionHistory },
    });
  }

  function submitBuilderBrief(brief: string) {
    if (isStreaming || step === 'testing' || !sessionReady) return;
    const text = brief.trim();
    const problem = builderInputProblem(text, Boolean(savedAssetId), CREATOR_BUILDER_MESSAGE_LIMIT);
    if (problem) { setComposerNotice(problem); return; }
    setComposerNotice('');
    setShowDetailedSetup(false);
    setFailedBuilderTurn(null);
    setInput('');
    const userMessage:BuilderMessage={ id: uid(), role: 'user', content: text };
    setMessages((prev) => [...prev, userMessage]);
    if (!state.user) {
      dispatch({
        type:'SET_IDENTITY_CHECKPOINT',
        checkpoint:{
          reason:'creator-builder',
          feature:'use Agent Builder intelligence and keep your Worker draft durable',
          onComplete:(user)=>{ dispatch({type:'SET_USER',user}); void processBuilderTurn(text, false, undefined, userMessage); },
        },
      });
      return;
    }
    void processBuilderTurn(text, false, undefined, userMessage);
  }

  function handleSend() {
    submitBuilderBrief(input);
  }

  async function processBuilderTurn(text:string, retryInitial = false, retryMode?:'teach'|'edit', submittedMessage?: BuilderMessage) {
    const mode:'build'|'edit'|'teach'=retryMode??builderTurnMode(text, step !== 'idle' && !retryInitial, teachMode || step === 'teach-prompt');
    const baseDraft=step==='idle'?seedDraftForBuilder(text):draft;
    if(step==='idle'){
      setDraft(baseDraft);
      setTeachMode(false);
      setStep('initial-response');
    }
    setIsStreaming(true);
    let seedPersisted = Boolean(savedAssetId);
    try {
      const assetId=await ensureSavedWorker(baseDraft);
      seedPersisted = true;
      // Save the exact user's message before consuming a model request. A reload
      // during interpretation must not erase a successfully persisted input.
      const previousMessages=messages[ messages.length-1 ]?.role==='user'&&messages[ messages.length-1 ]?.content===text?messages.slice(0,-1):messages;
      if (submittedMessage) {
        const submittedMessages = [...previousMessages, submittedMessage];
        await saveQueueRef.current.catch(() => undefined);
        const saveSequence = ++saveSequenceRef.current;
        setSaveStatus('saving');
        await saveCreatorBuilderSession(assetId, {
          step: mode === 'build' ? 'initial-response' : step,
          teachMode: mode === 'teach',
          ...(testJobId ? {testJobId} : {}),
          draft: baseDraft,
          messages: submittedMessages,
        });
        if (saveSequence === saveSequenceRef.current) setSaveStatus('saved');
      }
      const result:CreatorBuilderTurnResult=await interpretCreatorBuilderTurn(assetId,{message:text,mode,draft:baseDraft,messages:previousMessages});
      setDraft(result.draft);
      setFailedInitialBrief(null);
      setFailedBuilderTurn(null);
      // Initial creation is draft-only: even an unexpected model intent cannot
      // launch tests, install a Worker or publish a listing on the first turn.
      // Existing explicit creator actions remain available after draft review.
      const initialActionAttempt = mode === 'build' && (result.intent === 'TEST' || result.intent === 'SAVE_PRIVATE' || result.intent === 'PUBLISH');
      // Model-proposed intents never dispatch expensive tests or change visibility.
      // Those are reserved for the explicit user controls below in every mode.
      const explicitActionOnly = result.intent === 'TEST' || result.intent === 'SAVE_PRIVATE' || result.intent === 'PUBLISH';
      const intent = initialActionAttempt || explicitActionOnly ? 'MODIFY_DRAFT' : result.intent;
      if(intent==='TEACH'){
        setTeachMode(true);
        setStep('teach-response');
      }else{
        setTeachMode(false);
        if(intent==='USE_EXISTING_EXPERTISE')setStep('collaborators-added');
        else if(mode==='build'&&intent!=='TEST'&&intent!=='SAVE_PRIVATE'&&intent!=='PUBLISH')setStep('initial-response');
        else setStep('editing');
      }
      addBuilderMessage(explicitActionOnly
        ? `${result.reply}

**Review the draft and use the explicit controls** to test, install privately, or publish. A chat interpretation cannot perform those actions for you.`
        : result.reply);
    } catch(value) {
      setIsStreaming(false);
      const detail=value instanceof Error?value.message:'Agent Builder intelligence is temporarily unavailable.';
      if (mode === 'build') setFailedInitialBrief(text);
      else setFailedBuilderTurn({text,mode});
      addBuilderMessage(mode==='build'
        ? seedPersisted
          ? `Agent Builder could not interpret the entire brief: ${detail}\n\nAn **initial private draft outline** was saved, but it is **not a completed Worker**. You can retry interpretation without creating another Worker. Nothing was tested, published or granted authority.`
          : `Agent Builder could not save the first draft: ${detail}\n\nNo draft was saved. You can retry without retyping the brief. Nothing was tested, published or granted authority.`
        : `Agent Builder intelligence could not interpret that turn: ${detail}\n\nYour existing draft was not changed.`);
    }
  }

  function handleUseExistingExpertise() {
    setStep('collaborators-added');
    setTeachMode(false);
    const candidates = (state.discoverSupply ?? []).filter((item) => item.type === 'worker' && item.isOriginal && item.readiness !== 'unavailable' && item.workerDefinitionId).slice(0, 2);
    const collaborators: CollaboratorConfig[] = candidates.map((item, index) => ({
      id: `collab-${item.workerDefinitionId}`,
      role: item.tagline,
      pinnedWorkerId: item.workerDefinitionId,
      pinnedWorkerName: item.name,
      roleBased: index > 0,
      whenUsed: 'When specialist evidence materially improves the Job',
      contextShared: 'Only task-relevant context',
      required: index === 0,
      ...(index === 0 ? {} : { fallback: 'Continue without optional specialist' }),
      authorityBoundary: 'Research only — collaborator authority never propagates',
    }));
    setDraft((current) => ({ ...current, collaborators }));
    streamBuilderMessage(collaborators.length ? `I added ${collaborators.length} existing specialist ${collaborators.length === 1 ? 'Worker' : 'Workers'} to the draft. Collaborator financial authority does not propagate. You can teach unique expertise now or run a real sandbox test.` : 'No eligible reusable specialist was found, so the Worker remains standalone. You can teach unique expertise or run a real sandbox test.');
  }

  function handleTeachExpertise() {
    setStep('teach-prompt');
    setTeachMode(true);
    streamBuilderMessage(`Teach Mode active. Describe the decision rules or process that make this Worker uniquely yours. For example:

• What evidence do you prioritise?
• What signals do you ignore or distrust?
• What edge cases should the Worker handle carefully?

I'll interpret it into the appropriate draft section. AgentPlace's trusted Creator core validates every proposed change.`);
  }

  function handleContinueTeaching() {
    setStep('teach-prompt');
    setTeachMode(true);
    streamBuilderMessage('What else would you like to teach? Agent Builder will interpret the rule conversationally and the trusted Creator core will place it in Method / Expertise, Responsibilities, or Anti-jobs as appropriate.');
  }

  function handleContinueEditing() {
    setStep('editing');
    setTeachMode(false);
    streamBuilderMessage('What would you like to change? You can speak naturally — rename it, add or remove responsibilities/rules/capabilities, ask why something is present, request a test, or undo the last draft change.');
  }

  function handleLooksRight() {
    setTeachMode(false);
    if (!state.user) {
      dispatch({
        type: 'SET_IDENTITY_CHECKPOINT',
        checkpoint: {
          reason: 'test-worker',
          feature: 'save your draft and run a real sandbox Worker test',
          onComplete: (user) => { dispatch({ type: 'SET_USER', user }); void runTests(); },
        },
      });
    } else {
      void runTests();
    }
  }

  async function runTests(draftToTest:WorkerDraftData=draft,scenarioOverride?:string,expectedOverride?:string) {
    setStep('testing');
    setIsStreaming(true);
    try {
      const assetId = await ensureSavedWorker(draftToTest);
      await ensureCurrentWorkerVersion(assetId, draftToTest);
      const scenario = scenarioOverride ?? draftToTest.testCases[0]?.scenario ?? `Perform a bounded test of this Job Contract: ${draftToTest.jobContract}`;
      const expected = expectedOverride ?? draftToTest.testCases[0]?.expected ?? 'Produce an evidence-backed result while respecting anti-jobs and no financial authority.';
      const result = await testCreatorWorker(assetId, scenario, expected);
      setTestJobId(result.jobId);
      setStep('runtime-test-launched');
      addBuilderMessage(`A real sandbox Job has been queued for **${draftToTest.name}** using the saved creator Worker version.

Open the Job to inspect routing, evidence and the actual result. Passing this test does not self-certify safety. Creator tests never grant financial authority.`);
    } catch (value) {
      setStep(savedAssetId ? 'editing' : 'initial-response');
      addBuilderMessage(value instanceof Error ? `Could not start creator test: ${value.message}` : 'Could not start creator test.');
    }
  }

  function handleUsePrivately() {
    if (!state.user) {
      dispatch({
        type: 'SET_IDENTITY_CHECKPOINT',
        checkpoint: {
          reason: 'save-worker',
          feature: 'save and use your Worker privately',
          onComplete: (user) => { dispatch({ type: 'SET_USER', user }); void finalizePrivate(); },
        },
      });
    } else {
      void finalizePrivate();
    }
  }

  async function finalizePrivate(draftToSave:WorkerDraftData=draft) {
    setIsStreaming(true);
    try {
      const assetId = await ensureSavedWorker(draftToSave);
      await ensureCurrentWorkerVersion(assetId, draftToSave);
      await publishCreatorAsset('worker', assetId, 'private');
      const worker = await installDurableWorker(assetId);
      if (state.workers.some((item) => item.id === worker.id)) dispatch({ type: 'UPDATE_WORKER', workerId: worker.id, updates: worker });
      else dispatch({ type: 'ADD_WORKER', worker, persisted: true });
      dispatch({ type: 'UPDATE_CREATOR_ASSET', assetId, updates: { visibility: 'private' } });
      setStep('private-saved');
      addBuilderMessage(`**${draftToSave.name}** is saved privately and added to your Workers.

Authority: ${draftToSave.authorityDefault}.

The installed Worker is pinned to this exact version until you explicitly update it. Saving privately does **not** end Agent Builder — you can test it, keep editing it, open it in Workers, or publish it later.`);
    } catch (value) {
      addBuilderMessage(value instanceof Error ? `Could not save Worker: ${value.message}` : 'Could not save Worker.');
    }
  }

  async function handlePublish(draftToPublish:WorkerDraftData=draft) {
    setIsStreaming(true);
    try {
      const assetId = await ensureSavedWorker(draftToPublish);
      await ensureCurrentWorkerVersion(assetId, draftToPublish);
      await publishCreatorAsset('worker', assetId, 'published');
      dispatch({ type: 'UPDATE_CREATOR_ASSET', assetId, updates: { visibility: 'public' } });
      setStep('public-saved');
      addBuilderMessage(`**${draftToPublish.name}** is now public in Discover. Publication changes visibility only; it does not grant end-user wallet authority, and Discover shows runtime readiness separately from publication status.

You can keep editing or testing this Worker from Agent Builder.`);
    } catch (value) {
      addBuilderMessage(value instanceof Error ? `Publishing failed: ${value.message}` : 'Publishing failed.');
    }
  }

  function closeSurface() {
    if (input.trim() && !window.confirm('You have unsent Builder instructions. Leave without sending or copying them?')) return;
    dispatch({ type: 'SET_CREATOR_SURFACE', surface: null });
  }

  function openWorker() {
    dispatch({ type: 'SET_CREATOR_SURFACE', surface: null });
    dispatch({ type: 'SET_VIEW', view: 'workers' });
  }

  function giveCreatedWorkerWork() {
    if (!savedAssetId || !state.workers.some((worker) => worker.id === savedAssetId)) return;
    // Open a durable Worker conversation. Never auto-submit a paid task or
    // turn publication into financial authority.
    dispatch({ type: 'SET_ACTIVE_WORKER', id: savedAssetId });
  }

  async function copyCompleteInput() {
    try {
      await navigator.clipboard.writeText(input);
      setComposerNotice('The full unsent text was copied. It has not been submitted or saved as Worker expertise.');
    } catch {
      setComposerNotice('Copy was blocked by your browser. The full text is still in the editor; select and copy it manually.');
      composerRef.current?.focus();
    }
  }

  function stageSuggestion(suggestion: string) {
    const prepared = appendBuilderSuggestion(input, suggestion, CREATOR_BUILDER_MESSAGE_LIMIT);
    if (!prepared.fits) {
      setComposerNotice('Your unsent instructions are preserved. This combination exceeds the current per-message limit; review the input before adding another template.');
      return;
    }
    setInput(prepared.text);
    setComposerNotice('Review the suggested text, then send it when you are ready. Nothing has been applied.');
    setShowTemplateLibrary(false);
    composerRef.current?.focus();
  }

  function stageTemplate(starter: (typeof WORKER_CREATION_STARTERS)[number]) {
    setTeachMode(false);
    if (savedAssetId) setStep('editing');
    stageSuggestion(builderTemplateInstruction(starter, Boolean(savedAssetId)));
  }

  function startTeaching() {
    setTeachMode(true);
    setStep('teach-prompt');
    setComposerNotice('Teach a rule, share an example or describe an exception. You can switch back to editing in the very next message.');
    composerRef.current?.focus();
  }

  function retrySavingSession() {
    if (!savedAssetId || isStreaming) return;
    const saveSequence = ++saveSequenceRef.current;
    setSaveStatus('saving');
    const snapshot={step,teachMode,...(testJobId?{testJobId}:{}),draft,messages};
    saveQueueRef.current=saveQueueRef.current.catch(()=>undefined).then(async()=>{
      await saveCreatorBuilderSession(savedAssetId,snapshot);
      if (saveSequence === saveSequenceRef.current) setSaveStatus('saved');
    }).catch((error)=>{
      console.error('Could not save conversation',error);
      if (saveSequence === saveSequenceRef.current) setSaveStatus('error');
    });
  }

  function choose(label: string, action: () => void) {
    if (isStreaming) return;
    addUserChoice(label);
    action();
  }

  const latestBuilderMessageId = [...messages].reverse().find((message) => message.role === 'builder' && message.content.trim())?.id;
  const canSend = builderInputProblem(input, Boolean(savedAssetId), CREATOR_BUILDER_MESSAGE_LIMIT) === null && !isStreaming && step !== 'testing' && sessionReady;

  function actionButtonsFor(messageId: string) {
    if (messageId !== latestBuilderMessageId || isStreaming || !sessionReady) return null;
    if (failedBuilderTurn) return (
      <div className="flex flex-wrap gap-2 pt-2">
        <button onClick={() => void processBuilderTurn(failedBuilderTurn.text, false, failedBuilderTurn.mode)} className="px-4 py-2 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors">Retry this {failedBuilderTurn.mode === 'teach' ? 'teaching' : 'editing'} turn</button>
        <span className="text-xs text-text-muted self-center">The saved Worker draft remains unchanged if interpretation fails. Retrying may use AI credits.</span>
      </div>
    );
    if (step === 'initial-response' && failedInitialBrief) return (
      <div className="flex flex-wrap gap-2 pt-2">
        <button onClick={() => void processBuilderTurn(failedInitialBrief, true)} className="px-4 py-2 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors">Retry interpreting my brief</button>
        <button onClick={() => choose('Teach unique expertise', handleTeachExpertise)} className="px-4 py-2 text-xs font-medium border border-border text-text-sub rounded-lg hover:bg-panel-raised transition-colors">Teach in smaller steps</button>
      </div>
    );
    if (step === 'initial-response') return (
      <div className="flex flex-wrap gap-2 pt-2">
        <button onClick={() => choose('Use existing expertise', handleUseExistingExpertise)} className="px-4 py-2 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors">Use existing expertise</button>
        <button onClick={() => choose('Teach unique expertise', handleTeachExpertise)} className="px-4 py-2 text-xs font-medium border border-border text-text-sub rounded-lg hover:bg-panel-raised transition-colors">Teach unique expertise</button>
      </div>
    );
    if (step === 'collaborators-added') return (
      <div className="flex flex-wrap gap-2 pt-2">
        <button onClick={() => choose('Teach unique expertise', handleTeachExpertise)} className="px-4 py-2 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors">Teach unique expertise</button>
        <button onClick={() => choose('Test Worker', handleLooksRight)} className="px-4 py-2 text-xs font-medium border border-border text-text-sub rounded-lg hover:bg-panel-raised transition-colors">Test Worker</button>
      </div>
    );
    if (step === 'teach-response') return (
      <div className="flex flex-wrap gap-2 pt-2">
        <button onClick={() => choose('Looks right — Test Worker', handleLooksRight)} className="px-4 py-2 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors">Looks right — Test Worker</button>
        <button onClick={() => choose('Continue teaching', handleContinueTeaching)} className="px-4 py-2 text-xs font-medium border border-border text-text-sub rounded-lg hover:bg-panel-raised transition-colors">Continue teaching</button>
      </div>
    );
    if (step === 'runtime-test-launched') return (
      <div className="flex flex-wrap gap-2 pt-2">
        {testJobId && <button onClick={() => dispatch({ type: 'SET_ACTIVE_JOB', id: testJobId })} className="px-3 py-1.5 text-xs bg-primary text-white rounded">Open real test Job</button>}
        <button onClick={() => choose('Use privately', handleUsePrivately)} className="px-3 py-1.5 text-xs border border-border text-text-sub rounded">Use privately</button>
        <button onClick={() => choose('Continue editing', handleContinueEditing)} className="px-3 py-1.5 text-xs border border-border text-text-sub rounded">Continue editing</button>
      </div>
    );
    if (step === 'editing') return (
      <div className="flex flex-wrap gap-2 pt-2">
        <button onClick={() => choose('Test Worker', handleLooksRight)} className="px-4 py-2 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors">Test Worker</button>
        <button onClick={() => choose('Use privately', handleUsePrivately)} className="px-4 py-2 text-xs font-medium border border-border text-text-sub rounded-lg hover:bg-panel-raised transition-colors">Use privately</button>
        <button onClick={() => choose('Continue editing', handleContinueEditing)} className="px-4 py-2 text-xs font-medium border border-border text-text-sub rounded-lg hover:bg-panel-raised transition-colors">Continue editing</button>
      </div>
    );
    if (step === 'private-saved') return (
      <div className="flex flex-wrap gap-2 pt-2">
        {savedAssetId && state.workers.some((worker) => worker.id === savedAssetId) && (
          <button onClick={giveCreatedWorkerWork} className="px-4 py-2 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors">Give work →</button>
        )}
        <button onClick={() => choose('Test Worker', handleLooksRight)} className="px-4 py-2 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors">Test Worker</button>
        <button onClick={() => choose('Continue editing', handleContinueEditing)} className="px-4 py-2 text-xs font-medium border border-border text-text-sub rounded-lg hover:bg-panel-raised transition-colors">Continue editing</button>
        <button onClick={openWorker} className="px-4 py-2 text-xs font-medium border border-border text-text-sub rounded-lg hover:bg-panel-raised transition-colors">Open in Workers</button>
        <button onClick={() => choose('Publish publicly', () => { void handlePublish(); })} className="px-4 py-2 text-xs font-medium border border-border text-text-sub rounded-lg hover:bg-panel-raised transition-colors">Publish publicly</button>
      </div>
    );
    if (step === 'public-saved') return (
      <div className="flex flex-wrap gap-2 pt-2">
        <button onClick={() => choose('Test Worker', handleLooksRight)} className="px-4 py-2 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors">Test Worker</button>
        <button onClick={() => choose('Continue editing', handleContinueEditing)} className="px-4 py-2 text-xs font-medium border border-border text-text-sub rounded-lg hover:bg-panel-raised transition-colors">Continue editing</button>
        <button onClick={openWorker} className="px-4 py-2 text-xs font-medium border border-border text-text-sub rounded-lg hover:bg-panel-raised transition-colors">Open in Workers</button>
      </div>
    );
    return null;
  }

  const ChatPanel = (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4 border-b border-border shrink-0 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-text">Agent Builder</p>
          <p className="text-xs text-text-muted">One conversation · describe, teach, adapt or refine anytime</p>
          <p className={`text-[11px] mt-0.5 ${saveStatus==='error'?'text-danger':'text-text-dim'}`} aria-live="polite">
            {input.trim() ? 'Unsent input — not saved yet' : saveStatus==='error' ? 'Could not save conversation — retry' : saveStatus==='saving' ? 'Saving conversation…' : saveStatus==='saved' ? 'Conversation saved' : savedAssetId ? 'Draft not yet synchronized' : 'A private draft is created only when you send your first message'}
          </p>
        </div>
        {saveStatus==='error' && savedAssetId && <button type="button" onClick={retrySavingSession} className="text-xs text-danger border border-danger/30 rounded px-2 py-1">Retry save</button>}
        <button onClick={closeSurface} className="text-text-muted hover:text-text p-1 rounded transition-colors" aria-label="Close Builder">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div ref={messageScrollRef} data-workspace-scroll className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3">
        {!sessionReady && <div className="py-8 text-center"><p className="text-sm text-text-muted">Restoring Builder conversation…</p></div>}
        {sessionReady && step === 'idle' && messages.length === 0 && !savedAssetId && (
          <div className="max-w-2xl mx-auto w-full space-y-4">
            <div className="rounded-2xl bg-panel-raised border border-border px-4 py-4 text-text-sub text-sm leading-relaxed">
              <p className="text-base font-semibold text-text mb-1">What would you like your Worker to do?</p>
              Tell me naturally. You can start with one sentence, use a template, paste a detailed brief, or teach your method over time. All of it belongs to the same private Builder conversation.
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => stageSuggestion('I want a read-only Worker that researches a topic, verifies sources, and explains its findings. Help me define its responsibilities and ask what else I need.')} className="px-3 py-2 text-xs border border-border rounded-lg hover:bg-panel-raised">Start with a description</button>
              <button type="button" onClick={() => setShowTemplateLibrary((value)=>!value)} aria-expanded={showTemplateLibrary} className="px-3 py-2 text-xs border border-border rounded-lg hover:bg-panel-raised">Browse templates</button>
              <button type="button" onClick={() => stageSuggestion('I want to turn my own expertise into a private Worker. Ask me about my approach, examples, exceptions and decision rules.')} className="px-3 py-2 text-xs border border-border rounded-lg hover:bg-panel-raised">Teach my expertise</button>
            </div>
            <button type="button" className="text-xs text-text-muted underline underline-offset-2" onClick={() => setShowDetailedSetup((value)=>!value)} aria-expanded={showDetailedSetup}>Detailed setup (optional)</button>
            {showDetailedSetup && <WorkerCreateStart onStart={submitBuilderBrief} disabled={isStreaming} />}
          </div>
        )}
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[85%]">
              {message.role === 'user' ? (
                <CreatorUserMessage content={message.content} />
              ) : (
                <div className="rounded-xl px-4 py-3 text-sm leading-relaxed bg-panel-raised border border-border text-text-sub rounded-bl-sm">
                  <ResearchMarkdown text={message.content} />
                </div>
              )}
              {message.role === 'builder' && actionButtonsFor(message.id)}
            </div>
          </div>
        ))}
        {showTemplateLibrary && (
          <div className="max-w-2xl w-full mx-auto border border-border rounded-xl bg-panel p-3" role="group" aria-label="Editable Worker templates">
            <p className="text-xs font-semibold text-text mb-1">Choose an editable starting point</p>
            <p className="text-xs text-text-muted mb-3">Choosing fills your message for review. It does not replace an existing Worker, connect a tool, or send an AI request.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {WORKER_CREATION_STARTERS.map((starter) => (
                <button type="button" key={starter.id} onClick={() => stageTemplate(starter)} className="rounded-lg border border-border-dim hover:bg-panel-raised text-left p-3">
                  <span className="block text-xs font-semibold text-text">{starter.name}</span>
                  <span className="block text-[11px] text-text-muted mt-1">{starter.description}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {sessionReady && (
        <div className="px-5 py-3 border-t border-border shrink-0">
          {(messages.length > 0 || savedAssetId) && (
            <div className="flex flex-wrap gap-2 mb-2" aria-label="Builder conversation shortcuts">
              <button type="button" onClick={() => setShowTemplateLibrary((value)=>!value)} className="px-2 py-1 text-xs border border-border-dim rounded-lg hover:bg-panel-raised" aria-expanded={showTemplateLibrary}>Browse templates</button>
              <button type="button" onClick={startTeaching} className="px-2 py-1 text-xs border border-border-dim rounded-lg hover:bg-panel-raised">Teach a rule</button>
              <button type="button" onClick={() => { setTeachMode(false); setStep('editing'); setComposerNotice('Tell me what you want to add, remove, combine, or replace.'); composerRef.current?.focus(); }} className="px-2 py-1 text-xs border border-border-dim rounded-lg hover:bg-panel-raised">Edit or combine</button>
              <button type="button" onClick={() => setMobileTab('draft')} className="md:hidden px-2 py-1 text-xs border border-border-dim rounded-lg">Review draft</button>
            </div>
          )}
          <div className="flex gap-2">
            <textarea
              ref={composerRef}
              rows={2}
              aria-label="Worker Builder instructions"
              aria-describedby="creator-builder-input-limit"
              className="flex-1 min-w-0 max-h-48 resize-y bg-panel-raised border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-primary/50 disabled:opacity-50"
              placeholder={savedAssetId ? 'Describe, teach a rule, adapt a template, or change the draft…' : 'Describe the Worker you want to create…'}
              value={input}
              disabled={!sessionReady || step === 'testing'}
              onChange={(event) => { setInput(event.target.value); setComposerNotice(''); }}
              onKeyDown={(event) => { if(event.key === 'Enter' && !event.shiftKey){ event.preventDefault(); handleSend(); } }}
            />
            <button onClick={handleSend} disabled={!canSend} className="px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-40 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            </button>
          </div>
          <p id="creator-builder-input-limit" role={input.length > CREATOR_BUILDER_MESSAGE_LIMIT ? 'alert' : undefined} className={`mt-2 text-xs ${input.length > CREATOR_BUILDER_MESSAGE_LIMIT ? 'text-red-400' : 'text-text-dim'}`}>
            {input.length.toLocaleString()} / {CREATOR_BUILDER_MESSAGE_LIMIT.toLocaleString()} characters · Shift+Enter for a new line.
            {input.length > CREATOR_BUILDER_MESSAGE_LIMIT ? ' Your text has not been cut or sent. The current release cannot store it as a private source; keep editing or copy the full text before leaving.' : input.length > 4000 ? ' Detailed instructions are welcome; the current per-message limit still applies.' : ''}
          </p>
          {input.length > CREATOR_BUILDER_MESSAGE_LIMIT && (
            <button type="button" onClick={() => { void copyCompleteInput(); }} className="mt-2 px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-panel-raised">Copy full unsent text</button>
          )}
          {composerNotice && <p role="status" className="mt-1 text-xs text-text-muted">{composerNotice}</p>}
        </div>
      )}
    </div>
  );

  const DraftPanelContent = <LiveDraftPanel draft={draft} step={step} testJobId={testJobId} />;

  return (
    <div className="h-full min-h-0 flex flex-col bg-bg overflow-hidden">
      <div className="md:hidden flex border-b border-border shrink-0">
        {(['chat', 'draft'] as const).map((tab) => (
          <button key={tab} onClick={() => setMobileTab(tab)} className={`flex-1 py-2.5 text-sm font-medium border-b-2 transition-colors ${mobileTab === tab ? 'border-primary text-text' : 'border-transparent text-text-sub'}`}>
            {tab === 'chat' ? 'Chat' : 'Draft'}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-hidden flex">
        <div className={`${mobileTab === 'chat' ? 'flex' : 'hidden'} md:flex flex-col md:w-[55%] border-r border-border`}>{ChatPanel}</div>
        <div className={`${mobileTab === 'draft' ? 'flex' : 'hidden'} md:flex flex-col md:flex-1 bg-panel`}>{DraftPanelContent}</div>
      </div>
    </div>
  );
}
