// MACAO · trazado de la persecución, hecho con una "tortuga" (rectas y curvas).
// Sin dependencias de Three para poder comprobarlo en Node.
// Convención: adelante = (sin h, cos h); h aumenta = gira a la IZQUIERDA. ang > 0 = curva a la derecha.
// Tramos: plaza (salida en Taipa) → puente 1 (con saltos) → casco antiguo (4 atajos) → puente 2 → muelle.

const D = Math.PI / 180;

export function buildLayout(rng) {
  const j = (v, a) => v + (rng.range ? rng.range(-a, a) : 0);
  const cmds = [];
  const S = (len, kind, y, ease) => cmds.push({ t: 'S', len, kind, y, ease });
  const T = (ang, r, kind, y, ease) => cmds.push({ t: 'T', ang: ang * D, r, kind, y, ease });
  const M = (name, data = {}) => cmds.push({ t: 'M', name, data });
  // rodeo en U por fuera de una manzana: el atajo es la cuerda recta de A a B
  const detour = (side, type, a = 26, f = 20, r = 12) => {
    M('atajoA', { type, side });
    T(side * 90, r, 'city'); S(a, 'city'); T(-side * 90, r, 'city'); S(f, 'city');
    T(-side * 90, r, 'city'); S(a, 'city'); T(side * 90, r, 'city');
    M('atajoB', { type, side });
  };

  // salida: plaza de Taipa
  S(70, 'plaza', 0);
  // puente 1: largo, curvo, con dos saltos
  S(30, 'bridge', 3, true);
  T(j(-18, 4), 170, 'bridge', 6);
  S(j(60, 8), 'bridge', 7);
  M('salto');
  S(16, 'bridge', 9.4); S(34, 'bridge', 7.6);
  T(j(30, 5), 220, 'bridge', 8);
  S(j(80, 10), 'bridge', 8);
  T(j(20, 4), 200, 'bridge', 8.5);
  M('salto');
  S(16, 'bridge', 11); S(34, 'bridge', 8.6);
  T(j(-32, 4), 180, 'bridge', 6);
  S(j(110, 10), 'bridge', 6);
  T(j(24, 4), 260, 'bridge', 5);
  S(60, 'bridge', 3);
  S(40, 'bridge', 0, true);
  // casco antiguo
  S(j(40, 5), 'city', 0);
  T(90, 16, 'city');
  S(j(40, 5), 'city');
  detour(-1, 'callejon');
  S(30, 'city');
  T(-90, 16, 'city');
  M('iglesia');
  S(56, 'city');
  T(45, 30, 'city');
  S(j(30, 4), 'city');
  detour(1, 'escaleras', 26, 24);
  S(30, 'city');
  T(-45, 30, 'city');
  S(j(40, 5), 'city');
  detour(-1, 'mercado', 28, 34);
  S(30, 'city');
  T(90, 16, 'city');
  S(j(40, 5), 'city');
  T(-90, 16, 'city');
  S(30, 'city');
  detour(1, 'callejon2');
  S(36, 'city');
  T(-90, 18, 'city');
  S(j(46, 5), 'city');
  T(90, 18, 'city');
  S(40, 'city');
  // puente 2 hacia el muelle
  S(30, 'bridge', 3, true);
  T(j(25, 4), 200, 'bridge', 6);
  S(30, 'bridge', 7);
  M('salto');
  S(16, 'bridge', 9.6); S(34, 'bridge', 7);
  S(j(70, 8), 'bridge', 7);
  T(j(-40, 5), 220, 'bridge', 6);
  S(j(90, 10), 'bridge', 6);
  T(j(20, 4), 240, 'bridge', 5);
  S(60, 'bridge', 2);
  S(30, 'bridge', 0, true);
  // muelle
  S(140, 'pier', 0);

  // ── tortuga ──
  let x = 0, z = 0, h = Math.PI, y = 0, s = 0;
  const pts = [{ x, y, z, s, kind: 'plaza' }];
  const events = [];
  for (const c of cmds) {
    if (c.t === 'M') { events.push({ name: c.name, ...c.data, x, y, z, h, s }); continue; }
    const len = c.t === 'S' ? c.len : Math.abs(c.ang) * c.r;
    const n = Math.max(1, Math.ceil(len / 3));
    const y0 = y, y1 = c.y ?? y;
    for (let i = 1; i <= n; i++) {
      const k = i / n;
      if (c.t === 'T') { const dh = -c.ang / n; h += dh / 2; x += Math.sin(h) * len / n; z += Math.cos(h) * len / n; h += dh / 2; }
      else { x += Math.sin(h) * len / n; z += Math.cos(h) * len / n; }
      y = y0 + (y1 - y0) * (c.ease ? k * k * (3 - 2 * k) : k);
      s += len / n;
      pts.push({ x, y, z, s, kind: c.kind });
    }
  }
  const total = s;

  // atajos: rectas de A a B con su perfil de altura
  const shortcuts = [];
  const as = events.filter((e) => e.name === 'atajoA'), bs = events.filter((e) => e.name === 'atajoB');
  as.forEach((a, k) => {
    const b = bs[k];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const n = Math.ceil(len / 3);
    const sp = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      let yy = 0;
      if (a.type === 'escaleras') {
        // sube por escalones, rellano arriba y bajada corta: se sale volando
        if (u < 0.42) yy = 2.4 * (u / 0.42);
        else if (u < 0.66) yy = 2.4;
        else if (u < 0.8) yy = 2.4 * (1 - (u - 0.66) / 0.14);
        else yy = 0;
      }
      sp.push({ x: a.x + (b.x - a.x) * u, y: yy, z: a.z + (b.z - a.z) * u });
    }
    shortcuts.push({ type: a.type, side: a.side, a, b, pts: sp, len });
  });

  return { pts, events, shortcuts, total };
}

// Comprobación rápida (Node): distancia mínima entre tramos no vecinos
export function selfCheck(layout, minGap = 30) {
  const p = layout.pts;
  let worst = Infinity, where = null;
  for (let i = 0; i < p.length; i += 2) {
    for (let k = i + 2; k < p.length; k += 2) {
      if (p[k].s - p[i].s < 160) continue;
      const d = Math.hypot(p[i].x - p[k].x, p[i].z - p[k].z);
      if (d < worst) { worst = d; where = [p[i].s | 0, p[k].s | 0, p[i].kind, p[k].kind]; }
    }
  }
  return { worst, where, ok: worst >= minGap };
}
