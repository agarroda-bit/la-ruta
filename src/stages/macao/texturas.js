// MACAO · texturas dibujadas con canvas (asfalto mojado, calçada portuguesa, fachadas
// pastel con azulejos, atlas de neones inventados).
import * as THREE from 'three';
import { canvasTexture } from '../../core/util.js';

const R = Math.random; // solo aspecto visual

export function asphaltTex() {
  return canvasTexture(64, 128, (c, W, H) => {
    c.fillStyle = '#2b2338'; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 380; i++) { c.fillStyle = `rgba(${R() < 0.5 ? '200,180,255' : '255,210,150'},${R() * 0.07})`; c.fillRect(R() * W, R() * H, 1 + R(), 1 + R()); }
    c.fillStyle = '#ffb703'; c.fillRect(2, 0, 2, H); c.fillRect(W - 4, 0, 2, H);
    c.fillStyle = '#efe6ff'; c.fillRect(W / 2 - 1, 0, 2, H * 0.45);
  });
}

export function cobbleTex() {
  return canvasTexture(128, 128, (c, W, H) => {
    c.fillStyle = '#2e2433'; c.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 16) for (let x = (y / 16) % 2 ? -8 : 0; x < W; x += 16) {
      const l = 52 + R() * 22; c.fillStyle = `hsl(${280 + R() * 30},14%,${l * 0.5}%)`;
      c.beginPath(); c.roundRect(x + 1.5, y + 1.5, 13, 13, 4); c.fill();
    }
  });
}

// Calçada portuguesa: piedra crema con ondas negras
export function calcadaTex() {
  return canvasTexture(128, 128, (c, W, H) => {
    c.fillStyle = '#d8c9b4'; c.fillRect(0, 0, W, H);
    c.strokeStyle = '#2b2233'; c.lineWidth = 9;
    for (let k = 0; k < 2; k++) {
      c.beginPath();
      for (let y = 0; y <= H; y += 4) { const x = W / 2 + Math.sin((y / H) * Math.PI * 2 + k * Math.PI) * 30 + (k ? 0 : 0); if (y === 0) c.moveTo(x, y); else c.lineTo(x, y); }
      c.stroke();
    }
    for (let i = 0; i < 500; i++) { c.fillStyle = `rgba(0,0,0,${R() * 0.12})`; c.fillRect(R() * W, R() * H, 2, 2); }
  });
}

// Fachada colonial: blanca (se tiñe en pastel por instancia), contraventanas, balcones de forja,
// franja de azulejos y tiendas abajo. Devuelve { map, emissive } (ventanas encendidas).
export function facadeTex(seed) {
  let s = seed * 9301 + 49297; const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const W = 256, H = 512;
  const lit = [];
  // a doble resolución para que no se vea pixelada de cerca
  const map = canvasTexture(W * 2, H * 2, (c) => {
    c.scale(2, 2);
    c.fillStyle = '#f4eee6'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, 24);
    c.fillStyle = '#c9bfb4'; c.fillRect(0, 24, W, 6);
    c.fillStyle = '#e4dbd0'; for (let x = 0; x < W; x += 16) c.fillRect(x, 30, 8, 5);
    for (let f = 0; f < 3; f++) {
      const top = 52 + f * 108;
      c.fillStyle = '#e8dfd4'; c.fillRect(0, top + 96, W, 4);
      for (let k = 0; k < 3; k++) {
        const x = 28 + k * 78;
        c.fillStyle = '#ffffff'; c.fillRect(x - 5, top - 5, 54, 82);
        c.fillStyle = '#2a2038'; c.fillRect(x, top, 44, 72);
        c.fillStyle = seed % 2 ? '#3f7d5c' : '#5b3f8c';
        if (rnd() < 0.6) { c.fillRect(x - 17, top, 13, 72); c.fillRect(x + 48, top, 13, 72); }
        // balcón de forja
        c.fillStyle = '#1b1622'; c.fillRect(x - 10, top + 54, 64, 3); c.fillRect(x - 10, top + 74, 64, 3);
        for (let b = 0; b <= 64; b += 6) c.fillRect(x - 10 + b, top + 54, 2, 22);
        if (rnd() < 0.5) lit.push([x, top, 44, 52]);
      }
    }
    // azulejos
    const y0 = 382;
    for (let x = 0; x < W; x += 12) for (let y = y0; y < y0 + 28; y += 12) {
      c.fillStyle = ((x + y) / 12) % 2 ? '#2f5fa8' : '#e9f0fb'; c.fillRect(x, y, 12, 12);
      c.fillStyle = ((x + y) / 12) % 2 ? '#e9f0fb' : '#2f5fa8'; c.beginPath(); c.moveTo(x + 6, y + 2); c.lineTo(x + 10, y + 6); c.lineTo(x + 6, y + 10); c.lineTo(x + 2, y + 6); c.fill();
    }
    // tiendas con arcos
    for (let k = 0; k < 2; k++) {
      const x = 22 + k * 118;
      c.fillStyle = '#ffffff'; c.beginPath(); c.roundRect(x - 6, 414, 104, 98, [50, 50, 0, 0]); c.fill();
      c.fillStyle = '#1a1020'; c.beginPath(); c.roundRect(x, 420, 92, 92, [46, 46, 0, 0]); c.fill();
    }
  });
  const emissive = canvasTexture(W * 2, H * 2, (c) => {
    c.scale(2, 2);
    c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
    const cols = ['#ffb347', '#ffd38a', '#ff9fc4', '#ffc070'];
    for (const [x, y, w, h] of lit) {
      const g = c.createLinearGradient(0, y, 0, y + h);
      const col = cols[Math.floor(rnd() * cols.length)];
      g.addColorStop(0, col); g.addColorStop(1, '#5a2a10');
      c.fillStyle = g; c.fillRect(x, y, w, h);
    }
    for (let k = 0; k < 2; k++) {
      const x = 22 + k * 118;
      const g = c.createLinearGradient(0, 420, 0, 512);
      g.addColorStop(0, '#ffcf7a'); g.addColorStop(1, '#a8501a');
      c.fillStyle = g; c.beginPath(); c.roundRect(x, 420, 92, 92, [46, 46, 0, 0]); c.fill();
    }
  });
  return { map, emissive };
}

