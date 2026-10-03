import { createHash, randomUUID } from 'node:crypto';
import { getDatabasePool } from '@agent-place/db';

export type IntelligenceSubjectKind = 'token' | 'wallet' | 'protocol' | 'stablecoin';
export interface IntelligenceSubject {
  kind: IntelligenceSubjectKind;
  query: string;
  network?: string;
  address?: string;
}

export interface IntelligenceInvocation {
  capabilityId: string;
  implementationId: string;
  provider: string;
}

export type IntelligenceEvidenceStatus = 'verified' | 'partial' | 'unavailable' | 'error';
export interface IntelligenceEvidence {
  id: string;
  jobId: string;
  taskId: string;
  capabilityId: string;
  implementationId: string;
  provider: string;
  subjectKind: IntelligenceSubjectKind;
  subjectQuery: string;
  network?: string;
  address?: string;
  status: IntelligenceEvidenceStatus;
  summary: string;
  data: Record<string, unknown>;
  sourceUrl?: string;
  observedAt: string;
  fetchedAt: string;
  freshnessSeconds?: number;
  providerConfidence?: number;
  derivationVersion?: string;
  limitations: string[];
}

type ResolvedToken = { query:string; network:string; address:string; symbol?:string; name?:string; sourceUrl?:string };
type JsonObject = Record<string, unknown>;

function env(name:string):string { return process.env[name]?.trim() ?? ''; }
function object(value:unknown):JsonObject { return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {}; }
function array(value:unknown):unknown[] { return Array.isArray(value) ? value : []; }
function string(value:unknown):string|undefined { return typeof value === 'string' ? value : undefined; }
function number(value:unknown):number|undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}
function normalizedNetwork(value:string|undefined):string {
  const v=(value??'').trim().toLowerCase().replace(/[_-]+/g,' ').replace(/\s+/g,' ');
  if(!v) return '';
  if(/\barbitrum\b/.test(v)&&/\bsepolia\b|\btestnet\b/.test(v)) return 'arbitrum-sepolia';
  if(/\bbase\b/.test(v)&&/\bsepolia\b|\btestnet\b/.test(v)) return 'base-sepolia';
  if(/\b(?:ethereum|eth)\b/.test(v)&&/\bsepolia\b|\bholesky\b|\btestnet\b/.test(v)) return v.includes('holesky')?'ethereum-holesky':'ethereum-sepolia';
  if(/\b(?:bnb|bsc|binance smart chain)\b/.test(v)&&/\btestnet\b/.test(v)) return 'bnb-testnet';
  if(/\bsolana\b/.test(v)&&/\bdevnet\b/.test(v)) return 'solana-devnet';
  if(/\bsolana\b/.test(v)&&/\btestnet\b/.test(v)) return 'solana-testnet';
  if(/\b42161\b/.test(v)||/\barbitrum\b/.test(v)||v==='arb'||v==='arb one') return 'arbitrum';
  if(/\b8453\b/.test(v)||/\bbase\b/.test(v)) return 'base';
  if(/\b56\b/.test(v)||/\bbnb\b/.test(v)||/\bbsc\b/.test(v)||/\bbinance smart chain\b/.test(v)) return 'bnb';
  if((/\b1\b/.test(v)&&/\b(?:chain|chain id|mainnet|ethereum|eth)\b/.test(v))||/\bethereum\b/.test(v)||v==='eth') return 'ethereum';
  if(/\bsolana\b/.test(v)||v==='sol') return 'solana';
  return v;
}
function dexscreenerNetwork(value:string):string { return value==='bnb'?'bsc':value; }
function bubblemapsNetwork(value:string):string { return value==='ethereum'?'eth':value==='bnb'?'bsc':value; }
function goPlusChain(value:string):string|undefined {
  return ({ethereum:'1',bnb:'56',arbitrum:'42161',base:'8453'} as Record<string,string>)[value];
}
function nansenNetwork(value:string):string { return value==='bnb'?'bnb':value; }
function etherscanChainId(value:string):string|undefined { return ({ethereum:'1',bnb:'56',arbitrum:'42161',base:'8453'} as Record<string,string>)[value]; }
function etherscanExplorer(value:string):string|undefined { return ({ethereum:'https://etherscan.io',bnb:'https://bscscan.com',arbitrum:'https://arbiscan.io',base:'https://basescan.org'} as Record<string,string>)[value]; }
function blockscoutRoot(value:string):string|undefined { return ({ethereum:'https://eth.blockscout.com',base:'https://base.blockscout.com',arbitrum:'https://arbitrum.blockscout.com'} as Record<string,string>)[value]; }
function alchemyPortfolioNetwork(value:string):string|undefined { return ({ethereum:'eth-mainnet',base:'base-mainnet',arbitrum:'arb-mainnet',bnb:'bnb-mainnet',solana:'sol-mainnet'} as Record<string,string>)[value]; }
function jsonExcerpt(value:unknown, max=12000):JsonObject {
  const text=JSON.stringify(value);
  if (text.length<=max) return object(value);
  return { truncated:true, sha256:createHash('sha256').update(text).digest('hex'), excerpt:text.slice(0,max) };
}
function safeUrl(raw:string):string { try { const u=new URL(raw); for(const key of ['x_cg_demo_api_key','x_cg_pro_api_key','api_key','apikey','key']) u.searchParams.delete(key); return u.toString(); } catch { return raw; } }
function headers(extra:Record<string,string>={}):HeadersInit { return { accept:'application/json', ...extra }; }
function timeoutMs():number { return Math.max(5000, Number.parseInt(env('INTELLIGENCE_PROVIDER_TIMEOUT_MS')||'20000',10)||20000); }
async function fetchJson(url:string, init:RequestInit={}):Promise<unknown> {
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),timeoutMs());
  try {
    const response=await fetch(url,{...init,signal:controller.signal}); const text=await response.text();
    if(!response.ok) throw new Error(`HTTP_${response.status}:${text.slice(0,300)}`);
    return text?JSON.parse(text) as unknown:{};
  } finally { clearTimeout(timer); }
}

