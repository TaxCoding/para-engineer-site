import { api } from '../data/api.js';
import { esc, $ } from '../lib/util.js';
import { icon } from '../lib/icons.js';
import { pageHead, adminMeta, busy } from './ui.js';
import { logItem } from './shared.js';

const PAGE = 30;

export default async function logs(view) {
  adminMeta('Activity log');
  view.innerHTML = `<section class="admin-page">
    ${pageHead('Activity log', 'Every change made in the admin area, newest first.')}
    <div class="filter-bar">
      <select class="select" id="entity" style="max-width:200px" aria-label="Filter by type">
        <option value="">All activity</option>
        <option value="project">Projects</option>
        <option value="site">Site content</option>
        <option value="auth">Sign-ins</option>
      </select>
    </div>
    <div class="panel"><div class="log-list" id="list"></div><div id="more" style="margin-top:.8rem;text-align:center"></div></div>
  </section>`;

  const list = $('#list', view);
  const more = $('#more', view);
  let rows = [];
  let done = false;

  const visible = () => {
    const f = $('#entity', view).value;
    return f ? rows.filter((r) => r.entity === f) : rows;
  };
  const paint = () => {
    const v = visible();
    list.innerHTML = v.length ? v.map(logItem).join('') : `<p class="empty-mini">${icon('info', 'inline')} No activity to show.</p>`;
    more.innerHTML = done ? '' : '<button class="btn" id="moreBtn">Load more</button>';
    $('#moreBtn', view)?.addEventListener('click', (e) => busy(e.currentTarget, () => fetchMore()));
  };
  async function fetchMore() {
    try {
      const before = rows.length ? rows[rows.length - 1].createdAt : undefined;
      const batch = await api.logs({ limit: PAGE, before });
      rows = rows.concat(batch);
      if (batch.length < PAGE) done = true;
    } catch (e) {
      list.innerHTML = `<div class="callout danger">${icon('info')}<span>${esc(e.message)}</span></div>`;
      done = true;
      return;
    }
    paint();
  }
  $('#entity', view).addEventListener('change', paint);
  await fetchMore();
}
