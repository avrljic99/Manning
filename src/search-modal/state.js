// Search-modal state — the single source of truth for what the modal shows.
// Two modes: empty (a tab from the registry) and searching (query non-empty).
export const smState = {
  tab: 'explore',   // active tab id in empty mode (see tabs.js registry)
  query: '',        // current input text; non-empty => searching mode
};

export function setTab(tab) { smState.tab = tab; }
export function setQuery(q) { smState.query = q || ''; }
export function isSearching() { return smState.query.trim().length > 0; }
