/**
 * Suggested first tasks are draft messages only, never automatically submitted.
 * Untrusted creator descriptions are deliberately not converted into prompts.
 * Worker execution remains subject to server-side eligibility and authority.
 */
const FIRST_TASKS: Record<string, string[]> = {
  'w-memescout': [
    'Research BONK on Solana. Verify its mint, market activity, holder concentration and liquidity. Give an evidence-backed conclusion. Research only.',
    'Compare WIF and BONK as meme-token research candidates. Separate verified signals from missing data. Do not trade.',
  ],
  'w-smartmoney': [
    'Investigate BONK smart-money and whale flows on Solana. Verify the mint and give a cautious, sourced conclusion. Research only.',
    'Explain what wallet-flow evidence you can verify and what cannot be inferred about trader intent.',
  ],
  'w-portfolio': [
    'Review the portfolio data available to me and highlight concentration and exposure risks. Do not execute transactions.',
    'What wallets or addresses can you inspect for portfolio monitoring? Explain any missing access before starting.',
  ],
  'w-stablecoin': [
    'Compare supported stablecoin yield opportunities and liquidity risks using current evidence. Recommend only; do not move funds.',
    'Explain the risks, withdrawal constraints and evidence needed for a safe stablecoin yield decision. Research only.',
  ],
  'w-defi': [
    'Review the DeFi positions you can inspect, including collateral, utilization and liquidation risks. Analysis only.',
    'Compare supported lending opportunities using dated sources and explain the main risks. Do not transact.',
  ],
  'w-perps': [
    'Research the current BTC perpetuals market, funding and liquidation risks on supported venues. Do not place orders.',
    'Explain what you would verify before preparing a perpetuals position. Research only.',
  ],
  'w-researcher': [
    'Research a crypto project of my choice using dated sources, key risks and an evidence-backed summary. Ask me which project first.',
    'Compare two protocols based on verified adoption, security and economic risks. Ask which two I mean.',
  ],
  'w-execution': [
    'Explain which onchain actions you support and what approvals would be required. Do not execute anything.',
    'Help me prepare a transaction checklist covering quotes, network fees, approvals and outcome verification. Do not sign or submit.',
  ],
  'w-agent-builder': [
    'Help me plan a new research Worker from a plain-language description, without granting wallet authority.',
    'What information do you need to turn my expertise into a private AgentPlace Worker?',
  ],
};

export function suggestedWorkerTasks(workerId: string): string[] {
  return FIRST_TASKS[workerId] ?? [
    'What read-only work can you perform, and what evidence can you provide? Do not execute any transactions.',
    'Help me define one specific task for you. Explain any missing capabilities or permissions first.',
  ];
}
