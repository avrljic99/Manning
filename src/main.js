// Manning search prototype — main entry
// Migrated from monolithic index.html to Vite.
// Styles (imported so Vite bundles + HMRs them):
import './styles/base.css';
import './styles/search-modal.css';
import { TOPICS, AUTHORS, POJMOVI, VIDEOS, BOOKS } from './data/index.js';
import { norm, tokens, highlight, scoreBook, scoreAuthor, scorePojam, scoreVideo, scoreTopic, searchAll, isAskAIIntent } from './lib/search.js';
import { escapeHtml, escapeAttr } from './lib/dom.js';
import { initSearchModal } from './search-modal/index.js';

// Assigned once initSearchModal runs (end of file); used by the search-trigger handlers.
let searchModalApi = null;

/* =====================================================
   UI: home / SRP / dropdown
   ===================================================== */
const main = document.getElementById('main');
const dd = document.getElementById('dd');
const input = document.getElementById('q');
const searchEl = document.getElementById('search');
const clearBtn = document.getElementById('clearBtn');

const coverClasses = ['','a','b','c','d','e'];
function coverFor(book){ return book.cover && coverClasses.includes(book.cover) ? book.cover : '' }
function bookAuthors(b){ return b.authorIds.map(a=>AUTHORS.find(x=>x.id===a)?.name).filter(Boolean).join(', ') || '—' }
function initials(name){ return name.split(' ').map(w=>w[0]).slice(0,2).join('') }

/* ----- Home page — 1:1 Manning layout replica ----- */
const MANNING_TIPS = [
  'An eBook can be upgraded to a pBook for just $12 + shipping.',
  'Books in the early access program are called MEAPs — you can read chapters as they\'re being written.',
  'Register your print book and get the eBook free!',
  'The liveBook online reader includes tests for every book.',
  'Every day a different book gets 45% off. Check out the Deal of the Day!',
  'The liveBook reader includes an AI assistant.',
  'liveBook discussions let you talk with authors and other readers.',
  'The AI assistant knows where you are in the book.',
];

function renderHome(){
  const recentBooks = [...BOOKS].sort((a,b)=>b.year-a.year).slice(0,15);
  const bestsellers = [...BOOKS].sort((a,b)=>(b.price + b.year*0.5) - (a.price + a.year*0.5)).slice(0,10);
  const dotd = bestsellers[0];
  const meapFeature = recentBooks.find(b => b.year >= 2024) || recentBooks[0];

  const bundles = [
    { title:'Modern Game Development',
      bookIds:['fluent-python','data-science-scratch','designing-data-apps','hands-on-ml','python-data-analysis'] },
    { title:'Small Models, Big Impact',
      bookIds:['building-llms','prompt-engineering','hands-on-ml','deep-learning-python','ml-engineering'] },
  ];

  const today = 'May 24, 2026';
  const tipIdx = Math.floor((Date.parse('2026-06-01') / 86400000) % MANNING_TIPS.length);
  const tip = MANNING_TIPS[tipIdx];

  main.innerHTML = `
    <div class="container">

      <!-- HERO: MANNING|ONLINE -->
      <section class="mn-online-hero">
        <div class="wordmark">MANNING <span class="pipe">|</span> <span class="online">ONLINE</span></div>
        <div class="sub">subscribe today to enjoy <b>all our content. all the time.</b></div>
        <svg class="cursor" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.5">
          <path d="M5 3l4 16 2-6 6-2z"/><path d="M14 14l5 5"/>
        </svg>
      </section>

      <!-- MAIN GRID: wide content + narrow sidebar -->
      <div class="mn-home-grid">

        <!-- LEFT MAIN COLUMN -->
        <div>
          <!-- RECENT RELEASES -->
          <div class="mn-h">recent releases</div>
          <div class="mn-cover-row">
            ${recentBooks.slice(0,5).map(b => `
              <div class="mn-cv-card" onclick="goBook('${b.id}')">
                <div class="cover ${coverFor(b)}">${escapeHtml(b.title)}</div>
                ${b.year>=2024?'<span class="meap-sticker">MEAP</span>':''}
              </div>`).join('')}
          </div>
          <div class="mn-cover-row" style="margin-top:14px">
            ${recentBooks.slice(5,10).map(b => `
              <div class="mn-cv-card" onclick="goBook('${b.id}')">
                <div class="cover ${coverFor(b)}">${escapeHtml(b.title)}</div>
                ${b.year>=2024?'<span class="meap-sticker">MEAP</span>':''}
              </div>`).join('')}
          </div>

          <!-- BESTSELLERS card with MAILERS sidebar -->
          <div class="mn-bestsellers-card">
            <div class="mailers-stack">
              <div class="mailers">
                <div class="hint">An easy way<br>to find out</div>
                <div class="signup">Sign up for our</div>
                <div class="lbl">MAILERS AND<br>DEALS</div>
                <form onsubmit="event.preventDefault();alert('Mock signup')">
                  <input type="email" placeholder="email address" required />
                  <button type="submit">+</button>
                </form>
              </div>
            </div>
            <div class="bs-content">
              <h2>Bestsellers</h2><span class="bs-date">${today}</span>
              <ol class="bs-list">
                ${bestsellers.map(b => `
                  <li><a onclick="goBook('${b.id}')">${escapeHtml(b.title)}</a>${b.year>=2024?'<span class="meap-tag">MEAP</span>':''}</li>`).join('')}
              </ol>
              <div class="decoration"></div>
            </div>
          </div>

          <!-- BUNDLES -->
          <div class="mn-h" style="margin-top:48px">bundles</div>
          <div class="mn-bundles-row">
            ${bundles.map(bundle => {
              const books = bundle.bookIds.map(id => BOOKS.find(b => b.id === id)).filter(Boolean);
              return `<div class="mn-bundle-block">
                <div class="b-h">${escapeHtml(bundle.title)}</div>
                <div class="fan">
                  ${books.map(b => `<div class="cover ${coverFor(b)}" onclick="goBook('${b.id}')">${escapeHtml(b.title.slice(0,18))}</div>`).join('')}
                </div>
                <ul>
                  ${books.map(b => `<li><a onclick="goBook('${b.id}')">${escapeHtml(b.title)}</a></li>`).join('')}
                </ul>
              </div>`;
            }).join('')}
          </div>
        </div>

        <!-- RIGHT SIDEBAR -->
        <aside>
          <!-- DOTD card -->
          <div class="mn-dotd-card">
            <div class="dotd-head">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8">
                <rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/>
              </svg>
              Deal of the Day!
            </div>
            <div class="dotd-body">
              <div class="cover ${coverFor(dotd)}">${escapeHtml(dotd.title.slice(0,12))}</div>
              <div class="dotd-meta">
                <div class="ttl">${escapeHtml(dotd.title)}</div>
                <div class="deal">Deal available TODAY ONLY!</div>
              </div>
            </div>
          </div>

          <!-- MEAP sidebar -->
          <div class="mn-meap-side">
            <div class="head">
              <span class="meap-stamp">MEAP</span>
              <h4>Manning Early Access Program</h4>
            </div>
            <div class="body">
              In MEAP, you get <b>early access</b> to books and liveVideos as they're being created. You get new content as it's available and the finished product the instant it's ready.
            </div>
            <div class="featured-cover ${coverFor(meapFeature)}">
              <div class="title">${escapeHtml(meapFeature.title)}</div>
              <div class="author">${bookAuthors(meapFeature)}</div>
            </div>
          </div>

          <!-- DID YOU KNOW carousel -->
          <div class="mn-dyk-pill">
            <div class="title">DID YOU KNOW?</div>
            <div class="tip-wrap">
              <span class="arrow" onclick="cycleTip(-1)">‹</span>
              <div class="tip" id="dyk-tip">${escapeHtml(tip)}</div>
              <span class="arrow" onclick="cycleTip(1)">›</span>
            </div>
          </div>

          <!-- Write a book / liveProject CTAs -->
          <div class="mn-write-card">
            <a onclick="alert('Stub')">WRITE A BOOK</a>
            <div class="divider"></div>
            <a class="lower" onclick="alert('Stub')">create a liveProject</a>
          </div>

          <!-- Free books / sponsor ad -->
          <div class="mn-sponsor-ad">
            <div class="top">
              <span class="logo">
                <svg viewBox="0 0 60 50" fill="#0b1f3a"><polygon points="0,50 0,0 16,0 32,28 32,50"/><polygon points="28,50 28,28 44,0 60,0 60,50"/></svg>
                MANNING
              </span>
            </div>
            <div class="free-books">
              <div class="h">free<br>books</div>
              <div class="from">from our sponsors</div>
            </div>
            <div class="free-articles">free articles</div>
          </div>
        </aside>
      </div>
    </div>

    <!-- REVIEWS — dark navy full-width band -->
    <section class="mn-reviews-dark">
      <div class="head">
        <h2>Manning Publications reviews</h2>
        <a onclick="alert('Stub')">read more</a>
      </div>
      <div class="panel">
        <div>
          <div class="stars-big">★★★★<span style="opacity:.6">★</span></div>
          <div class="label-big"><b>4.7</b> overall satisfaction rating</div>
          <div class="sublabel">based on 57,995 ratings</div>
        </div>
        <div class="sep"></div>
        <div class="breakdown">
          ${[
            {s:5, pct:77, count:'45K+'},
            {s:4, pct:16, count:'9,480'},
            {s:3, pct:4,  count:'2,499'},
            {s:2, pct:1,  count:'621'},
            {s:1, pct:1,  count:'672'},
          ].map(r => `
            <div class="br-row">
              <div class="star">${r.s}<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><polygon points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9"/></svg></div>
              <div class="bar"><span style="width:${r.pct}%"></span></div>
              <div class="ct">${r.count} (${r.pct}%)</div>
            </div>`).join('')}
        </div>
      </div>
      <div class="laurel">
        <div class="num">45K+</div>
        <div class="stars">★★★★★</div>
        RATINGS
      </div>
    </section>
  `;

  // Cycle tip on arrow click
  window.cycleTip = function(dir){
    const cur = MANNING_TIPS.indexOf(document.getElementById('dyk-tip').textContent.trim());
    const next = (cur + dir + MANNING_TIPS.length) % MANNING_TIPS.length;
    document.getElementById('dyk-tip').textContent = MANNING_TIPS[next];
  };
}

