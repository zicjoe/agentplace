import { useEffect, useMemo, useState } from 'react';
import { useAppState, useDispatch } from '../state/AppContext';
import type { Mandate } from '../state/types';
import {
  applyAuthorityState,
  createDurableMandate,
  fetchAuthorityCapabilities,
  fetchAuthorityState,
  reviseDurableMandate,
  translateMandateDraft,
  type ApiAuthorityLevel,
  type ApiEnvironment,
  type ApiMandatePolicy,
  type ApiNetworkRef,
  type AuthorityCapabilityOption,
} from '../platform/authorityApi';

const NETWORK_OPTIONS: Array<{ label: string; value: ApiNetworkRef }> = [
  { label: 'Ethereum', value: { family: 'eip155', networkId: 'ethereum' } },
  { label: 'Base', value: { family: 'eip155', networkId: 'base' } },
  { label: 'Arbitrum', value: { family: 'eip155', networkId: 'arbitrum' } },
  { label: 'BNB Chain', value: { family: 'eip155', networkId: 'bnb' } },
  { label: 'Polygon', value: { family: 'eip155', networkId: 'polygon' } },
  { label: 'Robinhood Chain', value: { family: 'eip155', networkId: 'robinhood' } },
  { label: 'Solana', value: { family: 'solana', networkId: 'solana' } },
];

function csv(value: string): string[] {
  return [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))];
}

function networkKey(network: ApiNetworkRef): string { return `${network.family}:${network.networkId}`; }
function dateInput(value?: Date): string {
  if (!value || value.getUTCFullYear() >= 9999) return '';
  const d = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}

interface Props {
  workerId: string;
  workerName: string;
  existing?: Mandate;
  defaultAccountId?: string;
  onClose: () => void;
}

