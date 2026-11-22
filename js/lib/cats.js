// Mesin audio & kucing elastis + shortcut rahasia menuju admin (1-1-2-2-1-2).
import { toast } from './util.js';

// Pola rahasia: Kucing 1 (2x) -> Kucing 2 (2x) -> Kucing 1 (1x) -> Kucing 2 (1x)
const SECRET_SEQUENCE = '112212';
const MAX_TAP_GAP_MS = 3500;
let tapBuffer = [];
let lastTapAt = 0;

function recordCatTap(catId) {
  const now = Date.now();
  if (now - lastTapAt > MAX_TAP_GAP_MS) {
    tapBuffer = [];
  }
  lastTapAt = now;
  tapBuffer.push(String(catId));
  if (tapBuffer.length > SECRET_SEQUENCE.length) {
    tapBuffer.shift();
  }
  if (tapBuffer.join('') === SECRET_SEQUENCE) {
    tapBuffer = [];
    window.dispatchEvent(new CustomEvent('pe:secret-admin'));
  }
}

export class PrioritySound {
  static sharedCtx = null;

  constructor(src) {
    this.src = src;
    this.buffer = null;
    this.trimOffset = 0;
    this.loading = false;
    this.failedWebAudio = false;
    this.MIN_SLICE = 0.085;
    this.lastScheduledStart = -1;
    this.lastScheduledVoice = null;
    this.prevClickTime = -1;
    this.fallbackAudio = null;
    this.fbLastPlay = 0;
    this.fbPendingTimer = null;
    this.fbSpeedTimer = null;
  }

