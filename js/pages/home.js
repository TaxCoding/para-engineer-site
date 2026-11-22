import { getContentCached, getPublishedCached } from '../data/api.js';
import { mergeContent } from '../data/defaults.js';
import { esc, renderRich, observeReveal, setMeta, fmtDate } from '../lib/util.js';
import { config } from '../config.js';
import { initCats } from '../lib/cats.js';
import { icon } from '../lib/icons.js';
import { placeholder } from '../lib/cards.js';
import { socialButtons, setActiveNav, setInventoryReady } from '../lib/shell.js';
import { trackPageview } from '../lib/track.js';
import { scrollToHash } from '../lib/router.js';

const catStage = `
  <div class="cats-stage">
    <div class="cat-interactive protected-zone" data-cat="1" data-sound="/assets/miaw.mp3">
      <div class="cat-shadow" aria-hidden="true"></div>
      <div class="cat-visual"><img src="/assets/cat-1.png" alt="Cat" draggable="false" /><div class="photo-shield" aria-hidden="true"></div></div>
    </div>
    <div class="cat-interactive protected-zone" data-cat="2" data-sound="/assets/blublub.mp3">
      <div class="cat-shadow" aria-hidden="true"></div>
      <div class="cat-visual"><img src="/assets/cat-2.png" alt="Cat" draggable="false" /><div class="photo-shield" aria-hidden="true"></div></div>
    </div>
  </div>`;

const ICONS = {
  arrowRight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`,
  arrowLeft: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`,
  pause: `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`,
  play: `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>`,
};

export async function homePage(view) {
  const content0 = await getContentCached().catch(() => mergeContent({}));
  view.innerHTML = layout(content0);
  initCats(view);
  trackPageview('/');
  setMeta({
    title: content0.site.name,
    description: content0.home.subtitle,
    url: config.siteUrl + '/',
  });

  let projects = [];
  try {
    projects = await getPublishedCached();
  } catch (e) {
    console.warn(e);
  }

  // Batasi Showcase Lago maksimal 3 proyek teratas
  const top3 = projects.slice(0, 3);
  const stopShowcase = mountShowcase(view, top3, projects.length, content0);
  const stopReveal = observeReveal(view);

  const ids = ['top', 'projects', 'about', 'contact'];
  let raf = 0;
  const onScroll = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const mid = window.innerHeight * 0.36;
      let active = 'top';
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= mid) active = id;
      }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 40) {
        active = 'contact';
      }
      setActiveNav(active);
      const hero = document.getElementById('top');
      setInventoryReady(window.scrollY > (hero?.offsetHeight || 400) * 0.5);
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  if (location.hash) requestAnimationFrame(() => scrollToHash(location.hash, false));

  return () => {
    stopShowcase();
    stopReveal();
    window.removeEventListener('scroll', onScroll);
    cancelAnimationFrame(raf);
  };
}

