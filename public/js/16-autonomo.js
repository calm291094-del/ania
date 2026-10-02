/* ============================================================
   16-AUTONOMO · Núcleo autónomo de ANIA
   v6 · acciones encadenadas + condiciones compuestas + presets
============================================================ */
'use strict';

const Autonomo = {
  activo: true,
  ciclo: null,
  INTERVALO_MS: 60 * 1000,
  ultimoCiclo: 0,
  formVisible: false,

  /* ---------------- Cola ---------------- */
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
  _persistirCola(){ try { store.set('autonomo_cola', this.cola.slice(-30)); }catch(e){} },
  cargarCola(){ try { this.cola = store.get('autonomo_cola', []); }catch(e){ this.cola = []; } },

  /* ---------------- Estados ---------------- */
  estados: {},
  _cargarEstados(){ try { this.estados = store.get('autonomo_estados', {}); }catch(e){ this.estados = {}; } },
  _guardarEstado(id, t){ this.estados[id] = t; try { store.set('autonomo_estados', this.estados); }catch(e){} },

  /* ---------------- Toggles ---------------- */
  reglasDesactivadas: [],
  _cargarToggles(){ try { this.reglasDesactivadas = store.get('autonomo_reglas_off', []); }catch(e){ this.reglasDesactivadas = []; } },
  _guardarToggles(){ try { store.set('autonomo_reglas_off', this.reglasDesactivadas); }catch(e){} },
  toggleRegla(id){
    const idx = this.reglasDesactivadas.indexOf(id);
    if (idx >= 0) this.reglasDesactivadas.splice(idx, 1);
    else this.reglasDesactivadas.push(id);
    this._guardarToggles();
    this.renderPanel();
  },
  reglaActiva(id){ return !this.reglasDesactivadas.includes(id); },

  /* ---------------- Historial ---------------- */
  historial: [],
  MAX_HISTORIAL: 30,
  _cargarHistorial(){ try { this.historial = store.get('autonomo_historial', []); }catch(e){ this.historial = []; } },
  _registrarEjecucion(regla, resultado){
    this.historial.unshift({
      id: regla.id, desc: regla.descripcion || regla.id,
      tipo: (regla.acciones && regla.acciones.length > 1 ? regla.acciones.length + ' acciones' : (regla.accion?.tipo || '—')),
      t: Date.now(), ok: resultado !== false
    });
    if (this.historial.length > this.MAX_HISTORIAL) this.historial.length = this.MAX_HISTORIAL;
    try { store.set('autonomo_historial', this.historial); }catch(e){}
  },

  /* ============================================================
     SENSORES AVANZADOS
  ============================================================ */
  _bateria: { nivel: null, cargando: null, t: 0 },
  async _leerBateria(){
    try {
      if (navigator.getBattery){
        const b = await navigator.getBattery();
        this._bateria = { nivel: b.level, cargando: b.charging, t: Date.now() };
        if (!this._bateriaSuscrito){
          this._bateriaSuscrito = true;
          b.addEventListener('levelchange', () => { this._bateria.nivel = b.level; this._bateria.t = Date.now(); });
          b.addEventListener('chargingchange', () => { this._bateria.cargando = b.charging; this._bateria.t = Date.now(); });
        }
      }
    } catch(e) {}
    return this._bateria;
  },

  _ubicacion: { lat: null, lon: null, lugar: null, t: 0 },
  _lugares: [],

  async _leerUbicacion(){
    if (this._ubicacion.lat && Date.now() - this._ubicacion.t < 5 * 60 * 1000){
      return this._ubicacion;
    }
    try {
      if (!navigator.geolocation) return this._ubicacion;
      const pos = await new Promise((res, rej) => {
        navigator.geolocation.getCurrentPosition(res, rej, {
          timeout: 8000, maximumAge: 60000, enableHighAccuracy: false
        });
      });
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      let lugar = null;
      for (const l of this._lugares){
        const d = this._distancia(lat, lon, l.lat, l.lon);
        if (d < (l.radio || 200)){ lugar = l.nombre; break; }
      }
      this._ubicacion = { lat, lon, lugar, t: Date.now() };
    } catch(e){}
    return this._ubicacion;
  },

  _distancia(lat1, lon1, lat2, lon2){
    const R = 6371000;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ/2)**2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  },

  _clima: { llueve: false, temp: null, codigo: null, t: 0 },
  async _leerClima(){
    if (Date.now() - this._clima.t < 20 * 60 * 1000 && this._clima.t > 0) return this._clima;
    try {
      if (typeof geoCache !== 'function' || typeof getWeather !== 'function') return this._clima;
      const g = geoCache();
      if (!g) return this._clima;
      const d = await getWeather(g);
      const code = d.current.weather_code;
      this._clima = {
        llueve: code >= 51 && code <= 82,
        temp: Math.round(d.current.temperature_2m),
        codigo: code, t: Date.now()
      };
    } catch(e){}
    return this._clima;
  },

  _leerSol(){
    const hora = new Date().getHours();
    return {
      esDeDia: hora >= 6 && hora < 20,
      esNoche: hora >= 20 || hora < 6,
      esAmanecer: hora >= 6 && hora < 8,
      esAtardecer: hora >= 19 && hora < 21
    };
  },

  sensor: {
    leer(){
      const ahora = new Date();
      const sol = Autonomo._leerSol();
      return {
        hora: ahora, horaNum: ahora.getHours(), minuto: ahora.getMinutes(),
        diaSemana: ahora.getDay(), fecha: ahora.toDateString(),
        online: navigator.onLine, visible: !document.hidden,
        usuario: (typeof Mind !== 'undefined' && Mind.nombre()) || null,
        colaOffline: (typeof OfflineQueue !== 'undefined' && OfflineQueue.count()) || 0,
        tareasPendientes: (typeof tasks !== 'undefined' && Array.isArray(tasks))
          ? tasks.filter(t => !t.done).length : 0,
        tareasVencidas: (typeof tasks !== 'undefined' && Array.isArray(tasks))
          ? tasks.filter(t => !t.done && t.when && t.when < Date.now()).length : 0,
        sesionActiva: (typeof Session !== 'undefined' && !!Session),
        cerebroListo: (typeof Brain !== 'undefined' && Brain.localReady),
        bateria: Autonomo._bateria,
        ubicacion: Autonomo._ubicacion,
        clima: Autonomo._clima,
        sol
      };
    }
  },

  /* ============================================================
     EVALUADOR DE CONDICIONES
     Cada condición es: { sensor, op, valor }
     El grupo es: { modo: 'and'|'or', condiciones: [...] }
  ============================================================ */
  SENSORES_DISPONIBLES: [
    { id: 'hora',           label: 'Hora del día',            tipo: 'num',  unidad: '0-23' },
    { id: 'minuto',         label: 'Minuto',                  tipo: 'num',  unidad: '0-59' },
    { id: 'diaSemana',      label: 'Día de semana',           tipo: 'num',  unidad: '0=Dom' },
    { id: 'online',         label: 'Conectado a internet',    tipo: 'bool', },
    { id: 'visible',        label: 'Pestaña visible',         tipo: 'bool', },
    { id: 'sesionActiva',   label: 'Sesión iniciada',         tipo: 'bool', },
    { id: 'bateria.nivel',  label: 'Batería',                 tipo: 'num',  unidad: '0-1' },
    { id: 'bateria.cargando', label: 'Cargando',              tipo: 'bool', },
    { id: 'ubicacion.lugar', label: 'Lugar',                  tipo: 'texto' },
    { id: 'clima.llueve',   label: 'Está lloviendo',          tipo: 'bool', },
    { id: 'clima.temp',     label: 'Temperatura',             tipo: 'num',  unidad: '°C' },
    { id: 'sol.esDeDia',    label: 'Es de día',               tipo: 'bool', },
    { id: 'tareasPendientes', label: 'Tareas pendientes',     tipo: 'num',  unidad: '#' },
    { id: 'tareasVencidas', label: 'Tareas vencidas',         tipo: 'num',  unidad: '#' }
  ],

  OPERADORES: [
    { id: 'eq',   label: '=',   aplica: ['num','texto'] },
    { id: 'neq',  label: '≠',   aplica: ['num','texto'] },
    { id: 'gt',   label: '>',   aplica: ['num'] },
    { id: 'gte',  label: '≥',   aplica: ['num'] },
    { id: 'lt',   label: '<',   aplica: ['num'] },
    { id: 'lte',  label: '≤',   aplica: ['num'] },
    { id: 'contiene', label: 'contiene', aplica: ['texto'] },
    { id: 'esVerdadero', label: 'es verdadero', aplica: ['bool'] },
    { id: 'esFalso', label: 'es falso', aplica: ['bool'] }
  ],

  _obtenerValorSensor(sensores, path){
    const partes = path.split('.');
    let v = sensores;
    for (const p of partes){
      if (v === null || v === undefined) return null;
      v = v[p];
    }
    return v;
  },

  evaluarCondicion(sensores, cond){
    const v = this._obtenerValorSensor(sensores, cond.sensor);
    switch (cond.op){
      case 'eq':  return v == cond.valor;
      case 'neq': return v != cond.valor;
      case 'gt':  return Number(v) > Number(cond.valor);
      case 'gte': return Number(v) >= Number(cond.valor);
      case 'lt':  return Number(v) < Number(cond.valor);
      case 'lte': return Number(v) <= Number(cond.valor);
      case 'contiene': return String(v || '').toLowerCase().includes(String(cond.valor || '').toLowerCase());
      case 'esVerdadero': return v === true;
      case 'esFalso': return v === false || v === null || v === undefined;
      default: return false;
    }
  },

  evaluarGrupo(sensores, grupo){
    if (!grupo || !grupo.condiciones || !grupo.condiciones.length) return true;
    const resultados = grupo.condiciones.map(c => this.evaluarCondicion(sensores, c));
    if (grupo.modo === 'or') return resultados.some(r => r);
    return resultados.every(r => r); // 'and' por defecto
  },

  /* ============================================================
     REGLAS BUILT-IN
  ============================================================ */
  reglas: [
    { id: 'buenos-dias', descripcion: 'Saluda entre 7:00 y 9:00',
      cuando: (s) => s.horaNum >= 7 && s.horaNum < 9 && s.visible && s.sesionActiva,
      accion: { tipo: 'notificar', titulo: 'ANIA · Buenos días',
        cuerpo: (s) => {
          const nombre = Mind.nombre() ? ', ' + Mind.nombre() : '';
          const clima = s.clima.temp !== null ? ` · ${s.clima.temp}°C` : '';
          const lluvia = s.clima.llueve ? ' · llueve, paraguas' : '';
          return `Buenos días${nombre}${clima}${lluvia}. ${s.tareasPendientes > 0 ? 'Tienes ' + s.tareasPendientes + ' pendientes.' : 'Agenda libre.'}`;
        } },
      minIntervalo: 12 * 60 * 60 * 1000 },
    { id: 'sync-al-reconectar', descripcion: 'Sincronizar cola offline al volver online',
      cuando: (s) => s.online && s.colaOffline > 0,
      accion: { tipo: 'sincronizar' }, minIntervalo: 2 * 60 * 1000 },
    { id: 'tareas-vencidas', descripcion: 'Recordar tareas vencidas (cada 4h)',
      cuando: (s) => s.tareasVencidas > 0 && s.visible && s.horaNum >= 9 && s.horaNum < 22,
      accion: { tipo: 'notificar', titulo: 'ANIA · Tareas vencidas',
        cuerpo: (s) => `Tienes ${s.tareasVencidas} tarea(s) vencida(s). Di «mis tareas».` },
      minIntervalo: 4 * 60 * 60 * 1000 },
    { id: 'cafe-manana', descripcion: 'Preguntar por el café a las 10 AM',
      cuando: (s) => s.horaNum === 10 && s.diaSemana !== 0 && s.visible && s.sesionActiva,
      accion: { tipo: 'mensaje', texto: () => pick([
        '¿Ya tomaste café? Es la hora perfecta para el primero bueno.',
        'Diez de la mañana: pausa de café, orden ejecutiva.',
        'Mi termómetro interno dice que toca un café.']) },
      minIntervalo: 20 * 60 * 60 * 1000 },
    { id: 'cierre-dia', descripcion: 'Resumen antes de dormir (22:30-23:59)',
      cuando: (s) => (s.horaNum === 22 && s.minuto >= 30) || s.horaNum === 23,
      accion: { tipo: 'notificar', titulo: 'ANIA · Cierre del día',
        cuerpo: (s) => s.tareasPendientes > 0
          ? `Quedan ${s.tareasPendientes} pendientes para mañana. Descansa bien.`
          : 'Día cerrado. Mañana seguimos.' },
      minIntervalo: 20 * 60 * 60 * 1000 },
    { id: 'saludo-autonomo', descripcion: 'Rompe el silencio tras 3h',
      cuando: (s) => {
        if (!s.visible || !s.sesionActiva) return false;
        const ultimo = (typeof S !== 'undefined' && S.lastUserTs) || 0;
        return ultimo > 0 && (Date.now() - ultimo) > 3 * 3600 * 1000;
      },
      accion: { tipo: 'mensaje', texto: () => pick([
        'Silencio prolongado... ¿todo bien por ahí?',
        'Hace rato que no hablamos. Aquí sigo, por si acaso.',
        '¿Pausa larga o te perdí de vista?']) },
      minIntervalo: 6 * 3600 * 1000 },
    { id: 'bateria-baja', descripcion: 'Batería < 20% sin cargar',
      cuando: (s) => s.bateria.nivel !== null && s.bateria.nivel < 0.2 && !s.bateria.cargando,
      accion: { tipo: 'notificar', titulo: 'ANIA · Batería baja',
        cuerpo: (s) => `Batería al ${Math.round(s.bateria.nivel*100)}%. Conéctame.` },
      minIntervalo: 30 * 60 * 1000 },
    { id: 'bateria-cargando', descripcion: 'Confirmar cuando se carga',
      cuando: (s) => s.bateria.cargando === true && s.bateria.nivel !== null && s.bateria.nivel < 0.5,
      accion: { tipo: 'mensaje', texto: (s) => `Bien, cargando al ${Math.round(s.bateria.nivel*100)}%. Gracias.` },
      minIntervalo: 2 * 60 * 60 * 1000 },
    { id: 'aviso-lluvia', descripcion: 'Avisar si llueve',
      cuando: (s) => s.clima.llueve === true && s.visible && s.horaNum >= 7 && s.horaNum < 22,
      accion: { tipo: 'notificar', titulo: 'ANIA · Llueve', cuerpo: () => 'Está lloviendo. Paraguas y abrigo.' },
      minIntervalo: 6 * 60 * 60 * 1000 },
    { id: 'llegada-casa', descripcion: 'Saludo al llegar a casa',
      cuando: (s) => s.ubicacion.lugar === 'casa' && s.sesionActiva && s.visible,
      accion: { tipo: 'mensaje', texto: () => pick([
        'Bienvenido a casa. ¿Cómo estuvo el día?',
        'En casa otra vez. El café está listo imaginariamente.',
        'Llegaste. Descansa un poco.']) },
      minIntervalo: 4 * 60 * 60 * 1000 },
    { id: 'salida-casa', descripcion: 'Recordatorio al salir de casa',
      cuando: (s) => s.ubicacion.lugar !== 'casa' && s.ubicacion.lat !== null && s.sesionActiva && s.visible,
      accion: { tipo: 'notificar', titulo: 'ANIA · Saliendo', cuerpo: () => '¿Llevas todo? Llaves, móvil, cartera.' },
      minIntervalo: 4 * 60 * 60 * 1000 }
  ],

  /* ============================================================
     PRESETS AVANZADOS · acciones encadenadas con condiciones
  ============================================================ */
  PRESETS: [
    {
      id: 'preset-enfoque',
      nombre: 'Modo enfoque',
      icon: '🎯',
      descripcion: 'Pomodoro + silencio + lo-fi',
      disparador: 'manual',
      acciones: [
        { tipo: 'mensaje', texto: 'Modo enfoque activado. 25 minutos sin distracciones.' },
        { tipo: 'musica', que: 'musica' },
        { tipo: 'sonido', freq: 880, dur: 0.3 }
      ]
    },
    {
      id: 'preset-relax',
      nombre: 'Modo relax',
      icon: '🧘',
      descripcion: 'Lluvia + mensaje de calma',
      disparador: 'manual',
      acciones: [
        { tipo: 'musica', que: 'lluvia' },
        { tipo: 'mensaje', texto: 'Modo relax. Respira, lluvia de fondo, cinco minutos para ti.' }
      ]
    },
    {
      id: 'preset-amanece',
      nombre: 'Amanecer completo',
      icon: '🌅',
      descripcion: 'Saludo + clima + tareas + café',
      disparador: 'cuando',
      cuandoStr: '(s) => s.horaNum === 7 && s.minuto >= 0 && s.minuto < 30 && s.visible && s.sesionActiva',
      minIntervalo: 20 * 60 * 60 * 1000,
      acciones: [
        { tipo: 'notificar', titulo: 'ANIA · Amanecer',
          cuerpoStr: '(s) => { const n = Mind.nombre() ? ", " + Mind.nombre() : ""; const c = s.clima.temp !== null ? " · " + s.clima.temp + "°C" : ""; return "Buenos días" + n + c + ". Día nuevo, agenda fresca."; }' },
        { tipo: 'esperar', ms: 3000 },
        { tipo: 'mensaje', texto: '¿Arrancamos con un café?' }
      ]
    },
    {
      id: 'preset-guardia',
      nombre: 'Guardia nocturna',
      icon: '🛡️',
      descripcion: 'Silencia música + revisa tareas + aviso',
      disparador: 'cuando',
      cuandoStr: '(s) => s.horaNum === 23 && s.visible',
      minIntervalo: 20 * 60 * 60 * 1000,
      acciones: [
        { tipo: 'musica', que: 'parar' },
        { tipo: 'notificar', titulo: 'ANIA · Guardia nocturna',
          cuerpoStr: '(s) => s.tareasPendientes > 0 ? "Quedan " + s.tareasPendientes + " pendientes. Los atacamos mañana." : "Todo cerrado. Descansa."' }
      ]
    }
  ],

  /* ============================================================
     REGLAS CUSTOM PERSISTENTES (con acciones múltiples)
  ============================================================ */
  reglasCustom: [],
  _reglasBuiltIn: [],

  _cargarReglasCustom(){
    try { this.reglasCustom = store.get('autonomo_reglas_custom', []); }catch(e){ this.reglasCustom = []; }
    this.reglasCustom = this.reglasCustom.map(r => this._rehidratarRegla(r)).filter(Boolean);
  },
  _guardarReglasCustom(){
    const s = this.reglasCustom.filter(Boolean).map(r => ({
      id: r.id, descripcion: r.descripcion,
      cuandoStr: r._cuandoStr,
      accionesRaw: r._accionesRaw,           // array serializable
      minIntervalo: r.minIntervalo || 0, t: r.t || Date.now()
    }));
    try { store.set('autonomo_reglas_custom', s); }catch(e){}
  },
  _rehidratarRegla(r){
    try {
      const cuando = new Function('s', 'return (' + r.cuandoStr + ')(s)');

      // Compatibilidad con formato viejo (accion singular)
      let accionesRaw = r.accionesRaw;
      if (!accionesRaw && r.accionTipo){
        accionesRaw = [{
          tipo: r.accionTipo, titulo: r.accionTitulo,
          cuerpoStr: r.accionCuerpoStr, textoStr: r.accionTextoStr,
          extra: r.accionExtra || null
        }];
      }
      if (!accionesRaw) return null;

      const acciones = accionesRaw.map(a => {
        const acc = { tipo: a.tipo };
        if (a.titulo) acc.titulo = a.titulo;
        if (a.cuerpoStr) acc.cuerpo = new Function('s', 'return (' + a.cuerpoStr + ')(s)');
        if (a.textoStr) acc.texto = new Function('s', 'return (' + a.textoStr + ')(s)');
        if (a.extra) Object.assign(acc, a.extra);
        return acc;
      });

      return {
        id: r.id, descripcion: r.descripcion, cuando,
        acciones,                          // array
        accion: acciones[0],               // compat con código viejo
        minIntervalo: r.minIntervalo || 0,
        _cuandoStr: r.cuandoStr, _accionesRaw: accionesRaw,
        _custom: true, t: r.t
      };
    } catch(e){ console.warn('[Autónomo] Regla inválida:', r.id, e.message); return null; }
  },
  agregarReglaCustom(regla){
    if (!regla || !regla.id) return false;
    this.reglasCustom = this.reglasCustom.filter(r => r && r.id !== regla.id);
    this.reglasCustom.push(regla);
    this._guardarReglasCustom();
    this._reconstruirReglas();
    console.log('[Autónomo] ➕ Regla custom:', regla.id);
    this.renderPanel();
    return true;
  },
  eliminarReglaCustom(id){
    const antes = this.reglasCustom.length;
    this.reglasCustom = this.reglasCustom.filter(r => r && r.id !== id);
    if (this.reglasCustom.length < antes){
      this._guardarReglasCustom();
      this._reconstruirReglas();
      this.renderPanel();
      return true;
    }
    return false;
  },
  _reconstruirReglas(){
    if (!this._reglasBuiltIn.length) this._reglasBuiltIn = this.reglas.filter(r => !r._custom);
    this.reglas = [...this._reglasBuiltIn, ...this.reglasCustom.filter(Boolean)];
  },

  /* ---------------- Lugares ---------------- */
  _cargarLugares(){ try { this._lugares = store.get('autonomo_lugares', []); }catch(e){ this._lugares = []; } },
  _guardarLugares(){ try { store.set('autonomo_lugares', this._lugares); }catch(e){} },
  guardarLugarActual(nombre, radio = 200){
    if (!this._ubicacion.lat) return false;
    this._lugares = this._lugares.filter(l => l.nombre !== nombre);
    this._lugares.push({ nombre, lat: this._ubicacion.lat, lon: this._ubicacion.lon, radio });
    this._guardarLugares();
    return true;
  },
  eliminarLugar(nombre){
    const antes = this._lugares.length;
    this._lugares = this._lugares.filter(l => l.nombre !== nombre);
    if (this._lugares.length < antes){ this._guardarLugares(); return true; }
    return false;
  },

  /* ---------------- EFECTORES (con delay) ---------------- */
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
          case 'musica':      return this._musica(accion);
          case 'abrirUrl':    return this._abrirUrl(accion);
          case 'esperar':     return await this._esperar(accion);
          default: console.warn('[Autónomo] Acción desconocida:', accion.tipo); return false;
        }
      }catch(e){ console.error('[Autónomo] Error en efector:', accion.tipo, e.message); return false; }
    },
    async _notificar(accion, sensores){
      const cuerpo = typeof accion.cuerpo === 'function' ? accion.cuerpo(sensores) : (accion.cuerpo || '');
      const titulo = accion.titulo || 'ANIA';
  
      // Notificación local
      if (typeof notify === 'function') notify(titulo, cuerpo, { tag: accion.tag || 'autonomo', important: false });
      if (typeof addChat === 'function') addChat('sys', '🌙 ' + titulo + ' · ' + cuerpo);
  
      // ⭐ Push remoto
      try {
        if (AniaAPI && AniaAPI.token) {
          await fetch(CONFIG.ANIA_API + '/ania/push/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + AniaAPI.token
            },
            body: JSON.stringify({ titulo, cuerpo, tag: accion.tag || 'autonomo' })
          });
        }
      } catch(e) { /* silencioso */ }
  
      console.log('[Autónomo] 📬 Notificado:', cuerpo);
      return true;
    },
    async _mensaje(accion, sensores){
      const texto = typeof accion.texto === 'function' ? accion.texto(sensores) : (accion.texto || '');
      if (!texto) return false;
      if (typeof personaReply === 'function') personaReply(texto);
      console.log('[Autónomo] 💬 Mensaje:', texto);
      return true;
    },
    async _sincronizar(){
      if (typeof Sync !== 'undefined' && Sync.fullSync) await Sync.fullSync();
      if (typeof procesarColaOffline === 'function') await procesarColaOffline();
      return true;
    },
    async _ejecutarTool(accion){
      if (typeof Brain === 'undefined' || !Brain.runTool) return false;
      const res = await Brain.runTool({ n: accion.tool, args: accion.args || {} });
      console.log('[Autónomo] 🛠 Tool', accion.tool, '→', res);
      return true;
    },
    _sonido(accion){
      if (typeof beep === 'function') beep(accion.freq || 880, accion.dur || 0.2, 0);
      return true;
    },
    _musica(accion){
      try {
        if (accion.que === 'lluvia' && typeof Ambient !== 'undefined') Ambient.start('lluvia');
        else if (accion.que === 'cafeteria' && typeof Ambient !== 'undefined') Ambient.start('cafeteria');
        else if (accion.que === 'parar'){ if (typeof Music !== 'undefined') Music.stop(); if (typeof Ambient !== 'undefined') Ambient.stop(); }
        else if (typeof Music !== 'undefined') Music.start();
      } catch(e){}
      return true;
    },
    _abrirUrl(accion){
      try { window.open(accion.url, '_blank'); return true; } catch(e){ return false; }
    },
    async _esperar(accion){
      const ms = Math.max(0, Math.min(30000, accion.ms || 1000));
      await new Promise(r => setTimeout(r, ms));
      return true;
    }
  },

  /* ---------------- Planificador (soporta acciones múltiples) ---------------- */
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
        }catch(e){ console.warn('[Autónomo] Regla', regla.id, 'falló:', e.message); }
      }
      return aEjecutar;
    }
  },

  /* ---------------- Tick ---------------- */
  async tick(razon = 'timer'){
    if (!this.activo) return;
    const ahora = Date.now();
    if (ahora - this.ultimoCiclo < 30 * 1000 && razon === 'timer') return;
    this.ultimoCiclo = ahora;

    try{
      await Promise.all([ this._leerBateria(), this._leerUbicacion(), this._leerClima() ]);
      const sensores = this.sensor.leer();

      while (this.cola.length > 0){
        const t = this.sacarTarea();
        if (t) await this._ejecutarAcciones(t.acciones || [t.accion], sensores);
      }

      const reglasADisparar = this.planificador.decidir(sensores, this.reglas, this.estados, this.reglasDesactivadas);
      for (const regla of reglasADisparar){
        const acciones = regla.acciones || (regla.accion ? [regla.accion] : []);
        const ok = await this._ejecutarAcciones(acciones, sensores);
        this._guardarEstado(regla.id, Date.now());
        this._registrarEjecucion(regla, ok);
        console.log('[Autónomo] ✅ Regla disparada:', regla.id, `(${acciones.length} acción/es)`);
        this.renderPanel();
      }
    }catch(e){ console.error('[Autónomo] Error en tick:', e.message); }
  },

  /* Ejecuta acciones en secuencia (para esperar entre ellas) */
  async _ejecutarAcciones(acciones, sensores){
    if (!acciones || !acciones.length) return false;
    let okGlobal = true;
    for (const a of acciones){
      const ok = await this.efector.ejecutar(a, sensores);
      if (ok === false) okGlobal = false;
    }
    return okGlobal;
  },

  /* ---------------- Init ---------------- */
  async init(){
    this.cargarCola();
    this._cargarEstados();
    this._cargarToggles();
    this._cargarHistorial();
    this._cargarReglasCustom();
    this._cargarLugares();
    this._reconstruirReglas();
    this.activo = store.get('autonomo_activo', true);
    console.log('🌙 Autónomo iniciado · reglas:', this.reglas.length, '· activo:', this.activo);

    await Promise.all([ this._leerBateria(), this._leerUbicacion(), this._leerClima() ]);

    // ⭐ Suscribirse a push (pide permiso si hace falta)
    if (typeof Notification !== 'undefined'){
      if (Notification.permission === 'granted'){
        this.suscribirPush().catch(()=>{});
      } else if (Notification.permission === 'default'){
        // Pedir permiso UNA vez, y si lo concede, suscribir
        Notification.requestPermission().then(p => {
          if (p === 'granted') this.suscribirPush().catch(()=>{});
        });
      }
    }

    setTimeout(() => this.tick('boot'), 15000);
    if (this.ciclo) clearInterval(this.ciclo);
    this.ciclo = setInterval(() => this.tick('timer'), this.INTERVALO_MS);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.tick('visibilidad'); });
    window.addEventListener('online', () => this.tick('online'));
  },
   
  desactivar(){ this.activo = false; store.set('autonomo_activo', false); if (this.ciclo) clearInterval(this.ciclo); console.log('[Autónomo] ⏸ Desactivado'); this.renderPanel(); },
  reactivar(){ this.activo = true; store.set('autonomo_activo', true); this.init(); console.log('[Autónomo] ▶️ Reactivado'); this.renderPanel(); },
  trigger(tipo){
    console.log('[Autónomo] 🌙 SW trigger:', tipo);
    if (tipo === 'autonomo') return this.tick('sw-periodic');
    if (tipo === 'sync-cola') return this.tick('sw-sync-cola');
    if (tipo === 'sync-tareas') return this.tick('sw-sync-tareas');
    return this.tick('sw-' + tipo);
  },
  info(){
    return {
      activo: this.activo, reglas: this.reglas.length,
      reglasActivas: this.reglas.filter(r => this.reglaActiva(r.id)).length,
      reglasCustom: this.reglasCustom.length, cola: this.cola.length,
      ultimoCiclo: this.ultimoCiclo ? new Date(this.ultimoCiclo).toLocaleString('es-ES') : 'nunca',
      ejecuciones: this.historial.length
    };
  },

