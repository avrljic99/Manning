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
import { TOPICS } from '../data/index.js';
import { isAskAIIntent } from '../lib/search.js';
import { escapeHtml, escapeAttr } from '../lib/dom.js';

export function initSearchModal(deps) {
  const { pageInput, searchEl, nav, helpers, ai } = deps;

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
    const top = TOPICS.filter((t) => !t.parent).slice(0, 7);
    chips.innerHTML = top.map((t) => `
      <button class="sm-chip" data-sm-chip="${escapeAttr(t.name)}">
        <span class="ico">${escapeHtml(t.name.charAt(0))}</span>${escapeHtml(t.name)}
      </button>`).join('');
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
      close();
    }
  });
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  navEl.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tab]');
    if (!b) return;
    setTab(b.dataset.tab);
    navEl.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
    render();
  });
  chips.addEventListener('click', (e) => {
    const c = e.target.closest('[data-sm-chip]');
    if (!c) return;
    input.value = c.dataset.smChip;
    pageInput.value = c.dataset.smChip;
    setQuery(c.dataset.smChip);
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
    const [kind, id] = item.dataset.smGo.split(':');
    close();
    if (kind === 'book')   nav.goBook(id);
    if (kind === 'author') nav.goAuthor(id);
    if (kind === 'topic')  nav.goTopic(id);
    if (kind === 'pojam')  nav.goPojam(id);
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
