// Grafik SVG kecil tanpa library, mengikuti aturan skill dataviz:
//  - garis 2px, area wash ±10%, grid hairline, crosshair + tooltip semua seri
//  - legenda untuk ≥2 seri, tampilan tabel sebagai jalur alternatif (aksesibilitas)
//  - teks memakai token teks, bukan warna seri (tooltip pakai textContent)
//  - palet seri divalidasi (validate_palette.js): #2563eb ↔ #eb6834 PASS (ΔE CVD 29.9)
import { esc, fmtNum } from '../lib/util.js';

const NS = 'http://www.w3.org/2000/svg';
const C1 = '#2563eb';
const C2 = '#eb6834';

// skala dengan 4 interval berangka bulat: 0 / 15 / 30 / 45 / 60
function niceMax(v) {
  const raw = Math.max(v, 4) / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / pow;
  const step = ([1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((n) => n >= f - 1e-9) || 10) * pow;
  return step * 4;
}

const dayFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const dayLong = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const parseDay = (s) => new Date(s + 'T12:00:00');

// daily: [{day, views, visitors}]
export function lineChart(host, daily, { series = [['views', 'Page views', C1], ['visitors', 'Visitors', C2]], height = 260 } = {}) {
  host.innerHTML = '';
  host.classList.add('viz');

  // legenda (≥2 seri) + tombol tabel
  const legend = document.createElement('div');
  legend.className = 'viz-legend';
  legend.innerHTML =
    series.map(([, label, color]) => `<span><i style="background:${color}"></i>${esc(label)}</span>`).join('') +
    '<span class="spacer"></span><button type="button" class="btn ghost sm" data-toggle-table>View as table</button>';
  host.appendChild(legend);

  const box = document.createElement('div');
  box.className = 'viz-box';
  box.style.position = 'relative';
  host.appendChild(box);

  const tip = document.createElement('div');
  tip.className = 'viz-tip';
  tip.setAttribute('aria-hidden', 'true');
  box.appendChild(tip);

  const table = document.createElement('div');
  table.className = 'viz-table';
  table.hidden = true;
  table.innerHTML = `<table class="data-table"><thead><tr><th>Date</th>${series.map(([, l]) => `<th>${esc(l)}</th>`).join('')}</tr></thead><tbody>${daily
    .slice()
    .reverse()
    .map((d) => `<tr><td>${esc(dayLong.format(parseDay(d.day)))}</td>${series.map(([k]) => `<td>${fmtNum(d[k])}</td>`).join('')}</tr>`)
    .join('')}</tbody></table>`;
  host.appendChild(table);

  const toggle = legend.querySelector('[data-toggle-table]');
  toggle.addEventListener('click', () => {
    table.hidden = !table.hidden;
    box.hidden = !table.hidden;
    toggle.textContent = table.hidden ? 'View as table' : 'View as chart';
  });

  let svgEl = null;
  function draw() {
    const W = Math.max(280, box.clientWidth || host.clientWidth || 640);
    const H = height;
    const m = { l: 40, r: 14, t: 12, b: 26 };
    const iw = W - m.l - m.r;
    const ih = H - m.t - m.b;
    const n = daily.length;
    const max = niceMax(Math.max(1, ...daily.flatMap((d) => series.map(([k]) => d[k]))));
    const x = (i) => m.l + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
    const y = (v) => m.t + ih - (v / max) * ih;

    svgEl?.remove();
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `Daily ${series.map((s) => s[1]).join(' and ').toLowerCase()} for the last ${n} days`);
    svgEl = svg;

    let g = '';
    for (let t = 0; t <= 4; t++) {
      const v = (max / 4) * t;
      g += `<line class="grid-line" x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/><text class="axis-text" x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end">${fmtNum(v)}</text>`;
    }
    const every = Math.max(1, Math.ceil(n / Math.floor(iw / 62)));
    daily.forEach((d, i) => {
      if ((n - 1 - i) % every === 0) g += `<text class="axis-text" x="${x(i)}" y="${H - 6}" text-anchor="middle">${dayFmt.format(parseDay(d.day))}</text>`;
    });

    series.forEach(([k, , color], si) => {
      const pts = daily.map((d, i) => [x(i), y(d[k])]);
      const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
      if (si === 0) g += `<path d="${line} L${x(n - 1)} ${y(0)} L${x(0)} ${y(0)} Z" fill="${color}" fill-opacity="0.1"/>`;
      g += `<path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
      const last = pts[pts.length - 1];
      g += `<circle cx="${last[0]}" cy="${last[1]}" r="4" fill="${color}" stroke="#fff" stroke-width="2"/>`;
    });

    g += `<line class="cursor" id="vcur" y1="${m.t}" y2="${m.t + ih}" x1="0" x2="0" style="display:none"/>`;
    series.forEach(([, , color], si) => (g += `<circle id="vdot${si}" r="4" fill="${color}" stroke="#fff" stroke-width="2" style="display:none"/>`));
    g += `<rect class="hit" x="${m.l}" y="${m.t}" width="${iw}" height="${ih}" tabindex="0" aria-label="Chart data — use arrow keys to read values"/>`;
    svg.innerHTML = g;
    box.insertBefore(svg, tip);

    const cur = svg.querySelector('#vcur');
    const dots = series.map((_, si) => svg.querySelector(`#vdot${si}`));
    const hit = svg.querySelector('.hit');
    let kbIndex = n - 1;

    const show = (i) => {
      i = Math.max(0, Math.min(n - 1, i));
      const d = daily[i];
      cur.setAttribute('x1', x(i));
      cur.setAttribute('x2', x(i));
      cur.style.display = '';
      series.forEach(([k], si) => {
        dots[si].setAttribute('cx', x(i));
        dots[si].setAttribute('cy', y(d[k]));
        dots[si].style.display = '';
      });
      // tooltip dengan textContent (data tidak dipercaya)
      tip.replaceChildren();
      const dt = document.createElement('div');
      dt.className = 't-date';
      dt.textContent = dayLong.format(parseDay(d.day));
      tip.appendChild(dt);
      series.forEach(([k, label, color]) => {
        const row = document.createElement('div');
        row.className = 't-row';
        const key = document.createElement('i');
        key.style.background = color;
        const name = document.createElement('span');
        name.textContent = label;
        const val = document.createElement('b');
        val.textContent = fmtNum(d[k]);
        row.append(key, name, val);
        tip.appendChild(row);
      });
      const scale = box.clientWidth / W;
      const left = x(i) * scale;
      const flip = left > box.clientWidth - 190;
      tip.style.left = `${flip ? left - tip.offsetWidth - 12 : left + 12}px`;
      tip.style.top = `${Math.max(0, Math.min(...series.map(([k]) => y(d[k]))) * scale - 8)}px`;
      tip.classList.add('show');
    };
    const hide = () => {
      cur.style.display = 'none';
      dots.forEach((d) => (d.style.display = 'none'));
      tip.classList.remove('show');
    };
    const idxFromEvent = (e) => {
      const r = svg.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * W;
      return Math.round(((px - m.l) / iw) * (n - 1));
    };
    hit.addEventListener('pointermove', (e) => show(idxFromEvent(e)));
    hit.addEventListener('pointerdown', (e) => show(idxFromEvent(e)));
    hit.addEventListener('pointerleave', hide);
    hit.addEventListener('blur', hide);
    hit.addEventListener('focus', () => show(kbIndex));
    hit.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { kbIndex = Math.max(0, kbIndex - 1); show(kbIndex); e.preventDefault(); }
      if (e.key === 'ArrowRight') { kbIndex = Math.min(n - 1, kbIndex + 1); show(kbIndex); e.preventDefault(); }
    });
  }

  draw();
  const ro = new ResizeObserver(() => draw());
  ro.observe(box);
  return () => ro.disconnect();
}

