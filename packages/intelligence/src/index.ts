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
  const v=(value??'').trim().toLowerCase();
  if (v==='eth') return 'ethereum'; if (v==='bsc'||v==='binance'||v==='bnb chain') return 'bnb';
  if (v==='sol'||v==='solana') return 'solana'; if (v==='arb') return 'arbitrum'; return v;
}
function dexscreenerNetwork(value:string):string { return value==='bnb'?'bsc':value; }
function bubblemapsNetwork(value:string):string { return value==='ethereum'?'eth':value==='bnb'?'bsc':value; }
function goPlusChain(value:string):string|undefined {
  return ({ethereum:'1',bnb:'56',arbitrum:'42161',base:'8453'} as Record<string,string>)[value];
}
function nansenNetwork(value:string):string { return value==='bnb'?'bnb':value; }
function jsonExcerpt(value:unknown, max=12000):JsonObject {
  const text=JSON.stringify(value);
  if (text.length<=max) return object(value);
  return { truncated:true, sha256:createHash('sha256').update(text).digest('hex'), excerpt:text.slice(0,max) };
}
function safeUrl(raw:string):string { try { const u=new URL(raw); u.searchParams.delete('x_cg_demo_api_key'); u.searchParams.delete('api_key'); u.searchParams.delete('key'); return u.toString(); } catch { return raw; } }
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

async function goPlus(invocation:IntelligenceInvocation, subject:IntelligenceSubject, base:ReturnType<typeof evidenceBase>, resolved:ResolvedToken|null):Promise<IntelligenceEvidence> {
  if(!resolved) return makeEvidence(base,{status:'unavailable',summary:'GoPlus requires a resolved token address and network.'});
  const token=env('GOPLUS_ACCESS_TOKEN'); if(!token) return makeEvidence(base,{status:'unavailable',summary:'GoPlus access token is not configured.'});
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

async function blockscout(invocation:IntelligenceInvocation, subject:IntelligenceSubject, base:ReturnType<typeof evidenceBase>, resolved:ResolvedToken|null):Promise<IntelligenceEvidence> {
  if(!resolved) return makeEvidence(base,{status:'unavailable',summary:'Blockscout requires a resolved token address and network.'});
  const roots:Record<string,string>={ethereum:'https://eth.blockscout.com/api/v2',base:'https://base.blockscout.com/api/v2',arbitrum:'https://arbitrum.blockscout.com/api/v2'}; const root=roots[resolved.network];
  if(!root) return makeEvidence(base,{status:'unavailable',summary:`Blockscout verification is not configured for ${resolved.network}.`});
  const url=`${root}/tokens/${encodeURIComponent(resolved.address)}/holders`; const payload=await fetchJson(url,{headers:headers()});
  return makeEvidence(base,{status:'verified',summary:'Blockscout returned independent token-holder data.',data:jsonExcerpt(payload),sourceUrl:`${root.replace('/api/v2','')}/token/${encodeURIComponent(resolved.address)}`,limitations:['Explorer data is used as an independent raw-chain verification path, not identity attribution.']});
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

async function persist(ownerUserId:string,evidence:IntelligenceEvidence):Promise<void> {
  await getDatabasePool().query(`INSERT INTO intelligence_evidence(id,owner_user_id,job_id,task_id,capability_id,implementation_id,provider,subject_kind,subject_query,network,address,status,summary,data,source_url,observed_at,fetched_at,freshness_seconds,provider_confidence,derivation_version,limitations)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16,$17,$18,$19,$20,$21::jsonb)
    ON CONFLICT(id) DO NOTHING`,[evidence.id,ownerUserId,evidence.jobId,evidence.taskId,evidence.capabilityId,evidence.implementationId,evidence.provider,evidence.subjectKind,evidence.subjectQuery,evidence.network??null,evidence.address??null,evidence.status,evidence.summary,JSON.stringify(evidence.data),evidence.sourceUrl??null,evidence.observedAt,evidence.fetchedAt,evidence.freshnessSeconds??null,evidence.providerConfidence??null,evidence.derivationVersion??null,JSON.stringify(evidence.limitations)]);
}

export async function collectRoutedIntelligence(args:{ownerUserId:string;jobId:string;taskId:string;subjects:readonly IntelligenceSubject[];invocations:readonly IntelligenceInvocation[]}):Promise<IntelligenceEvidence[]> {
  const subjects=args.subjects.slice(0,12); const invocations=args.invocations.slice(0,24); const out:IntelligenceEvidence[]=[];
  const resolution=new Map<string,ResolvedToken|null>();
  for(const subject of subjects) if(subject.kind==='token'||subject.kind==='stablecoin') resolution.set(`${subject.kind}:${subject.query}:${subject.network??''}:${subject.address??''}`,await resolveToken(subject).catch(()=>null));
  for(const invocation of invocations) {
    const capability=invocation.capabilityId;
    const kinds:IntelSubjectKindCompat = capability.startsWith('wallet.') ? ['wallet'] : capability.startsWith('protocol.') ? ['protocol'] : capability.startsWith('stablecoin.') ? ['stablecoin'] : ['token','stablecoin'];
    for(const subject of subjects.filter((item)=>kinds.includes(item.kind)).slice(0,6)) {
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
        else if(invocation.provider==='agentplace' && invocation.capabilityId==='smartmoney.accumulation.detect') evidence=deriveAccumulation(base,out);
        else evidence=makeEvidence(base,{status:'unavailable',summary:`No M5B.1 direct invocation adapter is registered for ${invocation.provider}.`});
      } catch(error) {
        evidence=makeEvidence(base,{status:'error',summary:`${invocation.provider} intelligence request failed.`,data:{error:error instanceof Error?error.message:String(error)},limitations:['Provider failure was preserved instead of being converted into a factual finding.']});
      }
      await persist(args.ownerUserId,evidence); out.push(evidence);
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

export const moduleManifest={name:'intelligence',layer:'controlled-runtime',milestone:'5B.1',status:'core-intelligence-fabric'} as const;
