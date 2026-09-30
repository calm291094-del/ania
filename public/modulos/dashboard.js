/* ============================================================
   DASHBOARD · pantalla principal Jarvis de ANIA
   API pública (window.Dashboard):
     .cargar()        → fetch /ania/dashboard + clima + luna
     .render()        → pinta #panelDashboard
     .abrir()         → abre el modal y renderiza
     .proactive()     → chequea alertas (una vez al abrir la app)
     .autoRefresh()   → recarga cada 60s mientras el modal está visible
   ============================================================ */
'use strict';
(function(){
  if (window.Dashboard) return;

  function money(n){
    const v = Number(n) || 0;
    return v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function saludo(){
    const h = new Date().getHours();
    if (h < 6)  return 'Buenas noches';
    if (h < 12) return 'Buenos días';
    if (h < 20) return 'Buenas tardes';
    return 'Buenas noches';
  }

  const Dashboard = {
    _data: null,
    _timer: null,

    async cargar(){
      const uid = (typeof Session !== 'undefined' && Session) ? Session.name || 'operador' : 'operador';
      let core = null, clima = null, luna = null;

      // 1) Dashboard backend
      try{
        core = await AniaAPI.req('/ania/dashboard');
      }catch(e){
        core = { ok:false, error:e.message };
      }

      // 2) Clima (si hay geo en cache)
      try{
        if (typeof geoCache === 'function' && typeof getWeather === 'function'){
          const g = geoCache();
          if (g){
            const w = await getWeather(g);
            clima = {
              ciudad: g.city,
              temp: Math.round(w.current.temperature_2m),
              desc: (typeof WMO !== 'undefined' && WMO[w.current.weather_code]) || 'variable',
              humedad: w.current.relative_humidity_2m
            };
          }
        }
      }catch(e){}

      // 3) Luna (local, sin red)
      try{
        if (typeof moonInfo === 'function') luna = moonInfo();
      }catch(e){}

      // 4) Tareas locales
      let tareas = [];
      try{
        if (typeof tasks !== 'undefined' && Array.isArray(tasks)){
          const hoy = new Date().toDateString();
          tareas = tasks.filter(t => !t.done).map(t => ({
            text: t.text,
            when: t.when,
            hoy: t.when && new Date(t.when).toDateString() === hoy,
            vencida: t.when && t.when < Date.now()
          }));
        }
      }catch(e){}

      this._data = { core, clima, luna, tareas, usuario: uid, t: Date.now() };
      return this._data;
    },

    async render(){
      const panel = document.getElementById('panelDashboard');
      if (!panel) return;
      panel.innerHTML = '<div class="empty">Cargando panel...</div>';
      await this.cargar();
      const { core, clima, luna, tareas } = this._data;

      if (!core || !core.ok){
        panel.innerHTML = `<div class="empty" style="color:var(--danger);">✖ ${core?.error || 'Sin conexión con el backend'}</div>`;
        return;
      }

      const bal = core.balanceMes || { ingresos:0, gastos:0, balance:0 };
      const balanceColor = bal.balance >= 0 ? 'var(--acc2)' : 'var(--danger)';
      const criticos = core.stockCritico || [];
      const listas = core.listas || [];
      const tareasHoy = tareas.filter(t => t.hoy || t.vencida);
      const proximas = tareas.filter(t => !t.hoy && !t.vencida).slice(0, 3);

      panel.innerHTML = `
        <div class="bento-grid">

          <!-- Cabecera -->
          <div class="bento-tile tile-full" style="text-align:center;padding:16px;">
            <div style="font-size:11px;letter-spacing:.3em;color:var(--dim);margin-bottom:6px;">
              ${new Date().toLocaleDateString('es-ES',{weekday:'long', day:'numeric', month:'long', year:'numeric'}).toUpperCase()}
            </div>
            <div style="font-size:clamp(20px, 4vw, 28px);color:var(--acc2);letter-spacing:.15em;margin-bottom:4px;">
              ${saludo()}, ${esc(this._data.usuario || 'operador')}
            </div>
            <div style="font-size:12px;color:var(--dim);">${new Date().toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})} · Núcleo activo</div>
          </div>

          <!-- Balance -->
          <div class="bento-tile tile-wide">
            <div class="tile-head">
              <span class="tile-title">💰 Balance del mes</span>
              <span class="tile-badge">${bal.balance >= 0 ? '▲' : '▼'}</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;">
              <div style="font-size:clamp(24px, 5vw, 34px);color:${balanceColor};letter-spacing:.02em;">${money(bal.balance)}</div>
            </div>
            <div style="display:flex;gap:14px;font-size:12px;">
              <div><span style="color:var(--dim);">Ingresos:</span> <span style="color:var(--acc2);">${money(bal.ingresos)}</span></div>
              <div><span style="color:var(--dim);">Gastos:</span> <span style="color:var(--danger);">${money(bal.gastos)}</span></div>
            </div>
          </div>

          <!-- Stock crítico -->
          <div class="bento-tile tile-wide">
            <div class="tile-head">
              <span class="tile-title">📦 Stock crítico</span>
              <span class="tile-badge" style="color:${criticos.length ? 'var(--amber)' : 'var(--acc)'};">${criticos.length}</span>
            </div>
            <div class="tile-body" style="max-height:14dvh;">
              ${criticos.length ? criticos.map(p => `
                <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px dashed rgba(255,181,71,.15);font-size:12px;">
                  <span>${esc(p.nombre)}</span>
                  <span style="color:var(--amber);">${p.cantidad}/${p.minimo} ${esc(p.unidad)}</span>
                </div>
              `).join('') : '<div style="color:var(--acc);font-size:12px;padding:6px 0;">✓ Todo en orden</div>'}
            </div>
          </div>

          <!-- Tareas hoy -->
          <div class="bento-tile tile-wide">
            <div class="tile-head">
              <span class="tile-title">✅ Tareas hoy</span>
              <span class="tile-badge">${tareasHoy.length}</span>
            </div>
            <div class="tile-body" style="max-height:14dvh;">
              ${tareasHoy.length ? tareasHoy.slice(0, 5).map(t => `
                <div style="padding:5px 0;border-bottom:1px dashed rgba(45,224,138,.12);font-size:12px;">
                  <div style="${t.vencida ? 'color:var(--amber);' : ''}">${esc(t.text)}</div>
                  ${t.when ? `<div style="font-size:10px;color:var(--dim);">${new Date(t.when).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}</div>` : ''}
                </div>
              `).join('') : '<div style="color:var(--dim);font-size:12px;padding:6px 0;">Sin tareas para hoy</div>'}
            </div>
          </div>

          <!-- Listas -->
          <div class="bento-tile tile-wide">
            <div class="tile-head">
              <span class="tile-title">🛒 Listas</span>
              <span class="tile-badge">${listas.length}</span>
            </div>
            <div class="tile-body" style="max-height:14dvh;">
              ${listas.length ? listas.map(l => `
                <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px dashed rgba(45,224,138,.12);font-size:12px;">
                  <span>${esc(l.nombre)}</span>
                  <span style="color:${l.pendientes ? 'var(--acc2)' : 'var(--dim)'};">${l.pendientes}/${l.total}</span>
                </div>
              `).join('') : '<div style="color:var(--dim);font-size:12px;padding:6px 0;">Sin listas activas</div>'}
            </div>
          </div>

          <!-- Clima -->
          <div class="bento-tile tile-wide">
            <div class="tile-head">
              <span class="tile-title">🌤️ Clima</span>
              <span class="tile-badge">${clima ? esc(clima.ciudad) : 'sin ubicación'}</span>
            </div>
            ${clima ? `
              <div style="font-size:clamp(24px, 5vw, 34px);color:var(--acc2);">${clima.temp}°C</div>
              <div style="font-size:12px;color:var(--dim);margin-top:4px;">${esc(clima.desc)} · ${clima.humedad}% humedad</div>
            ` : '<div style="color:var(--dim);font-size:12px;">Sin datos. Di «clima» para activar.</div>'}
          </div>

          <!-- Luna -->
          <div class="bento-tile tile-wide">
            <div class="tile-head">
              <span class="tile-title">🌙 Luna</span>
              <span class="tile-badge">${luna ? luna.illum + '%' : '—'}</span>
            </div>
            ${luna ? `
              <div style="font-size:clamp(20px, 4vw, 26px);color:var(--acc2);text-transform:capitalize;">${esc(luna.phase)}</div>
              <div style="font-size:12px;color:var(--dim);margin-top:4px;">${luna.illum}% iluminada · ${luna.age} días</div>
            ` : ''}
          </div>

          <!-- Próximas tareas -->
          ${proximas.length ? `
            <div class="bento-tile tile-full">
              <div class="tile-head">
                <span class="tile-title">📅 Próximas tareas</span>
                <span class="tile-badge">${proximas.length}</span>
              </div>
              <div>
                ${proximas.map(t => `
                  <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dashed rgba(45,224,138,.1);font-size:12px;">
                    <span>${esc(t.text)}</span>
                    <span style="color:var(--dim);">${t.when ? new Date(t.when).toLocaleDateString('es-ES',{day:'numeric',month:'short'}) : 'sin fecha'}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Acciones rápidas -->
          <div class="bento-tile tile-full">
            <div class="tile-head">
              <span class="tile-title">⚡ Acciones rápidas</span>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button class="chip" data-dash-go="finanzas" style="border-color:var(--line2);color:var(--acc2);">💰 Finanzas</button>
              <button class="chip" data-dash-go="inventario">📦 Inventario</button>
              <button class="chip" data-dash-go="compras">🛒 Compras</button>
              <button class="chip" data-dash-say="prepara mi día">📋 Informe del día</button>
              <button class="chip" data-dash-say="stock crítico">⚠ Ver stock crítico</button>
              <button class="chip" data-dash-refresh>🔄 Actualizar</button>
            </div>
          </div>

        </div>
      `;

      // Handlers
      panel.querySelectorAll('[data-dash-go]').forEach(b => b.onclick = ()=>{
        const t = b.dataset.dashGo;
        if (typeof switchJarvisTab === 'function'){
          document.getElementById('dashboardModal').classList.remove('on');
          openModal('jarvisModal');
          switchJarvisTab(t);
        }
      });
      panel.querySelectorAll('[data-dash-say]').forEach(b => b.onclick = ()=>{
        document.getElementById('dashboardModal').classList.remove('on');
        if (typeof send === 'function') send(b.dataset.dashSay);
      });
      panel.querySelector('[data-dash-refresh]')?.addEventListener('click', ()=> this.render());
    },

    async abrir(){
      if (typeof openModal === 'function') openModal('dashboardModal');
      await this.render();
      this.autoRefresh();
    },

    autoRefresh(){
      clearInterval(this._timer);
      this._timer = setInterval(()=>{
        const m = document.getElementById('dashboardModal');
        if (!m || !m.classList.contains('on')){
          clearInterval(this._timer);
          return;
        }
        this.render().catch(()=>{});
      }, 60000);
    },

    /* Chequeo proactivo al arrancar la app */
    async proactive(){
      try{
        await this.cargar();
        const criticos = this._data?.core?.stockCritico || [];
        if (criticos.length && typeof personaReply === 'function'){
          // Una vez por sesión
          if (!sessionStorage.getItem('ania_stock_warned')){
            sessionStorage.setItem('ania_stock_warned', '1');
            const lista = criticos.slice(0, 3).map(p => `· ${p.nombre} (${p.cantidad}/${p.minimo})`).join('\n');
            setTimeout(()=>{
              personaReply(`⚠ Atención: tienes ${criticos.length} producto(s) bajo stock:\n${lista}\n\nDi «stock crítico» o abre el panel.`);
            }, 4000);
          }
        }
      }catch(e){ /* silencioso */ }
    }
  };

  window.Dashboard = Dashboard;
  console.log('✓ Módulo Dashboard cargado');
})();
