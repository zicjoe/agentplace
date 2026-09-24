import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";

const ignored = new Set(["node_modules", "dist", ".git"]);
const checked = new Set([".ts", ".tsx", ".mjs", ".json", ".yml", ".yaml"]);
const failures = [];

// These expressions do not contain their own forbidden matches. Check this
// script too instead of relying on a platform-dependent self-path exception.
const mergeMarkers = /<{7}|={7}|>{7}/;
const dynamicEvaluation = /\beval\s*\(/;
const shellExecution = /child_process[^\n]*exec\s*\(/;

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(path);
      continue;
    }

    if (!checked.has(extname(entry.name))) continue;
    const source = await readFile(path, "utf8");

    if (mergeMarkers.test(source)) failures.push(`${path}: merge-conflict marker`);
    if (dynamicEvaluation.test(source)) failures.push(`${path}: dynamic evaluation is forbidden`);
    if (shellExecution.test(source)) failures.push(`${path}: shell execution requires explicit security review`);

    if (entry.name.endsWith(".json")) {
      try {
        JSON.parse(source);
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
