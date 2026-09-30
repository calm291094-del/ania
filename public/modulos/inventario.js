/* ============================================================
   INVENTARIO · módulo frontend de ANIA
   API pública (window.Inventario):
     .listar(q)
     .crear({nombre, cantidad, precio, costo, minimo, unidad, categoria})
     .actualizar(id, cambios)
     .eliminar(id)
     .mover(productoId, 'entrada'|'salida'|'ajuste', cantidad, nota)
     .bajoStock()                       → productos críticos
     .resumen()                         → totales
     .resumenTexto()                    → string para voz
     .renderPanel()                     → pinta #panelInventario
   ============================================================ */
'use strict';
(function(){
  if (window.Inventario) return;

  function num(n){
    const v = Number(n) || 0;
    return v.toLocaleString('es-ES', { maximumFractionDigits:3 });
  }

  const Inventario = {
    _cache: [],

    async listar(q){
      const r = await AniaAPI.req('/ania/inventario/productos' + (q ? '?q=' + encodeURIComponent(q) : ''));
      this._cache = r.productos || [];
      return this._cache;
    },

    async crear(datos){
      const r = await AniaAPI.req('/ania/inventario/producto', {
        method:'POST', body: JSON.stringify(datos)
      });
      if (typeof toast === 'function') toast('Producto creado: ' + r.producto.nombre);
      return r.producto;
    },

    async actualizar(id, cambios){
      const r = await AniaAPI.req('/ania/inventario/producto/' + id, {
        method:'PUT', body: JSON.stringify(cambios)
      });
      return r.producto;
    },

    async eliminar(id){
      await AniaAPI.req('/ania/inventario/producto/' + id, { method:'DELETE' });
      if (typeof toast === 'function') toast('Producto eliminado');
    },

    async mover(productoId, tipo, cantidad, nota, precio){
      const r = await AniaAPI.req('/ania/inventario/movimiento', {
        method:'POST', body: JSON.stringify({ productoId, tipo, cantidad, nota, precio })
      });
      const p = r.producto;
      if (typeof toast === 'function')
        toast((tipo === 'entrada' ? '➕ ' : tipo === 'salida' ? '➖ ' : '✏️ ') +
              p.nombre + ' → ' + num(p.cantidad) + ' ' + (p.unidad || 'u'));
      return p;
    },

    async bajoStock(){
      const r = await AniaAPI.req('/ania/inventario/bajo-stock');
      return r.productos || [];
    },

    async resumen(){ return AniaAPI.req('/ania/inventario/resumen'); },

    async resumenTexto(){
      const r = await this.resumen();
      if (!r.totalProductos) return 'Sin productos en el inventario.';
      return `Inventario: ${r.totalProductos} productos (${num(r.unidades)} unidades)\n` +
             `⚠ ${r.criticos} bajo stock\n` +
             `Valor venta: ${num(r.valorVenta)} · margen potencial ${num(r.margenPotencial)} (${r.margenPct}%)`;
    },

    async renderPanel(){
      const panel = document.getElementById('panelInventario');
      if (!panel) return;
      panel.innerHTML = '<div class="empty">Cargando inventario...</div>';
      try{
        const [productos, resumen] = await Promise.all([this.listar(), this.resumen()]);
        const criticos = productos.filter(p => (p.minimo||0) > 0 && (p.cantidad||0) <= (p.minimo||0));

        panel.innerHTML = `
          <div class="bento-grid">
            <div class="bento-tile tile-stat">
              <div class="stat-num">${resumen.totalProductos}</div>
              <div class="stat-lbl">Productos</div>
            </div>
            <div class="bento-tile tile-stat tile-amber">
              <div class="stat-num">${resumen.criticos}</div>
              <div class="stat-lbl">Bajo stock</div>
            </div>
            <div class="bento-tile tile-stat">
              <div class="stat-num">${num(resumen.valorCosto)}</div>
              <div class="stat-lbl">Valor costo</div>
            </div>
            <div class="bento-tile tile-stat">
              <div class="stat-num">${num(resumen.valorVenta)}</div>
              <div class="stat-lbl">Valor venta</div>
            </div>

            ${criticos.length ? `
              <div class="bento-tile tile-full" style="border-color:rgba(255,181,71,.4);">
                <div class="tile-head">
                  <span class="tile-title" style="color:var(--amber);">⚠ Reabastecer urgente</span>
                  <span class="tile-badge">${criticos.length}</span>
                </div>
                <div class="tile-body">
                  ${criticos.map(p => `
                    <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dashed rgba(255,181,71,.2);font-size:12px;">
                      <span>${esc(p.nombre)}</span>
                      <span style="color:var(--amber);">${num(p.cantidad)} / ${num(p.minimo)} ${esc(p.unidad)}</span>
                    </div>
                  `).join('')}
                </div>
              </div>` : ''}

            <div class="bento-tile tile-full">
              <div class="tile-head">
                <span class="tile-title">Productos</span>
                <button class="chip" id="invNuevo" style="font-size:11px;">+ NUEVO</button>
              </div>
              <div class="tile-body" id="invListaProductos">
                ${productos.length ? productos.map(p => this._filaProducto(p)).join('') :
                  '<div class="empty">Sin productos. Pulsa + NUEVO.</div>'}
              </div>
            </div>
          </div>
        `;

        document.getElementById('invNuevo').onclick = ()=> this._pedirNuevo();
        this._bindFilas();
      }catch(e){
        panel.innerHTML = '<div class="empty" style="color:var(--danger);">✖ ' + e.message + '</div>';
      }
    },

    _filaProducto(p){
      const bajo = (p.minimo||0) > 0 && (p.cantidad||0) <= (p.minimo||0);
      const color = bajo ? 'var(--amber)' : 'var(--acc)';
      return `
        <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px dashed rgba(45,224,138,.12);font-size:12px;align-items:center;gap:6px;">
          <div style="flex:1;min-width:0;">
            <div style="color:${color};">${esc(p.nombre)}</div>
            <div style="font-size:10px;color:var(--dim);">
              ${num(p.cantidad)} ${esc(p.unidad)} · min ${num(p.minimo)} · $${num(p.precio)}
            </div>
          </div>
          <button class="chip" data-inv-in="${p.id}" style="font-size:11px;padding:4px 8px;">+</button>
          <button class="chip" data-inv-out="${p.id}" style="font-size:11px;padding:4px 8px;">−</button>
          <button class="chip" data-inv-del="${p.id}" style="font-size:11px;padding:4px 8px;color:var(--danger);border-color:rgba(255,84,112,.4);">✕</button>
        </div>
      `;
    },

    _bindFilas(){
      document.querySelectorAll('[data-inv-in]').forEach(b => b.onclick = async ()=>{
        const c = prompt('Cantidad a ingresar:', '1');
        if (!c) return;
        try{
          await this.mover(b.dataset.invIn, 'entrada', parseFloat(c));
          this.renderPanel();
        }catch(e){ toast(e.message, true); }
      });
      document.querySelectorAll('[data-inv-out]').forEach(b => b.onclick = async ()=>{
        const c = prompt('Cantidad a vender/retirar:', '1');
        if (!c) return;
        const vender = confirm('¿Registrar también como ingreso en finanzas?');
        try{
          await this.mover(b.dataset.invOut, 'salida', parseFloat(c), '', vender);
          this.renderPanel();
        }catch(e){ toast(e.message, true); }
      });
      document.querySelectorAll('[data-inv-del]').forEach(b => b.onclick = async ()=>{
        if (!confirm('¿Eliminar producto?')) return;
        await this.eliminar(b.dataset.invDel);
        this.renderPanel();
      });
    },

    async _pedirNuevo(){
      const nombre = prompt('Nombre del producto:');
      if (!nombre) return;
      const cantidad = parseFloat(prompt('Cantidad inicial:', '0') || '0');
      const minimo   = parseFloat(prompt('Stock mínimo (para alerta):', '0') || '0');
      const precio   = parseFloat(prompt('Precio de venta:', '0') || '0');
      const costo    = parseFloat(prompt('Costo:', '0') || '0');
      const unidad   = prompt('Unidad (u, kg, L...):', 'u') || 'u';
      const categoria = prompt('Categoría:', 'general') || 'general';
      try{
        await this.crear({ nombre, cantidad, minimo, precio, costo, unidad, categoria });
        this.renderPanel();
      }catch(e){ toast(e.message, true); }
    }
  };

  window.Inventario = Inventario;
  console.log('✓ Módulo Inventario cargado');
})();
