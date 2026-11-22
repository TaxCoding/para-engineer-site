import { api, getContentCached, getPublishedCached } from '../data/api.js';
import { mergeContent, ratioCss, ratioValue } from '../data/defaults.js';
import { esc, renderRich, observeReveal, setMeta, fmtDate, fmtDateTime, hostOf, clamp, $, $$ } from '../lib/util.js';
import { config } from '../config.js';
import { icon, LINK_TYPES } from '../lib/icons.js';
import { projectCard, statusChip, placeholder } from '../lib/cards.js';
import { socialButtons } from '../lib/shell.js';
import { trackPageview } from '../lib/track.js';
import {
  checkSerialSupport,
  describePort,
  getAuthorizedPort,
  pickSerialPort,
  testSerialPort,
  subscribeSerialEvents,
  flashFirmwareFromConfig,
  openSerialMonitor,
  SERIAL_DRIVERS,
} from '../lib/flasher.js';

const TYPE_ORDER = ['repository', 'production', 'documentation', 'demo'];

export async function projectPage(view, { params }) {
  view.innerHTML = `<article class="wrap detail"><div class="skeleton-block" style="aspect-ratio:16/9"></div><div class="skeleton-block line"></div><div class="skeleton-block line short"></div></article>`;

  const [project, content, all] = await Promise.all([
    api.getProject({ slug: params.slug }).catch(() => null),
    getContentCached().catch(() => mergeContent({})),
    getPublishedCached().catch(() => []),
  ]);

  if (!project) return notFound(view);

  const others = shuffle(all.filter((p) => p.id !== project.id)).slice(0, 3);
  view.innerHTML = render(project, content, others);
  setMeta({
    title: `${project.title} — ${content.site.name}`,
    description: project.shortDescription,
    url: `${config.siteUrl}/projects/${project.slug}`,
    image: project.cover?.url,
  });
  if (project.status === 'published') trackPageview(`/projects/${project.slug}`, project.id);

  const stopGallery = initGallery(view, project);
  const stopDeploy = initDeploy(view, project);
  const stopReveal = observeReveal(view);
  return () => {
    stopGallery();
    stopDeploy();
    stopReveal();
  };
}

export function notFound(view) {
  setMeta({ title: 'Not found — Para Engineer' });
  view.innerHTML = `
    <section class="wrap narrow state-box">
      <span class="eyebrow">404</span>
      <h1>Nothing to see here.</h1>
      <p class="muted">This page doesn't exist, or it hasn't been published yet.</p>
      <a class="btn primary" href="/">${icon('arrowLeft')}Back home</a>
    </section>`;
}

function render(p, c, others) {
  const links = [...p.links].sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type));
  const isPreview = p.status !== 'published';
  return `
  <article class="wrap detail" data-project="${esc(p.id)}">
    <a class="back-link" href="/#projects">${icon('arrowLeft')}<span>All projects</span></a>

    ${isPreview ? `<div class="preview-banner">${icon('eye')}<span><strong>${esc(p.status)}</strong> — only you can see this page while signed in as admin.</span></div>` : ''}

    ${gallery(p)}

    <header class="detail-head reveal">
      ${isPreview ? `<div class="chips">${statusChip(p.status)}</div>` : ''}
      <h1>${esc(p.title)}</h1>
      ${p.shortDescription ? `<p class="lead">${esc(p.shortDescription)}</p>` : ''}
      <div class="meta-row">
        <span title="${esc(fmtDateTime(p.createdAt))}">${icon('calendar')}Created ${esc(fmtDate(p.createdAt))}</span>
        <span title="${esc(fmtDateTime(p.updatedAt))}">${icon('clock')}Updated ${esc(fmtDate(p.updatedAt))}</span>
      </div>
    </header>

    ${p.fullDescription ? `<section class="rich detail-body reveal">${renderRich(p.fullDescription)}</section>` : ''}

    ${
      links.length
        ? `<section class="detail-links reveal" aria-label="Links">
            <span class="eyebrow">Links</span>
            <div class="link-grid">${links.map(linkCard).join('')}</div>
          </section>`
        : ''
    }

    ${deploySection(p)}

    <section class="cta-card reveal" aria-label="Contact">
      <div class="cta-cats" aria-hidden="true"><img src="/assets/cat-1.png" alt="" draggable="false" /></div>
      <div class="cta-text">
        <h2>${esc(c.contact.ctaTitle)}</h2>
        <p>${esc(c.contact.ctaText)}</p>
      </div>
      <div class="cta-actions">
        <a class="btn primary js-email-btn" href="mailto:${esc(c.contact.email)}?subject=${encodeURIComponent('About: ' + p.title)}" data-track="Email">${icon('mail')}Email</a>
        ${socialButtons({ ...c, contact: { ...c.contact, email: '' } }, { onlyContact: true })}
      </div>
    </section>

    ${
      others.length
        ? `<section class="suggest" aria-label="More projects">
            <header class="section-head reveal"><span class="eyebrow">Keep exploring</span><h2>More projects</h2></header>
            <div class="project-grid">${others.map(projectCard).join('')}</div>
          </section>`
        : ''
    }
  </article>`;
}

