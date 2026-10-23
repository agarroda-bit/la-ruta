// Genera los PNG del icono a partir de public/icons/icono.svg (con Chromium de Playwright).
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
const svg = readFileSync('public/icons/icono.svg', 'utf8');
const b = await chromium.launch();
for (const s of [180, 192, 512]) {
  const p = await b.newPage({ viewport: { width: s, height: s } });
  await p.setContent(`<html><body style="margin:0">${svg.replace('<svg ', `<svg width="${s}" height="${s}" `)}</body></html>`);
  await p.screenshot({ path: `public/icons/icono-${s}.png` });
}
await b.close();
console.log('iconos listos');
