import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const assets = [
  'apps/web/public/brand/agentplace-icon-192.png',
  'apps/web/public/brand/agentplace-icon-512.png',
  'apps/web/public/brand/apple-touch-icon.png',
  'apps/web/public/brand/favicon-16.png',
  'apps/web/public/brand/favicon-32.png',
  'apps/web/public/brand/agentplace-social.png',
  'apps/web/public/manifest.webmanifest',
];

test('submission branding assets exist', async () => {
  await Promise.all(assets.map((asset) => access(asset)));
});

test('web shell references AgentPlace branding and browser metadata', async () => {
  const [sidebar, shell, chat, identity, html, manifest] = await Promise.all([
    readFile('apps/web/src/components/Sidebar.tsx', 'utf8'),
    readFile('apps/web/src/components/Shell.tsx', 'utf8'),
    readFile('apps/web/src/components/ChatView.tsx', 'utf8'),
    readFile('apps/web/src/components/IdentityCheckpoint.tsx', 'utf8'),
    readFile('apps/web/index.html', 'utf8'),
    readFile('apps/web/public/manifest.webmanifest', 'utf8'),
  ]);

  assert.match(sidebar, /AgentPlaceBrand/);
  assert.match(shell, /AgentPlaceBrand/);
  assert.match(chat, /AgentPlaceMark/);
  assert.match(identity, /AgentPlaceMark/);
  assert.match(html, /apple-touch-icon/);
  assert.match(html, /manifest\.webmanifest/);
  assert.match(html, /agentplace-social\.png/);
  assert.equal(JSON.parse(manifest).name, 'AgentPlace');
});
