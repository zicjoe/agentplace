import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('guest home owns vertical scrolling and cannot center content above the viewport', async () => {
  const home = await readFile('apps/web/src/components/GuestHome.tsx', 'utf8');

  assert.match(home, /h-full min-h-0 overflow-y-auto overscroll-contain bg-bg/);
  assert.match(home, /data-workspace-scroll/);
  assert.match(home, /min-h-full flex flex-col items-center justify-center px-4 py-6 sm:py-8/);
  assert.match(home, /w-full max-w-2xl shrink-0/);
  assert.equal(
    home.includes('h-full flex flex-col items-center justify-center px-4 bg-bg'),
    false,
    'Guest Home must not vertically center a potentially taller fixed-height page without its own scroll owner',
  );
});

test('desktop and mobile shells keep scrolling inside the active workspace', async () => {
  const shell = await readFile('apps/web/src/components/Shell.tsx', 'utf8');
  assert.match(shell, /<main className="flex-1 min-h-0 min-w-0 overflow-hidden">/);
});
