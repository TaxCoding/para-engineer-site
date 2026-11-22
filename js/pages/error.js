import { setMeta, esc } from '../lib/util.js';
import { icon } from '../lib/icons.js';

export function errorPage(view, { code = 404, title, reason, actionHref = '/', actionLabel = 'Back home' } = {}) {
  const num = Number(code) || 404;
  const heading =
    title ||
    (num === 404
      ? 'Halaman tidak ditemukan.'
      : num === 401 || num === 403
        ? 'Akses ditolak.'
        : num >= 500
          ? 'Terjadi gangguan pada server.'
          : 'Terjadi kesalahan.');

  const detail =
    reason ||
    (num === 404
      ? `Alamat "${location.pathname}" tidak terdaftar atau sudah dipindahkan.`
      : num === 401 || num === 403
        ? 'Kamu tidak memiliki izin atau sesi login admin sudah berakhir.'
        : 'Gagal memuat data halaman ini. Coba muat ulang beberapa saat lagi.');

  setMeta({ title: `${code} — Para Engineer` });

  view.innerHTML = `
    <section class="wrap narrow state-box">
      <span class="eyebrow">ERROR ${esc(String(code))}</span>
      <h1>${esc(heading)}</h1>
      <p class="muted" style="max-width:480px">${esc(detail)}</p>
      <div class="hero-actions" style="margin-top:0.75rem">
        <a class="btn primary" href="${esc(actionHref)}">${icon('arrowLeft')}${esc(actionLabel)}</a>
        <a class="btn" href="/projects">See all projects</a>
      </div>
    </section>`;
}