async function rpcJson(url:string, method:string, params:unknown):Promise<JsonObject> {
  const payload=object(await fetchJson(url,{method:'POST',headers:headers({'content-type':'application/json'}),body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})}));
  if(payload.error) throw new Error(`RPC_${method}:${JSON.stringify(payload.error).slice(0,300)}`);
  return payload;
}
function bigint(value:unknown):bigint|undefined {
  if(typeof value==='bigint') return value;
  if(typeof value==='number'&&Number.isFinite(value)&&Number.isInteger(value)&&value>=0) return BigInt(value);
  if(typeof value==='string'&&/^\d+$/.test(value.trim())) { try { return BigInt(value.trim()); } catch { return undefined; } }
  return undefined;
}
function concentrationMetrics(rawBalances:readonly bigint[], totalSupply:bigint):Record<string,unknown> {
  if(totalSupply<=0n) return {};
  const sorted=[...rawBalances].filter((value)=>value>=0n).sort((a,b)=>a===b?0:a>b?-1:1);
  const pct=(count:number)=>{ const sum=sorted.slice(0,count).reduce((acc,value)=>acc+value,0n); return Number((sum*1000000n)/totalSupply)/10000; };
  return {top1Pct:pct(1),top5Pct:pct(5),top10Pct:pct(10),top20Pct:pct(20),sampledHolders:sorted.length};
}
function intelligenceDependencyRank(capabilityId:string):number {
  if(capabilityId==='token.deployer.analyze') return 0;
  if(capabilityId==='wallet.activity.analyze') return 2;
  return 1;
}
function bindWalletSubjectFromPriorEvidence(subject:IntelligenceSubject, prior:readonly IntelligenceEvidence[]):IntelligenceSubject {
  if(subject.kind!=='wallet'||subject.address?.trim()||!/\b(?:creator|deployer)\b/i.test(subject.query)) return subject;
  const requestedNetwork=normalizedNetwork(subject.network);
  const candidates=prior
    .filter((item)=>item.capabilityId==='token.deployer.analyze'&&item.status==='verified'&&(!requestedNetwork||item.network===requestedNetwork))
    .map((item)=>({address:string(item.data.creator),network:item.network}))
    .filter((item):item is {address:string;network:string|undefined}=>!!item.address&&/^0x[a-fA-F0-9]{40}$/.test(item.address));
  const unique=[...new Map(candidates.map((item)=>[`${item.network??''}:${item.address.toLowerCase()}`,item])).values()];
  if(unique.length!==1) return subject;
  const match=unique[0]!;
  return {...subject,address:match.address,...(!subject.network?.trim()&&match.network?{network:match.network}:{})};
}

