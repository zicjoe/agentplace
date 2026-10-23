import { useState, useRef, useEffect } from 'react';
import { useAppState, useDispatch, uid } from '../state/AppContext';
import { createCreatorWorkflow, createCreatorWorkflowVersion, interpretCreatorWorkflowTurn, publishCreatorAsset } from '../platform/creatorApi';
import type { WorkflowDraftData } from '../state/types';
import { ResearchMarkdown } from './ResearchMarkdown';
import { scrollConversationToEnd } from '../platform/scroll';



interface StudioMessage {
  id: string;
  role: 'user' | 'studio';
  content: string;
}

type StudioStep = 'idle' | 'draft-formed' | 'tested' | 'saved';

function DraftPane({ draft }: { draft: WorkflowDraftData }) {
  if (!draft.name) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-xs text-text-dim px-6 text-center">Workflow Draft appears here as you describe it.</p>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto overscroll-contain">
      <div className="px-4 py-3 border-b border-border-dim">
        <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-0.5">Workflow Draft</p>
        <p className="text-sm font-semibold text-text">{draft.name}</p>
      </div>
      <div className="divide-y divide-border-dim">
        {[
          { label: 'Purpose', content: draft.purpose },
          { label: 'Inputs', list: draft.inputs },
          { label: 'Steps', list: draft.steps, numbered: true },
          { label: 'Conditions', list: draft.conditions },
          { label: 'Outputs', list: draft.outputs },
          { label: 'Required capabilities', list: draft.requiredCapabilities },
          { label: 'Safety boundaries', list: draft.safetyBoundaries },
          { label: 'Compatible workers', list: draft.compatibleWorkers },
          { label: 'Pricing', content: draft.pricing.type === 'free' ? 'Free' : draft.pricing.label ?? 'Paid' },
        ].map(({ label, content, list, numbered }) => (
          <div key={label} className="px-4 py-2.5">
            <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-1.5">{label}</p>
            {content && <p className="text-xs text-text-sub leading-relaxed">{content}</p>}
            {list && (
              <ul className="space-y-1">
                {list.map((item, i) => (
                  <li key={item} className="text-xs text-text-sub flex items-start gap-1.5">
                    <span className="text-text-dim shrink-0 mt-0.5">{numbered ? `${i + 1}.` : '·'}</span>
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function WorkflowStudio() {
  const state = useAppState();
  const dispatch = useDispatch();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<StudioMessage[]>([]);
  const existingAsset=state.activeCreationId?(state.creatorAssets??[]).find((asset)=>asset.id===state.activeCreationId):undefined;
  const [draft, setDraft] = useState<WorkflowDraftData>(existingAsset?.workflowDraft??{ name: '', purpose: '', inputs: [], steps: [], conditions: [], outputs: [], requiredCapabilities: [], safetyBoundaries: [], compatibleWorkers: [], pricing: { type: 'free' } });
  const [step, setStep] = useState<StudioStep>(existingAsset?.workflowDraft?.name ? 'draft-formed' : 'idle');
  const [mobileTab, setMobileTab] = useState<'chat' | 'draft'>('chat');
  const messageScrollRef = useRef<HTMLDivElement>(null);
  const [streaming, setStreaming] = useState(false);

  useEffect(() => {
    scrollConversationToEnd(messageScrollRef.current);
  }, [messages]);

  function addMsg(role: 'user' | 'studio', content: string) {
    const id = uid();
    if (role === 'studio') {
      setStreaming(true);
      setMessages((prev) => [...prev, { id, role, content: '' }]);
      setTimeout(() => {
        setMessages((prev) => prev.map((m) => m.id === id ? { ...m, content } : m));
        setStreaming(false);
      }, 700);
    } else {
      setMessages((prev) => [...prev, { id, role, content }]);
    }
  }

  async function handleSend() {
    if (!input.trim() || streaming) return;
    const text = input.trim();
    setInput('');
    addMsg('user', text);
    setStreaming(true);
    try {
      const result = await interpretCreatorWorkflowTurn({ message: text, draft });
      if (result.intent === 'MODIFY_DRAFT') {
        setDraft(result.draft);
        setStep('draft-formed');
        setMobileTab('draft');
      }
      const id = uid();
      setMessages((prev) => [...prev, { id, role: 'studio', content: result.reply }]);
    } catch (value) {
      const id = uid();
      const content = value instanceof Error ? `Could not update Workflow draft: ${value.message}` : 'Could not update Workflow draft.';
      setMessages((prev) => [...prev, { id, role: 'studio', content }]);
    } finally {
      setStreaming(false);
    }
  }


  function handleTest() {
    setStep('tested');
    addMsg('studio','Workflow structure validated. Runtime behavior is still determined by the eligible Worker and capability routes used when a Job executes; this structural check does not self-certify safety.');
  }

  function handleSavePrivately() {
    if (!state.user) {
      dispatch({
        type: 'SET_IDENTITY_CHECKPOINT',
        checkpoint: {
          reason: 'save-workflow',
          feature: 'save your workflow privately',
          onComplete: (user) => {
            dispatch({ type: 'SET_USER', user });
            void doSave();
          },
        },
      });
    } else {
      void doSave();
    }
  }

  async function doSave() {
    try{const asset=existingAsset?.type==='workflow'?await createCreatorWorkflowVersion(existingAsset.id,draft):await createCreatorWorkflow(draft);await publishCreatorAsset('workflow',asset.id,'private');if(existingAsset?.type==='workflow')dispatch({type:'UPDATE_CREATOR_ASSET',assetId:asset.id,updates:{...asset,visibility:'private'}});else dispatch({type:'ADD_CREATOR_ASSET',asset:{...asset,visibility:'private'}});setStep('saved');addMsg('studio',`**${draft.name}** saved privately as version ${asset.version ?? '0.1.0'}. No Worker, Routine, or authority was created.`);}catch(value){addMsg('studio',value instanceof Error?`Could not save Workflow: ${value.message}`:'Could not save Workflow.');}
  }

  function close() {
    dispatch({ type: 'SET_CREATOR_SURFACE', surface: null });
  }

  return (
    <div className="h-full min-h-0 flex flex-col bg-bg overflow-hidden">
      <div className="md:hidden flex border-b border-border shrink-0">
        {(['chat', 'draft'] as const).map((t) => (
          <button key={t} onClick={() => setMobileTab(t)} className={`flex-1 py-2.5 text-sm font-medium border-b-2 transition-colors ${mobileTab === t ? 'border-primary text-text' : 'border-transparent text-text-sub'}`}>
            {t === 'chat' ? 'Chat' : 'Draft'}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-hidden flex">
        <div className={`${mobileTab === 'chat' ? 'flex' : 'hidden'} md:flex flex-col md:w-[55%] border-r border-border`}>
          <div className="px-5 py-4 border-b border-border shrink-0 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-text">Workflow Studio</p>
              <p className="text-xs text-text-muted">Describe a reusable workflow in natural language</p>
            </div>
            <button onClick={close} className="text-text-muted hover:text-text p-1 rounded transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div ref={messageScrollRef} data-workspace-scroll className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3">
            {messages.length === 0 && (
              <div className="py-8 text-center">
                <p className="text-sm text-text-sub mb-1">Describe the workflow you want to build.</p>
                <p className="text-xs text-text-muted">Example: "Create a workflow that gives me a concise morning portfolio brief and only escalates material changes."</p>
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed ${m.role === 'user' ? 'bg-primary text-white rounded-br-sm' : 'bg-panel-raised border border-border text-text-sub rounded-bl-sm'}`}>
                  <ResearchMarkdown text={m.content} />
                </div>
              </div>
            ))}
            {draft.name && !streaming && (
              <div className="md:hidden flex gap-2 pl-1 pt-1">
                <button onClick={() => setMobileTab('draft')} className="px-4 py-2 text-xs font-medium border border-border text-text-sub rounded-lg hover:bg-panel-raised transition-colors">View Workflow Draft</button>
              </div>
            )}
            {step === 'draft-formed' && !streaming && (
              <div className="flex gap-2 pl-1 pt-1">
                <button onClick={handleTest} className="px-4 py-2 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors">Test Workflow</button>
              </div>
            )}
            {step === 'tested' && !streaming && (
              <div className="flex gap-2 pl-1 pt-1">
                <button onClick={handleSavePrivately} className="px-4 py-2 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors">Use privately</button>
                <button disabled title="Save privately first, then publish from My creations." className="px-4 py-2 text-xs font-medium border border-border text-text-dim rounded-lg opacity-60 cursor-not-allowed">Publish after saving</button>
              </div>
            )}
            {step === 'saved' && !streaming && (
              <div className="flex gap-2 pl-1 pt-1">
                <button onClick={() => { close(); dispatch({ type: 'SET_CREATOR_SURFACE', surface: 'creator-home' }); }} className="px-4 py-2 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors">My creations</button>
              </div>
            )}

          </div>
          {step !== 'saved' && (
            <div className="px-5 py-4 border-t border-border shrink-0">
              <div className="flex gap-2">
                <input
                  className="flex-1 bg-panel-raised border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-primary/50"
                  placeholder="Describe your workflow…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleSend(); }}
                />
                <button onClick={() => { void handleSend(); }} disabled={!input.trim() || streaming} className="px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-40 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
        <div className={`${mobileTab === 'draft' ? 'flex' : 'hidden'} md:flex flex-col md:flex-1 bg-panel`}>
          <DraftPane draft={draft} />
        </div>
      </div>
    </div>
  );
}
