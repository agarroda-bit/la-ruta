// Dibujo de cada pegatina (provisional: insignia con iniciales; el agente de la fase 7 hace los dibujos).
export function stickerSVG(p, size = 96, locked = false) {
  const ini = p.name.split(' ').filter((w) => w.length > 2).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const fill = locked ? '#3a3550' : p.color;
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true"><circle cx="50" cy="50" r="46" fill="#fff"/><circle cx="50" cy="50" r="40" fill="${fill}"/><text x="50" y="62" text-anchor="middle" font-family="Bungee" font-size="30" fill="#fff">${locked ? '?' : ini}</text></svg>`;
}
