// Personajes low-poly con esqueleto sencillo (pivotes) para animarlos a mano.
// makeCharacter(look) → { group, rig, look, pose(nombre, t, peso), setLook(look) }
// Medidas: ~1,7 unidades de alto, mirando hacia +Z, pies en y=0.
import * as THREE from 'three';
import { canvasTexture } from './util.js';

export const SKINS = ['#f6d3b3', '#e8b48a', '#e0ac7e', '#c68a5e', '#a86b43', '#7a4a2c', '#5a3520'];
export const HAIRS = ['#1a1210', '#2b1a12', '#5a3a1e', '#8a5a2b', '#c9a15a', '#e8d9b0', '#b23a2a', '#3a6ad8', '#ff6fb5'];
export const SHIRTS = ['#ff6f61', '#36c2b4', '#ffd166', '#7b5cff', '#ffffff', '#2e4a7d', '#ff9f1c', '#8ac926', '#ef476f', '#222222'];
export const PATTERNS = ['Lisa', 'Flores', 'Hojas', 'Rayas'];
export const HAIR_STYLES = ['Pincho', 'Rizos', 'Moño', 'Rapado', 'Melena'];

const shirtTexCache = new Map();
function shirtTexture(color, pattern) {
  const key = color + pattern;
  if (shirtTexCache.has(key)) return shirtTexCache.get(key);
  const t = canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    const c = new THREE.Color(color);
    const light = c.getHSL({}).l;
    const ink = light > 0.6 ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.75)';
    const ink2 = light > 0.6 ? 'rgba(255,90,60,0.6)' : 'rgba(255,220,90,0.9)';
    if (pattern === 1) {
      // flores hawaianas
      for (let i = 0; i < 9; i++) {
        const x = (i * 47) % w, y = (i * 71) % h, r = 9 + (i % 3) * 3;
        g.fillStyle = ink;
        for (let p = 0; p < 5; p++) { const a = (p / 5) * Math.PI * 2; g.beginPath(); g.ellipse(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7, r * 0.5, r * 0.32, a, 0, Math.PI * 2); g.fill(); }
        g.fillStyle = ink2; g.beginPath(); g.arc(x, y, r * 0.3, 0, Math.PI * 2); g.fill();
      }
    } else if (pattern === 2) {
      g.strokeStyle = ink; g.lineWidth = 4;
      for (let i = 0; i < 8; i++) {
        const x = (i * 53) % w, y = (i * 37) % h;
        g.fillStyle = ink; g.beginPath(); g.ellipse(x, y, 14, 5, (i * 0.9) % 3, 0, Math.PI * 2); g.fill();
      }
    } else if (pattern === 3) {
      g.fillStyle = ink;
      for (let x = 0; x < w; x += 22) g.fillRect(x, 0, 9, h);
    }
  });
  shirtTexCache.set(key, t);
  return t;
}

const M = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, ...extra });

function box(w, h, d, mat, y = 0) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.y = y; m.castShadow = true; return m; }
function pivot(parent, x, y, z) { const p = new THREE.Group(); p.position.set(x, y, z); parent.add(p); return p; }

