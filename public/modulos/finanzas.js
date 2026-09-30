/* ============================================================
   FINANZAS · módulo frontend de ANIA
   API pública (window.Finanzas):
     .listar(desde, hasta)              → movimientos
     .registrar('gasto'|'ingreso', monto, categoria, nota)
     .registrarGasto(monto, categoria)  → atajo
     .registrarIngreso(monto, categoria)
     .eliminar(id)
     .resumen(desde, hasta)             → totales + serie
     .resumenTexto()                    → string para voz
     .renderPanel()                     → pinta #panelFinanzas
   ============================================================ */
'use strict';
(function(){
  if (window.Finanzas) return;

  function money(n){
    const v = Number(n) || 0;
    return v.toLocaleString('es-ES', { minimumFractionDigits:2, maximumFractionDigits:2 });
  }

  const Finanzas = {
    _cache: [],

    async listar(desde, hasta){
      const q = new URLSearchParams();
      if (desde) q.set('desde', desde);
      if (hasta) q.set('hasta', hasta);
      const r = await AniaAPI.req('/ania/finanzas/movimientos?' + q.toString());
      this._cache = r.movimientos || [];
      return this._cache;
    },

    async registrar(tipo, monto, categoria, nota){
      const r = await AniaAPI.req('/ania/finanzas/movimiento', {
        method:'POST',
        body: JSON.stringify({ tipo, monto, categoria, nota })
      });
      if (typeof toastAI === 'function')
        toastAI((tipo === 'ingreso' ? '💵 +' : '💸 -') + money(monto) + ' · ' + (categoria||'general'));
      return r.movimiento;
    },

    registrarGasto(monto, categoria, nota){ return this.registrar('gasto', monto, categoria, nota); },
    registrarIngreso(monto, categoria, nota){ return this.registrar('ingreso', monto, categoria, nota); },

    async eliminar(id){
      await AniaAPI.req('/ania/finanzas/movimiento/' + id, { method:'DELETE' });
      if (typeof toast === 'function') toast('Movimiento eliminado');
    },

    async resumen(desde, hasta){
      const ahora = new Date();
      const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).getTime();
      const q = new URLSearchParams();
      q.set('desde', desde || inicioMes);
      q.set('hasta', hasta || Date.now());
      return AniaAPI.req('/ania/finanzas/resumen?' + q.toString());
    },

    async resumenTexto(){
      const r = await this.resumen();
      const cat = Object.entries(r.porCategoria || {})
        .sort((a,b) => b[1]-a[1]).slice(0, 3)
        .map(([k,v]) => `${k}: ${money(v)}`).join(' · ');
      return `Balance del mes: ${money(r.balance)}\n` +
             `💵 Ingresos: ${money(r.ingresos)}\n` +
             `💸 Gastos: ${money(r.gastos)}\n` +
             (cat ? `Top gastos: ${cat}` : 'Sin gastos aún.');
    },

    async renderPanel(){
      const panel = document.getElementById('panelFinanzas');
      if (!panel) return;
      panel.innerHTML = '<div class="empty">Cargando finanzas...</div>';
      try{
        const [resumen, movs] = await Promise.all([this.resumen(), this.listar()]);
        const color = resumen.balance >= 0 ? 'var(--acc2)' : 'var(--danger)';
        const cats = Object.entries(resumen.porCategoria || {})
          .sort((a,b) => b[1]-a[1]).slice(0, 6);

        panel.innerHTML = `
          <div class="bento-grid">
            <div class="bento-tile tile-stat">
              <div class="stat-num">${money(resumen.ingresos)}</div>
              <div class="stat-lbl">Ingresos mes</div>
            </div>
            <div class="bento-tile tile-stat tile-amber">
              <div class="stat-num">${money(resumen.gastos)}</div>
              <div class="stat-lbl">Gastos mes</div>
            </div>
            <div class="bento-tile tile-stat" style="grid-column:span 2;">
              <div class="stat-num" style="color:${color};">${money(resumen.balance)}</div>
              <div class="stat-lbl">Balance</div>
            </div>

            ${cats.length ? `
              <div class="bento-tile tile-full">
                <div class="tile-head">
                  <span class="tile-title">Gastos por categoría</span>
                  <span class="tile-badge">${cats.length}</span>
                </div>
                <div class="tile-body">
                  ${cats.map(([k,v]) => `
                    <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dashed rgba(45,224,138,.12);font-size:12px;">
                      <span>${esc(k)}</span>
                      <span style="color:var(--amber);">${money(v)}</span>
                    </div>
                  `).join('')}
                </div>
              </div>` : ''}

            <div class="bento-tile tile-full">
              <div class="tile-head">
                <span class="tile-title">Últimos movimientos</span>
                <span class="tile-badge">${movs.length}</span>
              </div>
              <div class="tile-body">
                ${movs.length ? movs.slice(0, 25).map(m => `
                  <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dashed rgba(45,224,138,.12);font-size:12px;align-items:center;gap:8px;">
                    <div style="flex:1;min-width:0;">
                      <div>${m.tipo === 'ingreso' ? '💵' : '💸'} ${esc(m.categoria)}</div>
                      <div style="font-size:10px;color:var(--dim);">
                        ${new Date(m.fecha).toLocaleString('es-ES')}
                        ${m.nota ? ' · ' + esc(m.nota) : ''}
                      </div>
                    </div>
                    <div style="color:${m.tipo==='ingreso'?'var(--acc2)':'var(--danger)'};white-space:nowrap;">
                      ${m.tipo === 'ingreso' ? '+' : '−'}${money(m.monto)}
                    </div>
                    <button class="chip" data-fin-del="${m.id}" style="font-size:10px;padding:3px 6px;color:var(--danger);border-color:rgba(255,84,112,.4);">✕</button>
                  </div>
                `).join('') : '<div class="empty">Sin movimientos aún</div>'}
              </div>
            </div>

            <div class="bento-tile tile-full">
              <div class="tile-title" style="margin-bottom:10px;">Registrar movimiento</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <select id="finTipo" style="background:var(--panel);border:1px solid var(--line);color:var(--text);font-family:var(--mono);font-size:13px;padding:8px;border-radius:6px;">
                  <option value="gasto">💸 Gasto</option>
                  <option value="ingreso">💵 Ingreso</option>
                </select>
                <input id="finMonto" type="number" step="0.01" min="0" placeholder="Monto"
                  style="flex:1 1 100px;background:var(--panel);border:1px solid var(--line);color:var(--text);font-family:var(--mono);font-size:13px;padding:8px;border-radius:6px;">
                <input id="finCat" placeholder="Categoría (café, ventas...)"
                  style="flex:1 1 140px;background:var(--panel);border:1px solid var(--line);color:var(--text);font-family:var(--mono);font-size:13px;padding:8px;border-radius:6px;">
                <input id="finNota" placeholder="Nota (opcional)"
                  style="flex:1 1 140px;background:var(--panel);border:1px solid var(--line);color:var(--text);font-family:var(--mono);font-size:13px;padding:8px;border-radius:6px;">
                <button class="chip" id="finAdd" style="border-color:var(--line2);color:var(--acc2);padding:8px 16px;">AÑADIR</button>
              </div>
            </div>
          </div>
        `;

        document.getElementById('finAdd').onclick = async ()=>{
          const tipo = document.getElementById('finTipo').value;
          const monto = parseFloat(document.getElementById('finMonto').value);
          const cat = document.getElementById('finCat').value.trim() || 'general';
          const nota = document.getElementById('finNota').value.trim();
          if (!monto || monto <= 0) return toast('Monto inválido', true);
          try{
            await Finanzas.registrar(tipo, monto, cat, nota);
            document.getElementById('finMonto').value = '';
            document.getElementById('finNota').value = '';
            Finanzas.renderPanel();
          }catch(e){ toast(e.message, true); }
        };

        panel.querySelectorAll('[data-fin-del]').forEach(b => b.onclick = async ()=>{
          if (!confirm('¿Eliminar movimiento?')) return;
          await Finanzas.eliminar(b.dataset.finDel);
          Finanzas.renderPanel();
        });
      }catch(e){
        panel.innerHTML = '<div class="empty" style="color:var(--danger);">✖ ' + e.message + '</div>';
      }
    }
  };

  window.Finanzas = Finanzas;
  console.log('✓ Módulo Finanzas cargado');
})();
