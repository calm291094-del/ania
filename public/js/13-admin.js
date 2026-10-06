/* ============================================================
   13-ADMIN · login/registro, admin panel, perfil, cambio pass, diag
============================================================ */
'use strict';

/* ---------- Mensajes y arranque de sesión ---------- */
function loginMsg(txt, err){ const el=$('loginMsg'); el.textContent=txt; el.classList.toggle('err', !!err); }
function showStart(label){
  $('loginBox').style.display='none';
  const b = $('bootStart');
  b.textContent = label || 'DESPERTAR A ANIA';
  b.style.display = 'block';
}

async function tryLogin(){
  const u = $('loginUser').value.trim();
  const p = $('loginPass').value;
  if (!u || !p){ loginMsg('Completa usuario y contraseña.', true); return; }
  loginMsg('verificando...', false);
  try{
    const res = await AniaAPI.login({ usuario:u, password:p });
    AniaAPI.setSession(res.token, res.usuario);
    finishLogin(res.usuario);
  }catch(e){
    loginMsg(e.message || 'No pude conectar.', true);
  }
}

function finishLogin(u){
  Session = { username:u.usuario, name:u.nombre, role:u.rol||'user', email:u.email, id:u.id, t:Date.now() };
  store.set('session', Session);
  if (Mind.d.nombre !== Session.name && Session.name){ Mind.d.nombre = Session.name; Mind.save(); }
  setOperator();
  loginMsg('Acceso concedido · '+Session.name, false);
  toast('Bienvenido, ' + Session.name);
  CollectiveBrain.sync().then(()=> CollectiveBrain.flushPending()).catch(()=>{});
  setTimeout(()=> showStart('DESPERTAR A ANIA'), 500);
  setTimeout(refrescarBotonAdmin, 150);
  setTimeout(refrescarBotonPerfil, 200);
  setTimeout(cargarPerfilYPersonalizar, 1000);
}

/* ---------- UI registro ---------- */
$('openRegisterBtn').onclick = ()=>{ $('loginBox').style.display='none'; $('registerBox').style.display='flex'; };
$('backToLoginBtn').onclick = ()=>{ $('registerBox').style.display='none'; $('loginBox').style.display='flex'; $('registerMsg').textContent=''; };
$('loginBox').addEventListener('submit', e=>{ e.preventDefault(); tryLogin(); });
$('guestBtn').onclick = ()=>{
  Session = { username:'invitado', name:'Invitado', role:'invitado', t:Date.now() };
  store.set('session', Session);
  showStart('CONTINUAR COMO INVITADO');
};

$('registerBox').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const msg = $('registerMsg');
  const set = (t,err)=>{ msg.textContent=t; msg.style.color = err?'var(--danger)':'var(--dim)'; };
  const nombre  = $('regFullName').value.trim();
  const email   = $('regEmail').value.trim();
  const usuario = $('regUser').value.trim();
  const p1      = $('regPass').value;
  const p2      = $('regPass2').value;
  if (nombre.length < 3) return set('Nombre inválido.', true);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return set('Correo inválido.', true);
  if (!/^[a-zA-Z0-9_.-]{3,20}$/.test(usuario)) return set('Usuario inválido (3-20 alfanuméricos).', true);
  if (p1.length < 6) return set('Contraseña mínimo 6 caracteres.', true);
  if (p1 !== p2) return set('Las contraseñas no coinciden.', true);
  set('Creando tu cuenta...');
  try{
    const res = await AniaAPI.register({ usuario, password:p1, nombre, email });
    AniaAPI.setSession(res.token, res.usuario);
    set('✔ Cuenta creada. Entrando...', false);
    setTimeout(()=> finishLogin(res.usuario), 700);
  }catch(err){ set('✖ '+err.message, true); }
});

