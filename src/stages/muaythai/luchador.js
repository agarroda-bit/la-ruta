// Luchadores de Muay Thai: equipo (mongkol, pra jiad, guantes, pantalón) sobre el
// personaje de chars.js, poses por canales y un animador con fotogramas clave.
import * as THREE from 'three';

// ───────── canales de pose ─────────
// h*: caderas (posición y rotación) · t*: torso · n*: cabeza · ls/le, rs/re: hombro/codo
// lh/lk, rh/rk: cadera/rodilla de cada pierna · r*: raíz (giro de todo el cuerpo) · px/pz: paso
const NEUTRAL = {
  hx: 0, hy: 0.82, hz: 0, hrx: 0, hry: 0, hrz: 0, tx: 0, ty: 0, tz: 0, nx: 0, ny: 0, nz: 0,
  lsx: 0, lsy: 0, lsz: 0.08, lex: 0, ley: 0, lez: 0, rsx: 0, rsy: 0, rsz: -0.08, rex: 0, rey: 0, rez: 0,
  lhx: 0, lhy: 0, lhz: 0, lkx: 0, rhx: 0, rhy: 0, rhz: 0, rkx: 0, rx: 0, ry: 0, rz: 0, px: 0, pz: 0,
};
const KEYS = Object.keys(NEUTRAL);
const P = (o) => ({ ...NEUTRAL, ...o });
const mix = (a, b) => ({ ...a, ...b });

const GUARD_ARMS = { lsx: -1.25, lex: -1.95, lsz: -0.28, rsx: -1.05, rex: -2.05, rsz: 0.3 };
const GUARD_LEGS = { hy: 0.8, lhx: -0.32, lkx: 0.42, rhx: 0.22, rkx: 0.28 };

