// In-modal detail views — condensed, browsable versions of the topic and
// concept pages, rendered on top of the modal via the nav stack (state.js).
//
// The back affordance + the view title now live in the modal's search field
// (the magnifier becomes a back chevron, the placeholder becomes the title),
// so these renderers no longer draw their own back bar or repeat the title.
//
// Cross-link rule: concept chips and child-topic chips PUSH a new in-modal view
// (data-sm-go="pojam:id" / "topic:id"); book and author items navigate OUT.

import { BOOKS, TOPICS, POJMOVI, VIDEOS } from '../data/index.js';
import { escapeHtml, escapeAttr } from '../lib/dom.js';
import { smGrid, bookCard, section } from './shared.js';
import { coverWrap } from '../lib/covers.js';

const conceptChip = (p) =>
  `<button class="sm-concept-chip" data-sm-go="pojam:${escapeAttr(p.id)}">${escapeHtml(p.name)}</button>`;
const topicChip = (t) =>
  `<button class="sm-concept-chip" data-sm-go="topic:${escapeAttr(t.id)}">${escapeHtml(t.name)}</button>`;
const chipWrap = (chips) => `<div class="sm-concept-chips">${chips.join('')}</div>`;

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

// Minimal video-course card: neutral thumbnail + play glyph, title, instructor.
const videoCard = (v) => `<div class="sm-vidcard">
    <div class="sm-vid-thumb"><span class="play">▶</span></div>
    <div class="bc-meta">
      <div class="bt">${escapeHtml(v.title)}</div>
      <div class="ba">${escapeHtml(v.instructor || 'Manning')}${v.date ? ' · ' + escapeHtml(v.date) : ''}</div>
    </div>
  </div>`;
const vidGrid = (list) => `<div class="sm-vid-grid">${list.map(videoCard).join('')}</div>`;

// Free material: a book shown as a free sample chapter (same card, FREE tag).
const freeCard = (b) => `<div class="bookcard sm-bookcard" data-sm-go="book:${escapeAttr(b.id)}">
    ${coverWrap(b)}
    <div class="bc-meta">
      <div class="bt">${escapeHtml(b.title)}</div>
      <div class="ba"><span class="sm-free-tag">FREE</span> Sample chapter</div>
    </div>
  </div>`;

// --- Topic / Category -------------------------------------------------------
export function topicDetail(ctx, topic) {
  const books = topic.bookIds.map((id) => BOOKS.find((b) => b.id === id)).filter(Boolean);
  const children = TOPICS.filter((t) => t.parent === topic.id);
  const videos = VIDEOS.filter((v) => (v.topicIds || []).includes(topic.id));
  const byLevel = (lvl) => books.filter((b) => b.level === lvl);
  // "Bestseller" proxy: blend of price and recency (same as the home page).
  const bestsellers = [...books]
    .sort((a, b) => (b.price + (b.year || 0) * 0.5) - (a.price + (a.year || 0) * 0.5))
    .slice(0, 6);
  const grid = (list) => smGrid(list.slice(0, 6), bookCard);

  return `<div class="sm-detail">
    <div class="sm-detail-head">
      <div>
        <div class="desc">${escapeHtml(topic.blurb || topic.desc || '')}</div>
        <div class="stat">${plural(books.length, 'book')}</div>
        ${children.length ? `<div class="sm-subcats">${chipWrap(children.map(topicChip))}</div>` : ''}
      </div>
    </div>
    ${byLevel('Beginner').length     ? section('For beginners', grid(byLevel('Beginner'))) : ''}
    ${byLevel('Intermediate').length ? section('Intermediate',  grid(byLevel('Intermediate'))) : ''}
    ${byLevel('Advanced').length     ? section('Advanced',      grid(byLevel('Advanced'))) : ''}
    ${bestsellers.length ? section('Bestsellers', grid(bestsellers)) : ''}
    ${videos.length ? section(`Video courses on ${escapeHtml(topic.name)}`, vidGrid(videos.slice(0, 4))) : ''}
    ${books.length  ? section('Free materials', smGrid(books.slice(0, 6), freeCard)) : ''}
  </div>`;
}

// --- Author -----------------------------------------------------------------
export function authorDetail(ctx, author) {
  const books = (author.bookIds || []).map((id) => BOOKS.find((b) => b.id === id)).filter(Boolean);
  const topicIds = [...new Set(books.flatMap((b) => b.topicIds || []))];
  const topics = topicIds.map((id) => TOPICS.find((t) => t.id === id)).filter(Boolean);
  const videos = VIDEOS.filter((v) => (v.instructor || '') === author.name);

  return `<div class="sm-detail">
    <div class="sm-detail-head">
      <div>
        <div class="desc">${escapeHtml(author.bio || '')}</div>
        <div class="stat">${plural(books.length, 'book')}</div>
        ${topics.length ? `<div class="sm-subcats">${chipWrap(topics.map(topicChip))}</div>` : ''}
      </div>
    </div>
    ${books.length ? section(`Books by ${escapeHtml(author.name)}`, smGrid(books.slice(0, 12), bookCard)) : ''}
    ${videos.length ? section('Video courses', vidGrid(videos.slice(0, 4))) : ''}
  </div>`;
}

// --- Concept (pojam) --------------------------------------------------------
export function pojamDetail(ctx, pojam) {
  const refs = (pojam.bookRefs || [])
    .map((r) => ({ b: BOOKS.find((x) => x.id === r.id), chapter: r.chapter }))
    .filter((r) => r.b);
  const related = (pojam.relatedIds || []).map((id) => POJMOVI.find((p) => p.id === id)).filter(Boolean);

  // Larger book cards (same as Explore) with the chapter as the meta line.
  const booksGrid = `<div class="sm-grid">${refs.map(({ b, chapter }) => `
    <div class="bookcard sm-bookcard" data-sm-go="book:${escapeAttr(b.id)}">
      ${coverWrap(b)}
      <div class="bc-meta">
        <div class="bt">${escapeHtml(b.title)}</div>
        <div class="ba">${escapeHtml(chapter || '')}</div>
      </div>
    </div>`).join('')}</div>`;

  return `<div class="sm-detail">
    <div class="sm-detail-head">
      <div>
        <div class="desc">${escapeHtml(pojam.desc || '')}</div>
        <div class="stat">${plural(pojam.bookCount || refs.length, 'book')}</div>
      </div>
    </div>
    ${pojam.definition ? `<p class="sm-detail-body">${escapeHtml(pojam.definition)}</p>` : ''}
    ${pojam.useWhen ? `<p class="sm-detail-when"><b>When to use:</b> ${escapeHtml(pojam.useWhen)}</p>` : ''}
    ${refs.length ? section('In these books', booksGrid) : ''}
    ${related.length ? section('Related concepts', chipWrap(related.map(conceptChip))) : ''}
  </div>`;
}
