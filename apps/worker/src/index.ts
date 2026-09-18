import { defineService } from '@agent-place/shared';

export const service = defineService({
  name: 'agent-place-worker',
  runtimeClass: 'worker',
  version: '0.2.0',
  milestone: 1,
});