export const POSES = {
  neutral: P({}),
  guard: P({ ...GUARD_LEGS, ...GUARD_ARMS, ty: 0.12, nx: 0.08 }),
  block: P({ ...GUARD_LEGS, hy: 0.77, lsx: -1.35, lex: -2.35, lsz: -0.5, rsx: -1.35, rex: -2.35, rsz: 0.5, tx: 0.22, nx: 0.3, lhx: -0.7, lkx: 1.0 }),
  dodge: P({ ...GUARD_LEGS, ...GUARD_ARMS, tx: -0.55, nx: -0.25, pz: -0.18, lhx: -0.1, rhx: 0.45, rkx: 0.5, lsx: -0.9, rsx: -0.8 }),
  // golpes (fotograma de impacto)
  jabUp: P({ ...GUARD_LEGS, ...GUARD_ARMS, ty: -0.1, lsx: -1.35, lex: -1.5 }),
  jab: P({ ...GUARD_LEGS, ...GUARD_ARMS, ty: -0.4, tx: 0.12, lsx: -1.55, lsz: -0.12, lex: -0.08, pz: 0.12, lhx: -0.45 }),
  crossUp: P({ ...GUARD_LEGS, ...GUARD_ARMS, ty: 0.35, rsx: -1.2 }),
  cross: P({ ...GUARD_LEGS, ...GUARD_ARMS, ty: 0.6, hry: 0.25, tx: 0.12, rsx: -1.55, rsz: 0.18, rex: -0.08, rhx: 0.4, rkx: 0.1, pz: 0.16 }),
  kickUp: P({ ...GUARD_ARMS, hy: 0.84, lhx: -0.1, lkx: 0.15, rhx: -1.1, rhz: -0.3, rkx: 1.7, hry: 0.5, ty: -0.35, tx: -0.1, rsx: 0.35, rex: -0.3, rsz: -0.25 }),
  kick: P({ ...GUARD_ARMS, hy: 0.86, lhx: 0.05, lkx: 0.1, rhx: -1.95, rhz: -0.6, rkx: 0.1, hry: 0.95, ty: -0.75, tx: -0.3, rsx: 0.6, rex: -0.2, rsz: -0.5, lsx: -1.4, lex: -1.9, pz: 0.08 }),
  kneeUp: P({ ...GUARD_LEGS, lsx: -1.6, lex: -0.8, lsz: -0.25, rsx: -1.6, rex: -0.8, rsz: 0.25, rhx: 0.6, rkx: 0.9, tx: -0.05 }),
  knee: P({ hy: 0.84, lsx: -1.5, lex: -1.1, lsz: -0.35, rsx: -1.5, rex: -1.1, rsz: 0.35, lhx: 0.15, lkx: 0.1, rhx: -1.75, rkx: 2.1, tx: -0.25, hz: 0.12, pz: 0.2 }),
  elbowUp: P({ ...GUARD_LEGS, ...GUARD_ARMS, ty: -0.45, rsx: -1.3, rsz: -0.5, rex: -2.6 }),
  elbow: P({ ...GUARD_LEGS, lsx: -1.25, lex: -1.95, lsz: -0.28, ty: 0.85, tx: 0.15, rsx: -1.55, rsz: -0.35, rex: -2.65, hry: 0.3, pz: 0.2, rhx: 0.45 }),
  // reacciones
  hurt: P({ ...GUARD_LEGS, lsx: -0.8, lex: -1.4, lsz: 0.2, rsx: -0.7, rex: -1.4, rsz: -0.2, tx: -0.35, nx: -0.55, nz: 0.2, pz: -0.15 }),
  stun: P({ hy: 0.78, lhx: -0.15, lkx: 0.35, rhx: 0.15, rkx: 0.35, lsx: -0.35, lex: -0.7, lsz: 0.25, rsx: -0.3, rex: -0.7, rsz: -0.25, nx: 0.25, tx: 0.1 }),
  ko: P({ rx: -1.48, hy: 0.82, lsz: 1.3, rsz: -1.3, lsx: -0.3, rsx: -0.2, lhx: -0.3, lkx: 0.5, rhx: -0.1, rkx: 0.2, nx: -0.2, ny: 0.5 }),
  koKnees: P({ hy: 0.55, lhx: -1.2, lkx: 1.9, rhx: -0.4, rkx: 1.5, lsx: -0.3, rsx: -0.3, lsz: 0.4, rsz: -0.4, tx: 0.3, nx: 0.5 }),
  cheer: P({ lsz: 2.6, rsz: -2.6, lex: -0.3, rex: -0.3, nx: -0.25 }),
  cheer2: P({ lsz: 2.9, rsz: -2.9, lex: -0.1, rex: -0.1, nx: -0.35, hy: 0.9 }),
  wai: P({ lsx: -0.75, lsz: -0.62, lex: -1.75, rsx: -0.75, rsz: 0.62, rex: -1.75, tx: 0.25, nx: 0.35 }),
  waiDeep: P({ lsx: -0.95, lsz: -0.62, lex: -1.75, rsx: -0.95, rsz: 0.62, rex: -1.75, tx: 0.6, nx: 0.4, hy: 0.8 }),
  // wai kru (ram muay)
  kneel: P({ hy: 0.5, lhx: 0, lkx: 1.57, rhx: 0, rkx: 1.57, lsx: -0.75, lsz: -0.62, lex: -1.75, rsx: -0.75, rsz: 0.62, rex: -1.75, tx: 0.08, nx: 0.15 }),
  kneelBow: P({ hy: 0.48, lhx: -0.2, lkx: 1.75, rhx: -0.2, rkx: 1.75, tx: 1.05, nx: 0.25, lsx: -1.2, rsx: -1.2, lsz: -0.15, rsz: 0.15, lex: -0.2, rex: -0.2 }),
  ram: P({ hy: 0.78, lhx: -0.1, lkx: 0.35, rhx: -1.15, rkx: 1.5, lsz: 1.25, rsz: -1.25, lsx: -0.3, rsx: -0.3, lez: 0, lex: -0.7, rex: -0.7, nx: -0.05 }),
  ramL: P({ hy: 0.76, lhx: -0.5, lkx: 0.7, rhx: 0.3, rkx: 0.5, ty: -0.55, lsz: 1.45, lex: -0.5, rsx: -1.4, rsz: 0.6, rex: -1.0, ny: -0.4, tz: 0.1 }),
  ramR: P({ hy: 0.76, rhx: -0.5, rkx: 0.7, lhx: 0.3, lkx: 0.5, ty: 0.55, rsz: -1.45, rex: -0.5, lsx: -1.4, lsz: -0.6, lex: -1.0, ny: 0.4, tz: -0.1 }),
  ramWai: P({ hy: 0.74, lhx: -0.6, lkx: 1.0, rhx: 0.2, rkx: 0.6, lsx: -0.85, lsz: -0.62, lex: -1.75, rsx: -0.85, rsz: 0.62, rex: -1.75, tx: 0.4, nx: 0.3 }),
  // avisos del rival (telegrafiado)
  tellRafaga: P({ ...GUARD_LEGS, lsx: -1.45, lex: -1.3, lsz: -0.55, rsx: -1.45, rex: -1.3, rsz: 0.55, tx: 0.1, nx: 0.15 }),
  tellKick: P({ ...GUARD_ARMS, hy: 0.82, lhx: -0.05, lkx: 0.2, rhx: -0.75, rkx: 1.25, hry: 0.35, ty: -0.25, tx: -0.12, rsx: 0.3, rsz: -0.3, rex: -0.3 }),
  tellClinch: P({ ...GUARD_LEGS, lsx: -0.9, lsz: 1.2, lex: -0.9, rsx: -0.9, rsz: -1.2, rex: -0.9, tx: 0.15, nx: -0.1 }),
  tellElbow: P({ ...GUARD_LEGS, lsx: -1.25, lex: -1.95, lsz: -0.28, ty: -0.7, rsx: -1.4, rsz: -0.75, rex: -2.6, tx: 0.05 }),
  // árbitro
  refIdle: P({ hy: 0.8, lhx: -0.15, lkx: 0.25, rhx: 0.1, rkx: 0.2, lsz: 0.35, rsz: -0.35, lex: -0.5, rex: -0.5, lsx: -0.3, rsx: -0.3, tx: 0.15 }),
  refStop: P({ hy: 0.8, lsx: -1.5, rsx: -1.5, lsz: 0.55, rsz: -0.55, lex: -0.1, rex: -0.1, tx: 0.1 }),
  refWave: P({ lsz: 2.2, rsz: -2.2, lex: -0.2, rex: -0.2, lsx: -0.6, rsx: -0.6 }),
  refRaiseR: P({ rsz: -2.9, rex: -0.05, lsz: 0.2, lex: -0.4 }),
};

