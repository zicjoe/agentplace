import { spawn, spawnSync } from 'node:child_process';

const shell = process.platform === 'win32';

for (const workspace of ['@agent-place/shared', '@agent-place/db', '@agent-place/auth', '@agent-place/context', '@agent-place/api']) {
  const built = spawnSync('pnpm', ['--filter', workspace, 'build'], { stdio: 'inherit', shell });
  if (built.status !== 0) process.exit(built.status ?? 1);
}

const children = [
  spawn('pnpm', ['--filter', '@agent-place/api', 'start'], { stdio: 'inherit', shell }),
  spawn('pnpm', ['--filter', '@agent-place/web', 'dev'], { stdio: 'inherit', shell }),
];

let stopping = false;
function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (!child.killed) child.kill();
  process.exit(exitCode);
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
for (const child of children) {
  child.on('exit', (code, signal) => {
    if (stopping) return;
    if (signal) stop(1);
    else if ((code ?? 0) !== 0) stop(code ?? 1);
  });
}