export function MandateEditor({ workerId, workerName, existing, defaultAccountId, onClose }: Props) {
  const state = useAppState();
  const dispatch = useDispatch();
  const [capabilities, setCapabilities] = useState<AuthorityCapabilityOption[]>([]);
  const [capabilitySearch, setCapabilitySearch] = useState('');
  const [authorityLevel, setAuthorityLevel] = useState<ApiAuthorityLevel>(existing?.authorityLevel ?? 'OBSERVE');
  const [accountId, setAccountId] = useState(existing?.accountId ?? defaultAccountId ?? state.wallets[0]?.id ?? '');
  const [environment, setEnvironment] = useState<ApiEnvironment>(existing?.environment ?? state.environment);
  const [title, setTitle] = useState(existing?.title ?? `${workerName} mandate`);
  const [purpose, setPurpose] = useState(existing?.purpose ?? `Define what ${workerName} may do for me.`);
  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>(existing?.allowedCapabilities ?? []);
  const [selectedNetworks, setSelectedNetworks] = useState<ApiNetworkRef[]>(existing?.allowedNetworks ?? []);
  const [assetScope, setAssetScope] = useState<'ANY' | 'ALLOW_LIST'>(existing?.assetScope ?? 'ALLOW_LIST');
  const [assets, setAssets] = useState((existing?.allowedAssets ?? []).join(', '));
  const [protocolScope, setProtocolScope] = useState<'ANY' | 'ALLOW_LIST'>(existing?.protocolScope ?? 'ALLOW_LIST');
  const [protocols, setProtocols] = useState((existing?.allowedProtocols ?? existing?.preferredProtocols ?? []).join(', '));
  const [destinationScope, setDestinationScope] = useState<'ANY' | 'ALLOW_LIST'>(existing?.destinationScope ?? 'ALLOW_LIST');
  const [destinations, setDestinations] = useState((existing?.allowedDestinations ?? []).join(', '));
  const [capitalLimit, setCapitalLimit] = useState(existing?.capitalLimitUsd ?? '');
  const [perActionLimit, setPerActionLimit] = useState(existing?.perActionLimitUsd ?? '');
  const [periodLimit, setPeriodLimit] = useState(existing?.periodBudget?.limitUsd ?? '');
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>(existing?.periodBudget?.period ?? 'day');
  const [serviceLimit, setServiceLimit] = useState(existing?.serviceBudget?.limitUsd ?? '');
  const [servicePeriod, setServicePeriod] = useState<'day' | 'week' | 'month'>(existing?.serviceBudget?.period ?? 'day');
  const [approvalMode, setApprovalMode] = useState<'ALWAYS' | 'THRESHOLD' | 'WITHIN_LIMITS'>(existing?.approvalPolicy?.mode ?? 'ALWAYS');
  const [approvalThreshold, setApprovalThreshold] = useState(existing?.approvalPolicy?.thresholdUsd ?? '');
  const [askNewProtocols, setAskNewProtocols] = useState(existing?.approvalPolicy?.askForNewProtocols ?? true);
  const [askNewDestinations, setAskNewDestinations] = useState(existing?.approvalPolicy?.askForNewDestinations ?? true);
  const [borrowingAllowed, setBorrowingAllowed] = useState(existing?.borrowingAllowed ?? false);
  const [leverageAllowed, setLeverageAllowed] = useState(existing?.leverageAllowed ?? false);
  const [validUntil, setValidUntil] = useState(dateInput(existing?.expiry));
  const [changeSummary, setChangeSummary] = useState(existing ? 'Updated authority rules after user review.' : 'Initial mandate created by user.');
  const [intent, setIntent] = useState('');
  const [translationWarnings, setTranslationWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState<'draft' | 'active' | 'translate' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchAuthorityCapabilities().then(setCapabilities).catch((err) => setError(err instanceof Error ? err.message : 'Capabilities could not be loaded.'));
  }, []);

  const selectedAccount = state.wallets.find((wallet) => wallet.id === accountId);
  const filteredCapabilities = useMemo(() => {
    const q = capabilitySearch.trim().toLowerCase();
    return capabilities.filter((capability) => !q || `${capability.name} ${capability.id} ${capability.purpose}`.toLowerCase().includes(q));
  }, [capabilities, capabilitySearch]);

  function toggleCapability(id: string) {
    setSelectedCapabilities((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function toggleNetwork(network: ApiNetworkRef) {
    const key = networkKey(network);
    setSelectedNetworks((current) => current.some((item) => networkKey(item) === key) ? current.filter((item) => networkKey(item) !== key) : [...current, network]);
  }

  async function refresh() {
    applyAuthorityState(dispatch, await fetchAuthorityState());
  }

  async function translate() {
    if (!intent.trim()) return;
    setBusy('translate'); setError(null);
    try {
      const { draft } = await translateMandateDraft(intent);
      setAuthorityLevel(draft.authorityLevel);
      if (draft.networks.length) setSelectedNetworks(draft.networks);
      if (draft.assets.length) { setAssetScope('ALLOW_LIST'); setAssets(draft.assets.join(', ')); }
      if (draft.protocols.length) { setProtocolScope('ALLOW_LIST'); setProtocols(draft.protocols.join(', ')); }
      setApprovalMode(draft.approvalPolicy.mode);
      setApprovalThreshold(draft.approvalPolicy.thresholdUsd ?? '');
      setAskNewProtocols(draft.approvalPolicy.askForNewProtocols);
      setAskNewDestinations(draft.approvalPolicy.askForNewDestinations);
      setBorrowingAllowed(draft.borrowingAllowed);
      setLeverageAllowed(draft.leverageAllowed);
      if (draft.perActionLimitUsd) setPerActionLimit(draft.perActionLimitUsd);
      if (draft.periodBudget) { setPeriodLimit(draft.periodBudget.limitUsd); setPeriod(draft.periodBudget.period); }
      setTranslationWarnings(draft.warnings);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not translate the mandate draft.'); }
    finally { setBusy(null); }
  }

  function policy(): ApiMandatePolicy {
    const output: ApiMandatePolicy = {
      title, purpose, authorityLevel,
      allowedCapabilities: selectedCapabilities,
      allowedNetworks: selectedNetworks,
      assetScope, allowedAssets: csv(assets),
      protocolScope, allowedProtocols: csv(protocols),
      destinationScope, allowedDestinations: csv(destinations),
      approvalPolicy: { mode: approvalMode, askForNewProtocols: askNewProtocols, askForNewDestinations: askNewDestinations, ...(approvalMode === 'THRESHOLD' && approvalThreshold ? { thresholdUsd: approvalThreshold } : {}) },
      borrowingAllowed, leverageAllowed,
      changeSummary,
      ...(capitalLimit ? { capitalLimitUsd: capitalLimit } : {}),
      ...(perActionLimit ? { perActionLimitUsd: perActionLimit } : {}),
      ...(periodLimit ? { periodBudget: { limitUsd: periodLimit, period } } : {}),
      ...(serviceLimit ? { serviceBudget: { limitUsd: serviceLimit, period: servicePeriod } } : {}),
      ...(validUntil ? { validUntil: new Date(validUntil).toISOString() } : {}),
    };
    return output;
  }

  async function save(status: 'DRAFT' | 'ACTIVE') {
    setBusy(status === 'DRAFT' ? 'draft' : 'active'); setError(null);
    try {
      if (!accountId) throw new Error('Choose an account for this mandate.');
      if (selectedCapabilities.length === 0) throw new Error('Choose at least one capability.');
      if (selectedNetworks.length === 0) throw new Error('Choose at least one network.');
      if (authorityLevel === 'ACT_WITHIN_MANDATE' && selectedAccount?.mode !== 'agent-account') throw new Error('Act within mandate is available only for an Agent Account in M7.');
      if (authorityLevel === 'ACT_WITHIN_MANDATE' && (assetScope !== 'ALLOW_LIST' || csv(assets).length === 0)) throw new Error('Act within mandate requires an explicit asset allow-list.');
      if (existing) {
        if (!existing.revision) throw new Error('This mandate does not expose a durable revision and cannot be edited here.');
        await reviseDurableMandate(existing.id, existing.revision, policy());
      } else {
        await createDurableMandate({ workerId, accountId, environment, status, policy: policy() });
      }
      await refresh();
      onClose();
    } catch (err) { setError(err instanceof Error ? err.message : 'Mandate could not be saved.'); }
    finally { setBusy(null); }
  }

  return (
    <div data-testid="mandate-editor" className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-bg/85 backdrop-blur-sm px-3 py-3 sm:px-5 sm:py-6">
      <div className="w-full max-w-4xl my-auto max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl border border-border bg-panel shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-panel px-5 py-4">
          <div><h2 className="text-base font-semibold text-text">{existing ? 'Edit authority' : 'Create authority mandate'}</h2><p className="text-xs text-text-muted mt-1">{workerName} · AI can help draft this, but deterministic policy is what gets stored and enforced.</p></div>
          <button onClick={onClose} className="text-text-muted hover:text-text" aria-label="Close authority editor">✕</button>
        </div>

        <div className="p-5 space-y-6">
          <section className="rounded-lg border border-border-dim bg-bg/40 p-4">
            <p className="text-xs font-medium text-text mb-2">Describe the rule in plain language <span className="text-text-dim font-normal">optional</span></p>
            <textarea value={intent} onChange={(e) => setIntent(e.target.value)} rows={3} placeholder="Let my Stablecoin Worker optimize my USDC on Base, but never move more than $50 without asking me." className="w-full rounded border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-primary/50" />
            <div className="flex items-center gap-3 mt-2"><button disabled={busy !== null || !intent.trim()} onClick={() => void translate()} className="text-xs border border-primary/30 text-primary rounded px-3 py-1.5 disabled:opacity-40">{busy === 'translate' ? 'Drafting…' : 'Draft structured fields'}</button><span className="text-[11px] text-text-dim">This never activates authority by itself.</span></div>
            {translationWarnings.length > 0 && <div className="mt-3 space-y-1">{translationWarnings.map((warning) => <p key={warning} className="text-[11px] text-warn">• {warning}</p>)}</div>}
          </section>

          <section>
            <h3 className="text-sm font-semibold text-text mb-3">1. Authority level</h3>
            <div className="grid gap-2 md:grid-cols-3">
              {([
                ['OBSERVE','Observe','Read, monitor, research and notify. No financial execution.'],
                ['PREPARE','Prepare','May construct a proposed action. Execution still needs approval.'],
                ['ACT_WITHIN_MANDATE','Act within mandate','Standing authority only inside explicit hard limits. Agent Account only.'],
              ] as const).map(([value,label,description]) => <button key={value} onClick={() => setAuthorityLevel(value)} className={`text-left rounded-lg border p-3 ${authorityLevel === value ? 'border-primary/50 bg-primary-dim/10' : 'border-border hover:border-border-strong'}`}><p className="text-sm font-medium text-text">{label}</p><p className="text-xs text-text-muted mt-1 leading-relaxed">{description}</p></button>)}
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <label className="text-xs text-text-muted">Account<select disabled={Boolean(existing)} value={accountId} onChange={(e) => setAccountId(e.target.value)} className="mt-1 w-full rounded border border-border bg-bg px-3 py-2 text-sm text-text"><option value="">Choose account…</option>{state.wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name} · {wallet.mode}</option>)}</select></label>
            <label className="text-xs text-text-muted">Environment<select disabled={Boolean(existing)} value={environment} onChange={(e) => setEnvironment(e.target.value as ApiEnvironment)} className="mt-1 w-full rounded border border-border bg-bg px-3 py-2 text-sm text-text"><option value="mainnet">Mainnet · real funds</option><option value="testnet">Testnet · test funds</option></select></label>
            <label className="text-xs text-text-muted">Mandate name<input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded border border-border bg-bg px-3 py-2 text-sm text-text" /></label>
            <label className="text-xs text-text-muted md:col-span-1">Expires{authorityLevel === 'ACT_WITHIN_MANDATE' && <span className="text-warn"> · required</span>}<input type="datetime-local" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="mt-1 w-full rounded border border-border bg-bg px-3 py-2 text-sm text-text" /></label>
            <label className="text-xs text-text-muted md:col-span-2">Purpose<textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} rows={2} className="mt-1 w-full rounded border border-border bg-bg px-3 py-2 text-sm text-text" /></label>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-text mb-3">2. Capabilities</h3>
            <input value={capabilitySearch} onChange={(e) => setCapabilitySearch(e.target.value)} placeholder="Search capabilities" className="mb-2 w-full rounded border border-border bg-bg px-3 py-2 text-sm text-text" />
            <div className="max-h-52 overflow-y-auto rounded border border-border divide-y divide-border-dim">
              {filteredCapabilities.map((capability) => <label key={capability.id} className="flex gap-3 px-3 py-2.5 hover:bg-panel-raised"><input type="checkbox" checked={selectedCapabilities.includes(capability.id)} onChange={() => toggleCapability(capability.id)} /><span className="min-w-0"><span className="block text-xs font-medium text-text">{capability.name} <span className="font-mono text-[10px] text-text-dim">{capability.effect}</span></span><span className="block text-[11px] text-text-muted">{capability.id} · {capability.purpose}</span></span></label>)}
              {filteredCapabilities.length === 0 && <p className="p-3 text-xs text-text-muted">No matching canonical capabilities.</p>}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-text mb-3">3. Networks</h3>
            <div className="flex flex-wrap gap-2">{NETWORK_OPTIONS.map(({label,value}) => { const checked=selectedNetworks.some((item)=>networkKey(item)===networkKey(value)); return <button type="button" key={networkKey(value)} onClick={() => toggleNetwork(value)} className={`rounded border px-3 py-1.5 text-xs ${checked ? 'border-primary/50 text-primary bg-primary-dim/10' : 'border-border text-text-sub'}`}>{checked ? '✓ ' : ''}{label}</button>; })}</div>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            <ScopeField title="Assets" scope={assetScope} setScope={setAssetScope} value={assets} setValue={setAssets} placeholder="USDC, ETH" />
            <ScopeField title="Protocols" scope={protocolScope} setScope={setProtocolScope} value={protocols} setValue={setProtocols} placeholder="aave, compound" />
            <ScopeField title="Destinations" scope={destinationScope} setScope={setDestinationScope} value={destinations} setValue={setDestinations} placeholder="address or destination id" />
          </section>

          <section>
            <h3 className="text-sm font-semibold text-text mb-3">4. Separate limits</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <MoneyField label="Capital authority" value={capitalLimit} setValue={setCapitalLimit} note="Total capital ceiling, not service credits." />
              <MoneyField label="Per action" value={perActionLimit} setValue={setPerActionLimit} note={authorityLevel === 'ACT_WITHIN_MANDATE' ? 'Required hard ceiling.' : 'Optional hard ceiling.'} />
              <div><MoneyField label="Period budget" value={periodLimit} setValue={setPeriodLimit} note="Cumulative financial usage." /><select value={period} onChange={(e)=>setPeriod(e.target.value as typeof period)} className="mt-1 w-full rounded border border-border bg-bg px-2 py-1.5 text-xs text-text"><option value="day">Per day</option><option value="week">Per week</option><option value="month">Per month</option></select></div>
              <div><MoneyField label="Service budget" value={serviceLimit} setValue={setServiceLimit} note="AI/API/data/provider spend only." /><select value={servicePeriod} onChange={(e)=>setServicePeriod(e.target.value as typeof servicePeriod)} className="mt-1 w-full rounded border border-border bg-bg px-2 py-1.5 text-xs text-text"><option value="day">Per day</option><option value="week">Per week</option><option value="month">Per month</option></select></div>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-text mb-3">5. Approval policy</h3>
            <div className="grid gap-3 md:grid-cols-3">{([
              ['ALWAYS','Always ask me'],['THRESHOLD','Ask above a threshold'],['WITHIN_LIMITS','No additional approval inside explicit limits'],
            ] as const).map(([value,label]) => <label key={value} className={`rounded border p-3 text-xs ${approvalMode===value?'border-primary/50':'border-border'}`}><input className="mr-2" type="radio" name="approval-mode" checked={approvalMode===value} onChange={()=>setApprovalMode(value)} />{label}</label>)}</div>
            {approvalMode === 'THRESHOLD' && <label className="block mt-3 text-xs text-text-muted">Autonomous threshold (USD)<input value={approvalThreshold} onChange={(e)=>setApprovalThreshold(e.target.value)} placeholder="25" className="mt-1 w-48 rounded border border-border bg-bg px-3 py-2 text-sm text-text" /></label>}
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-text-sub"><label><input type="checkbox" className="mr-2" checked={askNewProtocols} onChange={(e)=>setAskNewProtocols(e.target.checked)} />Ask for new protocols</label><label><input type="checkbox" className="mr-2" checked={askNewDestinations} onChange={(e)=>setAskNewDestinations(e.target.checked)} />Ask for new destinations</label><label><input type="checkbox" className="mr-2" checked={borrowingAllowed} onChange={(e)=>setBorrowingAllowed(e.target.checked)} />Allow borrowing</label><label><input type="checkbox" className="mr-2" checked={leverageAllowed} onChange={(e)=>setLeverageAllowed(e.target.checked)} />Allow leverage</label></div>
          </section>

          <label className="block text-xs text-text-muted">Change summary<input value={changeSummary} onChange={(e)=>setChangeSummary(e.target.value)} className="mt-1 w-full rounded border border-border bg-bg px-3 py-2 text-sm text-text" /></label>

          {authorityLevel === 'ACT_WITHIN_MANDATE' && <div className="rounded border border-warn/25 bg-warn/5 px-4 py-3 text-xs text-warn">ACT WITHIN MANDATE requires an Agent Account, an explicit asset allow-list, a hard per-action limit, a day/week/month budget, and an expiration. Mainnet autonomy remains separately gated.</div>}
          {error && <div className="rounded border border-danger/30 bg-danger/5 px-4 py-3 text-xs text-danger">{error}</div>}
        </div>

        <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-border bg-panel px-5 py-4">
          <button onClick={onClose} disabled={busy !== null} className="px-4 py-2 text-xs text-text-sub border border-border rounded">Cancel</button>
          {!existing && <button onClick={() => void save('DRAFT')} disabled={busy !== null} className="px-4 py-2 text-xs text-text border border-border rounded disabled:opacity-40">{busy==='draft'?'Saving…':'Save draft'}</button>}
          <button onClick={() => void save('ACTIVE')} disabled={busy !== null} className="px-4 py-2 text-xs font-medium bg-primary text-white rounded disabled:opacity-40">{busy==='active'?'Saving…':existing?'Save revision':'Review complete · Activate'}</button>
        </div>
      </div>
    </div>
  );
}

