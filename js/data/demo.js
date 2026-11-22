// MODE DEMO — backend palsu di dalam browser (localStorage) dengan bentuk API
// yang sama persis dengan supabase.js. Aktif otomatis kalau config.js belum diisi.
// Berguna untuk mencoba semua fitur admin sebelum Supabase terpasang.
import { mergeContent, CONTENT_KEYS } from './defaults.js';
import { ApiError } from './supabase.js';
import { uid } from '../lib/util.js';

const DB_KEY = 'pe_demo_db_v1';
const SESSION_KEY = 'pe_demo_session_v1';
export const DEMO_EMAIL = 'admin@para.engineer';
export const DEMO_PASSWORD = 'demo';

// ---------- gambar contoh (SVG, tanpa file biner) ----------
function art(title, variant, [c1, c2]) {
  const bars = [0.62, 0.8, 0.45, 0.7, 0.55]
    .map((w, i) => `<rect x="170" y="${300 + i * 52}" width="${Math.round(w * 520)}" height="16" rx="8" fill="${i % 2 ? '#dbeafe' : '#bfdbfe'}"/>`)
    .join('');
  const shapes = [
    `<circle cx="1330" cy="260" r="190" fill="${c1}" opacity=".16"/><circle cx="1180" cy="620" r="120" fill="${c2}" opacity=".18"/>${bars}<rect x="860" y="250" width="520" height="320" rx="28" fill="#fff" stroke="#bfdbfe" stroke-width="3"/><path d="M910 500l90-90 70 60 110-130 100 120" fill="none" stroke="${c1}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`,
    `<rect x="170" y="230" width="1260" height="470" rx="34" fill="#fff" stroke="#bfdbfe" stroke-width="3"/><circle cx="230" cy="285" r="11" fill="#fecaca"/><circle cx="268" cy="285" r="11" fill="#fde68a"/><circle cx="306" cy="285" r="11" fill="#bbf7d0"/>${[0, 1, 2].map((i) => `<rect x="${230 + i * 400}" y="360" width="340" height="250" rx="22" fill="${i === 1 ? c1 : '#eff6ff'}" opacity="${i === 1 ? '.9' : '1'}"/>`).join('')}`,
    `<circle cx="800" cy="450" r="330" fill="${c1}" opacity=".10"/><circle cx="800" cy="450" r="230" fill="${c2}" opacity=".14"/><circle cx="800" cy="450" r="120" fill="#fff" stroke="${c1}" stroke-width="10"/><path d="M740 450l45 45 85-95" fill="none" stroke="${c1}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>`,
  ][variant % 3];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#eff6ff"/></linearGradient></defs><rect width="1600" height="900" fill="url(#g)"/>${shapes}<text x="800" y="170" text-anchor="middle" font-family="system-ui,Segoe UI,Roboto,sans-serif" font-size="64" font-weight="800" fill="#0f172a" letter-spacing="-2">${title}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function seedProjects() {
  const now = Date.now();
  const day = 86400000;
  const mk = (n, slug, title, short, full, status, ratio, palette, links, created, updated) => {
    const images = [0, 1, 2].map((v) => {
      const id = uid();
      return { id, path: `demo:${id}`, url: art(title.split(' — ')[0], v + n, palette), isCover: v === 0, width: 1600, height: 900 };
    });
    return {
      id: uid(), slug, title, shortDescription: short, fullDescription: full, status, imageRatio: ratio,
      images, links: links.map((l) => ({ id: uid(), ...l })),
      createdAt: new Date(now - created * day).toISOString(), updatedAt: new Date(now - updated * day).toISOString(),
    };
  };
  return [
    mk(0, 'mawi', 'Mawi — Cat Assistant', 'A tiny chat companion that lives on para.engineer and answers in two very different moods.',
      'Mawi is a chat experience built around two cat personalities. One is polite and helpful, the other is a grumpy street cat.\n\n**What it does**\n- Streams short answers from a free-tier LLM API\n- Keeps the conversation in the browser session only\n- Plays a sound and zooms the cat when a reply arrives\n\nThe whole front end is vanilla JS with a single serverless function behind it. No framework, no build step.',
      'published', '16:9', ['#2563eb', '#60a5fa'],
      [{ type: 'repository', label: '', url: 'https://github.com/taxcoding/mawi' }, { type: 'production', label: '', url: 'https://mawi.para.engineer' }, { type: 'documentation', label: '', url: 'https://docs.para.engineer' }, { type: 'demo', label: '', url: 'https://demo.para.engineer' }], 40, 3),
    mk(1, 'smart-garden', 'Smart Garden — IoT Monitor', 'ESP32 sensors report soil moisture and light to a live dashboard, and water the plants when needed.',
      'A small IoT system for a balcony garden. An ESP32 reads soil moisture, temperature and light, then publishes readings over MQTT.\n\n**Highlights**\n- Battery friendly deep-sleep loop\n- Realtime dashboard with history charts\n- Automatic watering rules with a manual override\n\nBuilt as a learning project to connect firmware, backend and a web UI end to end.',
      'published', '4:3', ['#0ea5e9', '#2563eb'],
      [{ type: 'repository', label: '', url: 'https://github.com/taxcoding/smart-garden' }, { type: 'demo', label: '', url: 'https://garden.para.engineer' }], 25, 9),
    mk(2, 'campus-queue', 'Campus Queue', 'A queue-number web app that helps students skip the line at the administration office.',
      'Students take a number from their phone and get notified when their turn is near. Staff see the live queue and can call the next person.\n\nThe app was designed for unreliable campus Wi-Fi: it works as a lightweight installable page and syncs when the connection returns.',
      'published', '1:1', ['#1d4ed8', '#93c5fd'],
      [{ type: 'repository', label: '', url: 'https://github.com/taxcoding/campus-queue' }], 12, 12),
    mk(3, 'para-docs', 'Para Docs', 'Documentation hub for every Para Engineer project. Still being written.',
      'A single place to find setup guides, architecture notes and changelogs for each project.\n\nThis entry is a draft — it only shows up to you while signed in as admin.',
      'draft', '16:9', ['#3b82f6', '#2563eb'],
      [{ type: 'documentation', label: '', url: 'https://docs.para.engineer' }], 4, 1),
  ];
}

