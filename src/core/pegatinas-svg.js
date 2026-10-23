// Dibujo de cada pegatina: pegatina troquelada (borde blanco + sombra), fondo p.color,
// dibujo plano con contorno añil y cinta con el nombre corto. Sin <defs> ni filtros.
// locked = true → silueta gris del mismo dibujo con un "?" encima.

const O = '#1a1036'; // añil (contorno)
const CORAL = '#ff6f61', MANGO = '#ffb703', TURQ = '#2ec4b6', ROSA = '#ff4fa3', PAPEL = '#fff8ec';
const COCO = '#8b5a2b', PIEL = '#f2c29b', TAN = '#e8b98a';
const GRIS = '#3a3550';

// ── formas del troquel ───────────────────────────────────────────────────────
function poly(n, rOut, rIn, rot = -90, cx = 50, cy = 50) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? rIn : rOut;
    const a = ((rot + (i * 180) / n) * Math.PI) / 180;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join(' L')}Z`;
}
function flor(n = 8, r = 41, a = 5) {
  const pts = [];
  for (let i = 0; i < 64; i++) {
    const t = (i / 64) * Math.PI * 2;
    const rr = r + a * Math.cos(n * t);
    pts.push(`${(50 + rr * Math.cos(t)).toFixed(1)} ${(50 + rr * Math.sin(t)).toFixed(1)}`);
  }
  return `M${pts.join(' L')}Z`;
}
const FORMAS = {
  circulo: 'M6 50A44 44 0 1 1 94 50A44 44 0 1 1 6 50Z',
  estrella: poly(5, 47, 33),
  estallido: poly(12, 46, 38),
  flor: flor(),
  escudo: 'M50 6L88 16Q91 62 50 94Q9 62 12 16Z',
  gota: 'M50 4C66 26 88 42 88 60A38 34 0 0 1 12 60C12 42 34 26 50 4Z',
  ticket: 'M10 14H90V40A10 10 0 0 0 90 60V86H10V60A10 10 0 0 0 10 40Z',
  rombo: 'M50 3Q53 3 56 6L94 44Q97 50 94 56L56 94Q50 97 44 94L6 56Q3 50 6 44L44 6Q47 3 50 3Z',
  pildora: 'M36 16H64A34 34 0 0 1 64 84H36A34 34 0 0 1 36 16Z',
  corazon: 'M50 92C20 72 5 54 5 34A21 21 0 0 1 50 24A21 21 0 0 1 95 34C95 54 80 72 50 92Z',
  cuadro: 'M22 8H78Q92 8 92 22V78Q92 92 78 92H22Q8 92 8 78V22Q8 8 22 8Z',
};
FORMAS.hex = (() => {
  const p = [];
  for (let i = 0; i < 6; i++) { const a = ((-90 + i * 60) * Math.PI) / 180; p.push(`${(50 + 46 * Math.cos(a)).toFixed(1)} ${(50 + 46 * Math.sin(a)).toFixed(1)}`); }
  return `M${p.join(' L')}Z`;
})();

// ── dibujos ──────────────────────────────────────────────────────────────────
// Cada dibujo recibe k (mapea colores: en bloqueadas todo es gris) y bg (color del fondo).
const SW = `stroke="${O}" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"`;
const mk = (k) => ({
  C: (x, y, r, f) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${k(f)}" ${SW}/>`,
  E: (x, y, rx, ry, f) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${k(f)}" ${SW}/>`,
  P: (d, f) => `<path d="${d}" fill="${f === 'none' ? 'none' : k(f)}" ${SW}/>`,
  R: (x, y, w, h, rx, f) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${k(f)}" ${SW}/>`,
  // trazo grueso con contorno (pajita, flechas…)
  T: (d, col, w = 4) => `<path d="${d}" fill="none" stroke="${O}" stroke-width="${w + 3.5}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${k(col)}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`,
  // línea simple sin contorno
  L: (d, col, w = 2.5, extra = '') => `<path d="${d}" fill="none" stroke="${col === O ? O : k(col)}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`,
  D: (x, y, r = 2.4) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${O}"/>`,
  // chispa de 4 puntas
  S: (x, y, r, col) => `<path d="M${x} ${y - r}Q${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y}Q${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r}Q${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y}Q${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r}Z" fill="${k(col)}" stroke="${O}" stroke-width="2" stroke-linejoin="round"/>`,
  // mejillas
  B: (x, y) => `<ellipse cx="${x}" cy="${y}" rx="3.4" ry="2.2" fill="${k(ROSA)}" opacity=".7"/>`,
  X: (x, y, txt, size, col, extra = '') => `<text x="${x}" y="${y}" text-anchor="middle" font-family="Bungee, sans-serif" font-size="${size}" fill="${k(col)}" stroke="${O}" stroke-width="2.4" paint-order="stroke" stroke-linejoin="round" ${extra}>${txt}</text>`,
});

