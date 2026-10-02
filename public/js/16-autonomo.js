/* ============================================================
   16-AUTONOMO · Núcleo autónomo de ANIA
   v5 · + sensores avanzados: batería, ubicación, clima
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
      tipo: regla.accion.tipo, t: Date.now(), ok: resultado !== false
    });
    if (this.historial.length > this.MAX_HISTORIAL) this.historial.length = this.MAX_HISTORIAL;
    try { store.set('autonomo_historial', this.historial); }catch(e){}
  },

  /* ============================================================
     SENSORES AVANZADOS
     Cada sensor cachea su valor y se actualiza periódicamente.
  ============================================================ */

  /* Sensor de batería (nativo) */
  _bateria: { nivel: null, cargando: null, t: 0 },
  async _leerBateria(){
    try {
      if (navigator.getBattery){
        const b = await navigator.getBattery();
        this._bateria = {
          nivel: b.level,
          cargando: b.charging,
          t: Date.now()
        };
        // Suscribir a cambios futuros si aún no lo hemos hecho
        if (!this._bateriaSuscrito){
          this._bateriaSuscrito = true;
          b.addEventListener('levelchange', () => {
            this._bateria.nivel = b.level;
            this._bateria.t = Date.now();
          });
          b.addEventListener('chargingchange', () => {
            this._bateria.cargando = b.charging;
            this._bateria.t = Date.now();
          });
        }
      }
    } catch(e) {}
    return this._bateria;
  },

  /* Sensor de ubicación (geolocalización + lugares guardados) */
  _ubicacion: { lat: null, lon: null, lugar: null, t: 0 },
  _lugares: [],  // [{ nombre: 'casa', lat, lon, radio: 200 }]

  async _leerUbicacion(){
    // Cachear por 5 min
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

      // Detectar si estamos en un lugar guardado
      let lugar = null;
      for (const l of this._lugares){
        const d = this._distancia(lat, lon, l.lat, l.lon);
        if (d < (l.radio || 200)){
          lugar = l.nombre;
          break;
        }
      }

      this._ubicacion = { lat, lon, lugar, t: Date.now() };
    } catch(e){ /* sin permiso o sin señal */ }
    return this._ubicacion;
  },

  _distancia(lat1, lon1, lat2, lon2){
    // Haversine simplificado en metros
    const R = 6371000;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ/2)**2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  },

  /* Sensor de clima (con caché) */
  _clima: { llueve: false, temp: null, codigo: null, t: 0 },
  async _leerClima(){
    if (Date.now() - this._clima.t < 20 * 60 * 1000 && this._clima.t > 0){
      return this._clima;
    }
    try {
      if (typeof geoCache !== 'function' || typeof getWeather !== 'function') return this._clima;
      const g = geoCache();
      if (!g) return this._clima;
      const d = await getWeather(g);
      const code = d.current.weather_code;
      this._clima = {
        llueve: code >= 51 && code <= 82,
        temp: Math.round(d.current.temperature_2m),
        codigo: code,
        t: Date.now()
      };
    } catch(e){}
    return this._clima;
  },

  /* Sensor de ubicación del sol (aproximado) */
  _leerSol(){
    const ahora = new Date();
    const hora = ahora.getHours();
    return {
      esDeDia: hora >= 6 && hora < 20,
      esNoche: hora >= 20 || hora < 6,
      esAmanecer: hora >= 6 && hora < 8,
      esAtardecer: hora >= 19 && hora < 21
    };
  },

  /* ---------------- SENSOR PRINCIPAL ---------------- */
  sensor: {
    leer(){
      const ahora = new Date();
      const sol = Autonomo._leerSol();
      return {
        // Tiempo
        hora: ahora, horaNum: ahora.getHours(), minuto: ahora.getMinutes(),
        diaSemana: ahora.getDay(), fecha: ahora.toDateString(),
        // Red y visibilidad
        online: navigator.onLine, visible: !document.hidden,
        // Usuario y estado
        usuario: (typeof Mind !== 'undefined' && Mind.nombre()) || null,
        colaOffline: (typeof OfflineQueue !== 'undefined' && OfflineQueue.count()) || 0,
        tareasPendientes: (typeof tasks !== 'undefined' && Array.isArray(tasks))
          ? tasks.filter(t => !t.done).length : 0,
        tareasVencidas: (typeof tasks !== 'undefined' && Array.isArray(tasks))
          ? tasks.filter(t => !t.done && t.when && t.when < Date.now()).length : 0,
        sesionActiva: (typeof Session !== 'undefined' && !!Session),
        cerebroListo: (typeof Brain !== 'undefined' && Brain.localReady),
        // ⭐ NUEVOS · sensores avanzados
        bateria: Autonomo._bateria,
        ubicacion: Autonomo._ubicacion,
        clima: Autonomo._clima,
        sol
      };
    }
  },

  /* ---------------- REGLAS BUILT-IN ---------------- */
  reglas: [
    {
      id: 'buenos-dias',
      descripcion: 'Saluda al usuario entre 7:00 y 9:00',
      cuando: (s) => s.horaNum >= 7 && s.horaNum < 9 && s.visible && s.sesionActiva,
      accion: {
        tipo: 'notificar', titulo: 'ANIA · Buenos días',
        cuerpo: (s) => {
          const nombre = Mind.nombre() ? ', ' + Mind.nombre() : '';
          const tareas = s.tareasPendientes;
          const clima = s.clima.temp !== null ? ` · ${s.clima.temp}°C` : '';
          const lluvia = s.clima.llueve ? ' · llueve, paraguas' : '';
          return `Buenos días${nombre}${clima}${lluvia}. ${tareas > 0 ? 'Tienes ' + tareas + ' pendientes.' : 'Agenda libre.'}`;
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
        tipo: 'notificar', titulo: 'ANIA · Tareas vencidas',
        cuerpo: (s) => `Tienes ${s.tareasVencidas} tarea(s) vencida(s). Di «mis tareas» para verlas.`
      },
      minIntervalo: 4 * 60 * 60 * 1000
    },
    {
      id: 'cafe-manana',
      descripcion: 'Preguntar por el café a las 10 AM',
      cuando: (s) => s.horaNum === 10 && s.diaSemana !== 0 && s.visible && s.sesionActiva,
      accion: { tipo: 'mensaje', texto: () => pick([
        '¿Ya tomaste café? Es la hora perfecta para el primero bueno.',
        'Diez de la mañana: pausa de café, orden ejecutiva.',
        'Mi termómetro interno dice que toca un café.']) },
      minIntervalo: 20 * 60 * 60 * 1000
    },
    {
      id: 'cierre-dia',
      descripcion: 'Resumen suave antes de dormir (22:30-23:59)',
      cuando: (s) => (s.horaNum === 22 && s.minuto >= 30) || s.horaNum === 23,
      accion: {
        tipo: 'notificar', titulo: 'ANIA · Cierre del día',
        cuerpo: (s) => s.tareasPendientes > 0
          ? `Quedan ${s.tareasPendientes} pendientes para mañana. Descansa bien.`
          : 'Día cerrado. Mañana seguimos.'
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
      accion: { tipo: 'mensaje', texto: () => pick([
        'Silencio prolongado... ¿todo bien por ahí?',
        'Hace rato que no hablamos. Aquí sigo, por si acaso.',
        '¿Pausa larga o te perdí de vista?']) },
      minIntervalo: 6 * 3600 * 1000
    },
    /* ⭐ NUEVAS REGLAS con sensores avanzados */
    {
      id: 'bateria-baja',
      descripcion: 'Avisar si la batería baja de 20% sin cargar',
      cuando: (s) => s.bateria.nivel !== null && s.bateria.nivel < 0.2 && !s.bateria.cargando,
      accion: {
        tipo: 'notificar', titulo: 'ANIA · Batería baja',
        cuerpo: (s) => `Batería al ${Math.round(s.bateria.nivel*100)}%. Conéctame antes de que me despida.`
      },
      minIntervalo: 30 * 60 * 1000
    },
    {
      id: 'bateria-cargando',
      descripcion: 'Confirmar cuando se empieza a cargar',
      cuando: (s) => s.bateria.cargando === true && s.bateria.nivel !== null && s.bateria.nivel < 0.5,
      accion: {
        tipo: 'mensaje',
        texto: (s) => `Bien, cargando al ${Math.round(s.bateria.nivel*100)}%. Gracias.`
      },
      minIntervalo: 2 * 60 * 60 * 1000
    },
    {
      id: 'aviso-lluvia',
      descripcion: 'Avisar si llueve y no lo hemos hecho hoy',
      cuando: (s) => s.clima.llueve === true && s.visible && s.horaNum >= 7 && s.horaNum < 22,
      accion: {
        tipo: 'notificar', titulo: 'ANIA · Llueve',
        cuerpo: () => 'Está lloviendo afuera. Paraguas y abrigo.'
      },
      minIntervalo: 6 * 60 * 60 * 1000
    },
    {
      id: 'llegada-casa',
      descripcion: 'Saludo al llegar a casa',
      cuando: (s) => s.ubicacion.lugar === 'casa' && s.sesionActiva && s.visible,
      accion: {
        tipo: 'mensaje',
        texto: () => pick([
          'Bienvenido a casa. ¿Cómo estuvo el día?',
          'En casa otra vez. El café está listo imaginariamente.',
          'Llegaste. Descansa un poco.'
        ])
      },
      minIntervalo: 4 * 60 * 60 * 1000
    },
    {
      id: 'salida-casa',
      descripcion: 'Recordatorio al salir de casa',
      cuando: (s) => s.ubicacion.lugar !== 'casa' && s.ubicacion.lat !== null && s.sesionActiva && s.visible,
      accion: {
        tipo: 'notificar', titulo: 'ANIA · Saliendo',
        cuerpo: () => '¿Llevas todo? Llaves, móvil, cartera.'
      },
      minIntervalo: 4 * 60 * 60 * 1000
    }
  ],

  /* ---------------- Reglas custom persistentes ---------------- */
  reglasCustom: [],
  _reglasBuiltIn: [],

  _cargarReglasCustom(){
    try { this.reglasCustom = store.get('autonomo_reglas_custom', []); }catch(e){ this.reglasCustom = []; }
    this.reglasCustom = this.reglasCustom.map(r => this._rehidratarRegla(r)).filter(Boolean);
  },
  _guardarReglasCustom(){
    const s = this.reglasCustom.filter(Boolean).map(r => ({
      id: r.id, descripcion: r.descripcion, cuandoStr: r._cuandoStr,
      accionTipo: r.accion.tipo, accionTitulo: r.accion.titulo,
      accionCuerpoStr: r._cuerpoStr, accionTextoStr: r._textoStr,
      accionExtra: r._accionExtra || null,
      minIntervalo: r.minIntervalo || 0, t: r.t || Date.now()
    }));
    try { store.set('autonomo_reglas_custom', s); }catch(e){}
  },
  _rehidratarRegla(r){
    try {
      const cuando = new Function('s', 'return (' + r.cuandoStr + ')(s)');
      const accion = { tipo: r.accionTipo };
      if (r.accionTitulo) accion.titulo = r.accionTitulo;
      if (r.accionCuerpoStr) accion.cuerpo = new Function('s', 'return (' + r.accionCuerpoStr + ')(s)');
      if (r.accionTextoStr) accion.texto = new Function('s', 'return (' + r.accionTextoStr + ')(s)');
      if (r.accionExtra) Object.assign(accion, r.accionExtra);
      return {
        id: r.id, descripcion: r.descripcion, cuando, accion,
        minIntervalo: r.minIntervalo || 0,
        _cuandoStr: r.cuandoStr, _cuerpoStr: r.accionCuerpoStr,
        _textoStr: r.accionTextoStr, _accionExtra: r.accionExtra || null,
        _custom: true, t: r.t
      };
    } catch(e){ console.warn('[Autónomo] Regla custom inválida:', r.id, e.message); return null; }
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

  /* ---------------- Lugares guardados (geofencing) ---------------- */
  _cargarLugares(){ try { this._lugares = store.get('autonomo_lugares', []); }catch(e){ this._lugares = []; } },
  _guardarLugares(){ try { store.set('autonomo_lugares', this._lugares); }catch(e){} },
  guardarLugarActual(nombre, radio = 200){
    if (!this._ubicacion.lat) return false;
    this._lugares = this._lugares.filter(l => l.nombre !== nombre);
    this._lugares.push({
      nombre, lat: this._ubicacion.lat, lon: this._ubicacion.lon, radio
    });
    this._guardarLugares();
    console.log('[Autónomo] 📍 Lugar guardado:', nombre);
    return true;
  },
  eliminarLugar(nombre){
    const antes = this._lugares.length;
    this._lugares = this._lugares.filter(l => l.nombre !== nombre);
    if (this._lugares.length < antes){ this._guardarLugares(); return true; }
    return false;
  },

  /* ---------------- Parser NL ---------------- */
  parsearReglaNatural(texto){
    if (!texto || texto.length < 8) return null;
    const low = texto.toLowerCase().trim();
    let hora = null, minuto = 0, dias = null, tipo = 'notificar', textoAccion = '';
    const id = 'custom-' + Date.now().toString(36);

    const horaMatch = low.match(/(?:a\s+las?\s+|a\s+la\s+)(\d{1,2})(?::(\d{2}))?\s*(am|pm|de la mañana|de la tarde|de la noche)?/);
    if (horaMatch){
      hora = parseInt(horaMatch[1]);
      minuto = horaMatch[2] ? parseInt(horaMatch[2]) : 0;
      const sufijo = horaMatch[3] || '';
      if ((sufijo.includes('pm') || sufijo.includes('tarde') || sufijo.includes('noche')) && hora < 12) hora += 12;
      if ((sufijo.includes('am') || sufijo.includes('mañana')) && hora === 12) hora = 0;
    } else {
      const delayMatch = low.match(/en\s+(\d+)\s+(minutos?|min|horas?|h)\b/);
      if (delayMatch){
        const n = parseInt(delayMatch[1]);
        const ms = /^h/.test(delayMatch[2]) ? n * 60 * 60 * 1000 : n * 60 * 1000;
        const fechaObj = new Date(Date.now() + ms);
        hora = fechaObj.getHours(); minuto = fechaObj.getMinutes();
      }
    }
    if (hora === null) return null;

    if (/(todos\s+los\s+d[ií]as?|cada\s+d[ií]a|diario)/.test(low)) dias = 'daily';
    else if (/(lunes)/.test(low)) dias = 1;
    else if (/(martes)/.test(low)) dias = 2;
    else if (/(mi[eé]rcoles)/.test(low)) dias = 3;
    else if (/(jueves)/.test(low)) dias = 4;
    else if (/(viernes)/.test(low)) dias = 5;
    else if (/(s[aá]bado)/.test(low)) dias = 6;
    else if (/(domingo)/.test(low)) dias = 0;
    else if (/(fines?\s+de\s+semana)/.test(low)) dias = 'weekend';
    else if (/(entre\s+semana|laborables?)/.test(low)) dias = 'weekday';

    const accionMatch = low.match(/(?:av[ií]same\s+(?:de\s+|que\s+)?|recu[eé]rdame\s+|dime\s+|notif[ií]came\s+)(.+)/);
    if (accionMatch){ textoAccion = accionMatch[1].trim(); textoAccion = textoAccion.charAt(0).toUpperCase() + textoAccion.slice(1); }
    if (!textoAccion) textoAccion = texto.replace(/^(?:ania,?\s*)?/i, '').slice(0, 120);

    let cuandoStr;
    if (dias === 'daily') cuandoStr = `(s) => s.horaNum === ${hora} && s.minuto >= ${minuto} && s.minuto < ${minuto + 5}`;
    else if (dias === 'weekend') cuandoStr = `(s) => (s.diaSemana === 0 || s.diaSemana === 6) && s.horaNum === ${hora} && s.minuto >= ${minuto} && s.minuto < ${minuto + 5}`;
    else if (dias === 'weekday') cuandoStr = `(s) => s.diaSemana >= 1 && s.diaSemana <= 5 && s.horaNum === ${hora} && s.minuto >= ${minuto} && s.minuto < ${minuto + 5}`;
    else if (typeof dias === 'number') cuandoStr = `(s) => s.diaSemana === ${dias} && s.horaNum === ${hora} && s.minuto >= ${minuto} && s.minuto < ${minuto + 5}`;
    else cuandoStr = `(s) => s.horaNum === ${hora} && s.minuto >= ${minuto} && s.minuto < ${minuto + 5}`;

    const cuerpoStr = `(s) => ${JSON.stringify(textoAccion)}`;
    const textoStr = `(s) => ${JSON.stringify('⏰ ' + textoAccion)}`;
    const diasNombre = { 'daily': 'todos los días', 'weekend': 'fines de semana', 'weekday': 'días laborables', 0: 'domingos', 1: 'lunes', 2: 'martes', 3: 'miércoles', 4: 'jueves', 5: 'viernes', 6: 'sábados' };
    const diaStr = diasNombre[dias] || 'todos los días';
    const horaFmt = String(hora).padStart(2, '0') + ':' + String(minuto).padStart(2, '0');
    const descripcion = `${textoAccion} (${diaStr} a las ${horaFmt})`;

    return { id, descripcion, cuandoStr, accionTipo: tipo,
      accionTitulo: 'ANIA · Recordatorio', accionCuerpoStr: cuerpoStr,
      accionTextoStr: textoStr, minIntervalo: 20 * 60 * 60 * 1000, t: Date.now() };
  },
  crearReglaDesdeTexto(texto){
    const raw = this.parsearReglaNatural(texto);
    if (!raw) return null;
    const regla = this._rehidratarRegla(raw);
    if (!regla) return null;
    this.agregarReglaCustom(regla);
    return regla;
  },

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
          case 'musica':      return this._musica(accion);
          case 'abrirUrl':    return this._abrirUrl(accion);
          default: console.warn('[Autónomo] Acción desconocida:', accion.tipo); return false;
        }
      }catch(e){ console.error('[Autónomo] Error en efector:', accion.tipo, e.message); return false; }
    },
    async _notificar(accion, sensores){
      const cuerpo = typeof accion.cuerpo === 'function' ? accion.cuerpo(sensores) : (accion.cuerpo || '');
      if (typeof notify === 'function') notify(accion.titulo || 'ANIA', cuerpo, { tag: accion.tag || 'autonomo', important: false });
      if (typeof addChat === 'function') addChat('sys', '🌙 ' + (accion.titulo || 'ANIA') + ' · ' + cuerpo);
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
      if (typeof beep === 'function') beep(accion.freq || 880, accion.dur || 0.2, 0);
      return true;
    },
    _musica(accion){
      try {
        if (accion.que === 'lluvia' && typeof Ambient !== 'undefined') Ambient.start('lluvia');
        else if (accion.que === 'cafeteria' && typeof Ambient !== 'undefined') Ambient.start('cafeteria');
        else if (accion.que === 'parar'){ if (typeof Music !== 'undefined') Music.stop(); if (typeof Ambient !== 'undefined') Ambient.stop(); }
        else if (typeof Music !== 'undefined') Music.start();
        console.log('[Autónomo] 🎵 Música:', accion.que || 'lo-fi');
      } catch(e){}
      return true;
    },
    _abrirUrl(accion){
      try { window.open(accion.url, '_blank'); return true; } catch(e){ return false; }
    }
  },

  /* ---------------- Planificador ---------------- */
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
      // Actualizar sensores avanzados en paralelo (no bloqueante)
      await Promise.all([
        this._leerBateria(),
        this._leerUbicacion(),
        this._leerClima()
      ]);

      const sensores = this.sensor.leer();
      while (this.cola.length > 0){
        const t = this.sacarTarea();
        if (t) await this.efector.ejecutar(t.accion, sensores);
      }
      const reglasADisparar = this.planificador.decidir(sensores, this.reglas, this.estados, this.reglasDesactivadas);
      for (const regla of reglasADisparar){
        const ok = await this.efector.ejecutar(regla.accion, sensores);
        this._guardarEstado(regla.id, Date.now());
        this._registrarEjecucion(regla, ok);
        console.log('[Autónomo] ✅ Regla disparada:', regla.id);
        this.renderPanel();
      }
    }catch(e){ console.error('[Autónomo] Error en tick:', e.message); }
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

    // Lectura inicial de sensores avanzados
    await Promise.all([
      this._leerBateria(),
      this._leerUbicacion(),
      this._leerClima()
    ]);

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
  async forzarTick(){ console.log('[Autónomo] Forzando tick manual...'); this.ultimoCiclo = 0; await this.tick('manual'); },

  /* ============================================================
     UI · Panel + formulario + plantillas + lugares
  ============================================================ */
  _formState: { dia: 'daily', hora: 9, minuto: 0, tipo: 'notificar', texto: '', toolName: '', url: '' },

  PLANTILLAS: [
    { icon: '☕', nombre: 'Café matutino', dia: 'daily', hora: 10, minuto: 0, tipo: 'mensaje', texto: 'Pausa de café, orden ejecutiva.' },
    { icon: '💧', nombre: 'Beber agua', dia: 'daily', hora: 15, minuto: 0, tipo: 'notificar', texto: 'Un vaso de agua no viene mal.' },
    { icon: '🌙', nombre: 'Cierre del día', dia: 'daily', hora: 22, minuto: 30, tipo: 'mensaje', texto: 'Cierre del día. Revisa pendientes y descansa.' },
    { icon: '📋', nombre: 'Revisar tareas', dia: 'weekday', hora: 9, minuto: 0, tipo: 'notificar', texto: 'Revisa tus tareas del día.' },
    { icon: '🎵', nombre: 'Pausa musical', dia: 'daily', hora: 16, minuto: 30, tipo: 'musica', texto: '' },
    { icon: '📚', nombre: 'Leer 30 min', dia: 'daily', hora: 21, minuto: 0, tipo: 'notificar', texto: 'Hora de leer 30 minutos.' },
    /* ⭐ NUEVAS · con sensores */
    { icon: '🔋', nombre: 'Cargar móvil', dia: 'daily', hora: 22, minuto: 0, tipo: 'notificar', texto: 'Pon el móvil a cargar antes de dormir.' },
    { icon: '☔', nombre: 'Paraguas', dia: 'weekday', hora: 7, minuto: 30, tipo: 'notificar', texto: 'Si va a llover, coge el paraguas.' },
    { icon: '🧘', nombre: 'Pausa mental', dia: 'daily', hora: 14, minuto: 0, tipo: 'notificar', texto: '5 minutos de respiración y vuelta al ruedo.' }
  ],

  renderPanel(){
    const cont = document.getElementById('panelAutonomo');
    if (!cont) return;

    const info = this.info();
    const ahora = Date.now();
    const bat = this._bateria;
    const ubi = this._ubicacion;
    const cli = this._clima;

    // Sensores en tarjetas
    const sensorBat = bat.nivel !== null
      ? `${Math.round(bat.nivel*100)}%${bat.cargando ? '⚡' : ''}`
      : '—';
    const sensorUbi = ubi.lugar || (ubi.lat ? 'activo' : '—');
    const sensorCli = cli.temp !== null
      ? `${cli.temp}°${cli.llueve ? ' ☔' : ''}`
      : '—';

    const reglasHTML = this.reglas.map(r => {
      const activa = this.reglaActiva(r.id);
      const ult = this.estados[r.id];
      const hace = ult ? this._tiempoRel(ahora - ult) : 'nunca';
      const esCustom = r._custom ? '<span class="aut-star">★</span>' : '';
      const btnDel = r._custom ? `<button class="aut-del" data-del="${esc(r.id)}" title="Eliminar">✕</button>` : '';
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
            <span>Acción: ${esc(r.accion.tipo)}</span>
            <span>Última: ${hace}</span>
          </div>
        </div>
      `;
    }).join('');

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

    const plantillasHTML = this.PLANTILLAS.map((p, i) => `
      <button class="aut-plant" data-plant="${i}">
        <span class="aut-plant-icon">${p.icon}</span>
        <span class="aut-plant-name">${esc(p.nombre)}</span>
      </button>
    `).join('');

    const formHTML = this.formVisible ? this._renderForm() : '';

    // Sección de lugares guardados
    const lugaresHTML = this._lugares.length
      ? this._lugares.map(l => `
          <div class="aut-lugar">
            <span>📍 <b>${esc(l.nombre)}</b></span>
            <span class="aut-lugar-radio">${l.radio}m</span>
            <button class="aut-del" data-del-lugar="${esc(l.nombre)}">✕</button>
          </div>
        `).join('')
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

    const tipos = [
      ['notificar', '📬 Notificación'],
      ['mensaje', '💬 Mensaje en chat'],
      ['musica', '🎵 Reproducir música'],
      ['sonido', '🔔 Sonido breve'],
      ['abrirUrl', '🌐 Abrir URL'],
      ['ejecutarTool', '🛠 Ejecutar herramienta']
    ];
    const opcionesTipos = tipos.map(([v, l]) => `<option value="${v}" ${s.tipo === v ? 'selected' : ''}>${l}</option>`).join('');

    let extraHTML = '';
    if (s.tipo === 'notificar' || s.tipo === 'mensaje'){
      extraHTML = `<input type="text" id="autFormTexto" placeholder="Texto del mensaje" value="${esc(s.texto)}" maxlength="160">`;
    } else if (s.tipo === 'musica'){
      extraHTML = `<select id="autFormMusica">
        <option value="musica">Lo-fi procedural</option>
        <option value="lluvia">Lluvia</option>
        <option value="cafeteria">Cafetería</option>
        <option value="parar">Detener</option>
      </select>`;
    } else if (s.tipo === 'abrirUrl'){
      extraHTML = `<input type="url" id="autFormUrl" placeholder="https://..." value="${esc(s.url)}">`;
    } else if (s.tipo === 'ejecutarTool'){
      extraHTML = `<select id="autFormTool">
        <option value="hora">Hora y fecha</option>
        <option value="clima">Clima</option>
        <option value="luna">Fase lunar</option>
        <option value="misTareas">Mis tareas</option>
      </select>`;
    } else {
      extraHTML = `<input type="text" id="autFormTexto" placeholder="(opcional) descripción" value="${esc(s.texto)}" maxlength="160">`;
    }

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
        <div class="aut-form-row">
          <label>Acción</label>
          <select id="autFormTipo">${opcionesTipos}</select>
        </div>
        <div class="aut-form-row">
          <label>Detalle</label>
          ${extraHTML}
        </div>
        <div class="aut-form-buttons">
          <button class="aut-btn" id="autFormCancel">CANCELAR</button>
          <button class="aut-btn aut-btn-primary" id="autFormSave">GUARDAR REGLA</button>
        </div>
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
    const btnLimpiar = document.getElementById('autLimpiar');
    if (btnLimpiar) btnLimpiar.onclick = () => { this.historial = []; store.set('autonomo_historial', []); this.renderPanel(); if (typeof toast === 'function') toast('Historial limpiado'); };
    const btnNew = document.getElementById('autNewRegla');
    if (btnNew) btnNew.onclick = () => { this.formVisible = !this.formVisible; this.renderPanel(); };

    // Guardar lugar actual
    const btnLugarGuardar = document.getElementById('autLugarGuardar');
    if (btnLugarGuardar){
      btnLugarGuardar.onclick = async () => {
        const inp = document.getElementById('autLugarNombre');
        const nombre = (inp && inp.value.trim()) || '';
        if (!nombre){ if (typeof toast === 'function') toast('Escribe un nombre', true); return; }
        await this._leerUbicacion();
        if (!this._ubicacion.lat){ if (typeof toast === 'function') toast('Sin ubicación. Activa el GPS.', true); return; }
        this.guardarLugarActual(nombre, 200);
        if (inp) inp.value = '';
        this.renderPanel();
        if (typeof toast === 'function') toast('📍 Lugar guardado: ' + nombre);
      };
    }

    cont.querySelectorAll('[data-regla]').forEach(b => b.onclick = () => this.toggleRegla(b.dataset.regla));
    cont.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      if (confirm('¿Eliminar esta regla?')) this.eliminarReglaCustom(b.dataset.del);
    });
    cont.querySelectorAll('[data-del-lugar]').forEach(b => b.onclick = () => {
      if (confirm('¿Eliminar este lugar?')){
        this.eliminarLugar(b.dataset.delLugar);
        this.renderPanel();
      }
    });
    cont.querySelectorAll('[data-plant]').forEach(b => b.onclick = () => {
      const p = this.PLANTILLAS[parseInt(b.dataset.plant)];
      if (!p) return;
      this._aplicarPlantilla(p);
    });

    if (this.formVisible) this._bindFormHandlers();
  },

  _bindFormHandlers(){
    const dia = document.getElementById('autFormDia');
    const hora = document.getElementById('autFormHora');
    const min = document.getElementById('autFormMin');
    const tipo = document.getElementById('autFormTipo');
    const cancel = document.getElementById('autFormCancel');
    const save = document.getElementById('autFormSave');

    const syncState = () => {
      if (dia) this._formState.dia = dia.value === 'daily' || dia.value === 'weekday' || dia.value === 'weekend' ? dia.value : parseInt(dia.value);
      if (hora) this._formState.hora = parseInt(hora.value) || 0;
      if (min) this._formState.minuto = parseInt(min.value) || 0;
      if (tipo) this._formState.tipo = tipo.value;
      const t = document.getElementById('autFormTexto');
      if (t) this._formState.texto = t.value;
      const u = document.getElementById('autFormUrl');
      if (u) this._formState.url = u.value;
      const tool = document.getElementById('autFormTool');
      if (tool) this._formState.toolName = tool.value;
    };

    if (tipo) tipo.onchange = () => { syncState(); this.renderPanel(); };
    if (cancel) cancel.onclick = () => { this.formVisible = false; this.renderPanel(); };
    if (save) save.onclick = () => { syncState(); this._guardarDesdeForm(); };
  },

  _aplicarPlantilla(p){
    this._formState = {
      dia: p.dia, hora: p.hora, minuto: p.minuto,
      tipo: p.tipo, texto: p.texto || '', toolName: 'hora', url: ''
    };
    this.formVisible = true;
    this.renderPanel();
    if (typeof toast === 'function') toast('Plantilla cargada: ' + p.nombre);
  },

  _guardarDesdeForm(){
    const s = this._formState;
    if (s.hora < 0 || s.hora > 23) return alert('Hora inválida (0-23)');
    if (s.minuto < 0 || s.minuto > 59) return alert('Minuto inválido (0-59)');
    if ((s.tipo === 'notificar' || s.tipo === 'mensaje') && !s.texto.trim()) return alert('Escribe el texto');
    if (s.tipo === 'abrirUrl' && !s.url.trim()) return alert('Escribe la URL');

    let cuandoStr;
    const h = s.hora, m = s.minuto;
    if (s.dia === 'daily') cuandoStr = `(s) => s.horaNum === ${h} && s.minuto >= ${m} && s.minuto < ${m + 5}`;
    else if (s.dia === 'weekend') cuandoStr = `(s) => (s.diaSemana === 0 || s.diaSemana === 6) && s.horaNum === ${h} && s.minuto >= ${m} && s.minuto < ${m + 5}`;
    else if (s.dia === 'weekday') cuandoStr = `(s) => s.diaSemana >= 1 && s.diaSemana <= 5 && s.horaNum === ${h} && s.minuto >= ${m} && s.minuto < ${m + 5}`;
    else cuandoStr = `(s) => s.diaSemana === ${s.dia} && s.horaNum === ${h} && s.minuto >= ${m} && s.minuto < ${m + 5}`;

    const accion = { tipo: s.tipo };
    let cuerpoStr = null, textoStr = null, extra = null;

    if (s.tipo === 'notificar'){
      accion.titulo = 'ANIA · Recordatorio';
      cuerpoStr = `(s) => ${JSON.stringify(s.texto)}`;
    } else if (s.tipo === 'mensaje'){
      textoStr = `(s) => ${JSON.stringify(s.texto)}`;
    } else if (s.tipo === 'musica'){
      extra = { que: s.texto || 'musica' };
    } else if (s.tipo === 'sonido'){
      extra = { freq: 880, dur: 0.2 };
    } else if (s.tipo === 'abrirUrl'){
      extra = { url: s.url };
    } else if (s.tipo === 'ejecutarTool'){
      extra = { tool: s.toolName || 'hora', args: {} };
    }

    const diasNombre = { 'daily': 'todos los días', 'weekend': 'fines de semana', 'weekday': 'laborables', 0: 'domingos', 1: 'lunes', 2: 'martes', 3: 'miércoles', 4: 'jueves', 5: 'viernes', 6: 'sábados' };
    const diaStr = diasNombre[s.dia] || 'todos los días';
    const horaFmt = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    const desc = s.texto || s.tipo;
    const descripcion = `${desc} (${diaStr} a las ${horaFmt})`;

    const raw = {
      id: 'custom-' + Date.now().toString(36),
      descripcion, cuandoStr,
      accionTipo: s.tipo, accionTitulo: accion.titulo || null,
      accionCuerpoStr: cuerpoStr, accionTextoStr: textoStr,
      accionExtra: extra,
      minIntervalo: 20 * 60 * 60 * 1000,
      t: Date.now()
    };

    const regla = this._rehidratarRegla(raw);
    if (!regla) return alert('Error al crear la regla');

    this.agregarReglaCustom(regla);
    this.formVisible = false;
    this._formState = { dia: 'daily', hora: 9, minuto: 0, tipo: 'notificar', texto: '', toolName: 'hora', url: '' };
    if (typeof toast === 'function') toast('Regla creada: ' + regla.descripcion);
    this.renderPanel();
  },

  _tiempoRel(ms){
    if (ms < 60e3) return 'hace ' + Math.round(ms/1000) + 's';
    if (ms < 3600e3) return 'hace ' + Math.round(ms/60e3) + 'min';
    if (ms < 86400e3) return 'hace ' + Math.round(ms/3600e3) + 'h';
    return 'hace ' + Math.round(ms/86400e3) + 'd';
  }
};

window.Autonomo = Autonomo;