async function resolveToken(subject:IntelligenceSubject):Promise<ResolvedToken|null> {
  const query=subject.query.trim(); const requested=normalizedNetwork(subject.network);
  if(subject.address?.trim() && requested) return {query,network:requested,address:subject.address.trim()};
  if (/^0x[a-fA-F0-9]{40}$/.test(query) && requested) return {query,network:requested,address:query};
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(query) && (requested==='solana'||!requested)) return {query,network:'solana',address:query};
  const payload=object(await fetchJson(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`,{headers:headers()}));
  const pairs=array(payload.pairs).map(object).filter((pair)=>pair.pairAddress);
  const exact=pairs.filter((pair)=>{
    const chain=normalizedNetwork(string(pair.chainId)); if(requested && chain!==requested) return false;
    const base=object(pair.baseToken); const quote=object(pair.quoteToken);
    const q=query.toLowerCase();
    return [string(base.symbol),string(base.name),string(base.address),string(quote.symbol),string(quote.name),string(quote.address)].some((v)=>v?.toLowerCase()===q);
  });
  const pool=(exact.length?exact:pairs.filter((pair)=>!requested||normalizedNetwork(string(pair.chainId))===requested))
    .sort((a,b)=>(number(object(b.liquidity).usd)??0)-(number(object(a.liquidity).usd)??0))[0];
  if(!pool) return null;
  const base=object(pool.baseToken); const quote=object(pool.quoteToken); const q=query.toLowerCase();
  const token=[base,quote].find((candidate)=>[string(candidate.symbol),string(candidate.name),string(candidate.address)].some((v)=>v?.toLowerCase()===q)) ?? base;
  const address=string(token.address); if(!address) return null;
  const symbol=string(token.symbol); const name=string(token.name); const sourceUrl=string(pool.url);
  return {query,network:normalizedNetwork(string(pool.chainId)),address,...(symbol?{symbol}:{}),...(name?{name}:{}),...(sourceUrl?{sourceUrl}:{})};
}

function evidenceBase(args:{jobId:string;taskId:string;invocation:IntelligenceInvocation;subject:IntelligenceSubject;resolved?:ResolvedToken|null}):Omit<IntelligenceEvidence,'id'|'status'|'summary'|'data'|'observedAt'|'fetchedAt'|'limitations'> {
  const network=args.resolved?.network || normalizedNetwork(args.subject.network); const address=args.resolved?.address || args.subject.address?.trim();
  return { jobId:args.jobId,taskId:args.taskId,capabilityId:args.invocation.capabilityId,implementationId:args.invocation.implementationId,provider:args.invocation.provider,subjectKind:args.subject.kind,subjectQuery:args.subject.query,...(network?{network}:{}),...(address?{address}:{}) };
}
function makeEvidence(base:ReturnType<typeof evidenceBase>, args:{status:IntelligenceEvidenceStatus;summary:string;data?:Record<string,unknown>;sourceUrl?:string;limitations?:string[];observedAt?:string;freshnessSeconds?:number;providerConfidence?:number;derivationVersion?:string}):IntelligenceEvidence {
  const fetchedAt=new Date().toISOString(); return {id:`iev_${randomUUID()}`,...base,status:args.status,summary:args.summary,data:args.data??{},...(args.sourceUrl?{sourceUrl:safeUrl(args.sourceUrl)}:{}),observedAt:args.observedAt??fetchedAt,fetchedAt,...(args.freshnessSeconds===undefined?{}:{freshnessSeconds:args.freshnessSeconds}),...(args.providerConfidence===undefined?{}:{providerConfidence:args.providerConfidence}),...(args.derivationVersion?{derivationVersion:args.derivationVersion}:{}),limitations:args.limitations??[]};
}

async function dexScreener(invocation:IntelligenceInvocation, subject:IntelligenceSubject, base:ReturnType<typeof evidenceBase>, resolved:ResolvedToken|null):Promise<IntelligenceEvidence> {
  if(!resolved) return makeEvidence(base,{status:'unavailable',summary:'Token address/network could not be resolved for DEX market data.',limitations:['A unique token/network or contract address is required.']});
  const url=`https://api.dexscreener.com/token-pairs/v1/${encodeURIComponent(dexscreenerNetwork(resolved.network))}/${encodeURIComponent(resolved.address)}`;
  const rows=array(await fetchJson(url,{headers:headers()})).map(object).sort((a,b)=>(number(object(b.liquidity).usd)??0)-(number(object(a.liquidity).usd)??0));
  const top=rows[0]; if(!top) return makeEvidence(base,{status:'unavailable',summary:'DEX Screener returned no pools for this token.',sourceUrl:resolved.sourceUrl??url});
  const liquidity=number(object(top.liquidity).usd); const volume24h=number(object(top.volume).h24); const price=number(top.priceUsd); const marketCap=number(top.marketCap); const fdv=number(top.fdv);
  const facts={symbol:string(object(top.baseToken).symbol),priceUsd:price,liquidityUsd:liquidity,volume24hUsd:volume24h,marketCapUsd:marketCap,fdvUsd:fdv,priceChange:top.priceChange,txns:top.txns,pairAddress:string(top.pairAddress),dexId:string(top.dexId),poolCount:rows.length};
  return makeEvidence(base,{status:'verified',summary:`DEX market data: price ${price??'n/a'} USD; top-pool liquidity ${liquidity??'n/a'} USD; 24h volume ${volume24h??'n/a'} USD.`,data:facts,sourceUrl:string(top.url)??resolved.sourceUrl??url,limitations:['Liquidity and volume are pool/DEX observations and may not represent all venues.']});
}

async function coinGecko(invocation:IntelligenceInvocation, subject:IntelligenceSubject, base:ReturnType<typeof evidenceBase>, resolved:ResolvedToken|null):Promise<IntelligenceEvidence> {
  const proKey=env('COINGECKO_API_KEY'); const demoKey=env('COINGECKO_DEMO_API_KEY'); const key=proKey||demoKey; if(!key) return makeEvidence(base,{status:'unavailable',summary:'CoinGecko API key is not configured.'});
  const h=headers({[proKey?'x-cg-pro-api-key':'x-cg-demo-api-key']:key}); const apiBase=proKey?'https://pro-api.coingecko.com/api/v3':'https://api.coingecko.com/api/v3';
  const search=object(await fetchJson(`${apiBase}/search?query=${encodeURIComponent(subject.query)}`,{headers:h}));
  const coins=array(search.coins).map(object); const q=subject.query.toLowerCase(); const coin=coins.find((c)=>string(c.symbol)?.toLowerCase()===q)||coins.find((c)=>string(c.name)?.toLowerCase()===q)||coins[0];
  const id=coin&&string(coin.id); if(!id) return makeEvidence(base,{status:'unavailable',summary:'CoinGecko could not resolve the requested asset.'});
  const price=object(await fetchJson(`${apiBase}/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true&include_last_updated_at=true`,{headers:h}));
  const row=object(price[id]);
  return makeEvidence(base,{status:'verified',summary:`CoinGecko market snapshot for ${string(coin.name)??subject.query}: ${number(row.usd)??'n/a'} USD.`,data:{coinId:id,name:string(coin.name),symbol:string(coin.symbol),market:row,resolvedAddress:resolved?.address},sourceUrl:`https://www.coingecko.com/en/coins/${encodeURIComponent(id)}`,limitations:['Market aggregates can differ across venues and update intervals.']});
}

async function defillama(invocation:IntelligenceInvocation, subject:IntelligenceSubject, base:ReturnType<typeof evidenceBase>):Promise<IntelligenceEvidence> {
  if(invocation.capabilityId==='protocol.tvl.read'||invocation.capabilityId==='protocol.metrics.read') {
    const protocols=array(await fetchJson('https://api.llama.fi/protocols',{headers:headers()})).map(object); const q=subject.query.toLowerCase();
    const row=protocols.find((p)=>string(p.slug)?.toLowerCase()===q)||protocols.find((p)=>string(p.name)?.toLowerCase()===q)||protocols.find((p)=>string(p.name)?.toLowerCase().includes(q));
    if(!row) return makeEvidence(base,{status:'unavailable',summary:'DefiLlama could not resolve this protocol.'});
    return makeEvidence(base,{status:'verified',summary:`DefiLlama protocol snapshot: TVL ${number(row.tvl)??'n/a'} USD for ${string(row.name)??subject.query}.`,data:jsonExcerpt(row),sourceUrl:`https://defillama.com/protocol/${encodeURIComponent(string(row.slug)??subject.query)}`,limitations:['TVL is a provider-normalized protocol metric and should not be treated as solvency or safety.']});
  }
  if(invocation.capabilityId==='protocol.yield.read') {
    const payload=object(await fetchJson('https://yields.llama.fi/pools',{headers:headers()})); const q=subject.query.toLowerCase();
    const pools=array(payload.data).map(object).filter((p)=>[string(p.project),string(p.symbol),string(p.chain)].some((v)=>v?.toLowerCase().includes(q))).sort((a,b)=>(number(b.tvlUsd)??0)-(number(a.tvlUsd)??0)).slice(0,10);
    return makeEvidence(base,{status:pools.length?'verified':'unavailable',summary:pools.length?`DefiLlama returned ${pools.length} relevant yield pools; highest-TVL pool APY ${number(pools[0]?.apy)??'n/a'}%.`:'No matching DefiLlama yield pools were found.',data:{pools:jsonExcerpt(pools)},sourceUrl:'https://defillama.com/yields',limitations:['Displayed APY may include incentives and can change quickly; it is not a guarantee of return.']});
  }
  const payload=object(await fetchJson('https://stablecoins.llama.fi/stablecoins?includePrices=true',{headers:headers()})); const q=subject.query.toLowerCase();
  const assets=array(payload.peggedAssets).map(object); const row=assets.find((p)=>string(p.symbol)?.toLowerCase()===q)||assets.find((p)=>string(p.name)?.toLowerCase()===q)||assets.find((p)=>string(p.name)?.toLowerCase().includes(q));
  return makeEvidence(base,{status:row?'verified':'unavailable',summary:row?`DefiLlama stablecoin snapshot for ${string(row.symbol)??subject.query}.`:'DefiLlama could not resolve this stablecoin.',data:row?jsonExcerpt(row):{},sourceUrl:'https://defillama.com/stablecoins',limitations:['Supply and peg data are provider-normalized observations, not an audit of reserves.']});
}

async function nansen(invocation:IntelligenceInvocation, subject:IntelligenceSubject, base:ReturnType<typeof evidenceBase>, resolved:ResolvedToken|null):Promise<IntelligenceEvidence> {
  const key=env('NANSEN_API_KEY'); if(!key) return makeEvidence(base,{status:'unavailable',summary:'Nansen API key is not configured.'});
  const h=headers({'apiKey':key,'content-type':'application/json'}); const network=nansenNetwork(resolved?.network||normalizedNetwork(subject.network)); const address=resolved?.address||subject.address?.trim()||(/^0x[a-fA-F0-9]{40}$/.test(subject.query)||/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(subject.query)?subject.query:'');
  if(!network||!address) return makeEvidence(base,{status:'unavailable',summary:'Nansen requires a resolved network and address for this capability.'});
  let path=''; let body:JsonObject={};
  if(invocation.capabilityId==='token.holders.analyze') { path='/api/v1/tgm/holders'; body={chain:network,token_address:address,aggregate_by_entity:false,label_type:'all_holders',pagination:{page:1,per_page:20},order_by:[{field:'token_amount',direction:'DESC'}]}; }
  else if(invocation.capabilityId==='smartmoney.flow.read'||invocation.capabilityId==='token.smartmoney.read'||invocation.capabilityId==='smartmoney.accumulation.detect') { path='/api/v1/tgm/flow-intelligence'; body={chain:network,token_address:address}; }
  else if(invocation.capabilityId==='wallet.performance.analyze') { const to=new Date(); const from=new Date(to.getTime()-90*86400000); path='/api/v1/profiler/address/pnl-summary'; body={address,chain:network,date:{from:from.toISOString(),to:to.toISOString()}}; }
  else if(invocation.capabilityId==='wallet.activity.analyze') { const to=new Date(); const from=new Date(to.getTime()-30*86400000); path='/api/v1/profiler/address/transactions'; body={address,chain:network,date:{from:from.toISOString(),to:to.toISOString()},hide_spam_token:true,pagination:{page:1,per_page:20},order_by:[{field:'block_timestamp',direction:'DESC'}]}; }
  else if(invocation.capabilityId==='wallet.cluster.analyze') { path='/api/v1/profiler/address/related-wallets'; body={address,chain:network,pagination:{page:1,per_page:20},order_by:[{field:'order',direction:'ASC'}]}; }
  else { path='/api/v1/profiler/address/current-balance'; body={address,chain:network}; }
  const payload=await fetchJson(`https://api.nansen.ai${path}`,{method:'POST',headers:h,body:JSON.stringify(body)});
  const d=object(payload); const rows=array(d.data); const status=rows.length||Object.keys(object(d.data)).length?'verified':'partial';
  return makeEvidence(base,{status,summary:`Nansen ${invocation.capabilityId} returned ${rows.length||Object.keys(object(d.data)).length} structured record(s).`,data:jsonExcerpt(payload),sourceUrl:'https://app.nansen.ai',limitations:[invocation.capabilityId==='wallet.cluster.analyze'?'Related-wallet evidence shows first-degree relationships; it does not prove common ownership.':'Nansen labels/segments are provider-defined intelligence and should be attributed as such.']});
}

let goPlusTokenCache:{token:string;expiresAt:number}|null=null;
async function goPlusAccessToken():Promise<string> {
  const staticToken=env('GOPLUS_ACCESS_TOKEN'); if(staticToken) return staticToken;
  const appKey=env('GOPLUS_APP_KEY'); const appSecret=env('GOPLUS_APP_SECRET');
  if(!appKey||!appSecret) return '';
  if(goPlusTokenCache && goPlusTokenCache.expiresAt>Date.now()) return goPlusTokenCache.token;
  const time=Math.floor(Date.now()/1000);
  const sign=createHash('sha1').update(`${appKey}${time}${appSecret}`).digest('hex');
  const payload=object(await fetchJson('https://api.gopluslabs.io/api/v1/token',{method:'POST',headers:headers({'content-type':'application/json'}),body:JSON.stringify({app_key:appKey,sign,time})}));
  const result=object(payload.result); const token=string(result.access_token); const expiresIn=number(result.expires_in);
  if(!token) throw new Error(`GoPlus token exchange returned no access token (code=${number(payload.code)??'unknown'} message=${string(payload.message)??'unknown'}).`);
  if(expiresIn && expiresIn>0) {
    const lifetimeMs=expiresIn*1000; const refreshSkewMs=Math.min(60000,Math.max(5000,lifetimeMs*0.1));
    goPlusTokenCache={token,expiresAt:Date.now()+Math.max(1000,lifetimeMs-refreshSkewMs)};
  }
  return token;
}

async function goPlus(invocation:IntelligenceInvocation, subject:IntelligenceSubject, base:ReturnType<typeof evidenceBase>, resolved:ResolvedToken|null):Promise<IntelligenceEvidence> {
  if(!resolved) return makeEvidence(base,{status:'unavailable',summary:'GoPlus requires a resolved token address and network.'});
  const token=await goPlusAccessToken(); if(!token) return makeEvidence(base,{status:'unavailable',summary:'GoPlus credentials are not configured.'});
  const h=headers({Authorization:`Bearer ${token}`}); const chain=goPlusChain(resolved.network); let url='';
  if(resolved.network==='solana') url=`https://api.gopluslabs.io/api/v1/solana/token_security?contract_addresses=${encodeURIComponent(resolved.address)}`;
  else if(chain) url=`https://api.gopluslabs.io/api/v1/token_security/${chain}?contract_addresses=${encodeURIComponent(resolved.address)}`;
  else return makeEvidence(base,{status:'unavailable',summary:`GoPlus adapter does not map network ${resolved.network}.`});
  const payload=object(await fetchJson(url,{headers:h})); const result=object(payload.result); const row=object(result[resolved.address.toLowerCase()]??result[resolved.address]??Object.values(result)[0]);
  const summary=invocation.capabilityId==='token.deployer.analyze'
    ? `GoPlus deployer/owner snapshot: creator ${string(row.creator_address)??'unknown'}; owner ${string(row.owner_address)??'unknown'}.`
    : `GoPlus token-security snapshot returned ${Object.keys(row).length} risk/contract fields.`;
  return makeEvidence(base,{status:Object.keys(row).length?'verified':'partial',summary,data:jsonExcerpt(row),sourceUrl:'https://gopluslabs.io/token-security',limitations:['GoPlus fields are security signals, not a guarantee that a token is safe or malicious.']});
}

async function bubblemaps(invocation:IntelligenceInvocation, subject:IntelligenceSubject, base:ReturnType<typeof evidenceBase>, resolved:ResolvedToken|null):Promise<IntelligenceEvidence> {
  const key=env('BUBBLEMAPS_API_KEY'); if(!key) return makeEvidence(base,{status:'unavailable',summary:'Bubblemaps API key is not configured.'});
  if(!resolved) return makeEvidence(base,{status:'unavailable',summary:'Bubblemaps requires a resolved token address and network.'});
  const chain=bubblemapsNetwork(resolved.network); const map=invocation.capabilityId==='wallet.cluster.analyze'; const url=`https://api.bubblemaps.io/v0/tokens/${map?'map':'holders'}/${encodeURIComponent(chain)}/${encodeURIComponent(resolved.address)}${map?'?use_magic_nodes=true&return_metadata=true':'?limit=80&return_metadata=true'}`;
  const payload=await fetchJson(url,{headers:headers({'X-API-Key':key})}); const rows=array(payload); const obj=object(payload);
  return makeEvidence(base,{status:rows.length||Object.keys(obj).length?'verified':'partial',summary:`Bubblemaps returned ${rows.length||Object.keys(obj).length} holder/map records.`,data:jsonExcerpt(payload),sourceUrl:`https://app.bubblemaps.io/${encodeURIComponent(chain)}/token/${encodeURIComponent(resolved.address)}`,limitations:[map?'Clusters/links show observed address relationships; they do not establish common ownership.':'Holder distribution is a point-in-time provider observation.']});
}

async function birdeye(invocation:IntelligenceInvocation, subject:IntelligenceSubject, base:ReturnType<typeof evidenceBase>, resolved:ResolvedToken|null):Promise<IntelligenceEvidence> {
  const key=env('BIRDEYE_API_KEY'); if(!key) return makeEvidence(base,{status:'unavailable',summary:'Birdeye API key is not configured.'});
  if(!resolved||resolved.network!=='solana') return makeEvidence(base,{status:'unavailable',summary:'The M5B.1 Birdeye adapter is limited to resolved Solana tokens.'});
  const common=headers({'X-API-KEY':key,'x-chain':'solana'}); let path='';
  if(invocation.capabilityId==='token.market.read'||invocation.capabilityId==='token.liquidity.analyze') path=`/defi/token_overview?address=${encodeURIComponent(resolved.address)}`;
  else if(invocation.capabilityId==='token.holders.analyze') path=`/defi/v3/token/holder?address=${encodeURIComponent(resolved.address)}&offset=0&limit=100`;
  else return makeEvidence(base,{status:'unavailable',summary:'This Birdeye capability requires a provider endpoint not enabled in M5B.1.'});
  const url=`https://public-api.birdeye.so${path}`; const payload=await fetchJson(url,{headers:common});
  return makeEvidence(base,{status:'verified',summary:`Birdeye returned Solana ${invocation.capabilityId} intelligence.`,data:jsonExcerpt(payload),sourceUrl:`https://birdeye.so/token/${encodeURIComponent(resolved.address)}?chain=solana`,limitations:['Birdeye enrichment is provider-specific and is corroborative rather than sole proof of token safety.']});
}

async function etherscan(invocation:IntelligenceInvocation, subject:IntelligenceSubject, base:ReturnType<typeof evidenceBase>, resolved:ResolvedToken|null):Promise<IntelligenceEvidence> {
  const key=env('ETHERSCAN_API_KEY'); if(!key) return makeEvidence(base,{status:'unavailable',summary:'Etherscan API key is not configured.'});
  const network=resolved?.network||normalizedNetwork(subject.network); const chainId=etherscanChainId(network); const explorer=etherscanExplorer(network);
  if(!chainId||!explorer) return makeEvidence(base,{status:'unavailable',summary:`Etherscan V2 is not mapped for ${network||'the unresolved network'}.`});
  const api='https://api.etherscan.io/v2/api';
  if(invocation.capabilityId==='token.deployer.analyze') {
    if(!resolved) return makeEvidence(base,{status:'unavailable',summary:'Etherscan deployer analysis requires a resolved EVM token contract.'});
    const creation=object(await fetchJson(`${api}?chainid=${chainId}&module=contract&action=getcontractcreation&contractaddresses=${encodeURIComponent(resolved.address)}&apikey=${encodeURIComponent(key)}`,{headers:headers()}));
    const rows=array(creation.result).map(object); const row=rows[0]; const creator=string(row?.contractCreator)||string(row?.contractCreatorAddress); const txHash=string(row?.txHash)||string(row?.transactionHash);
    if(!creator) return makeEvidence(base,{status:'unavailable',summary:'Etherscan returned no contract-creator record for this token.',data:jsonExcerpt(creation),sourceUrl:`${explorer}/address/${encodeURIComponent(resolved.address)}`});
    const history=object(await fetchJson(`${api}?chainid=${chainId}&module=account&action=txlist&address=${encodeURIComponent(creator)}&startblock=0&endblock=99999999&page=1&offset=25&sort=asc&apikey=${encodeURIComponent(key)}`,{headers:headers()}));
    const txs=array(history.result).map(object).slice(0,25);
    return makeEvidence(base,{status:'verified',summary:`Etherscan identifies ${creator} as the contract creator; ${txs.length} earliest public transactions were preserved for deployer context.`,data:{contractAddress:resolved.address,creator,creationTxHash:txHash??null,creatorEarlyTransactions:txs},sourceUrl:`${explorer}/address/${encodeURIComponent(resolved.address)}`,limitations:['Contract creator evidence does not establish real-world identity, beneficial ownership, or malicious intent.','The preserved transaction sample is bounded and is not an exhaustive deployer-history audit.']});
  }
  if(invocation.capabilityId==='wallet.activity.analyze') {
    const address=subject.address?.trim()||(/^0x[a-fA-F0-9]{40}$/.test(subject.query)?subject.query:''); if(!address) return makeEvidence(base,{status:'unavailable',summary:'Etherscan wallet activity requires an EVM address.'});
    const [normal,erc20]=await Promise.all([
      fetchJson(`${api}?chainid=${chainId}&module=account&action=txlist&address=${encodeURIComponent(address)}&startblock=0&endblock=99999999&page=1&offset=25&sort=desc&apikey=${encodeURIComponent(key)}`,{headers:headers()}),
      fetchJson(`${api}?chainid=${chainId}&module=account&action=tokentx&address=${encodeURIComponent(address)}&startblock=0&endblock=99999999&page=1&offset=25&sort=desc&apikey=${encodeURIComponent(key)}`,{headers:headers()}),
    ]);
    const normalRows=array(object(normal).result).map(object); const tokenRows=array(object(erc20).result).map(object);
    return makeEvidence(base,{status:'verified',summary:`Etherscan returned ${normalRows.length} recent normal transactions and ${tokenRows.length} recent ERC-20 transfers for this wallet.`,data:{normalTransactions:normalRows,erc20Transfers:tokenRows},sourceUrl:`${explorer}/address/${encodeURIComponent(address)}`,limitations:['This is a bounded recent-activity sample, not a complete behavioral or performance assessment.','Transaction activity does not establish wallet identity or intent.']});
  }
  return makeEvidence(base,{status:'unavailable',summary:`Etherscan adapter does not implement ${invocation.capabilityId}.`});
}

async function alchemy(invocation:IntelligenceInvocation, subject:IntelligenceSubject, base:ReturnType<typeof evidenceBase>, resolved:ResolvedToken|null):Promise<IntelligenceEvidence> {
  const key=env('ALCHEMY_API_KEY'); if(!key) return makeEvidence(base,{status:'unavailable',summary:'Alchemy API key is not configured.'});
  if(invocation.capabilityId==='token.holders.analyze') {
    if(!resolved||resolved.network!=='solana') return makeEvidence(base,{status:'unavailable',summary:'Alchemy holder concentration in M5B.1 is currently limited to resolved Solana tokens.'});
    const rpc=`https://solana-mainnet.g.alchemy.com/v2/${encodeURIComponent(key)}`; const slotPayload=await rpcJson(rpc,'getSlot',[]); const slot=number(slotPayload.result); if(slot===undefined) return makeEvidence(base,{status:'unavailable',summary:'Alchemy did not return a current Solana slot.'});
    const [holdersPayload,supplyPayload]=await Promise.all([rpcJson(rpc,'getTokenHoldersAtSlot',{mint:resolved.address,slot,limit:1000,sortBy:'balance_desc'}),rpcJson(rpc,'getTokenSupply',[resolved.address])]);
    const holders=array(object(holdersPayload.result).holders).map(object); const supply=object(object(supplyPayload.result).value); const totalSupplyRaw=bigint(supply.amount); const balances=holders.map((row)=>bigint(row.balanceRaw)).filter((value):value is bigint=>value!==undefined);
    const concentration=totalSupplyRaw===undefined?{}:concentrationMetrics(balances,totalSupplyRaw);
    const topHolders=holders.slice(0,20).map((row)=>({holder:string(row.holder),owner:string(row.owner),balanceRaw:string(row.balanceRaw),balanceUi:string(row.balanceUi)}));
    const concentrationSummary=`top-1 ${number(concentration.top1Pct)??'n/a'}%; top-5 ${number(concentration.top5Pct)??'n/a'}%; top-10 ${number(concentration.top10Pct)??'n/a'}%; top-20 ${number(concentration.top20Pct)??'n/a'}%`;
    return makeEvidence(base,{status:holders.length?'verified':'partial',summary:holders.length?`Alchemy returned ${holders.length} ranked Solana token holders; AgentPlace calculated ${concentrationSummary}.`:'Alchemy returned no holder rows for this Solana token.',data:{slot,totalSupplyRaw:string(supply.amount),decimals:number(supply.decimals),uiAmountString:string(supply.uiAmountString),concentration,topHolders},sourceUrl:'https://www.alchemy.com/docs/chains/solana/solana-api-endpoints/get-token-holders-at-slot',limitations:['Concentration is an AgentPlace deterministic calculation from provider-returned balances and token supply.','Holder addresses are not identity claims; program, LP, treasury, burn or exchange addresses are not automatically excluded.']});
  }
  if(invocation.capabilityId==='wallet.profile') {
    const address=subject.address?.trim()||subject.query.trim(); if(!address) return makeEvidence(base,{status:'unavailable',summary:'Alchemy wallet profile requires an address.'});
    const requested=normalizedNetwork(subject.network); const networks=requested?[alchemyPortfolioNetwork(requested)].filter((value):value is string=>!!value):['eth-mainnet','base-mainnet','arb-mainnet','bnb-mainnet','sol-mainnet'];
    if(!networks.length) return makeEvidence(base,{status:'unavailable',summary:`Alchemy Portfolio API is not mapped for ${requested}.`});
    const payload=object(await fetchJson(`https://api.g.alchemy.com/data/v1/${encodeURIComponent(key)}/assets/tokens/by-address`,{method:'POST',headers:headers({'content-type':'application/json'}),body:JSON.stringify({addresses:[{address,networks}],withMetadata:true,withPrices:true,includeNativeTokens:true,includeErc20Tokens:true,includeBlockMetadata:false})}));
    const tokens=array(object(payload.data).tokens).map(object); const partialErrors=array(object(payload.error).partialErrors);
    return makeEvidence(base,{status:tokens.length?'verified':partialErrors.length?'partial':'unavailable',summary:`Alchemy returned ${tokens.length} current token-balance record(s) across ${networks.length} requested network(s).`,data:{tokens:tokens.slice(0,100),partialErrors},sourceUrl:'https://www.alchemy.com/docs/data/portfolio-apis/portfolio-api-endpoints/portfolio-api-endpoints/get-tokens-by-address',limitations:['Portfolio data is current provider-indexed state and is not a performance score or ownership attribution.','Partial network errors are preserved rather than silently discarded.']});
  }
  if(invocation.capabilityId==='wallet.activity.analyze') {
    const network=normalizedNetwork(subject.network); const address=subject.address?.trim()||subject.query.trim(); if(network!=='solana'||!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) return makeEvidence(base,{status:'unavailable',summary:'Alchemy wallet activity in M5B.1 is currently limited to a resolved Solana wallet address.'});
    const rpc=`https://solana-mainnet.g.alchemy.com/v2/${encodeURIComponent(key)}`; const payload=await rpcJson(rpc,'getSignaturesForAddress',[address,{limit:50}]); const rows=array(payload.result).map(object);
    return makeEvidence(base,{status:rows.length?'verified':'partial',summary:`Alchemy returned ${rows.length} recent Solana signatures for this wallet.`,data:{signatures:rows},sourceUrl:'https://www.alchemy.com/docs/solana/solana-api-overview',limitations:['Signature history is a bounded activity sample and is not a wallet-performance or identity assessment.']});
  }
  return makeEvidence(base,{status:'unavailable',summary:`Alchemy adapter does not implement ${invocation.capabilityId}.`});
}

async function theGraph(invocation:IntelligenceInvocation, subject:IntelligenceSubject, base:ReturnType<typeof evidenceBase>):Promise<IntelligenceEvidence> {
  const key=env('THEGRAPH_API_KEY'); const subgraphId=env('THEGRAPH_UNISWAP_V3_ARBITRUM_SUBGRAPH_ID');
  if(!key||!subgraphId) return makeEvidence(base,{status:'unavailable',summary:'The Graph Uniswap V3 Arbitrum connector is not configured.'});
  const network=normalizedNetwork(subject.network); if(network!=='arbitrum'||!/uniswap/i.test(subject.query)) return makeEvidence(base,{status:'unavailable',summary:'This schema-pinned The Graph connector is limited to Uniswap V3 on Arbitrum.'});
  const query='query AgentPlaceUniswapV3Metrics { factories(first: 1) { id poolCount txCount totalVolumeUSD totalFeesUSD totalValueLockedUSD } bundles(first: 1) { id ethPriceUSD } }';
  const payload=object(await fetchJson(`https://gateway.thegraph.com/api/subgraphs/id/${encodeURIComponent(subgraphId)}`,{method:'POST',headers:headers({'content-type':'application/json',Authorization:`Bearer ${key}`}),body:JSON.stringify({query,operationName:'AgentPlaceUniswapV3Metrics',variables:{}})}));
  const errors=array(payload.errors); const data=object(payload.data); const factories=array(data.factories).map(object);
  if(errors.length||!factories.length) return makeEvidence(base,{status:'partial',summary:'The Graph query did not return a complete schema-pinned Uniswap V3 metric set.',data:{errors,data:jsonExcerpt(data)},sourceUrl:`https://thegraph.com/explorer/subgraphs/${encodeURIComponent(subgraphId)}?chain=arbitrum-one&view=Query`,limitations:['Subgraph schemas and deployments can change; schema mismatch is preserved as partial evidence.']});
  const factory=factories[0]??{}; return makeEvidence(base,{status:'verified',summary:`The Graph returned Uniswap V3 Arbitrum factory metrics: ${string(factory.poolCount)??'n/a'} pools and ${string(factory.totalVolumeUSD)??'n/a'} USD cumulative volume.`,data:{factory,bundles:array(data.bundles).map(object)},sourceUrl:`https://thegraph.com/explorer/subgraphs/${encodeURIComponent(subgraphId)}?chain=arbitrum-one&view=Query`,limitations:['These are schema-pinned subgraph observations, not a universal DEX safety or profitability assessment.']});
}

async function blockscout(invocation:IntelligenceInvocation, subject:IntelligenceSubject, base:ReturnType<typeof evidenceBase>, resolved:ResolvedToken|null):Promise<IntelligenceEvidence> {
  if(!resolved) return makeEvidence(base,{status:'unavailable',summary:'Blockscout requires a resolved token address and network.'});
  const root=blockscoutRoot(resolved.network); if(!root) return makeEvidence(base,{status:'unavailable',summary:`Blockscout verification is not configured for ${resolved.network}.`});
  const tokenPayload=object(await fetchJson(`${root}/api?module=token&action=getToken&contractaddress=${encodeURIComponent(resolved.address)}`,{headers:headers()})); const token=object(tokenPayload.result);
  const holderPayload=object(await fetchJson(`${root}/api?module=token&action=getTokenHolders&contractaddress=${encodeURIComponent(resolved.address)}&page=1&offset=100`,{headers:headers()})); const holderRows=array(holderPayload.result).map(object);
  const totalSupplyRaw=bigint(token.totalSupply); const rawBalances=holderRows.map((row)=>bigint(row.value)).filter((value):value is bigint=>value!==undefined); const concentration=totalSupplyRaw===undefined?{}:concentrationMetrics(rawBalances,totalSupplyRaw);
  const topHolders=holderRows.map((row)=>({address:string(row.address),value:string(row.value)})).slice(0,20);
  const concentrationSummary=`top-1 ${number(concentration.top1Pct)??'n/a'}%; top-5 ${number(concentration.top5Pct)??'n/a'}%; top-10 ${number(concentration.top10Pct)??'n/a'}%; top-20 ${number(concentration.top20Pct)??'n/a'}%`;
  return makeEvidence(base,{status:holderRows.length?'verified':'partial',summary:holderRows.length?`Blockscout returned ${holderRows.length} sampled holders; AgentPlace calculated ${concentrationSummary}.`:'Blockscout returned no token-holder rows.',data:{token:{name:string(token.name),symbol:string(token.symbol),decimals:string(token.decimals),totalSupply:string(token.totalSupply),type:string(token.type)},concentration,topHolders},sourceUrl:`${root}/token/${encodeURIComponent(resolved.address)}`,limitations:['Concentration is a deterministic AgentPlace calculation from Blockscout holder balances and reported total supply.','The first 100 holder rows are a bounded sample; LP, treasury, burn, bridge, exchange and contract addresses are not automatically excluded.','Explorer data is raw onchain evidence, not identity attribution.']});
}


function findNumericByKey(value:unknown, patterns:RegExp[], depth=0):Array<{key:string;value:number}> {
  if(depth>8||value===null||value===undefined) return [];
  if(Array.isArray(value)) return value.flatMap((item)=>findNumericByKey(item,patterns,depth+1));
  if(typeof value!=='object') return [];
  const out:Array<{key:string;value:number}>=[];
  for(const [key,child] of Object.entries(value as Record<string,unknown>)) {
    const n=number(child); if(n!==undefined&&patterns.some((pattern)=>pattern.test(key))) out.push({key,value:n});
    out.push(...findNumericByKey(child,patterns,depth+1));
  }
  return out;
}
function deriveAccumulation(base:ReturnType<typeof evidenceBase>, prior:readonly IntelligenceEvidence[]):IntelligenceEvidence {
  const source=prior.find((item)=>item.subjectQuery===base.subjectQuery&&item.provider==='nansen'&&(item.capabilityId==='smartmoney.flow.read'||item.capabilityId==='token.smartmoney.read')&&item.status==='verified');
  if(!source) return makeEvidence(base,{status:'unavailable',summary:'Accumulation signal requires preserved Nansen smart-money flow evidence from the same Job.',derivationVersion:'agentplace-smartmoney-accumulation-v1',limitations:['No independent source evidence was available for this derivation.']});
  const metrics=findNumericByKey(source.data,[/net[_-]?flow.*7d/i,/net[_-]?flow.*24h/i,/balance.*change/i]);
  const strongest=metrics.sort((a,b)=>Math.abs(b.value)-Math.abs(a.value))[0];
  if(!strongest) return makeEvidence(base,{status:'partial',summary:'Smart-money evidence was preserved, but no supported net-flow/change field was available for a deterministic accumulation signal.',data:{sourceEvidenceId:source.id},derivationVersion:'agentplace-smartmoney-accumulation-v1',limitations:['No accumulation/distribution direction was inferred without a recognized numeric provider field.']});
  const direction=strongest.value>0?'accumulation':strongest.value<0?'distribution':'neutral';
  return makeEvidence(base,{status:'verified',summary:`AgentPlace derived ${direction} from Nansen field ${strongest.key}=${strongest.value}.`,data:{direction,metric:strongest,sourceEvidenceId:source.id,sourceProvider:'nansen'},...(source.sourceUrl?{sourceUrl:source.sourceUrl}:{}),derivationVersion:'agentplace-smartmoney-accumulation-v1',limitations:['This is a bounded deterministic derivation from provider-defined Smart Money evidence, not an AgentPlace wallet-quality score.']});
}

export async function persistIntelligenceEvidence(ownerUserId:string,evidence:IntelligenceEvidence):Promise<void> {
  await getDatabasePool().query(`INSERT INTO intelligence_evidence(id,owner_user_id,job_id,task_id,capability_id,implementation_id,provider,subject_kind,subject_query,network,address,status,summary,data,source_url,observed_at,fetched_at,freshness_seconds,provider_confidence,derivation_version,limitations)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16,$17,$18,$19,$20,$21::jsonb)
    ON CONFLICT(id) DO NOTHING`,[evidence.id,ownerUserId,evidence.jobId,evidence.taskId,evidence.capabilityId,evidence.implementationId,evidence.provider,evidence.subjectKind,evidence.subjectQuery,evidence.network??null,evidence.address??null,evidence.status,evidence.summary,JSON.stringify(evidence.data),evidence.sourceUrl??null,evidence.observedAt,evidence.fetchedAt,evidence.freshnessSeconds??null,evidence.providerConfidence??null,evidence.derivationVersion??null,JSON.stringify(evidence.limitations)]);
}

export async function collectRoutedIntelligence(args:{ownerUserId:string;jobId:string;taskId:string;subjects:readonly IntelligenceSubject[];invocations:readonly IntelligenceInvocation[]}):Promise<IntelligenceEvidence[]> {
  const subjects=args.subjects.slice(0,12); const invocations=[...args.invocations.slice(0,24)].sort((left,right)=>intelligenceDependencyRank(left.capabilityId)-intelligenceDependencyRank(right.capabilityId)); const out:IntelligenceEvidence[]=[];
  const resolution=new Map<string,ResolvedToken|null>();
  for(const subject of subjects) if(subject.kind==='token'||subject.kind==='stablecoin') resolution.set(`${subject.kind}:${subject.query}:${subject.network??''}:${subject.address??''}`,await resolveToken(subject).catch(()=>null));
  for(const invocation of invocations) {
    const capability=invocation.capabilityId;
    const kinds:IntelSubjectKindCompat = capability.startsWith('wallet.') ? ['wallet'] : capability.startsWith('protocol.') ? ['protocol'] : capability.startsWith('stablecoin.') ? ['stablecoin'] : ['token','stablecoin'];
    for(const rawSubject of subjects.filter((item)=>kinds.includes(item.kind)).slice(0,6)) {
      const subject=bindWalletSubjectFromPriorEvidence(rawSubject,out);
      const resolved=resolution.get(`${subject.kind}:${subject.query}:${subject.network??''}:${subject.address??''}`)??null; const base=evidenceBase({jobId:args.jobId,taskId:args.taskId,invocation,subject,resolved});
      let evidence:IntelligenceEvidence;
      try {
        if(invocation.provider==='dexscreener') evidence=await dexScreener(invocation,subject,base,resolved);
        else if(invocation.provider==='coingecko') evidence=await coinGecko(invocation,subject,base,resolved);
        else if(invocation.provider==='defillama') evidence=await defillama(invocation,subject,base);
        else if(invocation.provider==='nansen') evidence=await nansen(invocation,subject,base,resolved);
        else if(invocation.provider==='goplus') evidence=await goPlus(invocation,subject,base,resolved);
        else if(invocation.provider==='bubblemaps') evidence=await bubblemaps(invocation,subject,base,resolved);
        else if(invocation.provider==='birdeye') evidence=await birdeye(invocation,subject,base,resolved);
        else if(invocation.provider==='blockscout') evidence=await blockscout(invocation,subject,base,resolved);
        else if(invocation.provider==='etherscan') evidence=await etherscan(invocation,subject,base,resolved);
        else if(invocation.provider==='alchemy') evidence=await alchemy(invocation,subject,base,resolved);
        else if(invocation.provider==='thegraph') evidence=await theGraph(invocation,subject,base);
        else if(invocation.provider==='agentplace' && invocation.capabilityId==='smartmoney.accumulation.detect') evidence=deriveAccumulation(base,out);
        else evidence=makeEvidence(base,{status:'unavailable',summary:`No M5B.1 direct invocation adapter is registered for ${invocation.provider}.`});
      } catch(error) {
        evidence=makeEvidence(base,{status:'error',summary:`${invocation.provider} intelligence request failed.`,data:{error:error instanceof Error?error.message:String(error)},limitations:['Provider failure was preserved instead of being converted into a factual finding.']});
      }
      await persistIntelligenceEvidence(args.ownerUserId,evidence); out.push(evidence);
    }
  }
  return out;
}
type IntelSubjectKindCompat=IntelligenceSubjectKind[];

export async function listJobIntelligenceEvidence(ownerUserId:string,jobId:string):Promise<IntelligenceEvidence[]> {
  const r=await getDatabasePool().query<any>(`SELECT id,job_id,task_id,capability_id,implementation_id,provider,subject_kind,subject_query,network,address,status,summary,data,source_url,observed_at,fetched_at,freshness_seconds,provider_confidence,derivation_version,limitations FROM intelligence_evidence WHERE owner_user_id=$1 AND job_id=$2 ORDER BY fetched_at,id`,[ownerUserId,jobId]);
  return r.rows.map((row:any)=>({id:row.id,jobId:row.job_id,taskId:row.task_id,capabilityId:row.capability_id,implementationId:row.implementation_id,provider:row.provider,subjectKind:row.subject_kind,subjectQuery:row.subject_query,...(row.network?{network:row.network}:{}),...(row.address?{address:row.address}:{}),status:row.status,summary:row.summary,data:object(row.data),...(row.source_url?{sourceUrl:row.source_url}:{}),observedAt:new Date(row.observed_at).toISOString(),fetchedAt:new Date(row.fetched_at).toISOString(),...(row.freshness_seconds===null?{}:{freshnessSeconds:row.freshness_seconds}),...(row.provider_confidence===null?{}:{providerConfidence:Number(row.provider_confidence)}),...(row.derivation_version?{derivationVersion:row.derivation_version}:{}),limitations:array(row.limitations).filter((v):v is string=>typeof v==='string')}));
}

export function intelligenceEvidencePrompt(evidence:readonly IntelligenceEvidence[]):string {
  if(!evidence.length) return 'No structured provider intelligence was collected for this Job.';
  return evidence.slice(0,40).map((item,index)=>[
    `E${index+1} ${item.capabilityId} · ${item.provider} · ${item.subjectQuery} · ${item.status}`,
    item.summary,
    `network=${item.network??'n/a'} address=${item.address??'n/a'} fetched_at=${item.fetchedAt}`,
    `data=${JSON.stringify(item.data).slice(0,3500)}`,
    item.limitations.length?`limitations=${item.limitations.join(' | ')}`:'',
  ].filter(Boolean).join('\n')).join('\n\n');
}

export const moduleManifest={name:'intelligence',layer:'controlled-runtime',milestone:'5B.1',status:'zero-cost-first-core-intelligence-fabric'} as const;
