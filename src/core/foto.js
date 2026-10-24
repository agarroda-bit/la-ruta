// Modo foto: cámara libre alrededor de la escena (arrastrar = girar, pellizco/rueda = zoom),
// filtros, marco con el nombre de la etapa y guardar la imagen en el móvil.
// Las últimas fotos quedan en miniatura en el álbum del juego (save.data.photos).
import * as THREE from 'three';
import { engine } from './engine.js';
import { save } from './save.js';
import { audio } from './audio.js';
import { input } from './input.js';
import { h, esc, button, toast, uiRoot } from './ui.js';
import { unlockSticker } from './game.js';
import { clamp } from './util.js';

// Filtros como matrices de color 4×5 (mismas fórmulas que feColorMatrix) para que el
// resultado guardado sea igual que la vista previa CSS en todos los navegadores.
const FILTROS = [
  { id: 'normal', name: 'Normal', css: 'none', ops: [] },
  { id: 'atardecer', name: 'Atardecer', css: 'sepia(.25) saturate(1.4) hue-rotate(-12deg) brightness(1.05)', ops: [['sepia', 0.25], ['saturate', 1.4], ['hue', -12], ['brightness', 1.05]] },
  { id: 'neon', name: 'Neón', css: 'saturate(1.8) contrast(1.15) hue-rotate(14deg)', ops: [['saturate', 1.8], ['contrast', 1.15], ['hue', 14]] },
  { id: 'postal', name: 'Postal', css: 'sepia(.55) contrast(.92) brightness(1.08)', ops: [['sepia', 0.55], ['contrast', 0.92], ['brightness', 1.08]] },
  { id: 'bn', name: 'B/N', css: 'grayscale(1) contrast(1.25)', ops: [['grayscale', 1], ['contrast', 1.25]] },
];

function matFor(op, v) {
  if (op === 'saturate') return [0.213 + 0.787 * v, 0.715 - 0.715 * v, 0.072 - 0.072 * v, 0, 0.213 - 0.213 * v, 0.715 + 0.285 * v, 0.072 - 0.072 * v, 0, 0.213 - 0.213 * v, 0.715 - 0.715 * v, 0.072 + 0.928 * v, 0];
  if (op === 'grayscale') { const s = 1 - v; return matFor('saturate', s); }
  if (op === 'sepia') { const a = 1 - v; return [0.393 + 0.607 * a, 0.769 - 0.769 * a, 0.189 - 0.189 * a, 0, 0.349 - 0.349 * a, 0.686 + 0.314 * a, 0.168 - 0.168 * a, 0, 0.272 - 0.272 * a, 0.534 - 0.534 * a, 0.131 + 0.869 * a, 0]; }
  if (op === 'brightness') return [v, 0, 0, 0, 0, v, 0, 0, 0, 0, v, 0];
  if (op === 'contrast') { const o = 0.5 - 0.5 * v; return [v, 0, 0, o, 0, v, 0, o, 0, 0, v, o]; }
  if (op === 'hue') {
    const a = (v * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    return [0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928, 0,
      0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283, 0,
      0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072, 0];
  }
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
}
function applyFilter(g, w, hh, filtro) {
  if (!filtro.ops.length) return;
  const img = g.getImageData(0, 0, w, hh), d = img.data;
  const ms = filtro.ops.map(([o, v]) => matFor(o, v));
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i] / 255, gg = d[i + 1] / 255, b = d[i + 2] / 255;
    for (const m of ms) {
      const nr = m[0] * r + m[1] * gg + m[2] * b + m[3], ng = m[4] * r + m[5] * gg + m[6] * b + m[7], nb = m[8] * r + m[9] * gg + m[10] * b + m[11];
      r = clamp(nr, 0, 1); gg = clamp(ng, 0, 1); b = clamp(nb, 0, 1);
    }
    d[i] = r * 255; d[i + 1] = gg * 255; d[i + 2] = b * 255;
  }
  g.putImageData(img, 0, 0);
}