function __OLD_RENDER_HOME_UNUSED(){
  const recent = [...BOOKS].sort((a,b)=>b.year-a.year).slice(0,10);
  const meap = [...BOOKS].filter(b=>b.year>=2024).slice(0,10);
  const bestsellers = [...BOOKS].sort((a,b)=>b.price-a.price).slice(0,10);
  const dotd = BOOKS.find(b=>b.id==='hands-on-ml') || BOOKS[0];
  const featuredAuthor = AUTHORS.find(a=>a.id==='matthes');
  const featuredAuthorBooks = featuredAuthor.bookIds.map(id=>BOOKS.find(x=>x.id===id)).filter(Boolean);

  const categories = [
    {id:'python', name:'Python',          cls:'c1'},
    {id:'ai',     name:'AI & LLMs',       cls:'c2'},
    {id:'ml',     name:'Machine Learning',cls:'c3'},
    {id:'js',     name:'JavaScript',      cls:'c4'},
    {id:'react',  name:'React',           cls:'c5'},
    {id:'k8s',    name:'Kubernetes',      cls:'c6'},
    {id:'go',     name:'Go',              cls:'c7'},
    {id:'data',   name:'Data Engineering',cls:'c8'},
  ];

  main.innerHTML = `
    <!-- HERO -->
    <section class="hero">
      <div class="hero-grid">
        <div class="hero-left">
          <div class="hero-eyebrow">Featured · liveBook included</div>
          <h1>Build LLM-powered applications that actually ship</h1>
          <p>The definitive guide to designing, building, and operating real-world applications powered by large language models — from prompt patterns to production observability.</p>
          <div class="cta">
            <button class="btn primary" onclick="goBook('building-llms')">View the book</button>
            <button class="btn ghost" onclick="goTopic('ai')">More AI titles</button>
          </div>
        </div>
        <div class="hero-right">
          <div class="hero-stack">
            <div class="cover a">Python Crash Course</div>
            <div class="cover b">Building LLM Apps</div>
            <div class="cover c">Fluent Python</div>
          </div>
          <div class="hero-dots"><span></span><span class="active"></span><span></span><span></span></div>
        </div>
      </div>
    </section>

    <!-- DEAL OF THE DAY -->
    <section class="block" style="padding-top:32px;padding-bottom:24px">
      <div class="container">
        <div class="dotd-card">
          <div class="cover ${coverFor(dotd)}">${escapeHtml(dotd.title)}</div>
          <div>
            <span class="tag">Deal of the day</span>
            <h3>${escapeHtml(dotd.title)}</h3>
            <div class="by">${bookAuthors(dotd)} · ${dotd.year} · ${dotd.level}</div>
            <div class="desc">${escapeHtml(dotd.desc)}</div>
          </div>
          <div class="price-block">
            <div class="old">$${dotd.price.toFixed(2)}</div>
            <div class="new">$${(dotd.price*0.55).toFixed(2)}</div>
            <button class="btn" onclick="goBook('${dotd.id}')">Add to cart</button>
          </div>
        </div>
      </div>
    </section>

    <!-- MEAP -->
    <section class="block" style="padding:28px 0">
      <div class="container">
        <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:6px">
          <h2>MEAP — Manning Early Access</h2>
          <a href="#" onclick="goTopic('all');return false" style="color:var(--accent);font-weight:600;font-size:13px">See all MEAP titles →</a>
        </div>
        <p class="sub">Read chapters as they're written — get the finished eBook and pBook when published.</p>
        <div class="carousel">
          <button class="carousel-nav left" onclick="scrollCarousel(this,-1)">‹</button>
          <button class="carousel-nav right" onclick="scrollCarousel(this,1)">›</button>
          <div class="carousel-track">
            ${meap.map(b=>`
              <div class="bookcard" onclick="goBook('${b.id}')">
                <span class="meap-badge">MEAP</span>
                <div class="cover ${coverFor(b)}">${escapeHtml(b.title)}</div>
                <div class="bt">${escapeHtml(b.title)}</div>
                <div class="ba">${bookAuthors(b)}</div>
                <div class="bp">$${b.price.toFixed(2)}</div>
              </div>`).join('')}
          </div>
        </div>
      </div>
    </section>

    <!-- BROWSE CATEGORIES -->
    <section class="block" style="padding:32px 0">
      <div class="container">
        <h2>Browse our catalog</h2>
        <p class="sub">Find books, video courses, and liveProjects by topic</p>
        <div class="cat-grid">
          ${categories.map(c=>{
            const t = TOPICS.find(x=>x.id===c.id);
            const count = t ? t.bookIds.length : 0;
            return `<div class="cat-tile ${c.cls}" onclick="goTopic('${c.id}')">
              <div class="ct-count">${count} titles</div>
              <div class="ct-name">${c.name}</div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </section>

    <!-- RECENTLY PUBLISHED -->
    <section class="block" style="padding:32px 0">
      <div class="container">
        <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:6px">
          <h2>Recently published</h2>
          <a href="#" onclick="goTopic('all');return false" style="color:var(--accent);font-weight:600;font-size:13px">See all new releases →</a>
        </div>
        <p class="sub">Fresh from the press</p>
        <div class="carousel">
          <button class="carousel-nav left" onclick="scrollCarousel(this,-1)">‹</button>
          <button class="carousel-nav right" onclick="scrollCarousel(this,1)">›</button>
          <div class="carousel-track">
            ${recent.map(b=>bookCardHTML(b)).join('')}
          </div>
        </div>
      </div>
    </section>

    <!-- LIVEPROJECT STRIP -->
    <section class="block" style="padding:32px 0;border:0">
      <div class="container">
        <div class="lproject">
          <div>
            <div class="eyebrow">liveProject</div>
            <h3>Learn by building, not by watching</h3>
            <p>Project-based learning with real codebases, mentor feedback, and finished portfolio pieces. Pick a stack, ship a project.</p>
          </div>
          <button class="btn" onclick="alert('liveProject — mock')">Explore liveProjects →</button>
        </div>
      </div>
    </section>

    <!-- BESTSELLERS -->
    <section class="block" style="padding:32px 0">
      <div class="container">
        <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:6px">
          <h2>Bestsellers</h2>
          <a href="#" onclick="goTopic('all');return false" style="color:var(--accent);font-weight:600;font-size:13px">See all bestsellers →</a>
        </div>
        <p class="sub">What developers are reading right now</p>
        <div class="carousel">
          <button class="carousel-nav left" onclick="scrollCarousel(this,-1)">‹</button>
          <button class="carousel-nav right" onclick="scrollCarousel(this,1)">›</button>
          <div class="carousel-track">
            ${bestsellers.map(b=>bookCardHTML(b)).join('')}
          </div>
        </div>
      </div>
    </section>

    <!-- AUTHOR SPOTLIGHT -->
    <section class="block" style="padding:32px 0">
      <div class="container">
        <div class="author-spot">
          <div style="text-align:center">
            <div class="avatar">${initials(featuredAuthor.name)}</div>
          </div>
          <div>
            <div class="eyebrow">Author spotlight</div>
            <h3>${featuredAuthor.name}</h3>
            <p class="bio">${featuredAuthor.bio}. ${featuredAuthorBooks.length} books published with Manning, including beginner-friendly introductions and project-based guides used by thousands of developers worldwide.</p>
            <div class="their-books">
              ${featuredAuthorBooks.map(b=>`<a onclick="goBook('${b.id}')" style="cursor:pointer">${escapeHtml(b.title)} →</a>`).join('')}
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- NEWSLETTER -->
    <section class="block" style="padding:32px 0 60px;border:0">
      <div class="container">
        <div class="newsletter">
          <h3>Stay current with Manning</h3>
          <p>Get the latest book releases, free chapters, and developer-focused deals in your inbox.</p>
          <form class="nl-form" onsubmit="event.preventDefault();alert('Mock — newsletter signup')">
            <input type="email" placeholder="you@example.com" required />
            <button type="submit">Subscribe</button>
          </form>
        </div>
      </div>
    </section>
  `;
}

function scrollCarousel(btn, dir){
  const track = btn.parentElement.querySelector('.carousel-track');
  track.scrollBy({ left: dir * 400, behavior:'smooth' });
}

function bookCardHTML(b){
  return `<div class="bookcard" onclick="goBook('${b.id}')">
    <div class="cover ${coverFor(b)}">${b.title}</div>
    <div class="bt">${b.title}</div>
    <div class="ba">${bookAuthors(b)}</div>
    <div class="bp">$${b.price.toFixed(2)}</div>
  </div>`;
}

/* ----- SRP — modal-style layout ----- */
let srpState = { q:'', formats:new Set(), levels:new Set(), topics:new Set(), priceMin:'', priceMax:'' };

function resetSrpState(q){
  srpState = { q, formats:new Set(), levels:new Set(), topics:new Set(), priceMin:'', priceMax:'' };
}

function applyFilters(allBooks, allVideos, override){
  // override allows computing "what if this group were empty" for counts
  const s = override || srpState;
  let books = allBooks;
  let videos = allVideos;

  // FORMAT — controls which result types survive
  if(s.formats.size > 0){
    if(!s.formats.has('Books')) books = [];
    if(!s.formats.has('Videos') && !s.formats.has('Projects')) videos = [];
    else if(!s.formats.has('Videos')) videos = videos.filter(v => v.kind === 'liveProject');
    else if(!s.formats.has('Projects')) videos = videos.filter(v => v.kind !== 'liveProject');
  }

  // LEVEL — books only
  if(s.levels.size > 0){
    books = books.filter(b => s.levels.has(b.level));
  }

  // TOPIC — books + videos
  if(s.topics.size > 0){
    books  = books .filter(b => b.topicIds.some(t => s.topics.has(t)));
    videos = videos.filter(v => v.topicIds.some(t => s.topics.has(t)));
  }

  // PRICE — books only (videos have no price in our mock)
  const min = parseFloat(s.priceMin);
  const max = parseFloat(s.priceMax);
  if(!isNaN(min)) books = books.filter(b => b.price >= min);
  if(!isNaN(max)) books = books.filter(b => b.price <= max);

  return { books, videos };
}

function toggleFilter(group, value){
  const set = srpState[group];
  if(set.has(value)) set.delete(value);
  else set.add(value);
  renderSRP(srpState.q);
}
function setSrpPrice(which, value){
  srpState[which === 'min' ? 'priceMin' : 'priceMax'] = (value||'').trim();
  renderSRP(srpState.q);
}
function clearAllFilters(){
  srpState.formats.clear(); srpState.levels.clear(); srpState.topics.clear();
  srpState.priceMin = ''; srpState.priceMax = '';
  renderSRP(srpState.q);
}

function renderSRP(q){
  const res = searchAll(q);
  const allBooks = res.books;
  const allVideos = VIDEOS
    .map(v => ({ item:v, s: scoreVideo(v, q) }))
    .filter(x => x.s > 0)
    .sort((a,b) => b.s - a.s)
    .map(x => x.item);

  // Reset filter state when query changes
  if(srpState.q !== q) resetSrpState(q);

  // Apply current filters
  const filtered = applyFilters(allBooks, allVideos);
  const books = filtered.books;
  const videos = filtered.videos;

  if(books.length === 0 && videos.length === 0){
    const hasActiveFilters = srpState.formats.size + srpState.levels.size + srpState.topics.size > 0
      || srpState.priceMin || srpState.priceMax;
    main.innerHTML = `<div class="srp-modal">
      ${srpHeader(q, {books:0, videos:0, totalBooks:allBooks.length, totalVideos:allVideos.length})}
      <!-- Empty SRP -->
      <style>.srp-empty{padding:60px 20px;text-align:center;font-family:-apple-system,sans-serif}.srp-empty .big{font-family:var(--font-serif);font-size:20px;font-weight:700;margin-bottom:8px;color:var(--ink)}</style>
      ${srpRecentStrip(q)}
      ${activeFilterChipsHTML()}
      <div class="srp-grid">
        ${srpFiltersHTML(allBooks, allVideos)}
        <div style="grid-column: 2 / -1">
          <div class="srp-empty">
            <div class="big">${hasActiveFilters ? 'No results with the selected filters' : `No results for "${escapeHtml(q)}"`}</div>
            <div>${hasActiveFilters ? 'Try removing some filters.' : 'Try a different spelling or browse topics from the homepage.'}</div>
            ${hasActiveFilters ? '<button onclick="clearAllFilters()" style="margin-top:16px;background:transparent;border:1.5px solid var(--accent);color:var(--accent);padding:8px 18px;border-radius:4px;cursor:pointer;font-family:-apple-system,sans-serif;font-size:13px;font-weight:600">Clear all filters</button>' : ''}
          </div>
        </div>
      </div>
    </div>`;
    return;
  }

  main.innerHTML = `<div class="srp-modal">
    ${srpHeader(q, { books: books.length, videos: videos.length, totalBooks: allBooks.length, totalVideos: allVideos.length })}
    ${srpRecentStrip(q)}
    ${activeFilterChipsHTML()}
    <div class="srp-grid">
      ${srpFiltersHTML(allBooks, allVideos)}
      <div class="srp-col-books">
        <div class="srp-col-head">books <span style="color:var(--muted);font-style:normal;font-family:-apple-system,sans-serif;font-size:13px">· ${books.length}</span></div>
        ${books.length ? books.map(b => bookResultHTML(b, q)).join('') : `
          <div style="color:#888;font-style:italic;padding:20px 0">No books match the current criteria</div>`}
      </div>
      <div class="srp-col-videos">
        <div class="srp-col-head">videos and projects <span style="color:var(--muted);font-style:normal;font-family:-apple-system,sans-serif;font-size:13px">· ${videos.length}</span></div>
        ${videos.length ? videos.map(v => videoResultHTML(v, q)).join('') : `
          <div style="color:#888;font-style:italic;padding:20px 0">No matching videos or liveProjects</div>`}
      </div>
    </div>
  </div>`;
}

function srpFiltersHTML(allBooks, allVideos){
  // "What-if" counts: for each facet, compute result count as if that group's
  // selection were empty (so user sees how many they'd get by toggling that option).
  const countsFor = (excludeGroup) => {
    const o = {
      formats: excludeGroup==='formats' ? new Set() : srpState.formats,
      levels:  excludeGroup==='levels'  ? new Set() : srpState.levels,
      topics:  excludeGroup==='topics'  ? new Set() : srpState.topics,
      priceMin: excludeGroup==='price' ? '' : srpState.priceMin,
      priceMax: excludeGroup==='price' ? '' : srpState.priceMax,
    };
    return applyFilters(allBooks, allVideos, o);
  };

  const fmtBase   = countsFor('formats');
  const lvlBase   = countsFor('levels');
  const topicBase = countsFor('topics');

  // FORMAT
  const projectCount = fmtBase.videos.filter(v => v.kind === 'liveProject').length;
  const videoCount   = fmtBase.videos.length - projectCount;
  const formats = [
    { key:'Books',    count: fmtBase.books.length },
    { key:'Videos',   count: videoCount },
    { key:'Projects', count: projectCount },
  ];

  // LEVEL
  const levelMap = { Beginner:'Beginner', Intermediate:'Intermediate', Advanced:'Advanced' };
  const levelOrder = ['Beginner','Intermediate','Advanced'];
  const lvlCounts = countBy(lvlBase.books, b => b.level);
  const levels = levelOrder.map(l => ({
    key: l, label: levelMap[l], count: lvlCounts[l] || 0,
  }));

  // TEMA
  const tc = {};
  topicBase.books.forEach(b => b.topicIds.forEach(tid => { tc[tid] = (tc[tid]||0)+1 }));
  topicBase.videos.forEach(v => v.topicIds.forEach(tid => { tc[tid] = (tc[tid]||0)+1 }));
  const topics = Object.entries(tc).map(([id,c]) => {
    const t = TOPICS.find(x=>x.id===id);
    return t ? { key:id, label:t.name, count:c } : null;
  }).filter(Boolean).sort((a,b)=>b.count-a.count).slice(0,8);

  // Render helper
  const opt = (group, key, label, count) => {
    const on = srpState[group].has(key);
    const disabled = !on && count === 0;
    return `<label class="srp-filter${on?' on':''}${disabled?' disabled':''}" onclick="if(!this.classList.contains('disabled'))toggleFilter('${group}','${escapeAttr(key)}')">
      <span class="box">${on?'✓':''}</span>
      <span class="nm">${escapeHtml(label)}</span>
      <span class="cnt">${count}</span>
    </label>`;
  };

  return `<aside class="srp-filters">
    <div class="group">
      <h4>Format</h4>
      ${formats.map(t => opt('formats', t.key, t.key, t.count)).join('')}
    </div>

    <div class="group">
      <h4>Level</h4>
      ${levels.map(l => opt('levels', l.key, l.label, l.count)).join('')}
    </div>

    ${topics.length ? `
    <div class="group">
      <h4>Topic</h4>
      ${topics.map(t => opt('topics', t.key, t.label, t.count)).join('')}
    </div>` : ''}

    <div class="group">
      <h4>Price</h4>
      <div class="srp-price">
        <input type="number" placeholder="Min" min="0" value="${escapeAttr(srpState.priceMin)}"
          onchange="setSrpPrice('min', this.value)" />
        <span class="eur">$</span>
        <input type="number" placeholder="Max" min="0" value="${escapeAttr(srpState.priceMax)}"
          onchange="setSrpPrice('max', this.value)" />
        <span class="eur">$</span>
      </div>
    </div>
  </aside>`;
}

/* Active filter chips above results — quick way to see/remove what's applied */
function activeFilterChipsHTML(){
  const chips = [];
  srpState.formats.forEach(v => chips.push({ group:'formats', value:v, label:v }));
  srpState.levels.forEach(v => chips.push({ group:'levels', value:v, label:v }));
  srpState.topics.forEach(v => {
    const t = TOPICS.find(x=>x.id===v);
    chips.push({ group:'topics', value:v, label: t?.name || v });
  });
  if(srpState.priceMin || srpState.priceMax){
    chips.push({ group:'price', value:'price', label:`$${srpState.priceMin||'0'}–$${srpState.priceMax||'∞'}` });
  }
  if(!chips.length) return '';
  return `<div class="srp-active-chips">
    <span class="lbl">Active filters:</span>
    ${chips.map(c => `
      <span class="afchip" onclick="${c.group==='price'?'srpState.priceMin=\'\';srpState.priceMax=\'\';renderSRP(srpState.q)':`toggleFilter('${c.group}','${escapeAttr(c.value)}')`}">
        ${escapeHtml(c.label)} <span class="x">×</span>
      </span>`).join('')}
    <button class="afclear" onclick="clearAllFilters()">Clear all</button>
  </div>`;
}

function srpRecentStrip(currentQ){
  // Drop question-shaped queries — those belong to Ask AI, not search
  const list = loadRecent()
    .filter(x => x.toLowerCase() !== (currentQ||'').toLowerCase())
    .filter(x => !isAskAIIntent(x));
  if(!list.length) return '';
  return `<div class="srp-recent">
    <div class="srp-recent-inner">
      <span class="srp-recent-lbl">recent searches</span>
      <div class="srp-recent-chips">
        ${list.slice(0,8).map(q => `
          <span class="srp-rchip" data-srp-recent="${escapeAttr(q)}">
            <span class="clock">↻</span>
            <span>${escapeHtml(q)}</span>
            <span class="x" data-srp-remove="${escapeAttr(q)}" title="Remove">×</span>
          </span>`).join('')}
        <button class="srp-recent-clear" onclick="clearRecent();renderSRP(${JSON.stringify(currentQ||'')})">Clear all</button>
      </div>
    </div>
  </div>`;
}

function srpHeader(q, counts){
  // counts: { books, videos, totalBooks, totalVideos } — last two optional, used to show "filtered from N"
  let countLine = '';
  if(counts){
    const total = counts.books + counts.videos;
    const totalAll = (counts.totalBooks ?? counts.books) + (counts.totalVideos ?? counts.videos);
    const isFiltered = total !== totalAll;
    const bookWord = counts.books === 1 ? 'book' : 'books';
    const vidWord  = counts.videos === 1 ? 'video/project' : 'videos and projects';
    countLine = `<div class="srp-count">
      <b>${total}</b> ${total===1?'result':'results'} · ${counts.books} ${bookWord} · ${counts.videos} ${vidWord}
      ${isFiltered ? ` <span class="filtered">(filtered from ${totalAll})</span>` : ''}
    </div>`;
  }
  return `<div class="srp-modal-header">
    <button class="srp-filter-btn" onclick="alert('Filters — coming soon')" title="Filter">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M3 4h18l-7 9v6l-4 2v-8L3 4z"/>
      </svg>
    </button>
    <div>
      <div class="srp-title">results for <em>'${escapeHtml(q)}'</em></div>
      ${countLine}
    </div>
    <button class="srp-close-btn" onclick="goHome()" title="Close">×</button>
  </div>`;
}

function bookResultHTML(b, q){
  const date = `${monthOf(b)} ${b.year}`;
  const hasVideo = VIDEOS.some(v => v.topicIds.some(t => b.topicIds.includes(t)));
  return `<div class="br">
    <div class="cv ${coverFor(b)}" onclick="goBook('${b.id}')">${escapeHtml(b.title)}</div>
    <div>
      <div class="br-title" onclick="goBook('${b.id}')">${highlight(escapeHtml(b.title), q)}</div>
      <div class="br-meta">
        <span>${date}</span>
        <span>${bookAuthors(b)}</span>
        ${hasVideo ? '<span class="vbadge" title="Has video">▶</span>' : ''}
      </div>
      <div class="br-desc">${highlight(escapeHtml(b.desc), q)}</div>
      <div class="br-see" onclick="goBook('${b.id}')">see inside</div>
    </div>
  </div>`;
}

function videoResultHTML(v, q){
  return `<div class="vr">
    <div class="vthumb ${v.cover||''}" onclick="alert('Video stub: ${escapeAttr(v.title)}')">${escapeHtml(v.instructor)}</div>
    <div>
      <div class="vr-title" onclick="alert('Video stub: ${escapeAttr(v.title)}')">${highlight(escapeHtml(v.title), q)}</div>
      <div class="vr-desc">${highlight(escapeHtml(v.desc), q)}</div>
      <div class="vr-date">${v.date}</div>
    </div>
  </div>`;
}

function monthOf(b){
  // pseudo-stable month based on id hash, just for display flavor
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  let h = 0; for(const c of b.id) h = (h*31 + c.charCodeAt(0)) % 12;
  return months[h];
}

function buildLearningPath(res){
  // pick beginner-first sequence
  const candidates = [...res.books].sort((a,b)=>{
    const order = {Beginner:0,Intermediate:1,Advanced:2};
    return (order[a.level]??1) - (order[b.level]??1);
  });
  const steps = candidates.slice(0,4);
  if(steps.length < 2) return '';
  const topic = res.topics[0]?.name || 'this topic';
  return `<div class="lpath">
    <span class="ltag">Auto-suggested path</span>
    <div class="lh">${topic} — ${steps.length}-step learning path</div>
    <div class="lm">~${steps.length*30} hours · Beginner → Advanced</div>
    <div class="steps">
      ${steps.map((b,i)=>`<div class="step">
        <div class="n">Step ${i+1}</div>
        <div class="st">${escapeHtml(b.title)}</div>
        <div class="sa">${bookAuthors(b)} · ${b.level}</div>
      </div>`).join('')}
    </div>
  </div>`;
}

function renderEmpty(q){
  // Suggest closest topic / book by token overlap
  const sug = TOPICS.slice(0,4);
  return `<div class="empty">
    <div class="big">No matches for "${escapeHtml(q)}"</div>
    <div class="sub">Try a different spelling, or explore one of these topics:</div>
    <div class="chips">
      ${sug.map(t=>`<span class="chip" onclick="setQuery('${t.name}')">${t.name}</span>`).join('')}
    </div>
    <button class="pill" style="border:1.5px solid var(--accent);color:var(--accent);background:#fff;padding:10px 18px;border-radius:4px;cursor:pointer" onclick="goAskAI('${escapeAttr(q)}')">💬 Ask AI about "${escapeHtml(q)}"</button>
  </div>`;
}

/* ----- Book detail page ----- */
function renderBook(id){
  const b = BOOKS.find(x=>x.id===id); if(!b) return goHome();
  const authorList = b.authorIds.map(aid => AUTHORS.find(x=>x.id===aid)).filter(Boolean);
  const isMEAP = b.year >= 2024;
  const topicChain = b.topicIds.map(tid => TOPICS.find(x=>x.id===tid)).filter(Boolean);

  // related: same topic, exclude self
  const related = BOOKS.filter(x => x.id !== b.id && x.topicIds.some(t => b.topicIds.includes(t))).slice(0,5);
  const ymal = related.slice(0,3);

  // ToC — fake but deterministic, 3 parts + appendix
  const partsByTopic = {
    python:    ['Foundations',     'Data structures',     'Real-world projects'],
    pyds:      ['Tooling',          'Working with data',   'Modeling & analysis'],
    js:        ['Language essentials','Async & modules',   'Building apps'],
    react:     ['Components',      'State management',    'Production patterns'],
    node:      ['HTTP & I/O',      'Architecture',        'Operations'],
    go:        ['Syntax & types',  'Concurrency',         'Standard library'],
    rust:      ['Ownership',       'Lifetimes & traits',  'Concurrency'],
    ml:        ['Theory',          'Algorithms',          'Production ML'],
    dl:        ['Neural networks', 'Training',            'Applications'],
    ai:        ['LLM foundations', 'Prompting & RAG',     'Building agents'],
    k8s:       ['Containers',      'Workloads',           'Cluster operations'],
    devops:    ['Pipelines',       'Observability',       'Reliability'],
    sec:       ['Threats',         'Defenses',            'Incident response'],
    data:      ['Storage',         'Pipelines',           'Modeling'],
    django:    ['Models & views',  'Forms & auth',        'Deployment'],
  };
  const parts = (partsByTopic[b.topicIds[0]] || ['Foundations','Core concepts','Practice']);
  const totalCh = 12;
  const availableCh = isMEAP ? Math.min(10, Math.max(3, b.pages > 500 ? 8 : 6)) : totalCh;

  let chIdx = 0;
  const partsHTML = parts.map((pname, pi) => {
    const chaptersInPart = pi === parts.length - 1 ? totalCh - chIdx - 1 : Math.ceil(totalCh / parts.length);
    const items = [];
    for(let i = 0; i < chaptersInPart; i++){
      chIdx++;
      const unlocked = chIdx <= availableCh;
      items.push(`<div class="chapter${unlocked?'':' locked'}">
        <span class="check${unlocked?' on':''}">${unlocked?'✓':''}</span>
        <a>${chIdx}. ${randomChapterName(b, chIdx)}</a>
      </div>`);
    }
    return `<div class="part">
      <div class="part-name">Part ${pi+1}: ${pname.toUpperCase()}</div>
      ${items.join('')}
    </div>`;
  }).join('');

  const appendixHTML = `<div class="part">
    <div class="part-name">Appendix</div>
    <div class="chapter${availableCh > totalCh-2?' ':' locked'}">
      <span class="check${availableCh > totalCh-2?' on':''}">${availableCh > totalCh-2?'✓':''}</span>
      <a>A. References and further reading</a>
    </div>
  </div>`;

  main.innerHTML = `
    <div class="bp-sub-nav">
      <div class="container">
        <a class="active">catalog</a>
        <a>MEAP</a><a>liveBook</a><a>liveVideo</a><a>liveProject</a><a>liveAudio</a>
        <a>free content</a><a>register pBook</a><a>subscription</a><a>sponsorships</a>
      </div>
    </div>

    <div class="bp-dotd">
      <div class="container"><b>Deal of the Day!</b> &nbsp; <em>${escapeHtml(b.title)}—Save 50% TODAY ONLY!</em></div>
    </div>

    <div class="container bp-wrap">
      <!-- LEFT RAIL -->
      <aside class="bp-rail">
        <div class="cover-wrap">
          <div class="cover ${coverFor(b)}" style="position:relative">
            ${escapeHtml(b.title)}
            ${isMEAP ? '<span style="position:absolute;bottom:8px;right:8px;background:#c0392b;color:#fff;padding:2px 6px;font-size:9px;font-weight:800;letter-spacing:1px;border-radius:2px">MEAP</span>' : ''}
          </div>
          <span class="look-inside">▦ look inside</span>
        </div>

        ${isMEAP ? `
        <div class="meap-box">
          <h5>Manning Early Access Program (MEAP)</h5>
          Read chapters as they are written, get the finished eBook as soon as it's ready, and receive the pBook long before it's in bookstores.
          <div class="meap-progress">
            <div class="lbl">${availableCh} of ${totalCh} chapters available</div>
            <div class="bar">
              ${Array.from({length:totalCh}, (_,i) => `<div class="seg${i < availableCh?' on':''}"></div>`).join('')}
            </div>
          </div>
        </div>` : ''}

        <div class="res-block">
          <h5>resources</h5>
          <a>📖 book forum</a>
          <a>⎇ source code on github</a>
        </div>

        ${ymal.length ? `
        <div class="ymal">
          <h5>you might also like</h5>
          ${ymal.map(yb => `
            <div class="ym-row" onclick="goBook('${yb.id}')">
              <div class="mini-cover ${coverFor(yb)}"></div>
              <div class="ym-meta">
                <div class="h">${escapeHtml(yb.title)}</div>
                <div class="m">${escapeHtml(yb.desc.slice(0, 70))}…</div>
              </div>
            </div>`).join('')}
        </div>` : ''}

        <div class="reviewer">
          <h5>Become a reviewer</h5>
          <p>Help us create the best book possible</p>
          <button class="btn">apply now</button>
        </div>
      </aside>

      <!-- MAIN COLUMN -->
      <div class="bp-main">
        <div class="bp-title-row">
          <h1>${escapeHtml(b.title)}</h1>
          <button class="bp-fav" title="Save to wishlist">♡</button>
        </div>
        <div class="bp-subtitle">${escapeHtml(b.desc.split('.')[0])}</div>

        <div class="bp-author-line">${authorList.length ? authorList.map(a=>`<span onclick="goAuthor('${a.id}')">${escapeHtml(a.name)}</span>`).join(' · ') : 'Manning'}</div>

        <div class="bp-rating">
          <span class="stars">★★★★☆</span>
          <span>4 reviews</span>
        </div>

        <div class="bp-meta">
          ${isMEAP ? `<b>MEAP began</b> January ${b.year} · <b>Last updated</b> May ${b.year+1} · <b>Publication in</b> Fall ${b.year+1} (estimated)<br>` : `<b>Published</b> ${monthOf(b)} ${b.year}<br>`}
          <b>ISBN</b> 9781633${(b.id.length*100000).toString().slice(0,6)} · ${b.pages} pages (estimated)<br>
          Included with a Manning subscription<br>
          printed in black & white<br>
          <span style="color:#0f6e5b">available in:</span> English · Italian
        </div>

        <div class="bp-breadcrumb">
          <a onclick="goTopic('all')">catalog</a>
          ${topicChain.map(t => ` / <a onclick="goTopic('${t.id}')">${escapeHtml(t.name)}</a>`).join('')}
        </div>

        <div class="bp-format-row">
          <div class="tab active">
            <div class="name">eBook</div>
            <div class="sub">pdf, ePub, online</div>
          </div>
          <div class="tab">
            <div class="name">print</div>
            <div class="sub">includes eBook</div>
          </div>
          <div class="tab">
            <div class="name">with subscription</div>
            <div class="sub">free or 50% off</div>
          </div>
          <div class="price-card">
            <span class="lbl">eBook</span>
            <span class="price">$${b.price.toFixed(2)}</span>
            <span class="disc">you save $${(b.price*0.3).toFixed(2)} (21%)</span>
            <button class="add" onclick="alert('Mock: added to cart')">add to cart</button>
            <span class="free-sub">free with subscription →</span>
          </div>
        </div>

        <div class="bp-body">
          <div>
            <p><b>${escapeHtml(b.desc)}</b></p>

            <p>${escapeHtml(b.title)} takes a practical, project-driven approach to ${topicChain[0]?.name || 'the subject'}. Working through real-world examples, you'll learn the techniques and tools that professional developers use every day to build production systems.</p>

            <h3>about the book</h3>
            <p>This ${b.level.toLowerCase()}-level guide teaches you everything you need to succeed with ${topicChain[0]?.name || 'modern development'}. ${escapeHtml(b.desc)}</p>

            <h3>what's inside</h3>
            <div class="bp-learn">
              <ul>
                <li>Foundational concepts in ${topicChain[0]?.name || 'the topic'}</li>
                <li>Building production-quality applications step by step</li>
                <li>Patterns and anti-patterns from real-world projects</li>
                <li>Tooling, testing, and deployment best practices</li>
                <li>Performance and scaling considerations</li>
              </ul>
            </div>

            <h3>about the reader</h3>
            <p>For developers comfortable with the basics. ${b.level === 'Beginner' ? 'No prior experience required — just curiosity.' : b.level === 'Advanced' ? 'Assumes solid working knowledge of the language and ecosystem.' : 'Some programming experience helpful, but not required.'}</p>

            <h3>about the author</h3>
            ${authorList.map(a => `<p><b>${escapeHtml(a.name)}</b> ${escapeHtml(a.bio)}. ${a.bookIds.length} ${a.bookIds.length===1?'book':'books'} published with Manning.</p>`).join('')}
          </div>

          <div class="bp-quotes">
            <div class="quote">
              "Specific and useful information about implementing the ideas from this book — exactly the practical examples I needed."
              <span class="who">— Senior Engineer, Fortune 500</span>
            </div>
            <div class="quote">
              "Clear, comprehensive, and easy to follow. The examples define complex concepts beautifully."
              <span class="who">— Tech Lead</span>
            </div>
            <div class="quote">
              "I really like how this book frames the problem-solving approach."
              <span class="who">— Engineering Manager</span>
            </div>
          </div>
        </div>

        <div class="bp-toc">
          <h3>table of contents</h3>
          <div class="toc-link">detailed TOC ▾</div>
          ${partsHTML}
          ${appendixHTML}
        </div>

        <div class="bp-reviews-block">
          <div class="big-score">
            <div class="num">${(4.6 + (chIdx % 4) * 0.1).toFixed(1)}</div>
            <div class="of">out of 5.0</div>
          </div>
          <div>
            <div class="cust-h">customer reviews</div>
            <div class="big-stars">★★★★★</div>
          </div>
          <div class="pct">
            100%
            <small>of customers that buy this product give it a 4 or 5-star rating</small>
          </div>
        </div>

        <div class="bp-cust-reviews">
          ${[
            {date:'March 4, 2026', who:'Manning C.', stars:5, verified:true, ttl:'Excellent', txt:'A foundational guide that delivers on its promise. Hands-on examples and clear explanations throughout.'},
            {date:'February 12, 2026', who:'GRIGORIOS D.', stars:5, verified:true, ttl:'Great buy', txt:'It is good to have books covering intriguing aspects of software design.'},
            {date:'January 28, 2026', who:'Pablo I.', stars:5, verified:true, ttl:'Great value', txt:'The book gives a fresh point of view about software development.'},
          ].map(r => `<div class="rev">
            <div class="row1"><span><span class="stars">${'★'.repeat(r.stars)}${'☆'.repeat(5-r.stars)}</span> &nbsp; ${r.date}</span><span class="verified">✓ Verified buyer</span></div>
            <div class="ttl">${r.ttl}</div>
            <div class="txt">"${r.txt}" — ${r.who}</div>
          </div>`).join('')}
        </div>

        ${related.length ? `
        <div class="bp-related">
          <h3>Related books</h3>
          <div class="grid books" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr))">
            ${related.map(r => bookCardHTML(r)).join('')}
          </div>
        </div>` : ''}
      </div>
    </div>
  `;
}

/* ----- Ask AI page ----- */
function buildAiMessage(q){
  const res = searchAll(q);
  const qn = norm(q);
  const ctxTopic = TOPICS.find(t => qn.includes(norm(t.name)));
  const ctxAuthor = AUTHORS.find(a => qn.includes(norm(a.name)));

  let intent, body;
  if(/^tko\s+je|who\s+is\b/.test(qn) && ctxAuthor){
    intent = 'author-bio'; body = answerAuthorBio(ctxAuthor);
  }
  else if(/preporu[čc]i|recommend/.test(qn) && /po[čc]etn|beginner|nov[ai]/.test(qn)){
    intent = 'beginner-recs'; body = answerLevelRecs(q, ctxTopic, res, 'Beginner', 'početnike');
  }
  else if(/(najbolja|preporu[čc]i|recommend|best)/.test(qn) && /(napredn|advanced|senior)/.test(qn)){
    intent = 'advanced-recs'; body = answerLevelRecs(q, ctxTopic, res, 'Advanced', 'napredne developere');
  }
  else if(/(što|sto)\s+je\s+novo|what.?s\s+new|new\s+in|nov[ao]\s+u/.test(qn)){
    intent = 'whats-new'; body = answerWhatsNew(q, ctxTopic, res);
  }
  else if(/koliko\s+vremena|how\s+long|time|trajanj/.test(qn)){
    intent = 'time-estimate'; body = answerTimeEstimate(q, ctxTopic, res);
  }
  else if(/learning\s+path|put\s+u[čc]enja|redoslijed|sequence|where\s+to\s+start/.test(qn)){
    intent = 'learning-path'; body = answerLearningPath(q, ctxTopic, res);
  }
  else if(/(što|sto)\s+(čitati|citati)\s+nakon|after.*first|what\s+next|next\s+book/.test(qn)){
    intent = 'next-book'; body = answerNextBook(q, ctxTopic, res);
  }
  else if(/popularnij|popular|industry|industrij|trend/.test(qn)){
    intent = 'popularity'; body = answerPopularity(q, ctxTopic, res);
  }
  else if(/(vs|or|ili|versus|usporedi|razlika)/.test(qn)){
    intent = 'compare'; body = answerCompare(q, res);
  }
  else if(/^(što|sto|what|koji|koja|koje)\s+je\b/.test(qn)){
    intent = 'definition'; body = answerDefinition(q, ctxTopic, res);
  }
  else if(/kako\s+(naučiti|nauciti|nau[čc]iti|po[čc]eti|learn)|how\s+to\s+learn|getting\s+started/.test(qn)){
    intent = 'how-to-learn'; body = answerHowToLearn(q, ctxTopic, res);
  }
  else {
    intent = 'generic'; body = answerGeneric(q, ctxTopic, res);
  }

  const topicName = ctxTopic?.name || res.topics[0]?.name || res.books[0]?.topicIds?.map(t=>TOPICS.find(x=>x.id===t)?.name)[0] || '';
  const followups = buildFollowups(intent, topicName, res, ctxAuthor);
  return { q, body, followups, intent };
}

function renderAskAI(q){
  // Seed thread on cold load (e.g. direct URL hit or back-button)
  if(!aiThread.length || aiThread[aiThread.length-1].q !== q){
    aiThread = [buildAiMessage(q)];
  }

  const messagesHTML = aiThread.map((m, idx) => {
    const isLast = idx === aiThread.length - 1;
    return `
      <div class="ai-msg user">
        <div class="bubble">${escapeHtml(m.q)}</div>
      </div>
      <div class="ai-msg bot">
        <div class="avatar-ai">✦</div>
        <div class="body">
          ${m.body}
          ${isLast ? `<p style="color:var(--muted);font-size:12.5px;margin-top:18px;font-style:italic">
            This is a mock response — in production it would be generated by an LLM using the Manning catalog as context.
          </p>` : ''}
          ${isLast && m.followups.length ? `
          <div class="ai-followups">
            <div class="lbl">Suggested questions</div>
            ${m.followups.map(f => `
              <div class="fq" onclick="goAskAI('${escapeAttr(f)}', true)">
                <span>${escapeHtml(f)}</span>
                <span class="ar">→</span>
              </div>`).join('')}
          </div>` : ''}
        </div>
      </div>`;
  }).join('');

  main.innerHTML = `
    <div class="ai-modal">
      <div class="ai-header">
        <button class="back" onclick="history.back()" title="Back">←</button>
        <div class="title"><span class="sparkle">✦</span> Manning AI Assistant ${aiThread.length > 1 ? `· <span style="color:var(--muted);font-weight:400">${aiThread.length} questions</span>` : ''}</div>
        <button class="close" onclick="resetAiThread();goHome()" title="Close">×</button>
      </div>

      <div class="ai-thread">
        ${messagesHTML}
      </div>

      <div class="ai-composer">
        <form class="ai-composer-inner" onsubmit="event.preventDefault();const v=this.querySelector('input').value.trim();if(v)goAskAI(v, true)">
          <input type="text" placeholder="Ask another question…" autofocus />
          <button type="submit" class="send" title="Send">↑</button>
        </form>
        <div class="ai-disclaimer">AI responses may contain errors. Verify important information.</div>
      </div>
    </div>
  `;

  // Auto-scroll to the latest message
  requestAnimationFrame(() => {
    const lastMsg = main.querySelector('.ai-thread .ai-msg:last-of-type');
    if(lastMsg) lastMsg.scrollIntoView({behavior: aiThread.length > 1 ? 'smooth' : 'auto', block: 'start'});
  });
}

function resetAiThread(){ aiThread = [] }

/* ----- Helpers: render UI blocks ----- */
function aiRecsBlock(books, heading){
  if(!books.length) return '';
  return `${heading ? `<h4>${heading}</h4>` : ''}
    <div class="ai-recs">
      ${books.map(b => `
        <div class="ai-rec" onclick="goBook('${b.id}')">
          <div class="ai-cv ${coverFor(b)}"></div>
          <div class="ai-meta">
            <div class="ai-h">${escapeHtml(b.title)}</div>
            <div class="ai-m">${bookAuthors(b)} · ${b.level} · ${b.year}</div>
          </div>
        </div>`).join('')}
    </div>`;
}
function aiTopicChips(topics, label){
  if(!topics.length) return '';
  return `<h4>${label}</h4>
    <div class="ai-chips">
      ${topics.map(t => `<span class="chip" onclick="goTopic('${t.id}')"># ${escapeHtml(t.name)}</span>`).join('')}
    </div>`;
}
function aiAuthorChips(authors, label){
  if(!authors.length) return '';
  return `<h4>${label}</h4>
    <div class="ai-chips">
      ${authors.map(a => `<span class="chip" onclick="goAuthor('${a.id}')">👤 ${escapeHtml(a.name)}</span>`).join('')}
    </div>`;
}
function aiBookLink(b){
  return `<a onclick="goBook('${b.id}')" style="color:#1f6fc7;cursor:pointer;font-weight:600">${escapeHtml(b.title)}</a>`;
}

/* ----- Intent-specific answers ----- */
function answerAuthorBio(a){
  const books = a.bookIds.map(id => BOOKS.find(b=>b.id===id)).filter(Boolean);
  const topicIds = [...new Set(books.flatMap(b=>b.topicIds))];
  const topics = topicIds.map(t=>TOPICS.find(x=>x.id===t)).filter(Boolean);
  return `
    <p><b>${escapeHtml(a.name)}</b> is ${escapeHtml(a.bio)}. They've authored ${books.length} ${books.length===1?'book':'books'} published by Manning.</p>
    ${books.length ? `<p>Their books primarily cover ${topics.map(t=>t.name).slice(0,3).join(', ')} and are known for a practical, project-driven approach.</p>` : ''}
    ${aiRecsBlock(books.slice(0,4), `Books by ${escapeHtml(a.name)}`)}
    <p>View the <a onclick="goAuthor('${a.id}')" style="color:#1f6fc7;cursor:pointer">full author page →</a></p>`;
}

function answerLevelRecs(q, ctxTopic, res, level, levelLabel){
  let books = res.books.filter(b => b.level === level);
  if(books.length === 0){
    books = BOOKS.filter(b => b.level === level);
    if(ctxTopic) books = books.filter(b => b.topicIds.includes(ctxTopic.id));
  }
  books = books.slice(0,4);
  const scope = ctxTopic ? ` for ${escapeHtml(ctxTopic.name)}` : '';
  return `
    <p>Here are the best books for ${levelLabel}${scope}. I filtered by <b>${level}</b> level and sorted by relevance and recency.</p>
    ${books.length ? aiRecsBlock(books) : `<p>I don't have enough ${level}-level recommendations for this topic. Try <a onclick="goTopic('all')" style="color:#1f6fc7;cursor:pointer">browsing all topics</a>.</p>`}
    ${books[0] ? `<p>If you're not sure where to start, go with ${aiBookLink(books[0])} — ${books[0].pages} pages, ${books[0].year}, ${bookAuthors(books[0]) !== '—' ? `by ${bookAuthors(books[0])}` : 'a great intro'}.</p>` : ''}`;
}

function answerWhatsNew(q, ctxTopic, res){
  let books = (ctxTopic ? BOOKS.filter(b=>b.topicIds.includes(ctxTopic.id)) : res.books.length ? res.books : BOOKS)
    .filter(b => b.year >= 2023)
    .sort((a,b)=>b.year - a.year).slice(0,4);
  const scope = ctxTopic ? `for <b>${escapeHtml(ctxTopic.name)}</b>` : 'from the Manning catalog';
  return `
    <p>Here are the latest releases ${scope}, sorted by year (newest first):</p>
    ${aiRecsBlock(books)}
    ${books[0] ? `<p>${aiBookLink(books[0])} is the freshest — published ${books[0].year}. ${books[0].year >= 2024 ? 'Still in <b>MEAP</b> (you can read chapters as they\'re written).' : ''}</p>` : ''}`;
}

function answerTimeEstimate(q, ctxTopic, res){
  const t = ctxTopic?.name || res.topics[0]?.name || 'the topic';
  const startBook = res.books.find(b=>b.level==='Beginner') || res.books[0];
  return `
    <p>A realistic timeline for ${escapeHtml(t)} depends on your experience and how much time per week you can invest. Here's a rough estimate:</p>
    <ul>
      <li><b>Basics (2–4 weeks)</b> — first beginner book + simple projects, ~6h/week</li>
      <li><b>Comfortable level (2–3 months)</b> — more books, your own project, some open-source involvement</li>
      <li><b>Job-ready (6–12 months)</b> — production experience, advanced books, code reviews</li>
    </ul>
    ${startBook ? `<p>For a fast start I recommend ${aiBookLink(startBook)} — ${startBook.pages} pages, realistically 3–4 weeks at ~30 pages/day.</p>` : ''}`;
}

function answerLearningPath(q, ctxTopic, res){
  const t = ctxTopic || res.topics[0];
  if(!t) return answerGeneric(q, ctxTopic, res);
  const books = BOOKS.filter(b => b.topicIds.includes(t.id))
    .sort((a,b) => { const o={Beginner:0,Intermediate:1,Advanced:2}; return (o[a.level]||1)-(o[b.level]||1) })
    .slice(0,4);
  return `
    <p>Here's a suggested learning sequence for <b>${escapeHtml(t.name)}</b> — from foundations to advanced. Each book builds on the previous one.</p>
    ${books.map((b,i) => `
      <div style="display:flex;gap:14px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line)">
        <div style="background:var(--accent);color:#fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0">${i+1}</div>
        <div class="ai-cv ${coverFor(b)}" style="width:36px;height:48px;border-radius:2px;flex-shrink:0"></div>
        <div style="flex:1">
          <div style="font-weight:600;color:#1f6fc7;cursor:pointer" onclick="goBook('${b.id}')">${escapeHtml(b.title)}</div>
          <div style="color:var(--muted);font-size:12px">${b.level} · ${bookAuthors(b)} · ${b.pages} pp</div>
        </div>
      </div>`).join('')}
    <p style="margin-top:14px">Realistic pace: ~1 book per month with steady practice. Total ~${books.length} months to a solid level.</p>`;
}

function answerNextBook(q, ctxTopic, res){
  const t = ctxTopic || res.topics[0];
  const intermediate = (t ? BOOKS.filter(b=>b.topicIds.includes(t.id)) : BOOKS)
    .filter(b=>b.level==='Intermediate' || b.level==='Advanced').slice(0,3);
  return `
    <p>After your first introductory book, it's time for something that builds concrete projects or deepens the theory. Suggestions:</p>
    ${aiRecsBlock(intermediate, 'Next step')}
    <p>A typical gap between the intro and follow-up is 1–2 months of practice. Try to build your own small project in between — that's how you confirm you really learned the material.</p>`;
}

