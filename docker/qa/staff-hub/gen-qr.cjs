/**
 * Generates QR-code PNGs for every SmartMenu role panel, encoding the
 * LAN-reachable raw-IP URL so staff can scan them from a phone (no DNS needed).
 *
 * Run:  node gen-qr.cjs            (uses the default LAN IP below)
 *       node gen-qr.cjs 10.0.0.5   (override the server IP, dashed form auto-derived)
 *
 * No network access required: relies on the locally-installed `qrcode` package.
 */
const path = require('path');
const fs = require('fs');

// Resolve the qrcode module: prefer a normal require, fall back to the npx cache.
let QRCode;
try {
  QRCode = require('qrcode');
} catch {
  const cached = 'C:/Users/Signos admin/AppData/Local/npm-cache/_npx/934e343ed3b069fe/node_modules/qrcode';
  QRCode = require(cached);
}

// Server IP (dotted). Override via argv[2]. nip.io needs the dashed form.
// El default debe coincidir con QA_LAN_IP en docker/qa/.env (lo escribe update-lan-ip.ps1).
const ip = process.argv[2] || '172.31.98.87';
const dashed = ip.replace(/\./g, '-');
// DNS-free: IP cruda + puerto por panel. El cell NO necesita resolver nip.io
// (su router suele bloquear DNS que apunta a IP privada). Solo acepta el cert una vez.
const ipurl = (port, p = '/') => `https://${ip}:${port}${p}`;

// Los puertos deben coincidir con los bloques `{$QA_LAN_IP}:PUERTO` del
// docker/qa/caddy/Caddyfile. El :8443 del host mapea al :443 del contenedor
// (landing / hub / qa.smartmenu.local) — NO sirve el client-app: ese va en :8451.
const targets = {
  client:      ipurl(8451, '/'),        // client-app PWA (bloque {$QA_LAN_IP}:8451)
  admin:       ipurl(8444, '/login'),
  kds:         ipurl(8445, '/login'),   // Cocina
  bar:         ipurl(8455, '/login'),   // Bar (2º origen del KDS)
  waiter:      ipurl(8446, '/login'),
  host:        ipurl(8447, '/login'),
  cashier:     ipurl(8448, '/login'),
  reservation: ipurl(8449, '/login'),
  delivery:    ipurl(8452, '/login'),
};

const outDir = path.join(__dirname, 'qr');
fs.mkdirSync(outDir, { recursive: true });

const opts = { width: 512, margin: 2, errorCorrectionLevel: 'M' };

(async () => {
  for (const [name, url] of Object.entries(targets)) {
    const file = path.join(outDir, `${name}.png`);
    await QRCode.toFile(file, url, opts);
    const kb = (fs.statSync(file).size / 1024).toFixed(1);
    console.log(`  ${name.padEnd(12)} -> ${url}   (${kb} KB)`);
  }
  console.log(`\nDone. ${Object.keys(targets).length} QR PNGs written to ${outDir}`);
})().catch((e) => { console.error('QR generation failed:', e.message); process.exit(1); });