export function openPhotoMode(current) {
  if (!current || document.querySelector('.foto-ui')) return;
  const cam = current.inst.camera;
  const saved = { pos: cam.position.clone(), quat: cam.quaternion.clone(), fov: cam.fov };
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
  const target = cam.position.clone().addScaledVector(fwd, 7);
  const off = cam.position.clone().sub(target);
  const sph = new THREE.Spherical().setFromVector3(off);
  const base = { r: sph.radius };
  sph.radius *= 1.35; // empieza algo más lejos para que quepa la escena
  let filtro = FILTROS[0], marco = true;

  document.querySelectorAll('.panel-pausa').forEach((e) => e.remove());
  document.body.classList.add('modo-foto');
  input.hideTouch();

  const ui = h('div', 'foto-ui no-ctrl');
  ui.innerHTML = `
    <div class="foto-arriba"><div class="foto-filtros"></div></div>
    <div class="foto-ayuda">Arrastra para mover la cámara · pellizca para acercar</div>
    <div class="foto-marco-prev"><span>LA RUTA · ${esc(current.def.name.toUpperCase())}</span></div>
    <div class="foto-abajo"></div>`;
  uiRoot().appendChild(ui);
  const fl = ui.querySelector('.foto-filtros');
  for (const f of FILTROS) {
    const b = h('button', 'opcion' + (f === filtro ? ' on' : ''), f.name);
    b.addEventListener('click', (e) => { e.stopPropagation(); filtro = f; engine.canvas.style.filter = f.css; fl.querySelectorAll('.opcion').forEach((x) => x.classList.toggle('on', x === b)); audio.sfx('click'); });
    fl.appendChild(b);
  }
  const ab = ui.querySelector('.foto-abajo');
  const bMarco = button('🖼 Marco: sí', () => { marco = !marco; bMarco.textContent = '🖼 Marco: ' + (marco ? 'sí' : 'no'); ui.querySelector('.foto-marco-prev').style.display = marco ? '' : 'none'; });
  const shutter = h('button', 'foto-disparo', '<span></span>');
  shutter.setAttribute('aria-label', 'Hacer foto');
  shutter.addEventListener('click', (e) => { e.stopPropagation(); take(); });
  ab.append(button('✕ Salir', () => close()), shutter, bMarco);

  // cámara orbital
  const ptrs = new Map();
  let pinch0 = 0, r0 = sph.radius;
  const onDown = (e) => { if (e.target.closest('button')) return; ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); r0 = sph.radius; } };
  const onMove = (e) => {
    const p = ptrs.get(e.pointerId); if (!p) return;
    if (ptrs.size === 1) {
      sph.theta -= (e.clientX - p.x) * 0.008;
      sph.phi = clamp(sph.phi - (e.clientY - p.y) * 0.006, 0.15, Math.PI / 2 + 0.25);
    }
    p.x = e.clientX; p.y = e.clientY;
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch0 > 0) sph.radius = clamp(r0 * (pinch0 / d), base.r * 0.25, base.r * 3); }
  };
  const onUp = (e) => { ptrs.delete(e.pointerId); pinch0 = 0; };
  const onWheel = (e) => { sph.radius = clamp(sph.radius * (1 + e.deltaY * 0.001), base.r * 0.25, base.r * 3); };
  ui.addEventListener('pointerdown', onDown);
  addEventListener('pointermove', onMove);
  addEventListener('pointerup', onUp);
  addEventListener('pointercancel', onUp);
  ui.addEventListener('wheel', onWheel, { passive: true });
  const tick = (dt, realDt) => {
    // teclado / mando también mueven la cámara
    sph.theta -= input.x * realDt * 1.5;
    sph.phi = clamp(sph.phi - input.y * realDt * 1.2, 0.15, Math.PI / 2 + 0.25);
    const v = new THREE.Vector3().setFromSpherical(sph).add(target);
    cam.position.copy(v); cam.lookAt(target);
  };
  engine.onFrame.add(tick);
  const offKeys = input.onAny((k, id) => { if (id === 'Enter' || id === 'Space') take(); });

  function close() {
    engine.onFrame.delete(tick);
    removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp); removeEventListener('pointercancel', onUp);
    offKeys();
    cam.position.copy(saved.pos); cam.quaternion.copy(saved.quat);
    engine.canvas.style.filter = '';
    document.body.classList.remove('modo-foto');
    ui.remove();
    document.querySelectorAll('.foto-previa').forEach((e) => e.remove());
    import('./game.js').then((m) => { m.togglePause(false); m.togglePause(true); });
  }

  async function take() {
    const canvas = await engine.snapshot();
    const W = canvas.width, H = canvas.height;
    const pad = marco ? Math.round(W * 0.035) : 0, foot = marco ? Math.round(W * 0.12) : 0;
    const out = document.createElement('canvas');
    out.width = W + pad * 2; out.height = H + pad + (marco ? foot : 0);
    const g = out.getContext('2d');
    if (marco) { g.fillStyle = '#fff8ec'; g.fillRect(0, 0, out.width, out.height); }
    g.drawImage(canvas, pad, pad);
    // filtro solo sobre la foto (no sobre el marco)
    const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H;
    const tg = tmp.getContext('2d'); tg.drawImage(canvas, 0, 0); applyFilter(tg, W, H, filtro);
    g.drawImage(tmp, pad, pad);
    if (marco) {
      const s = out.width / 1000;
      g.fillStyle = '#1a1036';
      g.font = `${Math.round(46 * s)}px Bungee`;
      g.fillText(`LA RUTA · ${current.def.name.toUpperCase()}`, pad, H + pad + foot * 0.52);
      g.font = `700 ${Math.round(28 * s)}px "Baloo 2"`;
      const d = new Date();
      g.fillText(`${save.data.names[0]} y ${save.data.names[1]} · ${d.toLocaleDateString('es-ES')}`, pad, H + pad + foot * 0.85);
      // sello
      g.save(); g.translate(out.width - pad - 70 * s, H + pad + foot * 0.5); g.rotate(-0.2);
      g.strokeStyle = current.def.color; g.lineWidth = 5 * s; g.beginPath(); g.arc(0, 0, 52 * s, 0, Math.PI * 2); g.stroke();
      g.fillStyle = current.def.color; g.font = `${Math.round(20 * s)}px Bungee`; g.textAlign = 'center'; g.fillText(`ETAPA ${current.def.num}`, 0, 8 * s); g.restore();
    }
    audio.sfx('photo');
    const flash = h('div', 'foto-flash'); uiRoot().appendChild(flash); setTimeout(() => flash.remove(), 400);
    save.addStat('fotos');
    if ((save.data.stats.fotos | 0) >= 5) unlockSticker('fotografo');
    // miniatura para el álbum del juego (máx. 12)
    try {
      const th = document.createElement('canvas'); const tw = 360; th.width = tw; th.height = Math.round(tw * out.height / out.width);
      th.getContext('2d').drawImage(out, 0, 0, th.width, th.height);
      save.data.photos = [{ stage: current.def.id, date: Date.now(), img: th.toDataURL('image/jpeg', 0.72) }, ...(save.data.photos || [])].slice(0, 12);
      save.flush();
    } catch (e) { /* sin espacio: da igual */ }
    out.toBlob((blob) => showPreview(blob, out.toDataURL('image/jpeg', 0.8)), 'image/png');
  }

  function showPreview(blob, url) {
    document.querySelectorAll('.foto-previa').forEach((e) => e.remove());
    const p = h('div', 'panel foto-previa no-ctrl');
    p.innerHTML = `<img alt="Foto" src="${url}"><div class="foto-previa-botones"></div>`;
    const file = new File([blob], `la-ruta-${current.def.id}-${Date.now()}.png`, { type: 'image/png' });
    const bx = p.querySelector('.foto-previa-botones');
    bx.append(
      button('💾 Guardar en el móvil', async () => {
        // en iPhone, el menú de compartir tiene «Guardar imagen» (va a Fotos)
        try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'La Ruta' }); p.remove(); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
        toast('📷 Foto guardada en Descargas'); p.remove();
      }, 'grande'),
      button('Otra', () => p.remove()),
    );
    uiRoot().appendChild(p);
  }
}
