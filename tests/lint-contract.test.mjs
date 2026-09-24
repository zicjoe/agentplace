import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { test } from 'node:test';

const lintScript = resolve('scripts/lint.mjs');

async function withFixture(source, callback) {
  const directory = await mkdtemp(join(tmpdir(), 'agentplace-lint-'));
  try {
    await writeFile(join(directory, 'example.ts'), source);
    const result = spawnSync(process.execPath, [lintScript], {
      cwd: directory,
      encoding: 'utf8',
    });
    callback(result);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('lint passes ordinary source without excluding itself by platform-specific path', async () => {
  await withFixture('export const safe = 1;\n', (result) => {
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /repository lint contract satisfied/);
  });
});

test('lint still detects merge markers', async () => {
  await withFixture('<'.repeat(7) + ' HEAD\n', (result) => {
    assert.equal(result.status, 1);
    assert.match(result.stderr, /merge-conflict marker/);
  });
});

test('lint still detects dynamic evaluation', async () => {
  await withFixture('const result = ' + 'ev' + 'al(1);\n', (result) => {
    assert.equal(result.status, 1);
    assert.match(result.stderr, /dynamic evaluation is forbidden/);
  });
});
