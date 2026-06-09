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

import { BOOKS, AUTHORS, TOPICS, POJMOVI } from '../data/index.js';
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
const booksSection = () => section('Trending books', smGrid(BOOKS.slice(0, 12), bookCard));
const topicsSection = (title) => section(title, smGrid(TOPICS.slice(0, 12), topicCard));
const authorsSection = () => section('Authors', smGrid(AUTHORS.slice(0, 12), authorCard));
const conceptsSection = () => section('Concepts', smGrid(POJMOVI.slice(0, 12), pojamCard));

// --- tab renderers (empty mode) ---------------------------------------------
function explore() {
  return yourBooksSection() + booksSection() + topicsSection('Topics') + authorsSection() + conceptsSection();
}
const books = () => booksSection();
const categories = () => topicsSection('Categories');
const topics = () => topicsSection('Topics');
const authors = () => authorsSection();
const concepts = () => conceptsSection();

// Registry: drives the left-nav active state and the render dispatcher.
export const TABS = [
  { id: 'explore',    label: 'Explore',    icon: '🧭' },
  { id: 'categories', label: 'Categories', icon: '🗂' },
  { id: 'books',      label: 'Books',      icon: '📚' },
  { id: 'authors',    label: 'Authors',    icon: '✍️' },
  { id: 'topics',     label: 'Topics',     icon: '🏷' },
  { id: 'pojmovi',    label: 'Concepts',   icon: '💡' },
];

export const tabRenderers = { explore, books, categories, authors, topics, pojmovi: concepts };

// --- searching mode (query non-empty): flat list ranked by score ------------
export function searchingView(ctx, q) {
  const { bookAuthors, bookCoverImg, initials, CATEGORY_LOGOS } = ctx.helpers;
  const ql = q.trim();

  const allScored = [
    ...BOOKS  .map((b) => ({ kind: 'book',   item: b, s: scoreBook(b, ql) })),
    ...AUTHORS.map((a) => ({ kind: 'author', item: a, s: scoreAuthor(a, ql) })),
    ...TOPICS .map((t) => ({ kind: 'topic',  item: t, s: scoreTopic(t, ql) })),
    ...POJMOVI.map((p) => ({ kind: 'pojam',  item: p, s: scorePojam(p, ql) })),
  ].filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 10);

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

  // Autocomplete: the ranked list IS the result — no explicit "search"/"ask AI"
  // rows. Question-shaped queries are routed to the AI state by the dispatcher;
  // everything else lands here, and Enter opens the full SRP.
  if (!allScored.length) {
    return `<div class="sm-empty">No results for "${escapeHtml(ql)}"</div>`;
  }

  const rows = allScored.map((r) => `
    <div class="sm-row kind-${r.kind}" data-sm-go="${r.kind}:${escapeAttr(r.item.id)}">
      <div class="sm-rico ${r.kind}">${iconFor[r.kind](r)}</div>
      <div class="sm-rmain">
        <div class="sm-rtitle">${escapeHtml(titleFor[r.kind](r))}</div>
        <div class="sm-rmeta">${escapeHtml(metaFor[r.kind](r))}</div>
      </div>
    </div>`).join('');

  return `<div class="sm-list">${rows}</div>`;
}