function layout(c) {
  const h = c.home;
  return `
    <section class="hero-block hero-full" id="top">
      ${catStage}
      <h1>${esc(h.headline)}</h1>
      <p class="subtitle">${esc(h.subtitle)}</p>
      <div class="hero-actions">
        <a class="btn primary" href="/#projects">${esc(h.primaryCta)}${icon('arrowDown')}</a>
        <a class="btn" href="/#about">${esc(h.secondaryCta)}</a>
      </div>
      <a class="scroll-hint" href="/#projects" aria-label="Scroll to projects">${icon('chevDown')}</a>
    </section>

    <section class="section wrap" id="projects">
      <header class="section-head center reveal">
        <span class="eyebrow">Selected work</span>
        <h2>${esc(h.projectsTitle)}</h2>
        <p>${esc(h.projectsSubtitle)}</p>
      </header>

      <!-- Showcase Carousel Top 3 (tanpa duplikasi grid All projects di bawahnya) -->
      <div class="lago-showcase reveal" id="lagoShowcase">
        <div class="skeleton-block" style="height:320px"></div>
      </div>
    </section>

    <section class="section wrap narrow about-plain" id="about">
      <div class="about-divider reveal">
        ${c.about.photoUrl ? `<img class="about-photo" src="${esc(c.about.photoUrl)}" alt="${esc(c.site.owner)}" loading="lazy" />` : ''}
        <div class="about-text">
          <span class="eyebrow">${esc(c.about.title)}</span>
          <h2>${esc(c.site.owner)}</h2>
          <div class="rich">${renderRich(c.about.body)}</div>
          ${
            c.about.quote
              ? `<blockquote class="about-quote-block">
                  <p>“${esc(c.about.quote)}”</p>
                  ${c.about.quoteAuthor ? `<footer>— ${esc(c.about.quoteAuthor)}</footer>` : ''}
                </blockquote>`
              : ''
          }
          ${c.about.skills.length ? `<ul class="chips">${c.about.skills.map((s) => `<li class="chip">${esc(s)}</li>`).join('')}</ul>` : ''}
        </div>
      </div>
    </section>

    <footer class="landing-footer" id="contact">
      <div class="footer-head">
        <h2>${esc(c.contact.ctaTitle)}</h2>
        <p>${esc(c.contact.ctaText)}</p>
      </div>
      <nav class="social-links big" aria-label="Social Links">${socialButtons(c)}</nav>
      <p class="license-line">© ${new Date().getFullYear()} ${esc(c.site.owner)} · Released under the <a href="${esc(c.site.licenseUrl)}" target="_blank" rel="noopener noreferrer">${esc(c.site.license)}</a>.</p>
    </footer>`;
}

