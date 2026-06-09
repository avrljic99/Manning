// Search-modal tab registry + renderers.
//
// To add a tab: write a renderer `myTab(ctx)` that returns an HTML string,
// add it to `tabRenderers`, add an entry to `TABS`, and add a matching
// <button data-tab="myTab"> in the modal markup (index.html). That's it —
// the dispatcher in index.js picks it up automatically.
//
// `ctx` carries app glue injected by initSearchModal: { helpers }.
//   helpers = { bookAuthors, bookCoverImg, initials, CATEGORY_LOGOS }
// Data, scoring and escaping are imported directly (stable shared layers).

import { BOOKS, AUTHORS, TOPICS, POJMOVI, VIDEOS } from '../data/index.js';
import { scoreBook, scoreAuthor, scoreTopic, scorePojam } from '../lib/search.js';
import { escapeHtml, escapeAttr } from '../lib/dom.js';

// --- shared building blocks -------------------------------------------------
function smGrid(items, renderer) {
  if (!items.length) return `<div class="sm-empty">No results</div>`;
  return `<div class="sm-grid">${items.map(renderer).join('')}</div>`;
}

const bookCard = (b) => `<div class="sm-card-item" data-sm-go="book:${escapeAttr(b.id)}">
    <div><div class="sm-cover"></div><div class="ttl">${escapeHtml(b.title)}</div></div>
    <div class="meta">${b.level || ''}${b.year ? ' · ' + b.year : ''}</div></div>`;
const authorCard = (a) => `<div class="sm-card-item" data-sm-go="author:${escapeAttr(a.id)}">
    <div class="ttl">${escapeHtml(a.name)}</div>
    <div class="meta">Author${a.bookIds ? ' · ' + a.bookIds.length + ' books' : ''}</div></div>`;
const topicCard = (t) => `<div class="sm-card-item" data-sm-go="topic:${escapeAttr(t.id)}">
    <div class="ttl">${escapeHtml(t.name)}</div>
    <div class="meta">${escapeHtml(t.desc || 'Topic')}</div></div>`;
const pojamCard = (p) => `<div class="sm-card-item" data-sm-go="pojam:${escapeAttr(p.id)}">
    <div class="ttl">${escapeHtml(p.name)}</div>
    <div class="meta">${p.bookCount ? p.bookCount + ' books' : 'Concept'}</div></div>`;

function section(title, body) {
  return `<div class="sm-section"><h3 class="sm-section-title">${title}</h3>${body}</div>`;
}

// --- per-section content (composed by tabs below) ---------------------------
function yourBooksSection() {
  const yourBooks = [...BOOKS].sort((a, b) => (b.year || 0) - (a.year || 0)).slice(0, 4);
  const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
  const cards = yourBooks.map((b, i) => {
    const pct = 10 + (hash(b.id) % 80); // stable mock 10–89%
    return `<div class="sm-yb-card" data-sm-go="book:${escapeAttr(b.id)}">
      <div class="sm-yb-cover c${i % 4}"></div>
      <div class="sm-yb-body">
        <div class="sm-yb-ttl">${escapeHtml(b.title)}</div>
        <div class="sm-yb-prog">
          <div class="sm-yb-bar"><div style="width:${pct}%"></div></div>
          <div class="sm-yb-pct">${pct}% read</div>
        </div>
      </div>
    </div>`;
  }).join('');
  return `<div class="sm-section">
    <h3 class="sm-section-title">Your books · reading now</h3>
    <div class="sm-yb-grid">${cards}</div>
  </div>`;
}
const booksSection = () => smGrid(BOOKS.slice(0, 12), bookCard);
const topicsSection = (title) => section(title, smGrid(TOPICS.slice(0, 12), topicCard));
const authorsSection = () => section('Authors', smGrid(AUTHORS.slice(0, 12), authorCard));
const conceptsSection = () => section('Concepts', smGrid(POJMOVI.slice(0, 12), pojamCard));

// Emoji glyphs used as count icons across the modal lists.
const BOOK_ICON_SVG   = `<span class="sm-emoji" aria-hidden="true">📚</span>`;
const VIDEO_ICON_SVG  = `<span class="sm-emoji" aria-hidden="true">📹</span>`;
const AUTHOR_ICON_SVG = `<span class="sm-emoji" aria-hidden="true">✍🏻</span>`;