function estrella5(x, y, r, col, k) {
  return `<path d="${poly(5, r, r * 0.5, -90, x, y)}" fill="${k(col)}" ${SW}/>`;
}

function tuk({ P, C, R, L, D }, k) {
  // tuk-tuk de lado, caja ~0..60 × 0..40
  return P('M6 6Q6 2 10 2H50Q56 2 56 8V11H6Z', TURQ)
    + L('M11 11V22M51 11V20', O, 3)
    + C(33, 15, 5, PIEL) + D(31.5, 14.5, 1.2) + D(35, 14.5, 1.2)
    + P('M2 22H40L46 12Q58 14 58 26V33H2Z', MANGO)
    + L('M6 27H36', CORAL, 3)
    + C(13, 34, 6, O) + `<circle cx="13" cy="34" r="2.2" fill="${k(PAPEL)}"/>`
    + C(49, 34, 6, O) + `<circle cx="49" cy="34" r="2.2" fill="${k(PAPEL)}"/>`
    + C(55, 22, 2.4, PAPEL);
}

function guante(x, y, col, k, g, rot = 0) {
  const { P, R, L } = g;
  return `<g transform="translate(${x} ${y}) rotate(${rot})">`
    + P('M-13 -2Q-13 -16 0 -16Q13 -16 13 -2Q13 9 6 11L-6 11Q-13 9 -13 -2Z', col)
    + P('M-13 -1Q-19 0 -16 7Q-12 9 -9 5', col)
    + R(-8, 10, 16, 7, 2, PAPEL)
    + L('M-6 -8Q0 -11 6 -8', PAPEL, 2.2, 'opacity=".8"')
    + '</g>';
}

