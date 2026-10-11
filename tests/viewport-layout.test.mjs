import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Guest Home owns vertical scrolling and uses overflow-safe centering', async () => {
  const home = await read('apps/web/src/components/GuestHome.tsx');
  assert.match(home, /data-page-scroll className="h-full min-h-0 overflow-y-auto overscroll-contain bg-bg"/);
  assert.match(home, /min-h-full w-full flex px-4 py-6 sm:py-8 lg:py-10/);
  assert.match(home, /w-full max-w-2xl mx-auto my-auto/);
  assert.doesNotMatch(home, /h-full flex flex-col items-center justify-center px-4 bg-bg/);
});

test('primary route surfaces either own or contain a constrained vertical scroll region', async () => {
  const files = [
    'apps/web/src/components/GuestHome.tsx',
    'apps/web/src/components/Discover.tsx',
    'apps/web/src/components/WorkersView.tsx',
    'apps/web/src/components/ActivityView.tsx',
    'apps/web/src/components/RoutinesView.tsx',
    'apps/web/src/components/WalletsView.tsx',
    'apps/web/src/components/SecurityAuthorityView.tsx',
    'apps/web/src/components/BillingUsageView.tsx',
    'apps/web/src/components/CreatorHome.tsx',
    'apps/web/src/components/CapabilityStudio.tsx',
    'apps/web/src/components/AgentBuilder.tsx',
    'apps/web/src/components/WorkflowStudio.tsx',
    'apps/web/src/components/ChatView.tsx',
    'apps/web/src/components/JobWorkspace.tsx',
    'apps/web/src/components/WorkerWorkspace.tsx',
    'apps/web/src/components/RoutineWorkspace.tsx',
    'apps/web/src/components/DiscoverDetail.tsx',
  ];

  for (const file of files) {
    const source = await read(file);
    assert.match(source, /min-h-0/, `${file} must permit its flex content to shrink within the fixed shell`);
    assert.match(source, /overflow-y-auto/, `${file} must expose a reachable vertical scroll owner`);
  }
});

test('fixed application shell keeps scrolling inside the active route', async () => {
  const [shell, css] = await Promise.all([
    read('apps/web/src/components/Shell.tsx'),
    read('apps/web/src/index.css'),
  ]);
  assert.match(shell, /<main className="flex-1 min-h-0 min-w-0 overflow-hidden">/);
  assert.match(css, /#root[\s\S]*height: 100dvh/);
  assert.match(css, /\[data-page-scroll\][\s\S]*scrollbar-gutter: stable/);
});

test('high-use dialogs remain reachable on short viewports', async () => {
  const [wallets, create, identity, discover, billing, security, actionReview, mandateEditor] = await Promise.all([
    read('apps/web/src/components/WalletsView.tsx'),
    read('apps/web/src/components/CreateMenu.tsx'),
    read('apps/web/src/components/IdentityCheckpoint.tsx'),
    read('apps/web/src/components/DiscoverDetail.tsx'),
    read('apps/web/src/components/BillingUsageView.tsx'),
    read('apps/web/src/components/SecurityAuthorityView.tsx'),
    read('apps/web/src/components/ActionReview.tsx'),
    read('apps/web/src/components/MandateEditor.tsx'),
  ]);

  for (const [name, source] of Object.entries({ wallets, create, identity, discover, billing, security, actionReview, mandateEditor })) {
    assert.match(source, /max-h-\[calc\(100dvh-2rem\)\]/, `${name} must bound at least one viewport-sensitive dialog`);
    assert.match(source, /overflow-y-auto/, `${name} must let oversized dialog content scroll`);
  }
});
