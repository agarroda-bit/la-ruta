// Créditos y licencias.
import { save } from '../core/save.js';
import { screen, button, esc, $ } from '../core/ui.js';

export function openCredits({ onClose } = {}) {
  const [a, b] = save.data.names;
  const s = screen('creditos', `
    <div class="panel creditos-panel no-ctrl">
      <h2>La Ruta</h2>
      <p class="cr-lema">Un viaje de ${esc(a)} y ${esc(b)}, de Phuket a Shanghái.</p>
      <h3>Hecho con</h3>
      <ul>
        <li><b>three.js</b> — motor 3D (licencia MIT, © 2010-2025 three.js authors)</li>
        <li><b>Vite</b> — empaquetado (MIT)</li>
        <li><b>Bungee</b> de David Jonathan Ross y <b>Baloo 2</b> de Ek Type — tipografías (SIL Open Font License 1.1)</li>
        <li>Modelos 3D, música y efectos: generados por código para este juego. Sin archivos de terceros.</li>
      </ul>
      <h3>Aviso</h3>
      <p>Personajes, lugares y negocios son inventados o genéricos. Ninguna marca real.</p>
      <div class="cr-botones"></div>
    </div>`);
  $('.cr-botones', s).append(
    button('Borrar partida', () => { if (confirm('¿Borrar toda la partida? No se puede deshacer.')) { save.reset(); location.reload(); } }, 'peligro'),
    button('Volver', async () => { await s.close(); onClose && onClose(); }, 'grande'),
  );
}