const DIBUJOS = {
  despegue: { forma: 'circulo', cinta: 'DESPEGUE', d: (g) =>
    g.P('M15 60a7 7 0 0 1 10-8a9 9 0 0 1 16 2a6 6 0 0 1 1 12H20a6 6 0 0 1-5-6Z', PAPEL)
    + g.L('M30 54C34 44 40 54 44 46', PAPEL, 3, 'stroke-dasharray="4 5"')
    + g.P('M82 18L28 42L48 50Z', PAPEL)
    + g.P('M82 18L48 50L54 64Z', '#ffd0e6')
    + g.D(56, 34, 2) + g.D(63, 31, 2) + g.L('M58 39q3 2 6-1', O, 2)
    + g.S(76, 44, 5, MANGO) + g.S(24, 26, 4, TURQ) },

  'primer-coco': { forma: 'gota', dy: 6, cinta: 'COCO', d: (g) =>
    g.C(50, 50, 21, COCO)
    + g.E(50, 37, 15, 5.5, PAPEL)
    + g.T('M55 37L61 19L71 14', ROSA, 4.5)
    + g.P('M70 42q8-4 10 4q-8 2-10-4Z', '#8ac926')
    + g.D(43, 52, 2.6) + g.D(57, 52, 2.6)
    + `<circle cx="44" cy="51" r=".9" fill="#fff"/><circle cx="58" cy="51" r=".9" fill="#fff"/>`
    + g.L('M46 58q4 4 8 0', O, 2.4) + g.B(38, 57) + g.B(62, 57) },

  'sin-monos': { forma: 'estrella', cinta: 'SIN MONOS', d: (g) =>
    g.C(31, 46, 7, COCO) + g.C(69, 46, 7, COCO)
    + `<circle cx="31" cy="46" r="3.4" fill="${g.k(TAN)}"/><circle cx="69" cy="46" r="3.4" fill="${g.k(TAN)}"/>`
    + g.C(50, 45, 18, COCO)
    + g.L('M45 28q3-6 7-1q2-4 5 0', O, 2.4)
    + g.E(50, 51, 14, 11, TAN)
    + `<g transform="rotate(-7 50 43)">${g.R(35, 38, 13, 9, 3.5, O)}${g.R(52, 38, 13, 9, 3.5, O)}${g.L('M48 41H52', O, 2.5)}${g.L('M38 40.5l4 0', TURQ, 2)}${g.L('M55 40.5l4 0', TURQ, 2)}</g>`
    + g.D(47.5, 52, 1.2) + g.D(52.5, 52, 1.2)
    + g.L('M43 57q7 5 14-2', O, 2.5)
    + g.S(76, 28, 4.5, PAPEL) },

  atardecer: { forma: 'circulo', cinta: 'ATARDECER', d: (g) =>
    g.C(54, 50, 19, MANGO)
    + g.L('M46 46q3-3 6 0M56 46q3-3 6 0', O, 2.4) + g.L('M50 53q4 3 8 0', O, 2.4)
    + g.P('M9 55Q50 50 91 55L88 74H12Z', TURQ)
    + g.L('M42 61H66M47 67H61', PAPEL, 2.5)
    + g.T('M26 72Q22 52 30 33', COCO, 4)
    + g.P('M30 33Q18 26 11 35Q22 31 30 33Z', '#6a994e')
    + g.P('M30 33Q40 22 49 29Q38 29 30 33Z', '#6a994e')
    + g.P('M30 33Q30 18 20 15Q29 23 30 33Z', '#8ac926')
    + g.L('M66 24l3 3 3-3M74 30l2.5 2.5 2.5-2.5', O, 2.2) },

  cocotero: { forma: 'hex', cinta: 'COCOTERO', d: (g) => {
    const cara = (x, y) => g.D(x - 4, y, 1.8) + g.D(x + 4, y, 1.8) + g.L(`M${x - 2.5} ${y + 4}q2.5 2.5 5 0`, O, 2);
    return g.C(37, 56, 13, COCO) + g.C(63, 56, 13, COCO) + g.C(50, 35, 13, COCO)
      + cara(37, 55) + cara(63, 55) + cara(50, 34)
      + g.C(76, 24, 9, MANGO) + g.X(76, 27.5, '40', 9, PAPEL)
      + g.P('M45 23q5-8 12-4q-6 0-7 6', '#8ac926'); } },

  calas: { forma: 'cuadro', cinta: 'CALAS', d: (g) =>
    g.P('M16 22L38 17L60 23L84 18V64L60 69L38 63L16 68Z', PAPEL)
    + g.L('M38 18V62M60 24V68', '#d8c9ad', 2)
    + g.P('M24 42q3-9 12-5q7-6 11 2q6 4-2 9q-9 6-17 2q-6-1-4-8Z', '#8ac926')
    + g.C(27, 38, 2.6, MANGO) + g.C(45, 48, 2.6, MANGO) + g.C(36, 52, 2.6, MANGO)
    + g.L('M44 44Q56 58 66 46', CORAL, 2.6, 'stroke-dasharray="3 4"')
    + g.T('M64 34l8 8M72 34l-8 8', CORAL, 3.5)
    + g.L('M74 54l4 2M70 58l5 1', TURQ, 2.2) },

  surfista: { forma: 'gota', dy: 6, cinta: 'OLAS', d: (g) =>
    g.P('M12 64Q22 38 46 44Q34 48 40 58Q58 50 88 64Z', TURQ)
    + g.L('M20 54Q28 44 40 45', PAPEL, 3)
    + `<g transform="translate(50 34) rotate(-10) scale(.7) translate(-54 -36)">`
    + g.P('M26 32L80 30Q78 42 70 45L36 45Q29 41 26 32Z', CORAL)
    + g.L('M32 37L76 35', PAPEL, 3)
    + g.T('M80 30L86 18', MANGO, 3)
    + g.L('M28 36L14 46', O, 3) + g.C(13, 47, 2.6, PAPEL)
    + g.C(52, 25, 5, PIEL) + g.D(50.5, 24.5, 1.2) + g.D(54, 24.5, 1.2)
    + `</g>`
    + g.C(70, 52, 2.4, PAPEL) + g.C(76, 47, 1.8, PAPEL) + g.C(30, 40, 2, PAPEL) },

  'sin-rozar': { forma: 'escudo', cinta: 'INTACTO', d: (g) =>
    g.P('M22 40L76 38Q73 54 64 56L34 56Q26 52 22 40Z', PAPEL)
    + g.L('M27 46L72 44', TURQ, 3.5)
    + g.T('M76 38Q82 30 80 22', MANGO, 3)
    + g.L('M40 48q3-3 6 0M52 48q3-3 6 0', O, 2.2)
    + g.S(30, 28, 6, MANGO) + g.S(68, 24, 4.5, PAPEL) + g.S(50, 22, 3.5, TURQ)
    + g.P('M16 66q1-10 10-11q9 0 11 11Z', '#8d99ae')
    + g.L('M22 60l3 1.2M31 60l-3 1.2', O, 1.8) + g.L('M24 64q2.5-2 5 0', O, 1.8) },

  taxista: { forma: 'ticket', cinta: 'TAXISTA', d: (g) =>
    g.E(48, 50, 27, 6, O)
    + g.P('M24 46Q24 22 48 21Q72 22 72 46Z', CORAL)
    + g.P('M24 40Q48 46 72 40V46Q48 52 24 46Z', O)
    + estrella5(48, 32, 7, MANGO, g.k)
    + g.L('M32 30q4-6 10-7', PAPEL, 2.2, 'opacity=".7"')
    + g.C(78, 24, 8.5, MANGO) + g.X(78, 27.5, 'x5', 8, PAPEL) },

  'sin-frenar': { forma: 'estrella', cinta: 'SIN FRENO', d: (g) =>
    g.L('M10 40H22M8 48H20M12 56H24', PAPEL, 3)
    + `<g transform="translate(23 26) scale(.95)">${tuk(g, g.k)}</g>`
    + g.S(80, 30, 5, MANGO) },

  derrape: { forma: 'estallido', cinta: 'DERRAPE', d: (g) =>
    g.C(20, 60, 7, PAPEL) + g.C(28, 64, 5, PAPEL) + g.C(16, 52, 4, PAPEL)
    + `<g transform="translate(31 25) scale(.84) rotate(-16 30 20)">${tuk(g, g.k)}</g>`
    + g.S(30, 66, 5, MANGO) + g.S(40, 70, 3.5, CORAL) + g.S(72, 62, 4.5, MANGO)
    + g.L('M22 70l-6 3M70 70l6 3', MANGO, 2.5) },

  propina: { forma: 'circulo', cinta: 'PROPINA', d: (g) =>
    g.P('M31 42Q17 32 13 43Q20 43 17 50Q26 49 31 51Z', PAPEL)
    + g.P('M69 42Q83 32 87 43Q80 43 83 50Q74 49 69 51Z', PAPEL)
    + g.C(50, 45, 20, MANGO)
    + `<circle cx="50" cy="45" r="15" fill="none" stroke="${O}" stroke-width="1.8" stroke-dasharray="2 3"/>`
    + g.D(44, 43, 2.4) + g.D(56, 43, 2.4)
    + g.P('M44 49q6 7 12 0Z', CORAL) + g.B(40, 49) + g.B(60, 49)
    + g.S(76, 22, 5, PAPEL) + g.S(24, 64, 4, PAPEL) },

  'wai-kru': { forma: 'flor', cinta: 'WAI KRU', d: (g) =>
    g.R(30, 58, 18, 12, 4, TURQ) + g.R(52, 58, 18, 12, 4, TURQ)
    + g.P('M50 17Q38 25 37 43Q36 56 42 62H50Z', PIEL)
    + g.P('M50 17Q62 25 63 43Q64 56 58 62H50Z', PIEL)
    + g.P('M40 44q-6 2-3 9q4 2 6-2', PIEL) + g.P('M60 44q6 2 3 9q-4 2-6-2', PIEL)
    + g.L('M44 28q1 6 1 12M56 28q-1 6-1 12', '#c98f63', 1.8)
    + [34, 40, 46, 52, 58, 64].map((x, i) => g.C(x, 59 + (i === 0 || i === 5 ? -2 : 0), 3.4, i % 2 ? ROSA : PAPEL)).join('')
    + g.S(26, 32, 5, PAPEL) + g.S(74, 30, 5, PAPEL) + g.S(70, 48, 3.5, ROSA) },

  'ko-1': { forma: 'estallido', cinta: 'KO 1', d: (g) =>
    g.L('M18 32l7 4M16 46l8 0M20 58l6-3', PAPEL, 3)
    + `<g transform="translate(44 50) scale(1.3)">${guante(0, 0, TURQ, g.k, g, -16)}</g>`
    + `<ellipse cx="42" cy="21" rx="13" ry="4" fill="none" stroke="${O}" stroke-width="6.5"/>`
    + `<ellipse cx="42" cy="21" rx="13" ry="4" fill="none" stroke="${g.k(PAPEL)}" stroke-width="3" stroke-dasharray="4 3"/>`
    + g.T('M55 22Q62 24 64 16', ROSA, 2.5)
    + g.X(75, 50, 'KO!', 13, MANGO, 'transform="rotate(12 75 50)"') },

  muralla: { forma: 'escudo', cinta: 'MURALLA', d: (g) =>
    g.R(23, 30, 54, 34, 4, '#f4a261')
    + g.L('M23 41H77M23 52H77M38 30V41M58 30V41M30 41V52M50 41V52M68 41V52M40 52V64M60 52V64', O, 2)
    + g.L('M39 45l5 2M61 45l-5 2', O, 2.2) + g.D(42, 48, 2) + g.D(58, 48, 2) + g.L('M45 58H55', O, 2.2)
    + `<g transform="translate(66 27) scale(.8)">${guante(0, 0, MANGO, g.k, g, 205)}</g>`
    + g.S(54, 24, 4, PAPEL) + g.S(80, 38, 3.5, PAPEL) },

  duelo: { forma: 'ticket', cinta: 'DUELO', d: (g) =>
    g.R(32, 18, 36, 42, 16, PAPEL)
    + `<rect x="37" y="23" width="26" height="32" rx="11" fill="${g.k('#9ad8f0')}" stroke="${O}" stroke-width="2"/>`
    + `<path d="M40 44a4 4 0 0 1 6-3a5 5 0 0 1 9 1a3 3 0 0 1 1 6H42a3 3 0 0 1-2-4Z" fill="${g.k(PAPEL)}"/>`
    + guante(34, 58, CORAL, g.k, g, 90)
    + `<g transform="translate(66 58) scale(-1 1)">${guante(0, 0, MANGO, g.k, g, 90)}</g>`
    + g.S(50, 56, 5, PAPEL) },

  macao: { forma: 'hex', cinta: 'NEÓN', d: (g) =>
    `<ellipse cx="51" cy="63" rx="34" ry="3.5" fill="${g.k(TURQ)}" opacity=".8"/>`
    + g.L('M8 40H20M10 48H18', MANGO, 3) + g.L('M6 56H16', TURQ, 3)
    + g.P('M16 56Q17 45 30 43L42 35Q52 31 64 35L74 43Q86 45 86 56Z', ROSA)
    + g.P('M45 38Q53 35 62 38L68 43H40Z', TURQ)
    + g.L('M22 50H80', TURQ, 2.5)
    + g.C(31, 57, 7, O) + `<circle cx="31" cy="57" r="2.6" fill="${g.k(TURQ)}"/>`
    + g.C(71, 57, 7, O) + `<circle cx="71" cy="57" r="2.6" fill="${g.k(TURQ)}"/>`
    + g.C(83, 49, 2.4, MANGO)
    + g.S(68, 22, 4.5, TURQ) + g.S(30, 26, 3.5, MANGO) },

  atajo: { forma: 'rombo', cinta: 'ATAJO', d: (g) =>
    g.T('M38 62V48Q38 42 44 42H56Q62 42 62 36V31', PAPEL, 7)
    + g.P('M53 33L62 20L71 33Z', PAPEL)
    + g.D(30, 34, 2) + g.L('M25 30l4 1', O, 2) + g.S(70, 52, 4.5, MANGO) },

  chispas: { forma: 'estrella', cinta: 'CHISPAS', d: (g) =>
    g.R(14, 50, 72, 10, 2, PAPEL)
    + `<path d="M20 50h7l-5 10h-7ZM36 50h7l-5 10h-7ZM52 50h7l-5 10h-7ZM68 50h7l-5 10h-7Z" fill="${g.k(CORAL)}"/>`
    + `<rect x="14" y="50" width="72" height="10" rx="2" fill="none" ${SW}/>`
    + g.C(56, 38, 11, O) + `<circle cx="56" cy="38" r="4" fill="${g.k('#c9c3d6')}"/>`
    + g.S(40, 42, 7, PAPEL) + g.S(30, 34, 4.5, CORAL) + g.S(44, 28, 4, ROSA) + g.S(26, 46, 3, PAPEL)
    + g.L('M36 48l-8-4M38 46l-4-10', CORAL, 2.2) },

  maglev: { forma: 'pildora', cinta: '430 KM/H', d: (g) =>
    g.L('M6 36H16M8 44H14M6 52H18', PAPEL, 3) + g.L('M10 40H14', MANGO, 3)
    + g.P('M18 30H52Q80 30 90 50Q86 58 72 58H18Z', PAPEL)
    + g.P('M56 34Q74 36 82 46L74 47Q66 40 56 40Z', O)
    + g.L('M20 50H84', CORAL, 3.5)
    + g.L('M26 38H48', TURQ, 4)
    + g.L('M58 37l6 1', TURQ, 2) },

  fuegos: { forma: 'circulo', cinta: 'FUEGOS', d: (g) => {
    const boom = (x, y, r, col) => {
      let s = '';
      for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; s += `M${(x + Math.cos(a) * r * 0.35).toFixed(1)} ${(y + Math.sin(a) * r * 0.35).toFixed(1)}L${(x + Math.cos(a) * r).toFixed(1)} ${(y + Math.sin(a) * r).toFixed(1)}`; }
      return g.L(s, col, 3) + `<circle cx="${x}" cy="${y}" r="2.2" fill="${g.k(PAPEL)}"/>`;
    };
    return boom(28, 28, 12, ROSA) + boom(72, 24, 11, MANGO) + boom(50, 18, 7, TURQ)
      + g.P('M10 72V56H18V48H27V58H33V44H41V60H47V52H56V40H58V30H60V40H62V52H70V46H78V56H86V64L90 72Z', O)
      + `<circle cx="59" cy="38" r="4" fill="${g.k(ROSA)}" stroke="${O}" stroke-width="2"/>`
      + `<path d="M21 54h2M21 60h2M36 50h2M36 56h2M50 58h2M73 52h2M73 58h2M82 60h2" stroke="${g.k(MANGO)}" stroke-width="2.4"/>`; } },

  'ruta-completa': { forma: 'estrella', cinta: 'LA RUTA', d: (g) =>
    g.P('M34 26H66V36Q66 52 50 54Q34 52 34 36Z', MANGO)
    + g.P('M34 30Q24 30 26 38Q28 44 36 44', 'none') + g.P('M66 30Q76 30 74 38Q72 44 64 44', 'none')
    + g.R(46, 54, 8, 5, 1, MANGO) + g.R(38, 58, 24, 7, 2, CORAL)
    + g.X(50, 46, '6', 14, PAPEL)
    + g.S(28, 20, 4, PAPEL) + g.S(74, 18, 4, TURQ) + g.C(24, 54, 2, PAPEL) + g.C(78, 52, 2, MANGO) },

  'tres-estrellas': { forma: 'circulo', cinta: 'TOP', d: (g) => {
    const cara = (x, y) => g.D(x - 3, y, 1.6) + g.D(x + 3, y, 1.6) + g.L(`M${x - 2} ${y + 3}q2 2 4 0`, O, 1.8);
    return estrella5(27, 52, 12, PAPEL, g.k) + estrella5(73, 52, 12, PAPEL, g.k) + estrella5(50, 38, 19, PAPEL, g.k)
      + cara(27, 53) + cara(73, 53) + g.D(45, 38, 2.3) + g.D(55, 38, 2.3) + g.P('M46 43q4 5 8 0Z', CORAL) + g.B(42, 43) + g.B(58, 43); } },

  reto: { forma: 'cuadro', cinta: 'RETO', d: (g) =>
    g.R(24, 22, 52, 44, 6, PAPEL)
    + g.P('M24 34V28Q24 22 30 22H70Q76 22 76 28V34Z', CORAL)
    + g.R(34, 16, 4, 10, 2, O) + g.R(62, 16, 4, 10, 2, O)
    + `<text x="50" y="32.5" text-anchor="middle" font-family="Bungee, sans-serif" font-size="8" fill="${g.k(PAPEL)}">HOY</text>`
    + g.P('M50 37Q61 46 59 55Q57 62 50 62Q42 62 41 55Q41 49 47 45Q47 51 51 51Q54 45 50 37Z', MANGO)
    + `<path d="M50 50Q55 54 54 57Q53 60 50 60Q46 60 46 57Q46 54 50 50Z" fill="${g.k(CORAL)}"/>` },

  fantasma: { forma: 'gota', dy: 4, cinta: 'BU!', d: (g) =>
    g.P('M30 66V44Q30 26 50 26Q70 26 70 44V66L64 61L57 66L50 61L43 66L36 61Z', PAPEL)
    + g.P('M29 42Q29 20 50 20Q71 20 71 42Z', CORAL)
    + g.L('M33 36Q50 30 67 36', PAPEL, 3)
    + g.R(46, 18, 8, 6, 2, MANGO)
    + g.E(43, 48, 3, 4, O) + g.E(57, 48, 3, 4, O)
    + g.P('M46 54q4 5 8 0Z', CORAL) + g.B(37, 54) + g.B(63, 54)
    + g.L('M76 34q4-2 6 1M74 42q4 0 6 3', PAPEL, 2.2) },

  compi: { forma: 'circulo', cinta: 'COMPI', d: (g) =>
    `<g transform="rotate(-12 28 46)">${g.R(17, 28, 22, 36, 5, PAPEL)}<rect x="20.5" y="32" width="15" height="25" rx="2" fill="${g.k(TURQ)}"/>${g.D(25, 42, 1.6)}${g.D(31, 42, 1.6)}${g.L('M25.5 47q2.5 2 5 0', O, 1.6)}</g>`
    + `<g transform="rotate(12 72 46)">${g.R(61, 28, 22, 36, 5, PAPEL)}<rect x="64.5" y="32" width="15" height="25" rx="2" fill="${g.k(ROSA)}"/>${g.D(69, 42, 1.6)}${g.D(75, 42, 1.6)}${g.L('M69.5 47q2.5 2 5 0', O, 1.6)}</g>`
    + g.T('M34 22Q50 10 64 20', MANGO, 3.5)
    + g.P('M60 14L68 22L58 25Z', MANGO)
    + `<path d="M50 56c-3-4-8-1-5 3l5 4 5-4c3-4-2-7-5-3Z" fill="${g.k(CORAL)}" ${SW}/>` },

  fotografo: { forma: 'cuadro', cinta: 'CLIC', d: (g) =>
    g.R(30, 24, 16, 10, 3, O)
    + g.R(18, 30, 64, 36, 8, CORAL)
    + g.L('M18 40H82', O, 2)
    + g.R(66, 34, 9, 5, 1.5, MANGO)
    + g.C(50, 50, 13, O) + `<circle cx="50" cy="50" r="8.5" fill="${g.k(TURQ)}"/><circle cx="47" cy="47" r="2.6" fill="${g.k(PAPEL)}"/>`
    + g.L('M80 22l4-5M84 28l6-2M74 18l1-6', MANGO, 2.6)
    + g.D(26, 36, 1.8) },

  estilista: { forma: 'corazon', cinta: 'ESTILO', d: (g) =>
    g.E(50, 46, 30, 8, MANGO)
    + g.P('M35 46Q34 25 50 25Q66 25 65 46Z', MANGO)
    + g.P('M35 38Q50 42 65 38L65.5 44Q50 48 34.5 44Z', ROSA)
    + g.P('M60 40l7-8l2 9Z', TURQ)
    + g.C(41, 59, 6.5, O) + g.C(59, 59, 6.5, O) + g.L('M47 58H53', O, 2.5)
    + g.L('M38 57l3-2M56 57l3-2', TURQ, 1.8)
    + g.S(22, 30, 4.5, PAPEL) + g.S(78, 28, 4, PAPEL) },
};

