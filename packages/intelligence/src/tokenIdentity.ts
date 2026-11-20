/**
 * Explicitly verified original-asset identity pins. This is deliberately a
 * small, auditable map, not a global symbol-to-address oracle: symbols are
 * reusable and a high-liquidity pool is not an identity attestation.
 *
 * BONK Solana reference: https://phantom.com/tokens/solana/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263
 * The user's explicitly provided mint is never silently replaced.
 */
export interface PinnedTokenIdentity {
  network: string;
  address: string;
  symbol: string;
  sourceUrl: string;
}

const pinnedTokenIdentities: Record<string, PinnedTokenIdentity> = {
  'solana:bonk': {
    network: 'solana',
    address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    symbol: 'BONK',
    sourceUrl: 'https://phantom.com/tokens/solana/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  },
};

export function pinnedTokenFor(query: string, network: string): PinnedTokenIdentity | undefined {
  const symbol = query.trim().replace(/^\$/, '').toLowerCase();
  return pinnedTokenIdentities[`${network.toLowerCase()}:${symbol}`];
}

export function pinnedTokenConflict(query: string, network: string, suppliedAddress?: string): string | null {
  const pinned = pinnedTokenFor(query, network);
  if (!pinned || !suppliedAddress?.trim()) return null;
  if (pinned.address.toLowerCase() === suppliedAddress.trim().toLowerCase()) return null;
  return `The supplied ${network} mint ${suppliedAddress.trim()} does not match the established ${pinned.symbol} identity ${pinned.address}. AgentPlace will not substitute another asset or send token-specific requests to providers until the intended mint is clarified.`;
}

export interface TokenSearchCandidate {
  network: string;
  address: string;
  symbol?: string;
  name?: string;
  sourceUrl?: string;
}

/** A ticker/name search must have exactly one matching token identity on the
 * requested network. Repeated pools for the SAME mint are fine. Never choose
 * a different mint just because its pool has the most liquidity. */
export function selectUnambiguousTokenCandidate(
  query: string,
  requestedNetwork: string,
  candidates: readonly TokenSearchCandidate[],
): TokenSearchCandidate | null {
  const target = query.trim().replace(/^\$/, '').toLowerCase();
  const exact = candidates.filter((candidate) =>
    (!requestedNetwork || candidate.network === requestedNetwork) &&
    [candidate.address, candidate.symbol, candidate.name].some((value) => value?.toLowerCase() === target),
  );
  const unique = new Map<string, TokenSearchCandidate>();
  for (const candidate of exact) {
    const key = `${candidate.network}:${candidate.address.toLowerCase()}`;
    if (!unique.has(key)) unique.set(key, candidate);
  }
  return unique.size === 1 ? [...unique.values()][0]! : null;
}
