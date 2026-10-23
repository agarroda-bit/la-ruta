// Partida guardada en el móvil (localStorage). Siempre con try/catch: en modo privado
// o con el almacenamiento lleno el juego sigue funcionando, solo que sin recordar.
const KEY = 'laruta.partida.v1';

export const DEFAULT_LOOKS = [
  { skin: '#e0ac7e', hair: '#2b1a12', hairStyle: 0, shirt: '#ff6f61', pattern: 1, shorts: '#2e4a7d', glasses: true, cap: '#1f8a8a' },
  { skin: '#c68a5e', hair: '#5a3a1e', hairStyle: 1, shirt: '#36c2b4', pattern: 2, shorts: '#e8c170', glasses: false, cap: '' },
];

function fresh() {
  return {
    v: 1,
    names: ['Rodri', 'el Compi'],
    namesSet: false,
    looks: JSON.parse(JSON.stringify(DEFAULT_LOOKS)),
    stages: {}, // id → { stars, best, bestTime, plays, ghost, ghostCompi }
    stickers: {}, // id → fecha
    stats: { cocos: 0, golpes: 0, km: 0, turistas: 0, olas: 0, energia: 0, partidas: 0, fotos: 0, segundos: 0 },
    daily: {}, // 'AAAA-MM-DD:stage' → mejor puntuación
    settings: { music: 0.7, sfx: 0.9, quality: 'auto', battery: false, vibration: true, rain: true },
    seenDialogs: {},
    created: Date.now(),
  };
}

function merge(base, extra) {
  for (const k of Object.keys(extra || {})) {
    if (extra[k] && typeof extra[k] === 'object' && !Array.isArray(extra[k]) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) merge(base[k], extra[k]);
    else base[k] = extra[k];
  }
  return base;
}

let data = fresh();
try {
  const raw = localStorage.getItem(KEY);
  if (raw) data = merge(fresh(), JSON.parse(raw));
} catch (e) { /* sin almacenamiento: partida en memoria */ }

let timer = 0;
export const save = {
  get data() { return data; },
  // Guarda ya (y además cada cambio programa un guardado diferido).
  flush() {
    clearTimeout(timer);
    try { localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch (e) { return false; }
  },
  touch() { clearTimeout(timer); timer = setTimeout(() => save.flush(), 300); },
  stage(id) { return (data.stages[id] ||= { stars: 0, best: 0, bestTime: Infinity, plays: 0 }); },
  totalStars() { return Object.values(data.stages).reduce((a, s) => a + (s.stars || 0), 0); },
  addStat(k, n = 1) { data.stats[k] = (data.stats[k] || 0) + n; save.touch(); },
  reset() { data = fresh(); save.flush(); },
};
// bestTime Infinity no sobrevive a JSON (queda null): lo normalizamos al leer.
for (const s of Object.values(data.stages)) if (s.bestTime == null) s.bestTime = Infinity;
addEventListener('pagehide', () => save.flush());
document.addEventListener('visibilitychange', () => { if (document.hidden) save.flush(); });
