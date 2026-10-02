/* ============================================================
   16-AUTONOMO · Núcleo autónomo de ANIA
   Ciclo Observe → Decide → Act
   - Sensores: hora, red, visibilidad, sesión, ubicación, batería
   - Reglas declarativas (fáciles de añadir)
   - Efectores: notificar, ejecutar tools, sincronizar, sonar
   - Persistencia de último disparo por regla en localStorage
============================================================ */
'use strict';

const Autonomo = {
  activo: true,
  ciclo: null,
  INTERVALO_MS: 60 * 1000,  // 1 minuto entre ciclos
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
  estados: {},        // { idRegla: timestampUltimaEjecucion }
  _cargarEstados(){
    try { this.estados = store.get('autonomo_estados', {}); }catch(e){ this.estados = {}; }
  },
  _guardarEstado(id, t){
    this.estados[id] = t;
    try { store.set('autonomo_estados', this.estados); }catch(e){}
  },

  /* ---------------- Sistema de SENSORES ---------------- */
  sensor: {
    leer(){
      const ahora = new Date();
      return {
        hora: ahora,
        horaNum: ahora.getHours(),
        minuto: ahora.getMinutes(),
        diaSemana: ahora.getDay(),         // 0=Domingo, 1=Lunes, ...
        fecha: ahora.toDateString(),
        online: navigator.onLine,
        visible: !document.hidden,
        // Info adicional
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

  /* ---------------- Sistema de REGLAS ---------------- */
  /* Cada regla:
     {
       id: 'nombre-unico',
       descripcion: '...',
       cuando: (s) => bool,           // condición con sensores
       accion: { tipo: '...', ... },  // efecto a ejecutar
       minIntervalo: 3600000          // tiempo mínimo entre disparos (ms)
     }
  */
  reglas: [
    /* ===== BUENOS DÍAS ===== */
    {
      id: 'buenos-dias',
      descripcion: 'Saluda al usuario entre 7:00 y 9:00 si no lo hemos hecho hoy',
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
      minIntervalo: 12 * 60 * 60 * 1000  // una vez al día aprox
    },

    /* ===== RESPALDO AL VOLVER ONLINE ===== */
    {
      id: 'sync-al-reconectar',
      descripcion: 'Si hay cola offline y volvemos online, sincronizar',
      cuando: (s) => s.online && s.colaOffline > 0,
      accion: { tipo: 'sincronizar' },
      minIntervalo: 2 * 60 * 1000
    },

    /* ===== RECORDATORIO DE TAREAS VENCIDAS ===== */
    {
      id: 'tareas-vencidas',
      descripcion: 'Recordar tareas vencidas (máx 1 vez cada 4h)',
      cuando: (s) => s.tareasVencidas > 0 && s.visible && s.horaNum >= 9 && s.horaNum < 22,
      accion: {
        tipo: 'notificar',
        titulo: 'ANIA · Tareas vencidas',
        cuerpo: (s) => `Tienes ${s.tareasVencidas} tarea(s) vencida(s). Di «mis tareas» para verlas.`
      },
      minIntervalo: 4 * 60 * 60 * 1000
    },

    /* ===== RITUAL DEL CAFÉ ===== */
    {
      id: 'cafe-manana',
      descripcion: 'Preguntar por el café a las 10am si no hemos hablado',
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

    /* ===== CIERRE DEL DÍA ===== */
    {
      id: 'cierre-dia',
      descripcion: 'Resumen suave antes de dormir (22:30-23:30)',
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

    /* ===== AUTONOMÍA · EJECUTAR AUTOMÁTICAMENTE ===== */
    {
      id: 'saludo-autonomo',
      descripcion: 'Si pasan 3+ horas sin actividad, Ania rompe el silencio',
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

  /* ---------------- Sistema de EFECTORES ---------------- */
  efector: {
    async ejecutar(accion, sensores){
      if (!accion || !accion.tipo) return;
      try{
        switch (accion.tipo){
          case 'notificar':   return await this._notificar(accion, sensores);
          case 'mensaje':     return await this._mensaje(accion, sensores);
          case 'sincronizar': return await this._sincronizar();
          case 'ejecutarTool':return await this._ejecutarTool(accion);
          case 'sonido':      return this._sonido(accion);
          default:
            console.warn('[Autónomo] Acción desconocida:', accion.tipo);
        }
      }catch(e){
        console.error('[Autónomo] Error en efector:', accion.tipo, e.message);
      }
    },

    async _notificar(accion, sensores){
      const cuerpo = typeof accion.cuerpo === 'function' ? accion.cuerpo(sensores) : (accion.cuerpo || '');
      // 1) Notificación nativa
      if (typeof notify === 'function'){
        notify(accion.titulo || 'ANIA', cuerpo, { tag: accion.tag || 'autonomo', important: false });
      }
      // 2) También al chat (silencioso)
      if (typeof addChat === 'function'){
        addChat('sys', '🌙 ' + (accion.titulo || 'ANIA') + ' · ' + cuerpo);
      }
      console.log('[Autónomo] 📬 Notificado:', cuerpo);
    },

    async _mensaje(accion, sensores){
      const texto = typeof accion.texto === 'function' ? accion.texto(sensores) : (accion.texto || '');
      if (!texto) return;
      if (typeof personaReply === 'function'){
        personaReply(texto);
      }
      console.log('[Autónomo] 💬 Mensaje:', texto);
    },

    async _sincronizar(){
      if (typeof Sync !== 'undefined' && Sync.fullSync){
        await Sync.fullSync();
        console.log('[Autónomo] 🔄 Sincronización ejecutada');
      }
      if (typeof procesarColaOffline === 'function'){
        await procesarColaOffline();
        console.log('[Autónomo] 📤 Cola offline procesada');
      }
    },

    async _ejecutarTool(accion){
      if (typeof Brain === 'undefined' || !Brain.runTool) return;
      const res = await Brain.runTool({ n: accion.tool, args: accion.args || {} });
      console.log('[Autónomo] 🛠 Tool', accion.tool, '→', res);
    },

    _sonido(accion){
      if (typeof beep === 'function'){
        beep(accion.freq || 880, accion.dur || 0.2, 0);
      }
    }
  },

  /* ---------------- Sistema PLANIFICADOR ---------------- */
  planificador: {
    decidir(sensores, reglas, estados){
      const ahora = Date.now();
      const aEjecutar = [];
      for (const regla of reglas){
        try{
          // 1) Respetar intervalo mínimo
          const ultimo = estados[regla.id] || 0;
          if (regla.minIntervalo && ahora - ultimo < regla.minIntervalo) continue;
          // 2) Evaluar condición
          if (!regla.cuando(sensores)) continue;
          // 3) Aceptar
          aEjecutar.push(regla);
        }catch(e){
          console.warn('[Autónomo] Regla', regla.id, 'falló al evaluarse:', e.message);
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
      // 1) OBSERVAR
      const sensores = this.sensor.leer();

      // 2) PROCESAR COLA PRIMERO
      while (this.cola.length && this.cola.length > 0){
        const t = this.sacarTarea();
        if (t) await this.efector.ejecutar(t.accion, sensores);
      }

      // 3) DECIDIR
      const reglasADisparar = this.planificador.decidir(sensores, this.reglas, this.estados);

      // 4) ACTUAR
      for (const regla of reglasADisparar){
        await this.efector.ejecutar(regla.accion, sensores);
        this._guardarEstado(regla.id, Date.now());
        console.log('[Autónomo] ✅ Regla disparada:', regla.id);
      }
    }catch(e){
      console.error('[Autónomo] Error en tick:', e.message);
    }
  },

  /* ---------------- API PÚBLICA ---------------- */
  async init(){
    this.cargarCola();
    this._cargarEstados();
    this.activo = store.get('autonomo_activo', true);
    console.log('🌙 Autónomo iniciado · reglas:', this.reglas.length, '· activo:', this.activo);

    // Primer tick al arrancar (retrasado para no estorbar el boot)
    setTimeout(() => this.tick('boot'), 15000);

    // Tick cada minuto
    if (this.ciclo) clearInterval(this.ciclo);
    this.ciclo = setInterval(() => this.tick('timer'), this.INTERVALO_MS);

    // Tick extra al volver visible la pestaña
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.tick('visibilidad');
    });

    // Tick extra al volver online
    window.addEventListener('online', () => this.tick('online'));
  },

  desactivar(){
    this.activo = false;
    store.set('autonomo_activo', false);
    if (this.ciclo) clearInterval(this.ciclo);
    console.log('[Autónomo] ⏸ Desactivado');
  },

  reactivar(){
    this.activo = true;
    store.set('autonomo_activo', true);
    this.init();
    console.log('[Autónomo] ▶️ Reactivado');
  },

  /* ---------- Llamado desde el SW cuando despierta ---------- */
  trigger(tipo){
    console.log('[Autónomo] 🌙 SW trigger:', tipo);
    if (tipo === 'autonomo') return this.tick('sw-periodic');
    if (tipo === 'sync-cola') return this.tick('sw-sync-cola');
    if (tipo === 'sync-tareas') return this.tick('sw-sync-tareas');
    return this.tick('sw-' + tipo);
  },

  /* ---------- API para añadir reglas dinámicamente ---------- */
  agregarRegla(regla){
    if (!regla || !regla.id || !regla.cuando || !regla.accion) return false;
    // Reemplazar si ya existe
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

  /* ---------- Diagnóstico ---------- */
  info(){
    return {
      activo: this.activo,
      reglas: this.reglas.length,
      cola: this.cola.length,
      ultimoCiclo: this.ultimoCiclo ? new Date(this.ultimoCiclo).toLocaleString('es-ES') : 'nunca',
      estados: Object.keys(this.estados).length
    };
  },

  /* ---------- Ejecutar todas las reglas ahora (debug) ---------- */
  async forzarTick(){
    console.log('[Autónomo] Forzando tick manual...');
    this.ultimoCiclo = 0;  // reset para saltar el intervalo mínimo
    await this.tick('manual');
  }
};

window.Autonomo = Autonomo;