export const ease = {
  lin: (t) => t,
  out: (t) => 1 - Math.pow(1 - t, 3),
  in: (t) => t * t * t,
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  back: (t) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};

// ───────── animador ─────────
export class Animator {
  constructor(ch) {
    this.ch = ch;
    this.cur = { ...POSES.guard };
    this.move = null;
    this.base = () => POSES.guard;
    this.rate = 14;
    this.ground = true;
    this.add = {}; // desplazamientos aditivos (reacciones) que se apagan solos
    this.addDecay = 9;
    this._v = new THREE.Vector3();
  }
  // keys: [[t, pose, ease?], ...] — el primer fotograma (t=0) es la pose actual
  play(keys, { speed = 1, onEnd = null } = {}) {
    this.move = { keys: [[0, { ...this.cur }], ...keys], t: 0, speed, onEnd, dur: keys[keys.length - 1][0] };
  }
  stop() { this.move = null; }
  get busy() { return !!this.move; }
  kick(ch) { for (const k in ch) this.add[k] = (this.add[k] || 0) + ch[k]; }

  update(dt, time) {
    let target;
    if (this.move) {
      const m = this.move;
      m.t += dt * m.speed;
      const ks = m.keys;
      let i = 1;
      while (i < ks.length - 1 && ks[i][0] < m.t) i++;
      const a = ks[i - 1], b = ks[i];
      const span = Math.max(1e-4, b[0] - a[0]);
      const k = Math.max(0, Math.min(1, (m.t - a[0]) / span));
      const e = (b[2] || ease.out)(k);
      target = {};
      for (const key of KEYS) target[key] = a[1][key] + (b[1][key] - a[1][key]) * e;
      for (const key of KEYS) this.cur[key] = target[key];
      if (m.t >= m.dur) { this.move = null; if (m.onEnd) m.onEnd(); }
    } else {
      target = this.base(time);
      const f = 1 - Math.exp(-this.rate * dt);
      for (const key of KEYS) this.cur[key] += (target[key] - this.cur[key]) * f;
    }
    const f2 = Math.exp(-this.addDecay * dt);
    for (const k in this.add) { this.add[k] *= f2; if (Math.abs(this.add[k]) < 1e-3) delete this.add[k]; }
    this.apply();
  }