// ---------- analitik sintetis (tidak disimpan; deterministik) ----------
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rnd, table) => {
  let r = rnd() * table.reduce((s, [, w]) => s + w, 0);
  for (const [v, w] of table) if ((r -= w) <= 0) return v;
  return table[0][0];
};

function seedEvents(projects) {
  const rnd = mulberry32(20261121);
  const out = [];
  const pubs = projects.filter((p) => p.status === 'published');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let d = 89; d >= 0; d--) {
    const dayStart = today.getTime() - d * 86400000;
    const dow = new Date(dayStart).getDay();
    const base = 14 + (90 - d) * 0.22 + (dow === 0 || dow === 6 ? -4 : 3);
    const n = Math.max(3, Math.round(base + rnd() * 16));
    for (let i = 0; i < n; i++) {
      const visitor = `v${Math.floor(Math.pow(rnd(), 1.6) * 520)}`;
      const proj = rnd() < 0.42 && pubs.length ? pubs[Math.floor(rnd() * pubs.length)] : null;
      const createdAt = new Date(dayStart + Math.floor(rnd() * 86400000)).toISOString();
      const device = pick(rnd, [['desktop', 52], ['mobile', 42], ['tablet', 6]]);
      const browser = pick(rnd, [['Chrome', 60], ['Safari', 22], ['Firefox', 8], ['Edge', 10]]);
      const referrer = pick(rnd, [[null, 46], ['google.com', 20], ['github.com', 14], ['linkedin.com', 10], ['instagram.com', 7], ['t.co', 3]]);
      const sessionId = `${visitor}-${d}`;
      out.push({ type: 'pageview', path: proj ? `/projects/${proj.slug}` : '/', projectId: proj?.id || null, referrer, visitorId: visitor, sessionId, device, browser, createdAt });
      if (rnd() < 0.13) {
        out.push({ type: 'click', path: proj ? `/projects/${proj.slug}` : '/', projectId: proj?.id || null, label: pick(rnd, [['Repository', 30], ['Production', 22], ['Email', 18], ['GitHub', 16], ['LinkedIn', 10], ['Demo', 4]]), visitorId: visitor, sessionId, device, browser, createdAt });
      }
    }
  }
  return out;
}

