import { execFileSync } from 'node:child_process';
import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const root = process.cwd();
const ignoredDirectories = new Set(['.git', 'node_modules', 'dist', '.next', 'coverage']);
const allowedSecretExamples = new Set(['.env.example']);
const forbiddenNames = new Set(['.env', '.env.local', '.env.production', '.env.development', '.env.test']);
const forbiddenExtensions = new Set(['.pem', '.p12', '.pfx']);
const textExtensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.md', '.yml', '.yaml', '.toml', '.txt', '.sql', '.html', '.css']);
const patterns = [
  { name: 'PEM private key', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'live Stripe secret', regex: /\bsk_live_[A-Za-z0-9]{16,}\b/ },
  { name: 'GitHub personal token', regex: /\bgh[pousr]_[A-Za-z0-9_]{30,}\b/ },
  { name: 'Google API key', regex: /\bAIza[0-9A-Za-z_-]{30,}\b/ },
  { name: 'assigned EVM private key', regex: /(?:PRIVATE_KEY|SIGNER_KEY|EVM_PRIVATE_KEY)\s*[=:]\s*["']?0x[a-fA-F0-9]{64}\b/ },
];

const findings = [];

function isGitIgnored(path) {
  try {
    execFileSync('git', ['check-ignore', '--quiet', '--', path], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const absolute = join(directory, entry.name);
    const rel = relative(root, absolute).replaceAll('\\', '/');
    if (entry.isDirectory()) { await walk(absolute); continue; }
    // Local secret files such as .env are expected during development and must
    // remain gitignored. git check-ignore intentionally does not treat tracked
    // files as ignored, so a force-tracked .env still fails this guard.
    if (isGitIgnored(rel)) continue;
    if (allowedSecretExamples.has(entry.name)) continue;
    if (forbiddenNames.has(entry.name) || forbiddenExtensions.has(extname(entry.name).toLowerCase())) {
      findings.push(`${rel}: forbidden secret-bearing filename`);
      continue;
    }
    if (!textExtensions.has(extname(entry.name).toLowerCase()) && !['Dockerfile', 'Procfile'].includes(entry.name)) continue;
    const metadata = await stat(absolute);
    if (metadata.size > 2_000_000) continue;
    const content = await readFile(absolute, 'utf8').catch(() => '');
    for (const pattern of patterns) if (pattern.regex.test(content)) findings.push(`${rel}: ${pattern.name}`);
  }
}

await walk(root);
if (findings.length) {
  console.error('FAIL: possible committed secrets or secret-bearing files detected.');
  for (const finding of findings) console.error(` - ${finding}`);
  process.exit(1);
}
console.log('PASS: repository secret-file and high-confidence secret-pattern guard satisfied.');