  apply() {
    const c = this.cur, a = this.add, r = this.ch.rig;
    const g = (k) => c[k] + (a[k] || 0);
    r.root.position.set(g('px'), 0, g('pz'));
    r.root.rotation.set(g('rx'), g('ry'), g('rz'));
    r.hips.position.set(g('hx'), g('hy'), g('hz'));
    r.hips.rotation.set(g('hrx'), g('hry'), g('hrz'));
    r.torso.rotation.set(g('tx'), g('ty'), g('tz'));
    r.head.rotation.set(g('nx'), g('ny'), g('nz'));
    r.armL.shoulder.rotation.set(g('lsx'), g('lsy'), g('lsz'));
    r.armL.elbow.rotation.set(g('lex'), g('ley'), g('lez'));
    r.armR.shoulder.rotation.set(g('rsx'), g('rsy'), g('rsz'));
    r.armR.elbow.rotation.set(g('rex'), g('rey'), g('rez'));
    r.legL.hip.rotation.set(g('lhx'), g('lhy'), g('lhz'));
    r.legL.knee.rotation.x = g('lkx');
    r.legR.hip.rotation.set(g('rhx'), g('rhy'), g('rhz'));
    r.legR.knee.rotation.x = g('rkx');
    // pies al suelo (salvo tumbado)
    if (this.ground && Math.abs(g('rx')) < 0.3) {
      const grp = this.ch.group;
      grp.updateMatrixWorld(true);
      const v = this._v;
      v.setFromMatrixPosition(r.legL.foot.matrixWorld); let min = v.y;
      v.setFromMatrixPosition(r.legR.foot.matrixWorld); min = Math.min(min, v.y);
      const s = grp.scale.y || 1;
      r.root.position.y = -((min - grp.position.y) / s - 0.05);
    } else if (Math.abs(g('rx')) >= 0.3) {
      r.root.position.y = 0.12;
    }
  }
}

// ───────── equipo de Muay Thai ─────────
const STD = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.7, ...extra });