  computeTrimOffset(audioBuffer) {
    const threshold = 0.015;
    const length = audioBuffer.length;
    let firstLoud = length;
    for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
      const data = audioBuffer.getChannelData(ch);
      for (let i = 0; i < firstLoud; i++) {
        if (Math.abs(data[i]) > threshold) {
          firstLoud = i;
          break;
        }
      }
    }
    const offset = Math.max(0, firstLoud / audioBuffer.sampleRate - 0.005);
    return offset < audioBuffer.duration - 0.05 ? offset : 0;
  }

  getDurationMs() {
    if (this.buffer) {
      const d = (this.buffer.duration - this.trimOffset) * 1000;
      return Math.max(600, Math.min(d, 2800));
    }
    if (this.fallbackAudio && Number.isFinite(this.fallbackAudio.duration) && this.fallbackAudio.duration > 0) {
      return Math.max(600, Math.min(this.fallbackAudio.duration * 1000, 2800));
    }
    return 950;
  }

  async ensureWebAudio() {
    if (this.failedWebAudio) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      this.failedWebAudio = true;
      return;
    }
    if (!PrioritySound.sharedCtx) PrioritySound.sharedCtx = new AudioCtx();
    const ctx = PrioritySound.sharedCtx;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    if (!this.buffer && !this.loading) {
      this.loading = true;
      try {
        const res = await fetch(this.src);
        if (!res.ok) throw new Error('Load failed');
        const decoded = await ctx.decodeAudioData(await res.arrayBuffer());
        this.trimOffset = this.computeTrimOffset(decoded);
        this.buffer = decoded;
      } catch {
        this.failedWebAudio = true;
      } finally {
        this.loading = false;
      }
    }
  }

  playWebAudio() {
    const ctx = PrioritySound.sharedCtx;
    const now = ctx.currentTime;
    let startAt = now;

    if (this.lastScheduledVoice && this.lastScheduledStart > now) {
      try {
        this.lastScheduledVoice.source.stop();
        this.lastScheduledVoice.source.disconnect();
      } catch {}
      startAt = this.lastScheduledStart;
    } else if (this.lastScheduledVoice && now < this.lastScheduledStart + this.MIN_SLICE) {
      startAt = this.lastScheduledStart + this.MIN_SLICE;
      const prev = this.lastScheduledVoice;
      const fadeStart = Math.max(now, startAt - 0.008);
      try {
        prev.gain.gain.cancelScheduledValues(fadeStart);
        prev.gain.gain.setValueAtTime(1, fadeStart);
        prev.gain.gain.linearRampToValueAtTime(0, startAt);
        prev.source.stop(startAt + 0.005);
      } catch {}
    } else if (this.lastScheduledVoice) {
      const prev = this.lastScheduledVoice;
      try {
        prev.gain.gain.cancelScheduledValues(now);
        prev.gain.gain.setValueAtTime(1, now);
        prev.gain.gain.linearRampToValueAtTime(0, now + 0.008);
        prev.source.stop(now + 0.01);
      } catch {}
    }

    const isSpamming = this.prevClickTime >= 0 && startAt - this.prevClickTime < 0.25;
    this.prevClickTime = startAt;

    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = this.buffer;

    if (isSpamming) {
      source.playbackRate.setValueAtTime(1.45, startAt);
      source.playbackRate.setTargetAtTime(1.0, startAt + 0.07, 0.04);
    } else {
      source.playbackRate.setValueAtTime(1.0, startAt);
    }

    gain.gain.setValueAtTime(0, startAt);
    gain.gain.linearRampToValueAtTime(1, startAt + 0.005);

    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(startAt, this.trimOffset);

    this.lastScheduledStart = startAt;
    this.lastScheduledVoice = { source, gain };
  }

  initFallback() {
    if (!this.fallbackAudio) {
      this.fallbackAudio = new Audio(this.src);
      this.fallbackAudio.preload = 'auto';
    }
  }

  stopFallback() {
    clearTimeout(this.fbPendingTimer);
    clearTimeout(this.fbSpeedTimer);
    if (this.fallbackAudio) {
      this.fallbackAudio.pause();
      this.fallbackAudio.currentTime = 0;
    }
  }

  playFallback() {
    this.initFallback();
    const now = performance.now();
    const minMs = 90;
    const elapsed = now - this.fbLastPlay;

    const triggerNow = () => {
      const t = performance.now();
      const isSpam = this.fbLastPlay > 0 && t - this.fbLastPlay < 250;
      this.fbLastPlay = t;
      try {
        this.fallbackAudio.pause();
        this.fallbackAudio.currentTime = 0;
        this.fallbackAudio.playbackRate = isSpam ? 1.38 : 1.0;
        this.fallbackAudio.play().catch(() => {});
        clearTimeout(this.fbSpeedTimer);
        if (isSpam) {
          this.fbSpeedTimer = setTimeout(() => {
            if (this.fallbackAudio) this.fallbackAudio.playbackRate = 1.0;
          }, 110);
        }
      } catch {}
    };

    clearTimeout(this.fbPendingTimer);
    if (elapsed < minMs) {
      this.fbPendingTimer = setTimeout(triggerNow, minMs - elapsed);
    } else {
      triggerNow();
    }
  }

  play() {
    this.ensureWebAudio();
    if (PrioritySound.sharedCtx && this.buffer) {
      this.stopFallback();
      this.playWebAudio();
      return;
    }
    this.playFallback();
  }
}

export class ElasticCat {
  constructor(el, sound, onRightClick, onTap) {
    this.el = el;
    this.visual = el.querySelector('.cat-visual');
    this.shadow = el.querySelector('.cat-shadow');
    this.sound = sound;
    this.onRightClick = onRightClick;
    this.onTap = onTap;

    this.sx = 1;
    this.sy = 1;
    this.skew = 0;
    this.targetSx = 1;
    this.targetSy = 1;
    this.targetSkew = 0;
    this.vx = 0;
    this.vy = 0;
    this.vSkew = 0;

    this.isDragging = false;
    this.activePointerId = null;
    this.startX = 0;
    this.startY = 0;
    this.moved = false;
    this.rafId = null;
    this.lastTime = 0;

    this.bindEvents();
  }

