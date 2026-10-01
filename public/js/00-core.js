/* ============================================================
   00-CORE · CONFIG, store, helpers, estado global
============================================================ */
'use strict';

/* ---------- NotifyX config ---------- */
if (typeof NotifyX !== 'undefined'){
  NotifyX.configure({
    theme: 'glass', animation: 'spring', position: 'top-right',
    duration: 4000, maxToasts: 4, pauseOnHover: true
  });
}

/* ---------- Constantes ---------- */
const ORIGINAL_HTML = '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
const SECURE = window.isSecureContext === true;

const CONFIG = {
  BACKEND_URL: 'https://ania-oqct.onrender.com',
  ANIA_API: 'https://ania-oqct.onrender.com',
  ANIA_USER: 'admin', SYNC_INTERVAL: 45000,
  USERS_URLS: [],
  WLLAMA_CDN: './vendor/wllama/index.mjs',
  WLLAMA_WASM_CDN: './vendor/wllama/',
  TRANSFORMERS_CDN: './vendor/transformers/transformers.min.js',
  MEDIAPIPE_CDN: './vendor/mediapipe',
  MEDIAPIPE_MODEL: './models/hand_landmarker.task'
};

/* ---------- Utilidades ---------- */
const $ = id => document.getElementById(id);
const store = {
  get(k,d){ try{ const v = JSON.parse(localStorage.getItem('ania_'+k)); return v===null?d:v; }catch(e){ return d; } },
  set(k,v){ try{ localStorage.setItem('ania_'+k, JSON.stringify(v)); }catch(e){} },
  del(k){ localStorage.removeItem('ania_'+k); }
};

const pick = a => a[Math.floor(Math.random()*a.length)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const isOffline = () => !navigator.onLine;
const stripP = s => s.replace(/\([^)]*\)/g,' ').replace(/\s+/g,' ').trim();
function vibrate(p){ try{ navigator.vibrate && navigator.vibrate(p); }catch(e){} }

const DEVICE_ID = (function(){
  let id = store.get('deviceId', null);
  if(!id){ id = 'dev-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8); store.set('deviceId', id); }
  return id;
})();
const DEV_TAG = DEVICE_ID.slice(4,14);

/* ---------- Fetch helpers ---------- */
async function jget(url, t=9000){
  const c = new AbortController();
  const id = setTimeout(()=>c.abort(), t);
  try{
    const r = await fetch(url, {signal:c.signal});
    if(!r.ok) throw new Error(r.status);
    return await r.json();
  } finally { clearTimeout(id); }
}
function jsonp(url, timeout=8000){
  return new Promise((resolve, reject)=>{
    const cb = '__aniaCB'+Date.now().toString(36)+Math.floor(Math.random()*1e5);
    const script = document.createElement('script');
    const timer = setTimeout(()=>{ cleanup(); reject(new Error('timeout')); }, timeout);
    function cleanup(){ clearTimeout(timer); try{ delete window[cb]; }catch(e){ window[cb]=undefined; } script.remove(); }
    window[cb] = data => { cleanup(); resolve(data); };
    script.onerror = ()=>{ cleanup(); reject(new Error('net')); };
    script.src = url + (url.includes('?')?'&':'?') + 'callback=' + cb;
    document.head.appendChild(script);
  });
}

/* ---------- Estado global ---------- */
const S = {
  phase:'idle', muted: store.get('muted', false),
  voice:null, rate: store.get('rate',1.05), pitch: store.get('pitch',1.10),
  awaitingCity:false, booted:false, confirmWipe:false,
  lastUserTs:0, batt:null
};

/* ---------- Detección de modo local ---------- */
(function(){
  const host = location.hostname;
  if (host === 'localhost' || host === '127.0.0.1'){
    CONFIG.ANIA_API = 'http://' + location.host;
    CONFIG.BACKEND_URL = 'http://' + location.host;
    store.set('agentActivado', true);
    console.log('🏠 Modo local activado · API y agente en ' + location.host);
  }
})();

/* ---------- Sesión ---------- */
let Session = store.get('session', null);