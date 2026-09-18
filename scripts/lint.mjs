import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";

const ignored = new Set(["node_modules", "dist", ".git"]);
const checked = new Set([".ts", ".tsx", ".mjs", ".json", ".yml", ".yaml"]);
const failures = [];

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(path);
      continue;
    }

    if (!checked.has(extname(entry.name))) continue;
    const text = await readFile(path, "utf8");

    if (path !== "scripts/lint.mjs") {
      if (/<<<<<<<|=======|>>>>>>>/.test(text)) failures.push(`${path}: merge-conflict marker`);
      if (/\beval\s*\(/.test(text)) failures.push(`${path}: eval() is forbidden`);
      if (/child_process[^\n]*exec\s*\(/.test(text)) {
        failures.push(`${path}: shell exec() requires explicit security review`);
      }
    }

    if (entry.name.endsWith(".json")) {
      try {
        JSON.parse(text);
      } catch (error) {
        failures.push(`${path}: invalid JSON: ${String(error)}`);
      }
    }
  }
}

await walk(".");
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("PASS: repository lint contract satisfied.");
