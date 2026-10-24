// Créditos finales: suben solos con los dos nombres y el resumen del viaje.
import { save } from '../core/save.js';
import { audio } from '../core/audio.js';
import { screen, button, esc, confetti, $ } from '../core/ui.js';
import { PEGATINAS } from '../core/pegatinas.js';
import { fmtTime } from '../core/util.js';

export function openFinale(stages, { onClose } = {}) {
  const [a, b] = save.data.names;
  const st = save.data.stats;
  const nPeg = Object.keys(save.data.stickers).length;
  const rows = stages.map((s) => {
    const d = save.data.stages[s.id] || {};
    const t = isFinite(d.bestTime) ? fmtTime(d.bestTime) : '—';
    return `<div class="fin-etapa"><span>${s.num}. ${esc(s.name)}</span><span class="fin-est">${'★'.repeat(d.stars || 0)}<i>${'☆'.repeat(3 - (d.stars || 0))}</i></span><span>${t}</span></div>`;
  }).join('');
  audio.music('final');
  const s = screen('final', `
    <div class="fin-rollo">
      <div class="fin-titulo">LA RUTA</div>
      <div class="fin-lema">Phuket → Shanghái</div>
      <div class="fin-par"><b>${esc(a)}</b><span>&amp;</span><b>${esc(b)}</b></div>
      <h3>El viaje</h3>
      ${rows}
      <h3>En números</h3>
      <div class="fin-nums">
        <div><b>${st.cocos | 0}</b> cocos</div>
        <div><b>${st.olas | 0}</b> olas saltadas</div>
        <div><b>${st.turistas | 0}</b> turistas llevados</div>
        <div><b>${st.golpes | 0}</b> golpes en el ring</div>
        <div><b>${st.atajos | 0}</b> atajos en Macao</div>
        <div><b>${st.energia | 0}</b> orbes de energía</div>
        <div><b>${st.partidas | 0}</b> partidas</div>
        <div><b>${st.fotos | 0}</b> fotos</div>
        <div><b>${nPeg}/${PEGATINAS.length}</b> pegatinas</div>
        <div><b>${save.totalStars()}/${stages.length * 3}</b> estrellas</div>
      </div>
      <h3>Reparto</h3>
      <p>Piloto de scooter, capitán de barca, taxista de tuk-tuk, luchador y maquinista: <b>${esc(a)}</b></p>
      <p>Copiloto, navegante, relaciones públicas y fotógrafo oficial: <b>${esc(b)}</b></p>
      <p>Monos, perros tumbados, turistas despistados y el taxista Zhou de Macao: <b>ellos mismos</b></p>
      <h3>Gracias</h3>
      <p>A Tailandia y a China, por la comida, el calor y la paciencia.</p>
      <p>Al wifi del avión, por no existir.</p>
      <div class="fin-fin">Fin del viaje.<br><small>De momento.</small></div>
    </div>
    <div class="fin-botones no-ctrl"></div>`);
  confetti(200);
  setTimeout(() => confetti(160), 2500);
  $('.fin-botones', s).append(button('Volver al mapa', async () => { await s.close(); onClose && onClose(); }, 'grande'));
}