async suscribirPush(){
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('[Push] No soportado');
    return false;
  }
  try {
    const r = await fetch(CONFIG.ANIA_API + '/ania/push/vapid-public-key');
    if (!r.ok) { console.warn('[Push] Servidor no configurado'); return false; }
    const { publicKey } = await r.json();
    
    const keyBytes = Uint8Array.from(atob(publicKey.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0));
    
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes
    });
    
    await fetch(CONFIG.ANIA_API + '/ania/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (AniaAPI.token || '')
      },
      body: JSON.stringify({
        ...sub.toJSON(),
        deviceId: typeof DEVICE_ID !== 'undefined' ? DEVICE_ID : 'unknown'
      })
    });
    
    console.log('🔔 Push suscrito');
    return true;
  } catch(e) {
    console.warn('[Push] Error:', e.message);
    return false;
  }
},

async sincronizarReglas(){
  if (!window.SyncGitHub || !SyncGitHub.configurado()){
    if (typeof toast === 'function') toast('Configura el token GitHub en Ajustes', true);
    return;
  }
  const locales = this.reglasCustom.map(r => ({
    id: r.id, descripcion: r.descripcion,
    cuandoStr: r._cuandoStr, accionesRaw: r._accionesRaw,
    minIntervalo: r.minIntervalo, t: r.t
  }));
  const merge = await SyncGitHub.sincronizar(locales);
  if (merge){
    this.reglasCustom = merge.map(r => this._rehidratarRegla(r)).filter(Boolean);
    this._guardarReglasCustom();
    this._reconstruirReglas();
    this.renderPanel();
    if (typeof toast === 'function') toast('🔄 Reglas sincronizadas: ' + merge.length);
  } else {
    if (typeof toast === 'function') toast('Error al sincronizar', true);
  }
},
   
  async forzarTick(){ console.log('[Autónomo] Forzando tick manual...'); this.ultimoCiclo = 0; await this.tick('manual'); },

  /* ---------------- EJECUTAR PRESET ---------------- */
  async ejecutarPreset(id){
    const p = this.PRESETS.find(x => x.id === id);
    if (!p) return false;
    console.log('[Autónomo] 🎬 Ejecutando preset:', p.nombre);
    await Promise.all([ this._leerBateria(), this._leerUbicacion(), this._leerClima() ]);
    const sensores = this.sensor.leer();
    await this._ejecutarAcciones(p.acciones, sensores);
    if (typeof toast === 'function') toast('🎬 ' + p.nombre);
    return true;
  },
  instalarPreset(id){
    const p = this.PRESETS.find(x => x.id === id);
    if (!p) return false;
    if (p.disparador === 'manual') return this.ejecutarPreset(id);

    // Crear regla custom desde el preset programado
    const accionesRaw = p.acciones.map(a => {
      const out = { tipo: a.tipo };
      if (a.titulo) out.titulo = a.titulo;
      if (a.cuerpo) out.cuerpoStr = `(s) => ${JSON.stringify(a.cuerpo)}`;
      if (a.cuerpoStr) out.cuerpoStr = a.cuerpoStr;
      if (a.texto) out.textoStr = `(s) => ${JSON.stringify(a.texto)}`;
      if (a.que) out.extra = { que: a.que };
      if (a.ms) out.extra = { ms: a.ms };
      if (a.freq) out.extra = { freq: a.freq, dur: a.dur };
      return out;
    });

    const raw = {
      id: 'custom-' + Date.now().toString(36),
      descripcion: p.nombre + ' — ' + p.descripcion,
      cuandoStr: p.cuandoStr,
      accionesRaw,
      minIntervalo: p.minIntervalo,
      t: Date.now()
    };
    const regla = this._rehidratarRegla(raw);
    if (!regla) return false;
    this.agregarReglaCustom(regla);
    if (typeof toast === 'function') toast('📦 Preset instalado: ' + p.nombre);
    return true;
  },

  /* ============================================================
     UI
  ============================================================ */
  _formState: {
    dia: 'daily', hora: 9, minuto: 0,
    acciones: [{ tipo: 'notificar', texto: '' }]  // array
  },

  PLANTILLAS: [
    { icon: '☕', nombre: 'Café matutino', dia: 'daily', hora: 10, minuto: 0, tipo: 'mensaje', texto: 'Pausa de café, orden ejecutiva.' },
    { icon: '💧', nombre: 'Beber agua', dia: 'daily', hora: 15, minuto: 0, tipo: 'notificar', texto: 'Un vaso de agua no viene mal.' },
    { icon: '🌙', nombre: 'Cierre del día', dia: 'daily', hora: 22, minuto: 30, tipo: 'mensaje', texto: 'Cierre del día. Revisa pendientes y descansa.' },
    { icon: '📋', nombre: 'Revisar tareas', dia: 'weekday', hora: 9, minuto: 0, tipo: 'notificar', texto: 'Revisa tus tareas del día.' },
    { icon: '🎵', nombre: 'Pausa musical', dia: 'daily', hora: 16, minuto: 30, tipo: 'musica', texto: '' },
    { icon: '📚', nombre: 'Leer 30 min', dia: 'daily', hora: 21, minuto: 0, tipo: 'notificar', texto: 'Hora de leer 30 minutos.' },
    { icon: '🔋', nombre: 'Cargar móvil', dia: 'daily', hora: 22, minuto: 0, tipo: 'notificar', texto: 'Pon el móvil a cargar antes de dormir.' },
    { icon: '☔', nombre: 'Paraguas', dia: 'weekday', hora: 7, minuto: 30, tipo: 'notificar', texto: 'Si va a llover, coge el paraguas.' },
    { icon: '🧘', nombre: 'Pausa mental', dia: 'daily', hora: 14, minuto: 0, tipo: 'notificar', texto: '5 minutos de respiración y vuelta al ruedo.' }
  ],

  renderPanel(){
    const cont = document.getElementById('panelAutonomo');
    if (!cont) return;
    const info = this.info();
    const ahora = Date.now();
    const bat = this._bateria, ubi = this._ubicacion, cli = this._clima;

    const sensorBat = bat.nivel !== null ? `${Math.round(bat.nivel*100)}%${bat.cargando ? '⚡' : ''}` : '—';
    const sensorUbi = ubi.lugar || (ubi.lat ? 'activo' : '—');
    const sensorCli = cli.temp !== null ? `${cli.temp}°${cli.llueve ? ' ☔' : ''}` : '—';

    const reglasHTML = this.reglas.map(r => {
      const activa = this.reglaActiva(r.id);
      const ult = this.estados[r.id];
      const hace = ult ? this._tiempoRel(ahora - ult) : 'nunca';
      const esCustom = r._custom ? '<span class="aut-star">★</span>' : '';
      const btnDel = r._custom ? `<button class="aut-del" data-del="${esc(r.id)}" title="Eliminar">✕</button>` : '';
      const nAcc = (r.acciones ? r.acciones.length : 1);
      const accLabel = nAcc > 1 ? `${nAcc} acciones` : (r.accion?.tipo || '—');
      return `
        <div class="aut-regla ${activa ? '' : 'off'}">
          <div class="aut-regla-head">
            <span class="aut-regla-id">${esc(r.id)}${esCustom}${btnDel}</span>
            <button class="aut-toggle ${activa ? 'on' : 'off'}" data-regla="${esc(r.id)}">
              ${activa ? '● ACTIVA' : '○ PAUSADA'}
            </button>
          </div>
          <div class="aut-regla-desc">${esc(r.descripcion || '')}</div>
          <div class="aut-regla-meta">
            <span>Acción: ${esc(accLabel)}</span>
            <span>Última: ${hace}</span>
          </div>
        </div>`;
    }).join('');

    const histHTML = this.historial.slice(0, 8).map(h => {
      const cuando = this._tiempoRel(ahora - h.t);
      return `<div class="aut-hist-item ${h.ok ? 'ok' : 'fail'}">
        <span class="aut-hist-hora">${cuando}</span>
        <span class="aut-hist-desc">${esc(h.desc)}</span>
        <span class="aut-hist-tipo">${esc(h.tipo)}</span>
      </div>`;
    }).join('') || '<div class="empty" style="padding:14px 0;">Sin ejecuciones registradas</div>';

    const plantillasHTML = this.PLANTILLAS.map((p, i) => `
      <button class="aut-plant" data-plant="${i}">
        <span class="aut-plant-icon">${p.icon}</span>
        <span class="aut-plant-name">${esc(p.nombre)}</span>
      </button>`).join('');

    const presetsHTML = this.PRESETS.map((p, i) => `
      <button class="aut-preset" data-preset="${i}">
        <span class="aut-preset-icon">${p.icon}</span>
        <div class="aut-preset-info">
          <div class="aut-preset-name">${esc(p.nombre)}</div>
          <div class="aut-preset-desc">${esc(p.descripcion)}</div>
        </div>
        <span class="aut-preset-badge">${p.disparador === 'manual' ? '▶' : '⏰'}</span>
      </button>`).join('');

    const formHTML = this.formVisible ? this._renderForm() : '';

    const lugaresHTML = this._lugares.length
      ? this._lugares.map(l => `<div class="aut-lugar">
          <span>📍 <b>${esc(l.nombre)}</b></span>
          <span class="aut-lugar-radio">${l.radio}m</span>
          <button class="aut-del" data-del-lugar="${esc(l.nombre)}">✕</button>
        </div>`).join('')
      : '<div class="empty" style="padding:10px 0;font-size:10px;">Sin lugares guardados</div>';

    cont.innerHTML = `
      <div class="aut-stats">
        <div class="aut-stat"><div class="aut-stat-num">${info.activo ? '🟢' : '⏸'}</div><div class="aut-stat-lbl">${info.activo ? 'Activo' : 'Pausado'}</div></div>
        <div class="aut-stat"><div class="aut-stat-num">${info.reglasActivas}/${info.reglas}</div><div class="aut-stat-lbl">Reglas</div></div>
        <div class="aut-stat"><div class="aut-stat-num">${info.ejecuciones}</div><div class="aut-stat-lbl">Ejecuciones</div></div>
        <div class="aut-stat"><div class="aut-stat-num" style="font-size:11px;line-height:1.3;">${info.ultimoCiclo.split(' ')[1] || '—'}</div><div class="aut-stat-lbl">Últ. tick</div></div>
      </div>

      <div class="aut-actions">
        <button class="aut-btn" id="autToggle">${info.activo ? '⏸ PAUSAR' : '▶ REANUDAR'}</button>
        <button class="aut-btn" id="autTick">🔄 FORZAR TICK</button>
        <button class="aut-btn" id="autLimpiar">🗑 LIMPIAR HIST.</button>
        <button class="aut-btn" id="autSyncGitHub" title="Sincronizar con GitHub">☁️ SYNC GITHUB</button>
      </div>

      <div class="aut-section-title">Sensores en vivo</div>
      <div class="aut-sensores">
        <div class="aut-sensor"><div class="aut-sensor-num">${sensorBat}</div><div class="aut-sensor-lbl">🔋 Batería</div></div>
        <div class="aut-sensor"><div class="aut-sensor-num">${sensorUbi}</div><div class="aut-sensor-lbl">📍 Ubicación</div></div>
        <div class="aut-sensor"><div class="aut-sensor-num">${sensorCli}</div><div class="aut-sensor-lbl">🌤️ Clima</div></div>
      </div>

      <div class="aut-section-title">Lugares guardados</div>
      <div class="aut-lugares">${lugaresHTML}</div>
      <div class="aut-lugar-actions">
        <input type="text" id="autLugarNombre" placeholder="Nombre (casa, trabajo...)" maxlength="20">
        <button class="aut-btn" id="autLugarGuardar" style="flex:0 0 auto;">📍 GUARDAR AQUÍ</button>
      </div>

      <div class="aut-section-title">Presets avanzados</div>
      <div class="aut-presets">${presetsHTML}</div>

      <div class="aut-section-title">Plantillas rápidas</div>
      <div class="aut-plantillas">${plantillasHTML}</div>

      <div class="aut-section-title">
        <span>Reglas (${info.reglasCustom} personalizadas)</span>
        <button class="aut-btn-new" id="autNewRegla">+ NUEVA REGLA</button>
      </div>
      ${formHTML}
      <div class="aut-reglas">${reglasHTML}</div>

      <div class="aut-section-title">Últimas ejecuciones</div>
      <div class="aut-hist">${histHTML}</div>
    `;

    this._bindPanelHandlers();
  },

  _renderForm(){
    const s = this._formState;
    const dias = [
      ['daily', 'Todos los días'], ['weekday', 'Laborables'], ['weekend', 'Fines de semana'],
      [1, 'Lunes'], [2, 'Martes'], [3, 'Miércoles'], [4, 'Jueves'], [5, 'Viernes'], [6, 'Sábados'], [0, 'Domingos']
    ];
    const opcionesDias = dias.map(([v, l]) => `<option value="${v}" ${s.dia == v ? 'selected' : ''}>${l}</option>`).join('');

    // Renderizar acciones
    const accionesHTML = s.acciones.map((acc, i) => this._renderAccion(acc, i)).join('');

    return `
      <div class="aut-form">
        <div class="aut-form-row">
          <label>Día</label>
          <select id="autFormDia">${opcionesDias}</select>
        </div>
        <div class="aut-form-row">
          <label>Hora</label>
          <div class="aut-form-hora">
            <input type="number" id="autFormHora" min="0" max="23" value="${s.hora}">
            <span>:</span>
            <input type="number" id="autFormMin" min="0" max="59" value="${String(s.minuto).padStart(2,'0')}">
          </div>
        </div>

        <div class="aut-form-acciones-label">
          Acciones (${s.acciones.length})
          <button class="aut-btn-mini" id="autAddAccion">+ AÑADIR ACCIÓN</button>
        </div>
        <div class="aut-acciones">${accionesHTML}</div>

        <div class="aut-form-buttons">
          <button class="aut-btn" id="autFormCancel">CANCELAR</button>
          <button class="aut-btn aut-btn-primary" id="autFormSave">GUARDAR REGLA</button>
        </div>
      </div>
    `;
  },

  _renderAccion(acc, i){
    const tipos = [
      ['notificar', '📬 Notificación'],
      ['mensaje', '💬 Mensaje'],
      ['musica', '🎵 Música'],
      ['sonido', '🔔 Sonido'],
      ['esperar', '⏱️ Esperar'],
      ['abrirUrl', '🌐 URL'],
      ['ejecutarTool', '🛠 Herramienta']
    ];
    const optsTipos = tipos.map(([v, l]) => `<option value="${v}" ${acc.tipo === v ? 'selected' : ''}>${l}</option>`).join('');

    let extra = '';
    if (acc.tipo === 'notificar' || acc.tipo === 'mensaje'){
      extra = `<input type="text" class="aut-accion-input" data-idx="${i}" data-field="texto" placeholder="Texto" value="${esc(acc.texto || '')}" maxlength="160">`;
    } else if (acc.tipo === 'musica'){
      const opciones = ['musica','lluvia','cafeteria','parar'];
      extra = `<select class="aut-accion-input" data-idx="${i}" data-field="que">${opciones.map(o => `<option value="${o}" ${acc.que === o ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
    } else if (acc.tipo === 'esperar'){
      extra = `<input type="number" class="aut-accion-input" data-idx="${i}" data-field="ms" placeholder="ms" value="${acc.ms || 1000}" min="100" max="30000">`;
    } else if (acc.tipo === 'abrirUrl'){
      extra = `<input type="url" class="aut-accion-input" data-idx="${i}" data-field="url" placeholder="https://..." value="${esc(acc.url || '')}">`;
    } else if (acc.tipo === 'ejecutarTool'){
      extra = `<select class="aut-accion-input" data-idx="${i}" data-field="tool">
        <option value="hora">Hora</option><option value="clima">Clima</option>
        <option value="luna">Luna</option><option value="misTareas">Tareas</option>
      </select>`;
    } else {
      extra = `<input type="text" class="aut-accion-input" data-idx="${i}" data-field="texto" placeholder="(opcional)" value="${esc(acc.texto || '')}">`;
    }

    return `
      <div class="aut-accion" data-accion="${i}">
        <div class="aut-accion-head">
          <span class="aut-accion-num">${i+1}</span>
          <select class="aut-accion-tipo" data-idx="${i}">${optsTipos}</select>
          ${this._formState.acciones.length > 1 ? `<button class="aut-del" data-del-accion="${i}" title="Quitar">✕</button>` : ''}
        </div>
        ${extra}
      </div>
    `;
  },

  _bindPanelHandlers(){
    const cont = document.getElementById('panelAutonomo');
    if (!cont) return;

    const btnToggle = document.getElementById('autToggle');
    if (btnToggle) btnToggle.onclick = () => { this.activo ? this.desactivar() : this.reactivar(); };
    const btnTick = document.getElementById('autTick');
    if (btnTick) btnTick.onclick = () => this.forzarTick();
    const btnSyncGH = document.getElementById('autSyncGitHub');
    if (btnSyncGH) btnSyncGH.onclick = () => this.sincronizarReglas();
    const btnLimpiar = document.getElementById('autLimpiar');
    if (btnLimpiar) btnLimpiar.onclick = () => { this.historial = []; store.set('autonomo_historial', []); this.renderPanel(); toast('Historial limpiado'); };
    const btnNew = document.getElementById('autNewRegla');
    if (btnNew) btnNew.onclick = () => {
      this.formVisible = !this.formVisible;
      if (this.formVisible) this._formState.acciones = [{ tipo: 'notificar', texto: '' }];
      this.renderPanel();
    };

    const btnLugarGuardar = document.getElementById('autLugarGuardar');
    if (btnLugarGuardar){
      btnLugarGuardar.onclick = async () => {
        const inp = document.getElementById('autLugarNombre');
        const nombre = (inp && inp.value.trim()) || '';
        if (!nombre){ toast('Escribe un nombre', true); return; }
        await this._leerUbicacion();
        if (!this._ubicacion.lat){ toast('Sin ubicación. Activa el GPS.', true); return; }
        this.guardarLugarActual(nombre, 200);
        if (inp) inp.value = '';
        this.renderPanel();
        toast('📍 Guardado: ' + nombre);
      };
    }

    cont.querySelectorAll('[data-regla]').forEach(b => b.onclick = () => this.toggleRegla(b.dataset.regla));
    cont.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      if (confirm('¿Eliminar esta regla?')) this.eliminarReglaCustom(b.dataset.del);
    });
    cont.querySelectorAll('[data-del-lugar]').forEach(b => b.onclick = () => {
      if (confirm('¿Eliminar este lugar?')){ this.eliminarLugar(b.dataset.delLugar); this.renderPanel(); }
    });
    cont.querySelectorAll('[data-plant]').forEach(b => b.onclick = () => {
      const p = this.PLANTILLAS[parseInt(b.dataset.plant)];
      if (p) this._aplicarPlantilla(p);
    });
    cont.querySelectorAll('[data-preset]').forEach(b => b.onclick = () => {
      const p = this.PRESETS[parseInt(b.dataset.preset)];
      if (!p) return;
      if (p.disparador === 'manual'){
        this.ejecutarPreset(p.id);
      } else {
        if (confirm(`Instalar preset programado "${p.nombre}"?`)) this.instalarPreset(p.id);
      }
    });

    if (this.formVisible) this._bindFormHandlers();
  },

  _bindFormHandlers(){
    const dia = document.getElementById('autFormDia');
    const hora = document.getElementById('autFormHora');
    const min = document.getElementById('autFormMin');
    const cancel = document.getElementById('autFormCancel');
    const save = document.getElementById('autFormSave');
    const addAcc = document.getElementById('autAddAccion');

    const syncSimple = () => {
      if (dia) this._formState.dia = (dia.value === 'daily' || dia.value === 'weekday' || dia.value === 'weekend') ? dia.value : parseInt(dia.value);
      if (hora) this._formState.hora = parseInt(hora.value) || 0;
      if (min) this._formState.minuto = parseInt(min.value) || 0;
    };

    // Cambios de tipo de acción (cada uno distinto)
    document.querySelectorAll('.aut-accion-tipo').forEach(sel => {
      sel.onchange = () => {
        const idx = parseInt(sel.dataset.idx);
        syncSimple();
        this._formState.acciones[idx].tipo = sel.value;
        this.renderPanel();
      };
    });

    // Inputs de detalle
    document.querySelectorAll('.aut-accion-input').forEach(inp => {
      inp.oninput = inp.onchange = () => {
        const idx = parseInt(inp.dataset.idx);
        const field = inp.dataset.field;
        this._formState.acciones[idx][field] = inp.value;
      };
    });

    // Eliminar acción
    document.querySelectorAll('[data-del-accion]').forEach(b => {
      b.onclick = () => {
        syncSimple();
        const idx = parseInt(b.dataset.delAccion);
        this._formState.acciones.splice(idx, 1);
        this.renderPanel();
      };
    });

    if (addAcc) addAcc.onclick = () => {
      syncSimple();
      this._formState.acciones.push({ tipo: 'notificar', texto: '' });
      this.renderPanel();
    };

    if (cancel) cancel.onclick = () => { this.formVisible = false; this.renderPanel(); };
    if (save) save.onclick = () => { syncSimple(); this._guardarDesdeForm(); };
  },

  _aplicarPlantilla(p){
    this._formState = {
      dia: p.dia, hora: p.hora, minuto: p.minuto,
      acciones: [{ tipo: p.tipo, texto: p.texto || '' }]
    };
    this.formVisible = true;
    this.renderPanel();
    toast('Plantilla cargada: ' + p.nombre);
  },

  _guardarDesdeForm(){
    const s = this._formState;
    if (s.hora < 0 || s.hora > 23) return alert('Hora inválida');
    if (s.minuto < 0 || s.minuto > 59) return alert('Minuto inválido');
    if (!s.acciones.length) return alert('Añade al menos una acción');

    let cuandoStr;
    const h = s.hora, m = s.minuto;
    if (s.dia === 'daily') cuandoStr = `(s) => s.horaNum === ${h} && s.minuto >= ${m} && s.minuto < ${m + 5}`;
    else if (s.dia === 'weekend') cuandoStr = `(s) => (s.diaSemana === 0 || s.diaSemana === 6) && s.horaNum === ${h} && s.minuto >= ${m} && s.minuto < ${m + 5}`;
    else if (s.dia === 'weekday') cuandoStr = `(s) => s.diaSemana >= 1 && s.diaSemana <= 5 && s.horaNum === ${h} && s.minuto >= ${m} && s.minuto < ${m + 5}`;
    else cuandoStr = `(s) => s.diaSemana === ${s.dia} && s.horaNum === ${h} && s.minuto >= ${m} && s.minuto < ${m + 5}`;

    // Serializar acciones
    const accionesRaw = s.acciones.map(acc => {
      const out = { tipo: acc.tipo };
      if (acc.tipo === 'notificar'){
        out.titulo = 'ANIA · Recordatorio';
        out.cuerpoStr = `(s) => ${JSON.stringify(acc.texto || '')}`;
      } else if (acc.tipo === 'mensaje'){
        out.textoStr = `(s) => ${JSON.stringify(acc.texto || '')}`;
      } else if (acc.tipo === 'musica'){
        out.extra = { que: acc.que || 'musica' };
      } else if (acc.tipo === 'sonido'){
        out.extra = { freq: 880, dur: 0.2 };
      } else if (acc.tipo === 'esperar'){
        out.extra = { ms: parseInt(acc.ms) || 1000 };
      } else if (acc.tipo === 'abrirUrl'){
        out.extra = { url: acc.url || '' };
      } else if (acc.tipo === 'ejecutarTool'){
        out.extra = { tool: acc.tool || 'hora', args: {} };
      }
      return out;
    });

    const diasNombre = { 'daily': 'todos los días', 'weekend': 'fines de semana', 'weekday': 'laborables', 0: 'domingos', 1: 'lunes', 2: 'martes', 3: 'miércoles', 4: 'jueves', 5: 'viernes', 6: 'sábados' };
    const diaStr = diasNombre[s.dia] || 'todos los días';
    const horaFmt = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    const resumen = s.acciones.map(a => a.texto || a.tipo).join(' + ').slice(0, 60);
    const descripcion = `${resumen} (${diaStr} a las ${horaFmt})`;

    const raw = {
      id: 'custom-' + Date.now().toString(36),
      descripcion, cuandoStr,
      accionesRaw,
      minIntervalo: 20 * 60 * 60 * 1000,
      t: Date.now()
    };

    const regla = this._rehidratarRegla(raw);
    if (!regla) return alert('Error al crear');

    this.agregarReglaCustom(regla);
    this.formVisible = false;
    this._formState = { dia: 'daily', hora: 9, minuto: 0, acciones: [{ tipo: 'notificar', texto: '' }] };
    toast('Regla creada');
  },

  _tiempoRel(ms){
    if (ms < 60e3) return 'hace ' + Math.round(ms/1000) + 's';
    if (ms < 3600e3) return 'hace ' + Math.round(ms/60e3) + 'min';
    if (ms < 86400e3) return 'hace ' + Math.round(ms/3600e3) + 'h';
    return 'hace ' + Math.round(ms/86400e3) + 'd';
  }
};

window.Autonomo = Autonomo;