function deploySection(p) {
  const d = p.deployConfig;
  if (!d?.enabled || !d.files?.length) return '';
  const sup = checkSerialSupport();
  const dis = sup.ok ? '' : 'disabled';

  return `
  <section class="detail-links reveal" id="deploySection" aria-label="Deploy firmware">
    <span class="eyebrow">Firmware Deploy</span>
    <div class="deploy-box">
      <div class="deploy-head">
        <div>
          <div class="deploy-title">Flash to ${esc((d.chip || 'ESP32').toUpperCase())} via USB</div>
          <div class="deploy-sub">Source: <code>${esc(d.repo)}/${esc(d.buildDir)}</code> · ${d.files.length} binary file(s)</div>
        </div>
        <span class="chip status ${sup.ok ? 'published' : 'draft'}">${sup.ok ? 'Web Serial Ready' : 'Desktop Chrome/Edge Only'}</span>
      </div>

      <!-- Info file .bin & alamat memori tetap tampil di semua perangkat (termasuk HP) -->
      <div class="deploy-files">
        ${d.files.map((f) => `<span class="chip"><code>${esc(f.name)}</code> · ${esc(f.address)}</span>`).join('')}
      </div>

      ${
        sup.ok
          ? `<div class="deploy-port-bar" id="portStatusBar">
              <span class="port-dot" id="portDot"></span>
              <span class="port-text" id="portStatusText">Belum ada port USB dipilih</span>
              <button type="button" class="btn sm ghost" id="changePortBtn" hidden>Ganti Port</button>
            </div>`
          : ''
      }

      <!-- Tombol tetap ditampilkan (redup/nonaktif jika tidak didukung di HP/Safari) -->
      <div class="deploy-actions ${sup.ok ? '' : 'is-disabled'}">
        <button type="button" class="btn primary" id="flashBtn" data-track="Flash firmware" ${dis}>Connect &amp; Flash</button>
        <button type="button" class="btn" id="testPortBtn" ${dis}>Test Koneksi</button>
        <button type="button" class="btn" id="monitorBtn" ${dis}>Serial Monitor</button>
        <select class="select deploy-baud" id="baudSelect" ${dis}>
          <option value="460800" selected>460800 baud</option>
          <option value="115200">115200 baud (Safe)</option>
        </select>
        <label class="switch ${sup.ok ? '' : 'is-disabled'}">
          <input type="checkbox" id="eraseCheck" ${dis} />
          <span class="track"></span>
          <span>Erase flash</span>
        </label>
      </div>

      ${
        !sup.ok
          ? `<div class="callout deploy-unsupported">
              ${icon('info')}
              <span><strong>Tidak dapat men-deploy firmware di perangkat/browser ini.</strong> Harap gunakan browser yang didukung: <strong>Google Chrome, Microsoft Edge, atau Opera di Laptop/PC (Desktop)</strong>.</span>
            </div>`
          : `<div class="deploy-progress" id="deployProgressWrap" hidden>
              <div class="deploy-bar"><div class="deploy-bar-fill" id="deployBarFill"></div></div>
              <span class="hint" id="deployStatusText">Preparing...</span>
            </div>
            <div class="deploy-term-wrap" id="deployTermWrap" hidden>
              <div class="deploy-term-bar">
                <span id="deployTermTitle">Console Output</span>
                <button type="button" class="term-clear-btn" id="clearLogBtn">Clear</button>
              </div>
              <pre class="deploy-log" id="deployLog"></pre>
            </div>`
      }

      <details class="driver-help">
        <summary>Port USB tidak muncul? Download driver serial di sini</summary>
        <div class="driver-links">
          ${SERIAL_DRIVERS.map((drv) => `<a class="btn sm" href="${esc(drv.url)}" target="_blank" rel="noopener noreferrer">${esc(drv.name)}</a>`).join('')}
        </div>
      </details>
    </div>
  </section>`;
}

