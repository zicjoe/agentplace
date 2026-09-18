import { useState, useRef, useEffect } from 'react';
import { useAppState, useDispatch, uid } from '../state/AppContext';
import type { CreatorAsset, WorkflowDraftData } from '../state/types';

const MORNING_BRIEF_DRAFT: WorkflowDraftData = {
  name: 'Morning Portfolio Brief',
  purpose: 'Summarise material overnight changes across watched holdings.',
  inputs: ['Portfolio / watch addresses', 'Prior baseline', 'Relevant market / onchain data'],
  steps: [
    'Read portfolio state',
    'Compare against baseline',
    'Identify material changes',
    'Summarise evidence',
  ],
  conditions: ['Only escalate changes above configured materiality threshold'],
  outputs: ['Concise morning briefing'],
  requiredCapabilities: ['Wallet reads', 'Market data', 'Relevant onchain data'],
  safetyBoundaries: ['Read-only by default', 'No financial execution'],
  compatibleWorkers: ['Portfolio Guardian'],
  pricing: { type: 'free' },
};

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
    <div className="h-full overflow-y-auto">
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
  const [draft, setDraft] = useState<WorkflowDraftData>({ name: '', purpose: '', inputs: [], steps: [], conditions: [], outputs: [], requiredCapabilities: [], safetyBoundaries: [], compatibleWorkers: [], pricing: { type: 'free' } });
  const [step, setStep] = useState<StudioStep>('idle');
  const [mobileTab, setMobileTab] = useState<'chat' | 'draft'>('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [streaming, setStreaming] = useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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

  function handleSend() {
    if (!input.trim() || streaming) return;
    const text = input.trim();
    setInput('');
    addMsg('user', text);

    if (step === 'idle') {
      setDraft(MORNING_BRIEF_DRAFT);
      setStep('draft-formed');
      setTimeout(() => {
        addMsg('studio', "I've formed **Morning Portfolio Brief** — a read-only workflow that summarises material overnight changes and only escalates above your materiality threshold.\n\nDraft is ready on the right. Would you like to test it or adjust anything?");
      }, 400);
    }
  }

  function handleTest() {
    addMsg('studio', 'Running acceptance test…');
    setTimeout(() => {
      setStep('tested');
      addMsg('studio', '**2 / 2 prototype scenarios passed.**\n\nTest 1: Read portfolio state and compare against baseline — ✓ Correct output structure.\nTest 2: Materiality threshold correctly suppressed low-signal items — ✓ Only material changes escalated.\n\nReady to save privately or publish?');
    }, 1600);
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
            doSave();
          },
        },
      });
    } else {
      doSave();
    }
  }

  function doSave() {
    const asset: CreatorAsset = {
      id: uid(),
      type: 'workflow',
      visibility: 'private',
      createdAt: new Date(),
      updatedAt: new Date(),
      workflowDraft: draft,
    };
    dispatch({ type: 'ADD_CREATOR_ASSET', asset });
    setStep('saved');
    addMsg('studio', 'Morning Portfolio Brief saved privately. Find it in Create → My creations.\n\nNo Worker was created. No Routine was created. No authority was granted.');
  }

  function close() {
    dispatch({ type: 'SET_CREATOR_SURFACE', surface: null });
  }

  return (
    <div className="h-full flex flex-col bg-bg overflow-hidden">
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
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {messages.length === 0 && (
              <div className="py-8 text-center">
                <p className="text-sm text-text-sub mb-1">Describe the workflow you want to build.</p>
                <p className="text-xs text-text-muted">Example: "Create a workflow that gives me a concise morning portfolio brief and only escalates material changes."</p>
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed ${m.role === 'user' ? 'bg-primary text-white rounded-br-sm' : 'bg-panel-raised border border-border text-text-sub rounded-bl-sm'}`}>
                  {m.content.split('\n').map((line, i) => {
                    const bold = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
                    return <p key={i} className={i > 0 ? 'mt-1' : ''} dangerouslySetInnerHTML={{ __html: bold }} />;
                  })}
                </div>
              </div>
            ))}
            {step === 'draft-formed' && !streaming && (
              <div className="flex gap-2 pl-1 pt-1">
                <button onClick={handleTest} className="px-4 py-2 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors">Test Workflow</button>
              </div>
            )}
            {step === 'tested' && !streaming && (
              <div className="flex gap-2 pl-1 pt-1">
                <button onClick={handleSavePrivately} className="px-4 py-2 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors">Use privately</button>
                <button className="px-4 py-2 text-xs font-medium border border-border text-text-sub rounded-lg hover:bg-panel-raised transition-colors">Publish</button>
              </div>
            )}
            {step === 'saved' && !streaming && (
              <div className="flex gap-2 pl-1 pt-1">
                <button onClick={() => { close(); dispatch({ type: 'SET_CREATOR_SURFACE', surface: 'creator-home' }); }} className="px-4 py-2 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors">My creations</button>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          {step !== 'saved' && (
            <div className="px-5 py-4 border-t border-border shrink-0">
              <div className="flex gap-2">
                <input
                  className="flex-1 bg-panel-raised border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-primary/50"
                  placeholder="Describe your workflow…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                />
                <button onClick={handleSend} disabled={!input.trim() || streaming} className="px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-40 transition-colors">
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
