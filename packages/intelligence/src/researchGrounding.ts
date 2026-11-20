/** Deterministic correction for a known runtime/evidence contradiction. */
export interface GroundingEvidence { capabilityId: string; status: string; network?: string; address?: string; id: string; }
export function reconcileResearchRuntimeClaims(answer: string, records: readonly GroundingEvidence[]): string {
  const identity = records.find((record) => record.capabilityId === 'token.identity.resolve' && record.status === 'verified' && record.address);
  if (!identity) return answer;
  const falselyUnavailable = /(?:token\.identity\.resolve|identity resolv(?:er|e capability))[^\n.]{0,100}\b(?:not live|not available|unavailable|did not (?:run|execute)|was not (?:run|executed))\b/i.test(answer);
  if (!falselyUnavailable) return answer;
  return `${answer.trim()}\n\n> **Execution evidence correction:** The persisted Job record confirms that \`token.identity.resolve\` ran and saved verified identity evidence for ${identity.network ?? 'the recorded network'} token \`${identity.address}\` (record \`${identity.id}\`). Any contrary statement above about this capability not running is incorrect. This record alone does not verify market or wallet measurements.`;
}
