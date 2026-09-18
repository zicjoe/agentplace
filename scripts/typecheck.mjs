import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// Build the shared contract package first so workspace consumers resolve its
// declaration surface without TypeScript pulling source across package rootDir boundaries.
run("tsc", ["-p", "packages/shared/tsconfig.json"]);

for (const parent of ["packages", "apps"]) {
  const names = (await readdir(parent, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const name of names) {
    if (parent === "packages" && name === "shared") continue;
    run("tsc", ["-p", join(parent, name, "tsconfig.json"), "--noEmit"]);
  }
}
