// Search-modal state — the single source of truth for what the modal shows.
// Modes: empty (a tab from the registry), searching (query non-empty), and
// detail (a pushed view sitting on top — topic/concept/AI explored in-modal).
export const smState = {
  tab: 'explore',   // active tab id in empty mode (see tabs.js registry)
  query: '',        // current input text; non-empty => searching mode
  stack: [],        // pushed detail views; entries: { kind:'topic'|'pojam'|'ai', id?, q? }
};

export function setTab(tab) { smState.tab = tab; }
export function setQuery(q) { smState.query = q || ''; }
export function isSearching() { return smState.query.trim().length > 0; }

// --- detail navigation stack -----------------------------------------------
// A stack (not single-level) so nested browsing works: topic → concept chip →
// related concept, and AI follow-ups chain. Back walks one step at a time.
export function pushView(entry) { smState.stack.push(entry); }
export function popView() { return smState.stack.pop(); }
export function clearStack() { smState.stack.length = 0; }
export function topView() { return smState.stack[smState.stack.length - 1] || null; }
export function hasStack() { return smState.stack.length > 0; }
