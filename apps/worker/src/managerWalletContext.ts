/** Owner-scoped, read-only wallet reference resolution for the Manager.
 * This file never reads signer material, authorizes a transaction, or infers wallet ownership.
 */
export interface ManagerWalletRef {
  id: string;
  name: string;
  mode: 'watch-only' | 'connected' | 'agent-account';
  namespace: string;
  address: string | null;
}

export interface ManagerMessageRef { role: string; content: string }
export type WalletResearchResolution =
  | { kind: 'not-wallet-research' }
  | { kind: 'clarify'; message: string }
  | { kind: 'resolved'; request: string; wallet: ManagerWalletRef; network?: string };

const validEvm = /^0x[a-fA-F0-9]{40}$/;
const validSolana = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const walletGoal = /\b(?:portfolio|holdings?|balances?|exposure|wallet\s+(?:activity|profile|analysis|transactions?)|analy[sz]e\s+(?:my\s+)?(?:watch(?:[-\s]+only)?\s+)?wallet|check\s+(?:(?:the|my)\s+)?(?:watch(?:[-\s]+only)?\s+)?wallet|monitor\s+(?:my\s+)?wallet)\b/i;
const walletMention = /\b(?:wallets?|watch(?:[-\s]+)only|connected\s+account|my\s+account|saved\s+account)\b/i;
const financialRequest = /\b(?:send|transfer|bridge|swap|withdraw|repay|borrow|deposit|sign|execute|approve)\b/i;
const followup = /^(?:the\s+)?(?:first|second|third|fourth|1st|2nd|3rd|4th|number\s+[1-4]|[1-4])(?:\s+(?:one|wallet))?[.!]?$/i;
const networkAliases: Array<[RegExp, string]> = [
  [/\barbitrum\s+sepolia\b/i,'arbitrum-sepolia'],
  [/\bbase\s+sepolia\b/i,'base-sepolia'],
  [/\bethereum\s+sepolia\b/i,'ethereum-sepolia'],
  [/\bbnb\s+testnet\b/i,'bnb-testnet'],
  [/\bsolana\s+devnet\b/i,'solana-devnet'],
  [/\b(arbitrum|base|ethereum|bnb|bsc|solana)\b/i,''],
];
function explicitNetwork(input: string): string | undefined {
  for (const [pattern, name] of networkAliases) {
    const match = input.match(pattern);
    if (match) return name || (match[1]!.toLowerCase() === 'bsc' ? 'bnb' : match[1]!.toLowerCase());
  }
  return undefined;
}
function numberedChoice(text: string): number | undefined {
  const m=text.trim().match(followup);
  if(!m)return undefined;
  const v=m[0].toLowerCase();
  if(/\b(?:first|1st|1)\b/.test(v))return 0;
  if(/\b(?:second|2nd|2)\b/.test(v))return 1;
  if(/\b(?:third|3rd|3)\b/.test(v))return 2;
  if(/\b(?:fourth|4th|4)\b/.test(v))return 3;
  return undefined;
}
function display(wallet: ManagerWalletRef): string {
  return `${wallet.name} (${wallet.mode}; ${wallet.address ? `${wallet.address.slice(0,6)}…${wallet.address.slice(-4)}` : 'not deployed'})`;
}
function quote(input: string): string { return input.trim().replace(/\s+/g,' ').slice(0,360); }

