// Álbum de pegatinas (logros) y estadísticas del viaje.
import { save } from '../core/save.js';
import { screen, button, h, esc, $ } from '../core/ui.js';
import { PEGATINAS } from '../core/pegatinas.js';
import { stickerSVG } from '../core/pegatinas-svg.js';

export function openAlbum({ onClose } = {}) {
  const got = save.data.stickers;
  const n = Object.keys(got).length;
  const st = save.data.stats;
  const s = screen('album', `
    <div class="panel album-panel no-ctrl">
      <h2>Pegatinas <small>${n}/${PEGATINAS.length}</small></h2>
      <div class="album-grid"></div>
      <h3>Fotos del viaje</h3>
      <div class="album-fotos">${(save.data.photos || []).map((f) => `<img alt="Foto" src="${f.img}">`).join('') || '<div class="album-vacio">Aún no hay fotos: en cualquier etapa, pausa → 📷 Modo foto.</div>'}</div>
      <h3>El viaje en números</h3>
      <div class="album-stats">
        <div><b>${st.cocos | 0}</b><span>cocos</span></div>
        <div><b>${st.turistas | 0}</b><span>turistas</span></div>
        <div><b>${st.golpes | 0}</b><span>golpes</span></div>
        <div><b>${st.olas | 0}</b><span>olas saltadas</span></div>
        <div><b>${st.partidas | 0}</b><span>partidas</span></div>
        <div><b>${st.fotos | 0}</b><span>fotos</span></div>
      </div>
      <div class="album-botones"></div>
    </div>`);
  const grid = $('.album-grid', s);
  for (const p of PEGATINAS) {
    const have = !!got[p.id];
    const c = h('div', 'pegatina' + (have ? '' : ' bloqueada'));
    c.innerHTML = `${stickerSVG(p, 76, !have)}<div class="peg-nombre">${esc(have ? p.name : '???')}</div><div class="peg-desc">${esc(p.desc)}</div>`;
    grid.appendChild(c);
  }
  $('.album-botones', s).append(button('Volver', async () => { await s.close(); onClose && onClose(); }, 'grande'));
}
