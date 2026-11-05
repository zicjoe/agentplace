/** Bounded read-only team execution plan. The deterministic Router has already
 * established Worker eligibility. An LLM cannot enlarge the team or budgets.
 * Each participating specialist gets a model invocation with its own Worker ID.
 */
export interface CollaborationPlanStep {
  id: string;
  kind: 'provider-evidence' | 'specialist-research' | 'lead-synthesis';
  workerId?: string;
  dependsOn: string[];
  purpose: string;
  skipped: boolean;
}
export interface CollaborationPlan {
  steps: CollaborationPlanStep[];
  participatingSpecialistIds: string[];
  skippedSpecialistIds: string[];
}

export function buildCollaborationPlan(args: {
  leadWorkerId: string;
  supportingWorkerIds: readonly string[];
  remainingModelCalls: number;
  maxSpecialists?: number;
}): CollaborationPlan {
  const unique = [...new Set(args.supportingWorkerIds.filter(id => id && id !== args.leadWorkerId))];
  // Always reserve one call for final synthesis. The planner already consumed
  // a call, counted in remainingModelCalls by the trusted database runtime.
  const allowed = Math.min(3, Math.max(0, args.maxSpecialists ?? 3), Math.max(0, Math.floor(args.remainingModelCalls) - 1));
  const participatingSpecialistIds = unique.slice(0, allowed);
  const skippedSpecialistIds = unique.slice(allowed);
  const steps: CollaborationPlanStep[] = [
    { id: 'provider-evidence', kind: 'provider-evidence', dependsOn: [], purpose: 'Collect and preserve eligible structured provider evidence', skipped: false },
    ...unique.map((workerId, index) => ({
      id: `specialist-${index + 1}`,
      kind: 'specialist-research' as const,
      workerId,
      dependsOn: ['provider-evidence'],
      purpose: 'Independent read-only specialist investigation with cited evidence',
      skipped: index >= allowed,
    })),
    {
      id: 'lead-synthesis', kind: 'lead-synthesis', workerId: args.leadWorkerId,
      dependsOn: ['provider-evidence', ...unique.map((_, index) => `specialist-${index + 1}`)],
      purpose: 'Lead Worker reconciles specialist reports, source gaps and original requirements',
      skipped: false,
    },
  ];
  return { steps, participatingSpecialistIds, skippedSpecialistIds };
}

export function checkCollaborationDependencies(steps: readonly CollaborationPlanStep[]): boolean {
  const byId = new Map(steps.map(step => [step.id, step]));
  if (byId.size !== steps.length) return false;
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const visit = (id: string): boolean => {
    if (visited.has(id)) return true;
    const step = byId.get(id);
    if (!step || visiting.has(id)) return false;
    visiting.add(id);
    if (!step.dependsOn.every(visit)) return false;
    visiting.delete(id);
    visited.add(id);
    return true;
  };
  return steps.every(step => visit(step.id));
}
