import { execFileSync } from "node:child_process";
import { readFile, readdir, stat } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const required = [
  "package.json",
  "pnpm-workspace.yaml",
  "tsconfig.base.json",
  ".github/workflows/ci.yml",
  ".github/workflows/codeql.yml",
  ".github/dependabot.yml",
  "SECURITY.md",
  "docs/ARCHITECTURE.md",
  "docs/ENVIRONMENTS.md",
  "packages/db/migrations/0001_foundation.sql",
  "packages/shared/src/environment.ts",
  "packages/shared/src/tracing.ts",
];

for (const path of required) {
  try {
    await stat(path);
  } catch {
    throw new Error(`Required foundation file missing: ${path}`);
  }
}

const forbiddenNames = [
  /^\.env$/,
  /^\.env\.(?!example$).+/,
  /\.pem$/i,
  /\.key$/i,
  /\.p12$/i,
  /\.pfx$/i,
  /secret.*\.json$/i,
];

const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:sk_live|rk_live)_[A-Za-z0-9]{16,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /(?:PRIVATE_KEY|SEED_PHRASE|MNEMONIC)\s*=\s*[^\s<>{}]{12,}/i,
];

const ignoredDirectories = new Set(["node_modules", "dist", ".git"]);
const findings = [];

function isGitIgnored(path) {
  try {
    execFileSync("git", ["check-ignore", "--quiet", "--", path], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) continue;

    const path = join(dir, entry.name);
    const rel = relative(".", path).replaceAll("\\", "/");

    if (entry.isDirectory()) {
      await walk(path);
      continue;
    }

    // Local secret files such as .env are intentionally gitignored and may exist
    // during development. They are not repository content and should not make the
    // repository verifier fail. A force-tracked secret file is not reported as
    // ignored by git check-ignore, so it is still rejected below.
    if (isGitIgnored(rel)) continue;

    if (!rel.endsWith(".env.example") && forbiddenNames.some((pattern) => pattern.test(entry.name))) {
      findings.push(`${rel}: forbidden secret-file name`);
    }

    if ([".png", ".jpg", ".jpeg", ".webp", ".zip"].includes(extname(entry.name))) continue;

    const text = await readFile(path, "utf8");
    for (const pattern of secretPatterns) {
      if (pattern.test(text)) findings.push(`${rel}: possible committed secret (${pattern})`);
    }
  }
}

await walk(".");

const env = await readFile(".env.example", "utf8");
if (!env.includes("MAINNET_EXECUTION_ENABLED=false")) {
  findings.push(".env.example must disable mainnet execution by default");
}
if (!env.includes("MAINNET_AUTONOMY_ENABLED=false")) {
  findings.push(".env.example must disable mainnet autonomy by default");
}

const readme = await readFile("README.md", "utf8");
if (/Master Product \+ Engineering Specification v1\.0\.md/.test(readme)) {
  findings.push("README must not imply the private master specification is committed");
}

if (findings.length) {
  console.error(findings.join("\n"));
  process.exit(1);
}
console.log("PASS: AgentPlace Milestone 0 repository/security foundation verified.");
