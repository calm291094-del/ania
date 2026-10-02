/* ============================================================
   14-BOOT · arranque, boot, jarvis hooks, video, chips
   v3 · incluye Background Sync + Núcleo Autónomo
============================================================ */
'use strict';

/* ============================================================
   REGISTRO DE BACKGROUND SYNC
   Se llama desde el boot, justo después de que el usuario
   interactúe con la app.
============================================================ */
async function registrarBackgroundSync(){
  if (!('serviceWorker' in navigator)) {
    console.log('[BG-Sync] Service Worker no disponible');
    return false;
  }
  try {
    const reg = await navigator.serviceWorker.ready;

    // 1) Periodicsync (más potente, pero requiere permiso y Chrome/Edge)
    if ('periodicSync' in reg){
      try {
        const permiso = await navigator.permissions.query({ name: 'periodic-background-sync' });
        if (permiso.state === 'granted'){
          await reg.periodicSync.register('ania-autonomo', {
            minInterval: 15 * 60 * 1000
          });
          console.log('⏰ periodicSync registrado (cada 15 min aprox)');
        } else {
          console.log('⏰ periodicSync sin permiso (', permiso.state, ')');
        }
      } catch(e){
        console.warn('⏰ periodicSync no se pudo registrar:', e.message);
      }
    } else {
      console.log('⏰ periodicSync no soportado en este navegador');
    }

    // 2) Background sync (se dispara al volver online)
    if ('sync' in reg){
      try {
        await reg.sync.register('ania-sync-cola');
        await reg.sync.register('ania-sync-tareas');
        console.log('🔄 Background Sync registrado');
      } catch(e){
        console.warn('🔄 sync.register falló:', e.message);
      }
    }

    // 3) Escuchar mensajes del SW
    navigator.serviceWorker.addEventListener('message', (event) => {
      const d = event.data;
      if (!d) return;
      if (d.type === 'ANIA_BACKGROUND_TASK'){
        console.log('🌙 SW despertó:', d.tarea);
        // Notificar al módulo Autónomo si existe
        if (window.Autonomo && typeof Autonomo.trigger === 'function'){
          Autonomo.trigger(d.tarea);
        } else {
          // Fallback: procesar cola offline si aplica
          if (d.tarea === 'sync-cola' && typeof procesarColaOffline === 'function'){
            procesarColaOffline();
          }
          if (d.tarea === 'sync-tareas' && typeof Sync !== 'undefined' && Sync.fullSync){
            Sync.fullSync();
          }
        }
      }
    });

    return true;
  } catch(e){
    console.warn('[BG-Sync] Error:', e.message);
    return false;
  }
}

/* ---------- Función helper: pedir al SW que ejecute una tarea ahora ---------- */
async function ejecutarTareaSW(tipo){
  try {
    const reg = await navigator.serviceWorker.ready;
    if (reg.active){
      reg.active.postMessage({ type: 'EJECUTAR_TAREA_AHORA', tarea: tipo });
    }
  } catch(e){
    console.warn('[BG-Sync] No pude pedir tarea al SW:', e.message);
  }
}

/* ---------- Switch de tabs del panel Jarvis ---------- */
function switchJarvisTab(tab){
  document.querySelectorAll('.jarvisTab').forEach(b => {
    const on = b.dataset.tab === tab;
    b.style.borderColor = on ? 'var(--line2)' : 'var(--line)';
    b.style.color = on ? 'var(--acc2)' : 'var(--dim)';
  });
  const f = document.getElementById('panelFinanzas');
  const i = document.getElementById('panelInventario');
  const c = document.getElementById('panelCompras');
  if (f) f.style.display = tab === 'finanzas'   ? 'block' : 'none';
  if (i) i.style.display = tab === 'inventario' ? 'block' : 'none';
  if (c) c.style.display = tab === 'compras'    ? 'block' : 'none';
  if (tab === 'finanzas'   && window.Finanzas)   Finanzas.renderPanel();
  if (tab === 'inventario' && window.Inventario) Inventario.renderPanel();
  if (tab === 'compras'    && window.Compras)    Compras.renderPanel();
}