function summarize(events, days, tz, projects) {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  const dayKey = (iso) => fmt.format(new Date(iso));
  const keys = [];
  for (let i = days - 1; i >= 0; i--) keys.push(fmt.format(new Date(Date.now() - i * 86400000)));
  const prevKeys = new Set();
  for (let i = days * 2 - 1; i >= days; i--) prevKeys.add(fmt.format(new Date(Date.now() - i * 86400000)));
  const inRange = new Set(keys);

  const daily = new Map(keys.map((k) => [k, { views: 0, vis: new Set() }]));
  const cur = { views: 0, vis: new Set(), sess: new Set(), clicks: 0 };
  const prev = { views: 0, vis: new Set() };
  const bump = (m, k, by = 1) => m.set(k, (m.get(k) || 0) + by);
  const pages = new Map(), refs = new Map(), devs = new Map(), brows = new Map(), clicks = new Map();
  const pv = new Map(), pc = new Map();

  for (const e of events) {
    const k = dayKey(e.createdAt);
    if (inRange.has(k)) {
      if (e.type === 'pageview') {
        cur.views++; cur.vis.add(e.visitorId); cur.sess.add(e.sessionId);
        const d = daily.get(k); d.views++; d.vis.add(e.visitorId);
        bump(pages, e.path); bump(refs, e.referrer || 'Direct'); bump(devs, e.device || 'desktop'); bump(brows, e.browser || 'Other');
        if (e.projectId) bump(pv, e.projectId);
      } else if (e.type === 'click') {
        cur.clicks++; bump(clicks, e.label || 'Link');
        if (e.projectId) bump(pc, e.projectId);
      }
    } else if (prevKeys.has(k) && e.type === 'pageview') {
      prev.views++; prev.vis.add(e.visitorId);
    }
  }
  const top = (m, n = 8, kk = 'name') => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, count]) => ({ [kk]: name, count }));
  const byId = new Map(projects.map((p) => [p.id, p]));
  return {
    days,
    totals: { views: cur.views, visitors: cur.vis.size, sessions: cur.sess.size, clicks: cur.clicks },
    prev: { views: prev.views, visitors: prev.vis.size },
    daily: keys.map((k) => ({ day: k, views: daily.get(k).views, visitors: daily.get(k).vis.size })),
    pages: [...pages].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([path, views]) => ({ path, views })),
    projects: [...pv].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id, views]) => ({ id, title: byId.get(id)?.title || 'Deleted project', slug: byId.get(id)?.slug || '', views, clicks: pc.get(id) || 0 })),
    referrers: top(refs, 6), devices: top(devs, 4), browsers: top(brows, 5),
    clicks: top(clicks, 8, 'label'),
  };
}

