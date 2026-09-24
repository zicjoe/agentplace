import { defineService } from '@agent-place/shared';

export const service = defineService({
  name: 'agent-place-scheduler',
  runtimeClass: 'scheduler',
  version: '0.3.0',
  milestone: 1,
});