// Konverter warna ANSI (ESP-IDF green/yellow/red) yang aman tanpa innerHTML raw
function createAnsiWriter(logEl, wrapEl) {
  let pending = '';
  let currentColor = '';
  let currentBold = false;

  const COLOR_MAP = {
    '30': '#94a3b8', '90': '#94a3b8',
    '31': '#f87171', '91': '#fca5a5',
    '32': '#4ade80', '92': '#86efac',
    '33': '#facc15', '93': '#fde047',
    '34': '#60a5fa', '94': '#93c5fd',
    '35': '#c084fc', '95': '#d8b4fe',
    '36': '#22d3ee', '96': '#67e8f9',
    '37': '#e2e8f0', '97': '#ffffff',
  };

  function pushText(text) {
    if (!text) return;
    const clean = text.replace(/\r\n/g, '\n').replace(/\r/g, '');
    if (!clean) return;
    if (!currentColor && !currentBold) {
      logEl.appendChild(document.createTextNode(clean));
    } else {
      const span = document.createElement('span');
      if (currentColor) span.style.color = currentColor;
      if (currentBold) span.style.fontWeight = '700';
      span.textContent = clean;
      logEl.appendChild(span);
    }
  }

  return {
    clear() {
      pending = '';
      currentColor = '';
      currentBold = false;
      logEl.textContent = '';
    },
    write(chunk, { newline = false, color = '' } = {}) {
      wrapEl.hidden = false;
      if (color) {
        const span = document.createElement('span');
        span.style.color = color;
        span.textContent = String(chunk) + (newline ? '\n' : '');
        logEl.appendChild(span);
        logEl.scrollTop = logEl.scrollHeight;
        return;
      }

      let str = pending + String(chunk) + (newline ? '\n' : '');
      pending = '';

      const escIdx = str.lastIndexOf('\x1b');
      if (escIdx !== -1 && escIdx > str.length - 16) {
        const tail = str.slice(escIdx);
        if (/^\x1b(\[[0-9;]*)?$/.test(tail)) {
          pending = tail;
          str = str.slice(0, escIdx);
        }
      }

      const ANSI_RE = /\x1b\[([0-9;]*)m/g;
      let lastIndex = 0;
      let match;
      while ((match = ANSI_RE.exec(str)) !== null) {
        if (match.index > lastIndex) pushText(str.slice(lastIndex, match.index));
        const codes = (match[1] || '0').split(';');
        for (const c of codes) {
          if (c === '0' || c === '') {
            currentColor = '';
            currentBold = false;
          } else if (c === '1') {
            currentBold = true;
          } else if (c === '22') {
            currentBold = false;
          } else if (COLOR_MAP[c]) {
            currentColor = COLOR_MAP[c];
          }
        }
        lastIndex = ANSI_RE.lastIndex;
      }

      if (lastIndex < str.length) {
        pushText(str.slice(lastIndex).replace(/\x1b\[[0-9;?]*[A-Za-z]/g, ''));
      }
      logEl.scrollTop = logEl.scrollHeight;
    },
  };
}

function initDeploy(view, project) {
  const box = $('#deploySection', view);
  if (!box || !checkSerialSupport().ok) return () => {};

  const d = project.deployConfig;
  const flashBtn = $('#flashBtn', box);
  const testBtn = $('#testPortBtn', box);
  const monitorBtn = $('#monitorBtn', box);
  const changePortBtn = $('#changePortBtn', box);
  const portDot = $('#portDot', box);
  const portTxt = $('#portStatusText', box);
  const progWrap = $('#deployProgressWrap', box);
  const barFill = $('#deployBarFill', box);
  const statusTxt = $('#deployStatusText', box);
  const termWrap = $('#deployTermWrap', box);
  const termTitle = $('#deployTermTitle', box);
  const clearBtn = $('#clearLogBtn', box);
  const logEl = $('#deployLog', box);

  const writer = createAnsiWriter(logEl, termWrap);
  let activePort = null;
  let monitorHandle = null;

  function setPortStatus(state, label) {
    portDot.className = `port-dot ${state}`; // 'ok' | 'off' | ''
    portTxt.textContent = label;
    changePortBtn.hidden = state === '';
  }

  // Cek apakah browser sudah mengingat port yang sebelumnya pernah diizinkan
  getAuthorizedPort().then((p) => {
    if (p) {
      activePort = p;
      setPortStatus('ok', `Siap: ${describePort(p)}`);
    }
  });

  // Deteksi real-time jika kabel USB dicabut / dicolok ulang
  const unsubSerial = subscribeSerialEvents({
    onConnect(port) {
      activePort = port;
      const name = describePort(port);
      setPortStatus('ok', `Terhubung kembali: ${name}`);
      if (!termWrap.hidden) writer.write(`[USB] Perangkat terhubung kembali: ${name}`, { newline: true, color: '#4ade80' });
    },
    onDisconnect(port) {
      if (!activePort || port === activePort) {
        const name = describePort(port);
        if (monitorHandle) {
          monitorHandle.close().catch(() => {});
          monitorHandle = null;
          monitorBtn.textContent = 'Serial Monitor';
        }
        activePort = null;
        setPortStatus('off', `Terputus: ${name} (kabel dicabut)`);
        writer.write(`[USB] Kabel dicabut — perangkat sudah tidak terhubung.`, { newline: true, color: '#f87171' });
      }
    },
  });

  clearBtn?.addEventListener('click', () => writer.clear());

  changePortBtn?.addEventListener('click', async () => {
    if (monitorHandle) {
      await monitorHandle.close();
      monitorHandle = null;
      monitorBtn.textContent = 'Serial Monitor';
    }
    try {
      const port = await pickSerialPort({ forceNew: true });
      activePort = port;
      const name = describePort(port);
      setPortStatus('ok', `Dipilih: ${name}`);
      writer.write(`[USB] Port diganti ke: ${name}`, { newline: true, color: '#60a5fa' });
    } catch (err) {
      if (err?.name !== 'NotFoundError') writer.write(`[USB] Gagal ganti port: ${err.message}`, { newline: true, color: '#f87171' });
    }
  });

  testBtn?.addEventListener('click', async () => {
    try {
      const { port, label } = await testSerialPort(activePort);
      activePort = port;
      setPortStatus('ok', `Terkoneksi: ${label}`);
      writer.write(`[TEST] Koneksi USB OK — ${label} siap di-flash.`, { newline: true, color: '#4ade80' });
    } catch (err) {
      if (err?.name !== 'NotFoundError') {
        setPortStatus('off', 'Gagal terhubung ke perangkat');
        writer.write(`[TEST] ${err.message}`, { newline: true, color: '#f87171' });
      }
    }
  });

  flashBtn?.addEventListener('click', async () => {
    if (monitorHandle) {
      await monitorHandle.close();
      monitorHandle = null;
      monitorBtn.textContent = 'Serial Monitor';
    }
    flashBtn.disabled = true;
    progWrap.hidden = false;
    termTitle.textContent = 'Flash Log';
    writer.clear();

    try {
      const usedPort = await flashFirmwareFromConfig(d, {
        port: activePort,
        baudrate: Number($('#baudSelect', box)?.value || 460800),
        eraseAll: $('#eraseCheck', box)?.checked,
        onLog: (line) => writer.write(line, { newline: true }),
        onProgress(pct, label) {
          barFill.style.width = `${pct}%`;
          statusTxt.textContent = `${pct}% — ${label}`;
        },
      });
      activePort = usedPort;
      setPortStatus('ok', `Terkoneksi: ${describePort(usedPort)}`);
    } catch (err) {
      if (err?.name !== 'NotFoundError') {
        statusTxt.textContent = `Error: ${err.message}`;
        writer.write(`ERROR: ${err.message}`, { newline: true, color: '#f87171' });
      } else {
        progWrap.hidden = true;
      }
    } finally {
      flashBtn.disabled = false;
    }
  });

  monitorBtn?.addEventListener('click', async () => {
    if (monitorHandle) {
      await monitorHandle.close();
      monitorHandle = null;
      monitorBtn.textContent = 'Serial Monitor';
      return;
    }
    try {
      termTitle.textContent = 'Serial Monitor (115200 baud)';
      writer.clear();
      monitorHandle = await openSerialMonitor({
        port: activePort,
        baudRate: 115200,
        onData(chunk) {
          writer.write(chunk);
        },
        onClose(reason) {
          monitorHandle = null;
          monitorBtn.textContent = 'Serial Monitor';
          if (reason === 'disconnected') {
            setPortStatus('off', 'Terputus (kabel dicabut)');
            writer.write(`\n[Monitor] Perangkat sudah tidak terhubung.`, { newline: true, color: '#f87171' });
          }
        },
      });
      activePort = monitorHandle.port;
      setPortStatus('ok', `Monitor aktif: ${describePort(activePort)}`);
      monitorBtn.textContent = 'Close Monitor';
    } catch (err) {
      if (err?.name !== 'NotFoundError') writer.write(`Monitor error: ${err.message}`, { newline: true, color: '#f87171' });
    }
  });

  return () => {
    unsubSerial();
    if (monitorHandle) monitorHandle.close().catch(() => {});
  };
}

function linkCard(l) {
  const t = LINK_TYPES[l.type] || { label: 'Link', icon: 'link' };
  const label = l.label || t.label;
  return `
    <a class="link-card" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer" data-track="${esc(t.label)}">
      <span class="lc-icon">${icon(t.icon)}</span>
      <span class="lc-text"><strong>${esc(label)}</strong><small>${esc(displayUrl(l.url))}</small></span>
      <span class="lc-go">${icon('external')}</span>
    </a>`;
}

function displayUrl(u) {
  try {
    const x = new URL(u);
    return x.host.replace(/^www\./, '') + (x.pathname.length > 1 ? x.pathname.replace(/\/$/, '') : '');
  } catch {
    return hostOf(u);
  }
}

function gallery(p) {
  const r = ratioCss(p.imageRatio);
  const wrap = `class="gallery-wrap" style="--ratio:${r};--rn:${ratioValue(p.imageRatio).toFixed(4)}"`;
  if (!p.images.length) {
    return `<div ${wrap}><div class="g-slide-empty">${placeholder()}</div></div>`;
  }
  const many = p.images.length > 1;
  return `
    <div ${wrap}>
    <div class="gallery reveal" tabindex="0" aria-roledescription="carousel" aria-label="Project images">
      <div class="g-track" id="gTrack">
        ${p.images.map((i, n) => `<figure class="g-slide" data-i="${n}"><img src="${esc(i.url)}" alt="${esc(p.title)} — image ${n + 1}" ${n ? 'loading="lazy"' : ''} decoding="async" draggable="false" /></figure>`).join('')}
      </div>
      ${
        many
          ? `<button type="button" class="g-nav prev" data-dir="-1" aria-label="Previous image">${icon('chevLeft')}</button>
             <button type="button" class="g-nav next" data-dir="1" aria-label="Next image">${icon('chevRight')}</button>
             <span class="g-count" id="gCount">1 / ${p.images.length}</span>`
          : ''
      }
    </div>
    ${
      many
        ? `<div class="g-thumbs reveal" id="gThumbs">${p.images
            .map((i, n) => `<button type="button" class="g-thumb${n === 0 ? ' active' : ''}" data-i="${n}" aria-label="Show image ${n + 1}"><img src="${esc(i.url)}" alt="" loading="lazy" draggable="false" /></button>`)
            .join('')}</div>`
        : ''
    }
    </div>`;
}

function initGallery(view, project) {
  const track = $('#gTrack', view);
  if (!track) return () => {};
  const n = project.images.length;
  const count = $('#gCount', view);
  const thumbs = $$('.g-thumb', view);
  let idx = 0;

  const go = (i) => {
    i = clamp(i, 0, n - 1);
    track.scrollTo({ left: i * track.clientWidth, behavior: 'smooth' });
  };
  const sync = () => {
    const i = clamp(Math.round(track.scrollLeft / track.clientWidth), 0, n - 1);
    if (i === idx) return;
    idx = i;
    if (count) count.textContent = `${i + 1} / ${n}`;
    thumbs.forEach((t, k) => t.classList.toggle('active', k === i));
    thumbs[i]?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  };

  let raf = 0;
  const onScroll = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(sync);
  };
  track.addEventListener('scroll', onScroll, { passive: true });

  const onClick = (e) => {
    const nav = e.target.closest('.g-nav');
    if (nav) return go(idx + Number(nav.dataset.dir));
    const th = e.target.closest('.g-thumb');
    if (th) return go(Number(th.dataset.i));
    const slide = e.target.closest('.g-slide');
    if (slide) openLightbox(project, Number(slide.dataset.i));
  };
  view.addEventListener('click', onClick);

  const gal = $('.gallery', view);
  const onKey = (e) => {
    if (e.key === 'ArrowRight') go(idx + 1);
    if (e.key === 'ArrowLeft') go(idx - 1);
  };
  gal?.addEventListener('keydown', onKey);

  return () => {
    track.removeEventListener('scroll', onScroll);
    view.removeEventListener('click', onClick);
    gal?.removeEventListener('keydown', onKey);
    cancelAnimationFrame(raf);
  };
}

function openLightbox(project, start) {
  const root = document.getElementById('modalRoot');
  let i = start;
  const el = document.createElement('div');
  el.className = 'lightbox';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.innerHTML = `
    <button type="button" class="icon-btn lb-close" aria-label="Close">${icon('x')}</button>
    ${project.images.length > 1 ? `<button type="button" class="g-nav prev" data-dir="-1" aria-label="Previous">${icon('chevLeft')}</button><button type="button" class="g-nav next" data-dir="1" aria-label="Next">${icon('chevRight')}</button>` : ''}
    <img alt="" />
    <span class="g-count"></span>`;
  const img = $('img', el);
  const cnt = $('.g-count', el);
  const show = () => {
    img.src = project.images[i].url;
    img.alt = `${project.title} — image ${i + 1}`;
    cnt.textContent = `${i + 1} / ${project.images.length}`;
  };
  const step = (d) => {
    i = (i + d + project.images.length) % project.images.length;
    show();
  };
  const close = () => {
    el.classList.add('out');
    document.removeEventListener('keydown', key);
    setTimeout(() => el.remove(), 180);
  };
  const key = (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowRight') step(1);
    if (e.key === 'ArrowLeft') step(-1);
  };
  el.addEventListener('click', (e) => {
    if (e.target.closest('.g-nav')) return step(Number(e.target.closest('.g-nav').dataset.dir));
    if (!e.target.closest('img') || e.target.closest('.lb-close')) close();
  });
  document.addEventListener('keydown', key);
  show();
  root.appendChild(el);
}

function shuffle(a) {
  const arr = a.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}