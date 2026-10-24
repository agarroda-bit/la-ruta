import{aF as s,T as u,ah as i,aC as h,aI as g,aJ as T,aK as v,aL as p,aD as b}from"./index-BK6RoS8e.js";function j(o,{onClose:d}={}){const[l,c]=s.data.names,a=s.data.stats,f=Object.keys(s.data.stickers).length,m=o.map(n=>{const t=s.data.stages[n.id]||{},$=isFinite(t.bestTime)?u(t.bestTime):"—";return`<div class="fin-etapa"><span>${n.num}. ${i(n.name)}</span><span class="fin-est">${"★".repeat(t.stars||0)}<i>${"☆".repeat(3-(t.stars||0))}</i></span><span>${$}</span></div>`}).join("");h.music("final");const e=g("final",`
    <div class="fin-rollo">
      <div class="fin-titulo">LA RUTA</div>
      <div class="fin-lema">Phuket → Shanghái</div>
      <div class="fin-par"><b>${i(l)}</b><span>&amp;</span><b>${i(c)}</b></div>
      <h3>El viaje</h3>
      ${m}
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
        <div><b>${f}/${T.length}</b> pegatinas</div>
        <div><b>${s.totalStars()}/${o.length*3}</b> estrellas</div>
      </div>
      <h3>Reparto</h3>
      <p>Piloto de scooter, capitán de barca, taxista de tuk-tuk, luchador, fugitivo al volante y maquinista: <b>${i(l)}</b></p>
      <p>Copiloto, navegante, relaciones públicas y fotógrafo oficial: <b>${i(c)}</b></p>
      <p>Monos, perros tumbados, turistas despistados y el taxista Zhou de Macao: <b>ellos mismos</b></p>
      <h3>Gracias</h3>
      <p>A Tailandia y a China, por la comida, el calor y la paciencia.</p>
      <p>Al wifi del avión, por no existir.</p>
      <div class="fin-fin">Fin del viaje.<br><small>De momento.</small></div>
      <div class="fin-cierre"></div>
    </div>
    <div class="fin-botones no-ctrl"></div>`);v(200),setTimeout(()=>v(160),2500);const r=async()=>{await e.close(),d&&d()};p(".fin-botones",e).append(b("Saltar ⏭",r,"secundario")),p(".fin-cierre",e).append(b("Volver al mapa ✈",r,"grande"))}export{j as openFinale};
