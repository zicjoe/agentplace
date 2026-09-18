import { spawn, spawnSync } from 'node:child_process';

const shell = process.platform === 'win32';

const buildShared = spawnSync('pnpm', ['--filter', '@agent-place/shared', 'build'], {
  stdio: 'inherit',
  shell,
});
if (buildShared.status !== 0) process.exit(buildShared.status ?? 1);

const buildApi = spawnSync('pnpm', ['--filter', '@agent-place/api', 'build'], {
  stdio: 'inherit',
  shell,
});
if (buildApi.status !== 0) process.exit(buildApi.status ?? 1);

const children = [
  spawn('pnpm', ['--filter', '@agent-place/api', 'start'], { stdio: 'inherit', shell }),
  spawn('pnpm', ['--filter', '@agent-place/web', 'dev'], { stdio: 'inherit', shell }),
];

let stopping = false;
function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill();
  }
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