// ---------- store ----------
export function createDemoApi() {
  let db = null;
  let sess = null;
  const listeners = new Set();

  function load() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (raw) { db = JSON.parse(raw); return; }
    } catch {}
    const projects = seedProjects();
    db = {
      content: {},
      projects,
      events: [],
      logs: [
        { id: uid(), createdAt: new Date(Date.now() - 86400000 * 3).toISOString(), actor: DEMO_EMAIL, action: 'update', entity: 'project', entityId: projects[0].id, summary: `Updated project “${projects[0].title}”` },
        { id: uid(), createdAt: new Date(Date.now() - 86400000 * 1).toISOString(), actor: DEMO_EMAIL, action: 'create', entity: 'project', entityId: projects[3].id, summary: `Created project “${projects[3].title}”` },
      ],
    };
    persist();
  }
  function persist() {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(db));
    } catch {
      throw new Error('Browser storage is full (demo mode). Remove some images and try again.');
    }
  }
  const log = (action, entity, entityId, summary) => {
    db.logs.unshift({ id: uid(), createdAt: new Date().toISOString(), actor: sess?.email || 'system', action, entity, entityId, summary });
    db.logs = db.logs.slice(0, 300);
  };
  const shape = (p) => {
    const images = p.images.map((i) => ({ ...i }));
    return { ...p, images, links: p.links.map((l) => ({ ...l })), cover: images.find((i) => i.isCover) || images[0] || null };
  };
  const toDataUrl = (blob) =>
    new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => rej(r.error);
      r.readAsDataURL(blob);
    });
  const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms));
  const emit = () => listeners.forEach((cb) => cb(api.session()));

  const api = {
    mode: 'demo',
    async init() {
      load();
      try { sess = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { sess = null; }
    },
    session: () => (sess ? { ...sess } : null),
    isAdmin: () => !!sess,
    onAuthChange(cb) { listeners.add(cb); return () => listeners.delete(cb); },

    async signIn(email, password) {
      await delay(350);
      if (String(email).trim().toLowerCase() !== DEMO_EMAIL || password !== DEMO_PASSWORD) {
        throw new ApiError('Invalid login credentials', 400);
      }
      sess = { id: 'demo-admin', email: DEMO_EMAIL };
      localStorage.setItem(SESSION_KEY, JSON.stringify(sess));
      log('login', 'auth', null, 'Signed in');
      persist();
      emit();
      return api.session();
    },
    async signOut() {
      log('logout', 'auth', null, 'Signed out');
      persist();
      sess = null;
      localStorage.removeItem(SESSION_KEY);
      emit();
    },

    async getContent() { return mergeContent(db.content); },
    async saveContent(k, value) {
      if (!CONTENT_KEYS.includes(k)) throw new Error('Unknown content key');
      db.content[k] = value;
      log('update', 'site', k, `Updated site content “${k}”`);
      persist();
    },

    async listProjects({ all = false } = {}) {
      await delay(60);
      return db.projects.filter((p) => all || p.status === 'published').sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(shape);
    },
    async getProject({ slug, id }) {
      await delay(40);
      const p = db.projects.find((x) => (id ? x.id === id : x.slug === slug));
      if (!p) return null;
      if (p.status !== 'published' && !sess) return null;
      return shape(p);
    },
    async saveProject(draft) {
      await delay(250);
      const id = draft.id || uid();
      if (db.projects.some((p) => p.slug === draft.slug && p.id !== id)) throw new ApiError('That slug is already used by another project.', 409, '23505');
      const images = [];
      for (const img of draft.images) {
        let url = img.url, path = img.path;
        if (img.blob) { url = await toDataUrl(img.blob); path = `demo:${img.id}`; }
        images.push({ id: img.id, path, url, isCover: !!img.isCover, width: img.width || null, height: img.height || null });
      }
      const now = new Date().toISOString();
      const existing = db.projects.find((p) => p.id === id);
      const next = {
        id, slug: draft.slug, title: draft.title, shortDescription: draft.shortDescription, fullDescription: draft.fullDescription,
        status: draft.status, imageRatio: draft.imageRatio, images,
        links: draft.links.map((l) => ({ id: uid(), type: l.type, label: l.label || '', url: l.url })),
        createdAt: existing?.createdAt || now, updatedAt: now,
      };
      if (existing) db.projects[db.projects.indexOf(existing)] = next; else db.projects.push(next);
      log(existing ? 'update' : 'create', 'project', id, `${existing ? 'Updated' : 'Created'} project “${next.title}”`);
      persist();
      return id;
    },
    async deleteProject(project) {
      db.projects = db.projects.filter((p) => p.id !== project.id);
      log('delete', 'project', project.id, `Deleted project “${project.title}”`);
      persist();
    },

    async uploadMedia(blob) {
      const url = await toDataUrl(blob);
      return { path: `demo:${uid()}`, url };
    },
    async deleteMedia() {},
    mediaUrl: (p) => p,

    async track(evt) {
      db.events.push({
        type: evt.type, path: evt.path, projectId: evt.projectId || null, referrer: evt.referrer || null,
        visitorId: evt.visitorId, sessionId: evt.sessionId, device: evt.device, browser: evt.browser,
        label: evt.label || null, createdAt: new Date().toISOString(),
      });
      db.events = db.events.slice(-2000);
      try { persist(); } catch {}
    },
    async analytics({ days = 30, tz = 'UTC' } = {}) {
      await delay(120);
      const events = [...seedEvents(db.projects), ...db.events];
      return summarize(events, days, tz, db.projects);
    },
    async logs({ limit = 50, before } = {}) {
      await delay(60);
      return db.logs.filter((l) => !before || l.createdAt < before).slice(0, limit);
    },
    async logAuth() {},
  };
  return api;
}
