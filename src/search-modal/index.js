// Search modal (alternate search variant).
//
// Owns the modal's DOM wiring and a tiny render dispatcher driven by `smState`.
// App-specific glue (navigation, a few render helpers, the page's search input)
// is injected via initSearchModal(deps) so this module stays decoupled.
//
//   initSearchModal({
//     pageInput,  // the page header <input id="q">
//     searchEl,   // the page header search container (toggles .has-text)
//     nav,        // { goSearch, goSmartSearch, goAskAI, goBook, goAuthor, goTopic, goPojam }
//     helpers,    // { bookAuthors, bookCoverImg, initials, CATEGORY_LOGOS }
//   }) -> { open, close }

import { smState, setTab, setQuery, isSearching,
         pushView, popView, clearStack, hasStack, topView } from './state.js';
import { tabRenderers, searchingView, rankResults } from './tabs.js';
import { aiView } from './ai.js';
import { topicDetail, pojamDetail, authorDetail } from './detail.js';
import { TOPICS, BOOKS, AUTHORS, POJMOVI } from '../data/index.js';
import { isAskAIIntent } from '../lib/search.js';
import { escapeHtml, escapeAttr } from '../lib/dom.js';

export function initSearchModal(deps) {
  const { pageInput, searchEl, nav, helpers, ai, recents } = deps;

  const overlay  = document.getElementById('searchModal');
  const input    = document.getElementById('sm-input');
  const closeBtn = document.getElementById('sm-close');
  const content  = document.getElementById('sm-content');
  const chips    = document.getElementById('sm-chips');
  const navEl    = document.getElementById('sm-nav');
  const ghostEl  = document.getElementById('sm-ghost');
  const headBack = document.getElementById('sm-head-back');
  const DEFAULT_PLACEHOLDER = input.getAttribute('placeholder') || '';
  let timer = null;
  let lastMode = null;
  let focusIdx = -1;   // keyboard-highlighted row in the results list

  const ctx = { helpers, ai };

  // --- keyboard navigation of the results list -------------------------------
  const rowEls = () => [...content.querySelectorAll('.sm-row')];
  function applyFocus(rows) {
    rows = rows || rowEls();
    rows.forEach((r, i) => r.classList.toggle('focused', i === focusIdx));
    rows[focusIdx]?.scrollIntoView({ block: 'nearest' });
  }
  function moveFocus(delta) {
    const rows = rowEls();
    if (!rows.length) return;
    focusIdx = (focusIdx + delta + rows.length) % rows.length;
    applyFocus(rows);
    updateGhost();   // ghost mirrors the newly highlighted row
  }

  // Title shown in the search field while a detail view is open.
  function viewTitle(v) {
    if (!v) return '';
    if (v.kind === 'topic')  return TOPICS.find((t) => t.id === v.id)?.name || '';
    if (v.kind === 'pojam')  return POJMOVI.find((p) => p.id === v.id)?.name || '';
    if (v.kind === 'author') return AUTHORS.find((a) => a.id === v.id)?.name || '';
    if (v.kind === 'ai')     return 'Ask AI';
    return '';
  }

  // --- Spotlight-style ghost suggestion -------------------------------------
  // The action label mirrors what pressing Enter will do for the top hit.
  const ACTION_LABEL = { book: 'Open book', author: 'Open author', topic: 'Explore', pojam: 'Explore', askai: 'Ask AI', search: 'Search' };
  let suggestion = null;   // current top-hit suggestion (or null)

  // Fallback when nothing matches: offer to run a full search.
  const searchSuggestion = () => ({ kind: 'search', id: '', name: '', completion: '', action: ACTION_LABEL.search });

  // Resolve the top hit for a query into a ghost suggestion:
  //   { kind, id, name, completion, action }
  // `completion` is the untyped remainder of the name when the query is a
  // case-insensitive prefix of it (the inline ghost); otherwise ''. A
  // question-shaped query always resolves to the Ask AI action.
  function getSuggestion(q) {
    const ql = (q || '').trim();
    if (!ql) return null;
    if (isAskAIIntent(ql)) return { kind: 'askai', id: '', name: '', completion: '', action: ACTION_LABEL.askai };
    const top = rankResults(ql)[0];
    if (!top) return searchSuggestion();
    const name = top.kind === 'book' ? top.item.title : top.item.name;
    // Only ghost an entity when the query genuinely occurs in its name. Fuzzy /
    // weak score-only matches (e.g. gibberish) fall back to a "Search" action
    // that opens the full search-results page.
    if (!name.toLowerCase().includes(ql.toLowerCase())) return searchSuggestion();
    const completion = name.toLowerCase().startsWith(ql.toLowerCase()) ? name.slice(ql.length) : '';
    return { kind: top.kind, id: top.item.id, name, completion, action: ACTION_LABEL[top.kind] };
  }

  // Build a ghost suggestion from a result ROW, so the ghost completion + action
  // always match the currently highlighted item.
  function suggestionForRow(row) {
    if (!row) return null;
    const go = row.dataset.smGo || '';
    if (go === 'search') return { kind: 'search', id: '', name: '', completion: '', action: ACTION_LABEL.search };
    if (go === 'askai')  return { kind: 'askai',  id: '', name: '', completion: '', action: ACTION_LABEL.askai };
    const colon = go.indexOf(':');
    const kind = colon > -1 ? go.slice(0, colon) : go;
    const id   = colon > -1 ? go.slice(colon + 1) : '';
    const name = row.querySelector('.sm-rtitle')?.textContent || '';
    const ql = input.value.trim();
    const completion = name.toLowerCase().startsWith(ql.toLowerCase()) ? name.slice(ql.length) : '';
    return { kind, id, name, completion, action: ACTION_LABEL[kind] || '' };
  }

  // Paint the ghost behind the input. It mirrors the highlighted result row
  // (only in the results list). The `typed` span is an invisible spacer the
  // width of the user's text so the gray suffix starts exactly at the caret.
  function updateGhost() {
    suggestion = mode() === 'results' ? suggestionForRow(rowEls()[focusIdx]) : null;
    if (!suggestion) { ghostEl.innerHTML = ''; ghostEl.style.transform = ''; return; }
    const { completion, action } = suggestion;
    const actHtml = action ? `<span class="act"> — ${escapeHtml(action)}</span>` : '';
    ghostEl.innerHTML =
      `<span class="typed">${escapeHtml(input.value)}</span>` +
      `<span class="suffix">${escapeHtml(completion)}${actHtml}</span>`;
    // Keep the ghost aligned if the input has scrolled horizontally.
    ghostEl.style.transform = `translateX(${-input.scrollLeft}px)`;
  }

  // Record a context-rich recent entry for an entity (book/author/topic/pojam).
  function recordRecent(kind, id) {
    if (!recents?.add) return;
    if (kind === 'book')   { const b = BOOKS.find((x) => x.id === id);   if (b) recents.add({ type:'book',   id:b.id, label:b.title }); }
    if (kind === 'author') { const a = AUTHORS.find((x) => x.id === id); if (a) recents.add({ type:'author', id:a.id, label:a.name }); }
    if (kind === 'topic')  { const t = TOPICS.find((x) => x.id === id);  if (t) recents.add({ type:'topic',  id:t.id, label:t.name }); }
    if (kind === 'pojam')  { const p = POJMOVI.find((x) => x.id === id); if (p) recents.add({ type:'pojam',  id:p.id, label:p.name }); }
  }

  // Run the ghosted action — what the gray label promises. Books/authors
  // navigate out; topics/concepts/AI open in-modal.
  function executeSuggestion(s) {
    recordRecent(s.kind, s.id);
    if (s.kind === 'book')   { close(); nav.goBook(s.id); }
    if (s.kind === 'author') { pushView({ kind: 'author', id: s.id }); render(); }
    if (s.kind === 'topic')  { pushView({ kind: 'topic', id: s.id }); render(); }
    if (s.kind === 'pojam')  { pushView({ kind: 'pojam', id: s.id }); render(); }
    if (s.kind === 'askai')  { pushView({ kind: 'ai', thread: [input.value.trim()] }); render(); focusComposer(); }
    if (s.kind === 'search') { close(); nav.goSearch(input.value); }
  }

  function focusComposer() {
    content.querySelector('[data-sm-ai-composer] input')?.focus();
  }

  // Append a follow-up to the current AI conversation (or start a new one),
  // then re-render and scroll to the latest exchange — a real chat thread.
  function askFollowup(q) {
    q = (q || '').trim();
    if (!q) return;
    const top = topView();
    if (top?.kind === 'ai') top.thread.push(q);
    else pushView({ kind: 'ai', thread: [q] });
    render();
    content.scrollTop = content.scrollHeight;
    focusComposer();
  }

  // Which state the modal is in. The detail stack wins over everything — a
  // pushed view (topic/concept/AI) stays put regardless of the query. Only when
  // the stack is empty does the query decide empty-vs-results. AI no longer
  // auto-appears while typing; it's an explicit pushed view (see dispatch below).
  //   'detail'  — a pushed view sits on top: render its top-of-stack entry
  //   'empty'   — no query: show the active tab from the registry
  //   'results' — query non-empty: show the ranked autocomplete list
  function mode() {
    if (hasStack()) return 'detail';
    if (!isSearching()) return 'empty';
    return 'results';
  }

  // Render the top-of-stack detail entry. Guards a stale id by popping and
  // re-rendering the view beneath it.
  function renderTop() {
    const v = topView();
    if (!v) return '';
    if (v.kind === 'topic') {
      const t = TOPICS.find((x) => x.id === v.id);
      if (!t) { popView(); return mode() === 'detail' ? renderTop() : ''; }
      return topicDetail(ctx, t);
    }
    if (v.kind === 'pojam') {
      const p = POJMOVI.find((x) => x.id === v.id);
      if (!p) { popView(); return mode() === 'detail' ? renderTop() : ''; }
      return pojamDetail(ctx, p);
    }
    if (v.kind === 'author') {
      const a = AUTHORS.find((x) => x.id === v.id);
      if (!a) { popView(); return mode() === 'detail' ? renderTop() : ''; }
      return authorDetail(ctx, a);
    }
    if (v.kind === 'ai') return aiView(ctx, v);
    return '';
  }

  function render() {
    const m = mode();
    const card = overlay.querySelector('.sm-card');
    card.classList.toggle('searching', m === 'results');
    card.classList.toggle('detail', m === 'detail');
    card.classList.remove('ai');

    // Detail mode borrows the search field: the magnifier becomes a back
    // chevron and the placeholder becomes the view title. The real query lives
    // in smState.query, so popping back to results restores it.
    if (m === 'detail') {
      if (lastMode !== 'detail') input.value = '';
      input.placeholder = viewTitle(topView());
      closeBtn.style.display = 'none';
    } else {
      if (lastMode === 'detail') input.value = smState.query;
      input.placeholder = DEFAULT_PLACEHOLDER;
      closeBtn.style.display = input.value ? 'flex' : 'none';
    }
    lastMode = m;

    content.innerHTML =
      m === 'detail' ? renderTop() :
      m === 'empty'  ? (tabRenderers[smState.tab] || tabRenderers.explore)(ctx) :
                       searchingView(ctx, smState.query.trim());
    content.scrollTop = 0;
    // Highlight the first result so ↑/↓ + Enter can drive the list.
    focusIdx = m === 'results' && rowEls().length ? 0 : -1;
    applyFocus();
    updateGhost();
  }

  function renderChips() {
    // Chips strip is the user's recent-searches lane — just the text label now,
    // with a × that appears on hover to remove the entry.
    const recentList = recents?.load?.() || [];
    if (!recentList.length) {
      chips.innerHTML = '';
      chips.style.display = 'none';
      return;
    }
    chips.style.display = '';

    // Each chip carries the full entry as data-sm-chip-* attrs so the click
    // dispatcher knows where to navigate AND what to remove.
    chips.innerHTML = recentList.slice(0, 7).map((e) => {
      const dataAttrs = `data-sm-chip-type="${escapeAttr(e.type)}" data-sm-chip-id="${escapeAttr(e.id || '')}" data-sm-chip-label="${escapeAttr(e.label)}"`;
      const removeAttrs = `data-sm-chip-remove="1" ${dataAttrs}`;
      return `<button class="sm-chip is-recent type-${e.type}" ${dataAttrs}>
        ${escapeHtml(e.label)}
        <span class="sm-chip-x" aria-hidden="true"><span class="sm-chip-x-btn" ${removeAttrs} aria-label="Remove from recent searches">×</span></span>
      </button>`;
    }).join('');
  }

  // Lock background scroll while the modal is open. Pad for the now-hidden
  // scrollbar so the page behind doesn't shift horizontally.
  function lockScroll(lock) {
    const sbw = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = lock ? 'hidden' : '';
    document.body.style.paddingRight = lock ? `${sbw}px` : '';
  }

  function open() {
    if (overlay.classList.contains('open')) return;
    overlay.classList.add('open');
    lockScroll(true);
    clearStack();           // always open fresh, never inside a stale pushed view
    input.value = pageInput.value;
    setQuery(pageInput.value);
    // × button only visible when the input has text
    closeBtn.style.display = input.value ? 'flex' : 'none';
    renderChips();
    render();
    setTimeout(() => input.focus(), 30);
  }
  function close() {
    if (!overlay.classList.contains('open')) return;
    overlay.classList.remove('open');
    lockScroll(false);
  }

  input.addEventListener('input', (e) => {
    pageInput.value = e.target.value;
    searchEl.classList.toggle('has-text', e.target.value.length > 0);
    setQuery(e.target.value);
    clearStack();           // typing leaves any pushed detail/AI view
    render();               // re-rank + re-highlight first row; render() updates the ghost
  });
  // Keep the ghost aligned when a long query scrolls the input horizontally.
  input.addEventListener('scroll', () => {
    ghostEl.style.transform = `translateX(${-input.scrollLeft}px)`;
  });
  // Caret sits at the very end of the input (so Tab/→ completion is unambiguous).
  const caretAtEnd = () =>
    input.selectionStart === input.value.length && input.selectionEnd === input.value.length;

  input.addEventListener('keydown', (e) => {
    // Tab / → accepts the inline ghost completion (fills in the top hit's name).
    if ((e.key === 'Tab' || e.key === 'ArrowRight') && suggestion?.completion && caretAtEnd()) {
      e.preventDefault();
      input.value = suggestion.name;
      pageInput.value = suggestion.name;
      setQuery(suggestion.name);
      render();               // re-rank for the completed query; updates the ghost
      return;
    }
    // ↑/↓ move the highlight through the results list.
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && mode() === 'results') {
      const rows = rowEls();
      if (rows.length) {
        e.preventDefault();
        moveFocus(e.key === 'ArrowDown' ? 1 : -1);
        return;
      }
    }
    if (e.key === 'Enter' && input.value.trim()) {
      e.preventDefault();
      // In the results list, Enter activates the highlighted row. Otherwise it
      // performs what the ghost label promises (open the top hit / ask AI / SRP).
      const rows = mode() === 'results' ? rowEls() : [];
      if (rows[focusIdx]) {
        rows[focusIdx].click();
      } else if (suggestion) {
        executeSuggestion(suggestion);
      } else {
        close();
        nav.goSearch(input.value);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      // Esc backs out of a pushed view first, then clears the input, then closes.
      if (hasStack()) {
        popView();
        render();
      } else if (input.value) {
        clearInput();
      } else {
        close();
      }
    }
  });

  // The × button now lives INSIDE the input field and clears the user's text.
  // To close the modal, the user clicks outside the modal card.
  function clearInput() {
    input.value = '';
    setQuery('');
    clearStack();           // × also backs out of any pushed view
    closeBtn.style.display = 'none';
    render();
    input.focus();
  }
  closeBtn.addEventListener('click', (e) => { e.stopPropagation(); clearInput(); });
  // Show/hide × based on whether the input has content.
  input.addEventListener('input', () => {
    closeBtn.style.display = input.value ? 'flex' : 'none';
  });
  // Outside-click on the overlay (anywhere outside the card) closes the modal.
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  navEl.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tab]');
    if (!b) return;
    setTab(b.dataset.tab);
    navEl.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
    render();
  });
  chips.addEventListener('click', (e) => {
    // Click on the icon (which shows × on hover) → delete from recents
    const x = e.target.closest('[data-sm-chip-remove]');
    if (x) {
      e.stopPropagation();
      recents?.remove?.({
        type:  x.dataset.smChipType,
        id:    x.dataset.smChipId || undefined,
        label: x.dataset.smChipLabel,
      });
      renderChips();
      return;
    }
    // Click on the chip body → navigate (or fill input for plain searches)
    const c = e.target.closest('[data-sm-chip-type]');
    if (!c) return;
    const type  = c.dataset.smChipType;
    const id    = c.dataset.smChipId;
    const label = c.dataset.smChipLabel;
    if (type === 'book')   { close(); nav.goBook(id);   return; }
    if (type === 'author') { pushView({ kind: 'author', id }); render(); return; }
    if (type === 'topic')  { pushView({ kind: 'topic', id }); render(); return; }
    if (type === 'pojam')  { pushView({ kind: 'pojam', id }); render(); return; }
    // Plain typed search — fill the input and re-render results inline
    input.value = label;
    pageInput.value = label;
    setQuery(label);
    closeBtn.style.display = input.value ? 'flex' : 'none';
    render();
  });
  // Hovering a result row moves the keyboard highlight to it, so ↑/↓ continues
  // from wherever the mouse left off.
  content.addEventListener('mousemove', (e) => {
    if (mode() !== 'results') return;
    const row = e.target.closest('.sm-row');
    if (!row) return;
    const rows = rowEls();
    const idx = rows.indexOf(row);
    if (idx === -1 || idx === focusIdx) return;
    focusIdx = idx;
    applyFocus(rows);
    updateGhost();   // ghost mirrors the hovered row
  });
  content.addEventListener('click', (e) => {
    // Back arrow on a detail/AI view: pop one level off the stack.
    if (e.target.closest('[data-sm-back]')) {
      popView();
      render();
      input.focus();
      return;
    }
    // AI follow-up: append the question to the conversation thread.
    const fq = e.target.closest('[data-sm-ai-followup]');
    if (fq) {
      askFollowup(fq.dataset.smAiFollowup);
      return;
    }
    const item = e.target.closest('[data-sm-go]');
    if (!item) return;
    // Parse "kind:id"; the search fallback uses a separate data-sm-q so its
    // query can contain colons without confusing the split.
    const raw = item.dataset.smGo;
    const colon = raw.indexOf(':');
    const kind = colon > -1 ? raw.slice(0, colon) : raw;
    const id   = colon > -1 ? raw.slice(colon + 1) : '';

    // Record a context-rich recent entry: clicking a book remembers the BOOK
    // (cover + title), an author remembers the AUTHOR (initials + name), etc.
    // Pressing Enter without picking a row records only the typed query.
    if (recents?.add) {
      if (kind === 'book') {
        const b = BOOKS.find((x) => x.id === id);
        if (b) recents.add({ type:'book', id:b.id, label:b.title });
      } else if (kind === 'author') {
        const a = AUTHORS.find((x) => x.id === id);
        if (a) recents.add({ type:'author', id:a.id, label:a.name });
      } else if (kind === 'topic') {
        const t = TOPICS.find((x) => x.id === id);
        if (t) recents.add({ type:'topic', id:t.id, label:t.name });
      } else if (kind === 'pojam') {
        const p = POJMOVI.find((x) => x.id === id);
        if (p) recents.add({ type:'pojam', id:p.id, label:p.name });
      } else {
        const q = (item.dataset.smQ || input.value || '').trim();
        if (q) recents.add(q);  // string → normalized to { type:'search', label:q }
      }
    }

    // Topics, concepts, authors and AI open IN-MODAL (pushed onto the stack).
    // Books and the search fallback navigate OUT to their full pages.
    if (kind === 'topic')  { pushView({ kind: 'topic', id }); render(); return; }
    if (kind === 'pojam')  { pushView({ kind: 'pojam', id }); render(); return; }
    if (kind === 'author') { pushView({ kind: 'author', id }); render(); return; }
    if (kind === 'askai') {
      pushView({ kind: 'ai', thread: [item.dataset.smQ || input.value || ''] });
      render();
      focusComposer();
      return;
    }
    close();
    if (kind === 'book')   nav.goBook(id);
    if (kind === 'search') nav.goSearch(item.dataset.smQ || input.value || '');
  });

  // AI composer (bottom of the AI view): submit appends the next turn to the
  // conversation thread and scrolls to it.
  content.addEventListener('submit', (e) => {
    const form = e.target.closest('[data-sm-ai-composer]');
    if (!form) return;
    e.preventDefault();
    askFollowup(form.querySelector('input').value);
  });

  // Header back chevron (shown in place of the magnifier while a detail view is
  // open) pops one level off the stack.
  headBack.addEventListener('click', () => {
    if (!hasStack()) return;
    popView();
    render();
    input.focus();
  });

  // Any navigation (including inline links inside an AI answer) closes the modal.
  window.addEventListener('hashchange', close);

  return { open, close };
}
