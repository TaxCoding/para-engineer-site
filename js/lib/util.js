// Utilitas kecil dipakai di mana-mana.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

export function debounce(fn, ms = 200) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

export function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

// "mawi.para.engineer" -> "https://mawi.para.engineer"; null jika bukan URL valid
export function normalizeUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  if (/^mailto:/i.test(raw)) return raw;
  const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withProto);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.')) return null;
    return u.pathname === '/' && !u.search && !u.hash ? u.href.replace(/\/$/, '') : u.href;
  } catch {
    return null;
  }
}

export function hostOf(url) {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return String(url || '');
  }
}

const dFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const dtFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
export const fmtDate = (v) => (v ? dFmt.format(new Date(v)) : '—');
export const fmtDateTime = (v) => (v ? dtFmt.format(new Date(v)) : '—');
export const fmtNum = (n) => new Intl.NumberFormat('en-US').format(Math.round(Number(n) || 0));

export function relTime(v) {
  const s = Math.round((Date.now() - new Date(v).getTime()) / 1000);
  if (s < 45) return 'just now';
  const units = [['minute', 60], ['hour', 3600], ['day', 86400], ['week', 604800], ['month', 2592000], ['year', 31536000]];
  let best = ['second', 1];
  for (const u of units) if (s >= u[1]) best = u;
  const n = Math.floor(s / best[1]);
  return `${n} ${best[0]}${n > 1 ? 's' : ''} ago`;
}

// ---- teks kaya yang aman: paragraf, daftar "- ", **tebal**, `kode`, tautan ----
export function renderRich(text) {
  const inline = (s) =>
    esc(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  const blocks = String(text || '').replace(/\r\n/g, '\n').trim().split(/\n{2,}/);
  return blocks
    .filter(Boolean)
    .map((b) => {
      const lines = b.split('\n');
      if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
        return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*[-*]\s+/, ''))}</li>`).join('')}</ul>`;
      }
      if (/^#{1,3}\s+/.test(lines[0]) && lines.length === 1) {
        return `<h3>${inline(lines[0].replace(/^#{1,3}\s+/, ''))}</h3>`;
      }
      return `<p>${lines.map(inline).join('<br>')}</p>`;
    })
    .join('');
}

// ---- toast ----
let toastTimer;
export function toast(message, kind = '') {
  const el = document.getElementById('toastWarning');
  if (!el) return;
  el.textContent = message;
  el.classList.toggle('error', kind === 'error');
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), kind === 'error' ? 4200 : 2300);
}

// ---- reveal saat scroll (halus) ----
let revealObserver;
export function observeReveal(root = document) {
  const els = $$('.reveal:not(.in)', root);
  if (!('IntersectionObserver' in window)) {
    els.forEach((e) => e.classList.add('in'));
    return () => {};
  }
  revealObserver?.disconnect();
  revealObserver = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (en.isIntersecting) {
          en.target.classList.add('in');
          revealObserver.unobserve(en.target);
        }
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
  );
  els.forEach((e) => revealObserver.observe(e));
  return () => revealObserver?.disconnect();
}

export function setMeta({ title, description, url, image } = {}) {
  document.querySelector('meta[name="robots"]')?.remove(); // halaman publik boleh diindeks
  if (title) document.title = title;
  const set = (sel, attr, val) => {
    const el = document.querySelector(sel);
    if (el && val) el.setAttribute(attr, val);
  };
  set('meta[name="description"]', 'content', description);
  set('meta[property="og:title"]', 'content', title);
  set('meta[property="og:description"]', 'content', description);
  set('meta[property="og:url"]', 'content', url);
  set('link[rel="canonical"]', 'href', url);
  let og = document.querySelector('meta[property="og:image"]');
  if (image) {
    if (!og) {
      og = document.createElement('meta');
      og.setAttribute('property', 'og:image');
      document.head.appendChild(og);
    }
    og.setAttribute('content', image);
  } else og?.remove();
}

export function copyText(text) {
  return navigator.clipboard?.writeText(text).then(() => true, () => false) ?? Promise.resolve(false);
}
