/** Scroll only the owned panel, never the document/outer application shell. */
export function scrollConversationToEnd(panel: HTMLElement | null): void {
  if (!panel) return;
  panel.scrollTop = panel.scrollHeight;
}

/** Navigating to a separate workspace should start at its heading. */
export function resetWorkspaceScroll(root: HTMLElement | null): void {
  if (!root) return;
  root.scrollTop = 0;
  root.querySelectorAll<HTMLElement>('[data-workspace-scroll]').forEach((panel) => { panel.scrollTop = 0; });
}
