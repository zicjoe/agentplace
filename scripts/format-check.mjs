import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";

const included = new Set([
  ".ts",
  ".tsx",
  ".mjs",
  ".json",
  ".md",
  ".yml",
  ".yaml",
  ".sql",
  ".css",
  ".html",
  ".example",
]);
const ignored = new Set(["node_modules", "dist", ".git"]);
const failures = [];

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(path);
      continue;
    }

    const ext = extname(entry.name);
    if (!included.has(ext) && !entry.name.endsWith(".env.example")) continue;

    const text = await readFile(path, "utf8");
    if (!text.endsWith("\n")) failures.push(`${path}: missing final newline`);

    const lines = text.split("\n");
    lines.forEach((line, index) => {
      if (/[ \t]+$/.test(line)) failures.push(`${path}:${index + 1}: trailing whitespace`);
    });
  }
}

await walk(".");
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("PASS: formatting contract satisfied.");
