/**
 * M17 Stage 1: honest, read-only starting briefs for the existing durable Agent Builder.
 * These are editable suggestions, not deployed Workers, installed integrations, or permission grants.
 */
export type WorkerCreationPath = 'describe' | 'template' | 'expertise';

// The Builder API accepts at most 4,000 characters in a turn. Leave a small
// allowance for the scaffold and prefer multi-turn teaching for long methods.
export const WORKER_CREATION_GOAL_LIMIT = 3000;
export const WORKER_CREATION_METHOD_LIMIT = 700;
export const WORKER_CREATION_REQUEST_LIMIT = 3900;

/**
 * A kickoff is NOT a finished Job Contract. The entire brief goes to the Builder
 * model and is retained in its transcript. The provisional persisted Creator
 * draft only stores a bounded outline, respecting the 1,000-char responsibility
 * field in the existing Creator validator.
 */
export function initialWorkerJobContract(brief: string): string {
  const marker = 'Job I want the Worker to do:\n';
  const position = brief.indexOf(marker);
  const remainder = position >= 0 ? brief.slice(position + marker.length) : brief;
  const nextSection = remainder.search(/\n\n(?:My initial decision rules or expertise:|Ask me follow-up questions in Teach Mode|Draft a clear Job Contract|Start with read-only research)/);
  const goal = (nextSection >= 0 ? remainder.slice(0, nextSection) : remainder).trim();
  const outline = goal.slice(0, 860).trimEnd();
  const suffix = goal.length > 860 ? '\n\n[Initial outline; remaining brief is in the Builder conversation.]' : '';
  return (outline + suffix).slice(0, 950);
}


export interface WorkerCreationStarter {
  id: string;
  name: string;
  category: string;
  description: string;
  brief: string;
}

export const WORKER_CREATION_STARTERS: readonly WorkerCreationStarter[] = [
  {
    id: 'crypto-research',
    name: 'Crypto Researcher',
    category: 'Research',
    description: 'Investigate projects, tokens and claims.',
    brief: 'Build a read-only crypto research Worker. Given a token, protocol, or research question, identify the exact asset or project, investigate available credible sources, distinguish observed facts from interpretation, explain risks, and deliver an answer-first report with provenance. Do not invent unavailable data.',
  },
  {
    id: 'wallet-intelligence',
    name: 'Wallet Intelligence',
    category: 'Onchain',
    description: 'Follow verified wallet signals without copy-trading.',
    brief: 'Build a read-only wallet intelligence Worker. When given a network and wallet or token, inspect available wallet flows and transactions, distinguish transfers from trading, flag meaningful changes, and explain uncertainty about wallet labels and beneficial owners. Do not infer trading intent or copy-trade automatically.',
  },
  {
    id: 'stablecoin-opportunities',
    name: 'Stablecoin Watcher',
    category: 'DeFi',
    description: 'Compare stablecoin risk and opportunities.',
    brief: 'Build a read-only stablecoin monitoring and opportunity research Worker. Given a stablecoin and preferred networks, compare available market, peg, issuer, liquidity and protocol risk evidence. Surface alerts and risk-adjusted options, showing assumptions and missing coverage. Never move, bridge, lend, or invest funds automatically.',
  },
  {
    id: 'perps-risk',
    name: 'Perps Risk Watch',
    category: 'Trading research',
    description: 'Assess position and market risk without placing orders.',
    brief: 'Build a read-only perpetuals risk research Worker. Given a market or user-provided position, assess available funding, open interest, volatility, margin and liquidation considerations; distinguish verified exchange data from estimates and provide a risk summary. Do not place orders or change leverage.',
  },
  {
    id: 'prediction-markets',
    name: 'Prediction Market Analyst',
    category: 'Research',
    description: 'Investigate events, probabilities and market uncertainty.',
    brief: 'Build a read-only prediction market research Worker. Given an event and market, establish the precise resolution criteria and deadline, compare evidence to quoted probabilities where data is actually available, identify conflicting sources and settlement risks, and summarize the case for and against each outcome. Do not place bets or trades.',
  },
  {
    id: 'research-briefing',
    name: 'Research & Briefing',
    category: 'General work',
    description: 'Turn questions and sources into useful briefings.',
    brief: 'Build a read-only research and briefing Worker. Given a clear question, preferred sources and intended audience, collect only available evidence, identify conflicts and gaps, synthesize a concise briefing with direct citations, and suggest follow-up questions. Do not claim to have accessed private tools or sources unless they are actually connected.',
  },
] as const;

export interface WorkerCreationInput {
  path: WorkerCreationPath;
  goal: string;
  method?: string;
}

/** No AI call, Worker, Job or authority is created by composing this brief. */
export function workerCreationBrief(input: WorkerCreationInput): string | null {
  const goal = input.goal.trim();
  if (goal.length < 12 || goal.length > WORKER_CREATION_GOAL_LIMIT) return null;
  const method = input.method?.trim() ?? '';
  if (method.length > WORKER_CREATION_METHOD_LIMIT) return null;
  const purpose = input.path === 'expertise'
    ? 'Turn my expertise into a private Worker draft that follows a teachable method.'
    : input.path === 'template'
      ? 'Use this editable starter as the initial brief for a private Worker draft, not as proof that all integrations are live.'
      : 'Turn this job description into a private Worker draft.';
  const sections = [
    purpose,
    `Job I want the Worker to do:\n${goal}`,
  ];
  if (input.path === 'expertise') {
    sections.push(method
      ? `My initial decision rules or expertise:\n${method}`
      : 'Ask me follow-up questions in Teach Mode to capture my decision rules, example cases, exceptions and unique expertise.');
  }
  sections.push(
    'Draft a clear Job Contract, responsibilities, anti-jobs, inputs, outputs and only eligible capabilities. Ask for information you need rather than inventing live integrations.',
    'Start with read-only research and recommendations. No wallet signing, trading, financial permissions, automatic task submission or publication. Test and private installation are explicit later steps.',
  );
  const brief = sections.join('\n\n');
  return brief.length <= WORKER_CREATION_REQUEST_LIMIT ? brief : null;
}