/* ---------- Hooks del dock + ajustes + modales ---------- */
document.addEventListener('DOMContentLoaded', ()=>{
  const btnJ = document.getElementById('btnJarvis');
  if (btnJ) btnJ.onclick = ()=>{
    openModal('jarvisModal');
    switchJarvisTab('finanzas');
  };
  const btnD = document.getElementById('btnDashboard');
  if (btnD) btnD.onclick = ()=>{ if (window.Dashboard) Dashboard.abrir(); };
  const btnJM2 = document.getElementById('btnJarvisMode2');
  if (btnJM2) btnJM2.onclick = ()=>{ if (window.JarvisUI) JarvisUI.toggle(); };

  document.querySelectorAll('.jarvisTab').forEach(b => b.onclick = ()=>{
    if (b.disabled) return;
    switchJarvisTab(b.dataset.tab);
  });

  const btnJM = document.getElementById('btnJarvisMode');
  const dr    = document.getElementById('densidadRange');
  const dOut  = document.getElementById('densidadOut');

  function refrescarBotonJarvis(){
    if (!btnJM || !window.JarvisUI) return;
    btnJM.textContent = JarvisUI.on ? 'DESACTIVAR MODO JARVIS' : 'ACTIVAR MODO JARVIS';
  }
  if (btnJM) btnJM.onclick = ()=>{
    if (window.JarvisUI) JarvisUI.toggle();
    setTimeout(refrescarBotonJarvis, 100);
  };

  const densidadGuardada = parseInt(localStorage.getItem('ania_jarvisDensidad') || '1', 10);
  if (dr){
    dr.value = densidadGuardada;
    if (dOut) dOut.value = densidadGuardada;
    dr.oninput = ()=>{
      const v = parseInt(dr.value, 10);
      if (dOut) dOut.value = v;
      localStorage.setItem('ania_jarvisDensidad', String(v));
      if (window.JarvisUI) JarvisUI.setDensidad(v);
    };
  }
  if (window.JarvisUI && JarvisUI.on && densidadGuardada > 1){
    setTimeout(()=> JarvisUI.setDensidad(densidadGuardada), 200);
  }
  refrescarBotonJarvis();
  setInterval(refrescarBotonJarvis, 1500);

// ⭐ Hook del token GitHub
setTimeout(() => {
  const btn = document.getElementById('btnGuardarGhToken');
  const inp = document.getElementById('ghTokenInput');
  const st  = document.getElementById('ghTokenStatus');
  if (!btn || !inp) return;
  if (window.SyncGitHub && st){
    st.textContent = SyncGitHub.configurado() ? '✅ Token configurado' : '⚠ Sin token';
  }
  btn.onclick = () => {
    const t = inp.value.trim();
    if (!t){ if (st) st.textContent = '❌ Token vacío'; return; }
    if (window.SyncGitHub){
      SyncGitHub.setToken(t);
      if (st) st.textContent = '✅ Token guardado';
      if (typeof toast === 'function') toast('Token GitHub guardado');
    }
  };
}, 2000);
   
  document.querySelectorAll('.esBtn').forEach(b => {
    if (b.dataset.es){
      b.onclick = ()=>{ applyEssence(b.dataset.es); toast('Esencia cambiada'); };
    }
  });

  // ⭐ Hook: pintar el panel autónomo cada vez que se abre Ajustes
  const btnSettingsHook = document.getElementById('btnSettings');
  if (btnSettingsHook){
    const _onclickOriginal = btnSettingsHook.onclick;
    btnSettingsHook.onclick = function(e){
      if (typeof _onclickOriginal === 'function') _onclickOriginal.call(this, e);
      setTimeout(() => {
        if (window.Autonomo && typeof Autonomo.renderPanel === 'function'){
          Autonomo.renderPanel();
        }
      }, 80);
    };
  }
   
});

