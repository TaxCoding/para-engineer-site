// Editor konten situs: Home, About, Social & Contact.
// Disimpan di tabel site_content (key → JSON) sehingga publik langsung ikut berubah.
import { api, invalidate, getContentCached } from '../data/api.js';
import { SOCIAL_TYPES, icon } from '../lib/icons.js';
import { esc, $, $$, uid, normalizeUrl, toast } from '../lib/util.js';
import { pageHead, adminMeta, busy, useDirtyGuard } from './ui.js';
import { cropImage } from './cropper.js';

const val = (v) => esc(v ?? '');

async function load(view) {
  try {
    return await api.getContent();
  } catch (e) {
    view.innerHTML = `<section class="admin-page"><div class="callout danger">${icon('info')}<span><strong>Could not load the content.</strong> ${esc(e.message)}</span></div></section>`;
    return null;
  }
}

function shell(title, sub, body) {
  return `<section class="admin-page">
    ${pageHead(title, sub, `<span class="dirty-dot">Unsaved changes</span><a class="btn" href="/" target="_blank" rel="noopener">${icon('external')}View site</a><button class="btn primary" id="saveBtn" type="button">${icon('save')}Save changes</button>`)}
    ${body}
  </section>`;
}

function wire(view, onSave) {
  const g = useDirtyGuard(view);
  view.addEventListener('input', g.mark);
  view.addEventListener('change', g.mark);
  const btn = $('#saveBtn', view);
  const run = async () => {
    try {
      const ok = await busy(btn, onSave);
      if (ok === false) return;
      invalidate();
      await getContentCached().catch(() => {});
      g.clear();
      toast('Saved — the site is updated');
    } catch (e) {
      console.error(e);
      toast(e.message || 'Could not save.', 'error');
    }
  };
  btn.addEventListener('click', run);
  const onKey = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); run(); }
  };
  document.addEventListener('keydown', onKey);
  return { g, dispose() { g.dispose(); document.removeEventListener('keydown', onKey); } };
}

const field = (id, label, value, { hint = '', textarea = false, rows, max } = {}) => `
  <div class="field">
    <label for="${id}">${label}</label>
    ${textarea ? `<textarea class="textarea" id="${id}" ${rows ? `style="min-height:${rows * 1.7}rem"` : ''} ${max ? `maxlength="${max}"` : ''}>${val(value)}</textarea>` : `<input class="input" id="${id}" value="${val(value)}" ${max ? `maxlength="${max}"` : ''} />`}
    ${hint ? `<span class="hint">${hint}</span>` : ''}
  </div>`;

// ---------------------------------------------------------------
// HOME
// ---------------------------------------------------------------
export async function homeEditor(view) {
  adminMeta('Home');
  const c = await load(view);
  if (!c) return;
  const h = c.home, s = c.site;
  view.innerHTML = shell('Home', 'The first thing visitors see, plus the section titles and footer.', `
    <div class="panel">
      <div class="panel-head"><div><div class="panel-title">Hero</div><div class="panel-sub">Headline and intro under the two cats.</div></div></div>
      <div class="stack">
        ${field('headline', 'Headline', h.headline, { max: 90 })}
        ${field('subtitle', 'Intro text', h.subtitle, { textarea: true, rows: 3, max: 260 })}
        <div class="row">${field('primaryCta', 'Primary button', h.primaryCta, { max: 30 })}${field('secondaryCta', 'Secondary button', h.secondaryCta, { max: 30 })}</div>
      </div>
    </div>
    <div class="panel">
      <div class="panel-head"><div><div class="panel-title">Sections</div><div class="panel-sub">Titles above the projects and social media blocks.</div></div></div>
      <div class="stack">
        <div class="row">${field('projectsTitle', 'Projects title', h.projectsTitle, { max: 40 })}${field('projectsSubtitle', 'Projects subtitle', h.projectsSubtitle, { max: 120 })}</div>
        <div class="row">${field('socialTitle', 'Social title', h.socialTitle, { max: 40 })}${field('socialSubtitle', 'Social subtitle', h.socialSubtitle, { max: 120 })}</div>
      </div>
    </div>
    <div class="panel">
      <div class="panel-head"><div><div class="panel-title">Brand &amp; footer</div><div class="panel-sub">Used in the header, the inventory drawer and the footer.</div></div></div>
      <div class="stack">
        <div class="row">${field('siteName', 'Site name', s.name, { max: 40 })}${field('owner', 'Owner name', s.owner, { max: 60 })}</div>
        <div class="row">${field('license', 'License name', s.license, { max: 40 })}${field('licenseUrl', 'License link', s.licenseUrl)}</div>
      </div>
    </div>`);

  const w = wire(view, async () => {
    const g = (id) => $('#' + id, view).value.trim();
    const lic = normalizeUrl(g('licenseUrl'));
    if (g('licenseUrl') && !lic) return toast('The license link is not a valid URL.', 'error'), false;
    await api.saveContent('home', {
      headline: g('headline'), subtitle: g('subtitle'), primaryCta: g('primaryCta'), secondaryCta: g('secondaryCta'),
      projectsTitle: g('projectsTitle'), projectsSubtitle: g('projectsSubtitle'), socialTitle: g('socialTitle'), socialSubtitle: g('socialSubtitle'),
    });
    await api.saveContent('site', { name: g('siteName') || 'Para Engineer', owner: g('owner'), license: g('license'), licenseUrl: lic || '' });
  });
  return w.dispose;
}

