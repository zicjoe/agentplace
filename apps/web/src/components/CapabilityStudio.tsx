import { useState } from 'react';
import { useAppState, useDispatch, uid } from '../state/AppContext';
import type { CreatorAsset, CapabilityDraftData, CapabilityOperation } from '../state/types';

type ImportType = 'mcp' | 'openapi';
type StudioStep = 'choose' | 'configure' | 'discovered' | 'tested' | 'saved';

const MCP_DISCOVERED_OPS: CapabilityOperation[] = [
  { original: 'get_token_market_data', canonical: 'token.market.read', classification: 'read', description: 'Returns price, volume, and market cap for a given token.' },
  { original: 'get_wallet_activity', canonical: 'wallet.activity.read', classification: 'read', description: 'Returns normalised transaction history for any address.' },
  { original: 'prepare_swap', canonical: 'swap.prepare', classification: 'execution-sensitive', description: 'Prepares a structured unsigned swap proposal. Does not execute.' },
];

const OPENAPI_DISCOVERED_OPS: CapabilityOperation[] = [
  { original: 'GET /markets', canonical: 'markets.read', classification: 'read', description: 'Returns current market data for tracked assets.' },
  { original: 'GET /wallets/{address}/activity', canonical: 'wallet.activity.read', classification: 'read', description: 'Returns activity for any watched address.' },
  { original: 'POST /quote', canonical: 'quote.prepare', classification: 'prepare', description: 'Prepares a quote for a swap or bridge operation.' },
  { original: 'POST /prepare', canonical: 'action.prepare', classification: 'execution-sensitive', description: 'Prepares an unsigned action. Does not submit to network.' },
];

const CLASSIFICATION_COLORS: Record<string, string> = {
  read: 'text-accent border-accent/20 bg-accent-dim/10',
  prepare: 'text-primary border-primary/20 bg-primary-dim/10',
  'execution-sensitive': 'text-warn border-warn/20 bg-warn/5',
};