export function makeCharacter(look, { scale = 1 } = {}) {
  const group = new THREE.Group();
  const root = new THREE.Group(); // se puede rotar/agachar todo el cuerpo
  group.add(root);
  const mats = {
    skin: M(look.skin), hair: M(look.hair), shirt: M('#ffffff', { map: shirtTexture(look.shirt, look.pattern) }),
    shorts: M(look.shorts || '#2e4a7d'), shoe: M('#f4f4f4'), sole: M('#333333'), dark: M('#1b1b22'),
    cap: M(look.cap || '#1f8a8a'), glass: new THREE.MeshStandardMaterial({ color: '#101018', roughness: 0.15, metalness: 0.6 }),
    white: M('#ffffff'), bag: M('#e8a33a'),
  };

  const hips = pivot(root, 0, 0.82, 0);
  const shorts = box(0.42, 0.22, 0.26, mats.shorts, 0.02); hips.add(shorts);
  const torso = pivot(hips, 0, 0.1, 0);
  const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.23, 0.46, 7), mats.shirt);
  chest.position.y = 0.24; chest.castShadow = true; chest.scale.z = 0.7; torso.add(chest);
  // mochila
  const bag = box(0.3, 0.34, 0.14, mats.bag, 0.26); bag.position.z = -0.2; torso.add(bag);
  bag.visible = !!look.bag;

  const neck = pivot(torso, 0, 0.5, 0);
  const head = pivot(neck, 0, 0, 0);
  const skull = new THREE.Mesh(new THREE.IcosahedronGeometry(0.21, 1), mats.skin);
  skull.position.y = 0.2; skull.scale.set(1, 1.05, 0.95); skull.castShadow = true; head.add(skull);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.07, 4), mats.skin); nose.rotation.x = Math.PI / 2; nose.position.set(0, 0.18, 0.21); head.add(nose);
  const eyes = new THREE.Group(); head.add(eyes);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), mats.dark); e.position.set(0.075 * s, 0.24, 0.185); eyes.add(e); }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 4, 8, Math.PI), mats.dark); smile.rotation.z = Math.PI; smile.position.set(0, 0.12, 0.19); head.add(smile);
  const ears = []; for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.045, 5, 4), mats.skin); e.position.set(0.205 * s, 0.2, 0); e.scale.z = 0.6; head.add(e); ears.push(e); }

  const hairGroup = new THREE.Group(); head.add(hairGroup);
  const glasses = new THREE.Group(); head.add(glasses);
  for (const s of [-1, 1]) { const l = box(0.12, 0.07, 0.03, mats.glass); l.position.set(0.075 * s, 0.245, 0.2); glasses.add(l); }
  const bridge = box(0.05, 0.015, 0.02, mats.glass); bridge.position.set(0, 0.26, 0.205); glasses.add(bridge);
  const capGroup = new THREE.Group(); head.add(capGroup);
  const capTop = new THREE.Mesh(new THREE.SphereGeometry(0.225, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), mats.cap); capTop.position.y = 0.27; capGroup.add(capTop);
  const visor = box(0.3, 0.025, 0.18, mats.cap); visor.position.set(0, 0.28, 0.24); capGroup.add(visor);

  function arm(side) {
    const shoulder = pivot(torso, 0.25 * side, 0.43, 0);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.07, 0.16, 6), mats.shirt); sleeve.position.y = -0.06; sleeve.castShadow = true; shoulder.add(sleeve);
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.28, 6), mats.skin); upper.position.y = -0.14; upper.castShadow = true; shoulder.add(upper);
    const elbow = pivot(shoulder, 0, -0.28, 0);
    const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.26, 6), mats.skin); fore.position.y = -0.13; fore.castShadow = true; elbow.add(fore);
    const hand = new THREE.Mesh(new THREE.IcosahedronGeometry(0.065, 0), mats.skin); hand.position.y = -0.29; elbow.add(hand);
    shoulder.rotation.z = 0.08 * side;
    return { shoulder, elbow, hand };
  }
  function leg(side) {
    const hip = pivot(hips, 0.11 * side, -0.05, 0);
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.07, 0.38, 6), mats.skin); thigh.position.y = -0.2; thigh.castShadow = true; hip.add(thigh);
    const short = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.095, 0.18, 6), mats.shorts); short.position.y = -0.07; hip.add(short);
    const knee = pivot(hip, 0, -0.38, 0);
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.34, 6), mats.skin); shin.position.y = -0.17; shin.castShadow = true; knee.add(shin);
    const foot = box(0.12, 0.08, 0.22, mats.shoe); foot.position.set(0, -0.36, 0.04); knee.add(foot);
    const sole = box(0.125, 0.025, 0.23, mats.sole); sole.position.set(0, -0.4, 0.04); knee.add(sole);
    return { hip, knee, foot };
  }
  const armL = arm(1), armR = arm(-1), legL = leg(1), legR = leg(-1);

  const rig = { root, hips, torso, neck, head, armL, armR, legL, legR, eyes, smile };
  const ch = { group, rig, look: { ...look }, mats };

  ch.setLook = (lk) => {
    Object.assign(ch.look, lk);
    const l = ch.look;
    mats.skin.color.set(l.skin); mats.hair.color.set(l.hair); mats.shorts.color.set(l.shorts || '#2e4a7d');
    mats.shirt.map = shirtTexture(l.shirt, l.pattern); mats.shirt.needsUpdate = true;
    mats.cap.color.set(l.cap || '#1f8a8a');
    glasses.visible = !!l.glasses;
    capGroup.visible = !!l.cap;
    bag.visible = !!l.bag;
    buildHair(hairGroup, l.hairStyle | 0, mats.hair, !!l.cap);
  };
  ch.setLook(look);

  // Poses simples. t = tiempo (s) para ciclos; w = 0..1 mezcla (por ahora directa).
  ch.pose = (name, t = 0) => {
    const r = rig;
    reset(r);
    if (name === 'idle') {
      const b = Math.sin(t * 2) * 0.02;
      r.hips.position.y = 0.82 + b; r.armL.shoulder.rotation.z = 0.12 + b; r.armR.shoulder.rotation.z = -0.12 - b;
      r.head.rotation.y = Math.sin(t * 0.7) * 0.15;
    } else if (name === 'walk' || name === 'run') {
      const k = name === 'run' ? 1.6 : 1, f = name === 'run' ? 11 : 7;
      const s = Math.sin(t * f);
      r.legL.hip.rotation.x = s * 0.6 * k; r.legR.hip.rotation.x = -s * 0.6 * k;
      r.legL.knee.rotation.x = Math.max(0, -s) * 0.8 * k; r.legR.knee.rotation.x = Math.max(0, s) * 0.8 * k;
      r.armL.shoulder.rotation.x = -s * 0.5 * k; r.armR.shoulder.rotation.x = s * 0.5 * k;
      r.armL.elbow.rotation.x = -0.4 * k; r.armR.elbow.rotation.x = -0.4 * k;
      r.hips.position.y = 0.82 + Math.abs(Math.cos(t * f)) * 0.04 * k;
      if (name === 'run') r.torso.rotation.x = 0.2;
    } else if (name === 'sit' || name === 'ride') {
      // sentado con las manos al manillar (scooter, tuk-tuk, barca)
      r.hips.position.y = 0.5;
      r.legL.hip.rotation.x = -1.4; r.legR.hip.rotation.x = -1.4;
      r.legL.knee.rotation.x = 1.5; r.legR.knee.rotation.x = 1.5;
      r.legL.hip.rotation.z = 0.15; r.legR.hip.rotation.z = -0.15;
      if (name === 'ride') {
        r.torso.rotation.x = 0.25;
        r.armL.shoulder.rotation.x = -1.2; r.armR.shoulder.rotation.x = -1.2;
        r.armL.shoulder.rotation.z = -0.25; r.armR.shoulder.rotation.z = 0.25;
        r.armL.elbow.rotation.x = -0.3; r.armR.elbow.rotation.x = -0.3;
      } else {
        r.armL.shoulder.rotation.z = 0.2; r.armR.shoulder.rotation.z = -0.2;
        r.armL.elbow.rotation.x = -0.6; r.armR.elbow.rotation.x = -0.6;
      }
    } else if (name === 'cheer') {
      const s = Math.sin(t * 9);
      r.armL.shoulder.rotation.z = 2.6 + s * 0.2; r.armR.shoulder.rotation.z = -2.6 - s * 0.2;
      r.hips.position.y = 0.82 + Math.max(0, s) * 0.12;
      r.head.rotation.x = -0.2;
    } else if (name === 'wave') {
      r.armR.shoulder.rotation.z = -2.5; r.armR.elbow.rotation.z = Math.sin(t * 8) * 0.5;
      r.armL.shoulder.rotation.z = 0.12;
    } else if (name === 'guard') {
      // guardia de Muay Thai
      const b = Math.sin(t * 5) * 0.03;
      r.hips.position.y = 0.76 + b;
      r.legL.hip.rotation.x = -0.35; r.legL.knee.rotation.x = 0.5; r.legR.hip.rotation.x = 0.25; r.legR.knee.rotation.x = 0.3;
      r.armL.shoulder.rotation.x = -1.3; r.armL.elbow.rotation.x = -1.9; r.armL.shoulder.rotation.z = -0.3;
      r.armR.shoulder.rotation.x = -1.1; r.armR.elbow.rotation.x = -2.0; r.armR.shoulder.rotation.z = 0.3;
      r.torso.rotation.y = 0.15;
    }
  };

  if (scale !== 1) group.scale.setScalar(scale);
  return ch;
}

