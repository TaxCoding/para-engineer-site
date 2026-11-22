import { api, isDemo } from '../data/api.js';
import { esc, $ } from '../lib/util.js';
import { icon } from '../lib/icons.js';
import { pageHead, adminMeta, bindSeg } from './ui.js';
import { lineChart, barList, growBars } from './chart.js';
import { statTile, deltaHtml, TZ, pageLabel } from './shared.js';

const RANGES = [7, 30, 90];

export default async function analytics(view) {
  adminMeta('Analytics');
  let days = 30;
  let stopChart = null;
  let alive = true;

  view.innerHTML = `<section class="admin-page">
    ${pageHead('Analytics', 'Free, first-party and cookie-free. Stored in your own database.')}
    <div class="chart-tools">
      <div class="seg" data-seg="range" role="radiogroup" aria-label="Date range">
        ${RANGES.map((d) => `<button type="button" role="radio" data-value="${d}" aria-checked="${d === days}" class="${d === days ? 'active' : ''}" style="text-transform:none">Last ${d} days</button>`).join('')}
      </div>
      <span class="hint">Admin visits and bots are not counted.</span>
    </div>
    <div id="body"></div>
  </section>`;

  async function load() {
    const body = $('#body', view);
    body.classList.add('is-loading'); // pertahankan frame lama saat refetch
    let a;
    try {
      a = await api.analytics({ days, tz: TZ });
    } catch (e) {
      body.classList.remove('is-loading');
      body.innerHTML = `<div class="callout danger">${icon('info')}<span><strong>Could not load analytics.</strong> ${esc(e.message)}</span></div>`;
      return;
    }
    if (!alive) return;
    stopChart?.();
    const perDay = a.totals.views / Math.max(1, days);
    body.innerHTML = `
      <div class="stat-grid">
        ${statTile({ label: 'Page views', value: a.totals.views, foot: deltaHtml(a.totals.views, a.prev.views), series: a.daily.map((d) => d.views) })}
        ${statTile({ label: 'Unique visitors', value: a.totals.visitors, foot: deltaHtml(a.totals.visitors, a.prev.visitors), series: a.daily.map((d) => d.visitors) })}
        ${statTile({ label: 'Sessions', value: a.totals.sessions, foot: `<span class="delta">${perDay.toFixed(1)} views / day</span>` })}
        ${statTile({ label: 'Link clicks', value: a.totals.clicks, foot: `<span class="delta">${a.totals.views ? Math.round((a.totals.clicks / a.totals.views) * 100) : 0}% of views</span>` })}
      </div>
      <div class="panel"><div class="panel-head"><div><div class="panel-title">Traffic</div><div class="panel-sub">Per day, in your time zone (${esc(TZ)})</div></div></div><div id="chart"></div></div>
      <div class="grid-2">
        <div class="panel"><div class="panel-head"><div class="panel-title">Top pages</div></div>${barList(a.pages.map((p) => ({ name: pageLabel(p.path), count: p.views })))}</div>
        <div class="panel"><div class="panel-head"><div class="panel-title">Top projects</div></div>${barList(a.projects.map((p) => ({ name: p.title, count: p.views, clicks: p.clicks })), { sub: (i) => (i.clicks ? `${i.clicks} clicks` : '') })}</div>
        <div class="panel"><div class="panel-head"><div class="panel-title">Referrers</div></div>${barList(a.referrers)}</div>
        <div class="panel"><div class="panel-head"><div class="panel-title">Clicked links</div></div>${barList(a.clicks, { labelKey: 'label' })}</div>
        <div class="panel"><div class="panel-head"><div class="panel-title">Devices</div></div>${barList(a.devices)}</div>
        <div class="panel"><div class="panel-head"><div class="panel-title">Browsers</div></div>${barList(a.browsers)}</div>
      </div>
      ${isDemo ? `<div class="callout" style="margin-top:1.1rem">${icon('info')}<span>Demo mode shows <strong>sample traffic</strong> so you can preview the charts. With Supabase connected, only real visits appear here.</span></div>` : ''}`;
    body.classList.remove('is-loading');
    stopChart = lineChart($('#chart', body), a.daily);
    growBars(body);
  }

  bindSeg(view, (_, v) => {
    days = Number(v);
    load();
  });
  await load();

  return () => {
    alive = false;
    stopChart?.();
  };
}
