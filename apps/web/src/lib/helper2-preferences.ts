export type Helper2QuickReplyMode = 'fill' | 'send';

export const HELPER2_QUICK_REPLY_MODE_KEY = 'baam.helper2.quickReplyMode';

export function normalizeQuickReplyMode(value: unknown): Helper2QuickReplyMode {
  return value === 'send' ? 'send' : 'fill';
}

export function readQuickReplyModeFromStorage(): Helper2QuickReplyMode {
  if (typeof window === 'undefined') return 'fill';
  const value = window.localStorage.getItem(HELPER2_QUICK_REPLY_MODE_KEY);
  return normalizeQuickReplyMode(value);
}

export function writeQuickReplyModeToStorage(mode: Helper2QuickReplyMode) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(HELPER2_QUICK_REPLY_MODE_KEY, mode);
}