const sortByName = (arr) => [...arr].sort((a, b) => a.name.localeCompare(b.name));
const bookCountOf = (it) => it.bookCount != null ? it.bookCount : (it.bookIds?.length || 0);
const sortByPopularity = (arr) => [...arr].sort((a, b) => bookCountOf(b) - bookCountOf(a));

// Left-side visual badge for list rows — initials avatar for authors,
// category logo (SVG or emoji glyph) for topics. Both render as a 28px circle.
function authorAvatarHTML(name, helpers) {
  const init = helpers?.initials ? helpers.initials(name)
             : (name.charAt(0) + (name.split(/\s+/)[1]?.charAt(0) || '')).toUpperCase();
  return `<span class="sm-row-av sm-row-av-author">${escapeHtml(init)}</span>`;
}
function categoryLogoHTML(topicId, helpers) {
  const logo = helpers?.CATEGORY_LOGOS?.[topicId] || '◧';
  return `<span class="sm-row-av sm-row-av-topic">${logo}</span>`;
}

// Row renderers — used by both full and "top N" lists.
function categoryRowHTML(t, ctx) {
  const books   = t.bookIds?.length || 0;
  const videos  = VIDEOS.filter((v) => v.topicIds?.includes(t.id)).length;
  const authors = new Set(
    BOOKS.filter((b) => b.topicIds?.includes(t.id)).flatMap((b) => b.authorIds || [])
  ).size;
  return `<button class="sm-cat-row" data-sm-go="topic:${escapeAttr(t.id)}">
    ${categoryLogoHTML(t.id, ctx?.helpers)}
    <span class="ttl">${escapeHtml(t.name)}</span>
    <span class="counts">
      <span class="count" title="${books} books"><span class="n">${books}</span>${BOOK_ICON_SVG}</span>
      <span class="count" title="${videos} videos"><span class="n">${videos}</span>${VIDEO_ICON_SVG}</span>
      <span class="count" title="${authors} authors"><span class="n">${authors}</span>${AUTHOR_ICON_SVG}</span>
    </span>
  </button>`;
}
function singleCountRowHTML(it, goKind, ctx) {
  const left = goKind === 'author' ? authorAvatarHTML(it.name, ctx?.helpers) : '';
  return `<button class="sm-cat-row" data-sm-go="${goKind}:${escapeAttr(it.id)}">
    ${left}
    <span class="ttl">${escapeHtml(it.name)}</span>
    <span class="count"><span class="n">${bookCountOf(it)}</span>${BOOK_ICON_SVG}</span>
  </button>`;
}
const listWrap = (rowsHTML) => `<div class="sm-cat-list">${rowsHTML}</div>`;

// Dedicated-tab lists: full catalog, sorted alphabetically.
const categoriesList = (ctx) => listWrap(sortByName(TOPICS).map((t) => categoryRowHTML(t, ctx)).join(''));
const authorsList    = (ctx) => listWrap(sortByName(AUTHORS).map((a) => singleCountRowHTML(a, 'author', ctx)).join(''));
const conceptsList   = (ctx) => listWrap(sortByName(POJMOVI).map((p) => singleCountRowHTML(p, 'pojam',  ctx)).join(''));

// Explore sub-sections: top N by popularity.
const categoriesTopList = (n, ctx) => listWrap(sortByPopularity(TOPICS) .slice(0, n).map((t) => categoryRowHTML(t, ctx)).join(''));
const authorsTopList    = (n, ctx) => listWrap(sortByPopularity(AUTHORS).slice(0, n).map((a) => singleCountRowHTML(a, 'author', ctx)).join(''));

// Concepts in Explore render as quoted pill chips (compact overview).
function conceptsChipsExplore() {
  const chips = sortByPopularity(POJMOVI).map((p) => `
    <button class="sm-concept-chip" data-sm-go="pojam:${escapeAttr(p.id)}">"${escapeHtml(p.name)}"</button>
  `).join('');
  return section('Concepts', `<div class="sm-concept-chips">${chips}</div>`);
}

// --- tab renderers (empty mode) ---------------------------------------------
function explore(ctx) {
  // Explore = curated overview: 8 trending books, top 5 popular categories &
  // authors (by book count), plus concepts as quoted pill chips.
  return yourBooksSection()
    + section('Books',              smGrid(BOOKS.slice(0, 8), bookCard))
    + section('Popular Categories', categoriesTopList(5, ctx))
    + section('Popular Authors',    authorsTopList(5, ctx))
    + conceptsChipsExplore();
}
const books = () => booksSection();
const categories = (ctx) => categoriesList(ctx);
const authors    = (ctx) => authorsList(ctx);