function ScopeField({ title, scope, setScope, value, setValue, placeholder }: { title: string; scope: 'ANY'|'ALLOW_LIST'; setScope: (value:'ANY'|'ALLOW_LIST')=>void; value:string; setValue:(value:string)=>void; placeholder:string }) {
  return <div className="rounded border border-border p-3"><p className="text-xs font-medium text-text mb-2">{title}</p><select value={scope} onChange={(e)=>setScope(e.target.value as 'ANY'|'ALLOW_LIST')} className="w-full rounded border border-border bg-bg px-2 py-1.5 text-xs text-text"><option value="ALLOW_LIST">Only listed · hard restriction</option><option value="ANY">Any · approval rules may still apply</option></select><input value={value} onChange={(e)=>setValue(e.target.value)} placeholder={placeholder} className="mt-2 w-full rounded border border-border bg-bg px-2 py-1.5 text-xs text-text" /><p className="text-[10px] text-text-dim mt-1">Comma separated. Under Only listed, supplied values outside the list are denied. Under Any, listed protocols/destinations can act as the pre-approved set for “ask for new” rules.</p></div>;
}

function MoneyField({ label, value, setValue, note }: { label:string; value:string; setValue:(value:string)=>void; note:string }) {
  return <label className="text-xs text-text-muted">{label}<div className="mt-1 flex rounded border border-border bg-bg"><span className="px-2 py-2 text-sm text-text-dim">$</span><input inputMode="decimal" value={value} onChange={(e)=>setValue(e.target.value)} placeholder="0" className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm text-text outline-none" /></div><span className="block text-[10px] text-text-dim mt-1">{note}</span></label>;
}
