import test from "node:test";
import assert from "node:assert/strict";
import {
  createRequestId,
  createTraceId,
  isTraceId,
  parseEnvironmentContract,
} from "../packages/shared/dist/index.js";

test("trace and request identifiers are structured", () => {
  const traceId = createTraceId();
  const requestId = createRequestId();
  assert.equal(isTraceId(traceId), true);
  assert.match(requestId, /^req_[a-f0-9]{32}$/);
});

test("mainnet is off by default", () => {
  const config = parseEnvironmentContract({ AGENT_PLACE_ENV: "development" });
  assert.equal(config.testnetExecutionEnabled, true);
  assert.equal(config.mainnetExecutionEnabled, false);
  assert.equal(config.mainnetAutonomyEnabled, false);
});

test("mainnet autonomy cannot be enabled without mainnet execution", () => {
  assert.throws(() => parseEnvironmentContract({
    AGENT_PLACE_ENV: "production-mainnet",
    MAINNET_AUTONOMY_ENABLED: "true",
    MAINNET_EXECUTION_ENABLED: "false",
  }));
});

test("staging mainnet read-only can never execute", () => {
  assert.throws(() => parseEnvironmentContract({
    AGENT_PLACE_ENV: "staging-mainnet-readonly",
    MAINNET_EXECUTION_ENABLED: "true",
  }));
});
