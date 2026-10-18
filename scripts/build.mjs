import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const packageNames = (await readdir("packages", { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

// Build workspace dependency roots first so declaration files exist for consumers.
const orderedFirst = ["shared", "db", "creator-sdk", "marketplace", "auth", "context", "workers", "jobs", "capabilities", "models", "telegraph", "intelligence", "router", "wallets", "authority", "risk", "execution", "verification", "notifications", "routines"];
for (const name of orderedFirst) run("tsc", ["-p", join("packages", name, "tsconfig.json")]);
for (const name of packageNames) {
  if (orderedFirst.includes(name)) continue;
  run("tsc", ["-p", join("packages", name, "tsconfig.json")]);
}

for (const name of ["api", "scheduler", "worker"]) run("tsc", ["-p", join("apps", name, "tsconfig.json")]);
run("pnpm", ["--filter", "@agent-place/web", "build"]);