function cinta(y, txt, k, locked) {
  const tail = locked ? '#2e2a42' : '#e0d3bd';
  const fit = txt.length > 7 ? ` textLength="56" lengthAdjust="spacingAndGlyphs"` : '';
  return `<path d="M20 ${y + 3}H8L12 ${y + 8.5}L8 ${y + 14}H20Z" fill="${tail}" stroke="${O}" stroke-width="2.4" stroke-linejoin="round"/>`
    + `<path d="M80 ${y + 3}H92L88 ${y + 8.5}L92 ${y + 14}H80Z" fill="${tail}" stroke="${O}" stroke-width="2.4" stroke-linejoin="round"/>`
    + `<path d="M16 ${y}Q50 ${y - 3} 84 ${y}V${y + 12}Q50 ${y + 9} 16 ${y + 12}Z" fill="${k(PAPEL)}" stroke="${O}" stroke-width="2.6" stroke-linejoin="round"/>`
    + (locked ? '' : `<text x="50" y="${y + 8.6}" text-anchor="middle" font-family="Bungee, sans-serif" font-size="8" fill="${O}"${fit}>${txt}</text>`);
}

export function stickerSVG(p, size = 96, locked = false) {
  const def = DIBUJOS[p.id];
  const k = locked ? (c) => (c === 'none' ? 'none' : GRIS) : (c) => c;
  const bg = locked ? '#5a5574' : p.color;
  const forma = FORMAS[def ? def.forma : 'circulo'];
  let body = '';
  if (def) {
    const g = mk(k);
    g.k = k;
    const dibujo = def.d(g, bg);
    body = (def.dy ? `<g transform="translate(0 ${def.dy})">${dibujo}</g>` : dibujo) + cinta(72, def.cinta, k, locked);
  } else {
    const ini = p.name.split(' ').filter((w) => w.length > 2).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
    body = `<text x="50" y="62" text-anchor="middle" font-family="Bungee" font-size="30" fill="#fff">${locked ? '' : ini}</text>`;
  }
  const q = locked
    ? `<text x="50" y="62" text-anchor="middle" font-family="Bungee, sans-serif" font-size="38" fill="${PAPEL}" stroke="${O}" stroke-width="4" paint-order="stroke" stroke-linejoin="round">?</text>`
    : '';
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true"><g transform="translate(4 4) scale(.92)">`
    + `<path d="${forma}" transform="translate(1.5 3.5)" fill="${O}" opacity=".28" stroke="${O}" stroke-width="9" stroke-linejoin="round"/>`
    + `<path d="${forma}" fill="${locked ? '#d9d4e6' : '#fff'}" stroke="${locked ? '#d9d4e6' : '#fff'}" stroke-width="9" stroke-linejoin="round"/>`
    + `<path d="${forma}" fill="${bg}"/>`
    + body + q + `</g></svg>`;
}
