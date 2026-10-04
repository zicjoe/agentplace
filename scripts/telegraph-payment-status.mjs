import { telegraphServicePaymentStatusFromEnv } from '../packages/telegraph/dist/runtime.js';

const status = telegraphServicePaymentStatusFromEnv(process.env);
console.log(JSON.stringify({
  enabled: status.enabled,
  ready: status.ready,
  network: status.network,
  caip2Network: status.caip2Network,
  asset: status.asset,
  payerAddress: status.payerAddress ?? null,
  maxCallUsdc: status.maxCallUsdc,
  maxJobUsdc: status.maxJobUsdc,
  maxCallsPerJob: status.maxCallsPerJob,
  reason: status.reason ?? null,
}, null, 2));

if (!status.ready) process.exitCode = 1;
