// Router History API ringan dengan transisi halaman halus.
import { sleep } from './util.js';

const routes = [];
let current = null;
let renderToken = 0;
let cleanup = null;
let onShell = () => {};

export const guard = { fn: null }; // fn(): boolean | Promise<boolean>  → false = batalkan navigasi

export function route(pattern, handler, opts = {}) {
  const keys = [];
  const re = new RegExp(
    '^' +
      pattern.replace(/\/:([a-zA-Z]+)/g, (_, k) => {
        keys.push(k);
        return '/([^/]+)';
      }) +
      '/?$'
  );
  routes.push({ re, keys, handler, opts, pattern });
}

function match(pathname) {
  for (const r of routes) {
    const m = r.re.exec(pathname);
    if (m) {
      const params = {};
      r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
      return { route: r, params };
    }
  }
  return null;
}

export const getPath = () => location.pathname;
export const getCurrent = () => current;

export async function navigate(to, { replace = false, force = false } = {}) {
  const url = new URL(to, location.origin);
  if (url.origin !== location.origin) {
    location.href = to;
    return;
  }
  const samePath = url.pathname === location.pathname;

  if (!force && guard.fn && !samePath && (await guard.fn()) === false) return;

  if (samePath && !force) {
    if (url.search === location.search) {
      // hanya hash: scroll halus
      if (url.hash !== location.hash) history.pushState({}, '', url);
      scrollToHash(url.hash);
      return;
    }
  }
  history[replace ? 'replaceState' : 'pushState']({}, '', url.pathname + url.search + url.hash);
  await render(true);
}

export function scrollToHash(hash, smooth = true) {
  if (!hash || hash === '#') {
    window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
    return;
  }
  const el = document.getElementById(decodeURIComponent(hash.slice(1)));
  if (el) el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
}

async function render(isNav) {
  const token = ++renderToken;
  const view = document.getElementById('view');
  const m = match(location.pathname) || match('/404');
  if (!m) return;

  // pengalihan (mis. halaman admin tanpa login)
  const to = m.route.opts.redirect?.({ params: m.params, query: new URLSearchParams(location.search), path: location.pathname });
  if (to) {
    history.replaceState({}, '', to);
    return render(isNav);
  }

  // transisi keluar
  if (isNav && view.children.length) {
    view.classList.add('view-leave');
    await sleep(140);
    if (token !== renderToken) return;
  }
  if (cleanup) {
    try { cleanup(); } catch {}
    cleanup = null;
  }

  const ctx = { params: m.params, query: new URLSearchParams(location.search), hash: location.hash, path: location.pathname };
  current = { ...ctx, opts: m.route.opts, pattern: m.route.pattern };

  await onShell(current);
  if (token !== renderToken) return;

  view.classList.remove('view-leave');
  view.innerHTML = '';
  window.scrollTo({ top: 0, behavior: 'auto' });
  view.classList.remove('view-enter');
  void view.offsetWidth;
  view.classList.add('view-enter');

  try {
    const res = await m.route.handler(view, ctx);
    if (token !== renderToken) {
      if (typeof res === 'function') res();
      return;
    }
    cleanup = typeof res === 'function' ? res : null;
  } catch (err) {
    console.error(err);
    view.innerHTML = `<section class="wrap narrow state-box"><h1>Something went wrong</h1><p class="muted">${String(err.message || err)}</p><a class="btn" href="/">Back home</a></section>`;
  }

  if (ctx.hash) requestAnimationFrame(() => scrollToHash(ctx.hash, false));
  document.dispatchEvent(new CustomEvent('route:rendered', { detail: current }));
}

export function startRouter({ shell }) {
  onShell = shell;

  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest?.('a[href]');
    if (!a || a.target === '_blank' || a.hasAttribute('download') || a.hasAttribute('data-native')) return;
    const href = a.getAttribute('href');
    if (!href || /^(mailto:|tel:|javascript:)/i.test(href)) return;
    const url = new URL(href, location.href);
    if (url.origin !== location.origin) return;
    e.preventDefault();
    navigate(url.pathname + url.search + url.hash);
  });

  window.addEventListener('popstate', async () => {
    if (guard.fn && (await guard.fn()) === false) {
      history.pushState({}, '', current ? current.path + (current.hash || '') : '/');
      return;
    }
    render(true);
  });

  return render(false);
}

export const refresh = () => render(false);