/* ---------- Generador de video ---------- */
let _videoRec = false, _videoChunks = [];
function makeVideo(frase){
  if (_videoRec) return;
  _videoRec = true; _videoChunks = [];
  toast('Grabando 10 segundos...');
  const W = 1280, H = 720;
  const VC = document.createElement('canvas');
  VC.width = W; VC.height = H;
  VC.style.cssText = 'position:fixed;left:-9999px';
  document.body.appendChild(VC);
  const vctx = VC.getContext('2d');
  const stream = VC.captureStream(30);
  const recorder = new MediaRecorder(stream, {mimeType: 'video/webm'});
  recorder.ondataavailable = e => { if (e.data.size > 0) _videoChunks.push(e.data); };
  const done = new Promise(resolve => { recorder.onstop = resolve; });
  recorder.start();
  const startTime = performance.now();
  const dur = 10000;
  let recording = true;
  function draw(){
    if (!recording) return;
    const t = performance.now() - startTime;
    const p = Math.min(1, t / dur);
    vctx.fillStyle = '#040806';
    vctx.fillRect(0, 0, W, H);
    vctx.font = '28px "Share Tech Mono", monospace';
    vctx.fillStyle = '#39ff9b';
    vctx.textAlign = 'center';
    vctx.textBaseline = 'middle';
    const n = Math.floor(p * frase.length);
    vctx.fillText(frase.slice(0, n), W / 2, H / 2);
    vctx.font = '14px "Share Tech Mono", monospace';
    vctx.fillStyle = '#2de08a';
    vctx.fillText('— ANIA —', W / 2, H - 50);
    if (t >= dur){ recording = false; recorder.stop(); return; }
    requestAnimationFrame(draw);
  }
  draw();
  done.then(() => {
    _videoRec = false;
    const blob = new Blob(_videoChunks, {type: 'video/webm'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'ania-video.webm';
    document.body.appendChild(a); a.click(); a.remove();
    toast('Video creado y descargado');
    _videoRec = false;
    personaReply('Video creado: ' + frase);
  });
}

/* ---------- Interceptor de comandos de video ---------- */
(function(){
  const _sendOriginal = _sendCore;
  window.send = async function(text){
    const low = LINGUA.normalizar(text);
    const vM = low.match(/video\s+(?:de\s+|con\s+)?(.+)/);
    if (vM){
      const frase = (vM[1] || '').trim();
      if (frase){ makeVideo(frase); return; }
      return personaReply('Dime que frase quieres en el video.');
    }
    return _sendOriginal(text);
  };
})();

/* ---------- Boot ---------- */
const BOOTLINES = [
  '» ANIA KERNEL v10.0 — edición Jarvis',
  '» módulos de red y voz ............... OK',
  '» LINGUA: cubano + typos + tildes ... OK',
  '» cerebro razonador (tool-calling) .. OK',
  '» LOCALMIND: conversación offline ... OK',
  '» OÍDO local · HUD · sesión multi ... OK',
  '» BACKGROUND SYNC · autonomía ....... OK',
  '» esperando credenciales del operador _'
];

(async function boot(){
  const finalLine = Session ? '» sesión recordada: '+Session.name+' _' : '» esperando credenciales del operador _';
  const lines = Session ? [...BOOTLINES.slice(0,-1), finalLine] : BOOTLINES;
  const log = $('bootLog');
  for(const line of lines){
    const div = document.createElement('div');
    log.appendChild(div);
    for(let i=0;i<=line.length;i++){
      div.textContent = line.slice(0,i);
      await new Promise(r=>setTimeout(r, 4));
    }
    div.innerHTML = esc(line).replace(/OK$/,'<span class="ok">OK</span>');
    await new Promise(r=>setTimeout(r, 60));
  }
  if(Session){
    if(Session.role!=='invitado' && Session.name && Mind.d.nombre !== Session.name){ Mind.d.nombre = Session.name; Mind.save(); }
    setOperator();
    showStart(Session.role==='invitado' ? 'CONTINUAR' : 'DESPERTAR A ANIA');
  } else {
    $('loginBox').style.display = 'flex';
  }
})();

$('bootStart').onclick = async ()=>{
  if(S.booted) return;
  S.booted = true;
  ensureAudio();
  try{ if('Notification' in window) Notification.requestPermission().catch(()=>{}); }catch(e){}
  $('boot').classList.add('hide');
  setTimeout(()=>$('boot').remove(), 700);
  Mind.recordVisit();
  setOperator();
  renderTasks();
  initSyncLoop();
  if (AniaAPI.token) CollectiveBrain.sync().then(()=> CollectiveBrain.flushPending()).catch(()=>{});
  Diary.touch();
  updateDocsUI();
  updatePCUI();
  Agent.connect();
  Proactive.start();
  setTimeout(()=>{ if (window.Dashboard) Dashboard.proactive(); }, 5000);
  Brain.paint();
  Brain.loadLocal(false);
  S.lastUserTs = Date.now();
  sysLine('v10.0 · LocalMind activo · cerebro '+(Brain.localReady?'local':'cascada'));
  const colaInicial = OfflineQueue.count();
  if (colaInicial){
    sysLine('✉ Tienes ' + colaInicial + ' mensaje(s) en cola desde la última vez sin conexión.');
    if (!isOffline()) setTimeout(procesarColaOffline, 2500);
  }
  const g = geoCache();
  if(g){ try{ const d = await getWeather(g); updateChip(g,d); }catch(e){} }

  const h = new Date().getHours();
  const saludo = h<12?'Buenos días':(h<20?'Buenas tardes':'Buenas noches');
  const nom = Mind.nombre() ? ', '+Mind.nombre() : '';
  let msg = saludo+nom+'. v10: ahora converso de verdad incluso sin internet y sin cerebro — mi LocalMind usa lo que me enseñaste (entrenamiento interno), tus documentos y lo que hablamos. ';
  if(isOffline()) msg += 'Estamos sin red y no me nota: pregúntame algo. ';
  else msg += 'Prueba: «piénsalo», «oído local» o «¿qué hablamos de café?». ';

  try{
    if (Notification.permission === 'granted'){
      const lastNotif = store.get('lastWelcomeNotif', 0);
      if (Date.now() - lastNotif > 20*3600*1000){
        store.set('lastWelcomeNotif', Date.now());
        setTimeout(()=> notify('ANIA', 'Estoy lista. ¿Qué necesitas?', { tag:'welcome-daily' }), 2500);
      }
    }
  }catch(e){}

  setTimeout(()=>{
    personaReply(msg, msg.slice(0,300));
    const chipsPers = store.get('chipsPersonalizados', null);
    renderChips(chipsPers || ['Piénsalo: ¿qué opinas del café?','¿Qué hablamos de café?','Ponme música','Prepara mi día','Adivina mi personaje']);
  }, 500);

  setTimeout(()=>{ ChatHistory.restore(); }, 800);
  if(GitHub.token){
    GitHub.pull().then(()=>{ const gp = $('ghPill'); if (gp) gp.style.display='inline-flex'; toast('Aprendizaje sincronizado'); }).catch(()=>{});
  }
  setTimeout(()=>{
    renderChips(['Piénsalo: opina del café','Dibújame un panda espacial','Aprende que me gusta madrugar','Pomodoro de 25','Trivia','Ponme música']);
  }, 1200);

  // ⭐ Fase 1 · Activar Background Sync tras el arranque
  setTimeout(() => {
    registrarBackgroundSync().then(ok => {
      if (ok) toast('Autonomía en segundo plano activada');
    });
  }, 3000);

  // ⭐ Fase 2 · Iniciar el núcleo autónomo
  setTimeout(() => {
    if (window.Autonomo && typeof Autonomo.init === 'function'){
      Autonomo.init();
      sysLine('🌙 Núcleo autónomo iniciado · ' + Autonomo.reglas.length + ' reglas activas');
    } else {
      console.warn('[Boot] Autonomo no disponible — revisa que 16-autonomo.js esté cargado');
    }
  }, 5000);
};