function answerPopularity(q, ctxTopic, res){
  const pool = ctxTopic ? BOOKS.filter(b=>b.topicIds.includes(ctxTopic.id)) : res.books;
  const top = [...pool].sort((a,b)=>(b.year + b.price*0.1) - (a.year + a.price*0.1)).slice(0,4);
  return `
    <p>These are the titles the industry talks about most — a mix of recency, depth, and senior-developer recommendations:</p>
    ${aiRecsBlock(top)}
    <p>2024–2025 trends clearly favor AI/LLM material, ${ctxTopic ? escapeHtml(ctxTopic.name) : 'modern practice'} combined with production reliability and DevOps topics.</p>`;
}

function answerCompare(q, res){
  const top = res.books.slice(0,4);
  const tops = res.topics.slice(0,3);
  return `
    <p>A direct comparison depends on what matters more to you — speed of development, performance, ecosystem, available talent. Here are books that cover both sides:</p>
    ${aiRecsBlock(top)}
    ${aiTopicChips(tops, 'Related topics')}
    <p>Quick guide: if you're just starting out, pick the technology with the larger community (easier to find help). If a specific use-case is driving you, let that decide.</p>`;
}

function answerDefinition(q, ctxTopic, res){
  const t = ctxTopic || res.topics[0];
  const top = res.books.slice(0,3);
  return `
    ${t ? `<p><b>${escapeHtml(t.name)}</b> is ${escapeHtml(t.desc.toLowerCase())}. ${t.bookIds.length} books in the Manning catalog cover this topic from the basics to advanced level.</p>` : `<p>I'm not sure exactly what you're asking — can you clarify? In the meantime, here are the most relevant results:</p>`}
    ${aiRecsBlock(top, 'Books that explain this in depth')}
    ${t ? `<p>For the full picture, see the <a onclick="goTopic('${t.id}')" style="color:#1f6fc7;cursor:pointer">topic page →</a></p>` : ''}`;
}

