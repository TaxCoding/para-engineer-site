// Pembungkus Web Serial + esptool-js v0.7.1 (Uint8Array) tanpa npm/build step.
import { api } from '../data/api.js';

export const SERIAL_DRIVERS = [
  { name: 'CP210x (Silicon Labs)', url: 'https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers' },
  { name: 'CH340 / CH341 (WCH)', url: 'https://www.wch-ic.com/downloads/CH341SER_EXE.html' },
  { name: 'FTDI VCP Drivers', url: 'https://ftdichip.com/drivers/vcp-drivers/' },
];

export function checkSerialSupport() {
  const secure = window.isSecureContext;
  const supported = 'serial' in navigator;
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  return {
    ok: secure && supported && !isMobile,
    secure,
    supported,
    isMobile,
  };
}

export async function testSerialPort() {
  const port = await navigator.serial.requestPort();
  const info = port.getInfo ? port.getInfo() : {};
  return { port, info };
}

export async function flashFirmwareFromConfig(deployConfig, { baudrate = 460800, eraseAll = false, compress = true, onLog, onProgress } = {}) {
  const log = (msg) => onLog?.(msg);
  const progress = (pct, label) => onProgress?.(pct, label);

  // 1. Minta izin port serial DULUAN (harus tepat di dalam click gesture browser)
  const port = await navigator.serial.requestPort();

  // 2. Muat esptool-js bundle lokal (patuh CSP script-src 'self')
  let ESPLoader, Transport;
  try {
    ({ ESPLoader, Transport } = await import('/js/vendor/esptool-bundle.js'));
  } catch {
    throw new Error('File /js/vendor/esptool-bundle.js belum ditemukan. Download dari unpkg.com/esptool-js@0.7.1/bundle.js.');
  }

  // 3. Unduh semua file .bin dari Worker proxy sebagai Uint8Array (wajib di esptool-js >= 0.6)
  const files = deployConfig.files || [];
  if (!files.length) throw new Error('Daftar file .bin kosong.');

  const fileArray = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    progress(Math.round((i / files.length) * 20), `Downloading ${f.name}...`);
    log(`Downloading ${f.path} (${f.address})...`);
    const url = typeof api.firmwareUrl === 'function'
      ? api.firmwareUrl({ repo: deployConfig.repo, branch: deployConfig.branch, path: f.path })
      : '';
    if (!url) throw new Error('Firmware proxy URL tidak tersedia (butuh mode Edge Worker).');

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Gagal mengunduh ${f.name} (${res.status})`);
    const buf = await res.arrayBuffer();
    fileArray.push({
      data: new Uint8Array(buf),
      address: parseInt(f.address, 16) || 0,
    });
  }

  // 4. Hubungkan ke chip & tulis Flash
  const transport = new Transport(port, true);
  const terminal = {
    clean() {},
    writeLine(line) { if (line) log(line); },
    write(chunk) { if (chunk && chunk.trim()) log(chunk.trim()); },
  };

  try {
    progress(25, 'Connecting to bootloader...');
    const esploader = new ESPLoader({
      transport,
      baudrate: Number(baudrate) || 460800,
      romBaudrate: 115200,
      terminal,
    });

    const chip = await esploader.main();
    log(`Chip terdeteksi: ${chip}`);
    progress(35, `Flashing ${chip}...`);

    await esploader.writeFlash({
      fileArray,
      flashSize: deployConfig.flashSettings?.flashSize || 'keep',
      flashMode: deployConfig.flashSettings?.flashMode || 'keep',
      flashFreq: deployConfig.flashSettings?.flashFreq || 'keep',
      eraseAll: Boolean(eraseAll),
      compress: Boolean(compress),
      reportProgress(fileIndex, written, total) {
        const fileShare = 60 / fileArray.length;
        const base = 35 + fileIndex * fileShare;
        const pct = Math.min(96, Math.round(base + (written / Math.max(total, 1)) * fileShare));
        const name = files[fileIndex]?.name || `file ${fileIndex + 1}`;
        progress(pct, `Writing ${name} (${Math.round((written / Math.max(total, 1)) * 100)}%)`);
      },
    });

    progress(98, 'Resetting board...');
    await esploader.after('hard_reset');
    progress(100, 'Deploy complete!');
    log('Selesai! Board berhasil di-reset dan menjalankan firmware.');
  } finally {
    await transport.disconnect().catch(() => {});
  }
}

export async function openSerialMonitor({ baudRate = 115200, onData, onClose } = {}) {
  const port = await navigator.serial.requestPort();
  await port.open({ baudRate });

  const decoder = new TextDecoderStream();
  const readableClosed = port.readable.pipeTo(decoder.writable).catch(() => {});
  const reader = decoder.readable.getReader();
  let active = true;

  (async () => {
    try {
      while (active) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) onData?.(value);
      }
    } catch {}
    onClose?.();
  })();

  return async function closeMonitor() {
    active = false;
    try { await reader.cancel(); } catch {}
    await readableClosed;
    try { await port.close(); } catch {}
  };
}