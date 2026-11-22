import { esc, fmtNum, relTime, fmtDateTime } from '../lib/util.js';
import { icon } from '../lib/icons.js';
import { sparkline } from './chart.js';

export const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export function deltaHtml(cur, prev, label = 'vs previous period') {
  if (!prev && !cur) return `<span class="delta">No data yet</span>`;
  if (!prev) return `<span class="delta up">${icon('arrowUp')}New</span>`;
  const pct = Math.round(((cur - prev) / prev) * 100);
  if (pct === 0) return `<span class="delta">No change ${esc(label)}</span>`;
  return `<span class="delta ${pct > 0 ? 'up' : 'down'}" title="${esc(label)}">${icon(pct > 0 ? 'arrowUp' : 'arrowDown')}${pct > 0 ? '+' : ''}${pct}%</span>`;
}

export function statTile({ label, value, foot = '', series, href }) {
  const tag = href ? 'a' : 'div';
  return `<${tag} class="stat${href ? ' link' : ''}" ${href ? `href="${href}"` : ''}>
    <span class="s-label">${esc(label)}</span>
    <span class="s-value">${typeof value === 'number' ? fmtNum(value) : value}</span>
    <span class="s-foot">${foot}${series ? sparkline(series) : ''}</span>
  </${tag}>`;
}

const ACTION_ICON = { create: 'plus', update: 'edit', delete: 'trash', login: 'lock', logout: 'logout' };
export function logItem(l) {
  return `<div class="log-item">
    <span class="log-ic ${esc(l.action)}">${icon(ACTION_ICON[l.action] || 'activity')}</span>
    <div class="log-main"><strong>${esc(l.summary)}</strong><small>${esc(l.actor || 'system')} · ${esc(l.entity)}</small></div>
    <time class="log-time" datetime="${esc(l.createdAt)}" title="${esc(fmtDateTime(l.createdAt))}">${esc(relTime(l.createdAt))}</time>
  </div>`;
}

export const pageLabel = (path) => (path === '/' ? 'Home' : path);
