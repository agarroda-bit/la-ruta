// Manada de delfines que aparece a mitad de recorrido: nadan delante por el canal saltando.
// Si pasas a su lado mientras saltan, te regalan un tercio de turbo cada uno.
import * as THREE from 'three';

function buildDolphin() {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: '#5f86a6', flatShading: true, roughness: 0.4 });
  const belly = new THREE.MeshStandardMaterial({ color: '#d9e8ef', flatShading: true, roughness: 0.5 });
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 1), skin); body.scale.set(0.62, 0.62, 2.0); g.add(body);
  const b2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), belly); b2.scale.set(0.55, 0.42, 1.6); b2.position.set(0, -0.14, 0.15); g.add(b2);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.6, 6), skin); beak.rotation.x = Math.PI / 2; beak.position.set(0, -0.05, 1.35); g.add(beak);
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 4), skin); fin.position.set(0, 0.45, -0.1); fin.rotation.x = -0.5; fin.scale.z = 0.35; g.add(fin);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.06, 0.35), skin); tail.position.set(0, 0, -1.3); g.add(tail);
  const eye = new THREE.MeshStandardMaterial({ color: '#111' });
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 5, 4), eye); e.position.set(0.3 * s, 0.1, 0.85); g.add(e); }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group: g, tail };
}

export function createDolphins(scene, { s0, length = 230, speed = 15, lanes = [-7, 7.5, -8.5] }) {
  const pod = lanes.map((lane, i) => { const d = buildDolphin(); d.group.scale.setScalar(1.5); d.group.visible = false; scene.add(d.group); return { ...d, lane, ph: i * 0.37, given: false, wasAir: false, x: 0, y: -3, z: 0 }; });
  const state = { on: false, done: false, s: s0, t: 0, given: 0 };
  return {
    state, pod,
    // cb: { splash(x,y,z), gift(d), start() }
    update(dt, t, boat, path, sea, cb) {
      if (state.done) return;
      if (!state.on) {
        if (boat.s > s0 - 75 && boat.s < s0 + 80 && Math.abs(boat.lat) < 22 && !boat.air) { state.on = true; state.yaw = boat.yaw; pod.forEach((d) => { d.group.visible = true; }); }
        else return;
      }
      state.t += dt;
      // nadan junto a la barca: empiezan delante y se van quedando atrás, a 6-9 m por los lados
      state.yaw += Math.atan2(Math.sin(boat.yaw - state.yaw), Math.cos(boat.yaw - state.yaw)) * Math.min(1, dt * 2);
      const fx = Math.sin(state.yaw), fz = Math.cos(state.yaw), rx = -fz, rz = fx;
      const ending = state.t > 13;
      let anyVisible = false;
      for (const d of pod) {
        const ahead = 26 - state.t * 3.2 + d.ph * 10;
        const lat = d.lane + Math.sin(t * 0.8 + d.ph * 5) * 0.8;
        const x = boat.x + fx * ahead + rx * lat, z = boat.z + fz * ahead + rz * lat;
        const cyc = ((t * 0.55 + d.ph) % 1 + 1) % 1;
        const air = cyc < 0.45;
        const k = cyc / 0.45;
        const h = sea.heightAt(x, z);
        let y = air ? h - 0.6 + Math.sin(k * Math.PI) * 3.4 : h - 1.8;
        if (ending) { d.leaving = (d.leaving || 0) + dt; y -= d.leaving * 3; }
        d.x = x; d.y = y; d.z = z;
        d.group.position.set(x, y, z);
        d.group.rotation.set(air ? -Math.cos(k * Math.PI) * 0.9 : 0, state.yaw, Math.sin(t * 2 + d.ph) * 0.1);
        d.tail.rotation.x = Math.sin(t * 9 + d.ph * 4) * 0.35;
        if (air !== d.wasAir && !ending) cb.splash(x, h, z);
        d.wasAir = air;
        if (y > h - 1.4) anyVisible = true;
        // aviso cuando el primero salta delante, ya a la vista
        if (!state.announced && air && k > 0.2 && ahead > 4 && ahead < 26) { state.announced = true; cb.start(); }
        if (!d.given && !ending && air && Math.hypot(boat.x - x, boat.z - z) < 10.5) { d.given = true; state.given++; cb.gift(d); }
      }
      if (ending && !anyVisible) { state.done = true; pod.forEach((d) => { d.group.visible = false; }); }
    },
  };
}
