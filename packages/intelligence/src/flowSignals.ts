/** Conservative, cohort-scoped USD flow extraction from Nansen TGM flow intelligence. */
type JsonObject = Record<string, unknown>;
function obj(value: unknown): JsonObject { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {}; }
function finite(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}
export interface SmartMoneyFlowSignal { cohort: 'smart_money'; metric: 'net_flow_usd'; valueUsd: number; path: string; direction: 'net-inflow' | 'net-outflow' | 'flat'; }

export function extractNansenSmartMoneyUsdFlow(payload: unknown): SmartMoneyFlowSignal | null {
  const root = obj(payload);
  const data = root.data ?? root;
  const records: Array<{ path: string; value: number }> = [];
  const add = (path: string, value: unknown) => { const n = finite(value); if (n !== undefined) records.push({ path, value: n }); };
  const scan = (item: unknown, prefix: string) => {
    const entry = obj(item);
    add(`${prefix}.smart_money_net_flow_usd`, entry.smart_money_net_flow_usd);
    add(`${prefix}.smartMoneyNetFlowUsd`, entry.smartMoneyNetFlowUsd);
    for (const name of ['smart_money', 'smartMoney']) {
      const cohort = obj(entry[name]);
      add(`${prefix}.${name}.net_flow_usd`, cohort.net_flow_usd);
      add(`${prefix}.${name}.netFlowUsd`, cohort.netFlowUsd);
    }
    const label = String(entry.segment ?? entry.cohort ?? entry.label ?? '').toLowerCase().replace(/[ -]/g, '_');
    if (label === 'smart_money') {
      add(`${prefix}.net_flow_usd`, entry.net_flow_usd);
      add(`${prefix}.netFlowUsd`, entry.netFlowUsd);
    }
  };
  if (Array.isArray(data)) data.forEach((entry, i) => scan(entry, `data[${i}]`));
  else scan(data, 'data');
  // Two contradictory values or multiple windows must NOT yield a directional verdict.
  const distinct = [...new Set(records.map((entry) => entry.value))];
  if (distinct.length !== 1 || records.length === 0) return null;
  const match = records[0]!;
  return { cohort: 'smart_money', metric: 'net_flow_usd', valueUsd: match.value, path: match.path,
    direction: match.value > 0 ? 'net-inflow' : match.value < 0 ? 'net-outflow' : 'flat' };
}
