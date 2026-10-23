// Pistas de La Ruta (composiciones originales; notación en secuenciador.js).
// Cada pista es un bucle de ~35-65 s con secciones A/B, variaciones y redobles (fill).
// El tema del viaje (TEMA_A / TEMA_B) suena en `mapa` y vuelve, emotivo, en `final`.

// ---- tema principal (re mayor pentatónico) ----
const TEMA_A = [
  'f#5:2 e5 d5 e5:2 a4:2 d5:3 e5 f#5:4',
  'f#5:2 a5:2 f#5:2 e5:2 d5:4 b4:4',
  'd5:2 e5:2 b4:2 d5:2 e5:3 f#5 e5:2 d5:2',
  'e5:6 .:2 a4:2 b4:2 d5:2 e5:2',
  'f#5:2 e5 d5 e5:2 a4:2 d5:3 e5 f#5:4',
  'a5:3 b5 a5:2 f#5:2 e5:4 d5:4',
  'b4:2 d5:2 e5:2 f#5:2 e5:2 d5:2 b4:2 a4:2',
  'd5:8 .:8',
].join(' ');
const TEMA_B = [
  'b5:4 a5:2 f#5:2 e5:4 d5:2 e5:2',
  'f#5:6 e5:2 c#5:4 a4:4',
  'a5:4 f#5:2 e5:2 f#5:4 a5:2 c#6:2',
  'b5:8 .:4 a5:2 b5:2',
  'd6:4 b5:2 a5:2 b5:4 a5:2 f#5:2',
  'e5:4 f#5:2 a5:2 e5:4 c#5:4',
  'd5:2 e5:2 f#5:2 a5:2 b5:2 a5:2 f#5:2 e5:2',
  'e5:4 .:4 a4:2 b4:2 d5:2 e5:2',
].join(' ');
const ACORDES_A = 'D Bm G A D Bm G Asus4,A';
const ACORDES_B = 'G A F#m Bm G A D A';

const una = (n) => `x:${16 * n}`; // un golpe al principio de n compases (platos, gongs)