/* ---------- Personalización ---------- */
async function cargarPerfilYPersonalizar(){
  if (!Session || !Session.id) return;
  try{
    const d = await AniaAPI.req('/ania/me/perfil');
    const p = d.ok ? d.perfil : null;
    if (!p) return;
    store.set('miPerfil', p);
    aplicarPersonalizacion(p);
  }catch(e){ console.warn('[Personalización]', e.message); }
}
function aplicarPersonalizacion(p){
  const chipsPorTema = {
    cafe:       ['¿Qué café me recomiendas?', 'Receta de pour-over'],
    anime:      ['¿Qué anime veo hoy?', 'Tu personaje favorito'],
    tech:       ['Ayúdame con código', 'Explícame una API'],
    astronomia: ['¿Qué hay en el cielo hoy?', 'Fase lunar'],
    zombies:    ['Plan de supervivencia', 'Mejor peli de zombies'],
    comida:     ['¿Qué cocino hoy?', 'Receta rápida'],
    trabajo:    ['Organiza mi día', 'Recuérdame una reunión'],
    salud:      ['Consejo de descanso', 'Recordatorio de agua']
  };
  const chipsBase = ['Piénsalo: opina del café', 'Ponme música', 'Prepara mi día'];
  const chipsTemas = (p.temas || []).flatMap(t => chipsPorTema[t] || []).slice(0, 3);
  const chipsFinales = [...chipsTemas, ...chipsBase].slice(0, 6);
  store.set('chipsPersonalizados', chipsFinales);
  const saludoHora = { mañana:'Buenos días', tarde:'Buenas tardes', noche:'Buenas noches', madrugada:'Buenas noches' }[p.horario] || 'Hola';
  store.set('saludoPersonalizado', `${saludoHora}, ${p.nombre}.`);
  console.log('🎨 Personalización aplicada:', p.temas.join(', ') || 'sin temas');
}

/* ---------- Cambio contraseña ---------- */
if ($('btnChangePass')){
  $('btnChangePass').onclick = ()=>{
    $('passActual').value = ''; $('passNueva').value = ''; $('passNueva2').value = '';
    $('passMsg').textContent = '';
    openModal('passModal');
  };
}
if ($('savePassBtn')){
  $('savePassBtn').onclick = async ()=>{
    const msg = $('passMsg');
    const set = (t,err)=>{ msg.textContent=t; msg.style.color = err?'var(--danger)':'var(--acc)'; };
    const actual = $('passActual').value, nueva = $('passNueva').value, nueva2 = $('passNueva2').value;
    if (!actual) return set('Falta la contraseña actual.', true);
    if (nueva.length < 6) return set('La nueva debe tener mínimo 6 caracteres.', true);
    if (nueva !== nueva2) return set('Las nuevas no coinciden.', true);
    set('Cambiando...');
    try{
      await AniaAPI.req('/ania/me/password', { method:'POST', body: JSON.stringify({ actual, nueva }) });
      set('✔ Contraseña cambiada', false);
      setTimeout(()=> $('passModal').classList.remove('on'), 1500);
    }catch(e){ set('✖ ' + e.message, true); }
  };
}

/* ---------- Admin panel ---------- */
function esAdmin(){ return Session && (Session.role === 'admin' || Session.role === 'superadmin'); }
function esSuperAdmin(){ return Session && Session.role === 'superadmin'; }
function refrescarBotonAdmin(){ const b = $('btnAdmin'); if (b) b.style.display = esAdmin() ? 'flex' : 'none'; }
function refrescarBotonPerfil(){ const b = $('btnPerfil'); if (b) b.style.display = Session ? 'flex' : 'none'; }

