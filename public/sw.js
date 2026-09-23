/* ANIA v9 · service worker "OFFLINE-FOREVER"
   Estrategia:
   1. INSTALACIÓN TOLERANTE: cada recurso se cachea por separado. Si uno falla,
      el resto queda guardado (addAll atómico era el bug: si icon.svg faltaba,
      NO se cacheaba NADA → offline salía página de error).
   2. NAVEGACIÓN: caché SIEMPRE primero (instantáneo, offline garantizado,
      ignora ?source=pwa de Android) + actualización en 2º plano con red.
   3. FUENTES DE GOOGLE cacheadas → offline se ve idéntico.
   4. modelos/ (GGUF) jamás al caché · documentos/ red-primero ·
      engine/ y modelos de IA: caché de runtime (offline tras 1er uso).
   REGLA DE ACTUALIZACIÓN: cuando cambies index.html, sube este archivo
   con CACHE incrementado (ania-v9 → ania-v10). */

const CACHE = 'ania-v9';
const RUNTIME = 'ania-runtime-v9';
const APP_SHELL = ['./', './index.html', './manifest.json', './icon.svg'];
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

/* ---------- INSTALACIÓN: tolerante + verificación ---------- */
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    /* cada archivo por separado: un 404 NO tumba la instalación */
    await Promise.all(APP_SHELL.map(async url => {
      try{ await c.add(new Request(url, {cache:'reload'})); }
      catch(err){ console.warn('[SW] no pude cachear:', url); }
    }));
    /* fuente de Google (opcional: si falla, offline cae a monospace) */
    try{ await c.add(new Request(FONT_CSS, {cache:'reload', mode:'no-cors'})); }
    catch(err){ console.warn('[SW] fuente CSS sin cachear'); }
    /* verificación del núcleo: si index.html no quedó, reintento */
    if(!await c.match('./index.html') && !await c.match('./')){
      try{ await c.add(new Request('./index.html', {cache:'reload'})); }
      catch(e2){ console.error('[SW] CRÍTICO: index.html no se pudo cachear'); }
    }
    await self.skipWaiting();
  })());
});

/* ---------- ACTIVACIÓN: limpieza + aviso a la app ---------- */
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(k => (k.startsWith('ania-') && k !== CACHE) || (k.startsWith('ania-runtime-') && k !== RUNTIME))
        .map(k => caches.delete(k))
    );
    await self.clients.claim();
    /* avisa a Ania: modo offline garantizado */
    const cs = await self.clients.matchAll({includeUncontrolled:true, type:'window'});
    cs.forEach(cl => cl.postMessage({type:'ANIA_OFFLINE_READY', cache: CACHE}));
  })());
});

/* ---------- MENSAJES desde la app ---------- */
self.addEventListener('message', e => {
  if(e.data === 'SKIP_WAITING' || (e.data && e.data.type === 'SKIP_WAITING')) self.skipWaiting();
});

/* ---------- FETCH: el corazón del offline ---------- */
self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);

  /* GGUF (cientos de MB): jamás al caché, red directa */
  if(url.origin === location.origin && url.pathname.includes('/modelos/')) return;

  /* ===== NAVEGACIÓN: abrir la app =====
     Caché SIEMPRE primero (funciona sin internet, ignora ?source=pwa)
     y refresco en segundo plano cuando hay red. */
  if(req.mode === 'navigate' || req.destination === 'document'){
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      const hit = (await c.match('./index.html', {ignoreSearch:true}))
                || (await c.match('./', {ignoreSearch:true}))
                || (await c.match(req, {ignoreSearch:true}));
      /* actualización silenciosa en 2º plano */
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

  /* ===== FUENTES DE GOOGLE: caché-primero ===== */
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

  /* ===== cross-origin que no es IA → sin interceptar (Pollinations etc.) ===== */
  if(url.origin !== location.origin && !AI_PREFIXES.some(p => url.href.startsWith(p))) return;

  /* ===== MODELOS DE IA (whisper/mediapipe/wllama): runtime ===== */
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

  /* ===== mismo origen ===== */

  /* engine/ (runtime IA local): caché-primero */
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

  /* documentos/ (entrenamiento actualizable): red-primero */
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

  /* resto del app shell: stale-while-revalidate
     (sirve caché instantáneo + actualiza por debajo si hay red) */
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
