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

// Typecheck dependency roots by building declarations before checking their consumers.
for (const name of ["shared", "observability", "db", "billing", "security", "creator-sdk", "marketplace", "auth", "context", "workers", "jobs", "capabilities", "models", "telegraph", "intelligence", "router", "wallets", "authority", "risk", "execution", "verification", "notifications", "routines"]) run("tsc", ["-p", join("packages", name, "tsconfig.json")]);
for (const name of packageNames) {
  if (["shared", "observability", "db", "billing", "security", "creator-sdk", "marketplace", "auth", "context", "workers", "jobs", "capabilities", "models", "telegraph", "intelligence", "router", "wallets", "authority", "risk", "execution", "verification", "notifications", "routines"].includes(name)) continue;
  run("tsc", ["-p", join("packages", name, "tsconfig.json"), "--noEmit"]);
}
for (const name of ["api", "scheduler", "worker", "web"]) run("tsc", ["-p", join("apps", name, "tsconfig.json"), "--noEmit"]);
