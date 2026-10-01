/* ============================================================
   02-UI · toasts, tema, logo, mood bubble
============================================================ */
'use strict';

/* ---------- Toasts (usa NotifyX) ---------- */
function toast(msg, warn){
  if (typeof NotifyX === 'undefined'){ console.warn('[NotifyX no cargado]', msg); return; }
  if (warn) NotifyX.warning(msg, { title: 'ANIA' });
  else      NotifyX.success(msg, { title: 'ANIA' });
}
function toastError(msg){ if (typeof NotifyX !== 'undefined') NotifyX.error(msg, { title: 'ANIA · Error' }); }
function toastInfo(msg){ if (typeof NotifyX !== 'undefined') NotifyX.info(msg, { title: 'ANIA' }); }
function toastLoading(msg){ if (typeof NotifyX !== 'undefined') return NotifyX.loading(msg, { title: 'ANIA · Procesando' }); }
function toastAI(msg, meta){ if (typeof NotifyX !== 'undefined') NotifyX.ai(msg, { title: 'ANIA · IA', ai: meta || {} }); }

/* ---------- Tema / esencias ---------- */
const ESSENCES = {
  verde:  {acc:'#2de08a', acc2:'#39ff9b'},
  morado: {acc:'#b18cff', acc2:'#c9a6ff'},
  carmesi:{acc:'#ff5470', acc2:'#ff7d94'},
  hielo:  {acc:'#9fdcff', acc2:'#cdeeff'}
};
let essence = store.get('essence', 'verde');
let ACC_RGB = [45,224,138];

function applyEssence(name){
  essence = ESSENCES[name] ? name : 'verde';
  const e = ESSENCES[essence];
  const rs = document.documentElement.style;
  rs.setProperty('--acc', e.acc);
  rs.setProperty('--acc2', e.acc2);
  const h = e.acc.replace('#','');
  ACC_RGB = [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
  store.set('essence', essence);
  document.querySelectorAll('.esBtn').forEach(b => b.classList.toggle('esSel', b.dataset.es === essence));
}
applyEssence(essence);

/* ---------- Logo reactivo ---------- */
const LogoController = {
  el: null, currentState: 'idle',
  states: ['idle', 'listening', 'thinking', 'speaking', 'offline'],
  tags: { idle:'SYS', listening:'REC', thinking:'PROC', speaking:'TALK', offline:'OFF' },
  idleTagTimer: null, idleTagIdx: 0,
  idleTagCycle: ['SYS','IA','RDY','OK','LIVE','ON'],

  init(){
    function arrancar(){
      const el = document.getElementById('logo');
      if (!el){ setTimeout(arrancar, 300); return; }
      this.el = el;
      this.attachEvents();
      this.setState('idle');
      console.log('🎨 LogoController iniciado');
    }
    if (document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', () => arrancar.call(this));
    } else {
      arrancar.call(this);
    }
  },

  attachEvents(){
    window.addEventListener('online', () => { if (this.currentState === 'offline') this.setState('idle'); });
    window.addEventListener('offline', () => this.setState('offline'));
  },

  setState(nuevo){
    if (!this.el) return;
    if (!this.states.includes(nuevo)) return;
    if (this.currentState === nuevo && this.el.classList.contains('logo-' + nuevo)) return;

    this.el.classList.remove('logo-' + this.currentState);
    this.el.classList.add('logo-' + nuevo);
    this.currentState = nuevo;

    const tag = this.el.querySelector('#logoTAG');
    if (tag){
      if (nuevo === 'idle') this.startIdleTagCycle();
      else { this.stopIdleTagCycle(); tag.textContent = this.tags[nuevo] || ''; tag.classList.add('on'); }
    }
    console.log('🎨 Logo →', nuevo);
  },

  startIdleTagCycle(){
    const tag = this.el && this.el.querySelector('#logoTAG');
    if (!tag) return;
    this.stopIdleTagCycle();
    setTimeout(() => {
      if (this.currentState !== 'idle') return;
      tag.textContent = this.idleTagCycle[0];
      tag.classList.add('on');
      this.idleTagIdx = 1;
      setTimeout(() => tag.classList.remove('on'), 1800);
    }, 2000);
    this.idleTagTimer = setInterval(() => {
      if (this.currentState !== 'idle') return;
      tag.textContent = this.idleTagCycle[this.idleTagIdx % this.idleTagCycle.length];
      tag.classList.add('on');
      this.idleTagIdx++;
      setTimeout(() => tag.classList.remove('on'), 1800);
    }, 4000);
  },

  stopIdleTagCycle(){
    if (this.idleTagTimer){ clearInterval(this.idleTagTimer); this.idleTagTimer = null; }
  }
};
LogoController.init();

/* ---------- Reloj / red / batería ---------- */
function tickClock(){ const c = $('clock'); if (c) c.textContent = new Date().toLocaleTimeString('es-ES'); }
setInterval(tickClock, 1000); tickClock();

function updateNet(){
  const off = isOffline();
  const n = (typeof OfflineQueue !== 'undefined' && OfflineQueue.count) ? OfflineQueue.count() : 0;
  $('netPill').classList.toggle('off', off);
  $('netTxt').textContent = off
    ? 'SIN CONEXIÓN' + (n ? ' · '+n+' EN COLA' : '')
    : 'EN LÍNEA';
  if (typeof LogoController !== 'undefined' && LogoController.el && LogoController.setState){
    if (off) LogoController.setState('offline');
    else if (LogoController.currentState === 'offline') LogoController.setState('idle');
  }
}
addEventListener('online', ()=>{ updateNet(); toast('Conexión restaurada'); });
addEventListener('offline', ()=>{ updateNet(); toast('Modo offline: núcleo personal activo', true); });
updateNet();

function updateBatt(){
  if(!navigator.getBattery) return;
  navigator.getBattery().then(b => {
    S.batt = { level:b.level, charging:b.charging };
    $('batt').style.display = 'inline';
    $('batt').textContent = Math.round(b.level*100)+'%'+(b.charging?'·C':'');
  }).catch(()=>{});
}
setInterval(updateBatt, 60000); updateBatt();

/* ---------- Burbuja de ánimo ---------- */
function actualizarBurbujaAnimo(){
  const b = document.getElementById('moodBubble');
  if (!b) return;
  const e = (typeof Mind !== 'undefined' && Mind.d.estadoEmocional) || null;
  if (!e) { b.textContent = '😊'; return; }
  let emoji = '😊';
  if (e.energia >= 8) emoji = '⚡';
  else if (e.energia <= 3) emoji = '😴';
  else if (e.empatia >= 9) emoji = '💖';
  else if (e.curiosidad >= 9) emoji = '🤔';
  else if (e.profundidad >= 8) emoji = '🧠';
  b.textContent = emoji;
}
setInterval(actualizarBurbujaAnimo, 5000);
setTimeout(() => {
  const b = document.getElementById('moodBubble');
  if (b) {
    b.style.display = 'grid';
    b.onclick = () => {
      if (typeof manejarComandoAlias === 'function'){
        const cmd = manejarComandoAlias('emocion', '/emocion');
        if (cmd) personaReply(cmd);
      }
    };
  }
  actualizarBurbujaAnimo();
}, 3000);