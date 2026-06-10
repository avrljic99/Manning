// Shared, pure building blocks for the search modal — grids, cards and the
// section wrapper. Lives apart from tabs.js (the tab registry) so both the tab
// renderers and the in-modal detail views can reuse them without a cycle.
//
// Labels here are intentionally minimal: the icon/context already conveys the
// type, so cards show counts rather than redundant "Author"/"Topic"/"Concept".

import { escapeHtml, escapeAttr } from '../lib/dom.js';
import { AUTHORS } from '../data/index.js';
import { coverWrap } from '../lib/covers.js';

export function smGrid(items, renderer) {
  if (!items.length) return `<div class="sm-empty">No results</div>`;
  return `<div class="sm-grid">${items.map(renderer).join('')}</div>`;
}

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
export const bookAuthorNames = (b) =>
  (b.authorIds || []).map((id) => AUTHORS.find((a) => a.id === id)?.name).filter(Boolean).join(', ') || 'Manning';

// Reference-style book card: designed cover on top, then title and "year ·
// author" below. No price. Click navigates out (data-sm-go="book:id").
export const yearAuthor = (b) => `${b.year ? escapeHtml(String(b.year)) + ' · ' : ''}${escapeHtml(bookAuthorNames(b))}`;

export const bookCard = (b) => `<div class="bookcard sm-bookcard" data-sm-go="book:${escapeAttr(b.id)}">
    ${coverWrap(b)}
    <div class="bc-meta">
      <div class="bt">${escapeHtml(b.title)}</div>
      <div class="ba">${yearAuthor(b)}</div>
    </div>
  </div>`;

export const authorCard = (a) => `<div class="sm-card-item" data-sm-go="author:${escapeAttr(a.id)}">
    <div class="ttl">${escapeHtml(a.name)}</div>
    <div class="meta">${plural(a.bookIds?.length || 0, 'book')}</div></div>`;

export const topicCard = (t) => `<div class="sm-card-item" data-sm-go="topic:${escapeAttr(t.id)}">
    <div class="ttl">${escapeHtml(t.name)}</div>
    <div class="meta">${escapeHtml(t.desc || plural(t.bookIds?.length || 0, 'book'))}</div></div>`;

export const pojamCard = (p) => `<div class="sm-card-item" data-sm-go="pojam:${escapeAttr(p.id)}">
    <div class="ttl">${escapeHtml(p.name)}</div>
    <div class="meta">${p.bookCount ? plural(p.bookCount, 'book') : ''}</div></div>`;

export function section(title, body) {
  return `<div class="sm-section"><h3 class="sm-section-title">${title}</h3>${body}</div>`;
}
