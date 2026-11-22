import { api, isDemo } from './data/api.js';
import { route, startRouter, navigate } from './lib/router.js';
import { initShell, applyShell } from './lib/shell.js';
import { trackClick } from './lib/track.js';
import { homePage } from './pages/home.js';
import { projectPage, notFound } from './pages/project.js';

// ---------- rute publik ----------
route('/', homePage, { shell: 'public' });
route('/projects/:slug', projectPage, { shell: 'public' });
route('/404', (view) => notFound(view), { shell: 'public' });

// ---------- rute admin ----------
const needAdmin = ({ path }) => (api.isAdmin() ? null : `/admin?next=${encodeURIComponent(path)}`);
const admin = (path, loader) =>
  route(path, async (view, ctx) => (await loader()).default(view, ctx), { shell: 'admin', redirect: needAdmin });

route('/admin', async (view, ctx) => (await import('./admin/login.js')).default(view, ctx), {
  shell: 'public',
  redirect: () => (api.isAdmin() ? '/admin/dashboard' : null),
});
admin('/admin/dashboard', () => import('./admin/dashboard.js'));
admin('/admin/analytics', () => import('./admin/analytics.js'));
admin('/admin/logs', () => import('./admin/logs.js'));
admin('/admin/projects', () => import('./admin/projects.js'));
admin('/admin/projects/new', () => import('./admin/editor.js'));
admin('/admin/projects/:id', () => import('./admin/editor.js'));
admin('/admin/home', () => import('./admin/content.js').then((m) => ({ default: m.homeEditor })));
admin('/admin/about', () => import('./admin/content.js').then((m) => ({ default: m.aboutEditor })));
admin('/admin/contact', () => import('./admin/content.js').then((m) => ({ default: m.contactEditor })));

// ---------- jalan pintas rahasia (1-1-2-2-1-2 pada kucing) ----------
window.addEventListener('pe:secret-admin', () => {
  navigate('/admin');
});

// ---------- klik pada tautan yang ditandai -> analitik ----------
document.addEventListener('click', (e) => {
  const el = e.target.closest?.('[data-track]');
  if (!el) return;
  const pid = el.closest('[data-project]')?.dataset.project || null;
  trackClick(el.dataset.track, el.href || '', location.pathname, pid);
});

// ---------- start ----------
(async function boot() {
  try {
    await api.init();
  } catch (err) {
    console.error(err);
  }
  initShell();
  await startRouter({ shell: applyShell });
  if (isDemo) console.info('%cPara Engineer · demo mode', 'color:#2563eb;font-weight:700', '— isi js/config.js untuk memakai Supabase.');
})();