// Pistas de cada etapa (provisional; las compone el agente de audio).
const _ = null;
export const PISTAS = {
  mapa: { bpm: 96, tracks: [
    { type: 'kick', notes: [1, _, _, _, _, _, _, _, 1, _, _, _, _, _, _, _] },
    { type: 'hat', notes: [_, _, 1, _, _, _, 1, _] },
    { type: 'bass', notes: [45, _, _, _, 45, _, _, _, 48, _, _, _, 50, _, _, _], len: 3 },
    { type: 'lead', notes: [69, _, 72, _, 74, _, 76, _, 74, _, 72, _, 69, _, _, _, 67, _, 69, _, 72, _, 69, _, 67, _, 64, _, _, _, _, _], len: 1.5 },
  ] },
};
for (const id of ['phuket', 'samui', 'bangkok', 'muaythai', 'macao', 'shanghai', 'final']) PISTAS[id] = PISTAS.mapa;
