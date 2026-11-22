import { api } from '../data/api.js';
import { esc, $ } from '../lib/util.js';
import { icon } from '../lib/icons.js';
import { pageHead, adminMeta } from './ui.js';
import { lineChart, barList, growBars } from './chart.js';
import { statTile, deltaHtml, logItem, TZ } from './shared.js';

export default async function dashboard(view) {
  adminMeta('Dashboard');
  view.innerHTML = `<section class="admin-page">
    ${pageHead('Dashboard', 'How the site is doing over the last 30 days.', `<a class="btn primary" href="/admin/projects/new">${icon('plus')}New project</a>`)}
    <div id="dash"><div class="stat-grid">${'<div class="stat skeleton-block" style="height:112px"></div>'.repeat(4)}</div></div>
  </section>`;

  let a, projects, logs;
  try {
    [a, projects, logs] = await Promise.all([
      api.analytics({ days: 30, tz: TZ }),
      api.listProjects({ all: true }),
      api.logs({ limit: 6 }),
    ]);
  } catch (e) {
    $('#dash', view).innerHTML = `<div class="callout danger">${icon('info')}<span><strong>Could not load the dashboard.</strong> ${esc(e.message)}<br>If you just set up Supabase, make sure <code>supabase/schema.sql</code> was run completely.</span></div>`;
    return;
  }

  const by = (s) => projects.filter((p) => p.status === s).length;
  const views = a.daily.map((d) => d.views);
  const vis = a.daily.map((d) => d.visitors);

  $('#dash', view).innerHTML = `
    <div class="stat-grid">
      ${statTile({ label: 'Page views', value: a.totals.views, foot: deltaHtml(a.totals.views, a.prev.views), series: views })}
      ${statTile({ label: 'Visitors', value: a.totals.visitors, foot: deltaHtml(a.totals.visitors, a.prev.visitors), series: vis })}
      ${statTile({ label: 'Link clicks', value: a.totals.clicks, foot: '<span class="delta">Repo, demo, contact…</span>' })}
      ${statTile({
        label: 'Projects',
        value: by('published'),
        href: '/admin/projects',
        foot: `<span class="delta">published · ${by('draft')} draft · ${by('archived')} archived</span>`,
      })}
    </div>

    <div class="panel">
      <div class="panel-head">
        <div><div class="panel-title">Traffic</div><div class="panel-sub">Page views and unique visitors per day</div></div>
        <a class="btn sm" href="/admin/analytics">Full analytics${icon('arrowRight')}</a>
      </div>
      <div id="chart"></div>
    </div>

    <div class="grid-2">
      <div class="panel">
        <div class="panel-head"><div class="panel-title">Top projects</div></div>
        ${barList(a.projects.map((p) => ({ name: p.title, count: p.views, clicks: p.clicks })), { sub: (i) => (i.clicks ? `${i.clicks} clicks` : '') })}
      </div>
      <div class="panel">
        <div class="panel-head"><div class="panel-title">Recent activity</div><a class="btn ghost sm" href="/admin/logs">View all</a></div>
        <div class="log-list">${logs.length ? logs.map(logItem).join('') : '<p class="empty-mini">Nothing yet.</p>'}</div>
      </div>
    </div>`;

  const stop = lineChart($('#chart', view), a.daily);
  growBars(view);
  return stop;
}