function OpRow({ op }: { op: CapabilityOperation }) {
  return (
    <div className="border border-border rounded-lg bg-panel px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-mono text-text-sub">{op.original}</p>
          <p className="text-[10px] text-text-dim mt-0.5">→ {op.canonical}</p>
          <p className="text-xs text-text-sub mt-1 leading-relaxed">{op.description}</p>
        </div>
        <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border shrink-0 ${CLASSIFICATION_COLORS[op.classification] ?? 'text-text-muted border-border'}`}>
          {op.classification}
        </span>
      </div>
      {op.classification === 'execution-sensitive' && (
        <p className="text-[10px] text-text-dim mt-2 border-t border-border-dim pt-2">
          Execution-sensitive · Connecting this does not grant wallet authority. Actual execution passes AgentPlace authority, wallet, and Action Review rules.
        </p>
      )}
    </div>
  );
}

export function CapabilityStudio() {
  const state = useAppState();
  const dispatch = useDispatch();
  const [importType, setImportType] = useState<ImportType | null>(null);
  const [step, setStep] = useState<StudioStep>('choose');
  const [serverName, setServerName] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [openapiUrl, setOpenapiUrl] = useState('');
  const [ops, setOps] = useState<CapabilityOperation[]>([]);
  const [inspecting, setInspecting] = useState(false);
  const [testPassed, setTestPassed] = useState(false);
  const [testing, setTesting] = useState(false);

  function close() {
    dispatch({ type: 'SET_CREATOR_SURFACE', surface: null });
  }

  function handleInspect() {
    setInspecting(true);
    setTimeout(() => {
      const discovered = importType === 'mcp' ? MCP_DISCOVERED_OPS : OPENAPI_DISCOVERED_OPS;
      setOps(discovered);
      setStep('discovered');
      setInspecting(false);
    }, 1400);
  }

  function handleTest() {
    setTesting(true);
    setTimeout(() => {
      setTesting(false);
      setTestPassed(true);
      setStep('tested');
    }, 1600);
  }

  function handleSavePrivately() {
    if (!state.user) {
      dispatch({
        type: 'SET_IDENTITY_CHECKPOINT',
        checkpoint: {
          reason: 'save-capability',
          feature: 'save your capability privately',
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
    const draft: CapabilityDraftData = {
      name: importType === 'mcp' ? (serverName || 'MCP Capability') : 'OpenAPI Capability',
      importType: importType!,
      endpoint: importType === 'mcp' ? endpoint : openapiUrl,
      operations: ops,
      version: '1.0.0',
      pricing: { type: 'free' },
    };
    const asset: CreatorAsset = {
      id: uid(),
      type: 'capability',
      visibility: 'private',
      createdAt: new Date(),
      updatedAt: new Date(),
      capabilityDraft: draft,
    };
    dispatch({ type: 'ADD_CREATOR_ASSET', asset });
    setStep('saved');
  }

  return (
    <div className="h-full flex flex-col bg-bg overflow-hidden">
      <div className="px-6 py-4 border-b border-border shrink-0 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-text">Capability Studio</p>
          <p className="text-xs text-text-muted">Connect a tool or API so Workers can use it</p>
        </div>
        <button onClick={close} className="text-text-muted hover:text-text p-1 rounded transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 max-w-2xl">
        {step === 'choose' && (
          <div>
            <p className="text-sm font-medium text-text mb-1">What do you want to connect?</p>
            <p className="text-xs text-text-muted mb-6">Choose an import method. Imported operations are reviewed and normalised before Workers can use them.</p>
            <div className="space-y-3">
              <button
                onClick={() => { setImportType('mcp'); setStep('configure'); }}
                className="w-full flex items-start gap-4 border border-border rounded-lg bg-panel px-5 py-4 hover:bg-panel-raised transition-colors text-left"
              >
                <div className="text-text-muted mt-0.5">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10 20l4-16M7 4L3 12l4 8M17 4l4 8-4 8" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-text mb-0.5">MCP server</p>
                  <p className="text-xs text-text-sub">Connect via Model Context Protocol. Provides structured tool discovery.</p>
                </div>
              </button>
              <button
                onClick={() => { setImportType('openapi'); setStep('configure'); }}
                className="w-full flex items-start gap-4 border border-border rounded-lg bg-panel px-5 py-4 hover:bg-panel-raised transition-colors text-left"
              >
                <div className="text-text-muted mt-0.5">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 12h8m-8 6h16" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-text mb-0.5">OpenAPI</p>
                  <p className="text-xs text-text-sub">Paste a URL or upload an OpenAPI specification.</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {step === 'configure' && importType === 'mcp' && (
          <div className="space-y-4">
            <button onClick={() => setStep('choose')} className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text transition-colors mb-2">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 18l-6-6 6-6" /></svg>
              Back
            </button>
            <h2 className="text-base font-semibold text-text">MCP Server</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-text-muted uppercase tracking-wider block mb-1">Server name</label>
                <input className="w-full bg-panel-raised border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-primary/50" placeholder="e.g. DeFi Data Provider" value={serverName} onChange={(e) => setServerName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-text-muted uppercase tracking-wider block mb-1">MCP endpoint</label>
                <input className="w-full bg-panel-raised border border-border rounded-lg px-3 py-2 text-sm text-text font-mono focus:outline-none focus:border-primary/50" placeholder="mcp://provider.example.com/v1" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-text-muted uppercase tracking-wider block mb-1">Authentication</label>
                <select className="w-full bg-panel-raised border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none">
                  <option>None (public)</option>
                  <option>API key</option>
                  <option>OAuth2</option>
                </select>
              </div>
            </div>
            <p className="text-xs text-text-dim">No real network call is made in this prototype. Discovery is illustrative.</p>
            <button onClick={handleInspect} disabled={inspecting} className="w-full py-2.5 bg-primary text-white text-sm rounded-lg font-medium hover:bg-primary-hover disabled:opacity-60 transition-colors">
              {inspecting ? 'Inspecting…' : 'Inspect server'}
            </button>
          </div>
        )}

        {step === 'configure' && importType === 'openapi' && (
          <div className="space-y-4">
            <button onClick={() => setStep('choose')} className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text transition-colors mb-2">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 18l-6-6 6-6" /></svg>
              Back
            </button>
            <h2 className="text-base font-semibold text-text">OpenAPI Import</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-text-muted uppercase tracking-wider block mb-1">Paste OpenAPI URL</label>
                <input className="w-full bg-panel-raised border border-border rounded-lg px-3 py-2 text-sm text-text font-mono focus:outline-none focus:border-primary/50" placeholder="https://api.example.com/openapi.json" value={openapiUrl} onChange={(e) => setOpenapiUrl(e.target.value)} />
              </div>
              <div className="text-center text-xs text-text-dim">or</div>
              <label className="block border border-dashed border-border rounded-lg px-5 py-6 text-center cursor-pointer hover:border-primary/30 transition-colors">
                <p className="text-xs text-text-muted mb-1">Upload specification</p>
                <p className="text-[10px] text-text-dim">JSON or YAML</p>
                <input type="file" className="hidden" accept=".json,.yaml,.yml" />
              </label>
            </div>
            <p className="text-xs text-text-dim">No real network call is made in this prototype. Discovery is illustrative.</p>
            <button onClick={handleInspect} disabled={inspecting} className="w-full py-2.5 bg-primary text-white text-sm rounded-lg font-medium hover:bg-primary-hover disabled:opacity-60 transition-colors">
              {inspecting ? 'Inspecting…' : 'Inspect specification'}
            </button>
          </div>
        )}

        {(step === 'discovered' || step === 'tested' || step === 'saved') && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-semibold text-text">Discovered operations</h2>
              <span className="text-xs text-text-muted font-mono">{ops.length} operations</span>
            </div>
            <p className="text-xs text-text-dim mb-2">Operations are reviewed and normalised into canonical AgentPlace capabilities. Imported operations are not inherently trusted.</p>
            <div className="space-y-2">
              {ops.map((op) => <OpRow key={op.original} op={op} />)}
            </div>

            {step === 'discovered' && (
              <button onClick={handleTest} disabled={testing} className="w-full py-2.5 bg-primary text-white text-sm rounded-lg font-medium hover:bg-primary-hover disabled:opacity-60 transition-colors">
                {testing ? 'Testing…' : 'Test capability'}
              </button>
            )}

            {step === 'tested' && (
              <div className="space-y-3">
                <div className="bg-accent-dim/20 border border-accent/20 rounded-lg px-4 py-3">
                  <p className="text-sm font-medium text-accent">Tests passed</p>
                  <p className="text-xs text-text-sub mt-1">Read operation returned expected normalised data · Pass</p>
                  <p className="text-xs text-text-sub">Prepare operation produced a structured unsigned action · Pass</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={handleSavePrivately} className="flex-1 py-2.5 bg-primary text-white text-sm rounded-lg font-medium hover:bg-primary-hover transition-colors">
                    Use privately
                  </button>
                  <button className="flex-1 py-2.5 border border-border text-text-sub text-sm rounded-lg hover:bg-panel-raised transition-colors">
                    Publish for builders
                  </button>
                </div>
              </div>
            )}

            {step === 'saved' && (
              <div className="space-y-3">
                <div className="bg-accent-dim/20 border border-accent/20 rounded-lg px-4 py-3">
                  <p className="text-sm font-medium text-accent">Capability saved privately</p>
                  <p className="text-xs text-text-sub mt-1">No wallet authority was created. Workers must explicitly use this capability and pass AgentPlace authority and Action Review rules.</p>
                </div>
                <button
                  onClick={() => dispatch({ type: 'SET_CREATOR_SURFACE', surface: 'creator-home' })}
                  className="w-full py-2.5 border border-border text-text-sub text-sm rounded-lg hover:bg-panel-raised transition-colors"
                >
                  My creations
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
