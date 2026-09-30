/* ============================================================
   COMPRAS · módulo frontend de ANIA
   API pública (window.Compras):
     .listar()                          → todas las listas
     .crear(nombre)
     .eliminar(listaId)
     .agregar(listaId, texto, cant, unidad, categoria)
     .agregarRapido(texto, cant)        → busca/crea lista "General"
     .marcar(listaId, itemId, comprado)
     .eliminarItem(listaId, itemId)
     .pendientes()                      → array plano de items sin comprar
     .resumenTexto()                    → string para voz
     .renderPanel()                     → pinta #panelCompras
   ============================================================ */
'use strict';
(function(){
  if (window.Compras) return;

  function num(n){
    const v = Number(n) || 0;
    return v % 1 === 0 ? String(v) : v.toFixed(2);
  }

  const Compras = {
    _cache: [],

    async listar(){
      const r = await AniaAPI.req('/ania/compras/listas');
      this._cache = r.listas || [];
      return this._cache;
    },

    async crear(nombre){
      const r = await AniaAPI.req('/ania/compras/lista', {
        method:'POST', body: JSON.stringify({ nombre })
      });
      if (typeof toast === 'function') toast('Lista creada: ' + nombre);
      return r.lista;
    },

    async eliminar(listaId){
      await AniaAPI.req('/ania/compras/lista/' + listaId, { method:'DELETE' });
      if (typeof toast === 'function') toast('Lista eliminada');
    },

    async agregar(listaId, texto, cantidad, unidad, categoria){
      const r = await AniaAPI.req('/ania/compras/lista/' + listaId + '/item', {
        method:'POST',
        body: JSON.stringify({ texto, cantidad, unidad, categoria })
      });
      if (typeof toast === 'function') toast('+ ' + texto);
      return r.item;
    },

    async agregarRapido(texto, cantidad, unidad){
      // Busca la lista "General" o la crea
      await this.listar();
      let general = this._cache.find(l => l.nombre.toLowerCase() === 'general');
      if (!general) general = await this.crear('General');
      return this.agregar(general.id, texto, cantidad || 1, unidad || 'u', 'general');
    },

    async marcar(listaId, itemId, comprado){
      const r = await AniaAPI.req('/ania/compras/lista/' + listaId + '/item/' + itemId, {
        method:'PUT', body: JSON.stringify({ comprado: !!comprado })
      });
      if (comprado && typeof toast === 'function') toast('✓ ' + r.item.texto);
      return r.item;
    },

    async eliminarItem(listaId, itemId){
      await AniaAPI.req('/ania/compras/lista/' + listaId + '/item/' + itemId, {
        method:'DELETE'
      });
    },

    async pendientes(){
      await this.listar();
      const out = [];
      for(const l of this._cache){
        (l.items || []).filter(i => !i.comprado).forEach(i => {
          out.push({ lista: l.nombre, listaId: l.id, ...i });
        });
      }
      return out;
    },

    async resumenTexto(){
      await this.listar();
      if (!this._cache.length) return 'Sin listas de compras.';
      const partes = this._cache.map(l => {
        const pend = (l.items || []).filter(i => !i.comprado).length;
        return `${l.nombre}: ${pend} pendiente${pend !== 1 ? 's' : ''}`;
      });
      return 'Listas de compras:\n' + partes.join('\n');
    },

    async renderPanel(){
      const panel = document.getElementById('panelCompras');
      if (!panel) return;
      panel.innerHTML = '<div class="empty">Cargando listas...</div>';
      try{
        const listas = await this.listar();

        panel.innerHTML = `
          <div class="bento-grid">
            <div class="bento-tile tile-stat">
              <div class="stat-num">${listas.length}</div>
              <div class="stat-lbl">Listas</div>
            </div>
            <div class="bento-tile tile-stat tile-amber">
              <div class="stat-num">${listas.reduce((a,l) => a + (l.items||[]).filter(i=>!i.comprado).length, 0)}</div>
              <div class="stat-lbl">Pendientes</div>
            </div>
            <div class="bento-tile tile-stat tile-full" style="grid-column:span 2;">
              <div class="stat-num">${listas.reduce((a,l) => a + (l.items||[]).filter(i=>i.comprado).length, 0)}</div>
              <div class="stat-lbl">Comprados</div>
            </div>

            <div class="bento-tile tile-full">
              <div class="tile-head">
                <span class="tile-title">Nueva lista</span>
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <input id="comNewName" placeholder="Nombre (Mercado, Farmacia...)"
                  style="flex:1 1 160px;background:var(--panel);border:1px solid var(--line);color:var(--text);font-family:var(--mono);font-size:13px;padding:8px;border-radius:6px;">
                <button class="chip" id="comNewBtn" style="border-color:var(--line2);color:var(--acc2);padding:8px 16px;">CREAR</button>
              </div>
            </div>

            ${listas.length ? listas.map(l => this._renderLista(l)).join('') : `
              <div class="bento-tile tile-full">
                <div class="empty">Sin listas. Crea una arriba o di «añade leche a la compra».</div>
              </div>`}
          </div>
        `;

        document.getElementById('comNewBtn').onclick = async ()=>{
          const v = document.getElementById('comNewName').value.trim();
          if (!v) return;
          await this.crear(v);
          this.renderPanel();
        };

        this._bindEventos();
      }catch(e){
        panel.innerHTML = '<div class="empty" style="color:var(--danger);">✖ ' + e.message + '</div>';
      }
    },

    _renderLista(l){
      const pend = (l.items||[]).filter(i => !i.comprado);
      const comp = (l.items||[]).filter(i => i.comprado);
      return `
        <div class="bento-tile tile-full">
          <div class="tile-head">
            <span class="tile-title">${esc(l.nombre)}</span>
            <span class="tile-badge">${pend.length}/${(l.items||[]).length}</span>
            <button class="chip" data-com-del="${l.id}" style="font-size:10px;padding:3px 8px;color:var(--danger);border-color:rgba(255,84,112,.4);">✕</button>
          </div>
          <div style="display:flex;gap:6px;margin-bottom:10px;">
            <input data-com-input="${l.id}" placeholder="Añadir item..."
              style="flex:1;background:var(--panel);border:1px solid var(--line);color:var(--text);font-family:var(--mono);font-size:12px;padding:7px 9px;border-radius:5px;">
            <input data-com-cant="${l.id}" type="number" step="0.1" min="0" value="1"
              style="width:60px;background:var(--panel);border:1px solid var(--line);color:var(--text);font-family:var(--mono);font-size:12px;padding:7px 6px;border-radius:5px;">
            <button class="chip" data-com-add="${l.id}" style="font-size:11px;padding:7px 12px;">+</button>
          </div>
          <div>
            ${(l.items||[]).length ? (l.items||[]).map(it => `
              <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px dashed rgba(45,224,138,.1);font-size:13px;">
                <button class="tsmall" data-com-tog="${l.id}|${it.id}" style="width:24px;height:24px;color:${it.comprado?'var(--acc)':'var(--dim)'};">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;">
                    ${it.comprado ? '<path d="M5 12l5 5L20 7"/>' : '<rect x="4" y="4" width="16" height="16" rx="3"/>'}
                  </svg>
                </button>
                <span style="flex:1;${it.comprado?'color:#42604f;text-decoration:line-through;':''}">${esc(it.texto)}</span>
                <span style="font-size:10px;color:var(--dim);">${num(it.cantidad)}${esc(it.unidad||'')}</span>
                <button class="tsmall" data-com-rm="${l.id}|${it.id}" style="width:24px;height:24px;color:#5a3040;">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;"><path d="M6 6l12 12M18 6 6 18"/></svg>
                </button>
              </div>
            `).join('') : '<div class="empty" style="padding:14px 0;">Vacía</div>'}
          </div>
        </div>
      `;
    },

    _bindEventos(){
      document.querySelectorAll('[data-com-del]').forEach(b => b.onclick = async ()=>{
        if (!confirm('¿Eliminar lista completa?')) return;
        await this.eliminar(b.dataset.comDel);
        this.renderPanel();
      });

      document.querySelectorAll('[data-com-add]').forEach(b => b.onclick = async ()=>{
        const id = b.dataset.comAdd;
        const inp = document.querySelector(`[data-com-input="${id}"]`);
        const cant = parseFloat(document.querySelector(`[data-com-cant="${id}"]`).value) || 1;
        const txt = inp.value.trim();
        if (!txt) return;
        try{
          await this.agregar(id, txt, cant, 'u', 'general');
          inp.value = '';
          this.renderPanel();
        }catch(e){ toast(e.message, true); }
      });

      // Enter en el input = añadir
      document.querySelectorAll('[data-com-input]').forEach(inp => {
        inp.onkeydown = e => {
          if (e.key === 'Enter'){
            e.preventDefault();
            const id = inp.dataset.comInput;
            document.querySelector(`[data-com-add="${id}"]`).click();
          }
        };
      });

      document.querySelectorAll('[data-com-tog]').forEach(b => b.onclick = async ()=>{
        const [lid, iid] = b.dataset.comTog.split('|');
        // Encontrar el item actual
        const lista = this._cache.find(l => l.id === lid);
        const item = (lista?.items || []).find(i => i.id === iid);
        if (!item) return;
        await this.marcar(lid, iid, !item.comprado);
        this.renderPanel();
      });

      document.querySelectorAll('[data-com-rm]').forEach(b => b.onclick = async ()=>{
        const [lid, iid] = b.dataset.comRm.split('|');
        await this.eliminarItem(lid, iid);
        this.renderPanel();
      });
    }
  };

  window.Compras = Compras;
  console.log('✓ Módulo Compras cargado');
})();