  bindEvents() {
    this.el.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      this.activePointerId = e.pointerId;
      this.el.setPointerCapture(e.pointerId);
      this.isDragging = true;
      this.moved = false;
      this.startX = e.clientX;
      this.startY = e.clientY;
      this.vy -= 1.8;
      this.vx += 1.2;
      this.sound.play();
      this.startLoop();
    });

    this.el.addEventListener('pointermove', (e) => {
      if (!this.isDragging || e.pointerId !== this.activePointerId) return;
      const dx = e.clientX - this.startX;
      const dy = e.clientY - this.startY;
      if (Math.hypot(dx, dy) > 8) this.moved = true;

      if (dy < 0) {
        const upFactor = Math.tanh(-dy / 160);
        this.targetSy = 1 + upFactor * 0.85;
        this.targetSx = 1 / Math.pow(this.targetSy, 0.45);
      } else {
        const downFactor = Math.tanh(dy / 130);
        this.targetSy = 1 - downFactor * 0.56;
        this.targetSx = 1 / Math.pow(this.targetSy, 0.48);
      }
      this.targetSkew = -Math.tanh(dx / 150) * 24;
    });

    const release = (e) => {
      if (!this.isDragging || e.pointerId !== this.activePointerId) return;
      this.isDragging = false;
      this.activePointerId = null;
      this.sound.ensureWebAudio();

      if (!this.moved) {
        this.sy = Math.min(this.sy, 0.8);
        this.sx = Math.max(this.sx, 1.16);
        this.vy = -1.6;
        if (e.type === 'pointerup' && this.onTap) this.onTap();
      }
      this.targetSx = 1;
      this.targetSy = 1;
      this.targetSkew = 0;
      this.startLoop();
    };

    this.el.addEventListener('pointerup', release);
    this.el.addEventListener('pointercancel', release);
    this.el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.onRightClick();
    });
    this.el.addEventListener('dragstart', (e) => e.preventDefault());
  }

  startLoop() {
    if (this.rafId) return;
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame((now) => this.tick(now));
  }

  tick(now) {
    const dt = Math.min((now - this.lastTime) / 1000, 0.025);
    this.lastTime = now;

    const stiffness = this.isDragging ? 300 : 250;
    const damping = this.isDragging ? 26 : 13;

    this.vx += ((this.targetSx - this.sx) * stiffness - this.vx * damping) * dt;
    this.vy += ((this.targetSy - this.sy) * stiffness - this.vy * damping) * dt;
    this.vSkew += ((this.targetSkew - this.skew) * stiffness - this.vSkew * damping) * dt;

    this.sx += this.vx * dt;
    this.sy += this.vy * dt;
    this.skew += this.vSkew * dt;

    this.visual.style.transform = `scale(${this.sx.toFixed(4)}, ${this.sy.toFixed(4)}) skewX(${this.skew.toFixed(2)}deg)`;
    this.shadow.style.transform = `scaleX(${(1 + (this.sx - 1) * 0.7).toFixed(4)})`;

    const settled =
      !this.isDragging &&
      Math.abs(1 - this.sx) < 0.001 &&
      Math.abs(1 - this.sy) < 0.001 &&
      Math.abs(this.skew) < 0.05 &&
      Math.abs(this.vx) < 0.005 &&
      Math.abs(this.vy) < 0.005 &&
      Math.abs(this.vSkew) < 0.05;

    if (settled) {
      this.sx = 1;
      this.sy = 1;
      this.skew = 0;
      this.vx = 0;
      this.vy = 0;
      this.vSkew = 0;
      this.visual.style.transform = '';
      this.shadow.style.transform = '';
      this.rafId = null;
      return;
    }

    this.rafId = requestAnimationFrame((t) => this.tick(t));
  }
}

const SOUNDS = ['/assets/miaw.mp3', '/assets/blublub.mp3'];
const soundPool = new Map();
SOUNDS.forEach((src) => soundPool.set(src, new PrioritySound(src)));

export function initCats(root = document) {
  root.querySelectorAll('.cat-interactive').forEach((el) => {
    if (el.dataset.catReady) return;
    el.dataset.catReady = '1';
    const src = el.getAttribute('data-sound') || '';
    const catId = el.dataset.cat || (src.includes('blublub') ? '2' : '1');
    if (!soundPool.has(src)) soundPool.set(src, new PrioritySound(src));
    new ElasticCat(
      el,
      soundPool.get(src),
      () => toast('Hey! No right-clicking the cats.'),
      () => recordCatTap(catId)
    );
  });
}