function answerHowToLearn(q, ctxTopic, res){
  const t = ctxTopic || res.topics[0];
  const beginner = (t ? BOOKS.filter(b=>b.topicIds.includes(t.id)) : res.books).filter(b=>b.level==='Beginner').slice(0,3);
  return `
    <p>The fastest path to solid knowledge is <b>one hands-on book + your own project + open-source practice</b>. Follow this order:</p>
    <ol style="line-height:1.7;font-size:15px">
      <li>Read an intro book and type the examples as you go</li>
      <li>Build a small project of your own (3–7 days)</li>
      <li>Contribute to open source or help others on a forum</li>
      <li>Move to an intermediate book after ~1 month</li>
    </ol>
    ${aiRecsBlock(beginner, 'Beginner books')}`;
}

function answerGeneric(q, ctxTopic, res){
  const top = res.books.slice(0,4);
  const tops = res.topics.slice(0,4);
  const auts = res.authors.slice(0,3);
  if(top.length === 0 && tops.length === 0){
    return `<p>I don't have enough information to answer "${escapeHtml(q)}". Try rewording the question, or browse <a onclick="goTopic('all')" style="color:#1f6fc7;cursor:pointer">all available topics</a>.</p>`;
  }
  return `
    <p>Here are relevant resources for "${escapeHtml(q)}":</p>
    ${top[0] ? `<p>The closest match is ${aiBookLink(top[0])} — ${top[0].level} level, ${top[0].year}. ${escapeHtml(top[0].desc)}</p>` : ''}
    ${aiRecsBlock(top, 'Recommended books')}
    ${aiTopicChips(tops, 'Related topics')}
    ${aiAuthorChips(auts, 'Authors worth following')}`;
}

