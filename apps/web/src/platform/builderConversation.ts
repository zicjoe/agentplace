import { workerCreationBrief, type WorkerCreationStarter } from './workerCreationStart.ts';

/**
 * M17 Stage 2A: creation entry paths are conveniences, not enduring modes.
 * A single owner-scoped Builder session and validated Worker draft remain authoritative.
 */
export type BuilderInstructionMode = 'build' | 'edit' | 'teach';

const TEACH_CUES = /(?:\bteach\b|\bmy (?:method|methodology|process|rules?|expertise|scoring|framework|exceptions?|examples?)\b|\b(?:rule|threshold|exception|example|weight|score)\s*:\s*|\blearn (?:from|this|how)\b|\bwhen .{1,120}\b(?:must|should|never|always)\b)/i;
const EDIT_CUES = /^(?:please\s+)?(?:rename|remove|delete|replace|change|modify|update|undo|revert|publish|install|test|run|start|save|make private|make public)\b/i;

/** Explicit edit commands beat teaching preference. Ordinary messages can switch
 * to teaching at any time; an old Teach Mode button cannot lock the entire chat. */
export function builderTurnMode(text: string, hasExistingWorker: boolean, teachingPreferred = false): BuilderInstructionMode {
  if (!hasExistingWorker) return 'build';
  if (EDIT_CUES.test(text.trim())) return 'edit';
  if (TEACH_CUES.test(text)) return 'teach';
  return teachingPreferred ? 'teach' : 'edit';
}

/** A template is an editable reference, not an installed capability or permission. */
export function builderTemplateInstruction(starter: WorkerCreationStarter, hasExistingWorker: boolean): string {
  if (!hasExistingWorker) return workerCreationBrief({ path: 'template', goal: starter.brief }) ?? '';
  return [
    `Consider the ${starter.name} starter as an optional reference for my EXISTING Worker draft.`,
    `Starter brief:\n${starter.brief}`,
    'Propose only compatible improvements. Preserve my existing mission, approved expertise, safety boundaries, and private status unless I explicitly ask to change them. Do not add unsupported integrations or run tests, install, publish, spend, or grant financial authority.',
  ].join('\n\n');
}

/** Never overwrite a creator's unsent input on a template or quick-start selection. */
export function appendBuilderSuggestion(current: string, suggestion: string, maxLength: number): { text: string; fits: boolean } {
  const addition = suggestion.trim();
  const next = current.trim() ? `${current.trimEnd()}\n\n${addition}` : addition;
  return { text: next.length <= maxLength ? next : current, fits: next.length <= maxLength };
}

export function builderInputProblem(text: string, hasExistingWorker: boolean, limit: number): string | null {
  if (!text.trim()) return 'Write a message to continue.';
  if (text.length > limit) return `This message is above the current ${limit.toLocaleString()}-character limit. Your complete text is still in the editor. Nothing was cut or submitted.`;
  if (!hasExistingWorker && text.trim().length < 12) return 'Describe what you want your Worker to do in at least one short sentence.';
  return null;
}