export const PISTAS = {
  // ------------------------------------------------------------------ MAPA
  mapa: {
    bpm: 118, gain: 0.406, duck: 0.25, reverb: 0.32, delay: { t: 0.75, fb: 0.32, v: 0.45 },
    inst: {
      kick: { t: 'kick', v: 0.85 },
      clap: { t: 'clap', v: 0.34, rev: 0.25 },
      snare: { t: 'snare', v: 0.38, rev: 0.2 },
      hat: { t: 'hat', v: 0.16, pan: 0.25 },
      ohat: { t: 'ohat', v: 0.11, pan: -0.2 },
      shaker: { t: 'shaker', v: 0.15, pan: -0.35 },
      ching: { t: 'ching', v: 0.1, pan: 0.4, rev: 0.25 },
      tom: { t: 'tom', v: 0.42, rev: 0.15 },
      crash: { t: 'crash', v: 0.2, rev: 0.2 },
      bass: { t: 'bass', v: 0.5, oct: 2 },
      pad: { t: 'pad', v: 0.3, oct: 4, cut: 1700, rev: 0.45 },
      arp: { t: 'arp', v: 0.15, oct: 5, dly: 0.35, pan: 0.2 },
      lead: { t: 'lead', v: 0.22, dly: 0.22, rev: 0.2 },
      phin: { t: 'phin', v: 0.3, oct: 4, pan: -0.3, rev: 0.15 },
      phinm: { t: 'phin', v: 0.42, rev: 0.25, dly: 0.15 },
      ranat: { t: 'ranat', v: 0.24, oct: 5, pan: 0.3, rev: 0.2, kro: true },
      bell: { t: 'campana', v: 0.11, oct: 5, rev: 0.4, dly: 0.3, pan: -0.15 },
      khong: { t: 'khong', v: 0.2, rev: 0.3, pan: -0.15 },
    },
    sec: {
      I: { bars: 4, chords: ACORDES_A, p: { pad: 1, phin: '0.2.1.3.2.1.2.3.', ching: '....x.......x...', bell: '2...............' },
        fill: { tom: '........l.m.h.hh', snare: '............o.xx' } },
      A: { bars: 8, chords: ACORDES_A, p: {
        kick: 'x.......x..x....', clap: '....x.......x...', hat: '..x...x...x...x.', shaker: 'xgogxgogxgogxgog', ching: '....x.......x...',
        bass: 'r..rr.f.r..rf.o.', pad: 1, phin: '0.23.20.0.23.21.', lead: TEMA_A, crash: una(8) },
        fill: { snare: '........g.o.x.xx', hat: '..x...x.........', kick: 'x.......x.......' } },
      B: { bars: 8, chords: ACORDES_B, p: {
        kick: 'x...x...x...x...', clap: '....x.......x...', ohat: '..x...x...x...x.', shaker: 'xgogxgogxgogxgog', ching: '..o...o...o...o.',
        bass: 'r.r.r.r.r.r.f.o.', pad: 1, arp: '0123212301232123', lead: TEMA_B, bell: '2.......1.......', crash: una(8) },
        fill: { snare: '....x...o.o.xxxx', tom: '........h.m.l...' } },
      A2: { bars: 8, chords: ACORDES_A, p: {
        kick: 'x.......x..x....', clap: '....x.......x...', hat: '..x...x...x...x.', shaker: 'xgogxgogxgogxgog', ching: '....x.......x...',
        bass: 'r..rr.f.r..rf.o.', pad: 1, phinm: TEMA_A, ranat: '0.2.1.3.2.4.3.2.', khong: '0...............', crash: una(8) },
        fill: { tom: '....l.l.m.m.h.h.', snare: '............o.xx' } },
      C: { bars: 4, chords: 'Em G Bm A', p: {
        kick: 'x...............', pad: 1, shaker: 'g.g.g.g.g.g.g.g.',
        khong: 'e5:4 b4:4 g5:4 e5:4 d5:4 g5:4 b5:4 a5:4 f#5:4 d5:4 b4:4 d5:4 e5:4 c#5:4 a4:8',
        ranat: 'b5:8 a5:8 d6:8 b5:8 f#5:8 a5:8 e5:16' },
        fill: { tom: '....l.l.m.m.h.h.', snare: '............o.xx', kick: 'x.......x.x.x.x.' } },
    },
    order: ['I', 'A', 'B', 'A2', 'C'], loop: 1,
  },

  // ------------------------------------------------------------------ PHUKET (tropical house al atardecer)
  phuket: {
    bpm: 106, gain: 0.425, duck: 0.42, reverb: 0.3, swing: 0.08, delay: { t: 0.75, fb: 0.35, v: 0.5 },
    inst: {
      kick: { t: 'kick', v: 0.8 },
      clap: { t: 'clap', v: 0.3, rev: 0.35 },
      ohat: { t: 'ohat', v: 0.1, pan: 0.2 },
      shaker: { t: 'shaker', v: 0.15, pan: -0.3 },
      rim: { t: 'rim', v: 0.16, pan: 0.35, rev: 0.2 },
      crash: { t: 'crash', v: 0.16, rev: 0.3 },
      riser: { t: 'riser', v: 0.12, rev: 0.3 },
      bass: { t: 'bass', v: 0.5, oct: 2, cut: 380 },
      pad: { t: 'pad', v: 0.26, oct: 4, cut: 1200, a: 0.5, rev: 0.5 },
      steel: { t: 'steel', v: 0.32, rev: 0.25, dly: 0.25, pan: -0.15 },
      flauta: { t: 'flauta', v: 0.3, rev: 0.4, dly: 0.25 },
      ranat: { t: 'ranat', v: 0.2, pan: 0.3, rev: 0.25, oct: 5 },
      bell: { t: 'campana', v: 0.1, oct: 5, rev: 0.5, pan: 0.2 },
      hat2: { t: 'hat', v: 0.1, pan: -0.25, min: 0.5 },
    },
    sec: (() => {
      const riff = 'c#5 . e5 . f#5 e5 . c#5 . e5 . a5 f#5 . e5 . b4 . c#5 . e5 c#5 . b4 . a4 . b4 c#5:4';
      const mel = [
        'c#5:3 b4 a4:2 f#4:2 a4:4 .:2 e5:2', 'f#5:3 e5 c#5:2 a4:2 b4:6 .:2', 'c#5:2 e5:2 a5:3 f#5 e5:4 c#5:4', 'b4:6 c#5:2 b4:2 a4:2 g#4:4',
        'c#5:3 b4 a4:2 f#4:2 a4:4 .:2 e5:2', 'f#5:3 e5 c#5:2 e5:2 f#5:4 a5:4', 'e5:3 c#5 b4:2 a4:2 c#5:3 b4 a4:2 f#4:2', 'e4:2 f#4:2 a4:2 b4:2 c#5:4 .:4',
      ].join(' ');
      const ch = 'F#m D A E';
      const base = { kick: 'x...x...x...x...', clap: '....x.......x...', ohat: '..x...x...x...x.', shaker: 'o.go.go.o.go.gog', bass: 'r..r..r.....r.o.', pad: 1, hat2: 'g.g.g.g.g.g.g.g.' };
      return {
        I: { bars: 4, chords: ch, p: { pad: 1, steel: riff, rim: '......x.......x.', shaker: 'g.g.g.g.g.g.g.g.' }, fill: { riser: 'x:16', rim: '..x...x...x.x.x.' } },
        A: { bars: 8, chords: ch, p: { ...base, steel: riff, crash: una(8) }, fill: { clap: '....x.......x.x.' } },
        B: { bars: 8, chords: ch, p: { ...base, flauta: mel, rim: '......x.......x.', bell: '2...............', crash: una(8) }, fill: { clap: '....x...x.x.xxxx' } },
        A2: { bars: 8, chords: ch, p: { ...base, steel: riff, ranat: '..0...1...2.3.2.', crash: una(8) } },
        D: { bars: 4, chords: ch, p: { pad: 1, steel: 'c#5:4 e5:4 a5:4 f#5:4', bell: '2...............', riser: '.:32 x:32', shaker: 'g.g.g.g.g.g.g.g.' } },
      };
    })(),
    order: ['I', 'A', 'B', 'A2', 'D'], loop: 1,
  },

  // ------------------------------------------------------------------ SAMUI (olas + phin, relajada con pulso)
  samui: {
    bpm: 90, gain: 0.341, duck: 0.2, reverb: 0.38, swing: 0.12, delay: { t: 0.75, fb: 0.4, v: 0.5 },
    inst: {
      olas: { t: 'olas', v: 0.3, cut: 1500 },
      kick: { t: 'kick', v: 0.6 },
      rim: { t: 'rim', v: 0.2, pan: 0.3, rev: 0.25 },
      shaker: { t: 'shaker', v: 0.17, pan: -0.35 },
      klong: { t: 'klong', v: 0.26, pan: 0.15, rev: 0.15 },
      bass: { t: 'sub', v: 0.55, oct: 2 },
      khaen: { t: 'pad', v: 0.2, oct: 4, wave: 'square', cut: 1100, a: 0.8, r: 1.2, rev: 0.4 },
      phin: { t: 'phin', v: 0.44, pan: -0.15, rev: 0.25, dly: 0.2 },
      phin2: { t: 'phin', v: 0.2, pan: 0.3, rev: 0.2 },
      khong: { t: 'khong', v: 0.2, rev: 0.4, pan: 0.2 },
      bell: { t: 'campana', v: 0.08, oct: 6, rev: 0.6, pan: -0.3 },
    },
    sec: (() => {
      const ost = 'a4 e5 a4 c5 a4 e5 a4 d5 a4 e5 a4 c5 g4 e5 a4 c5';
      const ch = 'Am7 G Fmaj7 G';
      const base = { olas: 'x:32', kick: 'x.........x.....', rim: '....x.......x...', shaker: 'x.o.g.o.x.o.g.o.', bass: 'r:6 .:2 f:2 r:4 .:2', khaen: 1, phin2: ost };
      const mel = [
        'e5:2 g5:2 ~a5:4 g5:2 e5:2 d5:4', 'e5:3 d5 c5:2 d5:2 e5:4 .:4', 'c5:2 d5:2 e5:2 g5:2 e5:3 d5 c5:4', 'd5:6 c5:2 ~a4:8',
        'a5:2 g5:2 e5:2 g5:2 a5:4 c6:4', 'g5:3 e5 d5:2 e5:2 g5:4 ~a5:4', 'c6:4 a5:2 g5:2 e5:4 g5:2 e5:2', 'd5:4 e5:4 .:2 e5 d5 c5 a4:3',
      ].join(' ');
      return {
        I: { bars: 4, chords: ch, p: { olas: 'x:32', khaen: 1, phin2: ost, bell: '0...............' } },
        A: { bars: 8, chords: ch, p: { ...base, bell: '0...............' } },
        B: { bars: 8, chords: 'Am7 G Fmaj7 G Am7 G Fmaj7 Em7', p: { ...base, phin: mel, klong: 't..t..k.t..t..k.' }, fill: { klong: 't..t..k.t.t.kkkk' } },
        A2: { bars: 8, chords: ch, p: { ...base, khong: 'a5:8 e5:8 g5:8 d5:8 c5:8 e5:8 d5:16', klong: 't.....k.t.....k.' } },
      };
    })(),
    order: ['I', 'A', 'B', 'A2'], loop: 1,
  },

  // ------------------------------------------------------------------ BANGKOK (synthwave de noche + ranat y khong wong)
  bangkok: {
    bpm: 104, gain: 0.413, duck: 0.3, reverb: 0.38, delay: { t: 0.75, fb: 0.42, v: 0.55 },
    inst: {
      kick: { t: 'kick', v: 0.85 },
      snare: { t: 'snare', v: 0.48, rev: 0.5 },
      clap: { t: 'clap', v: 0.2, rev: 0.4 },
      hat: { t: 'hat', v: 0.14, pan: 0.25 },
      hat2: { t: 'hat', v: 0.09, pan: -0.3, min: 0.5 },
      ohat: { t: 'ohat', v: 0.1, pan: -0.2 },
      tom: { t: 'tom', v: 0.42, rev: 0.4 },
      crash: { t: 'crash', v: 0.2, rev: 0.3 },
      ching: { t: 'ching', v: 0.09, pan: 0.45, rev: 0.3 },
      bass: { t: 'bass', v: 0.42, oct: 2, cut: 600 },
      pad: { t: 'pad', v: 0.28, oct: 4, cut: 2000, rev: 0.5, icut: 0.6 },
      arp: { t: 'arp', v: 0.14, oct: 4, dly: 0.4, pan: -0.2 },
      lead: { t: 'lead', v: 0.22, dly: 0.35, rev: 0.3, preset: { waves: [['sawtooth', -8, 0.5], ['sawtooth', 8, 0.5]] } },
      ranat: { t: 'ranat', v: 0.26, pan: 0.3, rev: 0.25, kro: true },
      khong: { t: 'khong', v: 0.22, pan: -0.3, rev: 0.3 },
    },
    sec: (() => {
      const lead = [
        'b4:4 d5:2 e5:2 g5:4 e5:2 d5:2', 'e5:6 d5:2 b4:4 g4:4', 'a4:2 b4:2 d5:2 g5:2 a5:4 g5:2 e5:2', 'f#5:8 .:4 d5:2 e5:2',
        'b4:4 d5:2 e5:2 g5:4 b5:4', 'a5:4 g5:2 e5:2 g5:4 e5:2 d5:2', 'b4:2 d5:2 e5:4 d5:2 b4:2 a4:4', 'a4:8 .:8',
      ].join(' ');
      const tai = 'e5:2 g5:2 a5:4 c6:2 b5:2 a5:4 g5:2 e5:2 b5:6 .:2 a5:2 g5:2 e5:4 g5:4 c6:4 b5:4 a5:12 .:4';
      const dr = { kick: 'x.......x.x.....', snare: '....x.......x...', hat: 'o.x.o.x.o.x.o.x.', hat2: 'gggggggggggggggg', bass: 'r.r.r.r.r.r.r.r.', pad: 1, crash: una(8) };
      return {
        I: { bars: 4, chords: 'Em C G D', p: { pad: 1, arp: '0123432101234321', ching: '....x.......x...' }, fill: { tom: '....l.l.m.m.h.hh', snare: '............x.xx' } },
        A: { bars: 8, chords: 'Em C G D', p: { ...dr, lead, arp: '0123432101234321' }, fill: { tom: '........h.h.m.l.', snare: '....x.......x.xx' } },
        B: { bars: 8, chords: 'C D Bm Em', p: { ...dr, bass: 'r.r.r.r.r.r.o.r.', ohat: '..x...x...x...x.', ching: '..o...o...o...o.',
          ranat: 'e5 g5 a5 b5 d6 b5 a5 g5 e5 g5 a5 b5 a5 g5 e5 d5', khong: 'e4:2 b4:2 a4:2 g4:2 e4:2 d4:2 e4:2 g4:2' }, fill: { snare: '....x...o.o.xxxx' } },
        T: { bars: 4, chords: 'Am Em C D', p: { kick: 'x.......x.......', snare: '....x.......x...', hat: 'o.x.o.x.o.x.o.x.', bass: 'r.......r.......', pad: 1, lead: tai, ranat: tai, ching: '....x.......x...' },
          fill: { tom: '....l.l.m.m.h.hh', snare: '........o.o.xxxx' } },
      };
    })(),
    order: ['I', 'A', 'B', 'A', 'T'], loop: 1,
  },

  // ------------------------------------------------------------------ MUAY THAI (estadio: pi java + klong + ching; acelera con intensity)
  muaythai: {
    bpm: 120, accel: 0.4, gain: 0.325, duck: 0.15, reverb: 0.3, delay: { t: 0.5, fb: 0.2, v: 0.3 },
    inst: {
      klong: { t: 'klong', v: 0.72, pan: -0.15, iv: 0.3 },
      klong2: { t: 'klong', v: 0.58, pan: 0.25, iv: 0.3 },
      ching: { t: 'ching', v: 0.13, pan: 0.1, rev: 0.25 },
      pi: { t: 'pijava', v: 0.27, rev: 0.32, dly: 0.08 },
      gong: { t: 'gong', v: 0.32, nota: 43, rev: 0.4 },
      kick: { t: 'kick', v: 0.7, min: 0.35 },
      drone: { t: 'sub', v: 0.28, oct: 2, min: 0.55 },
      taiko: { t: 'taiko', v: 0.5, min: 0.7, rev: 0.25 },
      tom: { t: 'tom', v: 0.36, min: 0.7, rev: 0.2 },
    },
    sec: (() => {
      const P = 'd5:2 e5 d5 b4:2 a4:2 g4:2 a4:2 b4:2 d5:2 e5:4 ~g5:2 e5:2 d5:2 e5 d5 b4:4 g5:2 a5 g5 e5:2 d5:2 e5:2 g5:2 a5:4 ~b5:6 a5 g5 e5:4 d5:4';
      const Q = 'g5:2 a5:2 b5:2 d6:2 b5 a5 g5:2 a5:4 e6:4 d6:2 b5:2 a5:2 b5 a5 g5:4 d6:2 b5:2 a5:2 g5:2 e5:2 g5:2 a5:2 b5:2 a5:2 g5 a5 b5:4 ~g5:8';
      const P2 = 'b4:2 d5 b4 a4:2 g4:2 e4:2 g4:2 a4:2 b4:2 d5:4 ~e5:2 d5:2 b4:2 d5 b4 a4:4 e5:2 g5 e5 d5:2 b4:2 d5:2 e5:2 g5:4 ~a5:6 g5 e5 d5:4 b4:4';
      const c = { ching: 'o...x...o...x...', gong: una(4), kick: 'x.......x.......', drone: 'r:16', taiko: 'x.....x.x.......' };
      return {
        A: { bars: 4, chords: 'G', p: { ...c, klong: 'D..k..d.k.d.k...', klong2: '..t.t..t..t.t.tt', pi: P } },
        B: { bars: 4, chords: 'G G C G', p: { ...c, klong: 'D.dk.dd.k.dkk.d.', klong2: '.t.t.tt..t.t.ttt', pi: Q, tom: '..........h.m.l.' }, fill: { klong: 'd.d.k.k.dkdkDDDD', tom: 'l.l.m.m.h.h.hhhh' } },
        A2: { bars: 4, chords: 'G', p: { ...c, klong: 'D..k..d.k.d.k..k', klong2: '..t.t..t.tt.t.tt', pi: P2 } },
        B2: { bars: 4, chords: 'G G C D', p: { ...c, klong: 'D.dk.dd.k.dkk.d.', klong2: '.t.t.tt..t.t.ttt', pi: Q, tom: '..........h.m.l.' }, fill: { klong: 'D.k.D.k.dkdkDDDD', tom: 'l.l.m.m.h.h.hhhh', ching: 'o.x.o.x.o.x.xxxx' } },
      };
    })(),
    order: ['A', 'B', 'A2', 'B2'], loop: 0,
  },

  // ------------------------------------------------------------------ WAI KRU (baile ritual: 100 bpm exactos, pulso muy claro)
  waikru: {
    bpm: 100, gain: 0.399, duck: 0.12, reverb: 0.35, delay: { t: 1, fb: 0.25, v: 0.3 },
    inst: {
      ching: { t: 'ching', v: 0.18, rev: 0.25 },
      kick: { t: 'kick', v: 0.6 },
      klong: { t: 'klong', v: 0.45, pan: -0.15 },
      pi: { t: 'pijava', v: 0.28, rev: 0.4, dly: 0.1 },
      khong: { t: 'khong', v: 0.22, pan: 0.2, rev: 0.3 },
      drone: { t: 'pad', v: 0.16, oct: 3, wave: 'square', cut: 800, a: 1, r: 1.5, rev: 0.4 },
      gong: { t: 'gong', v: 0.3, nota: 45, rev: 0.4 },
      tom: { t: 'tom', v: 0.3, min: 0.6, rev: 0.25 },
    },
    sec: (() => {
      const W = [
        'e5:4 ~a5:4 g5:2 e5:2 d5:4', 'c5:4 d5:2 e5:2 d5:8', 'g5:4 e5:2 d5:2 c5:2 d5:2 e5:4', '~a4:12 .:4',
        'a5:4 g5:2 e5:2 g5:4 a5:2 c6:2', 'd6:4 c6:2 a5:2 g5:8', 'e5:2 g5:2 a5:4 g5:2 e5:2 d5:2 c5:2', 'a4:8 .:8',
      ].join(' ');
      const K = 'a4:4 c5:4 e5:4 c5:4 a4:4 d5:4 e5:4 d5:4 g4:4 b4:4 d5:4 b4:4 a4:4 e5:4 a5:4 e5:4';
      const c = { ching: 'x...o...x...o...', kick: 'x.......x.......', gong: una(4) };
      return {
        I: { bars: 2, chords: 'Am', p: { ...c, gong: una(2), klong: 'd.......d.......' } },
        A: { bars: 8, chords: 'Am Am G Am', p: { ...c, klong: 'd...k...d.d.k...', pi: W, khong: K, drone: 1 } },
        B: { bars: 8, chords: 'Am Am G Am', p: { ...c, klong: 'd..kk...d.d.k.k.', pi: W, khong: K, drone: 1, tom: '............m.l.' }, fill: { klong: 'd...k...d.d.kkkk' } },
      };
    })(),
    order: ['I', 'A', 'B'], loop: 1,
  },

  // ------------------------------------------------------------------ MACAO (neón y bajo, persecución)
  macao: {
    bpm: 128, gain: 0.301, duck: 0.4, reverb: 0.28, delay: { t: 0.75, fb: 0.35, v: 0.45 },
    inst: {
      kick: { t: 'kick', v: 0.95 },
      clap: { t: 'clap', v: 0.38, rev: 0.25 },
      hat: { t: 'hat', v: 0.17, pan: 0.2 },
      hat16: { t: 'hat', v: 0.11, pan: -0.25, min: 0.5 },
      ohat: { t: 'ohat', v: 0.11, pan: -0.15 },
      crash: { t: 'crash', v: 0.2, rev: 0.25 },
      riser: { t: 'riser', v: 0.14, rev: 0.3 },
      bass: { t: 'reese', v: 0.34, oct: 2, cut: 700 },
      pad: { t: 'pad', v: 0.2, oct: 4, cut: 1400, rev: 0.45, icut: 1 },
      arp: { t: 'arp', v: 0.15, oct: 4, dly: 0.3, pan: 0.2 },
      lead: { t: 'lead', v: 0.2, dly: 0.3, rev: 0.2, min: 0.5 },
      lead2: { t: 'lead', v: 0.2, dly: 0.3, rev: 0.2 },
      erhu: { t: 'erhu', v: 0.3, rev: 0.35, dly: 0.15 },
      guzheng: { t: 'guzheng', v: 0.3, pan: -0.3, rev: 0.3 },
    },
    sec: (() => {
      const stab = 'f5:2 .:1 f5:1 ab5:2 .:2 c6:2 bb5:2 ab5:2 f5:2 eb5:2 .:1 eb5:1 f5:2 .:2 ab5:4 .:4';
      const erhu = [
        'f5:4 eb5:2 c5:2 ab4:4 bb4:2 c5:2', 'eb5:6 c5:2 bb4:8', 'c5:2 eb5:2 f5:4 ab5:3 g5 f5:4', 'f5:12 .:4',
        'ab5:4 f5:2 eb5:2 f5:4 ab5:2 bb5:2', 'g5:4 eb5:2 bb4:2 eb5:8', 'c5:2 eb5:2 f5:2 ab5:2 c6:4 bb5:2 ab5:2', 'f5:8 .:8',
      ].join(' ');
      const gliss = 'f4 ab4 bb4 c5 eb5 f5 ab5 bb5 c6 eb6 f6 . . . . .';
      const dr = { kick: 'x...x...x...x...', clap: '....x.......x...', hat: '..x...x...x...x.', hat16: 'gogggogggogggogg', bass: 'r.rr.rr.r.rr.ror', pad: 1, arp: '0212031202120312', crash: una(8) };
      return {
        A: { bars: 8, chords: 'Fm Db Ab Eb', p: { ...dr, lead: stab }, fill: { clap: '....x.......x.xx', riser: '.:8 x:8' } },
        B: { bars: 8, chords: 'Db Eb Fm Fm', p: { ...dr, ohat: '..x...x...x...x.', erhu }, fill: { guzheng: gliss, clap: '....x...x.x.xxxx' } },
        A2: { bars: 8, chords: 'Fm Db Ab Eb', p: { ...dr, lead2: stab, guzheng: '0.2.1.3.2.1.0.2.' }, fill: { guzheng: gliss } },
        D: { bars: 4, chords: 'Db Eb Fm Fm', p: { pad: 1, erhu: 'f5:4 eb5:2 c5:2 ab4:4 bb4:2 c5:2 eb5:6 c5:2 bb4:8 c5:2 eb5:2 f5:4 ab5:3 g5 f5:4 f5:12 .:4', riser: '.:32 x:32', hat: '..x...x...x...x.' },
          fill: { clap: 'x.x.x.x.xxxxxxxx' } },
      };
    })(),
    order: ['A', 'B', 'A2', 'D'], loop: 0,
  },

  // ------------------------------------------------------------------ SHANGHAI (épica final, tren a 430 km/h)
  shanghai: {
    bpm: 140, gain: 0.253, duck: 0.28, reverb: 0.36, delay: { t: 0.75, fb: 0.3, v: 0.4 },
    inst: {
      taiko: { t: 'taiko', v: 0.6, rev: 0.25, iv: 0.3 },
      tom: { t: 'tom', v: 0.38, rev: 0.25 },
      kick: { t: 'kick', v: 0.8 },
      snare: { t: 'snare', v: 0.42, rev: 0.35, min: 0.3 },
      hat16: { t: 'hat', v: 0.09, pan: 0.25, min: 0.6 },
      crash: { t: 'crash', v: 0.2, rev: 0.3 },
      tamtam: { t: 'tamtam', v: 0.38, rev: 0.4 },
      boom: { t: 'boom', v: 0.45 },
      riser: { t: 'riser', v: 0.13, rev: 0.3 },
      bass: { t: 'bass', v: 0.42, oct: 2, cut: 700 },
      cuerdas: { t: 'arp', v: 0.16, oct: 4, pan: -0.15, dly: 0.15 },
      pad: { t: 'pad', v: 0.28, oct: 4, cut: 2200, a: 0.25, rev: 0.5, icut: 0.5 },
      erhu: { t: 'erhu', v: 0.32, rev: 0.4, dly: 0.12 },
      guzheng: { t: 'guzheng', v: 0.3, oct: 4, pan: 0.3, rev: 0.3 },
      brass: { t: 'brass', v: 0.24, tr: -12, rev: 0.35, min: 0.6 },
    },
    sec: (() => {
      const S = [
        'a5:4 g5:2 f5:2 d5:4 f5:2 g5:2', 'a5:6 c6:2 a5:4 g5:4', 'f5:2 g5:2 a5:2 c6:2 d6:4 c6:2 a5:2', 'g5:8 e5:4 g5:4',
        'a5:4 g5:2 f5:2 d5:4 f5:2 a5:2', 'd6:6 c6:2 a5:4 f5:4', 'g5:2 a5:2 c6:2 a5:2 g5:2 f5:2 g5:2 a5:2', 'e5:4 c#5:4 ~a5:8',
      ].join(' ');
      const T = [
        'd6:4 bb5:2 a5:2 g5:4 a5:2 bb5:2', 'c6:4 d6:2 f6:2 d6:8', 'e6:4 d6:2 c6:2 g5:4 c6:4', 'c#6:8 e6:4 a5:4',
        'bb5:4 a5:2 g5:2 d6:4 c6:2 bb5:2', 'a5:4 bb5:2 c6:2 d6:4 f6:4', 'e6:2 d6:2 c6:2 bb5:2 a5:2 g5:2 a5:2 c6:2', 'd6:12 .:4',
      ].join(' ');
      const dr = { taiko: 'x.....x...x.....', kick: 'x...x...x...x...', snare: '....x.......x...', hat16: 'xgogxgogxgogxgog', bass: 'r.rrr.rrr.rrr.rr', cuerdas: '0101010121212121', pad: 1, crash: una(8) };
      return {
        I: { bars: 4, chords: 'Dm Bb F C', p: { pad: 1, taiko: 'x.......x..x....', tamtam: una(4), boom: una(4), cuerdas: '0101010101010101', riser: '.:32 x:32' },
          fill: { tom: 'l.l.m.m.h.h.hhhh', taiko: 'x...x...x.x.x.x.' } },
        A: { bars: 8, chords: 'Dm Bb F C Dm Bb F A', p: { ...dr, erhu: S, tamtam: una(8) }, fill: { tom: '........h.m.l.l.', snare: '....x...o.o.xxxx' } },
        B: { bars: 8, chords: 'Gm Bb C A Gm Bb C Dm', p: { ...dr, erhu: T, brass: T, guzheng: '0123212301232123', boom: una(8) }, fill: { tom: 'l.l.m.m.h.h.hhhh', snare: '........xxxxxxxx' } },
        A2: { bars: 8, chords: 'Dm Bb F C Dm Bb F A', p: { ...dr, erhu: S, guzheng: '0.1.2.3.2.1.2.3.', tamtam: una(8) }, fill: { tom: '........h.m.l.l.' } },
        C: { bars: 4, chords: 'Bb C Dm Dm', p: { pad: 1, taiko: 'x.......x.......', guzheng: '0123432101234321', erhu: 'd6:16 c6:16 a5:16 .:16', riser: '.:32 x:32' },
          fill: { taiko: 'x.x.x.x.xxxxxxxx', tom: 'l.l.m.m.h.h.hhhh' } },
      };
    })(),
    order: ['I', 'A', 'B', 'A2', 'C'], loop: 1,
  },

  // ------------------------------------------------------------------ FINAL (créditos: el tema del viaje, emotivo)
  final: {
    bpm: 84, gain: 0.247, duck: 0.12, reverb: 0.45, delay: { t: 0.75, fb: 0.35, v: 0.4 },
    inst: {
      kick: { t: 'kick', v: 0.55 },
      rim: { t: 'rim', v: 0.18, pan: 0.25, rev: 0.3 },
      shaker: { t: 'shaker', v: 0.1, pan: -0.3 },
      ching: { t: 'ching', v: 0.08, pan: 0.4, rev: 0.4 },
      bass: { t: 'sub', v: 0.45, oct: 2 },
      keys: { t: 'keys', v: 0.42, oct: 4, rev: 0.35 },
      pad: { t: 'pad', v: 0.24, oct: 4, cut: 1300, a: 0.9, r: 1.5, rev: 0.55 },
      erhu: { t: 'erhu', v: 0.32, rev: 0.45, dly: 0.12 },
      guzheng: { t: 'guzheng', v: 0.32, tr: -12, rev: 0.4, pan: 0.15 },
      phin: { t: 'phin', v: 0.24, oct: 4, pan: -0.3, rev: 0.3 },
      bell: { t: 'campana', v: 0.1, oct: 5, rev: 0.6, dly: 0.2 },
      khong: { t: 'khong', v: 0.16, rev: 0.45, pan: 0.3 },
    },
    sec: (() => {
      const chA = 'D Bm7 Gmaj7 A D Bm7 Gmaj7 Asus4,A';
      const chB = 'G A F#m Bm7 G A D D';
      return {
        I: { bars: 4, chords: chA, p: { keys: '0.1.2.3.2.1.0.1.', pad: 1, bell: '2...............' } },
        A: { bars: 8, chords: chA, p: { keys: '0.1.2.3.2.1.2.1.', pad: 1, bass: 'r:12 f:4', erhu: TEMA_A } },
        B: { bars: 8, chords: chB, p: { keys: '0...2...1...3...', pad: 1, bass: 'r:12 f:4', guzheng: TEMA_B, kick: 'x.......x.......', rim: '....x.......x...', shaker: 'g.o.g.o.g.o.g.o.', bell: '2...............' } },
        A2: { bars: 8, chords: chA, p: { keys: '0.1.2.3.2.1.2.1.', pad: 1, bass: 'r:12 f:4', erhu: TEMA_A, phin: '0.2.3.2.0.2.3.2.', kick: 'x.......x.......', rim: '....x.......x...', shaker: 'g.o.g.o.g.o.g.o.', ching: '....x.......x...', khong: '0...............' } },
      };
    })(),
    order: ['I', 'A', 'B', 'A2'], loop: 1,
  },
};
