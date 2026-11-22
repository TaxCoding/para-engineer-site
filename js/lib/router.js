// Router History API ringan dengan transisi halus + halaman error dinamis.
import { sleep } from './util.js';
import { errorPage } from '../pages/error.js';

const routes = [];
let current = null;
let renderToken = 0;
let cleanup = null;
let onShell = () => {};

export const guard = { fn: null }; // fn(): boolean | Promise<boolean> -> false = batalkan navigasi

function normalizePath(pathname) {
  if (!pathname || pathname === '/index.html') return '/';
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
}

export function route(pattern, handler, opts = {}) {
  const keys = [];
  const cleanPattern = normalizePath(pattern);
  const re = new RegExp(
    '^' +
      (cleanPattern === '/'
        ? '/'
        : cleanPattern.replace(/\/:([a-zA-Z]+)/g, (_, k) => {
            keys.push(k);
            return '/([^/]+)';
          })) +
      '/?$'
  );
  routes.push({ re, keys, handler, opts, pattern: cleanPattern });
}

function match(pathname) {
  const clean = normalizePath(pathname);
  for (const r of routes) {
    const m = r.re.exec(clean);
    if (m) {
      const params = {};
      r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
      return { route: r, params, path: clean };
    }
  }
  return null;
}

export const getPath = () => normalizePath(location.pathname);
export const getCurrent = () => current;

export async function navigate(to, { replace = false, force = false } = {}) {
  const url = new URL(to, location.origin);
  if (url.origin !== location.origin) {
    location.href = to;
    return;
  }
  const targetPath = normalizePath(url.pathname);
  const currentPath = normalizePath(location.pathname);
  const samePath = targetPath === currentPath;

  if (!force && guard.fn && !samePath && (await guard.fn()) === false) return;

  if (samePath && !force) {
    if (url.search === location.search) {
      if (url.hash !== location.hash) history.pushState({}, '', targetPath + url.search + url.hash);
      scrollToHash(url.hash);
      return;
    }
  }
  history[replace ? 'replaceState' : 'pushState']({}, '', targetPath + url.search + url.hash);
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

async function render(isNav, depth = 0) {
  const token = ++renderToken;
  const view = document.getElementById('view');
  const reqPath = normalizePath(location.pathname);

  let m = match(reqPath);
  let routeError = null;

  if (!m) {
    routeError = {
      code: 404,
      title: 'Halaman tidak ditemukan.',
      reason: `Alamat "${location.pathname}" tidak terdaftar atau halaman sudah dipindahkan.`,
    };
    m = match('/404');
  }

  // Pengalihan (mis. belum login -> /admin?next=...)
  if (m && depth < 4) {
    const to = m.route.opts.redirect?.({
      params: m.params,
      query: new URLSearchParams(location.search),
      path: reqPath,
    });
    if (to) {
      history.replaceState({}, '', to);
      return render(isNav, depth + 1);
    }
  }

  if (isNav && view.children.length) {
    view.classList.add('view-leave');
    await sleep(140);
    if (token !== renderToken) return;
  }
  if (cleanup) {
    try { cleanup(); } catch {}
    cleanup = null;
  }

  const ctx = {
    params: m?.params || {},
    query: new URLSearchParams(location.search),
    hash: location.hash,
    path: reqPath,
    error: routeError,
  };
  current = { ...ctx, opts: m?.route.opts || { shell: 'public' }, pattern: m?.route.pattern || '/404' };

  await onShell(current);
  if (token !== renderToken) return;

  view.classList.remove('view-leave');
  view.innerHTML = '';
  window.scrollTo({ top: 0, behavior: 'auto' });
  view.classList.remove('view-enter');
  void view.offsetWidth;
  view.classList.add('view-enter');

  try {
    if (!m) {
      errorPage(view, routeError || { code: 404 });
    } else {
      const res = await m.route.handler(view, ctx);
      if (token !== renderToken) {
        if (typeof res === 'function') res();
        return;
      }
      cleanup = typeof res === 'function' ? res : null;
    }
  } catch (err) {
    console.error(err);
    const code = err?.status || (navigator.onLine === false ? 'OFFLINE' : 500);
    const reason =
      navigator.onLine === false
        ? 'Koneksi internetmu terputus. Periksa jaringan lalu coba muat ulang.'
        : err?.message || 'Terjadi kesalahan internal saat memuat halaman ini.';
    errorPage(view, {
      code,
      reason,
      actionHref: code === 401 || code === 403 ? '/admin' : '/',
      actionLabel: code === 401 || code === 403 ? 'Sign in' : 'Back home',
    });
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