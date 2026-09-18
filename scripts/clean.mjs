import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";

for (const parent of ["apps", "packages"]) {
  for (const entry of await readdir(parent, { withFileTypes: true })) {
    if (entry.isDirectory()) await rm(join(parent, entry.name, "dist"), { recursive: true, force: true });
  }
}
await rm("dist", { recursive: true, force: true });
