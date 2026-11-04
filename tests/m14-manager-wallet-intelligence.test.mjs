import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const code = readFileSync(new URL('./m14-manager-wallet-fixtures.mjs.txt', import.meta.url),'utf8');
const runtime=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','-e',code],{encoding:'utf8',cwd:process.cwd()});


test('owner-scoped wallet resolver behavior',()=>{
 assert.equal(runtime.status,0,`Wallet resolution runtime failed:\n${runtime.stdout}\n${runtime.stderr}`);
 assert.match(runtime.stdout,/wallet checks passed 8/);
});
test('owner-scoped wallet resolution is wired before LLM planning and forces real wallet evidence',()=>{
 const source=readFileSync('apps/worker/src/index.ts','utf8');
 assert.match(source,/SELECT id,name,mode,namespace,address FROM wallet_resource WHERE owner_user_id=\$1/);
 assert.match(source,/resolveManagerWalletResearch\(/);
 assert.match(source,/value\.requiredCapabilities=\['wallet\.profile'\]/);
 assert.match(source,/value\.intelligenceSubjects=\[\{kind:'wallet',query:wallet\.address!/);
 assert.match(source,/value\.responseMode='job'/);
});
test('Alchemy portfolio excludes incompatible chains and rejects address/network mismatches',()=>{
 const source=readFileSync('packages/intelligence/src/index.ts','utf8');
 assert.match(source,/const isEvm=\/\^0x\[a-fA-F0-9\]\{40\}\$\//);
 assert.match(source,/mapped&&\(\(isEvm&&mapped!=='sol-mainnet'\)/);
 assert.match(source,/isEvm\?\['eth-mainnet','base-mainnet','arb-mainnet','bnb-mainnet'\]/);
});
