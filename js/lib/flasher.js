// Mesin Web Serial + esptool-js v0.7.1 (ingat port, deteksi USB colok/cabut, driver)
import { api } from '../data/api.js';

export const SERIAL_DRIVERS = [
  { name: 'CP210x (Silicon Labs)', url: 'https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers' },
  { name: 'CH340 / CH341 (WCH)', url: 'https://www.wch-ic.com/downloads/CH341SER_EXE.html' },
  { name: 'FTDI VCP Drivers', url: 'https://ftdichip.com/drivers/vcp-drivers/' },
];

const KNOWN_USB = {
  '10c4:ea60': 'Silicon Labs CP210x',
  '10c4:ea70': 'Silicon Labs CP2105',
  '1a86:7523': 'WCH CH340',
  '1a86:5523': 'WCH CH341',
  '1a86:55d4': 'WCH CH9102',
  '0403:6001': 'FTDI FT232R',
  '0403:6015': 'FTDI FT-X',
  '303a:1001': 'Espressif ESP32 USB-JTAG',
  '303a:0002': 'Espressif ESP32-S2',
};

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

export function describePort(port) {
  if (!port || typeof port.getInfo !== 'function') return 'USB Serial Port';
  const info = port.getInfo() || {};
  if (!info.usbVendorId) return 'Serial Port';
  const vid = info.usbVendorId.toString(16).padStart(4, '0').toLowerCase();
  const pid = (info.usbProductId || 0).toString(16).padStart(4, '0').toLowerCase();
  const key = `${vid}:${pid}`;
  const label = KNOWN_USB[key] || (vid === '303a' ? 'Espressif USB Serial' : 'USB Serial');
  return `${label} (${vid.toUpperCase()}:${pid.toUpperCase()})`;
}

export async function getAuthorizedPort() {
  if (!('serial' in navigator)) return null;
  const ports = await navigator.serial.getPorts().catch(() => []);
  return ports[0] || null;
}

export async function pickSerialPort({ forceNew = false } = {}) {
  if (!forceNew) {
    const existing = await getAuthorizedPort();
    if (existing) return existing;
  }
  return navigator.serial.requestPort();
}

export async function testSerialPort(portOverride = null) {
  const port = portOverride || (await pickSerialPort());
  const label = describePort(port);

  // Uji buka & tutup port untuk memastikan board benar-benar terkoneksi & tidak dikunci app lain
  if (!port.readable && !port.writable) {
    try {
      await port.open({ baudRate: 115200 });
      await port.close();
    } catch (err) {
      if (err?.name === 'InvalidStateError') {
        // Port memang sudah terbuka oleh monitor kita sendiri -> dianggap terhubung
        return { port, label, busyByOther: false };
      }
      throw new Error(`Port ${label} terdeteksi tapi gagal dibuka (${err.message}). Pastikan tidak dipakai aplikasi lain.`);
    }
  }
  return { port, label, busyByOther: false };
}

export function subscribeSerialEvents({ onConnect, onDisconnect } = {}) {
  if (!('serial' in navigator)) return () => {};
  const handleConnect = (e) => onConnect?.(e.target);
  const handleDisconnect = (e) => onDisconnect?.(e.target);
  navigator.serial.addEventListener('connect', handleConnect);
  navigator.serial.addEventListener('disconnect', handleDisconnect);
  return () => {
    navigator.serial.removeEventListener('connect', handleConnect);
    navigator.serial.removeEventListener('disconnect', handleDisconnect);
  };
}

export async function flashFirmwareFromConfig(
  deployConfig,
  { port: portArg = null, baudrate = 460800, eraseAll = false, compress = true, onLog, onProgress } = {}
) {
  const log = (msg) => onLog?.(msg);
  const progress = (pct, label) => onProgress?.(pct, label);

  // 1. Pakai port yang diingat atau minta user pilih di browser
  const port = portArg || (await pickSerialPort());
  const portLabel = describePort(port);
  log(`Menggunakan perangkat: ${portLabel}`);

  // 2. Muat bundle esptool-js lokal
  let ESPLoader, Transport;
  try {
    ({ ESPLoader, Transport } = await import('/js/vendor/esptool-bundle.js'));
  } catch {
    throw new Error('File /js/vendor/esptool-bundle.js belum ditemukan.');
  }

  // 3. Unduh semua .bin sebagai Uint8Array
  const files = deployConfig.files || [];
  if (!files.length) throw new Error('Daftar file .bin kosong.');

  const fileArray = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    progress(Math.round((i / files.length) * 20), `Downloading ${f.name}...`);
    log(`Downloading ${f.path} (${f.address})...`);
    const url =
      typeof api.firmwareUrl === 'function'
        ? api.firmwareUrl({ repo: deployConfig.repo, branch: deployConfig.branch, path: f.path })
        : '';
    if (!url) throw new Error('Firmware proxy URL tidak tersedia.');

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Gagal mengunduh ${f.name} (${res.status})`);
    const buf = await res.arrayBuffer();
    fileArray.push({
      data: new Uint8Array(buf),
      address: parseInt(f.address, 16) || 0,
    });
  }

  // 4. Flash via Web Serial
  const transport = new Transport(port, true);
  const terminal = {
    clean() {},
    writeLine(line) {
      if (line) log(line);
    },
    write(chunk) {
      if (chunk && chunk.trim()) log(chunk.trim());
    },
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
    return port;
  } finally {
    await transport.disconnect().catch(() => {});
  }
}

export async function openSerialMonitor({ port: portArg = null, baudRate = 115200, onData, onClose } = {}) {
  const port = portArg || (await pickSerialPort());
  if (!port.readable) {
    await port.open({ baudRate });
  }

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
    if (active) {
      active = false;
      onClose?.('disconnected');
    }
  })();

  return {
    port,
    async close() {
      if (!active) return;
      active = false;
      try { await reader.cancel(); } catch {}
      await readableClosed;
      try { await port.close(); } catch {}
    },
  };
}