// Sparkline kecil untuk stat tile (garis 2px, titik akhir)
export function sparkline(values, color = C1) {
  const W = 84, H = 28, p = 3;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => [p + (i / Math.max(1, values.length - 1)) * (W - p * 2), H - p - (v / max) * (H - p * 2)]);
  const d = pts.map((q, i) => `${i ? 'L' : 'M'}${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" aria-hidden="true"><path d="${d}" fill="none" stroke="#93c5fd" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${last[0]}" cy="${last[1]}" r="3.5" fill="${color}" stroke="#fff" stroke-width="2"/></svg>`;
}

// Bar horizontal: baris label + nilai di ujung, tooltip bawaan via title (nilai juga ada di teks)
export function barList(items, { labelKey = 'name', valueKey = 'count', sub } = {}) {
  if (!items?.length) return '<p class="empty-mini">No data in this period yet.</p>';
  const max = Math.max(1, ...items.map((i) => i[valueKey]));
  const total = items.reduce((s, i) => s + i[valueKey], 0) || 1;
  return `<div class="bars">${items
    .map((it) => {
      const pct = (it[valueKey] / max) * 100;
      const share = Math.round((it[valueKey] / total) * 100);
      return `<div class="bar-row" tabindex="0" title="${esc(it[labelKey])}: ${fmtNum(it[valueKey])} (${share}%)">
        <span class="b-label">${esc(it[labelKey])}${sub ? `<small>${esc(sub(it))}</small>` : ''}</span>
        <span class="b-val">${fmtNum(it[valueKey])}</span>
        <span class="b-track"><span class="b-fill" data-w="${pct.toFixed(1)}"></span></span>
      </div>`;
    })
    .join('')}</div>`;
}

// animasikan bar masuk setelah ditempel ke DOM
export function growBars(root) {
  requestAnimationFrame(() =>
    requestAnimationFrame(() => root.querySelectorAll('.b-fill[data-w]').forEach((el) => (el.style.width = el.dataset.w + '%')))
  );
}