async function cargarPanelAdmin(){
  if (!esAdmin()) return toast('Solo administradores', true);
  if (!AniaAPI.token) return toast('Sesión no válida', true);

  $('adminStats').textContent = 'Actualizando...';
  try{
    const s = await AniaAPI.req('/ania/admin/knowledge-stats');
    const stats = await AniaAPI.req('/ania/admin/stats').catch(()=>({activos:0, bloqueados:0, admins:0, superadmins:0}));
    const elU = $('bentoTotalUsuarios'); if (elU) elU.textContent = s.totalUsuarios;
    const elA = $('bentoActivos'); if (elA) elA.textContent = stats.activos || 0;
    const elB = $('bentoBloqueados'); if (elB) elB.textContent = stats.bloqueados || 0;
    const elC = $('bentoConocimiento'); if (elC) elC.textContent = s.totalConocimiento;
    const elUC = $('bentoUserCount'); if (elUC) elUC.textContent = s.totalUsuarios + ' total';
    $('adminStats').textContent = stats.admins + ' admins · ' + stats.superadmins + ' superadmins · ' + s.totalMemorias + ' memorias privadas';

    const kbBox = $('adminKBList');
    if (!s.topConocimiento || !s.topConocimiento.length){
      kbBox.innerHTML = '<div class="empty">Sin conocimiento compartido todavía</div>';
    } else {
      kbBox.innerHTML = s.topConocimiento.map(e =>
        '<div class="memRow" style="padding:8px 2px;border-bottom:1px dashed rgba(45,224,138,.12);">' +
        '<span class="k" style="color:var(--acc);">' + esc(e.votos) + ' votos</span>' +
        '<span class="v">' + (e.valores && e.valores[0] ? esc(String(e.valores[0]).slice(0,120)) : '(sin valor)') + '</span>' +
        '</div>'
      ).join('');
    }
  }catch(e){ $('adminStats').textContent = '✖ ' + e.message; }

  // Sugerencias
  try{
    const rSug = await fetch(CONFIG.ANIA_API + '/ania/public/sugerencias.json');
    const historial = rSug.ok ? await rSug.json() : [];
    const box = $('adminSugerencias');
    if (!historial.length){
      box.innerHTML = '<div class="empty">Sin análisis todavía</div>';
    } else {
      const ult = historial[0];
      const fecha = esc(new Date(ult.fecha).toLocaleString('es-ES'));
      let html = '<p class="dim" style="font-size:11px;margin-bottom:8px;">' + fecha + ' · ' + esc(ult.analizadoPor || '') + '</p>';
      (ult.mejoras || []).forEach(m => {
        const color = m.prioridad === 'alta' ? 'var(--danger)' : (m.prioridad === 'media' ? 'var(--amber)' : 'var(--acc)');
        html += '<div class="memRow" style="padding:10px 2px;border-bottom:1px dashed rgba(45,224,138,.12);">' +
          '<span class="k" style="color:' + color + ';">' + esc((m.prioridad || '').toUpperCase()) + '</span>' +
          '<span class="v"><b style="color:var(--text);">' + esc(m.titulo || '') + '</b><br>' +
          '<span style="color:var(--dim);font-size:11px;">[' + esc(m.categoria || '') + '] ' + esc(m.descripcion || '') + '</span><br>' +
          '<span style="color:var(--acc2);font-size:11px;font-style:italic;">→ ' + esc(m.como || '') + '</span></span>' +
          '</div>';
      });
      box.innerHTML = html;
    }
  }catch(eSug){ $('adminSugerencias').innerHTML = '<div class="empty">Error al leer sugerencias</div>'; }

  // Seguridad
  try{
    const rSec = await fetch(CONFIG.ANIA_API + '/ania/public/security-report.json');
    const reporte = rSec.ok ? await rSec.json() : null;
    const secBox = $('adminSecurityReport');
    if (!reporte || !reporte.hallazgos || reporte.hallazgos.length === 0){
      secBox.innerHTML = '<div class="empty">Sin hallazgos de seguridad 🎉</div>';
    } else {
      const res = reporte.resumen;
      let html = '<p class="dim" style="font-size:11px;margin-bottom:8px;">Análisis: ' + new Date(reporte.fecha).toLocaleString('es-ES') + '<br>' +
        '<span style="color:var(--danger)">' + res.critico + ' críticos</span> · ' +
        '<span style="color:var(--amber)">' + res.alto + ' altos</span> · ' +
        '<span style="color:var(--acc)">' + res.medio + ' medios</span> · ' +
        '<span style="color:var(--dim)">' + res.bajo + ' bajos</span></p>';
      reporte.hallazgos.forEach(h => {
        const color = h.severidad === 'critico' ? 'var(--danger)' : (h.severidad === 'alto' ? 'var(--amber)' : 'var(--acc)');
        html += '<div style="padding:8px 2px;border-bottom:1px dashed rgba(45,224,138,.12);font-size:12px;">' +
          '<span style="color:' + color + ';font-weight:bold;">[' + h.severidad.toUpperCase() + ']</span> ' +
          '<span style="color:var(--text);">' + (h.descripcion || '') + '</span>' +
          (h.solucion ? '<br><span style="color:var(--dim);font-size:11px;">→ ' + h.solucion + '</span>' : '') +
          '</div>';
      });
      secBox.innerHTML = html;
    }
  }catch(eSec){ $('adminSecurityReport').innerHTML = '<div class="empty" style="color:var(--danger);">✖ ' + eSec.message + '</div>'; }

  // Log admin
  try{
    const dLog = await AniaAPI.req('/ania/admin/log');
    const logBox = $('adminLogList');
    if (!logBox){
      console.warn('[DIAG] No existe #adminLogList');
    } else if (!dLog.log || !dLog.log.length){
      logBox.innerHTML = '<div class="empty" style="font-size:11px;">Sin acciones registradas</div>';
    } else {
      logBox.innerHTML = dLog.log.map(e => {
        const fecha = new Date(e.t).toLocaleString('es-ES', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
        const color = /eliminar/.test(e.accion) ? 'var(--danger)' : (/bloquear/.test(e.accion) ? 'var(--amber)' : 'var(--acc)');
        const target = e.target ? (' → ' + e.target.usuario) : '';
        const detalles = e.detalles ? (' · ' + e.detalles) : '';
        return '<div style="padding:8px 2px;border-bottom:1px dashed rgba(45,224,138,.12);font-size:11px;line-height:1.5;">' +
          '<span style="color:var(--dim);font-size:9px;letter-spacing:.05em;">' + fecha + '</span><br>' +
          '<span style="color:var(--acc2);">@' + e.admin.usuario + '</span> ' +
          '<span style="color:' + color + ';font-weight:bold;">' + e.accion + '</span>' +
          '<span style="color:var(--text);">' + target + '</span>' +
          '<span style="color:var(--dim);font-size:10px;">' + detalles + '</span>' +
          '</div>';
      }).join('');
    }
  }catch(eLog){
    console.error('[DIAG] Error log:', eLog);
    const logBox = $('adminLogList');
    if (logBox) logBox.innerHTML = '<div class="empty" style="color:var(--danger);font-size:11px;">✖ ' + eLog.message + '</div>';
  }

  // Usuarios
  try{
    const d = await AniaAPI.req('/ania/admin/users');
    const lista = $('adminUsersList');
    if (!d.usuarios.length){
      lista.innerHTML = '<div class="empty">Sin usuarios</div>';
    } else {
      lista.innerHTML = d.usuarios.map(u => {
        const fecha = new Date(u.creado).toLocaleDateString('es-ES');
        const ultAcc = u.ultimoAcceso ? new Date(u.ultimoAcceso).toLocaleDateString('es-ES') : '—';
        const rolColor = u.rol === 'superadmin' ? 'var(--danger)' : (u.rol === 'admin' ? 'var(--amber)' : 'var(--acc)');
        const esYo = Session && Session.id === u.id;
        const puedoRol = esSuperAdmin() && !esYo && u.rol !== 'superadmin';
        const puedoBloquear = esAdmin() && !esYo && u.rol !== 'superadmin';
        const puedoEliminar = esSuperAdmin() && !esYo && u.rol !== 'superadmin';
        const estado = u.bloqueado
          ? '<span style="color:var(--danger);font-size:10px;">● BLOQUEADO</span>'
          : '<span style="color:var(--acc2);font-size:10px;">● ACTIVO</span>';
        let acciones = '<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;">';
        if (puedoRol){
          const nuevoRol = u.rol === 'admin' ? 'user' : 'admin';
          const etiqueta = u.rol === 'admin' ? 'QUITAR ADMIN' : 'HACER ADMIN';
          acciones += '<button class="chip" data-action="role" data-id="' + u.id + '" data-rol="' + nuevoRol + '" style="font-size:10px;">' + etiqueta + '</button>';
        }
        if (puedoBloquear){
          acciones += '<button class="chip" data-action="block" data-id="' + u.id + '" style="font-size:10px;">' + (u.bloqueado ? 'DESBLOQUEAR' : 'BLOQUEAR') + '</button>';
        }
        acciones += '<button class="chip" data-action="reset" data-id="' + u.id + '" style="font-size:10px;">RESET PASS</button>';
        if (puedoEliminar){
          acciones += '<button class="chip" data-action="delete" data-id="' + u.id + '" style="font-size:10px;color:var(--danger);border-color:rgba(255,84,112,.4);">ELIMINAR</button>';
        }
        acciones += '</div>';
        return '<div class="memRow" style="padding:10px 2px;border-bottom:1px dashed rgba(45,224,138,.12);">' +
          '<span class="k" style="color:' + rolColor + ';">' + u.rol.toUpperCase() + '<br>' + estado + '</span>' +
          '<span class="v"><b style="color:var(--text);">' + u.nombre + '</b>' + (esYo ? ' <span style="color:var(--dim);font-size:10px;">(tú)</span>' : '') + '<br>' +
          '<span style="color:var(--dim);font-size:11px;">@' + u.usuario + ' · ' + u.email + '</span><br>' +
          '<span style="color:var(--dim);font-size:10px;">reg: ' + fecha + ' · últ. acceso: ' + ultAcc + '</span>' +
          acciones + '</span></div>';
      }).join('');

      lista.querySelectorAll('[data-action="role"]').forEach(b => b.onclick = async ()=>{
        if (!confirm('¿Cambiar rol?')) return;
        try{ await AniaAPI.req('/ania/admin/set-role', { method:'POST', body: JSON.stringify({ userId: b.dataset.id, rol: b.dataset.rol }) }); toast('Rol actualizado'); cargarPanelAdmin(); }
        catch(e){ toast(e.message, true); }
      });
      lista.querySelectorAll('[data-action="block"]').forEach(b => b.onclick = async ()=>{
        try{
          const r = await AniaAPI.req('/ania/admin/toggle-block', { method:'POST', body: JSON.stringify({ userId: b.dataset.id }) });
          toast(r.bloqueado ? 'Usuario bloqueado' : 'Usuario desbloqueado'); cargarPanelAdmin();
        }catch(e){ toast(e.message, true); }
      });
      lista.querySelectorAll('[data-action="delete"]').forEach(b => b.onclick = async ()=>{
        if (!confirm('⚠ ELIMINAR usuario y su memoria. ¿Seguro?')) return;
        if (!confirm('Última confirmación. Irreversible.')) return;
        try{ await AniaAPI.req('/ania/admin/delete-user', { method:'POST', body: JSON.stringify({ userId: b.dataset.id }) }); toast('Usuario eliminado'); cargarPanelAdmin(); }
        catch(e){ toast(e.message, true); }
      });
      lista.querySelectorAll('[data-action="reset"]').forEach(b => b.onclick = async ()=>{
        const nueva = prompt('Nueva contraseña (mín 6):');
        if (!nueva) return;
        if (nueva.length < 6) return toast('Mínimo 6 caracteres', true);
        try{ await AniaAPI.req('/ania/admin/reset-password', { method:'POST', body: JSON.stringify({ userId: b.dataset.id, nueva }) }); toast('Contraseña reseteada'); }
        catch(e){ toast(e.message, true); }
      });
    }
  }catch(e){ $('adminUsersList').innerHTML = '<div class="empty" style="color:var(--danger);">✖ ' + e.message + '</div>'; }
}

if ($('btnAdmin')){
  $('btnAdmin').onclick = ()=>{ openModal('adminModal'); cargarPanelAdmin(); };
}
setTimeout(refrescarBotonAdmin, 2000);

/* ---------- Perfil usuario ---------- */
async function cargarMiPerfil(){
  if (!Session || !AniaAPI.token) return;
  $('perfilSubtitulo').textContent = 'Cargando...';
  try{
    const d = await AniaAPI.req('/ania/me/perfil');
    if (!d.ok){ $('perfilSubtitulo').textContent = d.error || 'Sin perfil generado todavía'; return; }
    const p = d.perfil, s = d.stats;
    $('perfilInteracciones').textContent = p.interacciones || 0;
    $('perfilHechos').textContent = s.hechos || 0;
    $('perfilGustos').textContent = s.gustos || 0;
    $('perfilLongitud').textContent = p.longitudMedia || 0;
    const fecha = p.actualizado ? new Date(p.actualizado).toLocaleDateString('es-ES') : '—';
    $('perfilSubtitulo').textContent = p.nombre + ' · actualizado el ' + fecha;
    const temasBox = $('perfilTemas');
    const nombresTemas = { cafe:'☕ Café', anime:'🎌 Anime', tech:'💻 Tecnología', astronomia:'🌌 Astronomía', zombies:'🧟 Zombies', comida:'🍕 Comida', trabajo:'💼 Trabajo', salud:'💚 Salud' };
    if (!p.temas || !p.temas.length){
      temasBox.innerHTML = '<div class="empty">Aún no tengo suficientes datos para detectar tus temas.</div>';
    } else {
      temasBox.innerHTML = p.temas.map((t, i) => {
        const color = i === 0 ? 'var(--acc2)' : (i === 1 ? 'var(--amber)' : 'var(--acc)');
        return '<div style="padding:8px 0;border-bottom:1px dashed rgba(45,224,138,.12);display:flex;align-items:center;gap:10px;">' +
          '<span style="font-size:20px;">' + (nombresTemas[t] || '·') + '</span>' +
          '<span style="font-size:13px;color:' + color + ';letter-spacing:.1em;">' + t.toUpperCase() + '</span></div>';
      }).join('');
    }
    const estiloBox = $('perfilEstilo');
    const tonoTexto = {
      'formal':'📝 Formal · prefieres comunicación estructurada','informal':'😎 Informal · te gusta el lenguaje relajado','neutro':'⚖️ Neutro · adaptas tu tono al contexto','informal-expresivo':'🎉 Informal y expresivo','formal-expresivo':'🎩 Formal pero expresivo','neutro-urgente':'⚡ Neutro y directo','informal-urgente':'🔥 Informal y urgente'
    }[p.tono] || p.tono;
    const horarioTexto = {
      'mañana':'🌅 Activo por la mañana','tarde':'☀️ Activo por la tarde','noche':'🌙 Activo por la noche','madrugada':'🌌 Noctámbulo','variable':'🕐 Horarios variables'
    }[p.horario] || p.horario;
    estiloBox.innerHTML =
      '<div style="padding:8px 0;border-bottom:1px dashed rgba(45,224,138,.12);font-size:13px;">' + tonoTexto + '</div>' +
      '<div style="padding:8px 0;font-size:13px;">' + horarioTexto + '</div>';
  }catch(e){ $('perfilSubtitulo').textContent = '✖ ' + e.message; }
}
if ($('btnPerfil')){ $('btnPerfil').onclick = ()=>{ openModal('perfilModal'); cargarMiPerfil(); }; }
setTimeout(refrescarBotonPerfil, 2000);

/* ---------- Ajustes ---------- */
function renderVoiceSelect(){
  const sel = $('voiceSelect');
  if(!voices.length){ sel.innerHTML = '<option>No hay voces</option>'; return; }
  sel.innerHTML = voices.map(v=>`<option value="${esc(v.name)}">${esc(v.name)}</option>`).join('');
  if(S.voice) sel.value = S.voice.name;
}
$('btnSettings').onclick = ()=>{
  renderVoiceSelect(); fillSess(); updateDocsUI(); updatePCUI(); paintAgent();
  Brain.paint(); refreshEarsUI(); refreshRelayUI();
  openModal('settingsModal');
};
$('voiceSelect').onchange = e=>{ S.voice = voices.find(v=>v.name===e.target.value) || S.voice; if(S.voice) store.set('voiceName', S.voice.name); };
$('rateRange').oninput = e=>{ S.rate = +e.target.value; $('rateOut').value = S.rate; store.set('rate', S.rate); };
$('pitchRange').oninput = e=>{ S.pitch = +e.target.value; $('pitchOut').value = S.pitch; store.set('pitch', S.pitch); };
$('rateRange').value = S.rate; $('rateOut').value = S.rate;
$('pitchRange').value = S.pitch; $('pitchOut').value = S.pitch;
$('testVoice').onclick = ()=> speak('Soy Ania, hoy me siento '+mood().tag+'.');
$('btnAlways').onclick = ()=> setAlways(!alwaysOn);
updateVoiceUI();

/* ---------- Diagnóstico ---------- */
async function runDiag(){
  const rows = [];
  rows.push('Contexto: '+(SECURE?'seguro':'file://'));
  rows.push('Red: '+(isOffline()?'sin conexión':'conectado'));
  rows.push('CEREBRO: '+(Brain.localReady ? 'LOCAL ('+Brain.modelName+')' : (isOffline()?'LocalMind conversacional':'nube')));
  rows.push('OÍDO: '+(Ears.on?'LOCAL (whisper)':'google'));
  rows.push('HUD: '+(HUD.on?'abierto':'off'));
  rows.push('Sesión: '+(Relay.on?Relay.url:'off'));
  rows.push('Agente PC: '+(Agent.ok?'on':'off'));
  rows.push('LocalMind: entrenamiento='+TRAINING.length+' · episodios='+Episodio.log.length+' · docs='+DocBrain.count());
  rows.push('Agenda: '+taskPending()+' · Ánimo: '+mood().tag);
  rows.push('GitHub: '+(GitHub.token?'CONECTADO':'off'));
  rows.push('Aprendido: '+Learned.count()+' · Pomodoro: '+Pomodoro.sessions);
  try{ if(navigator.getBattery){ const b = await navigator.getBattery(); rows.splice(2,0,'Batería: '+Math.round(b.level*100)+'%'); } }catch(e){}
  $('diag').innerHTML = rows.map(r=>'<b>»</b> '+esc(r)).join('<br>');
}
$('runDiag').onclick = runDiag;
