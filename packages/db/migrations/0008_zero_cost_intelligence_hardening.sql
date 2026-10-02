-- M5B.1 zero-cost production hardening.
-- Adds free/no-cost-first implementations without changing financial authority.

INSERT INTO canonical_capability (id,name,purpose,effect,authority_requirement,value_at_risk_class,input_schema,output_schema,lifecycle_status) VALUES
('protocol.dex.metrics.read','DEX protocol metrics read','Read protocol-specific DEX operating metrics from an approved schema-pinned onchain index.','read','none','none','{"type":"object","properties":{"protocol":{"type":"string"},"network":{"type":"string"}}}','{"type":"object"}','limited-production')
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,purpose=EXCLUDED.purpose,effect=EXCLUDED.effect,authority_requirement=EXCLUDED.authority_requirement,value_at_risk_class=EXCLUDED.value_at_risk_class,input_schema=EXCLUDED.input_schema,output_schema=EXCLUDED.output_schema,lifecycle_status=EXCLUDED.lifecycle_status,updated_at=now();

INSERT INTO capability_implementation (id,canonical_capability_id,provider,name,version,supported_networks,pricing,trust_status,health_status,invocation_kind,known_failure_states,priority,enabled,environment_eligibility) VALUES
('etherscan-token-deployer-v1','token.deployer.analyze','etherscan','Etherscan V2 contract creator and public deployer history','v2','["ethereum","base","arbitrum","bnb"]','{"metered":true,"keyRequired":true,"freeTier":true}','provider-verified','unknown','direct-http-json','["rate-limited","chain-unsupported","contract-resolution-failed"]',5,true,'["development","testnet","staging-mainnet-readonly","production-mainnet"]'),
('etherscan-wallet-activity-v1','wallet.activity.analyze','etherscan','Etherscan V2 wallet transactions and ERC20 transfers','v2','["ethereum","base","arbitrum","bnb"]','{"metered":true,"keyRequired":true,"freeTier":true}','provider-verified','unknown','direct-http-json','["rate-limited","chain-unsupported"]',5,true,'["development","testnet","staging-mainnet-readonly","production-mainnet"]'),
('alchemy-solana-token-holders-v1','token.holders.analyze','alchemy','Alchemy Solana token holders and concentration','2026-09','["solana"]','{"metered":true,"keyRequired":true,"freeTier":true}','provider-verified','unknown','direct-json-rpc','["rate-limited","index-unavailable","asset-resolution-failed"]',5,true,'["development","testnet","staging-mainnet-readonly","production-mainnet"]'),
('alchemy-wallet-profile-v1','wallet.profile','alchemy','Alchemy multichain wallet token profile','portfolio-v1','["ethereum","base","arbitrum","bnb","solana"]','{"metered":true,"keyRequired":true,"freeTier":true}','provider-verified','unknown','direct-http-json','["rate-limited","partial-network-failure"]',5,true,'["development","testnet","staging-mainnet-readonly","production-mainnet"]'),
('alchemy-solana-wallet-activity-v1','wallet.activity.analyze','alchemy','Alchemy Solana recent signature activity','solana-rpc','["solana"]','{"metered":true,"keyRequired":true,"freeTier":true}','provider-verified','unknown','direct-json-rpc','["rate-limited","provider-unavailable"]',5,true,'["development","testnet","staging-mainnet-readonly","production-mainnet"]'),
('thegraph-uniswap-v3-arbitrum-v1','protocol.dex.metrics.read','thegraph','The Graph schema-pinned Uniswap V3 Arbitrum metrics','graphql-v1','["arbitrum"]','{"metered":true,"keyRequired":true,"freeTier":true,"schemaPinned":true,"protocols":["uniswap-v3"]}','tested','unknown','graphql','["subgraph-unconfigured","schema-mismatch","rate-limited"]',10,true,'["development","testnet","staging-mainnet-readonly","production-mainnet"]')
ON CONFLICT (id) DO UPDATE SET version=EXCLUDED.version,supported_networks=EXCLUDED.supported_networks,pricing=EXCLUDED.pricing,trust_status=EXCLUDED.trust_status,health_status=EXCLUDED.health_status,invocation_kind=EXCLUDED.invocation_kind,known_failure_states=EXCLUDED.known_failure_states,priority=EXCLUDED.priority,enabled=EXCLUDED.enabled,environment_eligibility=EXCLUDED.environment_eligibility,updated_at=now();

-- Prefer the no-key Blockscout implementation before paid holder-intelligence vendors on supported EVM chains.
UPDATE capability_implementation
SET version='v3-concentration', priority=4, pricing='{"metered":false,"keyRequired":false,"freeTier":true}'::jsonb, updated_at=now()
WHERE id='blockscout-token-holders-v1';

INSERT INTO worker_capability_route(worker_version_id,canonical_capability_id,suitability) VALUES
('wv-researcher-1','protocol.dex.metrics.read','primary')
ON CONFLICT(worker_version_id,canonical_capability_id) DO UPDATE SET suitability=EXCLUDED.suitability,updated_at=now();
