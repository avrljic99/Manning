// Shared book-cover rendering. A "designed" flat cover (topic colour, brand +
// level label, typeset title, faint topic motif) is generated for every book.
// If a book carries a `coverUrl` (a licensed asset the designer drops in), that
// image is shown instead — so real cover art can be wired up without markup
// changes. Used by both the site cards (main.js) and the search modal (shared.js).

import { escapeHtml, escapeAttr } from './dom.js';

// Primary-topic → cover colour (tech-brand palette).
export const TOPIC_COVER_COLORS = {
  python:'#306998', pyds:'#150458', django:'#092E20',
  js:'#F0DB4F', react:'#20232A', node:'#339933',
  go:'#00ADD8', rust:'#CE422B',
  ml:'#FF6F00', dl:'#5E35B1', ai:'#1976D2', data:'#37474F',
  k8s:'#326CE5', devops:'#E65100', sec:'#B71C1C',
};

export function coverColors(b) {
  const topic = (b.topicIds && b.topicIds[0]) || 'python';
  const bg = TOPIC_COVER_COLORS[topic] || '#37474F';
  const fg = (bg === '#F0DB4F' || bg === '#00ADD8') ? '#1a1a1a' : '#fff';
  return { topic, bg, fg };
}

// Small book-shaped thumbnail (square bound left + spine, rounded right) for
// list rows — same book look as the full cover, just an initial instead of the
// title. Honours `coverUrl` when present.
export function miniCover(b) {
  if (b.coverUrl) {
    return `<span class="bmini bmini-img"><img src="${escapeAttr(b.coverUrl)}" alt="${escapeAttr(b.title)}" loading="lazy"/></span>`;
  }
  const { bg, fg } = coverColors(b);
  const initial = (b.title || '').replace(/^(The |A |An )/i, '').trim().charAt(0).toUpperCase();
  return `<span class="bmini" style="--cv:${bg};--cfg:${fg}">${escapeHtml(initial)}</span>`;
}

// Cover wrapper for the modal book cards: the cover plus an "inside page" that
// holds a short description, revealed by the book-opening hover transition.
export function coverWrap(b) {
  const inside = b.desc ? `<div class="bc-inside"><p>${escapeHtml(b.desc)}</p></div>` : '';
  return `<div class="bc-cover-wrap">${bookCoverHTML(b)}${inside}</div>`;
}

// `logos` is an optional id→glyph/SVG map (CATEGORY_LOGOS) for the watermark
// motif; omit it (e.g. in the compact modal) to skip the motif.
export function bookCoverHTML(b, logos) {
  if (b.coverUrl) {
    return `<div class="bcover bcover-img"><img src="${escapeAttr(b.coverUrl)}" alt="${escapeAttr(b.title)}" loading="lazy"/></div>`;
  }
  const { topic, bg, fg } = coverColors(b);
  const motif = (logos && logos[topic]) ? `<div class="bcover-m" aria-hidden="true">${logos[topic]}</div>` : '';
  return `<div class="bcover" style="--cv:${bg};--cfg:${fg}">
    <div class="bcover-h"><span>Manning</span><span>${escapeHtml(b.level || '')}</span></div>
    <div class="bcover-t">${escapeHtml(b.title)}</div>
    ${motif}
  </div>`;
}
