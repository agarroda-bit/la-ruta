// Barca de cola larga (long-tail) low-poly: casco de madera con proa altísima, guirnaldas de flores,
// cintas de colores, motor de coche sobre un pivote y la hélice al final de un palo larguísimo.
// Mira hacia +Z, línea de flotación en y = 0.
import * as THREE from 'three';

const M = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, ...extra });

// secciones del casco: [z, media manga, quilla, borda]
const SECTIONS = [
  [-3.4, 0.56, -0.18, 0.52],
  [-2.8, 0.74, -0.34, 0.46],
  [-1.8, 0.82, -0.4, 0.42],
  [-0.6, 0.84, -0.42, 0.42],
  [0.6, 0.82, -0.42, 0.44],
  [1.8, 0.72, -0.37, 0.5],
  [2.7, 0.52, -0.24, 0.66],
  [3.3, 0.32, -0.04, 0.92],
  [3.75, 0.15, 0.32, 1.35],
  [4.05, 0.05, 0.85, 1.95],
];

function hullGeometry(stripe, wood, dark) {
  const pos = [], col = [];
  const cW = new THREE.Color(wood), cS = new THREE.Color(stripe), cD = new THREE.Color(dark), cIn = new THREE.Color(wood).multiplyScalar(0.7);
  const ring = (s) => {
    const [z, hw, keel, top] = s;
    const mid = keel + (top - keel) * 0.42;
    return [[-hw, top], [-hw * 0.97, top - 0.12], [-hw * 0.9, mid], [-hw * 0.5, keel + 0.06], [0, keel], [hw * 0.5, keel + 0.06], [hw * 0.9, mid], [hw * 0.97, top - 0.12], [hw, top]].map(([x, y]) => new THREE.Vector3(x, y, z));
  };
  const rings = SECTIONS.map(ring);
  const cL = new THREE.Color(wood).multiplyScalar(1.25);
  const colorFor = (k) => (k === 0 || k === 7 ? cS : k === 1 || k === 6 ? cL : k === 3 || k === 4 ? cD : cW);
  const tri = (a, b, c, color) => { pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z); for (let i = 0; i < 3; i++) col.push(color.r, color.g, color.b); };
  for (let i = 0; i < rings.length - 1; i++) {
    const A = rings[i], B = rings[i + 1];
    for (let k = 0; k < A.length - 1; k++) {
      const c = colorFor(k);
      // exterior
      tri(A[k], B[k + 1], A[k + 1], c); tri(A[k], B[k], B[k + 1], c);
      // interior (más oscuro)
      tri(A[k], A[k + 1], B[k + 1], cIn); tri(A[k], B[k + 1], B[k], cIn);
    }
  }
  // espejo de popa
  const S = rings[0];
  for (let k = 1; k < S.length - 1; k++) { tri(S[0], S[k], S[k + 1], cW); tri(S[0], S[k + 1], S[k], cIn); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

// opciones: { stripe, wood, simple (sin adornos, para el fantasma), flowers }
export function buildBoat({ stripe = '#1f9fd6', wood = '#8a5530', dark = '#4b2a17', simple = false, flowers = true, canopy = false } = {}) {
  const group = new THREE.Group();     // yaw + balanceo (rotation.y / rotation.z)
  const pitch = new THREE.Group();     // cabeceo
  group.add(pitch);
  const hullMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, side: THREE.FrontSide });
  const hull = new THREE.Mesh(hullGeometry(stripe, wood, dark), hullMat);
  hull.castShadow = true; hull.receiveShadow = true;
  pitch.add(hull);
  const woodM = M(wood), darkM = M(dark), metal = M('#8d99a6', { metalness: 0.5, roughness: 0.4 }), black = M('#222428');
  // bancos y suelo
  const floor = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 5.6), M('#a8743f')); floor.position.set(0, -0.2, -0.1); pitch.add(floor);
  for (const z of [-2.6, -0.8, 1.1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.08, 0.32), woodM); b.position.set(0, 0.22, z); b.castShadow = true; pitch.add(b); }
  // regala
  for (const s of [-1, 1]) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 6.2), darkM); r.position.set(s * 0.8, 0.46, -0.3); pitch.add(r); }

  // motor: bloque sobre un pivote en la popa, palo largo hasta la hélice
  const motor = new THREE.Group(); motor.position.set(0, 0.55, -3.25); pitch.add(motor);
  const block = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.5, 0.8), M('#3c6e71')); block.position.set(0, 0.25, 0); block.castShadow = true; motor.add(block);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.62), metal); head.position.set(0, 0.58, 0); motor.add(head);
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 5), black); pipe.position.set(0.25, 0.75, 0.1); motor.add(pipe);
  const tillerPivot = new THREE.Group(); tillerPivot.position.set(0, 0.35, 0.35); motor.add(tillerPivot);
  const tiller = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.4, 5), metal); tiller.rotation.x = Math.PI / 2 - 0.35; tiller.position.set(0, 0.22, 0.62); tillerPivot.add(tiller);
  const shaft = new THREE.Group(); shaft.position.set(0, 0.15, -0.3); shaft.rotation.x = 0.2; motor.add(shaft);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.4, 6), metal); pole.rotation.x = Math.PI / 2; pole.position.z = -1.7; shaft.add(pole);
  const prop = new THREE.Group(); prop.position.z = -3.4; shaft.add(prop);
  for (let i = 0; i < 3; i++) { const bl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.04), metal); bl.rotation.z = (i / 3) * Math.PI * 2; bl.position.set(Math.sin((i / 3) * Math.PI * 2) * 0.12, Math.cos((i / 3) * Math.PI * 2) * 0.12, 0); prop.add(bl); }
  const propTip = new THREE.Object3D(); prop.add(propTip);

  const ribbons = [];
  if (!simple) {
    // poste de proa con guirnaldas de flores y cintas de colores
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.6, 5), darkM); stem.position.set(0, 2.1, 4.05); stem.rotation.x = 0.35; pitch.add(stem);
    if (flowers) {
      const fcols = ['#ff4f9a', '#ffd23f', '#ffffff', '#ff7b39', '#c84bff'];
      const fGeo = new THREE.IcosahedronGeometry(0.075, 0);
      const fm = fcols.map((c) => M(c, { emissive: c, emissiveIntensity: 0.15 }));
      for (let k = 0; k < 3; k++) {
        const z = 3.5 + k * 0.22, y = 1.0 + k * 0.33, hw = 0.24 - k * 0.07;
        for (let i = 0; i < 9; i++) {
          const a = (i / 8) * Math.PI;
          const f = new THREE.Mesh(fGeo, fm[(i + k) % fm.length]);
          f.position.set(Math.cos(a) * hw, y - Math.sin(a) * 0.18, z + Math.sin(a) * 0.05);
          pitch.add(f);
        }
      }
      // collar de flores colgando del poste
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; const f = new THREE.Mesh(fGeo, fm[i % fm.length]); f.position.set(Math.cos(a) * 0.14, 1.88 - Math.abs(Math.sin(a)) * 0.12, 3.98 + Math.sin(a) * 0.14); pitch.add(f); }
    }
    const rcols = ['#ff3b3b', '#ffd23f', '#2ec4b6', '#3a86ff', '#ff4f9a'];
    for (let i = 0; i < rcols.length; i++) {
      const piv = new THREE.Group(); piv.position.set((i - 2) * 0.03, 2.3, 4.12); pitch.add(piv);
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.012, 1.1), M(rcols[i], { side: THREE.DoubleSide, emissive: rcols[i], emissiveIntensity: 0.1 }));
      r.position.z = -0.55; piv.add(r);
      piv.rotation.y = (i - 2) * 0.18;
      ribbons.push(piv);
    }
    if (canopy) {
      const roof = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.06, 2.6), M('#2ec4b6', { side: THREE.DoubleSide })); roof.position.set(0, 2.05, -0.6); roof.castShadow = true; pitch.add(roof);
      for (const x of [-0.75, 0.75]) for (const z of [-1.8, 0.6]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 4), darkM); p.position.set(x, 1.25, z); pitch.add(p); }
    }
  }
  return {
    group, pitch, motor, tillerPivot, shaft, prop, propTip, ribbons,
    // animación: steer -1..1 gira el motor; spin = vueltas de la hélice; t = tiempo
    animate(t, steer, spin, speed) {
      motor.rotation.y = steer * 0.35;
      prop.rotation.z += spin;
      for (let i = 0; i < ribbons.length; i++) {
        const r = ribbons[i];
        r.rotation.x = -1.2 + Math.min(1, speed / 25) * 1.0 + Math.sin(t * 9 + i * 1.7) * (0.08 + speed * 0.004);
        r.rotation.z = Math.sin(t * 7 + i) * 0.25;
      }
    },
  };
}
