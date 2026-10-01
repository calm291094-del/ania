/* ANIA v10 · service worker "OFFLINE-FOREVER" */
const CACHE = 'ania-v10';
const RUNTIME = 'ania-runtime-v9';

const APP_SHELL = [
  './', './index.html', './manifest.json', './icon.svg',

  // CSS
  './css/base.css',
  './css/logo.css',
  './css/chat.css',
  './css/overlays.css',
  './css/dock.css',

  // JS core
  './js/00-core.js',
  './js/01-lingua.js',
  './js/02-ui.js',
  './js/03-canvas.js',
  './js/04-audio.js',
  './js/05-stt.js',
  './js/06-mind.js',
  './js/07-localmind.js',
  './js/08-brain.js',
  './js/09-features.js',
  './js/10-api.js',
  './js/11-chat.js',
  './js/12-respond.js',
  './js/13-admin.js',
  './js/14-boot.js',
  './js/15-dock.js',

  // Módulos Jarvis
  './modulos/finanzas.js',
  './modulos/inventario.js',
  './modulos/compras.js',
  './modulos/dashboard.js',
  './modulos/jarvis-ui.js',

  // Data
  './data/entrenamiento.json',
  './data/comandos-alias.json',

  // Vendor
  './vendor/notifyx.min.css',
  './vendor/notifyx.min.js',
  './vendor/h5wasm/h5wasm.js',
  './vendor/vosk.min.js',
  './vendor/mediapipe/vision_bundle.mjs',
  './vendor/mediapipe-wasm/vision_wasm_internal.js',
  './vendor/mediapipe-wasm/vision_wasm_internal.wasm',
  './vendor/mediapipe-wasm/vision_wasm_nosimd_internal.js',
  './vendor/mediapipe-wasm/vision_wasm_nosimd_internal.wasm',
  './vendor/transformers/transformers.min.js',
  './vendor/wllama/index.mjs',
  './vendor/wllama/wllama.wasm',
  './fonts/share-tech-mono.woff2',
  './models/hand_landmarker.task'
];

const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap';

const AI_PREFIXES = [
  'https://cdn.jsdelivr.net/npm/@huggingface/',
  'https://cdn.jsdelivr.net/npm/@mediapipe/',
  'https://cdn.jsdelivr.net/npm/@wllama/',
  'https://huggingface.co/',
  'https://cdn-lfs.huggingface.co/',
  'https://storage.googleapis.com/mediapipe-models/'
];
const FONT_PREFIXES = ['https://fonts.googleapis.com/', 'https://fonts.gstatic.com/'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(APP_SHELL.map(async url => {
      try{ await c.add(new Request(url, {cache:'reload'})); }
      catch(err){ console.warn('[SW] no pude cachear:', url); }
    }));
    try{ await c.add(new Request(FONT_CSS, {cache:'reload', mode:'no-cors'})); }
    catch(err){ console.warn('[SW] fuente CSS sin cachear'); }
    if(!await c.match('./index.html') && !await c.match('./')){
      try{ await c.add(new Request('./index.html', {cache:'reload'})); }
      catch(e2){ console.error('[SW] CRÍTICO: index.html no se pudo cachear'); }
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(k => (k.startsWith('ania-') && k !== CACHE) || (k.startsWith('ania-runtime-') && k !== RUNTIME))
        .map(k => caches.delete(k))
    );
    await self.clients.claim();
    const cs = await self.clients.matchAll({includeUncontrolled:true, type:'window'});
    cs.forEach(cl => cl.postMessage({type:'ANIA_OFFLINE_READY', cache: CACHE}));
  })());
});

self.addEventListener('message', e => {
  if(e.data === 'SKIP_WAITING' || (e.data && e.data.type === 'SKIP_WAITING')) self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);

  if(url.origin === location.origin && url.pathname.includes('/modelos/')) return;

  if(req.mode === 'navigate' || req.destination === 'document'){
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      const hit = (await c.match('./index.html', {ignoreSearch:true}))
                || (await c.match('./', {ignoreSearch:true}))
                || (await c.match(req, {ignoreSearch:true}));
      fetch('./index.html', {cache:'reload'}).then(async res => {
        if(res.ok) await c.put('./index.html', res);
      }).catch(()=>{});
      if(hit) return hit;
      try{ return await fetch(req); }
      catch(err){
        return new Response(
          '<!DOCTYPE html><html><head><meta charset="utf-8"><title>ANIA sin caché</title></head>'+
          '<body style="background:#040806;color:#2de08a;font-family:monospace;padding:40px;text-align:center">'+
          '<h1>ANIA · núcleo sin caché</h1>'+
          '<p>Ábreme UNA vez con internet y quedaré lista para abrirme siempre sin conexión.</p>'+
          '</body></html>',
          {headers:{'Content-Type':'text/html'}}
        );
      }
    })());
    return;
  }

  if(FONT_PREFIXES.some(p => url.href.startsWith(p))){
    e.respondWith((async () => {
      const c = await caches.open(RUNTIME);
      const hit = await c.match(req, {ignoreSearch:true});
      if(hit) return hit;
      try{
        const res = await fetch(req);
        try{ const cp = res.clone(); await c.put(req, cp); }catch(e2){}
        return res;
      }catch(err){ return hit || Response.error(); }
    })());
    return;
  }

  if(url.origin !== location.origin && !AI_PREFIXES.some(p => url.href.startsWith(p))) return;

  if(AI_PREFIXES.some(p => url.href.startsWith(p))){
    e.respondWith((async () => {
      const c = await caches.open(RUNTIME);
      const hit = await c.match(req);
      const net = fetch(req).then(async res => {
        if(res.ok){ try{ const cp = res.clone(); await c.put(req, cp); }catch(e2){} }
        return res;
      }).catch(() => null);
      return hit || (await net) || hit;
    })());
    return;
  }

  if(url.pathname.includes('/engine/')){
    e.respondWith((async () => {
      const c = await caches.open(RUNTIME);
      const hit = await c.match(req);
      if(hit) return hit;
      const res = await fetch(req);
      try{ const cp = res.clone(); await c.put(req, cp); }catch(e2){}
      return res;
    })());
    return;
  }

  if(url.pathname.includes('/documentos/')){
    e.respondWith((async () => {
      try{
        const res = await fetch(req);
        const c = await caches.open(CACHE);
        try{ const cp = res.clone(); await c.put(req, cp); }catch(e2){}
        return res;
      }catch(err){
        return (await caches.match(req)) || Response.error();
      }
    })());
    return;
  }

  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(req, {ignoreSearch:true});
    if(hit){
      fetch(req, {cache:'reload'}).then(async res => {
        if(res.ok) await c.put(req, res);
      }).catch(()=>{});
      return hit;
    }
    const res = await fetch(req);
    try{ const cp = res.clone(); await c.put(req, cp); }catch(e2){}
    return res;
  })());
});
