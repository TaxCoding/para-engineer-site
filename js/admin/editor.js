import { api, invalidate } from '../data/api.js';
import { RATIOS, ratioCss } from '../data/defaults.js';
import { esc, $, $$, uid, slugify, normalizeUrl, toast, fmtDateTime } from '../lib/util.js';
import { icon, LINK_TYPES } from '../lib/icons.js';
import { navigate, guard } from '../lib/router.js';
import { statusChip } from '../lib/cards.js';
import { adminMeta, busy, confirmDialog, statusSeg, bindSeg } from './ui.js';
import { cropImage } from './cropper.js';

const GROUPS = ['repository', 'production', 'documentation', 'demo'];
const STATUS_HINT = {
  published: 'Visible to everyone on the site.',
  draft: 'Only you can see it (preview while signed in).',
  archived: 'Hidden from the site, kept for your records.',
};

export default async function editor(view, ctx) {
  const isNew = ctx.path === '/admin/projects/new';
  let project = null;
  if (!isNew) {
    try {
      project = await api.getProject({ id: ctx.params.id });
    } catch (e) {
      console.error(e);
    }
    if (!project) {
      adminMeta('Project not found');
      view.innerHTML = `<section class="admin-page"><div class="callout danger">${icon('info')}<span>This project doesn't exist (anymore).</span></div><p style="margin-top:1rem"><a class="btn" href="/admin/projects">${icon('arrowLeft')}Back to projects</a></p></section>`;
      return;
    }
  }
  adminMeta(isNew ? 'New project' : `Edit ${project.title}`);

  // ------------------------------------------------------------------
  // state
  // ------------------------------------------------------------------
  const S = {
    id: project?.id || uid(),
    title: project?.title || '',
    slug: project?.slug || '',
    slugTouched: !isNew,
    shortDescription: project?.shortDescription || '',
    fullDescription: project?.fullDescription || '',
    status: project?.status || 'draft',
    imageRatio: project?.imageRatio || '16:9',
    images: (project?.images || []).map((i) => ({ id: i.id, url: i.url, path: i.path, isCover: i.isCover, width: i.width, height: i.height, blob: null, replacedPath: null })),
    removedPaths: [],
    links: Object.fromEntries(GROUPS.map((g) => [g, (project?.links || []).filter((l) => l.type === g).map((l) => ({ label: l.label, url: l.url }))])),
    prodOn: !!project?.links.some((l) => l.type === 'production'),
    createdAt: project?.createdAt,
    updatedAt: project?.updatedAt,
  };
  if (isNew) S.links.repository.push({ label: '', url: '' });
  if (S.prodOn && !S.links.production.length) S.links.production.push({ label: '', url: '' });

  let dirty = false;
  const markDirty = () => {
    if (dirty) return;
    dirty = true;
    $('#dirty', view)?.classList.add('show');
  };

  const normalizeCover = () => {
    if (!S.images.length) return;
    const idx = S.images.findIndex((i) => i.isCover);
    S.images.forEach((i, n) => (i.isCover = n === (idx === -1 ? 0 : idx)));
  };
  normalizeCover();
  const coverIndex = () => Math.max(0, S.images.findIndex((i) => i.isCover));

  // ------------------------------------------------------------------
  // kerangka halaman
  // ------------------------------------------------------------------
  view.innerHTML = `<section class="admin-page">
    <div class="editor-bar">
      <a class="icon-btn" href="/admin/projects" aria-label="Back to projects">${icon('arrowLeft')}</a>
      <h1 id="barTitle"></h1>
      <span id="barStatus"></span>
      <span class="dirty-dot" id="dirty">Unsaved changes</span>
      <span class="spacer"></span>
      ${!isNew ? `<a class="btn" id="viewBtn" href="/projects/${esc(S.slug)}">${icon('eye')}<span>Preview</span></a>` : ''}
      <button class="btn primary" id="saveBtn" type="button">${icon('save')}Save</button>
    </div>

    <div class="editor-grid">
      <div class="main-col">
        <div class="panel" id="panelImages">
          <div class="panel-head">
            <div><div class="panel-title">Images</div><div class="panel-sub">Upload as many as you like. Each one is cropped before it is saved.</div></div>
          </div>
          <div class="img-tools">
            <button class="btn" id="uploadBtn" type="button">${icon('upload')}Upload images</button>
            <div class="seg" data-seg="ratio" role="radiogroup" aria-label="Image ratio">
              ${RATIOS.map((r) => `<button type="button" role="radio" data-value="${r}" aria-checked="${r === S.imageRatio}" class="${r === S.imageRatio ? 'active' : ''}" style="text-transform:none">${r}</button>`).join('')}
            </div>
            <div class="field" id="thumbField" hidden>
              <label for="thumbNum" style="white-space:nowrap">Thumbnail slide</label>
              <input class="input input-num" id="thumbNum" type="number" min="1" value="1" />
              <span class="hint" id="thumbOf"></span>
            </div>
            <input type="file" id="fileInput" accept="image/*" multiple hidden />
            <input type="file" id="replaceInput" accept="image/*" hidden />
          </div>
          <div class="drop" id="drop" tabindex="0" role="button" aria-label="Add images">
            ${icon('image')}<strong>Drop images here or click to browse</strong>
            <span>PNG, JPG, WebP · you will crop each one next</span>
          </div>
          <div class="img-grid" id="imgGrid"></div>
          <p class="hint" style="margin-top:.7rem">Drag tiles to reorder · ★ sets the thumbnail shown on the home page. With no choice, slide 1 is used.</p>
        </div>

        <div class="panel">
          <div class="panel-head"><div class="panel-title">Details</div></div>
          <div class="stack">
            <div class="field">
              <label for="title">Project title</label>
              <input class="input" id="title" maxlength="120" placeholder="e.g. Mawi — Cat Assistant" value="${esc(S.title)}" />
            </div>
            <div class="field">
              <label for="slug">Page address</label>
              <div class="slug-row"><span>/projects/</span><input class="input" id="slug" maxlength="60" value="${esc(S.slug)}" placeholder="auto-from-title" /></div>
              ${!isNew ? '<span class="hint">Changing this breaks links that were shared before.</span>' : ''}
            </div>
            <div class="field">
              <label for="short">Short description <span class="char-count" id="shortCount"></span></label>
              <textarea class="textarea" id="short" maxlength="200" style="min-height:84px" placeholder="One or two sentences shown on the project card.">${esc(S.shortDescription)}</textarea>
            </div>
            <div class="field">
              <label for="full">Full description</label>
              <textarea class="textarea tall" id="full" placeholder="Tell the whole story: what it is, why you built it, what you learned.">${esc(S.fullDescription)}</textarea>
              <span class="hint">Blank line = new paragraph · <code>- item</code> = bullet · <code>**bold**</code> · <code>\`code\`</code> · links are detected automatically.</span>
            </div>
          </div>
        </div>

        <div class="panel" id="panelLinks"></div>
      </div>

      <aside>
        <div class="panel">
          <div class="panel-head"><div class="panel-title">Publishing</div></div>
          <div class="field">
            <span class="label">Project status</span>
            ${statusSeg(S.status)}
            <span class="hint" id="statusHint"></span>
          </div>
          <div class="meta-list" id="metaList" style="margin-top:1.1rem"></div>
          <div class="side-actions">
            <button class="btn primary" id="saveBtn2" type="button">${icon('save')}Save project</button>
            ${!isNew ? `<button class="btn danger" id="delBtn" type="button">${icon('trash')}Delete project</button>` : ''}
          </div>
        </div>
      </aside>
    </div>
  </section>`;

  // ------------------------------------------------------------------
  // render parsial
  // ------------------------------------------------------------------
  function renderBar() {
    $('#barTitle', view).textContent = S.title.trim() || (isNew ? 'New project' : 'Untitled project');
    $('#barStatus', view).innerHTML = statusChip(S.status);
    $('#statusHint', view).textContent = STATUS_HINT[S.status];
  }

  function renderMeta() {
    $('#metaList', view).innerHTML = isNew
      ? '<div><span>Created</span><b>Not saved yet</b></div>'
      : `<div><span>Created at</span><b>${esc(fmtDateTime(S.createdAt))}</b></div>
         <div><span>Updated at</span><b>${esc(fmtDateTime(S.updatedAt))}</b></div>
         <div><span>Images</span><b>${S.images.length}</b></div>`;
  }

  function renderImages() {
    const grid = $('#imgGrid', view);
    const n = S.images.length;
    grid.style.setProperty('--ratio', ratioCss(S.imageRatio));
    grid.innerHTML = S.images
      .map(
        (im, i) => `
      <div class="img-tile${im.isCover ? ' cover' : ''}" draggable="true" data-i="${i}" style="--ratio:${ratioCss(S.imageRatio)}">
        <img src="${esc(im.url)}" alt="Slide ${i + 1}" />
        <span class="badge">${i + 1}</span>
        <button type="button" class="star" data-act="cover" title="${im.isCover ? 'This is the thumbnail' : 'Use as thumbnail'}" aria-label="Use slide ${i + 1} as thumbnail" aria-pressed="${im.isCover}">${icon(im.isCover ? 'starFill' : 'star')}</button>
        ${im.isCover ? '<span class="tag-cover">Thumbnail</span>' : ''}
        ${im.blob ? '<span class="tag-new">New</span>' : ''}
        <div class="tools">
          <button type="button" data-act="left" title="Move earlier" aria-label="Move earlier" ${i === 0 ? 'disabled' : ''}>${icon('chevLeft')}</button>
          <button type="button" data-act="right" title="Move later" aria-label="Move later" ${i === n - 1 ? 'disabled' : ''}>${icon('chevRight')}</button>
          <button type="button" data-act="crop" title="Crop" aria-label="Crop">${icon('crop')}</button>
          <button type="button" data-act="replace" title="Replace" aria-label="Replace image">${icon('replace')}</button>
          <button type="button" class="del" data-act="delete" title="Delete" aria-label="Delete image">${icon('trash')}</button>
        </div>
      </div>`
      )
      .join('');
    const tf = $('#thumbField', view);
    tf.hidden = n === 0;
    const num = $('#thumbNum', view);
    num.max = n || 1;
    num.value = coverIndex() + 1;
    $('#thumbOf', view).textContent = `of ${n}`;
    $('#drop', view).style.padding = n ? '0.9rem 1rem' : '';
  }

  function linkRow(g, i, l) {
    return `<div class="link-row" data-g="${g}" data-i="${i}">
      <input class="input label-input" data-f="label" maxlength="60" placeholder="Label (optional)" value="${esc(l.label)}" aria-label="${LINK_TYPES[g].label} label" />
      <input class="input" data-f="url" inputmode="url" placeholder="${esc(LINK_TYPES[g].hint)}" value="${esc(l.url)}" aria-label="${LINK_TYPES[g].label} URL" />
      <button type="button" class="icon-btn" data-act="rm-link" title="Remove" aria-label="Remove link">${icon('x')}</button>
    </div>`;
  }

  function renderLinks() {
    const panel = $('#panelLinks', view);
    panel.innerHTML = `
      <div class="panel-head"><div><div class="panel-title">Links</div><div class="panel-sub">Repository and deployments are kept apart. Add as many as the project needs.</div></div></div>
      ${GROUPS.map((g) => {
        const t = LINK_TYPES[g];
        const rows = S.links[g];
        const isProd = g === 'production';
        return `<div class="links-group" data-group="${g}">
          <div class="lg-head">
            <span class="lg-title"><span class="lc-icon">${icon(t.icon)}</span>${t.label}</span>
            ${
              isProd
                ? `<label class="switch"><input type="checkbox" id="prodSwitch" ${S.prodOn ? 'checked' : ''} /><span class="track"></span><span>Deployed to production</span></label>`
                : `<button type="button" class="btn sm" data-act="add-link" data-g="${g}">${icon('plus')}Add</button>`
            }
          </div>
          ${
            isProd
              ? S.prodOn
                ? `${rows.map((l, i) => linkRow(g, i, l)).join('')}<button type="button" class="btn sm" style="margin-top:.5rem" data-act="add-link" data-g="${g}">${icon('plus')}Add another</button>`
                : '<p class="lg-off">Not live yet. Switch this on to add the production URL.</p>'
              : rows.length
                ? rows.map((l, i) => linkRow(g, i, l)).join('')
                : `<p class="lg-off">No ${t.label.toLowerCase()} link.</p>`
          }
        </div>`;
      }).join('')}`;
  }

  renderBar();
  renderMeta();
  renderImages();
  renderLinks();
  $('#shortCount', view).textContent = `${S.shortDescription.length}/200`;

  // ------------------------------------------------------------------
  // input teks
  // ------------------------------------------------------------------
  const title = $('#title', view);
  const slug = $('#slug', view);
  title.addEventListener('input', () => {
    S.title = title.value;
    if (!S.slugTouched) {
      S.slug = slugify(S.title);
      slug.value = S.slug;
    }
    renderBar();
    markDirty();
  });
  slug.addEventListener('input', () => {
    S.slugTouched = true;
    S.slug = slugify(slug.value);
    markDirty();
  });
  slug.addEventListener('blur', () => (slug.value = S.slug));
  $('#short', view).addEventListener('input', (e) => {
    S.shortDescription = e.target.value;
    $('#shortCount', view).textContent = `${S.shortDescription.length}/200`;
    markDirty();
  });
  $('#full', view).addEventListener('input', (e) => {
    S.fullDescription = e.target.value;
    markDirty();
  });
  bindSeg($('.editor-grid aside', view), (_, v) => {
    S.status = v;
    renderBar();
    markDirty();
  });

  // ------------------------------------------------------------------
  // gambar
  // ------------------------------------------------------------------
  function setRatio(r) {
    if (!r || r === S.imageRatio) return;
    S.imageRatio = r;
    $$('.img-tools .seg button', view).forEach((b) => {
      b.classList.toggle('active', b.dataset.value === r);
      b.setAttribute('aria-checked', String(b.dataset.value === r));
    });
    renderImages();
    markDirty();
  }
  bindSeg($('.img-tools', view), (_, v) => setRatio(v));

  async function addFiles(files) {
    const list = [...files].filter((f) => f.type.startsWith('image/'));
    if (files.length && !list.length) return toast('Please choose image files.', 'error');
    for (let k = 0; k < list.length; k++) {
      const res = await cropImage(list[k], { ratio: S.imageRatio, index: k + 1, total: list.length, title: 'Crop image' });
      if (res === 'abort') break;
      if (!res) continue;
      S.images.push({ id: uid(), url: URL.createObjectURL(res.blob), blob: res.blob, width: res.width, height: res.height, isCover: false, path: null, replacedPath: null });
      if (res.cropped) S.imageRatio = res.ratio;
      normalizeCover();
      syncRatioButtons();
      renderImages();
      markDirty();
    }
  }
  function syncRatioButtons() {
    $$('.img-tools .seg button', view).forEach((b) => {
      b.classList.toggle('active', b.dataset.value === S.imageRatio);
      b.setAttribute('aria-checked', String(b.dataset.value === S.imageRatio));
    });
  }

  function applyNewBlob(im, res) {
    if (im.blob) URL.revokeObjectURL(im.url);
    else if (im.path && !im.replacedPath) im.replacedPath = im.path;
    im.blob = res.blob;
    im.url = URL.createObjectURL(res.blob);
    im.width = res.width;
    im.height = res.height;
    if (res.cropped) S.imageRatio = res.ratio;
    syncRatioButtons();
    renderImages();
    markDirty();
  }

  const fileInput = $('#fileInput', view);
  const replaceInput = $('#replaceInput', view);
  const drop = $('#drop', view);
  $('#uploadBtn', view).addEventListener('click', () => fileInput.click());
  drop.addEventListener('click', () => fileInput.click());
  drop.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), fileInput.click()));
  fileInput.addEventListener('change', async () => {
    const files = [...fileInput.files];
    fileInput.value = '';
    await addFiles(files);
  });
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { if (e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); drop.classList.add('over'); } }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove('over')));
  drop.addEventListener('drop', (e) => { e.preventDefault(); addFiles(e.dataTransfer.files); });

  let replaceTarget = null;
  replaceInput.addEventListener('change', async () => {
    const f = replaceInput.files[0];
    replaceInput.value = '';
    const im = replaceTarget;
    replaceTarget = null;
    if (!f || !im) return;
    const res = await cropImage(f, { ratio: S.imageRatio, title: 'Replace image' });
    if (res && res !== 'abort') applyNewBlob(im, res);
  });

  $('#thumbNum', view).addEventListener('change', (e) => {
    const n = Math.min(S.images.length, Math.max(1, parseInt(e.target.value, 10) || 1));
    S.images.forEach((im, i) => (im.isCover = i === n - 1));
    renderImages();
    markDirty();
  });

  const grid = $('#imgGrid', view);
  const move = (from, to) => {
    if (to < 0 || to >= S.images.length || from === to) return;
    const [x] = S.images.splice(from, 1);
    S.images.splice(to, 0, x);
    renderImages();
    markDirty();
  };
  grid.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]');
    const tile = e.target.closest('.img-tile');
    if (!btn || !tile) return;
    const i = Number(tile.dataset.i);
    const im = S.images[i];
    switch (btn.dataset.act) {
      case 'cover':
        S.images.forEach((x, n) => (x.isCover = n === i));
        renderImages();
        markDirty();
        break;
      case 'left': move(i, i - 1); break;
      case 'right': move(i, i + 1); break;
      case 'crop': {
        const res = await cropImage(im.blob || im.url, { ratio: S.imageRatio, title: `Crop slide ${i + 1}` });
        if (res && res !== 'abort') applyNewBlob(im, res);
        break;
      }
      case 'replace':
        replaceTarget = im;
        replaceInput.click();
        break;
      case 'delete': {
        if (!(await confirmDialog({ title: 'Remove this image?', message: 'It will be removed from the project when you save.', confirmLabel: 'Remove', danger: true }))) break;
        if (im.blob) URL.revokeObjectURL(im.url);
        if (im.path) S.removedPaths.push(im.path);
        if (im.replacedPath) S.removedPaths.push(im.replacedPath);
        S.images.splice(i, 1);
        normalizeCover();
        renderImages();
        markDirty();
        break;
      }
    }
  });

  // drag & drop urutan
  let dragFrom = null;
  grid.addEventListener('dragstart', (e) => {
    const t = e.target.closest('.img-tile');
    if (!t) return;
    dragFrom = Number(t.dataset.i);
    t.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(dragFrom));
  });
  grid.addEventListener('dragover', (e) => {
    if (dragFrom === null) return;
    e.preventDefault();
    $$('.drop-before', grid).forEach((x) => x.classList.remove('drop-before'));
    e.target.closest('.img-tile')?.classList.add('drop-before');
  });
  grid.addEventListener('drop', (e) => {
    if (dragFrom === null) return;
    e.preventDefault();
    const t = e.target.closest('.img-tile');
    const from = dragFrom;
    dragFrom = null;
    if (!t) return renderImages();
    move(from, Number(t.dataset.i)); // item yang diseret menempati posisi tile target
  });
  grid.addEventListener('dragend', () => {
    dragFrom = null;
    $$('.dragging, .drop-before', grid).forEach((x) => x.classList.remove('dragging', 'drop-before'));
  });

  // ------------------------------------------------------------------
  // tautan
  // ------------------------------------------------------------------
  const linksPanel = $('#panelLinks', view);
  linksPanel.addEventListener('input', (e) => {
    const row = e.target.closest('.link-row');
    if (!row) return;
    S.links[row.dataset.g][Number(row.dataset.i)][e.target.dataset.f] = e.target.value;
    e.target.classList.remove('invalid');
    markDirty();
  });
  linksPanel.addEventListener('change', (e) => {
    if (e.target.id !== 'prodSwitch') return;
    S.prodOn = e.target.checked;
    if (S.prodOn && !S.links.production.length) S.links.production.push({ label: '', url: '' });
    renderLinks();
    markDirty();
    if (S.prodOn) linksPanel.querySelector('[data-g="production"] [data-f="url"]')?.focus();
  });
  linksPanel.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'add-link') {
      S.links[b.dataset.g].push({ label: '', url: '' });
      renderLinks();
      const rows = linksPanel.querySelectorAll(`.link-row[data-g="${b.dataset.g}"]`);
      rows[rows.length - 1]?.querySelector('[data-f="url"]')?.focus();
      markDirty();
    }
    if (b.dataset.act === 'rm-link') {
      const row = b.closest('.link-row');
      S.links[row.dataset.g].splice(Number(row.dataset.i), 1);
      if (row.dataset.g === 'production' && !S.links.production.length) S.prodOn = false;
      renderLinks();
      markDirty();
    }
  });

  // ------------------------------------------------------------------
  // simpan & hapus
  // ------------------------------------------------------------------
  async function save(btn) {
    // validasi
    if (!S.title.trim()) {
      title.classList.add('invalid');
      title.focus();
      return toast('Give the project a title first.', 'error');
    }
    title.classList.remove('invalid');
    if (!S.slug) S.slug = slugify(S.title) || `project-${S.id.slice(0, 6)}`;
    slug.value = S.slug;

    const links = [];
    let bad = null;
    for (const g of GROUPS) {
      if (g === 'production' && !S.prodOn) continue;
      S.links[g].forEach((l, i) => {
        const raw = l.url.trim();
        if (!raw) return;
        const url = normalizeUrl(raw);
        if (!url || url.startsWith('mailto:')) {
          bad ||= linksPanel.querySelector(`.link-row[data-g="${g}"][data-i="${i}"] [data-f="url"]`);
          bad?.classList.add('invalid');
          return;
        }
        links.push({ type: g, label: l.label.trim(), url });
      });
    }
    if (bad) {
      bad.focus();
      return toast('One of the links is not a valid URL.', 'error');
    }

    normalizeCover();
    const removedPaths = [...S.removedPaths, ...S.images.filter((i) => i.replacedPath).map((i) => i.replacedPath)];

    try {
      await busy(btn, () =>
        api.saveProject({
          id: S.id,
          slug: S.slug,
          title: S.title.trim(),
          shortDescription: S.shortDescription.trim(),
          fullDescription: S.fullDescription.trim(),
          status: S.status,
          imageRatio: S.imageRatio,
          links,
          images: S.images.map((i) => ({ id: i.id, url: i.url, path: i.blob ? null : i.path, blob: i.blob, width: i.width, height: i.height, isCover: i.isCover })),
          removedPaths,
        })
      );
    } catch (err) {
      console.error(err);
      if (/slug/i.test(err.message)) { slug.classList.add('invalid'); slug.focus(); }
      return toast(err.message || 'Could not save the project.', 'error');
    }
    dirty = false;
    invalidate();
    toast(isNew ? 'Project created' : 'Project saved');
    navigate(`/admin/projects/${S.id}`, { replace: true, force: true });
  }

  const saveBtns = [$('#saveBtn', view), $('#saveBtn2', view)];
  saveBtns.forEach((b) => b.addEventListener('click', () => save(b)));
  const onKey = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      save(saveBtns[0]);
    }
  };
  document.addEventListener('keydown', onKey);

  $('#delBtn', view)?.addEventListener('click', async (e) => {
    const ok = await confirmDialog({
      title: 'Delete this project?',
      message: `“${project.title}” and all its images will be permanently removed. This cannot be undone.`,
      confirmLabel: 'Delete project',
      danger: true,
    });
    if (!ok) return;
    try {
      await busy(e.currentTarget, () => api.deleteProject(project));
      dirty = false;
      invalidate();
      toast('Project deleted');
      navigate('/admin/projects', { force: true });
    } catch (err) {
      toast(err.message || 'Could not delete.', 'error');
    }
  });

  // ------------------------------------------------------------------
  // penjaga perubahan belum disimpan
  // ------------------------------------------------------------------
  guard.fn = async () =>
    !dirty ||
    confirmDialog({ title: 'Discard unsaved changes?', message: 'You have changes that have not been saved yet.', confirmLabel: 'Discard', danger: true });
  const onUnload = (e) => {
    if (dirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  };
  window.addEventListener('beforeunload', onUnload);

  return () => {
    guard.fn = null;
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('beforeunload', onUnload);
    S.images.forEach((i) => i.blob && URL.revokeObjectURL(i.url));
  };
}
