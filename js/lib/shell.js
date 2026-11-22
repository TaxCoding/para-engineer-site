// Kerangka halaman: Sticky Topbar di publik (tanpa sidebar & tanpa link admin),
// Sidebar docked kiri khusus saat di /admin/*, serta Laci Inventory kucing.
import { api, getContentCached } from '../data/api.js';
import { mergeContent } from '../data/defaults.js';
import { icon } from './icons.js';
import { esc, $, $$, toast, copyText } from './util.js';
import { initCats } from './cats.js';
import { navigate } from './router.js';

const sidebar = () => document.getElementById('leftSidebar');
const drawer = () => document.getElementById('inventoryDrawer');
const btnInv = () => document.getElementById('inventoryBtn');
const topNav = () => document.getElementById('topNav');
const mobileNav = () => document.getElementById('mobileNavDrawer');
const mobileNavBtn = () => document.getElementById('mobileNavBtn');
const headerCtaSlot = () => document.getElementById('headerCtaSlot');

let built = { drawer: false };
let drawerOpen = false;
let lastContent = mergeContent({});

export function socialButtons(content, { onlyContact = false } = {}) {
  const c = content || lastContent;
  const list = c.socials.filter((s) => s.url && (!onlyContact || s.showInContact));
  const items = list
    .map(
      (s) => `
      <a class="social-btn" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer" data-track="${esc(s.name)}">
        ${icon(s.type)}<span>${esc(s.name)}</span>
      </a>`
    )
    .join('');
  const email = c.contact.email
    ? `<a class="social-btn icon-only js-email-btn" href="mailto:${esc(c.contact.email)}" title="${esc(c.contact.email)}" aria-label="Email ${esc(c.contact.email)}" data-track="Email">${icon('mail')}</a>`
    : '';
  return items + email;
}

export function setSidebarOpen(open) {
  document.body.classList.toggle('sidebar-open', open);
  document.getElementById('sidebarBackdrop')?.classList.toggle('show', open && window.innerWidth < 768);
}

function setMobileNavOpen(open) {
  mobileNav()?.classList.toggle('open', open);
  mobileNavBtn()?.setAttribute('aria-expanded', open ? 'true' : 'false');
}

export function openDrawer() {
  const d = drawer(), b = btnInv();
  if (drawerOpen || !d || !b) return;
  drawerOpen = true;
  setMobileNavOpen(false);
  d.classList.remove('closing');
  d.classList.add('open');
  d.setAttribute('aria-hidden', 'false');
  b.classList.add('active');
  b.setAttribute('aria-expanded', 'true');
}

export function closeDrawer() {
  const d = drawer(), b = btnInv();
  if (!drawerOpen || !d || !b) return;
  drawerOpen = false;
  b.classList.remove('active');
  b.setAttribute('aria-expanded', 'false');
  d.setAttribute('aria-hidden', 'true');
  d.classList.remove('open');
  d.classList.add('closing');
  d.addEventListener('animationend', () => { if (!drawerOpen) d.classList.remove('closing'); }, { once: true });
}

function buildDrawer() {
  if (built.drawer) return;
  built.drawer = true;
  drawer().innerHTML = `
    <div class="drawer-header"><span>Inventory</span><small>pat at your own risk</small></div>
    <div class="drawer-cats">
      <div class="drawer-cat-slot tilt-left">
        <div class="cat-interactive protected-zone" data-cat="1" data-sound="/assets/miaw.mp3">
          <div class="cat-shadow" aria-hidden="true"></div>
          <div class="cat-visual"><img src="/assets/cat-1.png" alt="Cat 1" draggable="false" /><div class="photo-shield" aria-hidden="true"></div></div>
        </div>
      </div>
      <div class="drawer-cat-slot tilt-right">
        <div class="cat-interactive protected-zone" data-cat="2" data-sound="/assets/blublub.mp3">
          <div class="cat-shadow" aria-hidden="true"></div>
          <div class="cat-visual"><img src="/assets/cat-2.png" alt="Cat 2" draggable="false" /><div class="photo-shield" aria-hidden="true"></div></div>
        </div>
      </div>
    </div>
    <div class="drawer-divider"></div>
    <nav class="social-links compact" data-social-slot aria-label="Contact Links"></nav>
    <p class="drawer-license" data-license></p>`;
  initCats(drawer());
}

function renderDrawerContent(content) {
  const slot = $('[data-social-slot]', drawer());
  if (slot) slot.innerHTML = socialButtons(content);
  const lic = $('[data-license]', drawer());
  if (lic) lic.textContent = `© ${new Date().getFullYear()} ${content.site.owner} · ${content.site.license}`;
}

const PUBLIC_NAV = [
  ['top', '/', 'Home'],
  ['projects', '/#projects', 'Projects'],
  ['about', '/#about', 'About'],
  ['contact', '/#contact', 'Contact'],
];

function renderPublicTopbar(content) {
  const linksHtml = PUBLIC_NAV.map(
    ([key, href, label]) => `<a class="top-nav-link" data-nav="${key}" href="${href}">${label}</a>`
  ).join('');

  if (topNav()) topNav().innerHTML = linksHtml;
  if (mobileNav()) mobileNav().innerHTML = linksHtml;
  if (headerCtaSlot()) {
    headerCtaSlot().innerHTML = content.contact.email
      ? `<a class="say-hi-btn js-email-btn" href="mailto:${esc(content.contact.email)}" data-track="Header email">${icon('mail')}<span>Say hi</span></a>`
      : '';
  }
}

