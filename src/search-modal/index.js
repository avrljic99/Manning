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

import { smState, setTab, setQuery, isSearching } from './state.js';
import { tabRenderers, searchingView } from './tabs.js';
import { aiView } from './ai.js';
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
  let timer = null;

  const ctx = { helpers, ai };

  // Which of the three states the modal is in for the current query.
  //   'empty'   — no query: show the active tab from the registry
  //   'ai'      — question-shaped query: show the AI answer
  //   'results' — anything else: show the ranked autocomplete list
  function mode() {
    if (!isSearching()) return 'empty';
    return isAskAIIntent(smState.query) ? 'ai' : 'results';
  }

  function render() {
    const m = mode();
    const card = overlay.querySelector('.sm-card');
    card.classList.toggle('searching', m !== 'empty');
    card.classList.toggle('ai', m === 'ai');
    content.innerHTML =
      m === 'empty'   ? (tabRenderers[smState.tab] || tabRenderers.explore)(ctx) :
      m === 'ai'      ? aiView(ctx, smState.query.trim()) :
                        searchingView(ctx, smState.query.trim());
  }

  function renderChips() {
    // Chips strip is the user's recent-searches lane. Each chip is type-aware:
    //   - book   → mini cover thumbnail + title
    //   - author → initials avatar + name
    //   - topic  → category logo + name
    //   - pojam  → # + concept name
    //   - search → first letter + query text
    // Hover anywhere on a chip swaps the icon → × ; click × deletes.
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
      let iconInner = '';
      let iconClass = '';
      if (e.type === 'book') {
        const b = BOOKS.find((x) => x.id === e.id);
        iconInner = b && helpers?.bookCoverImg ? helpers.bookCoverImg(b) : escapeHtml(e.label.charAt(0).toUpperCase());
        iconClass = 'ico-book';
      } else if (e.type === 'author') {
        iconInner = helpers?.initials ? escapeHtml(helpers.initials(e.label)) : escapeHtml(e.label.charAt(0).toUpperCase());
        iconClass = 'ico-author';
      } else if (e.type === 'topic') {
        const logo = helpers?.CATEGORY_LOGOS?.[e.id];
        iconInner = logo || escapeHtml(e.label.charAt(0).toUpperCase());
        iconClass = 'ico-topic';
      } else if (e.type === 'pojam') {
        iconInner = '#';
        iconClass = 'ico-pojam';
      } else {
        iconInner = escapeHtml(e.label.charAt(0).toUpperCase());
        iconClass = 'ico-search';
      }
      return `<button class="sm-chip is-recent type-${e.type}" ${dataAttrs}>
        <span class="ico ${iconClass}" ${removeAttrs} aria-label="Remove from recent searches">
          <span class="ico-body">${iconInner}</span>
          <span class="ico-x">×</span>
        </span>${escapeHtml(e.label)}
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
    clearTimeout(timer);
    timer = setTimeout(render, 120);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
      e.preventDefault();
      // Questions are answered inline (AI state) — Enter just keeps the answer
      // on screen. Everything else opens the full search-results page.
      if (isAskAIIntent(input.value)) {
        render();
      } else {
        close();
        nav.goSearch(input.value);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      // Esc clears the input first; only closes the modal when input is empty.
      if (input.value) {
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
    if (type === 'author') { close(); nav.goAuthor(id); return; }
    if (type === 'topic')  { close(); nav.goTopic(id);  return; }
    if (type === 'pojam')  { close(); nav.goPojam(id);  return; }
    // Plain typed search — fill the input and re-render results inline
    input.value = label;
    pageInput.value = label;
    setQuery(label);
    closeBtn.style.display = input.value ? 'flex' : 'none';
    render();
  });
  content.addEventListener('click', (e) => {
    // AI follow-up: refine the answer in place, no navigation.
    const fq = e.target.closest('[data-sm-ai-followup]');
    if (fq) {
      const q = fq.dataset.smAiFollowup;
      input.value = q;
      pageInput.value = q;
      setQuery(q);
      render();
      input.focus();
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

    close();
    if (kind === 'book')   nav.goBook(id);
    if (kind === 'author') nav.goAuthor(id);
    if (kind === 'topic')  nav.goTopic(id);
    if (kind === 'pojam')  nav.goPojam(id);
    if (kind === 'search') nav.goSearch(item.dataset.smQ || input.value || '');
    if (kind === 'askai')  nav.goAskAI(item.dataset.smQ || input.value || '');
  });

  // AI composer (bottom of the AI state): submit asks the next question in place.
  content.addEventListener('submit', (e) => {
    const form = e.target.closest('[data-sm-ai-composer]');
    if (!form) return;
    e.preventDefault();
    const q = form.querySelector('input').value.trim();
    if (!q) return;
    input.value = q;
    pageInput.value = q;
    setQuery(q);
    render();
    // re-focus the freshly rendered composer so it reads as a conversation
    content.querySelector('[data-sm-ai-composer] input')?.focus();
  });

  // Any navigation (including inline links inside an AI answer) closes the modal.
  window.addEventListener('hashchange', close);

  return { open, close };
}
