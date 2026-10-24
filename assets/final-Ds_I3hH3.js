import{aF as s,N as m,ah as i,aC as f,aI as $,aJ as u,aK as p,aL as h,aD as g}from"./index-CqzPek-v.js";function T(o,{onClose:n}={}){const[d,l]=s.data.names,a=s.data.stats,r=Object.keys(s.data.stickers).length,v=o.map(e=>{const t=s.data.stages[e.id]||{},b=isFinite(t.bestTime)?m(t.bestTime):"—";return`<div class="fin-etapa"><span>${e.num}. ${i(e.name)}</span><span class="fin-est">${"★".repeat(t.stars||0)}<i>${"☆".repeat(3-(t.stars||0))}</i></span><span>${b}</span></div>`}).join("");f.music("final");const c=$("final",`
    <div class="fin-rollo">
      <div class="fin-titulo">LA RUTA</div>
      <div class="fin-lema">Phuket → Shanghái</div>
      <div class="fin-par"><b>${i(d)}</b><span>&amp;</span><b>${i(l)}</b></div>
      <h3>El viaje</h3>
      ${v}
      <h3>En números</h3>
      <div class="fin-nums">
        <div><b>${a.cocos|0}</b> cocos</div>
        <div><b>${a.olas|0}</b> olas saltadas</div>
        <div><b>${a.turistas|0}</b> turistas llevados</div>
        <div><b>${a.golpes|0}</b> golpes en el ring</div>
        <div><b>${a.atajos|0}</b> atajos en Macao</div>
        <div><b>${a.energia|0}</b> orbes de energía</div>
        <div><b>${a.partidas|0}</b> partidas</div>
        <div><b>${a.fotos|0}</b> fotos</div>
        <div><b>${r}/${u.length}</b> pegatinas</div>
        <div><b>${s.totalStars()}/${o.length*3}</b> estrellas</div>
      </div>
      <h3>Reparto</h3>
      <p>Piloto de scooter, capitán de barca, taxista de tuk-tuk, luchador y maquinista: <b>${i(d)}</b></p>
      <p>Copiloto, navegante, relaciones públicas y fotógrafo oficial: <b>${i(l)}</b></p>
      <p>Monos, perros tumbados, turistas despistados y el taxista Zhou de Macao: <b>ellos mismos</b></p>
      <h3>Gracias</h3>
      <p>A Tailandia y a China, por la comida, el calor y la paciencia.</p>
      <p>Al wifi del avión, por no existir.</p>
      <div class="fin-fin">Fin del viaje.<br><small>De momento.</small></div>
    </div>
    <div class="fin-botones no-ctrl"></div>`);p(200),setTimeout(()=>p(160),2500),h(".fin-botones",c).append(g("Volver al mapa",async()=>{await c.close(),n&&n()},"grande"))}export{T as openFinale};
