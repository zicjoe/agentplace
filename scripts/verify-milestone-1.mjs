import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const required = [
  "pnpm-lock.yaml",
  "apps/web/index.html",
  "apps/web/vite.config.ts",
  "apps/web/src/App.tsx",
  "apps/web/src/components/Shell.tsx",
  "apps/web/src/components/GuestHome.tsx",
  "apps/web/src/components/WorkerWorkspace.tsx",
  "apps/web/src/components/JobWorkspace.tsx",
  "apps/web/src/components/WalletsView.tsx",
  "apps/web/src/components/RoutinesView.tsx",
  "apps/web/src/components/ActionReview.tsx",
  "apps/web/src/components/SecurityAuthorityView.tsx",
  "apps/web/src/components/BillingUsageView.tsx",
  "apps/web/src/components/AgentBuilder.tsx",
  "apps/web/src/state/AppContext.tsx",
  "apps/web/src/fixtures/FixtureAppContext.tsx",
  "apps/web/src/platform/routing.ts",
  "apps/web/src/platform/fixtureStore.ts",
  "apps/web/src/platform/RuntimeProvider.tsx",
  "apps/web/src/platform/apiClient.ts",
  "apps/api/src/server.ts",
  "packages/shared/src/api.ts",
  "docs/MILESTONE-1.md",
];

for (const path of required) {
  try {
    await stat(path);
  } catch {
    throw new Error(`Milestone 1 required file missing: ${path}`);
  }
}

const components = await readdir("apps/web/src/components");
if (components.filter((name) => name.endsWith(".tsx")).length < 28) {
  throw new Error("Approved Figma UX component surface appears incomplete.");
}

const stateFacade = await readFile("apps/web/src/state/AppContext.tsx", "utf8");
if (!stateFacade.includes("../fixtures/FixtureAppContext")) {
  throw new Error("Production state facade must isolate the prototype fixture adapter.");
}

const fixtureContext = await readFile("apps/web/src/fixtures/FixtureAppContext.tsx", "utf8");
if (fixtureContext.includes("import('./types')") || fixtureContext.includes('import("./types")')) {
  throw new Error("Relocated fixture context must reference ../state/types, not a non-existent local ./types module.");
}

const routing = await readFile("apps/web/src/platform/routing.ts", "utf8");
for (const route of [
  "/discover",
  "/workers",
  "/routines",
  "/activity",
  "/wallets",
  "/security",
  "/billing",
  "/create/worker",
]) {
  if (!routing.includes(route)) throw new Error(`Missing canonical production route: ${route}`);
}
if (!routing.includes("conversations") || !routing.includes("activity/jobs")) {
  throw new Error("Conversation and Job deep-link routes are required.");
}

const shell = await readFile("apps/web/src/components/Shell.tsx", "utf8");
if (!shell.includes("WEB_RUNTIME_SETTINGS.demoControlsEnabled")) {
  throw new Error("Demo Controls must be gated outside the normal production UI.");
}
if (!shell.includes("routeNotFound")) {
  throw new Error("Unknown production routes require an explicit fallback surface.");
}

const apiServer = await readFile("apps/api/src/server.ts", "utf8");
for (const contract of ["/health", "/api/v1/config", "WEB_ORIGINS", "access-control-allow-origin"]) {
  if (!apiServer.includes(contract)) throw new Error(`API foundation missing contract: ${contract}`);
}
if (apiServer.includes("access-control-allow-origin', '*'")) {
  throw new Error("API must not use wildcard CORS for browser production boundary.");
}

const env = await readFile(".env.example", "utf8");
for (const expected of [
  "MAINNET_EXECUTION_ENABLED=false",
  "MAINNET_AUTONOMY_ENABLED=false",
  "VITE_AGENT_PLACE_DATA_MODE=fixtures",
  "VITE_AGENT_PLACE_ENABLE_DEMO_CONTROLS=false",
]) {
  if (!env.includes(expected)) throw new Error(`Environment contract missing safe default: ${expected}`);
}

const appFiles = [
  "apps/web/src/App.tsx",
  "apps/web/src/components/Shell.tsx",
  "apps/web/src/fixtures/FixtureAppContext.tsx",
];
for (const path of appFiles) {
  const text = await readFile(path, "utf8");
  if (text.includes(".figma/") || text.includes("src/imports/")) {
    throw new Error(`${path}: Figma Make scaffolding/reference imports must not enter production runtime.`);
  }
}

console.log("PASS: AgentPlace Production Milestone 1 UX integration/foundation contract verified.");