// Atlas de neones inventados (solo castellano). 2 columnas × 8 filas, celdas 512×160.
export const SIGNS = [
  ['TARTAS DE NATA', '#ffb703'], ['FIDEOS 24H', '#c77dff'], ['TÉ CON LECHE', '#ffd166'], ['SOPA DE WANTÁN', '#e0aaff'],
  ['BOLLOS DE PIÑA', '#ffb703'], ['DIM SUM', '#ff70a6'], ['ALMENDRADOS', '#c77dff'], ['FARMACIA', '#7df9d3'],
  ['RELOJERÍA', '#ffcf5a'], ['ZAPATERÍA', '#b388ff'], ['HELADOS', '#ff70a6'], ['CAFÉ · PASTELES', '#ffb703'],
  ['¡ATAJO!  ›››', '#ff4fd8'], ['¡SALTO!', '#ffb703'], ['MUELLE · META', '#ffcf5a'], ['SALIDA', '#c77dff'],
];
export const SIGN_ID = { atajo: 12, salto: 13, meta: 14, salida: 15 };

export function signAtlas() {
  const CW = 512, CH = 160;
  const tex = canvasTexture(CW * 2, CH * 8, (c) => {
    c.fillStyle = '#000'; c.fillRect(0, 0, CW * 2, CH * 8);
    SIGNS.forEach(([text, col], i) => {
      const x0 = (i % 2) * CW, y0 = Math.floor(i / 2) * CH;
      c.save(); c.translate(x0, y0);
      c.fillStyle = '#170a28'; c.beginPath(); c.roundRect(6, 6, CW - 12, CH - 12, 22); c.fill();
      c.shadowColor = col; c.shadowBlur = 16; c.strokeStyle = col; c.lineWidth = 7;
      c.beginPath(); c.roundRect(16, 16, CW - 32, CH - 32, 16); c.stroke();
      c.lineWidth = 3; c.strokeStyle = '#ffffff'; c.globalAlpha = 0.6; c.stroke(); c.globalAlpha = 1;
      let size = 78;
      c.font = `900 ${size}px Bungee, "Arial Black", Impact, sans-serif`;
      const mw = c.measureText(text).width;
      if (mw > CW - 70) { size = Math.floor(size * (CW - 70) / mw); c.font = `900 ${size}px Bungee, "Arial Black", Impact, sans-serif`; }
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.shadowBlur = 26; c.fillStyle = col; c.fillText(text, CW / 2, CH / 2 + 4);
      c.shadowBlur = 8; c.fillStyle = mixWhite(col, 0.6); c.fillText(text, CW / 2, CH / 2 + 4);
      c.restore();
    });
  });
  tex.anisotropy = 4;
  return {
    tex,
    uv(i) { const u0 = (i % 2) / 2, v1 = 1 - Math.floor(i / 2) / 8; return [u0 + 0.004, v1 - 1 / 8 + 0.004, u0 + 0.5 - 0.004, v1 - 0.004]; },
  };
}

function mixWhite(hex, k) { const c = new THREE.Color(hex).lerp(new THREE.Color('#ffffff'), k); return '#' + c.getHexString(); }

// Rectángulo difuso (halos de neón, reflejos en el asfalto)
export function softRectTex() {
  return canvasTexture(64, 64, (c, W, H) => {
    const img = c.createImageData(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = Math.abs(x - W / 2 + 0.5) / (W / 2), dy = Math.abs(y - H / 2 + 0.5) / (H / 2);
      const d = Math.max(Math.pow(dx, 3), Math.pow(dy, 3)) * 0.6 + Math.hypot(dx, dy) * 0.4;
      const a = Math.max(0, 1 - d); const v = Math.round(255 * a * a);
      const o = (y * W + x) * 4; img.data[o] = img.data[o + 1] = img.data[o + 2] = v; img.data[o + 3] = 255;
    }
    c.putImageData(img, 0, 0);
  });
}

export function crateTex() {
  return canvasTexture(64, 64, (c, W, H) => {
    c.fillStyle = '#b07a3e'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#8a5a2b'; for (let y = 0; y < H; y += 16) c.fillRect(0, y, W, 3);
    c.strokeStyle = '#5a3a1e'; c.lineWidth = 5; c.strokeRect(2, 2, W - 4, H - 4);
    c.fillStyle = '#ff8c1a'; for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(12 + i * 10, 10, 5, 0, 7); c.fill(); }
  });
}

export function stripeTex(a, b) {
  return canvasTexture(64, 16, (c, W, H) => { for (let x = 0; x < W; x += 8) { c.fillStyle = (x / 8) % 2 ? a : b; c.fillRect(x, 0, 8, H); } });
}
