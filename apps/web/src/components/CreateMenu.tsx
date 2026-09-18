import { useAppState, useDispatch } from '../state/AppContext';

const CREATE_OPTIONS = [
  {
    id: 'worker',
    label: 'Worker',
    description: 'Build a persistent specialist with a defined mandate, capabilities, and authority defaults.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="9" cy="7" r="3" strokeWidth={1.8} />
        <path strokeLinecap="round" strokeWidth={1.8} d="M3 20a6 6 0 0112 0" />
        <path strokeLinecap="round" strokeWidth={1.8} d="M16 11l2 2 4-4" />
      </svg>
    ),
  },
  {
    id: 'workflow',
    label: 'Workflow',
    description: 'Create a reusable method or process that any compatible Worker can follow.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="7" rx="1" strokeWidth={1.8} />
        <rect x="14" y="3" width="7" height="7" rx="1" strokeWidth={1.8} />
        <rect x="3" y="14" width="7" height="7" rx="1" strokeWidth={1.8} />
        <path strokeLinecap="round" strokeWidth={1.8} d="M17.5 14v7M14 17.5h7" />
      </svg>
    ),
  },
  {
    id: 'capability',
    label: 'Capability',
    description: 'Connect a tool or API so Workers can use it. Supports MCP and OpenAPI import.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10 20l4-16M7 4L3 12l4 8M17 4l4 8-4 8" />
      </svg>
    ),
  },
] as const;

export function CreateMenu() {
  const state = useAppState();
  const dispatch = useDispatch();

  const hasCreations = (state.creatorAssets ?? []).length > 0;

  function close() {
    dispatch({ type: 'SET_SHOW_CREATE', show: false });
  }

  function handleSelect(id: string) {
    close();
    if (id === 'worker') {
      dispatch({ type: 'SET_CREATOR_SURFACE', surface: 'agent-builder' });
      dispatch({ type: 'SET_ACTIVE_CREATION', id: null });
    } else if (id === 'workflow') {
      dispatch({ type: 'SET_CREATOR_SURFACE', surface: 'workflow-studio' });
      dispatch({ type: 'SET_ACTIVE_CREATION', id: null });
    } else if (id === 'capability') {
      dispatch({ type: 'SET_CREATOR_SURFACE', surface: 'capability-studio' });
      dispatch({ type: 'SET_ACTIVE_CREATION', id: null });
    } else if (id === 'my-creations') {
      dispatch({ type: 'SET_CREATOR_SURFACE', surface: 'creator-home' });
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="w-full max-w-sm bg-panel border border-border rounded-xl shadow-2xl">
        <div className="px-5 pt-5 pb-4 border-b border-border-dim flex items-center justify-between">
          <h2 className="text-base font-semibold text-text">Create</h2>
          <button onClick={close} className="text-text-muted hover:text-text p-1 rounded transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-1">
          <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-2">New</p>
          {CREATE_OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() => handleSelect(option.id)}
              className="w-full flex items-start gap-4 px-4 py-3.5 rounded-lg border border-border hover:border-border hover:bg-panel-raised text-left transition-colors group"
            >
              <div className="text-text-muted group-hover:text-primary transition-colors shrink-0 mt-0.5">
                {option.icon}
              </div>
              <div>
                <p className="text-sm font-semibold text-text mb-0.5">{option.label}</p>
                <p className="text-xs text-text-sub leading-relaxed">{option.description}</p>
              </div>
            </button>
          ))}
        </div>

        {hasCreations && (
          <div className="px-5 pb-4 space-y-1">
            <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-2">Manage</p>
            <button
              onClick={() => handleSelect('my-creations')}
              className="w-full flex items-start gap-4 px-4 py-3 rounded-lg border border-border hover:bg-panel-raised text-left transition-colors"
            >
              <div className="text-text-muted mt-0.5">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-text mb-0.5">My creations</p>
                <p className="text-xs text-text-sub leading-relaxed">
                  {(state.creatorAssets ?? []).length} creation{(state.creatorAssets ?? []).length === 1 ? '' : 's'}
                </p>
              </div>
            </button>
          </div>
        )}

        <div className="border-t border-border-dim px-5 py-3">
          <p className="text-xs text-text-muted text-center">
            Creating a Worker, Workflow, or Capability never grants it execution authority.
          </p>
        </div>
      </div>
    </div>
  );
}