const ADMIN_NAV = [
  ['Overview', [
    ['/admin/dashboard', 'Dashboard', 'layout'],
    ['/admin/analytics', 'Analytics', 'chart'],
    ['/admin/logs', 'Activity log', 'list'],
  ]],
  ['Content', [
    ['/admin/projects', 'Projects', 'folder'],
    ['/admin/home', 'Home', 'home'],
    ['/admin/about', 'About', 'info'],
    ['/admin/contact', 'Social & contact', 'at'],
  ]],
];

function adminSidebar() {
  const s = api.session();
  return `
    <div class="left-sidebar-top">
      <button type="button" class="icon-btn mobile-only-btn" id="closeSidebarBtn" aria-label="Close sidebar">${icon('panel')}</button>
      <a class="new-chat-btn" href="/">${icon('arrowLeft')}<span>View site</span></a>
    </div>
    <div class="left-sidebar-body">
      ${ADMIN_NAV.map(
        ([title, items]) => `
        <span class="sidebar-section-title">${title}</span>
        <nav class="side-nav">${items
          .map(([href, label, ic]) => `<a class="side-link" data-path="${href}" href="${href}">${icon(ic)}<span>${label}</span></a>`)
          .join('')}</nav>`
      ).join('')}
      ${api.mode === 'demo' ? '<p class="history-empty demo-note">Demo mode: data lives only in this browser. Add your Supabase keys in <code>js/config.js</code> to go live.</p>' : ''}
    </div>
    <div class="left-sidebar-bottom">
      <button type="button" class="fake-login-card" id="signOutBtn">
        <span class="avatar-circle">${icon('logout')}</span>
        <span class="login-meta"><strong>Sign out</strong><small>${esc(s?.email || '')}</small></span>
      </button>
    </div>`;
}

export function setActiveNav(key) {
  $$('#topNav [data-nav], #mobileNavDrawer [data-nav]').forEach((a) =>
    a.classList.toggle('active', a.dataset.nav === key)
  );
}

function markActive(route) {
  const sb = sidebar();
  $$('.side-link', sb).forEach((a) => a.classList.remove('active'));
  const path = route.path;

  if (route.opts.shell === 'admin') {
    $$('[data-path]', sb).forEach((a) =>
      a.classList.toggle('active', path === a.dataset.path || path.startsWith(a.dataset.path + '/'))
    );
  } else if (path.startsWith('/projects/')) {
    setActiveNav('projects');
  } else if (path === '/') {
    setActiveNav(route.hash ? route.hash.slice(1) : 'top');
  } else {
    setActiveNav('');
  }
}

export async function applyShell(route) {
  const kind = route.opts.shell === 'admin' ? 'admin' : 'public';
  const content = await getContentCached().catch(() => mergeContent({}));
  lastContent = content;

  document.body.classList.toggle('shell-admin', kind === 'admin');
  document.body.classList.toggle('shell-public', kind === 'public');

  const sb = sidebar();
  if (kind === 'admin') {
    const scroll = $('.left-sidebar-body', sb)?.scrollTop || 0;
    sb.innerHTML = adminSidebar();
    const body = $('.left-sidebar-body', sb);
    if (body) body.scrollTop = scroll;
    if (window.innerWidth >= 768) setSidebarOpen(true);
    else setSidebarOpen(false);
  } else {
    sb.innerHTML = '';
    setSidebarOpen(false);
    renderPublicTopbar(content);
  }

  document.getElementById('brandName').textContent = content.site.name;
  buildDrawer();
  renderDrawerContent(content);
  markActive(route);
  setMobileNavOpen(false);

  if (kind === 'admin') setInventoryReady(false);
  else if (route.path !== '/') setInventoryReady(true);
  else setInventoryReady(window.scrollY > window.innerHeight * 0.45);

  closeDrawer();
}

let ready = false;
export function setInventoryReady(on) {
  if (on === ready) return;
  ready = on;
  document.body.classList.toggle('inventory-ready', on);
  const b = btnInv();
  if (on && b) {
    b.classList.remove('caught-bounce');
    void b.offsetWidth;
    b.classList.add('caught-bounce');
  } else closeDrawer();
}

export function initShell() {
  document.getElementById('openSidebarBtn')?.addEventListener('click', () => {
    setSidebarOpen(!document.body.classList.contains('sidebar-open'));
  });
  document.getElementById('sidebarBackdrop')?.addEventListener('click', () => setSidebarOpen(false));

  mobileNavBtn()?.addEventListener('click', (e) => {
    e.stopPropagation();
    setMobileNavOpen(!mobileNav()?.classList.contains('open'));
  });

  const b = btnInv();
  b?.addEventListener('click', (e) => {
    e.stopPropagation();
    drawerOpen ? closeDrawer() : openDrawer();
  });

  document.addEventListener('pointerdown', (e) => {
    if (drawerOpen && !drawer().contains(e.target) && !b.contains(e.target)) closeDrawer();
    if (mobileNav()?.classList.contains('open') && !mobileNav().contains(e.target) && !mobileNavBtn().contains(e.target)) {
      setMobileNavOpen(false);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeDrawer();
      setMobileNavOpen(false);
    }
  });

  document.addEventListener('click', async (e) => {
    if (e.target.closest('#closeSidebarBtn')) setSidebarOpen(false);
    if (e.target.closest('#mobileNavDrawer a')) setMobileNavOpen(false);
    if (e.target.closest('#signOutBtn')) {
      await api.signOut();
      toast('Signed out');
      navigate('/admin');
    }
    const mail = e.target.closest('.js-email-btn');
    if (mail) {
      const addr = lastContent.contact.email;
      if (addr && (await copyText(addr))) toast(`Email copied: ${addr}`);
    }
  });
}