/* ----- Follow-ups generator ----- */
function buildFollowups(intent, topicName, res, ctxAuthor){
  const t = topicName || 'this topic';
  const ar = [];
  const author = res.authors[0] || ctxAuthor;

  if(intent === 'author-bio' && ctxAuthor){
    ar.push(`What's ${ctxAuthor.name}'s best book?`);
    ar.push(`Are there similar authors?`);
    if(res.topics[0]) ar.push(`What's new in ${res.topics[0].name} in 2025?`);
  } else if(intent === 'beginner-recs'){
    ar.push(`How long will ${t} take me?`);
    ar.push(`Suggest a learning path for ${t}`);
    ar.push(`What should I read after the first book?`);
  } else if(intent === 'advanced-recs'){
    ar.push(`What are the latest books for ${t}?`);
    ar.push(`Which authors matter most in ${t}?`);
    ar.push(`Recommend books for production systems`);
  } else if(intent === 'whats-new'){
    ar.push(`What is the MEAP program?`);
    ar.push(`Suggest a learning path for ${t}`);
    ar.push(`Best book for advanced developers in ${t}`);
  } else if(intent === 'time-estimate'){
    ar.push(`Suggest a learning path for ${t}`);
    ar.push(`Recommend a book for beginners in ${t}`);
    ar.push(`What should I read after the first book?`);
  } else if(intent === 'learning-path'){
    ar.push(`How long will ${t} take me?`);
    ar.push(`Suggest projects to practice`);
    ar.push(`Best book for advanced developers in ${t}`);
  } else if(intent === 'next-book'){
    ar.push(`Suggest a learning path for ${t}`);
    ar.push(`Best book for advanced developers in ${t}`);
    ar.push(`What's new in ${t} in 2025?`);
  } else if(intent === 'popularity'){
    ar.push(`Which authors matter most in ${t}?`);
    ar.push(`What's new in ${t} in 2025?`);
    ar.push(`Suggest a learning path for ${t}`);
  } else if(intent === 'compare'){
    ar.push(`Which is more popular in industry?`);
    ar.push(`Recommend a book for beginners in ${t}`);
  } else if(intent === 'definition'){
    ar.push(`How do I learn ${t}?`);
    ar.push(`Recommend a book for beginners in ${t}`);
    ar.push(`What's new in ${t} in 2025?`);
  } else if(intent === 'how-to-learn'){
    ar.push(`How long will ${t} take me?`);
    ar.push(`Suggest a learning path for ${t}`);
    ar.push(`What should I read after the first book?`);
  } else {
    ar.push(`Recommend a book for beginners in ${t}`);
    ar.push(`Best book for advanced developers in ${t}`);
    ar.push(`What's new in ${t} in 2025?`);
    if(author) ar.push(`Who is ${author.name}?`);
  }
  return ar.slice(0, 4);
}

function randomChapterName(b, idx){
  const topic = TOPICS.find(t=>t.id===b.topicIds[0])?.name || 'the topic';
  const names = [
    `Introduction to ${topic}`,
    `Setting up your environment`,
    `Core concepts and primitives`,
    `Working with data`,
    `Building your first project`,
    `Patterns and abstractions`,
    `Testing and debugging`,
    `Performance and optimization`,
    `Security considerations`,
    `Deployment and operations`,
    `Scaling and reliability`,
    `Production best practices`,
  ];
  return names[(idx - 1) % names.length];
}

/* ----- Author page ----- */
function renderAuthor(id){
  const a = AUTHORS.find(x=>x.id===id); if(!a) return goHome();
  const books = a.bookIds.map(bid=>BOOKS.find(x=>x.id===bid)).filter(Boolean);
  const topicIds = [...new Set(books.flatMap(b => b.topicIds))];
  const authorTopics = topicIds.map(tid => TOPICS.find(t => t.id === tid)).filter(Boolean).slice(0,6);
  const videos = VIDEOS.filter(v => v.topicIds.some(t => topicIds.includes(t))).slice(0,4);
  const totalPages = books.reduce((s,b)=>s+b.pages, 0);
  const newest = books.length ? Math.max(...books.map(b=>b.year)) : null;

  const bookWord = books.length === 1 ? 'book' : 'books';
  const topicWord = topicIds.length === 1 ? 'topic' : 'topics';

  main.innerHTML = `
    <section class="ap-hero">
      <div class="container">
        <div class="avatar">${initials(a.name)}</div>
        <div>
          <div class="eye">Author · ${books.length} ${bookWord}</div>
          <h1>${escapeHtml(a.name)}</h1>
          <div class="ap-stats">
            <b>${books.length}</b> ${bookWord} ·
            <b>${topicIds.length}</b> ${topicWord} ·
            <b>${totalPages.toLocaleString()}</b> total pages
            ${newest ? ` · latest <b>${newest}</b>` : ''}
          </div>
          <div class="bio">${escapeHtml(a.bio)}. Manning author known for clear, practical writing and project-driven examples. Their books are read by thousands of developers worldwide.</div>
        </div>
      </div>
    </section>

    <div class="container ap-body">
      ${authorTopics.length ? `
      <div class="ap-topics">
        <span class="ap-topics-lbl">Writes about:</span>
        ${authorTopics.map(t=>`<span class="ap-chip" onclick="goTopic('${t.id}')">${escapeHtml(t.name)}</span>`).join('')}
      </div>` : ''}

      <div class="ap-grid">
        <div class="ap-col-books">
          <div class="ap-col-head">Books by ${escapeHtml(a.name)} <span class="ap-count">· ${books.length}</span></div>
          ${books.length ? `<div class="ap-book-list">
            ${books.map(b => `
              <div class="ap-bk" onclick="goBook('${b.id}')">
                <div class="ap-cv ${coverFor(b)}">${escapeHtml(b.title)}</div>
                <div class="ap-bk-info">
                  <div class="ap-bk-title">${escapeHtml(b.title)}</div>
                  <div class="ap-bk-meta">${b.year} · ${b.level} · ${b.pages} pages</div>
                  <div class="ap-bk-desc">${escapeHtml(b.desc)}</div>
                  <div class="ap-bk-tags">
                    ${b.topicIds.slice(0,3).map(tid => { const t = TOPICS.find(x=>x.id===tid); return t ? `<span>${escapeHtml(t.name)}</span>` : '' }).join('')}
                  </div>
                </div>
                <div class="ap-bk-price">$${b.price.toFixed(2)}<small>Print + eBook</small></div>
              </div>`).join('')}
          </div>` : `
          <div style="color:#888;font-style:italic;padding:20px 0">No books published yet.</div>`}
        </div>

        <aside class="ap-col-side">
          <div class="ap-card">
            <h4>Related video courses</h4>
            ${videos.length ? videos.map(v => `
              <div class="ap-vid" onclick="alert('Video stub: ${escapeAttr(v.title)}')">
                <div class="ap-vthumb ${v.cover||''}"></div>
                <div class="ap-vid-info">
                  <div class="ap-vid-h">${escapeHtml(v.title)}</div>
                  <div class="ap-vid-m">${escapeHtml(v.instructor)} · ${v.date}</div>
                </div>
              </div>`).join('') : `
              <div style="color:#888;font-size:13px;font-style:italic">No related videos.</div>`}
          </div>

          <div class="ap-card">
            <h4>Quick actions</h4>
            <a onclick="goAskAI('Who is ${escapeAttr(a.name)}?')">✦ Ask AI about this author</a>
            <a onclick="goSearch('${escapeAttr(a.name)}')">🔍 All mentions of this author</a>
          </div>
        </aside>
      </div>
    </div>
  `;
}