function mountShowcase(view, projects, totalCount, c) {
  const host = view.querySelector('#lagoShowcase');
  if (!host) return () => {};

  if (!projects.length) {
    host.innerHTML = `<div class="empty-state"><strong>Nothing shipped yet.</strong><p>The senior engineers are still busy doing nothing — check back soon.</p></div>`;
    return () => {};
  }

  const SLIDE_MS = 6000;
  let index = 0;
  let elapsed = 0;
  let userPaused = false;
  let hoverPaused = false;
  let rafId = 0;
  let lastTick = 0;

  host.innerHTML = `
    <div class="lago-grid" id="lagoSwipeArea">
      <article class="lago-card-left">
        <div class="lago-timer-track"><div class="lago-timer-fill" id="lagoTimerFill"></div></div>
        <div class="lago-content" id="lagoContent"></div>
        <a class="lago-card-foot" id="lagoFootLink" href="#">
          <span>View project</span>
          ${ICONS.arrowRight}
        </a>
      </article>
      <div class="lago-media-right" id="lagoMediaRight"></div>
    </div>

    ${
      projects.length > 1
        ? `<div class="lago-controls">
            <span class="lago-counter" id="lagoCounter"></span>
            <button type="button" class="lago-circle-btn" id="lagoPauseBtn" aria-label="Pause auto-slide">${ICONS.pause}</button>
            <button type="button" class="lago-circle-btn" id="lagoPrevBtn" aria-label="Previous project">${ICONS.arrowLeft}</button>
            <button type="button" class="lago-circle-btn" id="lagoNextBtn" aria-label="Next project">${ICONS.arrowRight}</button>
          </div>`
        : ''
    }

    <div class="lago-explore-wrap">
      <a class="btn" href="/projects">See all projects ${totalCount > 0 ? `(${totalCount})` : ''} ${ICONS.arrowRight}</a>
    </div>`;

  const fillEl = host.querySelector('#lagoTimerFill');
  const contentEl = host.querySelector('#lagoContent');
  const footEl = host.querySelector('#lagoFootLink');
  const mediaEl = host.querySelector('#lagoMediaRight');
  const counterEl = host.querySelector('#lagoCounter');
  const pauseBtn = host.querySelector('#lagoPauseBtn');
  const prevBtn = host.querySelector('#lagoPrevBtn');
  const nextBtn = host.querySelector('#lagoNextBtn');

  function renderSlide(i) {
    const p = projects[i];
    const pad = (n) => String(n).padStart(2, '0');
    const summary = p.shortDescription || c.about.quote || 'Exploring software, hardware, and engineering ideas.';

    contentEl.style.animation = 'none';
    void contentEl.offsetWidth;
    contentEl.style.animation = '';

    contentEl.innerHTML = `
      <div class="lago-label-row">
        <span class="lago-title">${esc(p.title)}</span>
        <span class="lago-kicker">Top ${i + 1}</span>
      </div>
      <div class="lago-mark" aria-hidden="true">“</div>
      <p class="lago-quote">${esc(summary)}</p>
      <div class="lago-meta">— ${esc(c.site.owner)} · ${esc(fmtDate(p.createdAt))}</div>`;

    footEl.href = `/projects/${esc(p.slug)}`;

    mediaEl.innerHTML = p.cover
      ? `<img src="${esc(p.cover.url)}" alt="${esc(p.title)}" loading="lazy" />`
      : placeholder();

    if (counterEl) {
      counterEl.innerHTML = `<strong>${pad(i + 1)}</strong> / ${pad(projects.length)}`;
    }
  }

  function go(nextIdx) {
    index = (nextIdx + projects.length) % projects.length;
    elapsed = 0;
    if (fillEl) fillEl.style.transform = projects.length > 1 ? 'scaleX(0)' : 'scaleX(1)';
    renderSlide(index);
  }

  function updatePauseUi() {
    if (!pauseBtn) return;
    pauseBtn.innerHTML = userPaused ? ICONS.play : ICONS.pause;
    pauseBtn.setAttribute('aria-label', userPaused ? 'Resume auto-slide' : 'Pause auto-slide');
  }

  function tick(now) {
    if (!lastTick) lastTick = now;
    const dt = now - lastTick;
    lastTick = now;

    if (projects.length > 1 && !userPaused && !hoverPaused && !document.hidden) {
      elapsed += dt;
      const pct = Math.min(elapsed / SLIDE_MS, 1);
      if (fillEl) fillEl.style.transform = `scaleX(${pct.toFixed(4)})`;
      if (pct >= 1) go(index + 1);
    }
    rafId = requestAnimationFrame(tick);
  }

  renderSlide(0);

  if (projects.length > 1) {
    const gridEl = host.querySelector('#lagoSwipeArea');
    const onEnter = () => { hoverPaused = true; };
    const onLeave = () => { hoverPaused = false; lastTick = performance.now(); };
    gridEl.addEventListener('mouseenter', onEnter);
    gridEl.addEventListener('mouseleave', onLeave);

    // Geser jari (Touch Swipe) khusus HP
    let touchStartX = 0;
    let touchStartY = 0;
    const onTouchStart = (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    };
    const onTouchEnd = (e) => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        go(dx < 0 ? index + 1 : index - 1);
      }
    };
    gridEl.addEventListener('touchstart', onTouchStart, { passive: true });
    gridEl.addEventListener('touchend', onTouchEnd, { passive: true });

    pauseBtn?.addEventListener('click', () => {
      userPaused = !userPaused;
      lastTick = performance.now();
      updatePauseUi();
    });
    prevBtn?.addEventListener('click', () => go(index - 1));
    nextBtn?.addEventListener('click', () => go(index + 1));

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      gridEl.removeEventListener('mouseenter', onEnter);
      gridEl.removeEventListener('mouseleave', onLeave);
      gridEl.removeEventListener('touchstart', onTouchStart);
      gridEl.removeEventListener('touchend', onTouchEnd);
    };
  }

  if (fillEl) fillEl.style.transform = 'scaleX(1)';
  return () => {};
}