export function equipar(ch, { color = '#c1121f', trim = '#ffcf3f', shorts = null, mongkol = true, shirtless = true, ref = false } = {}) {
  const r = ch.rig, m = ch.mats;
  const gear = { mats: [], meshes: [], auras: {} };
  const keep = (mat) => { gear.mats.push(mat); return mat; };
  // fuera mochila, gorra y gafas; descalzo; sin camiseta (salvo el árbitro)
  ch.group.traverse((o) => {
    if (!o.isMesh) return;
    if (o.material === m.bag || o.material === m.cap || o.material === m.glass) o.visible = false;
    if (!ref && (o.material === m.shoe || o.material === m.sole)) o.material = m.skin;
    if (shirtless && o.material === m.shirt) o.material = m.skin;
  });
  if (ref) return gear;
  m.shorts.color.set(shorts || color);
  // pantalón ancho de Muay Thai: perneras más anchas y cintura dorada
  for (const leg of [r.legL, r.legR]) {
    for (const c of leg.hip.children) if (c.isMesh && c.material === m.shorts) { c.scale.set(1.45, 1.25, 1.45); c.position.y = -0.09; }
  }
  const trimMat = keep(STD(trim, { metalness: 0.3, roughness: 0.45 }));
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.075, 0.3), trimMat); band.position.y = 0.11; r.hips.add(band);
  for (const leg of [r.legL, r.legR]) {
    const hem = new THREE.Mesh(new THREE.CylinderGeometry(0.148, 0.148, 0.03, 7), trimMat); hem.position.y = -0.2; leg.hip.add(hem);
  }
  // vendas en los tobillos
  const wrap = keep(STD('#f4efe6'));
  for (const leg of [r.legL, r.legR]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.07, 0.1, 6), wrap); w.position.y = -0.3; leg.knee.add(w);
  }
  // guantes
  const gloveMat = keep(STD(color, { roughness: 0.4, emissive: new THREE.Color('#000000') }));
  const cuffMat = keep(STD('#f4efe6'));
  gear.gloves = [];
  for (const arm of [r.armL, r.armR]) {
    arm.hand.visible = false;
    const gl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.105, 1), gloveMat);
    gl.scale.set(1, 1.18, 1.12); gl.position.y = -0.32; gl.castShadow = true; arm.elbow.add(gl);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.075, 0.08, 7), cuffMat); cuff.position.y = -0.21; arm.elbow.add(cuff);
    gear.gloves.push(gl);
  }
  gear.gloveMat = gloveMat;
  // pra jiad (brazaletes)
  const pjMat = keep(STD(color, { roughness: 0.6 }));
  for (const arm of [r.armL, r.armR]) {
    const pj = new THREE.Mesh(new THREE.TorusGeometry(0.066, 0.022, 5, 10), pjMat); pj.rotation.x = Math.PI / 2; pj.position.y = -0.1; arm.shoulder.add(pj);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.09, 0.012), trimMat); tail.position.set(0, -0.15, 0.08); arm.shoulder.add(tail);
  }
  // mongkol (cinta sagrada de la cabeza)
  const mg = new THREE.Group();
  const mgMat = keep(STD('#f7f1e3', { roughness: 0.5 }));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.03, 6, 14), mgMat); ring.rotation.x = Math.PI / 2 - 0.15; ring.position.y = 0.3; mg.add(ring);
  const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.207, 0.012, 4, 14), keep(STD(color))); stripe.rotation.x = Math.PI / 2 - 0.15; stripe.position.y = 0.3; mg.add(stripe);
  const tailGeo = new THREE.CylinderGeometry(0.022, 0.03, 0.34, 5);
  const tl = new THREE.Mesh(tailGeo, mgMat); tl.position.set(0, 0.36, -0.32); tl.rotation.x = -1.05; mg.add(tl);
  r.head.add(mg);
  mg.visible = mongkol;
  gear.mongkol = mg;
  // auras de aviso (telegrafiado): brillo aditivo sobre brazos y piernas
  const auraMat = (c) => keep(new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  const mkAura = (parent, geo, y, c) => { const mm = auraMat(c); const a = new THREE.Mesh(geo, mm); a.position.y = y; a.visible = false; parent.add(a); return a; };
  const armGeo = new THREE.CylinderGeometry(0.13, 0.11, 0.42, 7);
  const legGeo = new THREE.CylinderGeometry(0.15, 0.11, 0.48, 7);
  const gloveGeo = new THREE.IcosahedronGeometry(0.19, 1);
  gear.auras = {
    gloveL: mkAura(r.armL.elbow, gloveGeo, -0.32, '#ffd23f'),
    gloveR: mkAura(r.armR.elbow, gloveGeo, -0.32, '#ffd23f'),
    armR: mkAura(r.armR.elbow, armGeo, -0.16, '#ff4d4d'),
    legR: mkAura(r.legR.knee, legGeo, -0.2, '#ff8c1a'),
    thighR: mkAura(r.legR.hip, legGeo, -0.2, '#ff3fa4'),
    legL: mkAura(r.legL.knee, legGeo, -0.2, '#ff3fa4'),
  };
  gear.setAura = (name, v, color) => {
    const a = gear.auras[name]; if (!a) return;
    a.visible = v > 0.01; a.material.opacity = Math.min(1, v * 1.1);
    if (color) a.material.color.set(color);
    a.scale.setScalar(1.05 + v * 0.3);
  };
  gear.clearAuras = () => { for (const k in gear.auras) gear.setAura(k, 0); };
  ch.group.traverse((o) => { if (o.isMesh && !o.material.transparent) o.castShadow = true; });
  return gear;
}

// Destello al recibir: emisivo blanco/rojo en la piel y el pantalón
export function flash(ch, gear, v, color = '#ffffff') {
  const mats = [ch.mats.skin, ch.mats.shorts, ch.mats.hair];
  if (gear && gear.gloveMat) mats.push(gear.gloveMat);
  for (const mt of mats) { mt.emissive.set(color); mt.emissiveIntensity = v; }
}

// Fotogramas clave de cada golpe a partir de sus tiempos
export function moveKeys(name, def) {
  const s = def.startup, a = def.active, rc = def.recover;
  const up = POSES[name + 'Up'] || POSES.guard, hit = POSES[name];
  return [
    [s * 0.55, up, ease.out],
    [s, hit, ease.in],
    [s + a, hit, ease.lin],
    [s + a + rc, POSES.guard, ease.inOut],
  ];
}

export { mix };
