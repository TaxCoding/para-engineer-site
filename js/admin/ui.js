import { esc } from '../lib/util.js';
import { icon } from '../lib/icons.js';
import { guard } from '../lib/router.js';

export function pageHead(title, sub = '', actions = '') {
  return `<header class="page-head"><div><h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ''}</div><div class="page-actions">${actions}</div></header>`;
}

// ---------- modal ----------
export function openModal(html, { cls = '', dismissible = true } = {}) {
  const root = document.getElementById('modalRoot');
  const back = document.createElement('div');
  back.className = 'modal-backdrop';
  back.innerHTML = `<div class="modal ${cls}" role="dialog" aria-modal="true">${html}</div>`;
  root.appendChild(back);
  const modal = back.firstElementChild;

  const prevFocus = document.activeElement;
  let closed = false;
  const onKey = (e) => {
    if (e.key === 'Escape' && dismissible) api.close('dismiss');
  };
  const api = {
    el: modal,
    onClose: null,
    close(reason) {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', onKey);
      back.classList.add('out');
      setTimeout(() => back.remove(), 170);
      prevFocus?.focus?.();
      api.onClose?.(reason);
    },
  };
  document.addEventListener('keydown', onKey);
  if (dismissible) back.addEventListener('mousedown', (e) => e.target === back && api.close('dismiss'));
  modal.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => api.close(b.dataset.close)));
  setTimeout(() => modal.querySelector('[autofocus], .btn.primary')?.focus?.(), 60);
  return api;
}

export function confirmDialog({ title, message, confirmLabel = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    const m = openModal(
      `<h2>${esc(title)}</h2><p>${esc(message)}</p>
       <div class="modal-foot">
         <button class="btn" data-close="cancel">Cancel</button>
         <button class="btn ${danger ? 'danger' : 'primary'}" data-close="ok" autofocus>${esc(confirmLabel)}</button>
       </div>`,
      { cls: 'sm' }
    );
    m.onClose = (r) => resolve(r === 'ok');
  });
}

// jalankan aksi async pada tombol dengan status loading
export async function busy(btn, fn) {
  if (!btn) return fn();
  btn.classList.add('loading');
  btn.disabled = true;
  try {
    return await fn();
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

export const statusSeg = (current, name = 'status') =>
  `<div class="seg" role="radiogroup" data-seg="${name}">${['published', 'draft', 'archived']
    .map((s) => `<button type="button" role="radio" aria-checked="${s === current}" class="${s === current ? 'active' : ''}" data-value="${s}">${s}</button>`)
    .join('')}</div>`;

// aktifkan perilaku grup .seg: onChange(value)
export function bindSeg(root, onChange) {
  root.querySelectorAll('.seg').forEach((seg) => {
    seg.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-value]');
      if (!b) return;
      seg.querySelectorAll('button').forEach((x) => {
        x.classList.toggle('active', x === b);
        x.setAttribute('aria-checked', String(x === b));
      });
      onChange?.(seg.dataset.seg, b.dataset.value);
    });
  });
}

export const emptyMini = (t) => `<p class="empty-mini">${icon('info', 'inline')} ${esc(t)}</p>`;

// halaman admin tidak boleh diindeks mesin pencari
export function adminMeta(title) {
  document.title = `${title} — Admin`;
  let m = document.querySelector('meta[name="robots"]');
  if (!m) {
    m = document.createElement('meta');
    m.name = 'robots';
    document.head.appendChild(m);
  }
  m.content = 'noindex, nofollow';
}

// penjaga "perubahan belum disimpan" untuk halaman formulir sederhana
export function useDirtyGuard(view) {
  let dirty = false;
  const onUnload = (e) => {
    if (dirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  };
  guard.fn = async () =>
    !dirty || confirmDialog({ title: 'Discard unsaved changes?', message: 'You have changes that have not been saved yet.', confirmLabel: 'Discard', danger: true });
  window.addEventListener('beforeunload', onUnload);
  const dot = () => view.querySelector('.dirty-dot');
  return {
    mark() { dirty = true; dot()?.classList.add('show'); },
    clear() { dirty = false; dot()?.classList.remove('show'); },
    dispose() { guard.fn = null; window.removeEventListener('beforeunload', onUnload); },
  };
}