// ---------------------------------------------------------------
// ABOUT
// ---------------------------------------------------------------
export async function aboutEditor(view) {
  adminMeta('About');
  const c = await load(view);
  if (!c) return;
  const a = c.about;
  const P = { url: a.photoUrl || '', path: a.photoPath || '', blob: null, removed: false };

  view.innerHTML = shell('About', 'The about section on the home page.', `
    <div class="panel">
      <div class="panel-head"><div class="panel-title">Photo</div></div>
      <div class="row" style="align-items:center">
        <div id="photoBox" style="width:108px;height:108px;border-radius:22px;overflow:hidden;border:1.5px solid var(--blue-200);background:var(--surface);flex:0 0 auto"></div>
        <div class="stack" style="gap:.5rem">
          <div class="row"><button class="btn" id="pickPhoto" type="button">${icon('upload')}Upload photo</button><button class="btn danger" id="rmPhoto" type="button">${icon('trash')}Remove</button></div>
          <span class="hint">Optional. Square crop, shown next to your text.</span>
          <input type="file" id="photoInput" accept="image/*" hidden />
        </div>
      </div>
    </div>
    <div class="panel">
      <div class="stack">
        ${field('aboutTitle', 'Section label', a.title, { max: 30, hint: 'Small blue label above your name.' })}
        ${field('aboutBody', 'Story', a.body, { textarea: true, rows: 9, hint: 'Blank line = new paragraph · <code>- item</code> = bullet · <code>**bold**</code>.' })}
        ${field('skills', 'Skills / topics', (a.skills || []).join(', '), { hint: 'Separate with commas. They appear as small pills.' })}
      </div>
    </div>`);

  const paintPhoto = () => {
    $('#photoBox', view).innerHTML = P.url ? `<img src="${esc(P.url)}" alt="" style="width:100%;height:100%;object-fit:cover" />` : `<div class="media-empty" style="color:var(--blue-300)">${icon('user')}</div>`;
    $('#rmPhoto', view).hidden = !P.url;
  };
  paintPhoto();

  const w = wire(view, async () => {
    let { url, path } = P;
    const oldPath = a.photoPath;
    if (P.blob) {
      const up = await api.uploadMedia(P.blob, 'site');
      url = up.url; path = up.path;
    } else if (P.removed) { url = ''; path = ''; }
    await api.saveContent('about', {
      title: $('#aboutTitle', view).value.trim() || 'About',
      body: $('#aboutBody', view).value.trim(),
      skills: $('#skills', view).value.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 12),
      photoUrl: url, photoPath: path,
    });
    if (oldPath && oldPath !== path) api.deleteMedia([oldPath]);
    a.photoPath = path;
    P.blob = null; P.removed = false; P.path = path;
  });

  $('#pickPhoto', view).addEventListener('click', () => $('#photoInput', view).click());
  $('#photoInput', view).addEventListener('change', async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const res = await cropImage(f, { ratio: '1:1', title: 'Crop photo' });
    if (!res || res === 'abort') return;
    if (P.blob) URL.revokeObjectURL(P.url);
    P.blob = res.blob; P.url = URL.createObjectURL(res.blob); P.removed = false;
    paintPhoto();
    w.g.mark();
  });
  $('#rmPhoto', view).addEventListener('click', () => {
    if (P.blob) URL.revokeObjectURL(P.url);
    P.blob = null; P.url = ''; P.removed = true;
    paintPhoto();
    w.g.mark();
  });
  return w.dispose;
}

