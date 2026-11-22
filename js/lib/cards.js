import { esc, fmtDate } from './util.js';
import { icon, LINK_TYPES } from './icons.js';
import { ratioCss } from '../data/defaults.js';

const LOGO = `<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M14 24C12 16 18 12 23 16C26 14 38 14 41 16C46 12 52 16 50 24C54 30 54 42 46 48C40 52 24 52 18 48C10 42 10 30 14 24Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><circle cx="24" cy="31" r="2.8" fill="currentColor"/><circle cx="40" cy="31" r="2.8" fill="currentColor"/><path d="M29 36.5H35L32 40L29 36.5Z" fill="#2563EB"/></svg>`;

export const placeholder = () => `<div class="media-empty">${LOGO}</div>`;

export function statusChip(status) {
  return `<span class="chip status ${esc(status)}">${esc(status)}</span>`;
}

export function projectCard(p, i = 0) {
  const types = [...new Set(p.links.map((l) => l.type))].filter((t) => LINK_TYPES[t]);
  const cover = p.cover;
  return `
    <a class="project-card reveal" href="/projects/${esc(p.slug)}" style="--ratio:${ratioCss(p.imageRatio)};--d:${Math.min(i, 6) * 70}ms">
      <div class="pc-media">
        ${cover ? `<img src="${esc(cover.url)}" alt="${esc(p.title)}" loading="lazy" decoding="async" />` : placeholder()}
        ${p.images.length > 1 ? `<span class="pc-count">${icon('image')}${p.images.length}</span>` : ''}
      </div>
      <div class="pc-body">
        <h3>${esc(p.title)}</h3>
        <p>${esc(p.shortDescription)}</p>
        <div class="pc-meta">
          <span class="pc-types">${types.map((t) => `<span class="pc-type" title="${LINK_TYPES[t].label}">${icon(LINK_TYPES[t].icon)}</span>`).join('')}</span>
          <span class="pc-date">${fmtDate(p.createdAt)}</span>
        </div>
      </div>
    </a>`;
}

export function skeletonCards(n = 3) {
  return Array.from({ length: n }, () => `
    <div class="project-card skeleton" aria-hidden="true">
      <div class="pc-media" style="--ratio:16 / 9"></div>
      <div class="pc-body"><h3>&nbsp;</h3><p>&nbsp;<br>&nbsp;</p></div>
    </div>`).join('');
}
