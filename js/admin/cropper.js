// Pemotong gambar tanpa library: geser (drag), zoom (slider / scroll / pinch),
// rasio 16:9 · 4:3 · 1:1. Hasil: WebP (fallback JPEG) maks 1600px lebar.
import { RATIOS, ratioValue } from '../data/defaults.js';
import { icon } from '../lib/icons.js';
import { clamp, esc, toast } from '../lib/util.js';
import { openModal } from './ui.js';

const MAX_W = 1600;

function toBlob(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob(
      (b) => {
        if (b && b.type === 'image/webp') return resolve(b);
        canvas.toBlob((j) => resolve(j), 'image/jpeg', 0.88);
      },
      'image/webp',
      0.86
    );
  });
}

async function loadImage(source) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  let objUrl = null;
  if (typeof source === 'string') img.src = source;
  else img.src = objUrl = URL.createObjectURL(source);
  await img.decode();
  return { img, objUrl };
}

/**
 * @param source  File | Blob | URL string
 * @param opts    { ratio, index, total, title }
 * @returns       { blob, width, height, ratio, cropped } | null (lewati) | 'abort' (batalkan sisa)
 */
export async function cropImage(source, { ratio = '16:9', index = 1, total = 1, title = 'Crop image' } = {}) {
  let loaded;
  try {
    loaded = await loadImage(source);
  } catch {
    toast('That file could not be read as an image.', 'error');
    return null;
  }
  const { img, objUrl } = loaded;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;

  return new Promise((resolve) => {
    const m = openModal(
      `<div class="modal-head">
         <h2>${esc(title)}</h2>
         ${total > 1 ? `<span class="crop-count">Image ${index} of ${total}</span>` : ''}
       </div>
       <div class="crop-stage" id="cStage"><div class="crop-frame" id="cFrame"></div></div>
       <div class="crop-controls">
         <div class="seg" data-seg="ratio" role="radiogroup" aria-label="Aspect ratio">
           ${RATIOS.map((r) => `<button type="button" role="radio" data-value="${r}" class="${r === ratio ? 'active' : ''}" aria-checked="${r === ratio}" style="text-transform:none">${r}</button>`).join('')}
         </div>
         <div class="crop-zoom">
           <button type="button" class="icon-btn" id="zOut" aria-label="Zoom out">${icon('zoomOut')}</button>
           <input type="range" id="zRange" min="1" max="4" step="0.01" value="1" aria-label="Zoom" />
           <button type="button" class="icon-btn" id="zIn" aria-label="Zoom in">${icon('zoomIn')}</button>
         </div>
       </div>
       <p class="hint" style="margin-top:.6rem">Drag to reposition, scroll or pinch to zoom. The frame is exactly what will be saved.</p>
       <div class="modal-foot">
         ${total > 1 ? '<button class="btn ghost" data-act="abort">Cancel remaining</button>' : ''}
         <span class="spacer"></span>
         <button class="btn" data-act="skip">${total > 1 ? 'Skip image' : 'Cancel'}</button>
         <button class="btn" data-act="original">Use original</button>
         <button class="btn primary" data-act="crop">${icon('crop')}Crop &amp; use</button>
       </div>`,
      { cls: '', dismissible: false }
    );
    const el = m.el;
    const stage = el.querySelector('#cStage');
    const frame = el.querySelector('#cFrame');
    const range = el.querySelector('#zRange');

    stage.insertBefore(img, frame);
    img.className = 'crop-img';
    img.draggable = false;

    let r = ratioValue(ratio);
    let sw = 0, sh = 0, fw = 0, fh = 0, base = 1, z = 1, cx = 0, cy = 0;
    let curRatio = ratio;

    const scale = () => base * z;
    const clampPos = () => {
      const s = scale();
      const mx = Math.max(0, (iw * s - fw) / 2);
      const my = Math.max(0, (ih * s - fh) / 2);
      cx = clamp(cx, -mx, mx);
      cy = clamp(cy, -my, my);
    };
    const apply = () => {
      clampPos();
      const s = scale();
      img.style.transform = `translate(${sw / 2 + cx - (iw * s) / 2}px, ${sh / 2 + cy - (ih * s) / 2}px) scale(${s})`;
      range.value = z;
    };
    function layout(keep = true) {
      sw = stage.clientWidth;
      sh = stage.clientHeight;
      const pad = 18;
      fw = Math.min(sw - pad * 2, (sh - pad * 2) * r);
      fh = fw / r;
      frame.style.cssText = `width:${fw}px;height:${fh}px;left:${(sw - fw) / 2}px;top:${(sh - fh) / 2}px`;
      const oldBase = base;
      base = Math.max(fw / iw, fh / ih);
      if (keep && oldBase !== 1) { cx *= base / oldBase; cy *= base / oldBase; } else { cx = cy = 0; }
      apply();
    }
    const setZoom = (nz) => {
      const old = scale();
      z = clamp(nz, 1, 4);
      const f = scale() / old;
      cx *= f; cy *= f;
      apply();
    };

    requestAnimationFrame(() => layout(false));
    const onResize = () => layout(true);
    window.addEventListener('resize', onResize);

    // ----- interaksi pointer: 1 jari geser, 2 jari pinch -----
    const pts = new Map();
    let pinch0 = 0, z0 = 1;
    stage.addEventListener('pointerdown', (e) => {
      stage.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch0 = Math.hypot(a.x - b.x, a.y - b.y);
        z0 = z;
      }
    });
    stage.addEventListener('pointermove', (e) => {
      const p = pts.get(e.pointerId);
      if (!p) return;
      if (pts.size === 1) {
        cx += e.clientX - p.x;
        cy += e.clientY - p.y;
        apply();
      }
      p.x = e.clientX; p.y = e.clientY;
      if (pts.size === 2 && pinch0) {
        const [a, b] = [...pts.values()];
        setZoom(z0 * (Math.hypot(a.x - b.x, a.y - b.y) / pinch0));
      }
    });
    const up = (e) => { pts.delete(e.pointerId); pinch0 = 0; };
    stage.addEventListener('pointerup', up);
    stage.addEventListener('pointercancel', up);
    stage.addEventListener('wheel', (e) => { e.preventDefault(); setZoom(z * (e.deltaY < 0 ? 1.08 : 1 / 1.08)); }, { passive: false });
    range.addEventListener('input', () => setZoom(Number(range.value)));
    el.querySelector('#zIn').addEventListener('click', () => setZoom(z + 0.25));
    el.querySelector('#zOut').addEventListener('click', () => setZoom(z - 0.25));

    el.querySelector('.seg').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-value]');
      if (!b) return;
      el.querySelectorAll('.seg button').forEach((x) => { x.classList.toggle('active', x === b); x.setAttribute('aria-checked', String(x === b)); });
      curRatio = b.dataset.value;
      r = ratioValue(curRatio);
      layout(true);
    });

    // ----- hasil -----
    function render(cropRect) {
      const canvas = document.createElement('canvas');
      let sx = 0, sy = 0, sW = iw, sH = ih;
      if (cropRect) ({ sx, sy, sW, sH } = cropRect);
      const ow = Math.min(MAX_W, Math.round(sW));
      const oh = Math.round(ow * (sH / sW));
      canvas.width = ow;
      canvas.height = oh;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, sx, sy, sW, sH, 0, 0, ow, oh);
      return toBlob(canvas).then((blob) => ({ blob, width: ow, height: oh }));
    }

    let finished = false;
    const finish = (val) => {
      if (finished) return;
      finished = true;
      window.removeEventListener('resize', onResize);
      if (objUrl) URL.revokeObjectURL(objUrl);
      m.close('done');
      resolve(val);
    };

    el.addEventListener('click', async (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (!act) return;
      if (act === 'skip') return finish(null);
      if (act === 'abort') return finish('abort');
      const btn = e.target.closest('[data-act]');
      btn.classList.add('loading');
      try {
        if (act === 'original') {
          finish({ ...(await render(null)), ratio: null, cropped: false });
        } else {
          const s = scale();
          const il = sw / 2 + cx - (iw * s) / 2;
          const it = sh / 2 + cy - (ih * s) / 2;
          const sx = clamp((sw / 2 - fw / 2 - il) / s, 0, iw);
          const sy = clamp((sh / 2 - fh / 2 - it) / s, 0, ih);
          const rect = { sx, sy, sW: Math.min(fw / s, iw - sx), sH: Math.min(fh / s, ih - sy) };
          finish({ ...(await render(rect)), ratio: curRatio, cropped: true });
        }
      } catch (err) {
        console.error(err);
        btn.classList.remove('loading');
        toast('Could not process this image (cross-origin?). Try replacing it with a fresh upload.', 'error');
      }
    });
  });
}