// Registry: drives the left-nav active state and the render dispatcher.
// Concepts intentionally omitted — they live only in the Explore overview
// as quoted pill chips; no dedicated tab.
export const TABS = [
  { id: 'explore',    label: 'Explore',    icon: '🧭' },
  { id: 'categories', label: 'Categories', icon: '🗂' },
  { id: 'books',      label: 'Books',      icon: '📚' },
  { id: 'authors',    label: 'Authors',    icon: '✍️' },
];

export const tabRenderers = { explore, books, categories, authors };

// --- searching mode (query non-empty): flat list ranked by score ------------
export function searchingView(ctx, q) {
  const { bookAuthors, bookCoverImg, initials, CATEGORY_LOGOS } = ctx.helpers;
  const ql = q.trim();

  const allScored = [
    ...BOOKS  .map((b) => ({ kind: 'book',   item: b, s: scoreBook(b, ql) })),
    ...AUTHORS.map((a) => ({ kind: 'author', item: a, s: scoreAuthor(a, ql) })),
    ...TOPICS .map((t) => ({ kind: 'topic',  item: t, s: scoreTopic(t, ql) })),
    ...POJMOVI.map((p) => ({ kind: 'pojam',  item: p, s: scorePojam(p, ql) })),
  ].filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 6);

  // Two trailing rows: (7) "Search for query" → SRP, (8) "Ask AI about query" → AI.
  // The query is carried in a separate data-sm-q attribute so colons inside the
  // query don't confuse the smGo parser.
  const trailingRows = `
    <div class="sm-row sm-row-search" data-sm-go="search" data-sm-q="${escapeAttr(ql)}">
      <div class="sm-rico search">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
      </div>
      <div class="sm-rmain">
        <div class="sm-rtitle">${escapeHtml(ql)}</div>
      </div>
    </div>
    <div class="sm-row sm-row-search" data-sm-go="askai" data-sm-q="${escapeAttr(ql)}">
      <div class="sm-rico ai">✦</div>
      <div class="sm-rmain">
        <div class="sm-rtitle">Ask AI about "${escapeHtml(ql)}"</div>
      </div>
    </div>`;

  const titleFor = { book: r => r.item.title, author: r => r.item.name, topic: r => r.item.name, pojam: r => r.item.name };
  const metaFor = {
    book: (r) => {
      const author = bookAuthors(r.item);
      const topic = r.item.topicIds.map(t => TOPICS.find(x => x.id === t)?.name).filter(Boolean)[0] || '';
      const parts = [];
      if (author && author !== '—') parts.push(author);
      if (topic) parts.push(topic);
      return parts.join(' · ');
    },
    author: (r) => `${(r.item.bio || '').split('.')[0]} · ${r.item.bookIds.length} ${r.item.bookIds.length === 1 ? 'book' : 'books'}`,
    topic: (r) => {
      const n = r.item.bookIds.length;
      const parts = [`${n} ${n === 1 ? 'book' : 'books'}`];
      if (r.item.desc) parts.push(r.item.desc);
      return parts.join(' · ');
    },
    pojam: (r) => `Topic mentioned in ${r.item.bookCount || 0} books`,
  };
  const iconFor = {
    book: (r) => bookCoverImg(r.item),
    author: (r) => escapeHtml(initials(r.item.name)),
    topic: (r) => CATEGORY_LOGOS[r.item.id] || '◧',
    pojam: () => '#',
  };

  // Autocomplete: up to 6 ranked results, then "Search for {q}" and "Ask AI" rows.
  if (!allScored.length) {
    return `<div class="sm-empty">No results for "${escapeHtml(ql)}"</div>
      <div class="sm-list">${trailingRows}</div>`;
  }

  const rows = allScored.map((r) => `
    <div class="sm-row kind-${r.kind}" data-sm-go="${r.kind}:${escapeAttr(r.item.id)}">
      <div class="sm-rico ${r.kind}">${iconFor[r.kind](r)}</div>
      <div class="sm-rmain">
        <div class="sm-rtitle">${escapeHtml(titleFor[r.kind](r))}</div>
        <div class="sm-rmeta">${escapeHtml(metaFor[r.kind](r))}</div>
      </div>
    </div>`).join('');

  return `<div class="sm-list">${rows}${trailingRows}</div>`;
}
