import { useState, useRef, useEffect } from 'react';
import { useAppState, useDispatch, uid } from '../state/AppContext';
import { ResearchMarkdown } from './ResearchMarkdown';
import { scrollConversationToEnd } from '../platform/scroll';
import type { WorkerDraftData, CollaboratorConfig } from '../state/types';
import { createCreatorWorker, createCreatorWorkerVersion, fetchCreatorBuilderSession, interpretCreatorBuilderTurn, publishCreatorAsset, saveCreatorBuilderSession, testCreatorWorker, type CreatorBuilderTurnResult } from '../platform/creatorApi';
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

function seedDraftForBuilder(text:string):WorkerDraftData {
  return {
    ...EMPTY_DRAFT,
    name:'Untitled Creator Worker',
    jobContract:text,
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
  const [mobileTab, setMobileTab] = useState<'chat' | 'draft'>('chat');
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionReady, setSessionReady] = useState(!state.activeCreationId);
  const messageScrollRef = useRef<HTMLDivElement>(null);
  const assetCreationPromiseRef = useRef<Promise<string> | null>(null);
  const saveQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const lastPersistedDraftSignatureRef = useRef(initialAsset?.workerDraft ? draftSignature(initialAsset.workerDraft) : '');

  useEffect(() => {
    scrollConversationToEnd(messageScrollRef.current);
  }, [messages]);

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
      } else {
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
    const timer = window.setTimeout(() => {
      const snapshot = { step, teachMode, ...(testJobId ? { testJobId } : {}), draft, messages };
      saveQueueRef.current = saveQueueRef.current
        .catch(() => undefined)
        .then(() => saveCreatorBuilderSession(savedAssetId, snapshot))
        .catch((error) => { console.error('Could not persist Agent Builder conversation', error); });
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
      updates: { workerDraft: asset.workerDraft, version: asset.version, visibility: asset.visibility },
    });
  }

  function handleSend() {
    if (!input.trim() || isStreaming || step === 'testing' || !sessionReady) return;
    const text = input.trim();
    setInput('');
    const userMessage:BuilderMessage={ id: uid(), role: 'user', content: text };
    setMessages((prev) => [...prev, userMessage]);
    if (!state.user) {
      dispatch({
        type:'SET_IDENTITY_CHECKPOINT',
        checkpoint:{
          reason:'creator-builder',
          feature:'use Agent Builder intelligence and keep your Worker draft durable',
          onComplete:(user)=>{ dispatch({type:'SET_USER',user}); void processBuilderTurn(text); },
        },
      });
      return;
    }
    void processBuilderTurn(text);
  }

  async function processBuilderTurn(text:string) {
    const mode:'build'|'edit'|'teach'=step==='idle'?'build':(teachMode||step==='teach-prompt')?'teach':'edit';
    const baseDraft=step==='idle'?seedDraftForBuilder(text):draft;
    if(step==='idle'){
      setDraft(baseDraft);
      setTeachMode(false);
      setStep('initial-response');
    }
    setIsStreaming(true);
    try {
      const assetId=await ensureSavedWorker(baseDraft);
      const result:CreatorBuilderTurnResult=await interpretCreatorBuilderTurn(assetId,{message:text,mode,draft:baseDraft,messages});
      setDraft(result.draft);
      const intent=result.intent;
      if(intent==='TEACH'){
        setTeachMode(true);
        setStep('teach-response');
      }else{
        setTeachMode(false);
        if(intent==='USE_EXISTING_EXPERTISE')setStep('collaborators-added');
        else if(mode==='build'&&intent!=='TEST'&&intent!=='SAVE_PRIVATE'&&intent!=='PUBLISH')setStep('initial-response');
        else setStep('editing');
      }
      addBuilderMessage(result.reply);
      if(intent==='TEST'){
        await runTests(result.draft,result.testScenario||undefined,result.testExpected||undefined);
      }else if(intent==='SAVE_PRIVATE'){
        await finalizePrivate(result.draft);
      }else if(intent==='PUBLISH'){
        await handlePublish(result.draft);
      }
    } catch(value) {
      setIsStreaming(false);
      const detail=value instanceof Error?value.message:'Agent Builder intelligence is temporarily unavailable.';
      addBuilderMessage(step==='idle'
        ? `Agent Builder intelligence could not interpret that turn yet: ${detail}\n\nI kept only a minimal draft seed. Nothing was published, tested, or granted authority.`
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
      dispatch({ type: 'ADD_WORKER', worker });
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
    dispatch({ type: 'SET_CREATOR_SURFACE', surface: null });
  }

  function openWorker() {
    dispatch({ type: 'SET_CREATOR_SURFACE', surface: null });
    dispatch({ type: 'SET_VIEW', view: 'workers' });
  }

  function choose(label: string, action: () => void) {
    if (isStreaming) return;
    addUserChoice(label);
    action();
  }

  const latestBuilderMessageId = [...messages].reverse().find((message) => message.role === 'builder' && message.content.trim())?.id;
  const canSend = input.trim().length > 0 && !isStreaming && step !== 'testing' && sessionReady;

  function actionButtonsFor(messageId: string) {
    if (messageId !== latestBuilderMessageId || isStreaming || !sessionReady) return null;
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
          <p className="text-xs text-text-muted">{teachMode ? 'Teach Mode active · AgentPlace Auto' : savedAssetId ? 'AgentPlace Auto · structured conversational editing' : 'AgentPlace Auto · design your Worker conversationally'}</p>
        </div>
        <button onClick={closeSurface} className="text-text-muted hover:text-text p-1 rounded transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div ref={messageScrollRef} data-workspace-scroll className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3">
        {!sessionReady && <div className="py-8 text-center"><p className="text-sm text-text-muted">Restoring Builder conversation…</p></div>}
        {sessionReady && messages.length === 0 && (
          <div className="py-8 text-center">
            <p className="text-sm text-text-sub mb-1">Describe the Worker you want to build.</p>
            <p className="text-xs text-text-muted">Agent Builder will form a Live Draft as you talk.</p>
          </div>
        )}
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[85%]">
              <div className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${message.role === 'user' ? 'bg-primary text-white rounded-br-sm' : 'bg-panel-raised border border-border text-text-sub rounded-bl-sm'}`}>
                <ResearchMarkdown text={message.content} />
              </div>
              {message.role === 'builder' && actionButtonsFor(message.id)}
            </div>
          </div>
        ))}
      </div>

      <div className="px-5 py-4 border-t border-border shrink-0">
        {step === 'idle' && <p className="text-xs text-text-dim mb-2">Example: "Build me a whale-driven meme scout."</p>}
        <div className="flex gap-2">
          <input
            className="flex-1 bg-panel-raised border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-primary/50 disabled:opacity-50"
            placeholder={teachMode ? 'Describe your criteria…' : savedAssetId ? 'Describe what you want to change or add…' : 'Describe what you want to build…'}
            value={input}
            disabled={!sessionReady || step === 'testing'}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && !event.shiftKey && handleSend()}
          />
          <button onClick={handleSend} disabled={!canSend} className="px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-40 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
          </button>
        </div>
      </div>
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
