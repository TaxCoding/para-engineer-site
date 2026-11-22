// Analitik gratis & ramah privasi: tanpa cookie, tanpa IP, tanpa pihak ketiga.
// Hanya menyimpan: path, perujuk (host saja), jenis perangkat/browser kasar,
// dan ID acak anonim (localStorage) untuk menghitung pengunjung unik.
import { api, isDemo } from '../data/api.js';
import { config } from '../config.js';
import { uid } from './util.js';

const isBot = /bot|crawl|spider|headless|lighthouse|preview/i.test(navigator.userAgent) || navigator.webdriver;
const isLocal = /^(localhost|127\.|\[::1\])/.test(location.hostname);

function store(kind, key) {
  try {
    const s = kind === 'local' ? localStorage : sessionStorage;
    let v = s.getItem(key);
    if (!v) { v = uid().slice(0, 18); s.setItem(key, v); }
    return v;
  } catch {
    return 'anon';
  }
}

function device() {
  const w = window.innerWidth;
  return w < 768 ? 'mobile' : w < 1100 ? 'tablet' : 'desktop';
}

function browser() {
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return 'Edge';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Chrome\//.test(ua) || /CriOS/.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'Other';
}

function allowed() {
  if (api.isAdmin()) return false; // jangan hitung kunjungan admin sendiri
  if (!isDemo && isBot) return false;
  if (!isDemo && isLocal && !config.trackLocalhost) return false;
  return true;
}

function base() {
  return { visitorId: store('local', 'pe_vid'), sessionId: store('session', 'pe_sid'), device: device(), browser: browser() };
}

let lastView = '';
export function trackPageview(path, projectId = null) {
  if (!allowed() || path === lastView) return;
  lastView = path;
  let referrer = null;
  try {
    const r = document.referrer && new URL(document.referrer);
    if (r && r.host !== location.host) referrer = r.host.replace(/^www\./, '');
  } catch {}
  // perujuk eksternal hanya relevan untuk pageview pertama sesi ini
  api.track({ type: 'pageview', path, projectId, referrer: window.__pe_ref_used ? null : referrer, ...base() }).catch(() => {});
  window.__pe_ref_used = true;
}

export function trackClick(label, targetUrl, path, projectId = null) {
  if (!allowed()) return;
  api.track({ type: 'click', path, projectId, label, targetUrl, ...base() }).catch(() => {});
}

export function resetLastView() { lastView = ''; }
