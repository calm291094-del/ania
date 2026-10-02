/* ============================================================
   16-AUTONOMO · Núcleo autónomo de ANIA
   v2 · + historial de ejecuciones, toggles por regla, panel UI
============================================================ */
'use strict';

const Autonomo = {
  activo: true,
  ciclo: null,
  INTERVALO_MS: 60 * 1000,
  ultimoCiclo: 0,

  /* ---------------- Cola de tareas ---------------- */
  cola: [],
  MAX_COLA: 30,

  encolar(tarea){
    if (this.cola.length >= this.MAX_COLA) this.cola.shift();
    this.cola.push({ ...tarea, t: Date.now() });
    this._persistirCola();
  },
  sacarTarea(){
    const t = this.cola.shift();
    this._persistirCola();
    return t;
  },
  _persistirCola(){
    try { store.set('autonomo_cola', this.cola.slice(-30)); }catch(e){}
  },
  cargarCola(){
    try { this.cola = store.get('autonomo_cola', []); }catch(e){ this.cola = []; }
  },

  /* ---------------- Estado de reglas ---------------- */
  estados: {},
  _cargarEstados(){
    try { this.estados = store.get('autonomo_estados', {}); }catch(e){ this.estados = {}; }
  },
  _guardarEstado(id, t){
    this.estados[id] = t;
    try { store.set('autonomo_estados', this.estados); }catch(e){}
  },

  /* ⭐ NUEVO · Toggles de reglas (activas/desactivadas por usuario) */
  reglasDesactivadas: [],
  _cargarToggles(){
    try { this.reglasDesactivadas = store.get('autonomo_reglas_off', []); }catch(e){ this.reglasDesactivadas = []; }
  },
  _guardarToggles(){
    try { store.set('autonomo_reglas_off', this.reglasDesactivadas); }catch(e){}
  },
  toggleRegla(id){
    const idx = this.reglasDesactivadas.indexOf(id);
    if (idx >= 0) this.reglasDesactivadas.splice(idx, 1);
    else this.reglasDesactivadas.push(id);
    this._guardarToggles();
    this.renderPanel();
    return this.reglasDesactivadas.indexOf(id) === -1; // true = activa
  },
  reglaActiva(id){
    return !this.reglasDesactivadas.includes(id);
  },

  /* ⭐ NUEVO · Historial de ejecuciones (últimas 30) */
  historial: [],
  MAX_HISTORIAL: 30,
  _cargarHistorial(){
    try { this.historial = store.get('autonomo_historial', []); }catch(e){ this.historial = []; }
  },
  _registrarEjecucion(regla, resultado){
    this.historial.unshift({
      id: regla.id,
      desc: regla.descripcion || regla.id,
      tipo: regla.accion.tipo,
      t: Date.now(),
      ok: resultado !== false
    });
    if (this.historial.length > this.MAX_HISTORIAL) this.historial.length = this.MAX_HISTORIAL;
    try { store.set('autonomo_historial', this.historial); }catch(e){}
  },

  /* ---------------- SENSORES ---------------- */
  sensor: {
    leer(){
      const ahora = new Date();
      return {
        hora: ahora,
        horaNum: ahora.getHours(),
        minuto: ahora.getMinutes(),
        diaSemana: ahora.getDay(),
        fecha: ahora.toDateString(),
        online: navigator.onLine,
        visible: !document.hidden,
        usuario: (typeof Mind !== 'undefined' && Mind.nombre()) || null,
        colaOffline: (typeof OfflineQueue !== 'undefined' && OfflineQueue.count()) || 0,
        tareasPendientes: (typeof tasks !== 'undefined' && Array.isArray(tasks))
          ? tasks.filter(t => !t.done).length : 0,
        tareasVencidas: (typeof tasks !== 'undefined' && Array.isArray(tasks))
          ? tasks.filter(t => !t.done && t.when && t.when < Date.now()).length : 0,
        bateria: (typeof S !== 'undefined' && S.batt) ? S.batt : null,
        sesionActiva: (typeof Session !== 'undefined' && !!Session),
        cerebroListo: (typeof Brain !== 'undefined' && Brain.localReady)
      };
    }
  },

  /* ---------------- REGLAS ---------------- */
  reglas: [
    {
      id: 'buenos-dias',
      descripcion: 'Saluda al usuario entre 7:00 y 9:00',
      cuando: (s) => s.horaNum >= 7 && s.horaNum < 9 && s.visible && s.sesionActiva,
      accion: {
        tipo: 'notificar',
        titulo: 'ANIA · Buenos días',
        cuerpo: () => {
          const nombre = Mind.nombre() ? ', ' + Mind.nombre() : '';
          const tareas = (typeof tasks !== 'undefined')
            ? tasks.filter(t => !t.done).length : 0;
          return `Buenos días${nombre}. ${tareas > 0 ? 'Tienes ' + tareas + ' pendientes.' : 'Agenda libre.'}`;
        }
      },
      minIntervalo: 12 * 60 * 60 * 1000
    },
    {
      id: 'sync-al-reconectar',
      descripcion: 'Sincronizar cola offline al volver online',
      cuando: (s) => s.online && s.colaOffline > 0,
      accion: { tipo: 'sincronizar' },
      minIntervalo: 2 * 60 * 1000
    },
    {
      id: 'tareas-vencidas',
      descripcion: 'Recordar tareas vencidas (cada 4h)',
      cuando: (s) => s.tareasVencidas > 0 && s.visible && s.horaNum >= 9 && s.horaNum < 22,
      accion: {
        tipo: 'notificar',
        titulo: 'ANIA · Tareas vencidas',
        cuerpo: (s) => `Tienes ${s.tareasVencidas} tarea(s) vencida(s). Di «mis tareas» para verlas.`
      },
      minIntervalo: 4 * 60 * 60 * 1000
    },
    {
      id: 'cafe-manana',
      descripcion: 'Preguntar por el café a las 10 AM',
      cuando: (s) => s.horaNum === 10 && s.diaSemana !== 0 && s.visible && s.sesionActiva,
      accion: {
        tipo: 'mensaje',
        texto: () => pick([
          '¿Ya tomaste café? Es la hora perfecta para el primero bueno.',
          'Diez de la mañana: pausa de café, orden ejecutiva.',
          'Mi termómetro interno dice que toca un café.'
        ])
      },
      minIntervalo: 20 * 60 * 60 * 1000
    },
    {
      id: 'cierre-dia',
      descripcion: 'Resumen suave antes de dormir (22:30-23:59)',
      cuando: (s) => (s.horaNum === 22 && s.minuto >= 30) || s.horaNum === 23,
      accion: {
        tipo: 'notificar',
        titulo: 'ANIA · Cierre del día',
        cuerpo: (s) => {
          const pend = s.tareasPendientes;
          return pend > 0
            ? `Quedan ${pend} pendientes para mañana. Descansa bien.`
            : 'Día cerrado. Mañana seguimos.';
        }
      },
      minIntervalo: 20 * 60 * 60 * 1000
    },
    {
      id: 'saludo-autonomo',
      descripcion: 'Rompe el silencio tras 3h sin hablar',
      cuando: (s) => {
        if (!s.visible || !s.sesionActiva) return false;
        const ultimo = (typeof S !== 'undefined' && S.lastUserTs) || 0;
        return ultimo > 0 && (Date.now() - ultimo) > 3 * 3600 * 1000;
      },
      accion: {
        tipo: 'mensaje',
        texto: () => pick([
          'Silencio prolongado... ¿todo bien por ahí?',
          'Hace rato que no hablamos. Aquí sigo, por si acaso.',
          '¿Pausa larga o te perdí de vista?'
        ])
      },
      minIntervalo: 6 * 3600 * 1000
    }
  ],

  /* ---------------- EFECTORES ---------------- */
  efector: {
    async ejecutar(accion, sensores){
      if (!accion || !accion.tipo) return false;
      try{
        switch (accion.tipo){
          case 'notificar':   return await this._notificar(accion, sensores);
          case 'mensaje':     return await this._mensaje(accion, sensores);
          case 'sincronizar': return await this._sincronizar();
          case 'ejecutarTool':return await this._ejecutarTool(accion);
          case 'sonido':      return this._sonido(accion);
          default:
            console.warn('[Autónomo] Acción desconocida:', accion.tipo);
            return false;
        }
      }catch(e){
        console.error('[Autónomo] Error en efector:', accion.tipo, e.message);
        return false;
      }
    },

    async _notificar(accion, sensores){
      const cuerpo = typeof accion.cuerpo === 'function' ? accion.cuerpo(sensores) : (accion.cuerpo || '');
      if (typeof notify === 'function'){
        notify(accion.titulo || 'ANIA', cuerpo, { tag: accion.tag || 'autonomo', important: false });
      }
      if (typeof addChat === 'function'){
        addChat('sys', '🌙 ' + (accion.titulo || 'ANIA') + ' · ' + cuerpo);
      }
      console.log('[Autónomo] 📬 Notificado:', cuerpo);
      return true;
    },

    async _mensaje(accion, sensores){
      const texto = typeof accion.texto === 'function' ? accion.texto(sensores) : (accion.texto || '');
      if (!texto) return false;
      if (typeof personaReply === 'function'){
        personaReply(texto);
      }
      console.log('[Autónomo] 💬 Mensaje:', texto);
      return true;
    },

    async _sincronizar(){
      if (typeof Sync !== 'undefined' && Sync.fullSync) await Sync.fullSync();
      if (typeof procesarColaOffline === 'function') await procesarColaOffline();
      console.log('[Autónomo] 🔄 Sincronización ejecutada');
      return true;
    },

    async _ejecutarTool(accion){
      if (typeof Brain === 'undefined' || !Brain.runTool) return false;
      const res = await Brain.runTool({ n: accion.tool, args: accion.args || {} });
      console.log('[Autónomo] 🛠 Tool', accion.tool, '→', res);
      return true;
    },

    _sonido(accion){
      if (typeof beep === 'function'){
        beep(accion.freq || 880, accion.dur || 0.2, 0);
      }
      return true;
    }
  },

  /* ---------------- PLANIFICADOR ---------------- */
  planificador: {
    decidir(sensores, reglas, estados, desactivadas){
      const ahora = Date.now();
      const aEjecutar = [];
      for (const regla of reglas){
        try{
          if (desactivadas && desactivadas.includes(regla.id)) continue;
          const ultimo = estados[regla.id] || 0;
          if (regla.minIntervalo && ahora - ultimo < regla.minIntervalo) continue;
          if (!regla.cuando(sensores)) continue;
          aEjecutar.push(regla);
        }catch(e){
          console.warn('[Autónomo] Regla', regla.id, 'falló:', e.message);
        }
      }
      return aEjecutar;
    }
  },

  /* ---------------- CICLO PRINCIPAL ---------------- */
  async tick(razon = 'timer'){
    if (!this.activo) return;
    const ahora = Date.now();
    if (ahora - this.ultimoCiclo < 30 * 1000 && razon === 'timer') return;
    this.ultimoCiclo = ahora;

    try{
      const sensores = this.sensor.leer();

      // Cola pendiente
      while (this.cola.length > 0){
        const t = this.sacarTarea();
        if (t) await this.efector.ejecutar(t.accion, sensores);
      }

      // Reglas
      const reglasADisparar = this.planificador.decidir(
        sensores, this.reglas, this.estados, this.reglasDesactivadas
      );

      for (const regla of reglasADisparar){
        const ok = await this.efector.ejecutar(regla.accion, sensores);
        this._guardarEstado(regla.id, Date.now());
        this._registrarEjecucion(regla, ok);
        console.log('[Autónomo] ✅ Regla disparada:', regla.id);
        if (typeof this.renderPanel === 'function') this.renderPanel();
      }
    }catch(e){
      console.error('[Autónomo] Error en tick:', e.message);
    }
  },

  /* ---------------- INICIALIZACIÓN ---------------- */
  async init(){
    this.cargarCola();
    this._cargarEstados();
    this._cargarToggles();
    this._cargarHistorial();
    this.activo = store.get('autonomo_activo', true);
    console.log('🌙 Autónomo iniciado · reglas:', this.reglas.length, '· activo:', this.activo);

    setTimeout(() => this.tick('boot'), 15000);

    if (this.ciclo) clearInterval(this.ciclo);
    this.ciclo = setInterval(() => this.tick('timer'), this.INTERVALO_MS);

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.tick('visibilidad');
    });

    window.addEventListener('online', () => this.tick('online'));
  },

  desactivar(){
    this.activo = false;
    store.set('autonomo_activo', false);
    if (this.ciclo) clearInterval(this.ciclo);
    console.log('[Autónomo] ⏸ Desactivado');
    if (typeof this.renderPanel === 'function') this.renderPanel();
  },

  reactivar(){
    this.activo = true;
    store.set('autonomo_activo', true);
    this.init();
    console.log('[Autónomo] ▶️ Reactivado');
    if (typeof this.renderPanel === 'function') this.renderPanel();
  },

  trigger(tipo){
    console.log('[Autónomo] 🌙 SW trigger:', tipo);
    if (tipo === 'autonomo') return this.tick('sw-periodic');
    if (tipo === 'sync-cola') return this.tick('sw-sync-cola');
    if (tipo === 'sync-tareas') return this.tick('sw-sync-tareas');
    return this.tick('sw-' + tipo);
  },

  agregarRegla(regla){
    if (!regla || !regla.id || !regla.cuando || !regla.accion) return false;
    this.reglas = this.reglas.filter(r => r.id !== regla.id);
    this.reglas.push(regla);
    console.log('[Autónomo] ➕ Regla añadida:', regla.id);
    return true;
  },

  quitarRegla(id){
    const n = this.reglas.length;
    this.reglas = this.reglas.filter(r => r.id !== id);
    return this.reglas.length < n;
  },

  info(){
    return {
      activo: this.activo,
      reglas: this.reglas.length,
      reglasActivas: this.reglas.filter(r => this.reglaActiva(r.id)).length,
      cola: this.cola.length,
      ultimoCiclo: this.ultimoCiclo ? new Date(this.ultimoCiclo).toLocaleString('es-ES') : 'nunca',
      ejecuciones: this.historial.length
    };
  },

  async forzarTick(){
    console.log('[Autónomo] Forzando tick manual...');
    this.ultimoCiclo = 0;
    await this.tick('manual');
  },

  /* ============================================================
     ⭐ NUEVO · Panel de control (UI)
     Pinta el estado del núcleo en #panelAutonomo (dentro de Ajustes)
  ============================================================ */
  renderPanel(){
    const cont = document.getElementById('panelAutonomo');
    if (!cont) return;

    const info = this.info();
    const ahora = Date.now();

    // Reglas con estado
    const reglasHTML = this.reglas.map(r => {
      const activa = this.reglaActiva(r.id);
      const ult = this.estados[r.id];
      const hace = ult ? this._tiempoRel(ahora - ult) : 'nunca';
      return `
        <div class="aut-regla ${activa ? '' : 'off'}">
          <div class="aut-regla-head">
            <span class="aut-regla-id">${esc(r.id)}</span>
            <button class="aut-toggle ${activa ? 'on' : 'off'}" data-regla="${esc(r.id)}">
              ${activa ? '● ACTIVA' : '○ PAUSADA'}
            </button>
          </div>
          <div class="aut-regla-desc">${esc(r.descripcion || '')}</div>
          <div class="aut-regla-meta">
            <span>Acción: ${esc(r.accion.tipo)}</span>
            <span>Última: ${hace}</span>
          </div>
        </div>
      `;
    }).join('');

    // Historial
    const histHTML = this.historial.slice(0, 8).map(h => {
      const cuando = this._tiempoRel(ahora - h.t);
      return `
        <div class="aut-hist-item ${h.ok ? 'ok' : 'fail'}">
          <span class="aut-hist-hora">${cuando}</span>
          <span class="aut-hist-desc">${esc(h.desc)}</span>
          <span class="aut-hist-tipo">${esc(h.tipo)}</span>
        </div>
      `;
    }).join('') || '<div class="empty" style="padding:14px 0;">Sin ejecuciones registradas</div>';

    cont.innerHTML = `
      <div class="aut-stats">
        <div class="aut-stat">
          <div class="aut-stat-num">${info.activo ? '🟢' : '⏸'}</div>
          <div class="aut-stat-lbl">${info.activo ? 'Activo' : 'Pausado'}</div>
        </div>
        <div class="aut-stat">
          <div class="aut-stat-num">${info.reglasActivas}/${info.reglas}</div>
          <div class="aut-stat-lbl">Reglas</div>
        </div>
        <div class="aut-stat">
          <div class="aut-stat-num">${info.ejecuciones}</div>
          <div class="aut-stat-lbl">Ejecuciones</div>
        </div>
        <div class="aut-stat">
          <div class="aut-stat-num" style="font-size:11px;line-height:1.3;">${info.ultimoCiclo.split(' ')[1] || '—'}</div>
          <div class="aut-stat-lbl">Últ. tick</div>
        </div>
      </div>

      <div class="aut-actions">
        <button class="aut-btn" id="autToggle">${info.activo ? '⏸ PAUSAR' : '▶ REANUDAR'}</button>
        <button class="aut-btn" id="autTick">🔄 FORZAR TICK</button>
        <button class="aut-btn" id="autLimpiar">🗑 LIMPIAR HISTORIAL</button>
      </div>

      <div class="aut-section-title">Reglas</div>
      <div class="aut-reglas">${reglasHTML}</div>

      <div class="aut-section-title">Últimas ejecuciones</div>
      <div class="aut-hist">${histHTML}</div>
    `;

    // Handlers
    const btnToggle = document.getElementById('autToggle');
    if (btnToggle) btnToggle.onclick = () => {
      info.activo ? this.desactivar() : this.reactivar();
    };
    const btnTick = document.getElementById('autTick');
    if (btnTick) btnTick.onclick = () => this.forzarTick();
    const btnLimpiar = document.getElementById('autLimpiar');
    if (btnLimpiar) btnLimpiar.onclick = () => {
      this.historial = [];
      store.set('autonomo_historial', []);
      this.renderPanel();
      if (typeof toast === 'function') toast('Historial limpiado');
    };
    cont.querySelectorAll('[data-regla]').forEach(b => {
      b.onclick = () => this.toggleRegla(b.dataset.regla);
    });
  },

  _tiempoRel(ms){
    if (ms < 60e3) return 'hace ' + Math.round(ms/1000) + 's';
    if (ms < 3600e3) return 'hace ' + Math.round(ms/60e3) + 'min';
    if (ms < 86400e3) return 'hace ' + Math.round(ms/3600e3) + 'h';
    return 'hace ' + Math.round(ms/86400e3) + 'd';
  }
};

window.Autonomo = Autonomo;
