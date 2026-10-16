/* ============================================================
   ANIA · Módulo de archivos remotos (GitHub)
   - 🎵 Reproductor MP3 desde musica/ (con subcarpetas)
   - 📄 Visor DOCX/PDF/TXT/MD desde documentos/
   - 🌐 Navegador interno HTML desde htmls/
   - 🎨 Fondo remoto desde fondos/
   - 🧠 Entrenamiento de Ania con todos los docs (recursivo)
   ============================================================ */
(function () {
  'use strict';

  /* ═══════════════════════════════════════════════════════════
     CONFIGURACIÓN · Apunta a tu repo
  ═══════════════════════════════════════════════════════════ */
  const CFG = {
    USER:   'calm291094-del',
    REPO:   'ania',
    BRANCH: 'main',
    PATHS: {
      docs:   'documentos',
      music:  'musica',
      htmls:  'htmls',
      fondos: 'fondos'
    },
    // jsDelivr para archivos (rápido, CORS, soporta subcarpetas)
    CDN: (p) => 'https://cdn.jsdelivr.net/gh/' + CFG.USER + '/' + CFG.REPO + '@' + CFG.BRANCH + '/' + p.split('/').map(encodeURIComponent).join('/'),
    // API de GitHub para listar carpetas
    API: (p) => 'https://api.github.com/repos/' + CFG.USER + '/' + CFG.REPO + '/contents/' + p.split('/').map(encodeURIComponent).join('/') + '?ref=' + CFG.BRANCH
  };

  /* ═══════════════════════════════════════════════════════════
     UTILIDADES
  ═══════════════════════════════════════════════════════════ */
  const el  = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function toastR(txt, tipo) {
    if (typeof window.toast === 'function') { try { return window.toast(txt, tipo); } catch (e) {} }
    console.log('[Remote]', txt);
  }
  function chatR(txt) {
    if (typeof window.reply === 'function') { try { return window.reply(txt); } catch (e) {} }
    if (typeof window.personaReply === 'function') { try { return window.personaReply(txt); } catch (e) {} }
    console.log('[Remote→chat]', txt);
  }
  function getExt(name) {
    const m = String(name).match(/\.([a-z0-9]+)$/i);
    return m ? m[1].toLowerCase() : '';
  }

  /* ═══════════════════════════════════════════════════════════
     CARGA DINÁMICA DE LIBRERÍAS
  ═══════════════════════════════════════════════════════════ */
  const Libs = {
    _loaded: {},
    loadMammoth() {
      if (this._loaded.mammoth) return Promise.resolve();
      return new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';
        s.onload = () => { this._loaded.mammoth = true; res(); };
        s.onerror = () => rej(new Error('Mammoth no cargó'));
        document.head.appendChild(s);
      });
    },
    loadPdfJs() {
      if (this._loaded.pdfjs) return Promise.resolve(window.pdfjsLib);
      return new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        s.onload = () => {
          if (window.pdfjsLib) {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            this._loaded.pdfjs = true;
            res(window.pdfjsLib);
          } else rej(new Error('PDF.js no cargó'));
        };
        s.onerror = () => rej(new Error('PDF.js no cargó'));
        document.head.appendChild(s);
      });
    }
  };

  /* ═══════════════════════════════════════════════════════════
     LISTADO DESDE GITHUB (con caché 10 min)
  ═══════════════════════════════════════════════════════════ */
  const GH = {
    cacheKey(p) { return 'aniaos_gh_' + p; },
    async list(folder, force) {
      const key = this.cacheKey(folder);
      if (!force) {
        try {
          const cached = JSON.parse(localStorage.getItem(key) || 'null');
          if (cached && cached.t && Date.now() - cached.t < 600000) return cached.items;
        } catch (e) {}
      }
      try {
        const r = await fetch(CFG.API(folder));
        if (r.status === 404) return [];
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const j = await r.json();
        if (!Array.isArray(j)) return [];
        const items = j.map(it => ({
          name: it.name,
          path: it.path,
          type: it.type,
          size: it.size || 0,
          ext: getExt(it.name),
          url: it.type === 'file' ? CFG.CDN(it.path) : null
        }));
        try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), items })); } catch (e) {}
        return items;
      } catch (e) {
        console.warn('[GH.list]', folder, e.message);
        try {
          const cached = JSON.parse(localStorage.getItem(key) || 'null');
          if (cached) return cached.items;
        } catch (_) {}
        return [];
      }
    },
    async listRecursive(folder, depth) {
      depth = depth == null ? 3 : depth;
      const out = [];
      const items = await this.list(folder);
      for (const it of items) {
        if (it.type === 'file') out.push(it);
        else if (it.type === 'dir' && depth > 0) {
          const sub = await this.listRecursive(it.path, depth - 1);
          sub.forEach(x => out.push(x));
        }
      }
      return out;
    },
    async fetchText(url) {
      const r = await fetch(url);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    },
    async fetchBuffer(url) {
      const r = await fetch(url);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.arrayBuffer();
    }
  };

  /* ═══════════════════════════════════════════════════════════
     CACHÉ DE RECURSOS
  ═══════════════════════════════════════════════════════════ */
  const RemoteCache = {
    docs: [], music: [], htmls: [], fondos: [],
    listeners: new Set(),
    emit() { this.listeners.forEach(fn => { try { fn(); } catch (e) {} }); },
    on(fn) { this.listeners.add(fn); },
    async refreshAll(force) {
      chatR('Actualizando archivos del repositorio…');
      const [docs, music, htmls, fondos] = await Promise.all([
        GH.listRecursive(CFG.PATHS.docs, 3),
        GH.listRecursive(CFG.PATHS.music, 3),
        GH.listRecursive(CFG.PATHS.htmls, 3),
        GH.listRecursive(CFG.PATHS.fondos, 3)
      ]);
      this.docs   = docs.filter(f => ['docx', 'pdf', 'txt', 'md'].includes(f.ext));
      this.music  = music.filter(f => ['mp3', 'wav', 'm4a', 'ogg', 'flac', 'opus', 'aac'].includes(f.ext));
      this.htmls  = htmls.filter(f => ['html', 'htm'].includes(f.ext));
      this.fondos = fondos.filter(f => ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(f.ext));
      this.emit();
      toastR('📁 ' + this.docs.length + ' docs · ' + this.music.length + ' pistas · ' + this.htmls.length + ' HTMLs · ' + this.fondos.length + ' fondos');
      return { docs: this.docs.length, music: this.music.length, htmls: this.htmls.length, fondos: this.fondos.length };
    }
  };

  /* ═══════════════════════════════════════════════════════════
     REPRODUCTOR DE MÚSICA
  ═══════════════════════════════════════════════════════════ */
  let _audioEl = null;
  let _playlist = [];
  let _playIdx = -1;

  function ensureAudioEl() {
    if (_audioEl) return _audioEl;
    _audioEl = new Audio();
    _audioEl.crossOrigin = 'anonymous';
    _audioEl.volume = 0.85;
    _audioEl.addEventListener('ended', () => playNext());
    _audioEl.addEventListener('error', () => {
      const t = _playlist[_playIdx];
      if (t) toastR('Error reproduciendo: ' + t.name, 'warn');
    });
    return _audioEl;
  }

  function playTrack(idx) {
    if (idx < 0 || idx >= _playlist.length) return;
    _playIdx = idx;
    const t = _playlist[idx];
    const a = ensureAudioEl();
    a.src = t.url;
    a.play()
      .then(() => toastR('🎵 ' + t.name.replace(/\.[^.]+$/, '')))
      .catch(e => toastR('No pude reproducir: ' + e.message, 'warn'));
    document.dispatchEvent(new CustomEvent('remote-music-change', { detail: { idx, track: t } }));
  }
  function playNext() { if (_playIdx < _playlist.length - 1) playTrack(_playIdx + 1); }
  function playPrev() { if (_playIdx > 0) playTrack(_playIdx - 1); }

  async function appOSMusic(initialIndex) {
    if (!window.OS_createWindow) { toastR('Mini-OS no disponible', 'warn'); return; }
    await RemoteCache.refreshAll(false).catch(() => {});
    _playlist = RemoteCache.music.slice();

    const ctx = window.OS_createWindow({
      title: '🎵 Música del repositorio',
      icon: '<svg width="36" height="36" viewBox="0 0 48 48"><rect x="4" y="4" width="40" height="40" rx="6" fill="#C30052"/><circle cx="19" cy="32" r="4.6" fill="#fff"/><rect x="22" y="12" width="3.4" height="20" fill="#fff"/></svg>',
      w: 720, h: 520
    });
    if (!ctx) return;

    function render() {
      if (!_playlist.length) {
        ctx.body.innerHTML = '<div style="padding:40px 20px;text-align:center;color:#888;font-size:14px">No hay pistas en <b>' + CFG.PATHS.music + '/</b> del repo.<br><br>Sube archivos <b>.mp3</b> (o .wav, .m4a, .ogg) a esa carpeta en GitHub y pulsa «Actualizar».</div>';
        return;
      }
      const cur = _playIdx >= 0 ? _playlist[_playIdx] : null;
      ctx.body.innerHTML =
        '<div style="display:flex;flex-direction:column;height:100%;background:#14161a;color:#eee">' +
          '<div style="padding:12px 16px;border-bottom:1px solid #23262e;display:flex;gap:8px;align-items:center">' +
            '<b style="flex:1;font-size:13px;letter-spacing:.1em">🎵 ' + _playlist.length + ' pistas</b>' +
            '<button data-act="refresh" style="padding:6px 12px;border:1px solid #333;background:#222;color:#eee;cursor:pointer;border-radius:6px;font-size:11px">⟳ Actualizar</button>' +
          '</div>' +
          '<div style="flex:1;display:flex;min-height:0">' +
            '<div style="width:230px;border-right:1px solid #23262e;overflow-y:auto">' +
              _playlist.map((t, i) =>
                '<div class="r-track" data-i="' + i + '" style="padding:10px 14px;cursor:pointer;font-size:12.5px;' + (i === _playIdx ? 'background:rgba(10,132,216,.22);box-shadow:inset 3px 0 0 #0a84d8' : '') + '">' +
                  '🎵 ' + esc(t.name.replace(/\.[^.]+$/, '')) +
                  (t.path !== t.name ? '<div style="font-size:10px;color:#8b93a3;margin-top:2px">' + esc(t.path) + '</div>' : '') +
                '</div>'
              ).join('') +
            '</div>' +
            '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:20px">' +
              '<div style="width:180px;height:180px;border-radius:8px;background:linear-gradient(135deg,#C30052,#5a0026);display:grid;place-items:center;font-size:60px">🎵</div>' +
              '<div style="text-align:center;max-width:100%">' +
                '<div style="font-size:15px;font-weight:600;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:340px">' + (cur ? esc(cur.name.replace(/\.[^.]+$/, '')) : 'Sin reproducción') + '</div>' +
                '<div style="font-size:11px;color:#8b93a3;margin-top:4px">' + (cur ? esc(cur.path) : 'Elige una pista') + '</div>' +
              '</div>' +
              '<div style="display:flex;gap:16px;align-items:center">' +
                '<button data-act="prev" style="width:44px;height:44px;border-radius:50%;border:0;background:#222;color:#eee;cursor:pointer;font-size:16px">⏮</button>' +
                '<button data-act="play" style="width:56px;height:56px;border-radius:50%;border:0;background:#0a84d8;color:#fff;cursor:pointer;font-size:20px">' + (ensureAudioEl().paused ? '▶' : '⏸') + '</button>' +
                '<button data-act="next" style="width:44px;height:44px;border-radius:50%;border:0;background:#222;color:#eee;cursor:pointer;font-size:16px">⏭</button>' +
              '</div>' +
              '<div style="width:100%;max-width:360px;display:flex;gap:8px;align-items:center">' +
                '<span class="r-t0" style="font-size:11px;color:#8b93a3;min-width:36px">0:00</span>' +
                '<input type="range" class="r-prog" min="0" max="100" value="0" style="flex:1">' +
                '<span class="r-t1" style="font-size:11px;color:#8b93a3;min-width:36px">0:00</span>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>';

      ctx.body.querySelectorAll('.r-track').forEach(tr => { tr.onclick = () => playTrack(+tr.dataset.i); });
      ctx.body.querySelectorAll('[data-act]').forEach(b => {
        b.onclick = () => {
          const a = b.dataset.act;
          if (a === 'refresh') { RemoteCache.refreshAll(true).then(() => { _playlist = RemoteCache.music.slice(); render(); }); }
          else if (a === 'play') { const el2 = ensureAudioEl(); if (el2.paused) el2.play(); else el2.pause(); setTimeout(render, 50); }
          else if (a === 'next') playNext();
          else if (a === 'prev') playPrev();
        };
      });

      const a = ensureAudioEl();
      const prog = ctx.body.querySelector('.r-prog');
      const t0 = ctx.body.querySelector('.r-t0');
      const t1 = ctx.body.querySelector('.r-t1');
      function fmt(s) { if (!isFinite(s)) return '0:00'; s = Math.floor(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
      function upd() {
        if (!ctx.body.isConnected) return;
        if (document.activeElement !== prog) prog.value = a.currentTime || 0;
        prog.max = a.duration || 100;
        t0.textContent = fmt(a.currentTime);
        t1.textContent = fmt(a.duration);
        requestAnimationFrame(upd);
      }
      prog.oninput = () => { try { a.currentTime = +prog.value; } catch (e) {} };
      upd();
    }

    render();
    const onChange = () => render();
    document.addEventListener('remote-music-change', onChange);
  }

  /* ═══════════════════════════════════════════════════════════
     VISOR DOCUMENTOS
  ═══════════════════════════════════════════════════════════ */
  async function appOSDocViewer(file) {
    if (!window.OS_createWindow) { toastR('Mini-OS no disponible', 'warn'); return; }
    await RemoteCache.refreshAll(false).catch(() => {});

    if (!file) {
      const ctx = window.OS_createWindow({
        title: '📄 Documentos del repositorio',
        icon: '<svg width="36" height="36" viewBox="0 0 48 48"><path d="M11 4h20l6 6v34H11z" fill="#fff" stroke="#9aa5b1" stroke-width="1.4"/><rect x="6" y="17" width="24" height="24" rx="2" fill="#2B579A"/><text x="18" y="35" font-family="Segoe UI" font-size="17" font-weight="700" fill="#fff" text-anchor="middle">W</text></svg>',
        w: 760, h: 560
      });
      if (!ctx) return;
      function renderList() {
        if (!RemoteCache.docs.length) {
          ctx.body.innerHTML = '<div style="padding:40px 20px;text-align:center;color:#888">No hay documentos en <b>' + CFG.PATHS.docs + '/</b>.<br><br>Sube .docx, .pdf, .txt o .md al repo.</div>';
          return;
        }
        ctx.body.innerHTML =
          '<div style="flex:1;overflow-y:auto;padding:12px">' +
            '<div style="display:flex;gap:8px;margin-bottom:12px;align-items:center">' +
              '<b style="flex:1;font-size:13px">📄 ' + RemoteCache.docs.length + ' documentos</b>' +
              '<button class="r-refresh" style="padding:6px 12px;border:1px solid #333;background:#222;color:#eee;cursor:pointer;border-radius:6px;font-size:11px">⟳ Actualizar</button>' +
              '<button class="r-train" style="padding:6px 12px;border:1px solid #0a84d8;background:#0a84d8;color:#fff;cursor:pointer;border-radius:6px;font-size:11px">🧠 Entrenar IA con todos</button>' +
            '</div>' +
            RemoteCache.docs.map((d, i) =>
              '<div class="r-doc" data-i="' + i + '" style="padding:11px 14px;border-bottom:1px solid #23262e;cursor:pointer;font-size:13px;display:flex;align-items:center;gap:10px">' +
                '<span style="font-size:22px">' + (d.ext === 'pdf' ? '📕' : d.ext === 'docx' ? '📘' : d.ext === 'md' ? '📝' : '📄') + '</span>' +
                '<span style="flex:1">' + esc(d.name) + '<div style="font-size:10px;color:#8b93a3;margin-top:2px">' + esc(d.path) + '</div></span>' +
                '<span style="font-size:10px;color:#666">' + Math.round(d.size / 1024) + ' KB</span>' +
              '</div>'
            ).join('') +
          '</div>';
        ctx.body.querySelectorAll('.r-doc').forEach(el2 => {
          el2.onclick = () => { ctx.close(); appOSDocViewer(RemoteCache.docs[+el2.dataset.i]); };
        });
        ctx.body.querySelector('.r-refresh').onclick = () => { RemoteCache.refreshAll(true).then(renderList); };
        ctx.body.querySelector('.r-train').onclick = () => { entrenarConDocumentos(); };
      }
      renderList();
      return;
    }

    const ext = file.ext;
    const ctx = window.OS_createWindow({ title: file.name, icon: ext === 'pdf' ? '📕' : '📄', w: 900, h: 700 });
    if (!ctx) return;
    ctx.body.innerHTML = '<div style="padding:30px;text-align:center;color:#888">Cargando ' + esc(file.name) + '…</div>';

    try {
      if (ext === 'docx') await renderDocx(ctx, file);
      else if (ext === 'pdf') await renderPdf(ctx, file);
      else if (ext === 'txt' || ext === 'md') await renderText(ctx, file);
      else throw new Error('Formato no soportado: ' + ext);
    } catch (e) {
      ctx.body.innerHTML = '<div style="padding:30px;color:#d05050;font-size:14px">Error: ' + esc(e.message) + '</div>';
    }
  }

  async function renderDocx(ctx, file) {
    toastR('Convirtiendo ' + file.name + '…');
    await Libs.loadMammoth();
    const buf = await GH.fetchBuffer(file.url);
    const result = await window.mammoth.convertToHtml({ arrayBuffer: buf });
    ctx.body.innerHTML =
      '<div class="os-wp-toolbar"><button class="os-wp-btn" data-save="1" style="width:auto;padding:0 12px;">🧠 Entrenar IA con este</button><span style="flex:1"></span><span style="font-size:11px;color:#666">' + esc(file.path) + '</span></div>' +
      '<div class="os-wp-canvas"><div class="os-page" style="font-family:Georgia,serif">' + (result.value || '<p>Documento vacío</p>') + '</div></div>';
    ctx.body.querySelector('[data-save]').onclick = () => entrenarConTexto(file.name, ctx.body.querySelector('.os-page').innerText);
  }

  async function renderPdf(ctx, file) {
    toastR('Cargando PDF…');
    const pdfjsLib = await Libs.loadPdfJs();
    const buf = await GH.fetchBuffer(file.url);
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    ctx.body.innerHTML =
      '<div class="os-wp-toolbar"><button class="os-wp-btn" data-save="1" style="width:auto;padding:0 12px;">🧠 Entrenar IA con este</button><span style="flex:1"></span><span style="font-size:11px;color:#666">' + esc(file.path) + ' · ' + pdf.numPages + ' páginas</span></div>' +
      '<div class="os-wp-canvas" id="pdf-viewer" style="flex-direction:column;background:#3d434c;padding:20px;gap:14px"></div>';
    const viewer = ctx.body.querySelector('#pdf-viewer');
    const allText = [];
    const maxPages = Math.min(pdf.numPages, 30);
    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.4 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.cssText = 'background:#fff;box-shadow:0 3px 16px rgba(0,0,0,.4);max-width:100%';
      viewer.appendChild(canvas);
      const c = canvas.getContext('2d');
      await page.render({ canvasContext: c, viewport }).promise;
      try {
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(it => it.str).join(' ');
        if (pageText.trim()) allText.push(pageText);
      } catch (e) {}
    }
    if (pdf.numPages > maxPages) {
      viewer.appendChild(el('div', '', '<div style="color:#fff;text-align:center;padding:20px">… ' + (pdf.numPages - maxPages) + ' páginas más no mostradas (límite 30)</div>'));
    }
    ctx.body.querySelector('[data-save]').onclick = () => entrenarConTexto(file.name, allText.join('\n\n'));
    toastR('✓ ' + file.name + ' · ' + pdf.numPages + ' páginas');
  }

  async function renderText(ctx, file) {
    const text = await GH.fetchText(file.url);
    ctx.body.innerHTML =
      '<div class="os-wp-toolbar"><button class="os-wp-btn" data-save="1" style="width:auto;padding:0 12px;">🧠 Entrenar IA con este</button><span style="flex:1"></span><span style="font-size:11px;color:#666">' + esc(file.path) + '</span></div>' +
      '<div class="os-wp-canvas"><div class="os-page" style="font-family:Consolas,monospace;font-size:13px;white-space:pre-wrap">' + esc(text) + '</div></div>';
    ctx.body.querySelector('[data-save]').onclick = () => entrenarConTexto(file.name, text);
  }

  /* ═══════════════════════════════════════════════════════════
   NAVEGADOR INTERNO HTML
   FIX · Carga el HTML como Blob (text/html) para que el
   navegador lo RENDERICE en vez de mostrar el código.
   · Inyecta <base> para que las rutas relativas funcionen
   · Revoca blob URLs antiguas para no dejar memoria colgada
═══════════════════════════════════════════════════════════ */
async function appOSBrowser(initialFile) {
  if (!window.OS_createWindow) { toastR('Mini-OS no disponible', 'warn'); return; }
  await RemoteCache.refreshAll(false).catch(() => {});
  const ctx = window.OS_createWindow({
    title: '🌐 Navegador interno',
    icon: '<svg width="36" height="36" viewBox="0 0 48 48"><rect x="4" y="6" width="40" height="36" rx="4" fill="#1954A0"/><path d="M12 20h24M12 26h24M12 32h14" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>',
    w: 980, h: 680
  });
  if (!ctx) return;

  ctx.body.innerHTML =
    '<div style="display:flex;gap:6px;padding:8px;background:#f0f0f0;border-bottom:1px solid #d8d8d8;align-items:center">' +
      '<select class="r-url" style="flex:1;padding:6px 10px;border:1px solid #d8d8d8;background:#fff;border-radius:4px;font-size:12px;min-width:0">' +
        '<option value="">— Elige un HTML del repo —</option>' +
        RemoteCache.htmls.map((h, i) => '<option value="' + i + '">' + esc(h.path) + '</option>').join('') +
      '</select>' +
      '<button class="r-go" style="padding:6px 14px;border:1px solid #d8d8d8;background:#f0f0f0;border-radius:4px;cursor:pointer;font-size:12px">Ir</button>' +
      '<button class="r-reload" style="padding:6px 12px;border:1px solid #d8d8d8;background:#f0f0f0;border-radius:4px;cursor:pointer;font-size:12px">⟳</button>' +
      '<button class="r-external" style="padding:6px 12px;border:1px solid #d8d8d8;background:#f0f0f0;border-radius:4px;cursor:pointer;font-size:12px" title="Abrir en pestaña nueva">↗</button>' +
    '</div>' +
    '<div style="flex:1;position:relative;background:#fff">' +
      '<iframe class="r-frame" style="width:100%;height:100%;border:0" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"></iframe>' +
    '</div>' +
    '<div style="height:24px;display:flex;align-items:center;padding:0 12px;font-size:11px;color:#666;background:#f0f0f0;border-top:1px solid #d8d8d8">' +
      '<span class="r-status">Listo. ' + RemoteCache.htmls.length + ' HTMLs disponibles.</span>' +
    '</div>';

  const sel = ctx.body.querySelector('.r-url');
  const frame = ctx.body.querySelector('.r-frame');
  const status = ctx.body.querySelector('.r-status');
  let currentFile = null;
  let currentBlobUrl = '';

  /**
   * Carga un archivo HTML del repo y lo renderiza en el iframe.
   * 1) Descarga el HTML como texto
   * 2) Inyecta <base href> para rutas relativas
   * 3) Envuelve en Blob (text/html) → fuerza renderizado
   * 4) Revoca el blob anterior
   */
  async function navigate(file) {
    currentFile = file;
    status.textContent = 'Cargando: ' + file.path;

    try {
      // 1) Descargar el HTML como TEXTO (no como binario)
      const r = await fetch(file.url);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      let html = await r.text();

      // 2) Calcular base absoluta (mismo directorio del HTML)
      const slash = file.path.lastIndexOf('/');
      const dir = slash >= 0 ? file.path.slice(0, slash + 1) : '';
      const baseRaw = 'https://raw.githubusercontent.com/' + CFG.USER + '/' + CFG.REPO + '/' + CFG.BRANCH + '/' +
        dir.split('/').map(encodeURIComponent).join('/');

      // 3) Reescribir rutas relativas a absolutas en el HTML
      //    (por si algún HTML las usa sin <base>, ej. src="styles.css")
      html = html.replace(
        /(\s(?:src|href|action|poster)\s*=\s*)(["'])(?!https?:|\/\/|data:|blob:|mailto:|tel:|#|javascript:)([^"']+)(\2)/gi,
        function (m, pre, q, path) {
          return pre + q + baseRaw + path + q;
        }
      );

      // 4) Inyectar <base> en <head> por si acaso (cinturón y tirantes)
      if (!/<base\s/i.test(html)) {
        if (/<head[^>]*>/i.test(html)) {
          html = html.replace(/<head([^>]*)>/i, '<head$1><base href="' + baseRaw + '">');
        } else if (/<html[^>]*>/i.test(html)) {
          html = html.replace(/<html([^>]*)>/i, '<html$1><head><base href="' + baseRaw + '"></head>');
        } else {
          html = '<head><base href="' + baseRaw + '"></head>' + html;
        }
      }

      // 5) Blob con MIME text/html → el navegador RENDERIZA
      const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);

      // 6) Revocar blob anterior para no acumular memoria
      if (currentBlobUrl && currentBlobUrl !== blobUrl) {
        try { URL.revokeObjectURL(currentBlobUrl); } catch (e) {}
      }
      currentBlobUrl = blobUrl;

      // 7) Asignar al iframe
      frame.removeAttribute('srcdoc');
      frame.src = blobUrl;
      status.textContent = '✓ ' + file.path;
    } catch (e) {
      status.textContent = '✗ ' + e.message;
      frame.removeAttribute('src');
      frame.srcdoc = '<div style="font-family:sans-serif;padding:40px;text-align:center;color:#d05050">' +
        '<h2 style="color:#c00">Error al cargar</h2>' +
        '<p>' + esc(e.message) + '</p>' +
        '<p style="color:#666;font-size:12px">' + esc(file.path) + '</p>' +
        '</div>';
    }
  }

  ctx.body.querySelector('.r-go').onclick = () => {
    const i = sel.value;
    if (i === '') return;
    const h = RemoteCache.htmls[+i];
    navigate(h);
  };
  ctx.body.querySelector('.r-reload').onclick = () => { if (currentFile) navigate(currentFile); };
  ctx.body.querySelector('.r-external').onclick = () => { if (currentFile) window.open(currentFile.url, '_blank', 'noopener'); };
  sel.onchange = () => { if (sel.value !== '') ctx.body.querySelector('.r-go').click(); };

  // Autoseleccionar el primer HTML o el pasado como argumento
  if (initialFile) {
    const idx = RemoteCache.htmls.findIndex(h => h.name === initialFile.name || h.path === initialFile.path);
    if (idx >= 0) { sel.value = String(idx); navigate(RemoteCache.htmls[idx]); }
  } else if (RemoteCache.htmls.length) {
    sel.value = '0';
    navigate(RemoteCache.htmls[0]);
  }

  // Limpiar blob al cerrar la ventana
  ctx.win.addEventListener('remove', () => {
    if (currentBlobUrl) {
      try { URL.revokeObjectURL(currentBlobUrl); } catch (e) {}
    }
  });
}

  /* ═══════════════════════════════════════════════════════════
     FONDOS REMOTOS
  ═══════════════════════════════════════════════════════════ */
  async function appOSFondos() {
    if (!window.OS_createWindow) { toastR('Mini-OS no disponible', 'warn'); return; }
    await RemoteCache.refreshAll(false).catch(() => {});
    const ctx = window.OS_createWindow({
      title: '🎨 Fondos del repositorio',
      icon: '<svg width="36" height="36" viewBox="0 0 48 48"><rect x="4" y="6" width="40" height="36" rx="4" fill="#5a3a8a"/><circle cx="14" cy="16" r="3" fill="#ffb900"/><path d="M4 34l12-14 8 10 6-6 14 16z" fill="#2f9e63"/></svg>',
      w: 820, h: 600
    });
    if (!ctx) return;

    function render() {
      const fondos = RemoteCache.fondos;
      if (!fondos.length) {
        ctx.body.innerHTML = '<div style="padding:40px 20px;text-align:center;color:#888;font-size:14px">No hay fondos en <b>' + CFG.PATHS.fondos + '/</b>.<br><br>Sube imágenes (.jpg, .png, .webp) y pulsa «Actualizar».</div>';
        return;
      }
      const currentUrl = localStorage.getItem('aniaos_wall_url') || '';
      ctx.body.innerHTML =
        '<div style="display:flex;flex-direction:column;height:100%;background:#14161a;color:#eee">' +
          '<div style="padding:12px 16px;border-bottom:1px solid #23262e;display:flex;gap:8px;align-items:center">' +
            '<b style="flex:1;font-size:13px">🎨 ' + fondos.length + ' fondos</b>' +
            '<button class="r-refresh" style="padding:6px 12px;border:1px solid #333;background:#222;color:#eee;cursor:pointer;border-radius:6px;font-size:11px">⟳</button>' +
            '<button class="r-clear" style="padding:6px 12px;border:1px solid #333;background:#222;color:#eee;cursor:pointer;border-radius:6px;font-size:11px">✕ Por defecto</button>' +
          '</div>' +
          '<div style="flex:1;overflow-y:auto;padding:14px;display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px">' +
            fondos.map((w, i) => {
              const isActive = w.url === currentUrl;
              return '<div class="r-wall" data-i="' + i + '" style="cursor:pointer;border:2px solid ' + (isActive ? '#0a84d8' : 'transparent') + ';border-radius:8px;overflow:hidden;background:#000;aspect-ratio:16/9;position:relative">' +
                '<img src="' + w.url + '" style="width:100%;height:100%;object-fit:cover;display:block" loading="lazy" onerror="this.style.opacity=\'.3\'">' +
                '<div style="position:absolute;left:0;right:0;bottom:0;padding:6px 8px;background:linear-gradient(transparent,rgba(0,0,0,.85));font-size:10px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (isActive ? '✓ ' : '') + esc(w.name) + '</div>' +
              '</div>';
            }).join('') +
          '</div>' +
        '</div>';
      ctx.body.querySelectorAll('.r-wall').forEach(el2 => {
        el2.onclick = () => {
          const w = fondos[+el2.dataset.i];
          if (window.OS_aplicarFondo) window.OS_aplicarFondo(w.url, w.name);
          render();
        };
      });
      ctx.body.querySelector('.r-refresh').onclick = () => RemoteCache.refreshAll(true).then(render);
      ctx.body.querySelector('.r-clear').onclick = () => {
        if (window.OS_aplicarFondo) window.OS_aplicarFondo(null, null);
        render();
      };
    }
    render();
  }

  /* ═══════════════════════════════════════════════════════════
     ENTRENAMIENTO DE ANIA
  ═══════════════════════════════════════════════════════════ */
  const Trained = {
    KEY: 'aniaos_trained',
    data: null,
    load() {
      try { this.data = JSON.parse(localStorage.getItem(this.KEY) || 'null') || {}; }
      catch (e) { this.data = {}; }
      return this.data;
    },
    save() { try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) {} },
    count() { this.load(); return Object.keys(this.data).length; }
  };

  function entrenarConTexto(nombre, texto) {
    const txt = String(texto || '').trim();
    if (txt.length < 40) { toastR('Texto muy corto para entrenar', 'warn'); return 0; }
    let chunks = 0;
    if (typeof DocBrain !== 'undefined' && typeof DocBrain.addChunks === 'function') {
      try {
        chunks = DocBrain.addChunks('repo:' + nombre, txt);
        if (typeof DocBrain.save === 'function') DocBrain.save();
      } catch (e) { console.warn('[Train] DocBrain falló:', e.message); }
    }
    Trained.load();
    const trozos = [];
    const parrafos = txt.split(/\n{2,}/);
    let cur = '';
    for (const p of parrafos) {
      const clean = p.trim();
      if (!clean) continue;
      if ((cur + '\n\n' + clean).length > 600) { if (cur) trozos.push(cur); cur = clean; }
      else cur = cur ? cur + '\n\n' + clean : clean;
    }
    if (cur) trozos.push(cur);
    Trained.data['repo:' + nombre] = { t: Date.now(), chunks: trozos, size: txt.length };
    Trained.save();
    chunks = Math.max(chunks, trozos.length);
    if (typeof Mind !== 'undefined' && Mind.d) {
      Mind.d.hechos = Mind.d.hechos || [];
      Mind.d.hechos.push({ clave: 'documento', valor: 'Repo: ' + nombre, t: Date.now() });
      if (typeof Mind.save === 'function') Mind.save();
    }
    toastR('🧠 Entrenado: ' + nombre + ' (' + chunks + ' fragmentos)');
    return chunks;
  }

  async function entrenarConDocumentos() {
    toastR('🧠 Entrenando IA con documentos del repo…');
    await RemoteCache.refreshAll(true);
    const docs = RemoteCache.docs.slice();
    if (!docs.length) { toastR('No hay documentos para entrenar', 'warn'); return; }
    let total = 0, ok = 0, fail = 0;
    for (let i = 0; i < docs.length; i++) {
      const d = docs[i];
      toastR('[' + (i + 1) + '/' + docs.length + '] ' + d.name);
      try {
        let texto = '';
        if (d.ext === 'docx') {
          await Libs.loadMammoth();
          const buf = await GH.fetchBuffer(d.url);
          const r = await window.mammoth.extractRawText({ arrayBuffer: buf });
          texto = r.value || '';
        } else if (d.ext === 'pdf') {
          const pdfjsLib = await Libs.loadPdfJs();
          const buf = await GH.fetchBuffer(d.url);
          const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
          const partes = [];
          const max = Math.min(pdf.numPages, 50);
          for (let p = 1; p <= max; p++) {
            const page = await pdf.getPage(p);
            const tc = await page.getTextContent();
            partes.push(tc.items.map(it => it.str).join(' '));
          }
          texto = partes.join('\n\n');
        } else if (d.ext === 'txt' || d.ext === 'md') {
          texto = await GH.fetchText(d.url);
        }
        if (texto) { total += entrenarConTexto(d.name, texto); ok++; } else fail++;
      } catch (e) {
        console.warn('[Train]', d.name, e.message);
        fail++;
      }
      await new Promise(r => setTimeout(r, 250));
    }
    chatR('✅ Entrenamiento completo: ' + ok + ' docs (' + total + ' fragmentos).' + (fail ? ' ' + fail + ' con error.' : ''));
    toastR('✓ Entrenados ' + ok + '/' + docs.length);
  }

  function buscarEnEntrenados(query) {
    Trained.load();
    const q = String(query || '').toLowerCase();
    if (!q || q.length < 3) return null;
    const palabras = q.split(/\s+/).filter(w => w.length > 3);
    let best = null, bestScore = 0;
    for (const [doc, info] of Object.entries(Trained.data)) {
      for (const chunk of info.chunks) {
        const low = chunk.toLowerCase();
        let score = 0;
        for (const w of palabras) if (low.includes(w)) score += 2;
        if (score > bestScore) { bestScore = score; best = { doc, chunk }; }
      }
    }
    return bestScore >= 2 ? best : null;
  }
  window.buscarEnEntrenados = buscarEnEntrenados;

  /* ═══════════════════════════════════════════════════════════
     HOOK OSBridge · comandos extendidos
  ═══════════════════════════════════════════════════════════ */
  function hookOSBridge() {
    if (!window.OSBridge || window.OSBridge.__remoteHooked) return;
    window.OSBridge.__remoteHooked = true;
    const origExec = window.OSBridge.ejecutar.bind(window.OSBridge);

    window.OSBridge.ejecutar = async function (cmd) {
      const c = String(cmd || '').toLowerCase().trim();
      let m;

      if (/^(?:abre|pon|reproduce)\s+(?:la\s+)?m[uú]sica(?:\s+(?:del?\s+repo(?:sitorio)?|de\s+github))?$/.test(c)) {
        appOSMusic(); return { ok: true, app: 'musica' };
      }
      if (/^(?:pausa|para)\s+(?:la\s+)?m[uú]sica$/.test(c)) { if (_audioEl) _audioEl.pause(); return { ok: true }; }
      if (/^(?:siguiente|next)\s+(?:pista|canci[oó]n)?$/.test(c)) { playNext(); return { ok: true }; }
      if (/^(?:anterior|prev)\s+(?:pista|canci[oó]n)?$/.test(c)) { playPrev(); return { ok: true }; }

      if (/^(?:abre|cambia|pon|muestra|elige)\s+(?:los?\s+|el\s+|un\s+)?(?:fondo|fondos|wallpaper)/.test(c)) {
        appOSFondos(); return { ok: true, app: 'fondos' };
      }
      m = c.match(/^pon(?:me)?\s+(?:el\s+)?fondo\s+(?:de\s+|llamado\s+)?(.+)$/);
      if (m) {
        const q = m[1].trim();
        await RemoteCache.refreshAll(false);
        const found = RemoteCache.fondos.find(w => w.name.toLowerCase().includes(q) || w.name.toLowerCase().replace(/\.[^.]+$/, '') === q);
        if (found) { if (window.OS_aplicarFondo) window.OS_aplicarFondo(found.url, found.name); return { ok: true, fondo: found.name }; }
        return { ok: false, error: 'fondo no encontrado: ' + q };
      }

      if (/^lista\s+(?:los\s+)?(?:m[uú]sica|canciones|pistas)/.test(c)) {
        await RemoteCache.refreshAll(false);
        return { ok: true, resultados: RemoteCache.music.slice(0, 30).map(x => ({ ruta: x.path })), total: RemoteCache.music.length };
      }
      if (/^lista\s+(?:los\s+)?(?:documentos|docs)/.test(c)) {
        await RemoteCache.refreshAll(false);
        return { ok: true, resultados: RemoteCache.docs.slice(0, 30).map(x => ({ ruta: x.path })), total: RemoteCache.docs.length };
      }
      if (/^lista\s+(?:los\s+)?htmls?/.test(c)) {
        await RemoteCache.refreshAll(false);
        return { ok: true, resultados: RemoteCache.htmls.slice(0, 30).map(x => ({ ruta: x.path })), total: RemoteCache.htmls.length };
      }

      m = c.match(/^(?:abre|muestra|lee)\s+(?:el\s+)?(?:documento|doc|archivo|pdf)\s+(.+)$/);
      if (m) {
        const q = m[1].trim();
        await RemoteCache.refreshAll(false);
        const found = RemoteCache.docs.find(d =>
          d.name.toLowerCase().includes(q) ||
          d.path.toLowerCase().includes(q) ||
          d.name.toLowerCase().replace(/\.[^.]+$/, '') === q
        );
        if (found) { appOSDocViewer(found); return { ok: true, archivo: found.path }; }
        return { ok: false, error: 'documento no encontrado: ' + q };
      }

      m = c.match(/^(?:navega|abre\s+el\s+navegador|abre\s+html)\s*(?:a\s+|hacia\s+|el?\s+html\s+)?(.+)?$/);
      if (m) {
        const q = (m[1] || '').trim();
        await RemoteCache.refreshAll(false);
        if (q) {
          const found = RemoteCache.htmls.find(h =>
            h.name.toLowerCase().includes(q) ||
            h.path.toLowerCase().includes(q) ||
            h.name.toLowerCase().replace(/\.[^.]+$/, '') === q
          );
          if (found) { appOSBrowser(found); return { ok: true, archivo: found.path }; }
          return { ok: false, error: 'html no encontrado: ' + q };
        }
        appOSBrowser();
        return { ok: true, app: 'navegador' };
      }

      if (/^(?:entrena|entrenar|aprende)\s*(?:te\s+)?(?:con\s+)?(?:los\s+)?(?:documentos|docs)/.test(c)) {
        entrenarConDocumentos(); return { ok: true, accion: 'entrenando' };
      }
      if (/^cu[aá]ntos?\s+(?:documentos|docs)/.test(c)) {
        return { ok: true, total: Trained.count() };
      }

      return origExec(cmd);
    };
    console.log('[Remote] OSBridge extendido ✓');
  }

  /* ═══════════════════════════════════════════════════════════
     HOOK send() · buscar en docs entrenados
  ═══════════════════════════════════════════════════════════ */
  function hookRespond() {
    if (!window.send || window.send.__remoteHooked) return;
    window.send.__remoteHooked = true;
    const orig = window.send;
    window.send = async function (text) {
      const found = buscarEnEntrenados(text);
      if (found && /qu[eé]\s+(?:dice|sabes|hay)|busca|seg[uú]n|en\s+(?:el\s+)?documento|informaci[oó]n\s+sobre/i.test(text)) {
        try {
          if (typeof window.addChat === 'function') window.addChat('you', text);
          const respuesta = '📄 Según «' + found.doc + '»:\n\n' + found.chunk.slice(0, 500) + (found.chunk.length > 500 ? '…' : '');
          if (typeof window.reply === 'function') { window.reply(respuesta); return; }
          if (typeof window.personaReply === 'function') { window.personaReply(respuesta); return; }
        } catch (e) {}
      }
      return orig.call(this, text);
    };
    console.log('[Remote] send() extendido ✓');
  }

  /* ═══════════════════════════════════════════════════════════
     REGISTRAR APPS EN EL OS
  ═══════════════════════════════════════════════════════════ */
  function registrarEnOS() {
    if (!window.OS_APPS) { console.warn('[Remote] OS_APPS no disponible'); return; }

    window.OS_APPS.music  = { name: '🎵 Música',     icon: '🎵', launch: () => appOSMusic() };
    window.OS_APPS.docs   = { name: '📄 Documentos', icon: '📄', launch: () => appOSDocViewer() };
    window.OS_APPS.browser= { name: '🌐 Navegador',  icon: '🌐', launch: () => appOSBrowser() };
    window.OS_APPS.fondos = { name: '🎨 Fondos',     icon: '🎨', launch: () => appOSFondos() };

    // Re-render del start menu Y del escritorio para que aparezcan los nuevos iconos
    if (typeof window.OS_renderStartMenu === 'function') {
      try { window.OS_renderStartMenu(); } catch (e) { console.warn(e); }
    }
    if (typeof window.OS_renderDesktop === 'function') {
      try { window.OS_renderDesktop(); } catch (e) { console.warn(e); }
    }
    console.log('[Remote] Apps registradas ✓');
  }

  /* ═══════════════════════════════════════════════════════════
     INIT · esperar a que OSBridge esté listo
  ═══════════════════════════════════════════════════════════ */
  function waitFor(fn, cb, timeout) {
    const start = Date.now();
    const iv = setInterval(() => {
      if (fn()) { clearInterval(iv); cb(); }
      else if (Date.now() - start > (timeout || 20000)) { clearInterval(iv); console.warn('[Remote] timeout'); }
    }, 150);
  }

  waitFor(() => window.OSBridge && window.OS_APPS && typeof window.send === 'function', () => {
    hookOSBridge();
    hookRespond();
    registrarEnOS();
    setTimeout(() => { RemoteCache.refreshAll(false).catch(() => {}); }, 2500);
    console.log('[Remote] Módulo cargado · música, docs, pdf, htmls, fondos, entrenamiento ✓');
  }, 25000);

  /* ═══════════════════════════════════════════════════════════
     API GLOBAL
  ═══════════════════════════════════════════════════════════ */
  window.OSRemote = {
    appOSMusic,
    appOSDocViewer,
    appOSBrowser,
    appOSFondos,
    entrenarConDocumentos,
    entrenarConTexto,
    buscarEnEntrenados,
    refresh: () => RemoteCache.refreshAll(true),
    config: CFG,
    cache: RemoteCache
  };
  console.log('[Remote] API global expuesta ✓');
})();