// ---------------------------------------------------------------
// SOCIAL & CONTACT
// ---------------------------------------------------------------
export async function contactEditor(view) {
  adminMeta('Social & contact');
  const c = await load(view);
  if (!c) return;
  const socials = c.socials.map((s) => ({ ...s, id: s.id || uid() }));

  view.innerHTML = shell('Social & contact', 'Links shown on the home page, the drawer and the project contact section.', `
    <div class="panel">
      <div class="panel-head"><div><div class="panel-title">Contact</div><div class="panel-sub">The “Interested in this project?” block at the end of every project page.</div></div></div>
      <div class="stack">
        ${field('email', 'Contact email', c.contact.email, { hint: 'Shown as an email button. Clicking it copies the address and opens the mail app.' })}
        ${field('ctaTitle', 'Heading', c.contact.ctaTitle, { max: 80 })}
        ${field('ctaText', 'Text', c.contact.ctaText, { textarea: true, rows: 2, max: 200 })}
      </div>
    </div>
    <div class="panel">
      <div class="panel-head">
        <div><div class="panel-title">Social media &amp; official contacts</div><div class="panel-sub">Tick “Contact button” to also show a link in each project's contact block.</div></div>
        <button class="btn sm" id="addSocial" type="button">${icon('plus')}Add link</button>
      </div>
      <div id="socials" class="stack" style="gap:.7rem"></div>
    </div>`);

  const list = $('#socials', view);
  function paint() {
    list.innerHTML = socials
      .map(
        (s, i) => `
      <div class="proj-row" style="grid-template-columns:1fr;gap:.6rem" data-i="${i}">
        <div class="row" style="align-items:flex-end">
          <div class="field" style="flex:0 0 170px"><label>Type</label>
            <select class="select" data-f="type">${SOCIAL_TYPES.map(([v, l]) => `<option value="${v}" ${v === s.type ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
          <div class="field" style="flex:0 0 150px"><label>Name</label><input class="input" data-f="name" maxlength="30" value="${val(s.name)}" /></div>
          <div class="field" style="flex:2 1 240px"><label>URL</label><input class="input" data-f="url" inputmode="url" placeholder="https://" value="${val(s.url)}" /></div>
        </div>
        <div class="row" style="align-items:center;justify-content:space-between">
          <label class="switch"><input type="checkbox" data-f="showInContact" ${s.showInContact ? 'checked' : ''} /><span class="track"></span><span>Contact button on projects</span></label>
          <span class="row" style="gap:.3rem">
            <button class="btn sm" type="button" data-act="up" ${i === 0 ? 'disabled' : ''} aria-label="Move up">${icon('arrowUp')}</button>
            <button class="btn sm" type="button" data-act="down" ${i === socials.length - 1 ? 'disabled' : ''} aria-label="Move down">${icon('arrowDown')}</button>
            <button class="btn sm danger" type="button" data-act="rm" aria-label="Remove">${icon('trash')}</button>
          </span>
        </div>
      </div>`
      )
      .join('') || '<p class="empty-mini">No links yet.</p>';
  }
  paint();

  list.addEventListener('input', (e) => {
    const row = e.target.closest('[data-i]');
    const f = e.target.dataset.f;
    if (!row || !f) return;
    socials[Number(row.dataset.i)][f] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    e.target.classList?.remove('invalid');
  });
  list.addEventListener('change', (e) => {
    // memilih jenis otomatis mengisi nama bila masih kosong / nama bawaan
    if (e.target.dataset.f !== 'type') return;
    const s = socials[Number(e.target.closest('[data-i]').dataset.i)];
    const label = SOCIAL_TYPES.find(([v]) => v === s.type)?.[1];
    if (!s.name || SOCIAL_TYPES.some(([, l]) => l === s.name)) s.name = label;
    paint();
  });
  list.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const i = Number(b.closest('[data-i]').dataset.i);
    if (b.dataset.act === 'rm') socials.splice(i, 1);
    if (b.dataset.act === 'up' && i > 0) [socials[i - 1], socials[i]] = [socials[i], socials[i - 1]];
    if (b.dataset.act === 'down' && i < socials.length - 1) [socials[i + 1], socials[i]] = [socials[i], socials[i + 1]];
    paint();
    w.g.mark();
  });
  $('#addSocial', view).addEventListener('click', () => {
    socials.push({ id: uid(), type: 'link', name: '', url: '', showInContact: false });
    paint();
    list.lastElementChild?.querySelector('[data-f="name"]')?.focus();
    w.g.mark();
  });

  const w = wire(view, async () => {
    const out = [];
    for (let i = 0; i < socials.length; i++) {
      const s = socials[i];
      if (!s.url.trim() && !s.name.trim()) continue;
      const url = normalizeUrl(s.url);
      if (!url || url.startsWith('mailto:')) {
        const el = list.querySelector(`[data-i="${i}"] [data-f="url"]`);
        el?.classList.add('invalid');
        el?.focus();
        toast(`“${s.name || 'Link'}” needs a valid URL.`, 'error');
        return false;
      }
      out.push({ id: s.id, type: s.type, name: s.name.trim() || SOCIAL_TYPES.find(([v]) => v === s.type)?.[1] || 'Link', url, showInContact: !!s.showInContact });
    }
    const email = $('#email', view).value.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      $('#email', view).classList.add('invalid');
      toast('That email address does not look right.', 'error');
      return false;
    }
    await api.saveContent('socials', out);
    await api.saveContent('contact', { email, ctaTitle: $('#ctaTitle', view).value.trim(), ctaText: $('#ctaText', view).value.trim() });
  });
  return w.dispose;
}