function reset(r) {
  r.hips.position.y = 0.82; r.hips.rotation.set(0, 0, 0); r.torso.rotation.set(0, 0, 0); r.head.rotation.set(0, 0, 0); r.root.rotation.set(0, 0, 0);
  for (const a of [r.armL, r.armR]) { a.shoulder.rotation.set(0, 0, a === r.armL ? 0.08 : -0.08); a.elbow.rotation.set(0, 0, 0); }
  for (const l of [r.legL, r.legR]) { l.hip.rotation.set(0, 0, 0); l.knee.rotation.set(0, 0, 0); }
}

function buildHair(g, style, mat, hasCap) {
  while (g.children.length) { const c = g.children.pop(); c.geometry.dispose(); }
  const add = (geo, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.x = rx; m.castShadow = true; g.add(m); return m; };
  if (style === 0) { // pincho
    add(new THREE.SphereGeometry(0.22, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.55), 0, 0.23, -0.01, 1.02, 1, 1.02);
    if (!hasCap) for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; add(new THREE.ConeGeometry(0.06, 0.14, 4), Math.cos(a) * 0.1, 0.42, Math.sin(a) * 0.1 - 0.02, 1, 1, 1, Math.sin(a) * 0.4); }
  } else if (style === 1) { // rizos
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2, y = 0.3 + (i % 3) * 0.05; add(new THREE.IcosahedronGeometry(0.075, 0), Math.cos(a) * 0.17, y, Math.sin(a) * 0.17 - 0.02); }
    add(new THREE.IcosahedronGeometry(0.15, 0), 0, 0.38, -0.02);
  } else if (style === 2) { // moño
    add(new THREE.SphereGeometry(0.225, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.6), 0, 0.22, -0.01);
    if (!hasCap) add(new THREE.IcosahedronGeometry(0.09, 1), 0, 0.46, -0.08); else add(new THREE.IcosahedronGeometry(0.08, 1), 0, 0.25, -0.24);
  } else if (style === 3) { // rapado
    add(new THREE.SphereGeometry(0.215, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.5), 0, 0.215, -0.005);
  } else { // melena
    add(new THREE.SphereGeometry(0.23, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.6), 0, 0.22, -0.01);
    add(new THREE.BoxGeometry(0.42, 0.3, 0.16), 0, 0.08, -0.12);
  }
}