export function resolveManagerWalletResearch(
  current: string,
  history: readonly ManagerMessageRef[],
  wallets: readonly ManagerWalletRef[],
): WalletResearchResolution {
  let request=current.trim();
  const previous=history.slice(0,-1);
  const lastAssistant=[...previous].reverse().find(m=>m.role==='manager');
  const hadChoice=lastAssistant?.content.startsWith('Which saved wallet should I inspect for this request?') ?? false;
  const ordinal=numberedChoice(request);
  const isFollowup=hadChoice && (ordinal!==undefined || request.length<100);
  if(isFollowup){
    const prior=[...previous].reverse().find(m=>m.role==='user' && walletGoal.test(m.content));
    if(prior)request=prior.content;
  } else if (/^(?:focus on|what about|also check|only show|and check|summarize)\b/i.test(request) && !financialRequest.test(request)) {
    // Revalidate the persisted conversation reference against CURRENT owner-scoped wallets.
    const priorUser=[...previous].reverse().find(m=>m.role==='user');
    const recentManager=priorUser && (walletGoal.test(priorUser.content) || /^(?:focus on|what about|also check|only show|and check|summarize)\b/i.test(priorUser.content))
      ? [...previous.slice(-6)].reverse().find(m=>m.role==='manager' && m.content.includes('Wallet research target: '))
      : undefined;
    const address=recentManager?.content.match(/Wallet research target: (0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})\./)?.[1];
    const priorWallet=address ? wallets.find(w=>w.address?.toLowerCase()===address.toLowerCase()) : undefined;
    if (priorWallet)request=`Check the portfolio of my wallet named ${priorWallet.name}. ${request}`;
  }
  if(financialRequest.test(request) || !walletGoal.test(request) || (!walletMention.test(request) && !/\b(?:my\s+portfolio|portfolio\s+of\s+my)\b/i.test(request)))return {kind:'not-wallet-research'};
  const active=wallets.filter(w=>w.address && ((w.namespace==='eip155'&&validEvm.test(w.address))||(w.namespace==='solana'&&validSolana.test(w.address))));
  let candidates=active;
  const explicitMode=/watch(?:[-\s]+)only|watch\s+wallet|read[-\s]*only/i.test(request)?'watch-only':/connected\s+(?:wallet|account)/i.test(request)?'connected':/agent\s+account/i.test(request)?'agent-account':undefined;
  if(explicitMode)candidates=candidates.filter(w=>w.mode===explicitMode);
  if(!candidates.length){
    const label=explicitMode==='watch-only'?'watch-only':explicitMode==='connected'?'connected':'saved';
    return {kind:'clarify',message:`I couldn't find an eligible ${label} wallet address in your AgentPlace account. Open Wallets & Accounts to add or check one. I haven't fetched portfolio data or requested signing authority.`};
  }
  const selector=isFollowup?current.trim():request;
  const nameMatch=selector.match(/\bwallet\s+(?:named|called)\s+["“]?([^"”.,!?]+)["”]?/i)?.[1]?.trim();
  const exact=nameMatch?candidates.filter(w=>{ const named=nameMatch.toLowerCase(); const matches=(value:string)=>named===value.toLowerCase()||(named.startsWith(value.toLowerCase())&&/^(?:\s+(?:portfolio|balances?|holdings?|on|and|please|for|to|with)\b|$)/i.test(named.slice(value.length))); return matches(w.name)||matches(w.id); }):[];
  const userNamed=!nameMatch?candidates.filter(w=>new RegExp(`(^|[^a-z0-9])${w.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}($|[^a-z0-9])`,'i').test(selector)):[];
  if(nameMatch && !exact.length)return {kind:'clarify',message:`I couldn't find a matching saved wallet named "${quote(nameMatch)}". Available wallets: ${candidates.map(display).join('; ')}. No account was substituted.`};
  if(exact.length)candidates=exact;
  else if(userNamed.length)candidates=userNamed;
  else if(ordinal!==undefined && isFollowup){
    if(ordinal>=candidates.length)return {kind:'clarify',message:`That option isn't in the list. Please choose one of these wallets: ${candidates.map((w,i)=>`${i+1}. ${display(w)}`).join('; ')}.`};
    candidates=[candidates[ordinal]!];
  }
  if(candidates.length!==1){
    return {kind:'clarify',message:`Which saved wallet should I inspect for this request? ${candidates.map((w,i)=>`${i+1}. ${display(w)}`).join('; ')}. Reply with the wallet's name or number. No funds will move.`};
  }
  const wallet=candidates[0]!;
  const network=explicitNetwork(request);
  const selection=`Saved AgentPlace wallet selected by trusted owner-scoped lookup: ${wallet.name}; mode=${wallet.mode}; namespace=${wallet.namespace}; address=${wallet.address}. Read-only portfolio research only; no wallet signature or financial authority.`;
  return {kind:'resolved',wallet,request:`${request}\n\n${selection}${network?`\nRequested network: ${network}.`:''}`, ...(network?{network}:{})};
}
