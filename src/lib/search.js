// Search ranking & intent classification. Pure functions over the data layer.
import { BOOKS, AUTHORS, TOPICS } from '../data/index.js';

export function norm(s){ return s.toLowerCase().trim() }
export function tokens(s){ return norm(s).split(/\s+/).filter(Boolean) }

export function highlight(text, q){
  if(!q) return text;
  const re = new RegExp('('+q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','ig');
  return text.replace(re, '<mark>$1</mark>');
}

export function scoreBook(book, q){
  if(!q) return 0;
  const qn = norm(q), tt = norm(book.title);
  const authorNames = book.authorIds.map(a=>AUTHORS.find(x=>x.id===a)?.name||'').join(' ').toLowerCase();
  const topicNames = book.topicIds.map(t=>TOPICS.find(x=>x.id===t)?.name||'').join(' ').toLowerCase();
  let s = 0;
  if(tt.startsWith(qn)) s += 5;
  if(tt.includes(qn)) s += 3;
  tokens(qn).forEach(tok => {
    if(tt.includes(tok)) s += 1.5;
    if(authorNames.includes(tok)) s += 1.2;
    if(topicNames.includes(tok)) s += 0.8;
  });
  // popularity / recency prior
  s += Math.log(book.year - 2000) * 0.15;
  return s;
}
export function scoreAuthor(a, q){
  if(!q) return 0;
  const qn = norm(q), nm = norm(a.name);
  let s = 0;
  if(nm.startsWith(qn)) s += 5;
  if(nm.includes(qn)) s += 3;
  tokens(qn).forEach(tok => { if(nm.includes(tok)) s += 1.5 });
  s += Math.log(a.bookIds.length + 1) * 0.3;
  return s;
}
export function scorePojam(p, q){
  if(!q) return 0;
  const qn = norm(q), nm = norm(p.name);
  let s = 0;
  if(nm === qn) s += 6;
  if(nm.startsWith(qn)) s += 4;
  if(nm.includes(qn)) s += 2.5;
  tokens(qn).forEach(tok => { if(nm.includes(tok)) s += 1.2 });
  return s;
}

export function scoreVideo(v, q){
  if(!q) return 0;
  const qn = norm(q), tt = norm(v.title);
  const topicNames = v.topicIds.map(t=>TOPICS.find(x=>x.id===t)?.name||'').join(' ').toLowerCase();
  const inst = norm(v.instructor||'');
  let s = 0;
  if(tt.startsWith(qn)) s += 5;
  if(tt.includes(qn)) s += 3;
  tokens(qn).forEach(tok => {
    if(tt.includes(tok)) s += 1.5;
    if(topicNames.includes(tok)) s += 0.8;
    if(inst.includes(tok)) s += 1.0;
  });
  return s;
}

export function scoreTopic(t, q){
  if(!q) return 0;
  const qn = norm(q), nm = norm(t.name);
  let s = 0;
  if(nm === qn) s += 8;
  if(nm.startsWith(qn)) s += 5;
  if(nm.includes(qn)) s += 3;
  tokens(qn).forEach(tok => { if(nm.includes(tok)) s += 1.2 });
  s += Math.log(t.bookIds.length + 1) * 0.3;
  return s;
}

export function searchAll(q){
  if(!q || !q.trim()) return { books:[], authors:[], topics:[], topHit:null, intent:'empty' };
  const books   = BOOKS  .map(b=>({item:b, s:scoreBook(b,q)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s);
  const authors = AUTHORS.map(a=>({item:a, s:scoreAuthor(a,q)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s);
  const topics  = TOPICS .map(t=>({item:t, s:scoreTopic(t,q)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s);

  // Intent classification
  const qn = norm(q);
  const wc = tokens(qn).length;
  const isQuestion = /^(how|what|why|where|which|kako|koji|kakav)\b/.test(qn);
  const hasLearningMod = /\b(beginner|advanced|intermediate|learn|tutorial|guide|for kids|for beginners|getting started|introduction)\b/.test(qn);
  const isLearning = isQuestion || hasLearningMod || wc > 6;

  let topHit = null, intent = 'exploratory';
  if(books.length && (books[0].s >= 5 && (!books[1] || books[0].s >= books[1].s * 1.5))){
    topHit = { kind:'book', item: books[0].item };
    intent = 'navigational';
  } else if(topics.length && topics[0].s >= 8){
    topHit = { kind:'topic', item: topics[0].item };
    intent = 'navigational';
  } else if(authors.length && authors[0].s >= 5 && (!authors[1] || authors[0].s >= authors[1].s * 1.5)){
    topHit = { kind:'author', item: authors[0].item };
    intent = 'navigational';
  }
  if(isLearning && intent !== 'navigational') intent = 'learning';

  return {
    books:   books  .slice(0,20).map(x=>x.item),
    authors: authors.slice(0,10).map(x=>x.item),
    topics:  topics .slice(0,10).map(x=>x.item),
    topHit, intent
  };
}

// True when a query reads like a question the AI assistant should answer
// (question words, comparisons, recommendations, learning-path asks, "?").
export function isAskAIIntent(q){
  const qn = norm(q||'');
  if(!qn) return false;
  if(qn.includes('?')) return true;
  if(/^(kako|how|tko\s+je|who\s+is|[šs]to|what|koji|koja|koje|kada|when|za[šs]to|why|gdje|where)\b/.test(qn)) return true;
  if(/\b(vs|versus|ili|or|usporedi|razlika|compare)\b/.test(qn)) return true;
  if(/\b(preporu[čc]i|recommend|najbolja|najbolji|best\s+book|which\s+book)\b/.test(qn)) return true;
  if(/\b(nau[čc]iti|learn\s+to|getting\s+started|learning\s+path|put\s+u[čc]enja|koliko\s+vremena|how\s+long|where\s+to\s+start)\b/.test(qn)) return true;
  if(/(što|sto)\s+(čitati|citati)\s+nakon|what\s+next|next\s+book/.test(qn)) return true;
  return false;
}
