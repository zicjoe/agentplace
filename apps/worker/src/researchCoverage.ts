export interface ResearchRequirement {
  id: string;
  text: string;
}

const trimLine = (value: string): string => value.replace(/\s+/g, ' ').trim();
const escapePipe = (value: string): string => value.replace(/\|/g, '\\|');

export function buildResearchRequirements(originalRequest: string, planned: readonly string[]): ResearchRequirement[] {
  const seen = new Set<string>();
  const normalized = planned
    .map(trimLine)
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12);
  const values = normalized.length > 0 ? normalized : [trimLine(originalRequest)].filter(Boolean);
  return values.map((text, index) => ({ id: `R${index + 1}`, text }));
}

export function researchCoverageInstructions(
  requirements: readonly ResearchRequirement[],
  unavailableRequestedCapabilities: readonly string[],
): string {
  const rows = requirements.map((item) => `${item.id}: ${item.text}`).join('\n');
  const unavailable = unavailableRequestedCapabilities.length > 0
    ? unavailableRequestedCapabilities.join(', ')
    : 'none explicitly identified';
  return `Research coverage contract:\n${rows}\n\nBefore detailed analysis, include a section headed exactly \"## Coverage\" with a Markdown table whose first column contains every requirement ID above exactly once. Use only these status phrases: \"Verified from available evidence\", \"Partially verified\", or \"Not verified / capability unavailable\". The Basis column must say what evidence supports the status or why verification is unavailable. Do not omit a requested requirement simply because a specialist capability is unavailable.\n\nRequested capabilities that are currently non-live: ${unavailable}.\n\nAfter the coverage table, provide the useful source-grounded analysis that is actually supported. If preserved evidence cannot establish a requested point, say so explicitly rather than inventing a metric, wallet classification, deployer conclusion, security score, or onchain state. Do not add a final Sources section; AgentPlace appends preserved provider URLs separately.`;
}

export function hasResearchCoverage(answer: string, requirements: readonly ResearchRequirement[]): boolean {
  if (!/^#{1,6}\s+Coverage\s*$/im.test(answer)) return false;
  return requirements.every((item) => {
    const escaped = item.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|\\|\\s*)${escaped}(?=\\s*\\||\\b)`, 'im').test(answer);
  });
}

export function appendCoverageFallback(
  answer: string,
  requirements: readonly ResearchRequirement[],
  unavailableRequestedCapabilities: readonly string[],
): string {
  const capabilityNote = unavailableRequestedCapabilities.length > 0
    ? ` Requested non-live capabilities: ${unavailableRequestedCapabilities.join(', ')}.`
    : '';
  const rows = requirements.map((item) => `| ${item.id} | ${escapePipe(item.text)} | Not verified / capability unavailable | The preserved research output did not explicitly establish this requirement.${capabilityNote} |`);
  const coverage = [
    '## Coverage',
    '',
    '| Requirement | Requested analysis | Status | Basis |',
    '| --- | --- | --- | --- |',
    ...rows,
  ].join('\n');
  return `${coverage}\n\n${answer.trim()}`.trim();
}
