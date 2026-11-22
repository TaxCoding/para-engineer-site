import { api, invalidate } from '../data/api.js';
import { esc, $, $$, fmtDate, relTime, toast } from '../lib/util.js';
import { icon } from '../lib/icons.js';
import { statusChip, placeholder } from '../lib/cards.js';
import { pageHead, adminMeta, confirmDialog } from './ui.js';

export default async function projects(view) {
  adminMeta('Projects');
  view.innerHTML = `<section class="admin-page">
    ${pageHead('Projects', 'Add, edit or retire anything shown on the site.', `<a class="btn primary" href="/admin/projects/new">${icon('plus')}New project</a>`)}
    <div class="filter-bar">
      <input class="input" id="q" type="search" placeholder="Search projects…" aria-label="Search projects" />
      <div class="seg" data-seg="status" role="radiogroup" aria-label="Filter by status" id="statusFilter"></div>
    </div>
    <div class="proj-list" id="list"><div class="skeleton-block" style="height:96px"></div><div class="skeleton-block" style="height:96px"></div></div>
  </section>`;

  let items = [];
  let filter = 'all';
  const list = $('#list', view);

  try {
    items = await api.listProjects({ all: true });
  } catch (e) {
    list.innerHTML = `<div class="callout danger">${icon('info')}<span><strong>Could not load projects.</strong> ${esc(e.message)}</span></div>`;
    return;
  }

  const counts = () => ({
    all: items.length,
    published: items.filter((p) => p.status === 'published').length,
    draft: items.filter((p) => p.status === 'draft').length,
    archived: items.filter((p) => p.status === 'archived').length,
  });

  function paintFilter() {
    const c = counts();
    $('#statusFilter', view).innerHTML = ['all', 'published', 'draft', 'archived']
      .map((s) => `<button type="button" role="radio" data-value="${s}" aria-checked="${s === filter}" class="${s === filter ? 'active' : ''}">${s} · ${c[s]}</button>`)
      .join('');
  }

  function paint() {
    const q = $('#q', view).value.trim().toLowerCase();
    const rows = items
      .filter((p) => (filter === 'all' || p.status === filter) && (!q || (p.title + ' ' + p.slug + ' ' + p.shortDescription).toLowerCase().includes(q)))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (!rows.length) {
      list.innerHTML = items.length
        ? `<div class="empty-state"><strong>No matching projects.</strong><p>Try another filter or search term.</p></div>`
        : `<div class="empty-state"><strong>No projects yet.</strong><p>Create your first one — it takes a minute.</p><p style="margin-top:.8rem"><a class="btn primary" href="/admin/projects/new">${icon('plus')}New project</a></p></div>`;
      return;
    }
    list.innerHTML = rows
      .map(
        (p) => `
      <article class="proj-row" data-id="${esc(p.id)}">
        <a class="pr-thumb" href="/admin/projects/${esc(p.id)}" aria-label="Edit ${esc(p.title)}" style="aspect-ratio:4 / 3">${p.cover ? `<img src="${esc(p.cover.url)}" alt="" loading="lazy" />` : placeholder()}</a>
        <div class="pr-main">
          <h3><a href="/admin/projects/${esc(p.id)}">${esc(p.title)}</a>${statusChip(p.status)}</h3>
          <p>${esc(p.shortDescription || 'No short description yet.')}</p>
          <div class="pr-meta">
            <span title="${esc(fmtDate(p.createdAt))}">${icon('calendar')}Created ${esc(fmtDate(p.createdAt))}</span>
            <span>${icon('clock')}Updated ${esc(relTime(p.updatedAt))}</span>
            <span>${icon('image')}${p.images.length}</span>
            <span>${icon('link')}${p.links.length}</span>
          </div>
        </div>
        <div class="pr-actions">
          <a class="btn sm" href="/projects/${esc(p.slug)}" title="Open public page">${icon('eye')}View</a>
          <a class="btn sm" href="/admin/projects/${esc(p.id)}">${icon('edit')}Edit</a>
          <button class="btn sm danger" data-del="${esc(p.id)}" aria-label="Delete ${esc(p.title)}">${icon('trash')}</button>
        </div>
      </article>`
      )
      .join('');
  }

  paintFilter();
  paint();
  $('#q', view).addEventListener('input', paint);
  $('#statusFilter', view).addEventListener('click', (e) => {
    const b = e.target.closest('button[data-value]');
    if (!b) return;
    filter = b.dataset.value;
    paintFilter();
    paint();
  });
  list.addEventListener('click', async (e) => {
    const del = e.target.closest('[data-del]');
    if (!del) return;
    const p = items.find((x) => x.id === del.dataset.del);
    const ok = await confirmDialog({ title: 'Delete this project?', message: `“${p.title}” and all its images will be permanently removed.`, confirmLabel: 'Delete project', danger: true });
    if (!ok) return;
    try {
      await api.deleteProject(p);
      invalidate();
      items = items.filter((x) => x.id !== p.id);
      toast('Project deleted');
      paintFilter();
      paint();
    } catch (err) {
      toast(err.message || 'Could not delete.', 'error');
    }
  });
}