/* ----- Pojam-in-Book drilled-in view ----- */
function renderPojamInBook(bookId, pojamId){
  const book = BOOKS.find(b => b.id === bookId);
  const pojam = POJMOVI.find(p => p.id === pojamId);
  if(!book || !pojam) return goHome();

  const ref = (pojam.bookRefs || []).find(r => r.id === bookId);
  const primaryChapter = ref?.chapter || '1. Introduction';
  // Parse e.g. "17. Iterators, Generators and Classic Coroutines" → { num:'17', title:'Iterators…' }
  const chMatch = primaryChapter.match(/^(\d+)\.\s*(.+)$/);
  const chNum = chMatch ? chMatch[1] : '1';
  const chTitle = chMatch ? chMatch[2] : primaryChapter;

  // Mock chapters list — just the one matched chapter (matches the screenshot pattern)
  const chapters = [{ num: chNum, title: chTitle, active: true }];

  // Highlight helper — wraps occurrences of pojam name with <mark class="pib-mark">
  const term = pojam.name;
  const highlight = (text) => {
    const tokens = term.split(/\s+/).filter(t => t.length >= 3);
    let out = text;
    // try full phrase first
    const phraseRe = new RegExp('('+term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','ig');
    if(phraseRe.test(out)){
      out = out.replace(phraseRe, '<mark class="pib-mark">$1</mark>');
    } else {
      tokens.forEach(tok => {
        const re = new RegExp('(\\b'+tok.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b)','ig');
        out = out.replace(re, '<mark class="pib-mark">$1</mark>');
      });
    }
    return out;
  };

  // Mock in-book sections — fabricated content that mentions the pojam in context
  const sections = [
    {
      subheader: 'Techniques employed',
      body: `<ul>
        <li>Simple data structures and primitives</li>
        <li>Selection and iteration patterns</li>
        <li>Sequential and ${term} pristupi rješavanju problema</li>
      </ul>`
    },
    {
      subheader: "what's inside",
      body: `<p>This ${book.level.toLowerCase()}-level resource gives you the conceptual foundation and hands-on practice with ${term}. You'll work through worked examples, code walkthroughs, and exercises that reinforce when and why this technique applies.</p>
        <ul>
          <li>Introduction to ${term} and its core idea</li>
          <li>Practical implementations in the language of the book</li>
          <li>Common pitfalls and best practices around ${term}</li>
        </ul>`
    },
    {
      subheader: "what's inside",
      body: `<p>The chapter takes you step by step through real code that demonstrates how ${term} differs from alternative approaches. You'll deepen your understanding of when to reach for ${term} and when a simpler solution is enough — a distinction that separates beginner-level reasoning from production-grade engineering.</p>`
    },
  ];

  const fmtChapterLoc = (sub, i) => {
    const sectionNum = `${chNum}.${i+1}`;
    const sectionName = sub === "what's inside" ? "What's inside" : sub;
    return `${chNum}. ${chTitle} <span class="dot">·</span> ${sectionNum}. ${sectionName}`;
  };

  main.innerHTML = `
    <div class="pib-wrap">
      <div class="pib-topline"></div>
      <div class="pib-close-row">
        <button class="pib-close" onclick="history.back()" title="Close">×</button>
      </div>

      <div class="pib-grid">
        <!-- LEFT SIDE -->
        <aside class="pib-side">
          <div class="pib-back" onclick="goPojam('${pojam.id}')">
            <span>‹</span> <span>in all products</span>
          </div>

          <div class="pib-book">
            <div class="pib-cover ${coverFor(book)}" onclick="goBook('${book.id}')">
              ${escapeHtml(book.title)}
              <span class="openico">↗</span>
            </div>
            <div class="pib-book-meta">
              <div class="pib-book-ttl">${escapeHtml(book.title)}</div>
              <div class="pib-book-desc">${escapeHtml(book.desc)}</div>
            </div>
          </div>
          <div class="pib-date">${monthOf(book)} ${book.year}</div>

          <div class="pib-chapters-h">chapters</div>
          <ol class="pib-chapters">
            ${chapters.map(c => `
              <li class="${c.active?'active':''}">${escapeHtml(c.title)}</li>`).join('')}
          </ol>
        </aside>

        <!-- RIGHT MAIN -->
        <div class="pib-main">
          <div class="pib-main-h">
            all results in <em>'${escapeHtml(book.title)}'</em>
          </div>

          ${sections.map((s, i) => `
            <div class="pib-section">
              <div class="pib-section-loc">${fmtChapterLoc(s.subheader, i)}</div>
              <h3 class="pib-section-sub">${escapeHtml(s.subheader)}</h3>
              <div class="pib-section-body">${highlight(s.body)}</div>
            </div>`).join('')}
        </div>
      </div>
    </div>
  `;
}

/* ----- Pojam page — simple list of books that cover this concept ----- */
function renderPojam(id){
  const p = POJMOVI.find(x => x.id === id);
  if(!p){ goHome(); return }

  const category = p.category ? TOPICS.find(t => t.id === p.category) : null;

  // Books with an explicit chapter reference
  const refBooks = (p.bookRefs || []).map(ref => ({
    book: BOOKS.find(b => b.id === ref.id),
    chapter: ref.chapter,
  })).filter(x => x.book);

  // Additional books from the same category that likely mention the concept
  const refIds = new Set(refBooks.map(r => r.book.id));
  const fallbackBooks = (category
      ? BOOKS.filter(b => !refIds.has(b.id) && b.topicIds.includes(category.id))
      : [])
    .slice(0, 5)
    .map(b => ({ book: b, chapter: null }));

  const allRows = [...refBooks, ...fallbackBooks];

  main.innerHTML = `
    <div class="pp-wrap">
      <section class="pp-hero">
        <div class="container">
          <div class="crumb">
            <a onclick="goHome()">home</a>
            ${category ? ` / <a onclick="goTopic('${category.id}')">${escapeHtml(category.name)}</a>` : ''}
            / Topic: ${escapeHtml(p.name)}
          </div>
          <span class="eye">Topic</span>
          <h1><span class="tag-ico">#</span>${escapeHtml(p.name)}</h1>
          <p class="desc">${escapeHtml(p.desc)}</p>
          <div class="stats">
            <div><b>${allRows.length}</b>books cover this topic</div>
            ${category ? `<div><b>${escapeHtml(category.name)}</b>parent category</div>` : ''}
          </div>
        </div>
      </section>

      <div class="container" style="max-width:900px;padding:36px 24px 60px;font-family:-apple-system,sans-serif">
        <h2 style="font-family:Georgia,serif;font-size:22px;margin:0 0 6px;font-weight:700">
          Books that cover "${escapeHtml(p.name)}"
        </h2>
        <p style="color:var(--muted);font-size:13.5px;margin:0 0 22px">
          Click a book to see this topic explained in that context.
        </p>

        ${allRows.length ? `
        <div class="pp-books">
          ${allRows.map(({book:b, chapter}) => `
            <div class="pp-bk" onclick="goPojamInBook('${b.id}','${p.id}')">
              <div class="cv ${coverFor(b)}"></div>
              <div class="info">
                <div class="ttl">${escapeHtml(b.title)}</div>
                <div class="by">${bookAuthors(b)} · ${b.year} · ${b.level}</div>
                ${chapter ? `<span class="chap">📖 ${escapeHtml(chapter)}</span>` : ''}
              </div>
              <div class="meta">$${b.price.toFixed(2)}<br><span style="font-size:11px">${b.pages} pp</span></div>
            </div>`).join('')}
        </div>` : `
        <div style="padding:40px;text-align:center;color:var(--muted);font-style:italic">
          No books cover this topic in depth yet.
        </div>`}
      </div>
    </div>
  `;
}

/* ----- Rich category page (Python and other broad topics) ----- */
function renderRichCategory(t, books, videos){
  const intro = CATEGORY_INTRO[t.id];
  const parent = t.parent ? TOPICS.find(p => p.id === t.parent) : null;
  const authors = [...new Set(books.flatMap(b => b.authorIds))]
    .map(aid => AUTHORS.find(a => a.id === aid)).filter(Boolean);
  const levelCounts = countBy(books, b => b.level);
  const totalCovered = (levelCounts.Beginner || 0) + (levelCounts.Intermediate || 0) + (levelCounts.Advanced || 0);
  const allThreeLevels = (levelCounts.Beginner || 0) > 0 && (levelCounts.Intermediate || 0) > 0 && (levelCounts.Advanced || 0) > 0;

  // ===== Learning path: pick 2 best books per level =====
  const byLevel = {
    Beginner:     books.filter(b => b.level === 'Beginner')    .sort((a,b)=>b.year-a.year).slice(0,2),
    Intermediate: books.filter(b => b.level === 'Intermediate').sort((a,b)=>b.year-a.year).slice(0,2),
    Advanced:     books.filter(b => b.level === 'Advanced')    .sort((a,b)=>b.year-a.year).slice(0,2),
  };

  const levelDescs = {
    Beginner:     'Start from zero. Syntax, first projects, core patterns.',
    Intermediate: 'Solid productivity. Real projects, ecosystem, best practices.',
    Advanced:     'Deep understanding. Internals, optimization, edge cases.',
  };
  const levelLabelHr = { Beginner:'Beginner', Intermediate:'Intermediate', Advanced:'Advanced' };
  const levelDuration = { Beginner:'4–6 weeks', Intermediate:'2–3 months', Advanced:'3–6 months' };

  // ===== Subcategories =====
  const subcats = (intro.subcategories || []).map(sc => {
    let scBooks = [];
    if(sc.id && !sc.id.startsWith('__')){
      const subTopic = TOPICS.find(x => x.id === sc.id);
      if(subTopic) scBooks = subTopic.bookIds.map(bid=>BOOKS.find(b=>b.id===bid)).filter(Boolean);
    }
    if(sc.siblingIds){
      const ids = new Set();
      sc.siblingIds.forEach(sid => {
        const st = TOPICS.find(x => x.id === sid);
        if(st) st.bookIds.forEach(bid => ids.add(bid));
      });
      scBooks = [...ids].map(bid => BOOKS.find(b=>b.id===bid)).filter(Boolean);
    }
    if(sc.bookFilter){
      scBooks = books.filter(sc.bookFilter);
    }
    // intersect with current topic where appropriate (e.g., ML books that also include Python)
    if(sc.id === 'ml' || sc.siblingIds){
      scBooks = scBooks.filter(b => b.topicIds.includes(t.id) || b.topicIds.some(tid => sc.siblingIds?.includes(tid)));
    }
    return { ...sc, books: scBooks };
  });

  // ===== Bestsellers — curated heuristic: popularity proxy via price + recency + authorship =====
  const bestsellers = [...books]
    .sort((a,b) => (b.price + b.year*0.5) - (a.price + a.year*0.5))
    .slice(0,5);

  // ===== New releases =====
  const newReleases = [...books].sort((a,b)=>b.year-a.year).filter(b=>b.year>=2022).slice(0,5);

  // ===== Cross-format bundles (theme → books + videos + projects) =====
  const themeBundles = (intro.subcategories || []).slice(0,3).map(sc => {
    let scBooks = [], scVideos = [];
    if(sc.id && !sc.id.startsWith('__')){
      const subTopic = TOPICS.find(x => x.id === sc.id);
      if(subTopic){
        scBooks = subTopic.bookIds.map(bid=>BOOKS.find(b=>b.id===bid)).filter(Boolean);
        scVideos = VIDEOS.filter(v => v.topicIds.includes(sc.id));
      }
    } else if(sc.siblingIds){
      const ids = new Set(), vids = new Set();
      sc.siblingIds.forEach(sid => {
        const st = TOPICS.find(x => x.id === sid);
        if(st) st.bookIds.forEach(bid => ids.add(bid));
        VIDEOS.filter(v=>v.topicIds.includes(sid)).forEach(v => vids.add(v.id));
      });
      scBooks = [...ids].map(bid=>BOOKS.find(b=>b.id===bid)).filter(Boolean).filter(b=>b.topicIds.includes(t.id));
      scVideos = [...vids].map(vid=>VIDEOS.find(v=>v.id===vid)).filter(Boolean);
    } else if(sc.bookFilter){
      scBooks = books.filter(sc.bookFilter);
    }
    return { ...sc, books: scBooks.slice(0,2), videos: scVideos.slice(0,2) };
  }).filter(b => b.books.length + b.videos.length >= 2);

  // ===== Mock personalized cards =====
  const inProgress = books[0]; // pretend user is reading the first book
  const nextStep = byLevel.Intermediate[0] || byLevel.Beginner[1];
  const followedAuthorBook = authors[0]?.bookIds?.map(id=>BOOKS.find(b=>b.id===id)).find(b => b && b.id !== inProgress?.id);

  main.innerHTML = `
    <!-- HERO -->
    <section class="cat-hero">
      <div class="container">
        <div class="crumb">
          <a onclick="goHome()">home</a> / <a onclick="goTopic('all')">categories</a>
          ${parent ? ` / <a onclick="goTopic('${parent.id}')">${escapeHtml(parent.name)}</a>` : ''}
          / ${escapeHtml(t.name)}
        </div>
        <div class="eye">Category</div>
        <h1>${escapeHtml(t.name)}</h1>
        <p class="tagline">${escapeHtml(intro.tagline)}</p>
        <p class="intro">${escapeHtml(intro.intro)}</p>
        <div class="stats">
          <div><b>${books.length}</b><span>books in catalog</span></div>
          <div><b>${videos.length}</b><span>video courses</span></div>
          <div><b>${authors.length}</b><span>authors</span></div>
          <div><b>${allThreeLevels ? 'All levels' : (Object.keys(levelCounts).length + ' levels')}</b><span>covered</span></div>
        </div>
        <div class="actions">
          <button class="primary" onclick="document.getElementById('cat-lp')?.scrollIntoView({behavior:'smooth'})">📚 See learning path</button>
          <button class="ghost" onclick="document.getElementById('cat-sub')?.scrollIntoView({behavior:'smooth'})">Explore subcategories ↓</button>
        </div>
      </div>
    </section>

    <!-- LEARNING PATH -->
    <section class="cat-section" id="cat-lp">
      <div class="container">
        <div class="head">
          <h2>Learning path — from beginner to advanced</h2>
          <a class="more" onclick="goAskAI('Suggest a learning path for ${escapeAttr(t.name)}')">Ask AI for a personalized plan →</a>
        </div>
        <p class="sub">A curated sequence of books that build on each other. Realistic pace: ~6–9 months to solid production knowledge.</p>
        <div class="lp-grid">
          ${['Beginner','Intermediate','Advanced'].map((lvl, i) => `
            <div class="lp-step ${lvl.toLowerCase()}">
              <span class="badge">${i+1}. ${levelLabelHr[lvl]}</span>
              <div class="level-name">${levelLabelHr[lvl]}</div>
              <div class="level-desc">${levelDescs[lvl]}</div>
              <div class="lp-books">
                ${byLevel[lvl].length ? byLevel[lvl].map(b => `
                  <div class="lp-book" onclick="goBook('${b.id}')">
                    <div class="mc ${coverFor(b)}"></div>
                    <div class="info">
                      <div class="h">${escapeHtml(b.title)}</div>
                      <div class="m">${bookAuthors(b)} · ${b.year}</div>
                    </div>
                  </div>`).join('')
                  : '<div style="color:#999;font-size:12px;font-style:italic">Coming soon</div>'}
              </div>
              <div class="lp-meta">Duration: ${levelDuration[lvl]} · ${byLevel[lvl].length || 0} ${byLevel[lvl].length===1?'book':'books'}</div>
            </div>`).join('')}
        </div>
      </div>
    </section>

    <!-- SUBCATEGORIES -->
    ${subcats.length ? `
    <section class="cat-section" id="cat-sub">
      <div class="container">
        <div class="head"><h2>Subcategories</h2></div>
        <p class="sub">${escapeHtml(t.name)} is broad — pick the direction that interests you.</p>
        <div class="subcats">
          ${subcats.map(sc => {
            const goTo = sc.id && !sc.id.startsWith('__') ? `goTopic('${sc.id}')` : `goSearch('${escapeAttr(sc.label)}')`;
            const previewBooks = sc.books.slice(0,4);
            return `<div class="subcat" onclick="${goTo}">
              <div style="display:flex;align-items:center;gap:10px;justify-content:space-between">
                <div style="display:flex;align-items:center;gap:10px">
                  <span class="ico">${sc.ico}</span>
                  <span class="nm">${escapeHtml(sc.label)}</span>
                </div>
                <span class="count">${sc.books.length} ${sc.books.length===1?'book':'books'}</span>
              </div>
              <div class="desc">${escapeHtml(sc.desc)}</div>
              ${previewBooks.length ? `<div class="row-mini">${previewBooks.map(b=>`<div class="mc ${coverFor(b)}"></div>`).join('')}</div>` : ''}
            </div>`;
          }).join('')}
        </div>
      </div>
    </section>` : ''}

    <!-- BESTSELLERS -->
    ${bestsellers.length ? `
    <section class="cat-section">
      <div class="container">
        <div class="head">
          <h2>Bestsellers — what others are reading</h2>
          <a class="more" onclick="goSearch('${escapeAttr(t.name)}')">Sort all by popularity →</a>
        </div>
        <p class="sub">A curated list of the best-selling books in ${escapeHtml(t.name)} over the last 6 months.</p>
        <div class="carousel">
          <button class="carousel-nav left" onclick="scrollCarousel(this,-1)">‹</button>
          <button class="carousel-nav right" onclick="scrollCarousel(this,1)">›</button>
          <div class="carousel-track">
            ${bestsellers.map((b,i) => `
              <div class="bookcard" onclick="goBook('${b.id}')" style="position:relative">
                ${i < 3 ? `<span style="position:absolute;top:6px;left:6px;background:#f0a92b;color:#1a1a1a;padding:2px 8px;font-size:9px;font-weight:800;letter-spacing:1px;border-radius:2px;z-index:2">#${i+1} BESTSELLER</span>` : ''}
                <div class="cover ${coverFor(b)}">${escapeHtml(b.title)}</div>
                <div class="bt">${escapeHtml(b.title)}</div>
                <div class="ba">${bookAuthors(b)}</div>
                <div class="bp">$${b.price.toFixed(2)}</div>
              </div>`).join('')}
          </div>
        </div>
      </div>
    </section>` : ''}

    <!-- NEW RELEASES -->
    ${newReleases.length ? `
    <section class="cat-section">
      <div class="container">
        <div class="head">
          <h2>New releases</h2>
          <a class="more" onclick="goSearch('${escapeAttr(t.name)}')">Sort all by date →</a>
        </div>
        <p class="sub">The ecosystem moves fast. These are titles published in the last 24 months — some still in MEAP.</p>
        <div class="carousel">
          <button class="carousel-nav left" onclick="scrollCarousel(this,-1)">‹</button>
          <button class="carousel-nav right" onclick="scrollCarousel(this,1)">›</button>
          <div class="carousel-track">
            ${newReleases.map(b => `
              <div class="bookcard" onclick="goBook('${b.id}')" style="position:relative">
                ${b.year >= 2024 ? '<span class="meap-badge">MEAP</span>' : ''}
                <div class="cover ${coverFor(b)}">${escapeHtml(b.title)}</div>
                <div class="bt">${escapeHtml(b.title)}</div>
                <div class="ba">${bookAuthors(b)} · ${b.year}</div>
                <div class="bp">$${b.price.toFixed(2)}</div>
              </div>`).join('')}
          </div>
        </div>
      </div>
    </section>` : ''}

    <!-- PERSONALIZED FOR YOU -->
    <section class="cat-section">
      <div class="container">
        <div class="foryou">
          <div class="fy-header">
            <div class="fy-avatar">DP</div>
            <div>
              <div class="fy-greet">For you, Design</div>
              <div class="fy-sub">Based on books you've bought and authors you follow · signed-in users only</div>
            </div>
          </div>
          <div class="fy-cols">
            ${inProgress ? `
            <div class="fy-card" onclick="goBook('${inProgress.id}')">
              <div class="fy-lbl">Continue reading</div>
              <div class="fy-h">${escapeHtml(inProgress.title)}</div>
              <div class="fy-m">47% complete · chapter 6 of 12</div>
              <div class="fy-progress"><span style="width:47%"></span></div>
            </div>` : ''}
            ${nextStep ? `
            <div class="fy-card" onclick="goBook('${nextStep.id}')">
              <div class="fy-lbl">Next step</div>
              <div class="fy-h">${escapeHtml(nextStep.title)}</div>
              <div class="fy-m">A natural follow-up to ${inProgress ? escapeHtml(inProgress.title.slice(0,30)) + '…' : 'the basics'}. ${nextStep.level} level.</div>
            </div>` : ''}
            ${followedAuthorBook ? `
            <div class="fy-card" onclick="goBook('${followedAuthorBook.id}')">
              <div class="fy-lbl">New from an author you follow</div>
              <div class="fy-h">${escapeHtml(followedAuthorBook.title)}</div>
              <div class="fy-m">${bookAuthors(followedAuthorBook)} · ${followedAuthorBook.year}</div>
            </div>` : ''}
          </div>
        </div>
      </div>
    </section>
  `;
}

/* ----- Editorial content per category ----- */
const CATEGORY_INTRO = {
  python: {
    tagline: 'The most popular general-purpose language in 2025',
    intro: 'Python is the go-to choice for data science, web development, automation, and AI. Its readable syntax and massive ecosystem make it as friendly for beginners as it is for senior engineers. From data exploration to production web apps — Python covers it all.',
    subcategories: [
      { id:'pyds',     ico:'📊', label:'Data Science',     desc:'Pandas, NumPy, visualization' },
      { id:'django',   ico:'🌐', label:'Web development',  desc:'Django, FastAPI, web frameworks' },
      { id:'__auto',   ico:'⚙️', label:'Automation',       desc:'Scripting, scraping, task automation', bookFilter: b => /automate|crash|hard/i.test(b.title) },
      { id:'ml',       ico:'🤖', label:'ML & AI',          desc:'Machine learning, deep learning, LLMs', siblingIds:['ml','dl','ai'] },
      { id:'__test',   ico:'✅', label:'Testing & quality',desc:'Pytest, mocking, type hints',           bookFilter: b => false },
      { id:'__perf',   ico:'⚡', label:'Performance',      desc:'Async, profiling, optimization',        bookFilter: b => /fluent|advanced/i.test(b.title) },
    ],
  },
  js: {
    tagline: 'The universal language of the web — from browser to server',
    intro: 'JavaScript powers most of the internet. With Node.js it dominates the server too, and modern frameworks like React set the standard for UI development.',
    subcategories: [
      { id:'react', ico:'⚛️', label:'React',          desc:'UI library, hooks, state' },
      { id:'node',  ico:'🟢', label:'Node.js',        desc:'Server-side JavaScript' },
      { id:'sec',   ico:'🔒', label:'Web Security',   desc:'AppSec, XSS, authentication' },
    ],
  },
  ml: {
    tagline: 'Models that learn from data',
    intro: 'Machine Learning sits at the heart of modern AI systems. From classic algorithms to deep neural networks — the Manning catalog covers theory and practice for every level.',
    subcategories: [
      { id:'dl', ico:'🧠', label:'Deep Learning', desc:'Neural networks, transformers' },
      { id:'ai', ico:'✦',  label:'AI & LLMs',     desc:'Generative models, agents, RAG' },
    ],
  },
};

/* ----- Topic page ----- */
function renderTopic(id){
  if(id === 'all'){
    main.innerHTML = `
      <section class="tp-hero">
        <div class="container">
          <div class="crumb"><a onclick="goHome()">home</a> / all topics</div>
          <h1 style="font-size:30px">All topics</h1>
          <div class="desc">Browse the full Manning catalog by topic — programming languages, frameworks, AI, DevOps, and more.</div>
        </div>
      </section>
      <div class="container" style="padding:32px 0;font-family:-apple-system,sans-serif">
        <div class="grid topics">
          ${TOPICS.map(t=>`
            <div class="topiccard" onclick="goTopic('${t.id}')">
              <div class="th"># ${escapeHtml(t.name)}</div>
              <div class="tc">${t.bookIds.length} books · ${escapeHtml(t.desc)}</div>
            </div>`).join('')}
        </div>
      </div>`;
    return;
  }
  const t = TOPICS.find(x=>x.id===id); if(!t) return goHome();
  const books = t.bookIds.map(bid=>BOOKS.find(x=>x.id===bid)).filter(Boolean);
  const videos = VIDEOS.filter(v => v.topicIds.includes(t.id));
  // Render rich editorial view if we have editorial content for this category
  if(CATEGORY_INTRO[t.id]) return renderRichCategory(t, books, videos);

  const parent = t.parent ? TOPICS.find(p => p.id === t.parent) : null;
  const children = TOPICS.filter(c => c.parent === t.id);
  const siblings = parent ? TOPICS.filter(s => s.parent === parent.id && s.id !== t.id) : [];
  const authors = [...new Set(books.flatMap(b => b.authorIds))]
    .map(aid => AUTHORS.find(a => a.id === aid)).filter(Boolean).slice(0, 6);
  const levelCounts = countBy(books, b => b.level);

  main.innerHTML = `
    <section class="tp-hero">
      <div class="container">
        <div class="crumb">
          <a onclick="goHome()">home</a> / <a onclick="goTopic('all')">topics</a>
          ${parent ? ` / <a onclick="goTopic('${parent.id}')">${escapeHtml(parent.name)}</a>` : ''}
          / ${escapeHtml(t.name)}
        </div>
        <h1>${escapeHtml(t.name)}</h1>
        <div class="desc">${escapeHtml(t.desc)} — explore ${books.length} books and ${videos.length} video courses on ${escapeHtml(t.name)}, from beginner introductions to advanced production guides.</div>
        <div class="stats">
          <div><b>${books.length}</b>books</div>
          <div><b>${videos.length}</b>video courses</div>
          <div><b>${authors.length}</b>authors</div>
          <div><b>${levelCounts['Beginner']||0}</b>for beginners</div>
        </div>
        ${(children.length || siblings.length || parent) ? `
        <div class="tp-sub-chips">
          ${parent ? `<span class="chip parent" onclick="goTopic('${parent.id}')">↑ ${escapeHtml(parent.name)}</span>` : ''}
          ${children.map(c => `<span class="chip" onclick="goTopic('${c.id}')">${escapeHtml(c.name)} (${c.bookIds.length})</span>`).join('')}
          ${siblings.map(s => `<span class="chip" onclick="goTopic('${s.id}')">${escapeHtml(s.name)} (${s.bookIds.length})</span>`).join('')}
        </div>` : ''}
      </div>
    </section>

    ${authors.length ? `
    <div class="container" style="padding:28px 0 0;font-family:-apple-system,sans-serif">
      <div style="font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:var(--muted);font-weight:700;margin-bottom:12px">Top authors in ${escapeHtml(t.name)}</div>
      <div class="authrow">
        ${authors.map(a => `
          <div class="acard" onclick="goAuthor('${a.id}')">
            <div class="avatar">${initials(a.name)}</div>
            <div class="h">${escapeHtml(a.name)}</div>
            <div class="m">${a.bookIds.length} ${a.bookIds.length===1?'book':'books'}</div>
          </div>`).join('')}
      </div>
    </div>` : ''}

    <div class="srp-grid" style="padding-top:32px">
      <div class="srp-col-books">
        <div class="srp-col-head">books · ${books.length}</div>
        ${books.length ? books.map(b => bookResultHTML(b, '')).join('')
          : '<div style="color:#888;font-style:italic;padding:20px 0;font-family:Georgia,serif">No books in this topic yet.</div>'}
      </div>
      <div class="srp-col-videos">
        <div class="srp-col-head">videos and projects · ${videos.length}</div>
        ${videos.length ? videos.map(v => videoResultHTML(v, '')).join('')
          : '<div style="color:#888;font-style:italic;padding:20px 0;font-family:Georgia,serif">No video courses yet.</div>'}
      </div>
    </div>
  `;
}

/* =====================================================
   DROPDOWN — autocomplete
   ===================================================== */
let ddState = { items:[], focusedIdx:-1, q:'', userMovedFocus:false };
let debounceTimer = null;

/* ----- Recent searches (localStorage) ----- */
const RECENT_KEY = 'manning-mock-recent';
const RECENT_MAX = 8;
const RECENT_SEED = ['python', 'react', 'machine learning', 'kubernetes', 'eric matthes'];
function loadRecent(){
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if(raw === null){ saveRecent(RECENT_SEED); return [...RECENT_SEED] }
    return JSON.parse(raw);
  } catch { return [...RECENT_SEED] }
}
function saveRecent(arr){
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(arr.slice(0, RECENT_MAX))) } catch {}
}
function addRecent(q){
  q = q.trim(); if(!q) return;
  const list = loadRecent().filter(x => x.toLowerCase() !== q.toLowerCase());
  list.unshift(q);
  saveRecent(list);
}
function removeRecent(q){
  saveRecent(loadRecent().filter(x => x !== q));
}
function clearRecent(){ saveRecent([]) }

function renderRecentList(){
  // Only show search-shaped recents; questions live in Ask AI flow
  const list = loadRecent().filter(x => !isAskAIIntent(x));
  if(!list.length) return '';
  return list.slice(0,5).map(q => `
    <div class="recent-row" data-recent="${escapeAttr(q)}">
      <div class="icoholder">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
      </div>
      <div class="rtxt">${escapeHtml(q)}</div>
      <span class="ru" data-remove="${escapeAttr(q)}" title="Remove from recent searches">Remove</span>
    </div>`).join('');
}

function bindRecentChips(){
  // legacy no-op (replaced by delegated handler)
}

input.addEventListener('input', e => {
  const v = e.target.value;
  searchEl.classList.toggle('has-text', v.length > 0);
  if(window.searchVariant === 'modal') return;
  clearTimeout(debounceTimer);
  // skeleton briefly to simulate latency
  if(v.trim()){
    showSkeleton();
    debounceTimer = setTimeout(()=>renderDropdown(v), 120);
  } else {
    closeDD();
  }
});
input.addEventListener('focus', ()=>{
  if(window.searchVariant === 'modal'){ input.blur(); searchModalApi?.open(); return }
  searchEl.classList.add('focused');
  if(input.value.trim()) renderDropdown(input.value);
  else renderEmptyDropdown();
});
input.addEventListener('click', ()=>{
  if(window.searchVariant === 'modal'){ input.blur(); searchModalApi?.open(); return }
  // Always reopen on click — even if already focused
  if(input.value.trim()) renderDropdown(input.value);
  else renderEmptyDropdown();
});
input.addEventListener('blur', ()=>{
  searchEl.classList.remove('focused');
  if(window.searchVariant === 'modal') return;
  setTimeout(closeDD, 150); // allow click
});

input.addEventListener('keydown', e => {
  if(e.key === 'ArrowDown'){ e.preventDefault(); moveFocus(1) }
  else if(e.key === 'ArrowUp'){ e.preventDefault(); moveFocus(-1) }
  else if(e.key === 'Enter'){
    e.preventDefault();
    // Only activate a specific item if the user explicitly moved focus (arrow keys / hover).
    if(ddState.userMovedFocus && ddState.focusedIdx >= 0 && ddState.items[ddState.focusedIdx]){
      activateItem(ddState.items[ddState.focusedIdx], e.metaKey || e.ctrlKey);
    } else if(input.value.trim()){
      // ⌘/Ctrl+Enter forces SRP even for question-shaped queries
      if(e.metaKey || e.ctrlKey) goSearch(input.value);
      else goSmartSearch(input.value);
    }
  }
  else if(e.key === 'Escape'){
    if(dd.classList.contains('open')) closeDD();
    else { input.value=''; searchEl.classList.remove('has-text') }
  }
});

document.addEventListener('keydown', e => {
  if((e.metaKey || e.ctrlKey) && e.key === 'k'){
    e.preventDefault(); focusSearch();
  } else if(e.key === '/' && document.activeElement !== input){
    e.preventDefault(); focusSearch();
  }
});

clearBtn.addEventListener('click', ()=>{ input.value=''; searchEl.classList.remove('has-text'); input.focus(); closeDD() });

function focusSearch(){ input.focus(); input.select() }
function closeDD(){ dd.classList.remove('open'); input.setAttribute('aria-expanded','false'); ddState.focusedIdx = -1 }

function showSkeleton(){
  dd.innerHTML = `<div class="skeleton">
    <div class="sk"></div><div class="sk s"></div><div class="sk"></div><div class="sk s"></div>
  </div>`;
  dd.classList.add('open');
  input.setAttribute('aria-expanded','true');
}

function renderEmptyDropdown(){
  ddState.q = ''; ddState.items = []; ddState.focusedIdx = -1; ddState.userMovedFocus = false;
  const visibleRecents = loadRecent().filter(x => !isAskAIIntent(x));
  const recentHTML = visibleRecents.length ? renderRecentList() : `
    <div style="padding:18px 14px;color:var(--muted);font-size:13px;text-align:center">
      Start typing to search books, authors, and topics
    </div>`;

  dd.innerHTML = `
    ${recentHTML}
    <div class="footer-row askai" data-kind="askai" data-id="">
      <div class="icoholder">✦</div>
      <div class="frmain">
        <div class="frtitle">Ask AI anything</div>
        <div class="frsub">Get a recommendation or explanation</div>
      </div>
      <span class="frarrow">→</span>
    </div>`;

  // Items for keyboard nav: recent rows + ask AI
  visibleRecents.slice(0,5).forEach(q => ddState.items.push({ kind:'recent', q }));
  ddState.items.push({ kind:'askai', q:'' });

  dd.classList.add('open');
  input.setAttribute('aria-expanded','true');
}

function renderDropdown(q){
  const res = searchAll(q);
  ddState.q = q;
  ddState.items = [];
  ddState.focusedIdx = -1;
  ddState.userMovedFocus = false;

  const topActions = topActionsHTML(q);

  if(!res.books.length && !res.authors.length && !res.topics.length){
    dd.innerHTML = `
      ${topActions}
      <div class="dd-divider"></div>
      <div class="empty" style="padding:30px 20px">
        <div class="big" style="font-size:14px;margin-bottom:8px">No results for "${escapeHtml(q)}"</div>
        <div style="color:var(--muted);font-size:12px">Try a different spelling</div>
      </div>`;
    ddState.items.push({ kind:'search', q });
    ddState.items.push({ kind:'askai',  q });
    ddState.focusedIdx = 0;
    dd.classList.add('open');
    return;
  }

  // Build a single mixed-ranked list — cap at 8 total
  const allScored = [
    ...BOOKS  .map(b => ({ kind:'book',       item:b, s:scoreBook(b,q) })),
    ...AUTHORS.map(a => ({ kind:'author',     item:a, s:scoreAuthor(a,q) })),
    ...TOPICS .map(t => ({ kind:'kategorija', item:t, s:scoreTopic(t,q) })),
    ...POJMOVI.map(p => ({ kind:'pojam',      item:p, s:scorePojam(p,q) })),
  ].filter(x => x.s > 0).sort((a,b) => b.s - a.s).slice(0, 8);

  ddState.items.push({ kind:'search', q });
  ddState.items.push({ kind:'askai',  q });

  let html = topActions + '<div class="dd-divider"></div><div class="flatlist">';
  allScored.forEach((r) => {
    html += rowHTML(r, q, false);
    ddState.items.push({ kind:r.kind, id:r.item.id });
  });
  html += '</div>';

  dd.innerHTML = html;
  dd.classList.add('open');
  input.setAttribute('aria-expanded','true');

  // Focus the first top-action ("Search for …")
  ddState.focusedIdx = 0;
  const firstRow = dd.querySelector('.footer-row');
  if(firstRow) firstRow.classList.add('focused');
}

function topActionsHTML(q){
  return `<div class="footer-row search" data-kind="search" data-id="${escapeAttr(q)}">
      <div class="icoholder">⌕</div>
      <div class="frmain">
        <div class="frtitle">Search for "${escapeHtml(q)}"</div>
        <div class="frsub">See all results</div>
      </div>
    </div>
    <div class="footer-row askai" data-kind="askai" data-id="${escapeAttr(q)}">
      <div class="icoholder">✦</div>
      <div class="frmain">
        <div class="frtitle">Ask AI about "${escapeHtml(q)}"</div>
        <div class="frsub">Get a recommendation or explanation</div>
      </div>
    </div>`;
}

/* Delegated handler on main for SRP recent chips */
main.addEventListener('click', e => {
  const remove = e.target.closest('[data-srp-remove]');
  if(remove){ e.stopPropagation(); removeRecent(remove.dataset.srpRemove); renderSRP(input.value || ''); return }
  const chip = e.target.closest('[data-srp-recent]');
  if(chip){ const q = chip.dataset.srpRecent; input.value = q; goSearch(q); return }
});

/* Single delegated handler on the dropdown — fires reliably after re-renders */
// Prevent any click inside the dropdown from blurring the input
// (which would otherwise schedule closeDD and shut the dropdown).
dd.addEventListener('mousedown', e => { e.preventDefault() });
dd.addEventListener('mousemove', e => {
  const row = e.target.closest('.row, .recent-row, .footer-row');
  if(!row) return;
  const all = Array.from(dd.querySelectorAll('.row, .recent-row, .footer-row'));
  const idx = all.indexOf(row);
  if(idx === ddState.focusedIdx) return;
  all.forEach(r => r.classList.remove('focused'));
  row.classList.add('focused');
  ddState.focusedIdx = idx;
  ddState.userMovedFocus = true;
});
dd.addEventListener('click', e => {
  // Fill input from a recent row's arrow (doesn't navigate)
  const fillEl = e.target.closest('[data-fill]');
  if(fillEl){ e.stopPropagation(); input.value = fillEl.dataset.fill; searchEl.classList.add('has-text'); renderDropdown(input.value); input.focus(); return }
  const removeEl = e.target.closest('[data-remove]');
  if(removeEl){ e.stopPropagation(); removeRecent(removeEl.dataset.remove); input.value ? renderDropdown(input.value) : renderEmptyDropdown(); return }
  // Recent search row → re-route based on intent (question → AI, noun → SRP)
  const recent = e.target.closest('[data-recent]');
  if(recent){ const q = recent.dataset.recent; input.value = q; goSmartSearch(q); return }
  const row = e.target.closest('[data-kind]');
  if(!row) return;
  const kind = row.dataset.kind, id = row.dataset.id;
  if(kind === 'search') goSearch(id || input.value || '');
  else if(kind === 'browse-all') goTopic('all');
  else if(kind === 'book') goBook(id);
  else if(kind === 'author') goAuthor(id);
  else if(kind === 'topic' || kind === 'kategorija') goTopic(id);
  else if(kind === 'pojam') goPojam(id);
  else if(kind === 'askai') goAskAI(id || input.value || '');
});

// Real logos / fallback per category id — used as the left visual in autocomplete rows.
const PYTHON_LOGO_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 32 32" aria-hidden="true">
  <defs>
    <linearGradient id="pyA" x1="811.527" y1="574.895" x2="665.255" y2="573.732" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#366a96"/><stop offset="1" stop-color="#3679b0"/>
    </linearGradient>
    <linearGradient id="pyB" x1="862.824" y1="642.176" x2="573.276" y2="642.176" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ffc836"/><stop offset="1" stop-color="#ffe873"/>
    </linearGradient>
  </defs>
  <g transform="matrix(.1617 0 0 .158089 -107.53764 -81.66187)">
    <path d="M716.255 544.487c0-13.623 3.653-21.034 23.822-24.563 13.693-2.4 31.25-2.7 47.627 0 12.935 2.135 23.822 11.77 23.822 24.563v44.945c0 13.182-10.57 23.98-23.822 23.98h-47.627c-16.164 0-29.787 13.782-29.787 29.363v21.564h-16.376c-13.852 0-21.917-9.988-25.305-23.964-4.57-18.776-4.376-29.963 0-47.945 3.794-15.687 15.917-23.964 29.77-23.964h65.52v-6h-47.645v-17.98z" fill="url(#pyA)"/>
    <path d="M811.527 688.32c0 13.623-11.823 20.523-23.822 23.964-18.052 5.188-32.54 4.394-47.627 0-12.6-3.67-23.822-11.17-23.822-23.964v-44.945c0-12.935 10.782-23.98 23.822-23.98h47.627c15.864 0 29.787-13.71 29.787-29.963v-20.964h17.858c13.87 0 20.4 10.305 23.822 23.964 4.764 18.97 4.976 33.157 0 47.945-4.817 14.364-9.97 23.964-23.822 23.964H763.9v6h47.627v17.98z" fill="url(#pyB)"/>
    <path d="M728.166 541.505c0-4.976 3.988-9 8.93-9 4.923 0 8.93 4.023 8.93 9 0 4.96-4.006 8.982-8.93 8.982-4.94 0-8.93-4.023-8.93-8.982zm53.59 149.798c0-4.96 4.006-8.982 8.93-8.982 4.94 0 8.93 4.023 8.93 8.982 0 4.976-3.988 9-8.93 9-4.923 0-8.93-4.023-8.93-9z" fill="#fff"/>
  </g>
</svg>`;

const CATEGORY_LOGOS = {
  python: PYTHON_LOGO_SVG,
  js:'⚡', react:'⚛️', node:'⬢', go:'Go', rust:'🦀',
  k8s:'☸', devops:'⚙', sec:'🔒',
  ml:'🧠', dl:'🧠', ai:'✦', data:'📊',
  django:'🟢', pyds:'📊',
};

// Mini book cover — colored by primary topic (tech-brand palette), with serif initial.
// Looks like a Manning-style spine at small autocomplete size.
const TOPIC_COVER_COLORS = {
  python:  '#306998', // Python blue
  pyds:    '#150458', // pandas/dark
  django:  '#092E20', // Django dark green
  js:      '#F0DB4F', // JS yellow
  react:   '#20232A', // React dark with cyan accent
  node:    '#339933', // Node green
  go:      '#00ADD8', // Go cyan
  rust:    '#CE422B', // Rust orange-red
  ml:      '#FF6F00', // ML orange
  dl:      '#5E35B1', // Deep Learning purple
  ai:      '#1976D2', // AI blue
  data:    '#37474F', // Data slate
  k8s:     '#326CE5', // Kubernetes blue
  devops:  '#E65100', // DevOps amber
  sec:     '#B71C1C', // Security red
};
function bookCoverImg(b){
  const topic = b.topicIds[0] || 'python';
  const bg = TOPIC_COVER_COLORS[topic] || '#5F6368';
  const fg = (bg === '#F0DB4F' || bg === '#00ADD8') ? '#1a1a1a' : '#fff';
  // First letter of the title, skipping "The /A /An "
  const cleaned = b.title.replace(/^(The |A |An )/i, '').trim();
  const initial = cleaned.charAt(0).toUpperCase();
  return `<span class="cv-img" style="background:${bg};color:${fg}">${initial}</span>`;
}

function rowHTML(r, q, isFirst){
  const k = r.kind, it = r.item;
  let visual, title, meta;
  if(k === 'book'){
    visual = bookCoverImg(it);
    title = highlight(escapeHtml(it.title), q);
    const author = bookAuthors(it);
    const topic = it.topicIds.map(t=>TOPICS.find(x=>x.id===t)?.name).filter(Boolean)[0] || '';
    meta = `${author}${topic ? ' · ' + topic : ''}`;
  } else if(k === 'author'){
    visual = escapeHtml(initials(it.name));
    title = highlight(escapeHtml(it.name), q);
    meta = `${escapeHtml(it.bio.split('.')[0])} · ${it.bookIds.length} ${it.bookIds.length===1?'book':'books'}`;
  } else if(k === 'kategorija'){
    visual = CATEGORY_LOGOS[it.id] || '◧';
    title = highlight(escapeHtml(it.name), q);
    meta = `Category · ${it.bookIds.length} ${it.bookIds.length===1?'book':'books'} · ${escapeHtml(it.desc)}`;
  } else {
    visual = '#';
    title = highlight(escapeHtml(it.name), q);
    meta = `Topic mentioned in ${it.bookCount} books`;
  }
  return `<div class="row${isFirst?' focused':''}" data-kind="${k}" data-id="${it.id}">
    <div class="icoholder ${k}">${visual}</div>
    <div class="rowmain">
      <div class="rowtitle">${title}</div>
      <div class="rowmeta">${meta}</div>
    </div>
  </div>`;
}

function moveFocus(delta){
  if(!ddState.items.length) return;
  ddState.userMovedFocus = true;
  ddState.focusedIdx = (ddState.focusedIdx + delta + ddState.items.length) % ddState.items.length;
  const rows = dd.querySelectorAll('.row, .recent-row, .footer-row');
  rows.forEach(r => r.classList.remove('focused'));
  const target = rows[ddState.focusedIdx];
  if(target){ target.classList.add('focused'); target.scrollIntoView({block:'nearest'}) }
}

function activateItem(item, forceSRP){
  if(forceSRP){ goSearch(ddState.q); return }
  if(item.kind === 'book') goBook(item.id);
  else if(item.kind === 'author') goAuthor(item.id);
  else if(item.kind === 'topic' || item.kind === 'kategorija') goTopic(item.id);
  else if(item.kind === 'pojam') goPojam(item.id);
  else if(item.kind === 'search') goSearch(item.q || input.value || '');
  else if(item.kind === 'recent') { input.value = item.q; goSmartSearch(item.q) }
  else if(item.kind === 'browse-all') goTopic('all');
  else if(item.kind === 'askai') goAskAI(item.q || input.value || '');
}

/* =====================================================
   Routing (hash-based)
   ===================================================== */
function goHome(){ location.hash = '' }
function goSearch(q){ addRecent(q); closeDD(); input.value = q; location.hash = '#/search/' + encodeURIComponent(q) }

/* Smart router — question-shaped queries open Ask AI, noun-shaped queries open SRP */
function goSmartSearch(q){
  if(isAskAIIntent(q)) return goAskAI(q);
  const qn = norm(q);

  // 1. Exact navigational matches (entity pages)
  const exactTopic  = TOPICS .find(t => norm(t.name)  === qn);
  if(exactTopic)  return goTopic(exactTopic.id);
  const exactAuthor = AUTHORS.find(a => norm(a.name)  === qn);
  if(exactAuthor) return goAuthor(exactAuthor.id);
  const exactBook   = BOOKS  .find(b => norm(b.title) === qn);
  if(exactBook)   return goBook(exactBook.id);
  const exactPojam  = POJMOVI.find(p => norm(p.name)  === qn);
  if(exactPojam)  return goPojam(exactPojam.id);

  // 2. Strong pojam match — open concept page when:
  //    a) score is high (well above floor),
  //    b) dominantly higher than the next pojam candidate,
  //    c) the pojam has enough catalog coverage (≥5 books) to justify a concept page
  const scoredPojmovi = POJMOVI
    .map(p => ({ p, s: scorePojam(p, q) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s);

  if(scoredPojmovi.length){
    const top = scoredPojmovi[0];
    const runnerUp = scoredPojmovi[1]?.s || 0;
    const isDominant = top.s >= runnerUp * 1.4 + 0.5;
    const highScore  = top.s >= 5;          // matches prefix/substring confidently
    const hasCoverage = top.p.bookCount >= 5;
    if(highScore && isDominant && hasCoverage){
      return goPojam(top.p.id);
    }
  }

  // 3. Strong category match — same idea for topics (broad but high-confidence)
  const scoredTopics = TOPICS
    .map(t => ({ t, s: scoreTopic(t, q) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s);
  if(scoredTopics.length){
    const top = scoredTopics[0];
    const runnerUp = scoredTopics[1]?.s || 0;
    if(top.s >= 5 && top.s >= runnerUp * 1.4 + 0.5 && top.t.bookIds.length >= 5){
      return goTopic(top.t.id);
    }
  }

  // 4. Fallback: SRP
  goSearch(q);
}
function goBook(id){ closeDD(); location.hash = '#/book/' + id }
function goAuthor(id){ closeDD(); location.hash = '#/author/' + id }
function goTopic(id){ closeDD(); location.hash = '#/topic/' + id }
function goPojam(id){ closeDD(); location.hash = '#/pojam/' + id }
function goPojamInBook(bookId, pojamId){ closeDD(); location.hash = `#/in/${bookId}/${encodeURIComponent(pojamId)}` }
/* AI conversation thread — in-memory, appended on follow-ups */
let aiThread = [];
function goAskAI(q, isFollowup){
  q = (q||'').trim() || 'how do I pick the right book?';
  addRecent(q);
  closeDD();
  if(isFollowup && aiThread.length) aiThread.push(buildAiMessage(q));
  else aiThread = [buildAiMessage(q)];
  if(decodeURIComponent(location.hash.replace(/^#\/?ask\//,'')) === q){
    // hash unchanged → manually re-render
    renderAskAI(q);
  } else {
    location.hash = '#/ask/' + encodeURIComponent(q);
  }
}
function setQuery(q){ input.value = q; goSearch(q) }
function toggleRail(){ document.getElementById('rail')?.classList.toggle('open') }

function route(){
  const h = location.hash.replace(/^#\/?/, '');
  const [kind, ...rest] = h.split('/');
  const id = decodeURIComponent(rest.join('/'));
  // Reset AI thread whenever we leave the ask flow
  if(kind !== 'ask') resetAiThread();
  if(!h){ renderHome(); input.value=''; searchEl.classList.remove('has-text'); window.scrollTo(0,0); return }
  if(kind === 'search'){ input.value = id; searchEl.classList.add('has-text'); renderSRP(id) }
  else if(kind === 'book') renderBook(id);
  else if(kind === 'author') renderAuthor(id);
  else if(kind === 'topic') renderTopic(id);
  else if(kind === 'pojam') renderPojam(id);
  else if(kind === 'in'){
    const bId = decodeURIComponent(rest[0] || '');
    const pId = decodeURIComponent(rest[1] || '');
    renderPojamInBook(bId, pId);
  }
  else if(kind === 'ask'){ input.value = id; searchEl.classList.add('has-text'); renderAskAI(id) }
  else renderHome();
  if(kind !== 'ask' || aiThread.length <= 1) window.scrollTo(0,0);
}
window.addEventListener('hashchange', route);

/* utils */
function countBy(arr, fn){ const o={}; arr.forEach(x=>{ const k=fn(x); o[k]=(o[k]||0)+1 }); return o }

// Refresh / cold load always lands on the homepage.
// Use history.replaceState so we don't trigger a hashchange event that would
// re-route us back to the previous page.
if(location.hash){
  history.replaceState(null, '', location.pathname + location.search);
}
route();

/* Floating devnav — jump between routes + pick search variant */
window.searchVariant = localStorage.getItem('searchVariant') || 'dropdown';
function setSearchVariant(v){
  window.searchVariant = v;
  localStorage.setItem('searchVariant', v);
  document.querySelectorAll('#devnav-menu button[data-variant]').forEach(b => {
    b.classList.toggle('active', b.dataset.variant === v);
  });
  if(typeof closeDD === 'function') closeDD();
  const ov = document.getElementById('searchModal');
  if(ov) ov.classList.remove('open');
}

(function(){
  const btn = document.getElementById('devnav-btn');
  const menu = document.getElementById('devnav-menu');
  if(!btn || !menu) return;
  btn.addEventListener('click', e => {
    e.stopPropagation();
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
  });
  document.addEventListener('click', e => {
    if(!e.target.closest('#devnav')) menu.style.display = 'none';
  });
  menu.addEventListener('click', e => {
    const variantBtn = e.target.closest('button[data-variant]');
    if(variantBtn){ e.stopPropagation(); setSearchVariant(variantBtn.dataset.variant); return }
    const b = e.target.closest('button[data-go]'); if(!b) return;
    e.stopPropagation();
    const kind = b.dataset.go;
    const bookId   = BOOKS[0]   && BOOKS[0].id;
    const authorId = AUTHORS[0] && AUTHORS[0].id;
    const topicId  = TOPICS[0]  && TOPICS[0].id;
    const pojamId  = POJMOVI[0] && POJMOVI[0].id;
    switch(kind){
      case 'home':      goHome(); break;
      case 'srp':       goSearch('python'); break;
      case 'ask':       goAskAI('how to learn python'); break;
      case 'book':      goBook(bookId); break;
      case 'author':    goAuthor(authorId); break;
      case 'topic':     goTopic(topicId); break;
      case 'alltopics': goTopic('all'); break;
      case 'pojam':     goPojam(pojamId); break;
      case 'in':        goPojamInBook(bookId, pojamId); break;
    }
    menu.style.display = 'none';
  });
  // initial active state for variant buttons
  setSearchVariant(window.searchVariant);
})();

/* =====================================================
   Search modal (alternate variant) — see src/search-modal/
   ===================================================== */
searchModalApi = initSearchModal({
  pageInput: input,
  searchEl,
  nav: { goSearch, goSmartSearch, goAskAI, goBook, goAuthor, goTopic, goPojam },
  helpers: { bookAuthors, bookCoverImg, initials, CATEGORY_LOGOS },
  ai: { buildMessage: buildAiMessage },
});


// --- Inline-handler bridge -------------------------------------------------
// The markup still uses onclick="goBook(...)" etc. ES modules don't leak
// top-level names to window, so expose them explicitly. (cycleTip already
// assigns itself to window.) As handlers move to event delegation, trim this.
Object.assign(window, {
  clearAllFilters,
  clearRecent,
  goAskAI,
  goAuthor,
  goBook,
  goHome,
  goPojam,
  goPojamInBook,
  goSearch,
  goSmartSearch,
  goTopic,
  renderSRP,
  resetAiThread,
  scrollCarousel,
  setQuery,
  setSrpPrice,
  toggleFilter
});
