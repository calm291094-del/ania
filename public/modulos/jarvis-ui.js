/* ============================================================
   JARVIS UI · capa estética de ANIA
   - HUD overlay con esquinas, reloj y estado de módulos
   - Sonidos discretos (WebAudio) según tipo de evento
   - Paleta "jarvis" (cian/azul) como nueva esencia
   - Modo denso del reactor
   - Atajos de teclado globales
   - Persistencia en localStorage
   
   API pública (window.JarvisUI):
     .activar()          → enciende HUD + paleta + sonidos
     .desactivar()       → apaga todo
     .toggle()           → alterna
     .on                 → booleano
     .sonido(tipo)       → reproduce 'ok'|'error'|'alerta'|'activar'|'off'
     .setDensidad(n)     → 1 = normal, 2 = densa, 3 = máxima
   ============================================================ */
'use strict';
(function(){
  if (window.JarvisUI) return;

  /* ============================================================
     CSS inyectado dinámicamente
  ============================================================ */
  const CSS = `
    /* ====== HUD overlay ====== */
    #jarvisHud{
      position:fixed;inset:0;z-index:850;pointer-events:none;
      opacity:0;transition:opacity .5s ease;
      font-family:var(--mono);color:var(--acc2);
      --jh-acc:var(--acc2);
      --jh-dim:rgba(159,220,255,.35);
    }
    #jarvisHud.on{opacity:1;}

    /* Esquinas */
    .jh-corner{
      position:absolute;width:34px;height:34px;
      border:2px solid var(--jh-acc);
      opacity:.7;
      filter:drop-shadow(0 0 4px var(--jh-acc));
    }
    .jh-corner.tl{top:14px;left:14px;border-right:none;border-bottom:none;}
    .jh-corner.tr{top:14px;right:14px;border-left:none;border-bottom:none;}
    .jh-corner.bl{bottom:14px;left:14px;border-right:none;border-top:none;}
    .jh-corner.br{bottom:14px;right:14px;border-left:none;border-top:none;}

    /* Barra superior */
    .jh-top{
      position:absolute;top:14px;left:60px;right:60px;
      display:flex;justify-content:space-between;align-items:center;
      font-size:11px;letter-spacing:.2em;
      padding:4px 10px;
      background:linear-gradient(180deg, rgba(4,8,6,.6), transparent);
      border-bottom:1px solid var(--jh-dim);
    }
    .jh-top-left,.jh-top-right{display:flex;gap:12px;align-items:center;}
    .jh-tag{
      font-size:10px;letter-spacing:.25em;
      border:1px solid var(--jh-dim);border-radius:3px;
      padding:2px 6px;
      color:var(--jh-acc);
    }
    .jh-dot{
      display:inline-block;width:6px;height:6px;border-radius:50%;
      background:var(--jh-acc);
      box-shadow:0 0 6px var(--jh-acc);
      animation:jhBlink 1.6s steps(1) infinite;
      margin-right:4px;vertical-align:middle;
    }
    @keyframes jhBlink{50%{opacity:.2;}}
    .jh-tag.off{color:var(--danger);border-color:rgba(255,84,112,.5);}
    .jh-tag.off .jh-dot{background:var(--danger);box-shadow:0 0 6px var(--danger);animation:none;}

    /* Barra inferior */
    .jh-bottom{
      position:absolute;bottom:14px;left:60px;right:60px;
      display:flex;justify-content:space-between;align-items:center;
      font-size:10px;letter-spacing:.2em;
      padding:4px 10px;
      background:linear-gradient(0deg, rgba(4,8,6,.6), transparent);
      border-top:1px solid var(--jh-dim);
    }
    .jh-mods{display:flex;gap:10px;}
    .jh-mod{
      display:flex;align-items:center;gap:4px;
      color:var(--jh-dim);
      transition:color .3s;
    }
    .jh-mod.on{color:var(--jh-acc);}
    .jh-mod.on .jh-dot{animation:jhBlink 1.6s steps(1) infinite;}
    .jh-mod.off .jh-dot{animation:none;background:#3a5a4a;box-shadow:none;}

    /* Línea de escaneo sutil */
    #jarvisHud::after{
      content:'';position:absolute;left:0;right:0;top:0;height:1px;
      background:linear-gradient(90deg, transparent, var(--jh-acc), transparent);
      opacity:.5;
      animation:jhScan 8s linear infinite;
    }
    @keyframes jhScan{
      0%{top:8%;opacity:0;}
      10%{opacity:.7;}
      90%{opacity:.7;}
      100%{top:92%;opacity:0;}
    }

    /* Pulso ambiental en las esquinas cuando habla Ania */
    body.jarvis-ania-speaking .jh-corner{
      animation:jhCornerPulse .6s ease-in-out infinite alternate;
    }
    @keyframes jhCornerPulse{
      to{opacity:1;filter:drop-shadow(0 0 10px var(--jh-acc));}
    }

    /* Modo denso: reduce el "aire" y sube contraste */
    body.jarvis-denso #chat .line{font-size:13px;padding:3px 0;}
    body.jarvis-denso header{padding:6px 6px;}
    body.jarvis-denso #coreZone{padding:4px 0 0;}
    body.jarvis-denso .line .msg{line-height:1.4;}

    /* Pequeño glow en el logo cuando está en modo Jarvis */
    body.jarvis-on #logo{
      text-shadow:
        0 0 6px var(--acc2),
        0 0 14px var(--acc2),
        0 0 24px rgba(159,220,255,.5);
    }
  `;

  const styleEl = document.createElement('style');
  styleEl.id = 'jarvis-ui-css';
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);

  /* ============================================================
     Sonido · usa el AudioContext existente si lo hay, si no crea uno
  ============================================================ */
  let _audioCtx = null;
  function getCtx(){
    if (_audioCtx) return _audioCtx;
    if (typeof AC !== 'undefined' && AC) return (_audioCtx = AC);
    try{
      _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }catch(e){ return null; }
    return _audioCtx;
  }

  function tone(freq, dur, delay, vol, type){
    const ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') { try{ ctx.resume(); }catch(e){} }
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    const t0 = ctx.currentTime + (delay || 0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.08, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  const SONIDOS = {
    ok:      () => { tone(1180, 0.10, 0,   0.06, 'sine'); tone(1560, 0.08, 0.06, 0.04, 'sine'); },
    error:   () => { tone(220, 0.16, 0,   0.09, 'triangle'); tone(180, 0.20, 0.16, 0.09, 'triangle'); },
    alerta:  () => { tone(880, 0.12, 0,   0.08, 'square'); tone(880, 0.12, 0.20, 0.08, 'square'); tone(880, 0.14, 0.40, 0.08, 'square'); },
    activar: () => { [523, 659, 784, 1047].forEach((f,i) => tone(f, 0.10, i*0.06, 0.05, 'sine')); },
    off:     () => { [1047, 784, 659, 523].forEach((f,i) => tone(f, 0.10, i*0.06, 0.05, 'sine')); },
    tick:    () => { tone(2200, 0.03, 0, 0.03, 'square'); },
    click:   () => { tone(1600, 0.02, 0, 0.025, 'square'); }
  };

  /* ============================================================
     HUD DOM
  ============================================================ */
  let hudEl = null;

  function crearHUD(){
    if (hudEl) return hudEl;
    const el = document.createElement('div');
    el.id = 'jarvisHud';
    el.innerHTML = `
      <div class="jh-corner tl"></div>
      <div class="jh-corner tr"></div>
      <div class="jh-corner bl"></div>
      <div class="jh-corner br"></div>

      <div class="jh-top">
        <div class="jh-top-left">
          <span class="jh-tag" id="jhModo"><span class="jh-dot"></span><span id="jhModoTxt">LOCAL</span></span>
          <span class="jh-tag" id="jhRed"><span class="jh-dot"></span><span id="jhRedTxt">ONLINE</span></span>
          <span class="jh-tag" id="jhSesion"><span class="jh-dot"></span><span id="jhSesionTxt">SESIÓN</span></span>
        </div>
        <div class="jh-top-right">
          <span id="jhReloj">--:--:--</span>
        </div>
      </div>

      <div class="jh-bottom">
        <div class="jh-mods">
          <span class="jh-mod off" id="jhAgent"><span class="jh-dot"></span>AGENTE</span>
          <span class="jh-mod off" id="jhBrain"><span class="jh-dot"></span>CEREBRO</span>
          <span class="jh-mod off" id="jhEars"><span class="jh-dot"></span>OÍDO</span>
          <span class="jh-mod off" id="jhHUD"><span class="jh-dot"></span>VISIÓN</span>
          <span class="jh-mod off" id="jhRelay"><span class="jh-dot"></span>RELAY</span>
        </div>
        <div>
          <span style="color:var(--jh-dim);">v10 · JARVIS</span>
        </div>
      </div>
    `;
    document.body.appendChild(el);
    return (hudEl = el);
  }

  function setTag(id, txt, cls){
    const el = document.getElementById(id);
    if (!el) return;
    const t = el.querySelector('span:last-child');
    if (t) t.textContent = txt;
    el.classList.toggle('off', cls === 'off');
  }
  function setMod(id, on){
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('on', !!on);
    el.classList.toggle('off', !on);
  }

  /* ============================================================
     Paleta JARVIS (cyan)
  ============================================================ */
  const PALETA_JARVIS = {
    acc:  '#9fdcff',
    acc2: '#cdeeff'
  };

  let _paletaPrevia = null;

  function aplicarPaletaJarvis(){
    const rs = document.documentElement.style;
    _paletaPrevia = {
      acc:  rs.getPropertyValue('--acc').trim(),
      acc2: rs.getPropertyValue('--acc2').trim()
    };
    rs.setProperty('--acc',  PALETA_JARVIS.acc);
    rs.setProperty('--acc2', PALETA_JARVIS.acc2);
    // Actualizar ACC_RGB si existe (reactor lo usa)
    try{
      if (typeof ACC_RGB !== 'undefined'){
        const h = PALETA_JARVIS.acc.replace('#','');
        ACC_RGB[0] = parseInt(h.slice(0,2), 16);
        ACC_RGB[1] = parseInt(h.slice(2,4), 16);
        ACC_RGB[2] = parseInt(h.slice(4,6), 16);
      }
    }catch(e){}
  }

  function restaurarPaleta(){
    if (!_paletaPrevia) return;
    const rs = document.documentElement.style;
    if (_paletaPrevia.acc)  rs.setProperty('--acc',  _paletaPrevia.acc);
    if (_paletaPrevia.acc2) rs.setProperty('--acc2', _paletaPrevia.acc2);
    try{
      if (typeof ACC_RGB !== 'undefined' && typeof essence !== 'undefined' && window.ESSENCES){
        const e = ESSENCES[essence];
        if (e){
          const h = e.acc.replace('#','');
          ACC_RGB[0] = parseInt(h.slice(0,2), 16);
          ACC_RGB[1] = parseInt(h.slice(2,4), 16);
          ACC_RGB[2] = parseInt(h.slice(4,6), 16);
        }
      }
    }catch(e){}
  }

  /* ============================================================
     Densidad del reactor
  ============================================================ */
  let _densidad = 1;
  function setDensidad(n){
    _densidad = Math.max(1, Math.min(3, Number(n) || 1));
    document.body.classList.toggle('jarvis-denso', _densidad >= 2);
    try{
      if (typeof PH !== 'undefined' && PH && !PH.__orig){
        PH.__orig = JSON.parse(JSON.stringify(PH));
      }
      if (PH && PH.__orig){
        for(const k in PH.__orig){
          PH[k].spin = PH.__orig[k].spin * _densidad;
          PH[k].lvl  = PH.__orig[k].lvl  * (1 + (_densidad - 1) * 0.5);
        }
      }
    }catch(e){}
  }

  /* ============================================================
     Hooks a la vida de la app
  ============================================================ */
  function hookToast(){
    if (typeof window.toast !== 'function' || window.__jarvisToastHooked) return;
    window.__jarvisToastHooked = true;
    const _toast = window.toast;
    window.toast = function(msg, warn){
      try{
        if (warn) JarvisUI.sonido('error');
        else JarvisUI.sonido('ok');
      }catch(e){}
      return _toast.apply(this, arguments);
    };
  }

  function hookNotify(){
    if (typeof window.notify !== 'function' || window.__jarvisNotifyHooked) return;
    window.__jarvisNotifyHooked = true;
    const _notify = window.notify;
    window.notify = function(title, body, opts){
      try{ JarvisUI.sonido('alerta'); }catch(e){}
      return _notify.apply(this, arguments);
    };
  }

  function hookPhase(){
    if (typeof window.setPhase !== 'function' || window.__jarvisPhaseHooked) return;
    window.__jarvisPhaseHooked = true;
    const _setPhase = window.setPhase;
    window.setPhase = function(p){
      document.body.classList.toggle('jarvis-ania-speaking', p === 'speaking');
      return _setPhase.apply(this, arguments);
    };
  }

  /* ============================================================
     Reloj HUD + estado en vivo
  ============================================================ */
  let _relojTimer = null;
  function iniciarReloj(){
    const actualizar = ()=>{
      const h = document.getElementById('jhReloj');
      if (h) h.textContent = new Date().toLocaleTimeString('es-ES');
      // Red
      try{
        const off = (typeof isOffline === 'function') ? isOffline() : false;
        setTag('jhRed', off ? 'OFFLINE' : 'ONLINE', off ? 'off' : '');
      }catch(e){}
      // Sesión
      try{
        setTag('jhSesion',
          (typeof Relay !== 'undefined' && Relay.on) ? 'SESIÓN ON' : 'SESIÓN OFF',
          (typeof Relay !== 'undefined' && Relay.on) ? '' : 'off');
      }catch(e){}
      // Módulos
      try{ setMod('jhAgent', typeof Agent !== 'undefined' && Agent.ok); }catch(e){}
      try{ setMod('jhBrain', typeof Brain !== 'undefined' && Brain.localReady); }catch(e){}
      try{ setMod('jhEars',  typeof Ears  !== 'undefined' && Ears.on); }catch(e){}
      try{ setMod('jhHUD',   typeof HUD   !== 'undefined' && HUD.on); }catch(e){}
      try{ setMod('jhRelay', typeof Relay !== 'undefined' && Relay.on); }catch(e){}
    };
    actualizar();
    _relojTimer = setInterval(actualizar, 1000);
  }

  function detenerReloj(){
    if (_relojTimer){ clearInterval(_relojTimer); _relojTimer = null; }
  }

  function detectarModo(){
    const h = location.hostname;
    const local = (h === 'localhost' || h === '127.0.0.1' || h === '::1');
    setTag('jhModo', local ? 'LOCAL' : 'NUBE', '');
  }

  /* ============================================================
     Atajos de teclado
  ============================================================ */
  const ATAJOS = {
    'h': () => JarvisUI.toggle(),
    'H': () => JarvisUI.toggle(),
    'j': () => { if (window.Dashboard) Dashboard.abrir(); },
    'J': () => { if (window.Dashboard) Dashboard.abrir(); },
    'f': () => abrirJarvisTab('finanzas'),
    'F': () => abrirJarvisTab('finanzas'),
    'i': () => abrirJarvisTab('inventario'),
    'I': () => abrirJarvisTab('inventario'),
    'c': () => abrirJarvisTab('compras'),
    'C': () => abrirJarvisTab('compras'),
    'd': () => { if (window.Dashboard) Dashboard.abrir(); },
    'D': () => { if (window.Dashboard) Dashboard.abrir(); }
  };

  function abrirJarvisTab(tab){
    if (typeof openModal !== 'function') return;
    openModal('jarvisModal');
    if (typeof switchJarvisTab === 'function') switchJarvisTab(tab);
  }

  function installHotkeys(){
    if (window.__jarvisHotkeysInstalled) return;
    window.__jarvisHotkeysInstalled = true;
    document.addEventListener('keydown', (e)=>{
      // Ignorar si se está escribiendo en un input/textarea
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      // Ignorar si hay modificadores (excepto Shift, que ya viene en la tecla)
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const fn = ATAJOS[e.key];
      if (fn){
        e.preventDefault();
        try{ JarvisUI.sonido('click'); }catch(err){}
        fn();
      }
    });
  }

  /* ============================================================
     API pública
  ============================================================ */
  const JarvisUI = {
    on: false,

    activar(silencioso){
      if (this.on) return;
      this.on = true;
      store.set('jarvisMode', true);
      document.body.classList.add('jarvis-on');
      crearHUD();
      requestAnimationFrame(()=> hudEl.classList.add('on'));
      aplicarPaletaJarvis();
      detectarModo();
      iniciarReloj();
      hookToast(); hookNotify(); hookPhase();
      installHotkeys();
      if (!silencioso) this.sonido('activar');
      if (typeof toastInfo === 'function') toastInfo('Modo JARVIS activado');
      console.log('[JarvisUI] activado');
    },

    desactivar(silencioso){
      if (!this.on) return;
      this.on = false;
      store.set('jarvisMode', false);
      document.body.classList.remove('jarvis-on');
      document.body.classList.remove('jarvis-denso');
      document.body.classList.remove('jarvis-ania-speaking');
      if (hudEl) hudEl.classList.remove('on');
      restaurarPaleta();
      detenerReloj();
      setDensidad(1);
      if (!silencioso) this.sonido('off');
      if (typeof toastInfo === 'function') toastInfo('Modo JARVIS desactivado');
      console.log('[JarvisUI] desactivado');
    },

    toggle(){
      if (this.on) this.desactivar();
      else this.activar();
    },

    sonido(tipo){
      if (!this.on) return;
      const fn = SONIDOS[tipo];
      if (fn){ try{ fn(); }catch(e){} }
    },

    setDensidad
  };

  window.JarvisUI = JarvisUI;

  /* Auto-activar si estaba guardado en localStorage */
  if (store.get('jarvisMode', false) === true){
    // Esperamos un poco a que el resto del JS esté listo
    setTimeout(()=> JarvisUI.activar(true), 800);
  }

  console.log('✓ Módulo JarvisUI cargado (atajos: H, J, F, I, C)');
})();
