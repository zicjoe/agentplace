import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

test("approved AgentPlace UX is integrated without Figma Make runtime scaffolding", async () => {
  assert.equal(await exists("apps/web/src/components/GuestHome.tsx"), true);
  assert.equal(await exists("apps/web/src/components/ActionReview.tsx"), true);
  assert.equal(await exists("apps/web/src/components/AgentBuilder.tsx"), true);
  assert.equal(await exists("apps/web/.figma"), false);
  assert.equal(await exists("apps/web/src/imports"), false);
});

test("prototype state is isolated behind the production state facade", async () => {
  const facade = await readFile("apps/web/src/state/AppContext.tsx", "utf8");
  assert.match(facade, /fixtures\/FixtureAppContext/);
  const fixture = await readFile("apps/web/src/fixtures/FixtureAppContext.tsx", "utf8");
  assert.match(fixture, /setTimeout/);
});

test("relocated fixture context has no stale local type imports", async () => {
  const fixture = await readFile("apps/web/src/fixtures/FixtureAppContext.tsx", "utf8");
  assert.equal(fixture.includes("import('./types')"), false);
  assert.match(fixture, /import\('\.\.\/state\/types'\)/);
});

test("production routing covers durable AgentPlace object surfaces", async () => {
  const routing = await readFile("apps/web/src/platform/routing.ts", "utf8");
  for (const token of ["conversations", "discover", "workers", "routines", "activity/jobs", "wallets", "create/worker"]) {
    assert.equal(routing.includes(token), true, `missing route token ${token}`);
  }
});

test("browser demo controls are disabled by default", async () => {
  const env = await readFile(".env.example", "utf8");
  assert.match(env, /VITE_AGENT_PLACE_ENABLE_DEMO_CONTROLS=false/);
  const shell = await readFile("apps/web/src/components/Shell.tsx", "utf8");
  assert.match(shell, /demoControlsEnabled/);
});

test("API public configuration cannot enable mainnet by default", async () => {
  const env = await readFile(".env.example", "utf8");
  assert.match(env, /MAINNET_EXECUTION_ENABLED=false/);
  assert.match(env, /MAINNET_AUTONOMY_ENABLED=false/);
  const server = await readFile("apps/api/src/server.ts", "utf8");
  assert.match(server, /parseEnvironmentContract/);
});
