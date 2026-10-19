/* ============================================================
   ANIA · Mini-OS · v10.1
   - Escritorio virtual con ventanas, apps, FS virtual
   - Detección de dispositivo (Android/iOS/tablet/desktop)
   - Chat minimizable en modo OS con FAB para restaurar
   - Ajustes responsive para móvil
   - Expone window.OS_* para integración con ANIA
   ============================================================ */
(function () {
  'use strict';

  /* ═══════════════════════════════════════════════════════════
     DETECCIÓN DE DISPOSITIVO
  ═══════════════════════════════════════════════════════════ */
  var DEVICE = (function () {
    var nav = navigator || {};
    var ua = (nav.userAgent || '') + ' ' + (nav.platform || '');
    var w = window.innerWidth || 0;
    var h = window.innerHeight || 0;
    var min = Math.min(w, h);
    var max = Math.max(w, h);
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPhone|iPad|iPod/i.test(ua) || (nav.platform === 'MacIntel' && (nav.maxTouchPoints || 0) > 1);
    var isTouch = ('ontouchstart' in window) || (nav.maxTouchPoints || 0) > 0;
    var isMobileUA = /Mobile|Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Windows Phone/i.test(ua);
    var isPhone = isMobileUA && min < 600;
    var isTablet = isMobileUA && min >= 600;
    var type = isPhone ? 'mobile' : (isTablet ? 'tablet' : 'desktop');
    var os = isAndroid ? 'android'
      : isIOS ? 'ios'
      : /Windows/i.test(ua) ? 'windows'
      : /Mac OS|Macintosh/i.test(ua) ? 'mac'
      : /Linux/i.test(ua) ? 'linux'
      : 'unknown';
    return {
      isAndroid: isAndroid, isIOS: isIOS, isTouch: isTouch,
      isPhone: isPhone, isTablet: isTablet, isMobile: isMobileUA,
      type: type, os: os,
      w: w, h: h, min: min, max: max,
      portrait: h >= w,
      dpr: window.devicePixelRatio || 1
    };
  })();

  function applyDeviceClasses() {
    var b = document.body;
    if (!b) return;
    b.classList.remove(
      'os-device-mobile', 'os-device-tablet', 'os-device-desktop',
      'os-android', 'os-ios', 'os-windows', 'os-mac', 'os-linux', 'os-unknown',
      'os-touch', 'os-no-touch', 'os-portrait', 'os-landscape'
    );
    b.classList.add('os-device-' + DEVICE.type);
    b.classList.add('os-' + DEVICE.os);
    b.classList.add(DEVICE.isTouch ? 'os-touch' : 'os-no-touch');
    b.classList.add(DEVICE.portrait ? 'os-portrait' : 'os-landscape');
  }

  function refreshDevice() {
    DEVICE.w = window.innerWidth || 0;
    DEVICE.h = window.innerHeight || 0;
    DEVICE.min = Math.min(DEVICE.w, DEVICE.h);
    DEVICE.max = Math.max(DEVICE.w, DEVICE.h);
    DEVICE.portrait = DEVICE.h >= DEVICE.w;
    applyDeviceClasses();
  }

  function debounce(fn, ms) {
    var t;
    return function () {
      var a = arguments;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(null, a); }, ms);
    };
  }

  try { applyDeviceClasses(); } catch (e) {}

  /* ═══════════════════════════════════════════════════════════
     ICONOS SVG
  ═══════════════════════════════════════════════════════════ */
  var IC = {
    folder: '<svg width="42" height="42" viewBox="0 0 48 48"><path d="M4 10h13l4 5h20v6H4z" fill="#e8a200"/><path d="M4 16h37v22a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" fill="#ffc933"/></svg>',
    txt: '<svg width="42" height="42" viewBox="0 0 48 48"><path d="M11 4h20l6 6v34H11z" fill="#fff" stroke="#9aa5b1" stroke-width="1.4"/><path d="M31 4l6 6h-6z" fill="#dfe5ec" stroke="#9aa5b1" stroke-width="1.2"/><path d="M16 17h16M16 22h16M16 27h16M16 32h10" stroke="#5a9bd8" stroke-width="2"/></svg>',
    doc: '<svg width="42" height="42" viewBox="0 0 48 48"><path d="M11 4h20l6 6v34H11z" fill="#fff" stroke="#9aa5b1" stroke-width="1.4"/><rect x="6" y="17" width="24" height="24" rx="2" fill="#2B579A"/><text x="18" y="35" font-family="Segoe UI" font-size="17" font-weight="700" fill="#fff" text-anchor="middle">W</text></svg>',
    xls: '<svg width="42" height="42" viewBox="0 0 48 48"><path d="M11 4h20l6 6v34H11z" fill="#fff" stroke="#9aa5b1" stroke-width="1.4"/><rect x="6" y="17" width="24" height="24" rx="2" fill="#217346"/><text x="18" y="35" font-family="Segoe UI" font-size="17" font-weight="700" fill="#fff" text-anchor="middle">X</text></svg>',
    img: '<svg width="42" height="42" viewBox="0 0 48 48"><rect x="5" y="9" width="38" height="30" rx="2.5" fill="#fff" stroke="#8f9aa6" stroke-width="1.4"/><path d="M8 34l10-12 7 8 5-5 10 9z" fill="#2f9e63"/><circle cx="33" cy="17" r="3.6" fill="#ffb900"/></svg>',
    audio: '<svg width="42" height="42" viewBox="0 0 48 48"><rect x="4" y="4" width="40" height="40" rx="4" fill="#C30052"/><circle cx="19" cy="32" r="4.6" fill="#fff"/><rect x="22" y="12" width="3.4" height="20" fill="#fff"/></svg>',
    app: '<svg width="42" height="42" viewBox="0 0 48 48"><rect x="6" y="6" width="36" height="36" rx="6" fill="#4a4f57"/></svg>',
    calc: '<svg width="42" height="42" viewBox="0 0 48 48"><rect x="8" y="4" width="32" height="40" rx="3" fill="#4a4f57"/><rect x="12" y="8" width="24" height="9" rx="1" fill="#c9e6f5"/><rect x="12" y="21" width="6" height="5" rx="1" fill="#8d949e"/><rect x="21" y="21" width="6" height="5" rx="1" fill="#8d949e"/><rect x="30" y="21" width="6" height="5" rx="1" fill="#8d949e"/><rect x="12" y="29" width="6" height="5" rx="1" fill="#8d949e"/><rect x="21" y="29" width="6" height="5" rx="1" fill="#8d949e"/><rect x="30" y="29" width="6" height="12" rx="1" fill="#0a84d8"/><rect x="12" y="37" width="15" height="4" rx="1" fill="#8d949e"/></svg>',
    term: '<svg width="42" height="42" viewBox="0 0 48 48"><rect x="4" y="6" width="40" height="36" rx="4" fill="#22282f"/><text x="12" y="30" font-family="Consolas,monospace" font-size="14" fill="#2de08a">&gt;_</text></svg>',
    paint: '<svg width="42" height="42" viewBox="0 0 48 48"><path d="M24 5C13 5 5 13 5 23.5 5 34 13 42 23.5 42c2.8 0 4.4-1.8 4.4-3.8 0-1.9-1.4-2.7-1.4-4.4 0-1.9 1.6-3.3 3.7-3.3h4.2C39.5 30.5 43 26.6 43 21.4 43 11.8 34.6 5 24 5z" fill="#f2f5f8" stroke="#8f9aa6" stroke-width="1.5"/><circle cx="14.5" cy="18" r="3" fill="#e81123"/><circle cx="22.5" cy="13" r="3" fill="#ff8c00"/><circle cx="31.5" cy="15.5" r="3" fill="#107c10"/><circle cx="13.5" cy="27" r="3" fill="#0078d7"/></svg>',
    mines: '<svg width="42" height="42" viewBox="0 0 48 48"><circle cx="24" cy="26" r="14" fill="#333"/><path d="M24 6v6M24 40v6M4 26h6M38 26h6M8 10l4 4M36 10l-4 4M8 42l4-4M36 42l-4-4" stroke="#333" stroke-width="2"/></svg>',
    weather: '<svg width="42" height="42" viewBox="0 0 48 48"><circle cx="18" cy="20" r="8" fill="#ffb900"/><path d="M12 32c-4 0-8-3-8-8s4-8 8-8c1 0 2 0 3 1 2-5 7-8 12-8 6 0 11 4 12 10 4 1 7 4 7 9 0 5-4 9-9 9H14c-1 0-2-1-2-2s1-3 0-3z" fill="#9ad0ff"/></svg>'
  };

  /* ═══════════════════════════════════════════════════════════
     FILE SYSTEM VIRTUAL
  ═══════════════════════════════════════════════════════════ */
  var OS = {
    zTop: 100, winSeq: 0, activeWin: null,
    wins: new Map(),
    FS: null,
    loadFS: function () {
      var saved = null;
      try { saved = JSON.parse(localStorage.getItem('aniaos_fs') || 'null'); } catch (e) {}
      if (saved && typeof saved === 'object') { this.FS = saved; return; }
      this.FS = {
        'Documentos': { type: 'folder', children: {
          'Bienvenida.txt': { type: 'file', kind: 'text', name: 'Bienvenida.txt', size: 600,
            text: 'Bienvenido a ANIA-OS.\n\nComandos:\n  · abre word\n  · abre música\n  · abre documentos\n  · abre el navegador\n  · abre fondos\n  · entrena con documentos\n  · info sistema' }
        }},
        'Imágenes': { type: 'folder', children: {} },
        'Música': { type: 'folder', children: {} },
        'Programas': { type: 'folder', children: {} },
        'Descargas': { type: 'folder', children: {} },
        'Papelera': { type: 'folder', isTrash: true, children: {} }
      };
      this.saveFS();
    },
    saveFS: function () { try { localStorage.setItem('aniaos_fs', JSON.stringify(this.FS)); } catch (e) {} },
    getNode: function (path) {
      var n = { children: this.FS };
      for (var i = 0; i < path.length; i++) {
        if (!n.children || !n.children[path[i]]) return null;
        n = n.children[path[i]];
      }
      return n;
    },
    ensureFolder: function (path) {
      var cur = { children: this.FS };
      for (var i = 0; i < path.length; i++) {
        var p = path[i];
        if (!cur.children) cur.children = {};
        if (!cur.children[p]) cur.children[p] = { type: 'folder', children: {} };
        cur = cur.children[p];
        if (cur.type === 'file') return null;
      }
      if (!cur.children) cur.children = {};
      return cur;
    },
    addFile: function (folderPath, node) {
      var f = this.ensureFolder(folderPath);
      if (!f) return null;
      var nm = String(node.name || 'archivo');
      var dot = nm.lastIndexOf('.');
      var base = dot > 0 ? nm.slice(0, dot) : nm;
      var ext = dot > 0 ? nm.slice(dot) : '';
      var name = nm, i = 2;
      while (f.children[name]) { name = base + ' (' + i + ')' + ext; i++; }
      node.name = name;
      f.children[name] = node;
      this.saveFS();
      return name;
    },
    deleteNode: function (path) {
      var parent = this.getNode(path.slice(0, -1));
      var name = path[path.length - 1];
      if (!parent || !parent.children || !parent.children[name]) return;
      var node = parent.children[name];
      if (parent.isTrash) { delete parent.children[name]; this.saveFS(); return; }
      var trash = this.ensureFolder(['Papelera']);
      var tn = node.name, i = 2;
      while (trash.children[tn]) { tn = node.name + ' (' + i + ')'; i++; }
      node.name = tn;
      trash.children[tn] = node;
      delete parent.children[name];
      this.saveFS();
    }
  };

  /* ═══════════════════════════════════════════════════════════
     HELPERS
  ═══════════════════════════════════════════════════════════ */
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return document.querySelectorAll(s); };
  var el = function (t, c, h) { var e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
  var esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  function toastOS(txt) {
    if (typeof window.toast === 'function') { try { window.toast(txt); return; } catch (e) {} }
    console.log('[OS]', txt);
  }

  /* ═══════════════════════════════════════════════════════════
     VENTANAS
  ═══════════════════════════════════════════════════════════ */
  function createOSWindow(opts) {
    var id = 'osw' + (++OS.winSeq);
    var isMobile = DEVICE.isPhone || DEVICE.isTablet;

    // En móvil: ventanas casi fullscreen por defecto
    var w, h, x, y;
    if (isMobile) {
      w = innerWidth - 8;
      h = innerHeight - 56;
      x = 4;
      y = 4;
    } else {
      w = Math.min(opts.w || 760, innerWidth - 30);
      h = Math.min(opts.h || 500, innerHeight - 70);
      var cnt = OS.wins.size;
      x = Math.max(8, (innerWidth - w) / 2 + ((cnt % 7) - 3) * 30);
      y = Math.max(4, (innerHeight - 44 - h) / 2 + ((cnt % 7) - 3) * 22);
    }

    var win = el('div', 'os-window active');
    win.style.cssText = 'width:' + w + 'px;height:' + h + 'px;left:' + x + 'px;top:' + y + 'px;z-index:' + (++OS.zTop);
    win.innerHTML =
      '<div class="os-titlebar">' +
        '<div class="os-tb-ico">' + (opts.icon || '') + '</div>' +
        '<div class="os-tb-title">' + esc(opts.title || 'Ventana') + '</div>' +
        '<div class="os-tb-btns">' +
          '<button class="os-tb-btn bmin" title="Minimizar">─</button>' +
          '<button class="os-tb-btn bmax" title="Maximizar">▢</button>' +
          '<button class="os-tb-btn close" title="Cerrar">✕</button>' +
        '</div>' +
      '</div>' +
      '<div class="os-body"></div>' +
      '<div class="os-rz"></div>';

    var layer = $('#osWinLayer');
    if (!layer) return null;
    layer.appendChild(win);

    var rec = { el: win, body: win.querySelector('.os-body'), title: opts.title };
    OS.wins.set(id, rec);

    var tb = el('button', 'os-task active', (opts.icon || '') + esc(opts.title || ''));
    tb.dataset.win = id;
    tb.title = opts.title;
    tb.onclick = function () {
      if (OS.activeWin === id && !win.classList.contains('minimized')) minimizeOSWin(id);
      else { win.classList.remove('minimized'); focusOSWin(id); }
    };
    var tasks = $('#osTasks');
    if (tasks) tasks.appendChild(tb);

    win.querySelector('.bmin').onclick = function (e) { e.stopPropagation(); minimizeOSWin(id); };
    win.querySelector('.bmax').onclick = function (e) { e.stopPropagation(); toggleOSMax(id); };
    win.querySelector('.close').onclick = function (e) { e.stopPropagation(); closeOSWin(id); };
    win.addEventListener('pointerdown', function () { focusOSWin(id); });

    var tbar = win.querySelector('.os-titlebar');
    tbar.addEventListener('dblclick', function (e) { if (!e.target.closest('.os-tb-btn')) toggleOSMax(id); });
    tbar.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || e.target.closest('.os-tb-btn')) return;
      var sx = e.clientX, sy = e.clientY, moved = false, ox = 0, oy = 0;
      function mm(ev) {
        if (!moved) {
          if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 4) return;
          moved = true;
          if (win.classList.contains('maximized')) {
            win.classList.remove('maximized');
            win.style.width = w + 'px';
            win.style.height = h + 'px';
            win.style.left = Math.max(0, ev.clientX - w / 2) + 'px';
            win.style.top = Math.max(0, ev.clientY - 16) + 'px';
          }
          ox = win.offsetLeft;
          oy = win.offsetTop;
        }
        win.style.left = (ox + ev.clientX - sx) + 'px';
        win.style.top = Math.max(0, oy + ev.clientY - sy) + 'px';
      }
      function mu() { document.removeEventListener('pointermove', mm); }
      document.addEventListener('pointermove', mm);
      document.addEventListener('pointerup', mu, { once: true });
    });

    var rz = win.querySelector('.os-rz');
    rz.addEventListener('pointerdown', function (e) {
      e.stopPropagation();
      var sx = e.clientX, sy = e.clientY;
      var ow = win.offsetWidth, oh = win.offsetHeight;
      function mm(ev) {
        win.style.width = Math.max(320, ow + ev.clientX - sx) + 'px';
        win.style.height = Math.max(220, oh + ev.clientY - sy) + 'px';
      }
      document.addEventListener('pointermove', mm);
      document.addEventListener('pointerup', function () { document.removeEventListener('pointermove', mm); }, { once: true });
    });

    focusOSWin(id);
    return {
      win: win, body: rec.body, id: id,
      setTitle: function (t) {
        rec.title = t;
        win.querySelector('.os-tb-title').textContent = t;
        tb.title = t;
        tb.textContent = t;
      },
      close: function () { closeOSWin(id); }
    };
  }

  function focusOSWin(id) {
    var w = OS.wins.get(id);
    if (!w) return;
    w.el.style.zIndex = ++OS.zTop;
    OS.wins.forEach(function (o) { o.el.classList.toggle('active', o === w); });
    $$('#osTasks .os-task').forEach(function (b) { b.classList.toggle('active', b.dataset.win === id); });
    OS.activeWin = id;
  }
  function minimizeOSWin(id) {
    var w = OS.wins.get(id); if (!w) return;
    w.el.classList.add('minimized');
    w.el.classList.remove('active');
    var tb = document.querySelector('#osTasks .os-task[data-win="' + id + '"]');
    if (tb) tb.classList.remove('active');
    if (OS.activeWin === id) OS.activeWin = null;
  }
  function toggleOSMax(id) {
    var w = OS.wins.get(id);
    if (w) w.el.classList.toggle('maximized');
  }
  function closeOSWin(id) {
    var w = OS.wins.get(id); if (!w) return;
    w.el.classList.add('closing');
    setTimeout(function () { if (w.el.parentNode) w.el.parentNode.removeChild(w.el); }, 160);
    OS.wins.delete(id);
    var tb = document.querySelector('#osTasks .os-task[data-win="' + id + '"]');
    if (tb) tb.parentNode.removeChild(tb);
    if (OS.activeWin === id) OS.activeWin = null;
  }

  function fileIconOS(node) {
    if (!node) return '';
    if (node.type !== 'file') return IC.folder;
    switch (node.kind) {
      case 'doc': return IC.doc;
      case 'sheet': return IC.xls;
      case 'text': return IC.txt;
      case 'image': return IC.img;
      case 'audio': return IC.audio;
      default: return IC.app;
    }
  }

  /* ═══════════════════════════════════════════════════════════
     APPS
  ═══════════════════════════════════════════════════════════ */
  function appOSExplorer(startPath) {
    var ctx = createOSWindow({ title: 'Explorador', icon: IC.folder, w: 880, h: 560 });
    if (!ctx) return;
    var cur = (startPath || ['Documentos']).slice();
    ctx.body.innerHTML =
      '<div class="os-explorer-toolbar"><button class="os-explorer-nav nback">◀</button><button class="os-explorer-nav nup">▲</button><div class="os-explorer-crumb"></div><button class="os-explorer-nav breload">⟳</button></div>' +
      '<div class="os-explorer-grid"></div>' +
      '<div class="os-status"><span class="s1"></span><span class="s2"></span></div>';
    var grid = ctx.body.querySelector('.os-explorer-grid');
    var crumb = ctx.body.querySelector('.os-explorer-crumb');
    function render() {
      var node = OS.getNode(cur);
      if (!node) { cur = ['Documentos']; return render(); }
      crumb.innerHTML = '';
      var root = el('b', '', 'ANIA-OS');
      root.onclick = function () { cur = []; render(); };
      crumb.appendChild(root);
      cur.forEach(function (p, i) {
        crumb.appendChild(el('span', '', ' › '));
        var b = el('b', '', esc(p));
        b.onclick = function () { cur = cur.slice(0, i + 1); render(); };
        crumb.appendChild(b);
      });
      grid.innerHTML = '';
      var entries = Object.keys(node.children || {}).map(function (k) { return node.children[k]; });
      entries.sort(function (a, b) {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        return a.name.localeCompare(b.name, 'es');
      });
      entries.forEach(function (n) {
        var it = el('div', 'os-file', '<div class="ic">' + fileIconOS(n) + '</div><span>' + esc(n.name) + '</span>');
        it.onclick = function (e) {
          e.stopPropagation();
          grid.querySelectorAll('.os-file').forEach(function (x) { x.classList.remove('sel'); });
          it.classList.add('sel');
        };
        it.ondblclick = function () {
          if (n.type === 'folder') { cur = cur.concat([n.name]); render(); }
          else openOSNode(n);
        };
        grid.appendChild(it);
      });
      ctx.body.querySelector('.s1').textContent = entries.length + ' elemento(s)';
      ctx.body.querySelector('.s2').textContent = cur.join(' \\ ');
      ctx.setTitle((cur[cur.length - 1] || 'ANIA-OS') + ' · Explorador');
    }
    ctx.body.querySelector('.nback').onclick = function () { if (cur.length) { cur = cur.slice(0, -1); render(); } };
    ctx.body.querySelector('.nup').onclick = function () { cur = []; render(); };
    ctx.body.querySelector('.breload').onclick = render;
    render();
  }

  function appOSNotepad(node) {
    var ctx = createOSWindow({ title: (node && node.name || 'Sin título') + ' · Notas', icon: IC.txt, w: 640, h: 480 });
    if (!ctx) return;
    ctx.body.innerHTML = '<textarea class="os-textarea" spellcheck="false">' + esc(node && node.text || '') + '</textarea>' +
      '<div class="os-status"><span class="np-n"></span><span>Guardado local</span></div>';
    var ta = ctx.body.querySelector('.os-textarea');
    function upd() { ctx.body.querySelector('.np-n').textContent = ta.value.length + ' caracteres'; }
    ta.addEventListener('input', upd);
    ta.addEventListener('keydown', function (e) {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        if (!node) {
          var name = prompt('Guardar como:', 'nota-' + Date.now() + '.txt');
          if (!name) return;
          OS.addFile(['Documentos'], { type: 'file', kind: 'text', name: name, text: ta.value, size: ta.value.length });
          ctx.setTitle(name + ' · Notas');
        } else {
          node.text = ta.value;
          node.size = ta.value.length;
          OS.saveFS();
        }
      }
    });
    upd();
  }

  function appOSWord(node) {
    var ctx = createOSWindow({ title: (node && node.name || 'Documento') + ' · Word', icon: IC.doc, w: 900, h: 660 });
    if (!ctx) return;
    ctx.body.innerHTML =
      '<div class="os-wp-toolbar">' +
        '<button class="os-wp-btn" data-cmd="bold"><b>B</b></button>' +
        '<button class="os-wp-btn" data-cmd="italic"><i>I</i></button>' +
        '<button class="os-wp-btn" data-cmd="underline"><u>U</u></button>' +
        '<button class="os-wp-btn" data-cmd="insertUnorderedList">•</button>' +
        '<span style="flex:1"></span>' +
        '<button class="os-wp-btn" data-save="1" style="width:auto;padding:0 12px;">Guardar</button>' +
      '</div>' +
      '<div class="os-wp-canvas"><div class="os-page" contenteditable="true">' + (node && node.html || '<p>Empieza a escribir…</p>') + '</div></div>';
    var page = ctx.body.querySelector('.os-page');
    ctx.body.querySelectorAll('[data-cmd]').forEach(function (b) {
      b.onmousedown = function (e) { e.preventDefault(); };
      b.onclick = function () { page.focus(); document.execCommand(b.dataset.cmd); };
    });
    ctx.body.querySelector('[data-save]').onclick = function () {
      if (!node) {
        var name = prompt('Guardar como:', 'documento-' + Date.now() + '.html');
        if (!name) return;
        OS.addFile(['Documentos'], { type: 'file', kind: 'doc', name: name, html: page.innerHTML, size: page.innerHTML.length });
        ctx.setTitle(name + ' · Word');
      } else {
        node.html = page.innerHTML;
        node.size = page.innerHTML.length;
        OS.saveFS();
      }
    };
  }

  function appOSCalc() {
    var ctx = createOSWindow({ title: 'Calculadora', icon: IC.calc, w: 340, h: 470 });
    if (!ctx) return;
    ctx.body.innerHTML = '<div class="os-calc"><div class="disp">0</div><div class="grid"></div></div>';
    var disp = ctx.body.querySelector('.disp');
    var acc = null, op = null, cur = '0', fresh = true;
    var keys = ['C', '⌫', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '±', '0', ',', '='];
    var grid = ctx.body.querySelector('.grid');
    keys.forEach(function (k) {
      var cls = ['+', '−', '×', '÷'].indexOf(k) >= 0 ? 'op' : (k === '=' ? 'eq' : '');
      var b = el('button', cls, k);
      b.dataset.k = k;
      grid.appendChild(b);
    });
    grid.onclick = function (e) {
      var k = e.target.dataset.k;
      if (!k) return;
      if (/[0-9]/.test(k)) { cur = fresh ? k : (cur === '0' ? k : cur + k); fresh = false; }
      else if (k === ',') { if (cur.indexOf(',') < 0) { cur += ','; fresh = false; } }
      else if (k === 'C') { acc = null; op = null; cur = '0'; fresh = true; }
      else if (k === '⌫') { cur = cur.length > 1 ? cur.slice(0, -1) : '0'; }
      else if (k === '±') { cur = cur.charAt(0) === '-' ? cur.slice(1) : '-' + cur; }
      else if (k === '%') { cur = String(parseFloat(cur.replace(',', '.')) / 100).replace('.', ','); }
      else if (['+', '−', '×', '÷'].indexOf(k) >= 0) { acc = parseFloat(cur.replace(',', '.')); op = k; fresh = true; }
      else if (k === '=' && op !== null) {
        var b = parseFloat(cur.replace(',', '.'));
        var r = op === '+' ? acc + b : op === '−' ? acc - b : op === '×' ? acc * b : (b === 0 ? NaN : acc / b);
        cur = isFinite(r) ? String(+r.toFixed(10)).replace('.', ',') : 'Error';
        acc = null; op = null; fresh = true;
      }
      disp.textContent = cur;
    };
  }

  function appOSTerminal() {
    var ctx = createOSWindow({ title: 'Terminal', icon: IC.term, w: 720, h: 440 });
    if (!ctx) return;
    ctx.body.innerHTML = '<div class="os-term"><div class="os-term-out"></div><div class="os-term-line"><span class="os-term-ps">ANIA-OS:\\&gt;</span><input class="os-term-in"></div></div>';
    var out = ctx.body.querySelector('.os-term-out');
    var inp = ctx.body.querySelector('.os-term-in');
    function print(t) { out.textContent += t + '\n'; out.scrollTop = out.scrollHeight; }
    print('ANIA-OS Shell · escribe "help"');
    inp.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var line = inp.value; inp.value = '';
      print('> ' + line);
      var cmd = line.trim().toLowerCase();
      if (cmd === 'help') print('Comandos: help, ver, date, whoami, clear, apps, files');
      else if (cmd === 'ver') print('ANIA-OS v10.0');
      else if (cmd === 'date') print(new Date().toString());
      else if (cmd === 'whoami') print('operador');
      else if (cmd === 'clear') out.textContent = '';
      else if (cmd === 'apps') print(Object.keys(APPS).join(', '));
      else if (cmd === 'files') { var f = OS.getNode(['Documentos']); print(Object.keys(f.children || {}).join('\n') || '(vacío)'); }
      else if (cmd) print('No reconocido: ' + cmd);
    });
    setTimeout(function () { inp.focus(); }, 100);
  }

  function appOSPaint() {
    var ctx = createOSWindow({ title: 'Paint', icon: IC.paint, w: 820, h: 600 });
    if (!ctx) return;
    ctx.body.innerHTML =
      '<div class="os-wp-toolbar"><input type="color" value="#1b6fb8" id="os-pt-color" style="width:34px;height:26px;border:1px solid #d8d8d8;padding:0"><label style="font-size:12px;display:flex;gap:6px;align-items:center">Grosor <input type="range" id="os-pt-size" min="1" max="30" value="4" style="width:90px"></label><button class="os-wp-btn" id="os-pt-clear" style="width:auto;padding:0 12px;">Limpiar</button><button class="os-wp-btn" id="os-pt-save" style="width:auto;padding:0 12px;">Guardar</button></div>' +
      '<div class="os-paint-wrap"><canvas width="1000" height="560" style="background:#fff"></canvas></div>';
    var cv = ctx.body.querySelector('canvas');
    var x = cv.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height);
    x.lineCap = x.lineJoin = 'round';
    var draw = false;
    function pos(e) { var r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; }
    cv.addEventListener('pointerdown', function (e) {
      draw = true;
      try { cv.setPointerCapture(e.pointerId); } catch (_) {}
      var p = pos(e); x.beginPath(); x.moveTo(p[0], p[1]);
    });
    cv.addEventListener('pointermove', function (e) {
      if (!draw) return;
      x.strokeStyle = ctx.body.querySelector('#os-pt-color').value;
      x.lineWidth = +ctx.body.querySelector('#os-pt-size').value;
      var p = pos(e); x.lineTo(p[0], p[1]); x.stroke();
    });
    cv.addEventListener('pointerup', function () { draw = false; });
    ctx.body.querySelector('#os-pt-clear').onclick = function () { x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height); };
    ctx.body.querySelector('#os-pt-save').onclick = function () {
      var u = cv.toDataURL('image/png');
      OS.addFile(['Imágenes'], { type: 'file', kind: 'image', name: 'dibujo-' + Date.now() + '.png', url: u, size: Math.round(u.length * 0.75) });
    };
  }

  function appOSMines() {
    var ctx = createOSWindow({ title: 'Buscaminas', icon: IC.mines, w: 360, h: 470 });
    if (!ctx) return;
    var R = 9, C = 9, M = 10;
    var mines, open, flag, dead, won, started, timer;
    ctx.body.innerHTML = '<div class="os-mines"><div class="os-mines-top"><span id="os-m-mines">010</span><button id="os-m-reset" style="border:0;background:#e6e6e6;font-size:18px;cursor:pointer;padding:0 8px;">🙂</button><span id="os-m-time">000</span></div><div class="os-mines-grid"></div></div>';
    var grid = ctx.body.querySelector('.os-mines-grid');
    function reset() {
      mines = {}; open = {}; flag = {}; dead = false; won = false; started = false;
      if (timer) { clearInterval(timer); timer = null; }
      ctx.body.querySelector('#os-m-mines').textContent = '010';
      ctx.body.querySelector('#os-m-time').textContent = '000';
      render();
    }
    function neighbors(i) {
      var r = Math.floor(i / C), c = i % C, out = [];
      for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        var nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < R && nc >= 0 && nc < C) out.push(nr * C + nc);
      }
      return out;
    }
    function countAdj(i) { return neighbors(i).filter(function (n) { return mines[n]; }).length; }
    function place(safe) {
      var forb = {}; forb[safe] = 1;
      neighbors(safe).forEach(function (n) { forb[n] = 1; });
      var count = 0;
      while (count < M) {
        var i = Math.floor(Math.random() * R * C);
        if (!forb[i] && !mines[i]) { mines[i] = 1; count++; }
      }
    }
    function reveal(i) {
      if (open[i] || flag[i]) return;
      open[i] = 1;
      if (mines[i]) { dead = true; if (timer) clearInterval(timer); render(); return; }
      if (countAdj(i) === 0) neighbors(i).forEach(reveal);
      var opened = 0;
      for (var k in open) opened++;
      if (opened === R * C - M) { won = true; if (timer) clearInterval(timer); }
      render();
    }
    function render() {
      grid.innerHTML = '';
      for (var i = 0; i < R * C; i++) {
        (function (i) {
          var d = document.createElement('div');
          d.className = 'os-mines-cell';
          if (open[i]) {
            d.classList.add('open');
            if (mines[i]) { d.classList.add('mine'); d.textContent = '💣'; }
            else { var n = countAdj(i); if (n) d.textContent = n; }
          } else if (flag[i]) d.textContent = '🚩';
          d.onclick = function () {
            if (dead || won || flag[i]) return;
            if (!started) {
              started = true;
              place(i);
              var t = 0;
              timer = setInterval(function () {
                t++;
                ctx.body.querySelector('#os-m-time').textContent = String(Math.min(999, t)).padStart(3, '0');
              }, 1000);
            }
            reveal(i);
          };
          d.oncontextmenu = function (e) {
            e.preventDefault();
            if (dead || won || open[i]) return;
            flag[i] ? delete flag[i] : (flag[i] = 1);
            render();
          };
          grid.appendChild(d);
        })(i);
      }
    }
    ctx.body.querySelector('#os-m-reset').onclick = reset;
    reset();
  }

  function appOSWeather() {
    var ctx = createOSWindow({ title: 'Clima', icon: IC.weather, w: 560, h: 480 });
    if (!ctx) return;
    ctx.body.innerHTML = '<div class="os-weather"><div class="os-weather-search"><input placeholder="Ciudad… ej: Madrid"><button>Buscar</button></div><div class="os-wx-out"></div></div>';
    var inp = ctx.body.querySelector('input');
    var out = ctx.body.querySelector('.os-wx-out');
    function buscar(q) {
      out.innerHTML = '<div style="color:#6b6b6b">Buscando…</div>';
      fetch('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(q) + '&count=1&language=es&format=json')
        .then(function (r) { return r.json(); })
        .then(function (g) {
          if (!g.results || !g.results.length) { out.innerHTML = '<div style="color:#d05050">No encontrada</div>'; return; }
          var p = g.results[0];
          return fetch('https://api.open-meteo.com/v1/forecast?latitude=' + p.latitude + '&longitude=' + p.longitude + '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto')
            .then(function (r) { return r.json(); })
            .then(function (w) {
              var c = w.current;
              out.innerHTML = '<div style="background:linear-gradient(135deg,#2f7fbf,#5aa7e0);color:#fff;padding:20px;border-radius:8px;margin-top:10px"><div style="font-size:48px;font-weight:300;line-height:1">' + Math.round(c.temperature_2m) + '°C</div><div style="font-size:18px;margin-top:6px">' + esc(p.name) + '</div><div style="opacity:.9;font-size:13px;margin-top:8px">Sensación ' + Math.round(c.apparent_temperature) + '° · Humedad ' + c.relative_humidity_2m + '% · Viento ' + Math.round(c.wind_speed_10m) + ' km/h</div></div>';
            });
        })
        .catch(function (e) { out.innerHTML = '<div style="color:#d05050">Error: ' + esc(e.message) + '</div>'; });
    }
    ctx.body.querySelector('button').onclick = function () { if (inp.value.trim()) buscar(inp.value.trim()); };
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' && inp.value.trim()) buscar(inp.value.trim()); });
  }

  /* ═══════════════════════════════════════════════════════════
     REGISTRO DE APPS
  ═══════════════════════════════════════════════════════════ */
  var APPS = {
    explorer: { name: 'Explorador', icon: IC.folder, launch: function (a) { appOSExplorer(a && a.path); } },
    notepad: { name: 'Bloc de notas', icon: IC.txt, launch: function (a) { appOSNotepad(a && a.node); } },
    word: { name: 'Word', icon: IC.doc, launch: function (a) { appOSWord(a && a.node); } },
    calc: { name: 'Calculadora', icon: IC.calc, launch: function () { appOSCalc(); } },
    terminal: { name: 'Terminal', icon: IC.term, launch: function () { appOSTerminal(); } },
    paint: { name: 'Paint', icon: IC.paint, launch: function () { appOSPaint(); } },
    mines: { name: 'Buscaminas', icon: IC.mines, launch: function () { appOSMines(); } },
    weather: { name: 'Clima', icon: IC.weather, launch: function () { appOSWeather(); } }
  };

  function openOSNode(node) {
    if (!node) return;
    if (node.type !== 'file') { appOSExplorer(); return; }
    switch (node.kind) {
      case 'doc': appOSWord(node); break;
      case 'text': appOSNotepad(node); break;
      default: toastOS('No sé abrir: ' + node.name);
    }
  }

  function renderOSDesktop() {
    var box = $('#osIcons');
    if (!box) return;
    box.innerHTML = '';
    var items = [
      ['Este equipo', IC.folder, function () { appOSExplorer([]); }],
      ['Documentos', IC.folder, function () { appOSExplorer(['Documentos']); }],
      ['Papelera', IC.folder, function () { appOSExplorer(['Papelera']); }]
    ];
    if (window.OSRemote) {
      items.push(['🎵 Música', '<span style="font-size:36px">🎵</span>', function () { window.OSRemote.appOSMusic(); }]);
      items.push(['📄 Documentos', '<span style="font-size:36px">📄</span>', function () { window.OSRemote.appOSDocViewer(); }]);
      items.push(['🌐 Navegador', '<span style="font-size:36px">🌐</span>', function () { window.OSRemote.appOSBrowser(); }]);
      if (window.OSRemote.appOSWallpaper) {
        items.push(['🎨 Fondos', '<span style="font-size:36px">🎨</span>', function () { window.OSRemote.appOSWallpaper(); }]);
      }
    }
    items.forEach(function (it) {
      var d = el('div', 'os-icon', '<div class="ic">' + it[1] + '</div><span>' + it[0] + '</span>');
      d.onclick = function (e) {
        e.stopPropagation();
        $$('.os-icon').forEach(function (x) { x.classList.remove('sel'); });
        d.classList.add('sel');
      };
      d.ondblclick = it[2];
      box.appendChild(d);
    });
  }

  function renderOSStartMenu() {
    var sm = $('#osSmApps');
    if (!sm) return;
    sm.innerHTML = '';
    Object.keys(APPS).forEach(function (k) {
      var a = APPS[k];
      var b = el('button', '', '<span style="width:26px;display:inline-grid;place-items:center">' + a.icon + '</span>' + esc(a.name));
      b.onclick = function () { closeOSStart(); a.launch(); };
      sm.appendChild(b);
    });
  }

  function toggleOSStart() { var sm = $('#osStartMenu'); if (sm) sm.classList.toggle('on'); }
  function closeOSStart() { var sm = $('#osStartMenu'); if (sm) sm.classList.remove('on'); }

  function tickOSClock() {
    var d = new Date();
    if ($('#osClockT')) $('#osClockT').textContent = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    if ($('#osClockD')) $('#osClockD').textContent = d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  setInterval(tickOSClock, 1000);

  /* ═══════════════════════════════════════════════════════════
     OSBridge · comandos en lenguaje natural
  ═══════════════════════════════════════════════════════════ */
  var OSBridge = {
    listarApps: function () { return Object.keys(APPS).map(function (k) { return { id: k, nombre: APPS[k].name }; }); },
    abrirApp: function (id) {
      var a = APPS[id];
      if (!a) return { ok: false, error: 'app desconocida: ' + id };
      try { a.launch(); return { ok: true, app: id }; }
      catch (e) { return { ok: false, error: e.message }; }
    },
    cerrarApp: function (id, titulo) {
      var n = 0;
      OS.wins.forEach(function (w, wid) {
        var match = titulo
          ? (w.title && w.title.toLowerCase().indexOf(String(titulo).toLowerCase()) >= 0)
          : (!id || w.title.toLowerCase().indexOf((APPS[id] && APPS[id].name || id).toLowerCase()) >= 0);
        if (match) { closeOSWin(wid); n++; }
      });
      return { ok: true, cerrados: n };
    },
    ventanasAbiertas: function () {
      var out = [];
      OS.wins.forEach(function (w) { out.push({ titulo: w.title }); });
      return out;
    },
    listarArchivos: function (carpeta) {
      var node = OS.getNode(carpeta ? [carpeta] : []);
      if (!node) return { ok: false, error: 'no existe' };
      return {
        ok: true,
        carpeta: carpeta || '(raíz)',
        items: Object.keys(node.children || {}).map(function (k) {
          var c = node.children[k];
          return { nombre: c.name, tipo: c.type, kind: c.kind || null, tamaño: c.size || 0 };
        })
      };
    },
    crearArchivo: function (carpeta, nombre, contenido) {
      var path = [carpeta || 'Documentos'];
      if (!OS.getNode(path)) return { ok: false, error: 'carpeta no existe' };
      var kind = inferirKind(nombre);
      var real = OS.addFile(path, { type: 'file', kind: kind, name: nombre, text: contenido || '', size: (contenido || '').length });
      return { ok: true, archivo: real, carpeta: path[0], kind: kind };
    },
    buscarArchivos: function (q) {
      var ql = String(q || '').toLowerCase().trim();
      if (!ql) return { ok: false, error: 'falta término' };
      var hits = [];
      (function walk(node, path) {
        if (!node || !node.children) return;
        for (var k in node.children) {
          var c = node.children[k];
          var np = path.concat([c.name]);
          if (c.type === 'file' && c.name.toLowerCase().indexOf(ql) >= 0) hits.push({ ruta: np.join('/'), tamaño: c.size || 0 });
          if (c.type !== 'file') walk(c, np);
        }
      })(OS.getNode([]), []);
      return { ok: true, resultados: hits.slice(0, 30) };
    },
    cambiarFondo: function (id) {
      var walls = [
        'linear-gradient(135deg,#04070d 0%,#0a2038 50%,#0d2b4a 100%)',
        'linear-gradient(135deg,#1c4a77 0%,#0d2440 60%,#04070d 100%)',
        'linear-gradient(135deg,#0e1e38 0%,#3e5a80 50%,#8a5a4a 100%)',
        'linear-gradient(135deg,#0a0f1a 0%,#0d2440 50%,#0f1a2e 100%)'
      ];
      var k = Number(id) || 0;
      if (k < 0 || k >= walls.length) k = 0;
      var wp = $('#osWallpaper');
      if (wp) {
        wp.innerHTML = '';
        wp.style.backgroundImage = walls[k];
        wp.style.backgroundSize = 'cover';
        wp.style.backgroundPosition = 'center';
        wp.style.backgroundRepeat = 'no-repeat';
        wp.style.backgroundColor = '#040806';
      }
      try {
        localStorage.setItem('aniaos_wall', String(k));
        localStorage.removeItem('aniaos_wall_url');
      } catch (e) {}
      return { ok: true, fondo: k };
    },
    infoSistema: function () {
      var n = 0;
      (function walk(node) {
        if (!node || !node.children) return;
        for (var k in node.children) {
          n++;
          if (node.children[k].type !== 'file') walk(node.children[k]);
        }
      })(OS.FS);
      var hm = performance.memory;
      return {
        ok: true, ventanas: OS.wins.size, apps: Object.keys(APPS).length, archivos: n,
        memoriaJS: hm ? Math.round(hm.usedJSHeapSize / 1048576) + ' MB' : '—',
        nucleos: navigator.hardwareConcurrency || '—', online: navigator.onLine,
        device: DEVICE.type, os: DEVICE.os
      };
    },
    apagar: function () { osShutdown(); return { ok: true }; },
    ejecutar: function (cmd) {
      var c = String(cmd || '').toLowerCase().trim();
      if (!c) return Promise.resolve({ ok: false, error: 'comando vacío' });
      var m;

      m = c.match(/^(?:abre|abrir|lanza|inicia|ejecuta|arranca)\s+(?:la\s+|el\s+|los\s+|las\s+)?(.+?)$/);
      if (m) {
        var q = m[1].trim();
        var aliases = {
          'explorador': 'explorer', 'archivos': 'explorer', 'documentos': 'explorer', 'papelera': 'explorer',
          'word': 'word', 'documento': 'word',
          'texto': 'notepad', 'bloc': 'notepad', 'notas': 'notepad', 'notepad': 'notepad',
          'calc': 'calc', 'calculadora': 'calc', 'cuenta': 'calc',
          'terminal': 'terminal', 'consola': 'terminal', 'cmd': 'terminal',
          'paint': 'paint', 'dibujo': 'paint',
          'buscaminas': 'mines', 'minas': 'mines',
          'clima': 'weather', 'tiempo': 'weather'
        };
        var found = aliases[q];
        if (!found) {
          for (var k in APPS) {
            if (k === q || APPS[k].name.toLowerCase().indexOf(q) >= 0) { found = k; break; }
          }
        }
        if (found) return Promise.resolve(OSBridge.abrirApp(found));
        return Promise.resolve({ ok: false, error: 'app no reconocida: ' + q });
      }

      m = c.match(/^cierra\s+(?:la\s+|el\s+|las\s+|los\s+)?(?:ventana\s+de\s+|app\s+)?(.+)$/);
      if (m) {
        var q2 = m[1].trim();
        if (/todas|ventanas/.test(q2)) return Promise.resolve(OSBridge.cerrarApp());
        return Promise.resolve(OSBridge.cerrarApp(null, q2));
      }

      m = c.match(/^(?:crea|crear|nuevo|guarda|escribe)\s+(?:un\s+|el\s+|la\s+)?(?:archivo|documento|nota|doc)\s+(?:llamado\s+|con\s+nombre\s+|de\s+nombre\s+)?["']?([^"']+?)["']?(?:\s+con\s+(?:contenido|texto)\s+["']?(.+?)["']?)?$/);
      if (m) return Promise.resolve(OSBridge.crearArchivo('Documentos', m[1].trim(), (m[2] || '').trim()));

      m = c.match(/^(?:busca|b[uú]scame|encuentra)\s+(?:el\s+archivo\s+|el\s+documento\s+|archivo\s+)?(.+)$/);
      if (m) { var q3 = m[1].trim(); return Promise.resolve(OSBridge.buscarArchivos(q3)); }

      m = c.match(/^(?:cambia|cambiar|pon)\s+(?:el\s+)?fondo\s+(?:a\s+|por\s+|al?\s+)?(.+)$/);
      if (m) {
        var map = { 'aurora': 0, '0': 0, 'ventana': 1, '1': 1, 'montaña': 2, 'montanas': 2, '2': 2, 'lineas': 3, 'líneas': 3, '3': 3 };
        var kk = map[m[1].trim()];
        if (kk != null) return Promise.resolve(OSBridge.cambiarFondo(kk));
      }

      if (/^(?:apaga|apagar|shutdown)\s*(?:el\s+)?(?:pc|sistema|equipo|os)?$/.test(c)) return Promise.resolve(OSBridge.apagar());
      if (/^(?:info|estado|status)\s*(?:del\s+)?(?:sistema|os)?$/.test(c)) return Promise.resolve(OSBridge.infoSistema());
      if (/ventanas?\s+abiertas?/.test(c)) return Promise.resolve({ ok: true, ventanas: OSBridge.ventanasAbiertas() });

      m = c.match(/^(?:lista|listar|muestra|qu[eé]\s+hay\s+en)\s+(?:los\s+|las\s+)?(?:archivos\s+de\s+|carpeta\s+)?(.+)$/);
      if (m) return Promise.resolve(OSBridge.listarArchivos(m[1].trim()));

      return Promise.resolve({ ok: false, error: 'comando no reconocido' });
    }
  };
  window.OSBridge = OSBridge;

  function inferirKind(nombre) {
    var e = String(nombre).split('.').pop().toLowerCase();
    if (['txt', 'md', 'log', 'csv'].indexOf(e) >= 0) return 'text';
    if (['doc', 'docx'].indexOf(e) >= 0) return 'doc';
    if (['xls', 'xlsx'].indexOf(e) >= 0) return 'sheet';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].indexOf(e) >= 0) return 'image';
    if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].indexOf(e) >= 0) return 'audio';
    return 'generic';
  }

  /* ═══════════════════════════════════════════════════════════
     Hook send() · comandos "abre word" desde el chat
  ═══════════════════════════════════════════════════════════ */
  function hookSend() {
    if (!window.send || window.__osSendHooked) return false;
    window.__osSendHooked = true;
    var origSend = window.send;
    window.send = async function (text) {
      try {
        var r = await OSBridge.ejecutar(text);
        if (r && r.ok) {
          var msg = '✓ ';
          if (r.app) msg += 'App «' + r.app + '» abierta.';
          else if (r.archivo) msg += 'Archivo «' + r.archivo + '» creado en ' + r.carpeta + '.';
          else if (r.cerrados != null) msg += r.cerrados + ' ventana(s) cerrada(s).';
          else if (r.items) msg += r.carpeta + ': ' + (r.items.slice(0, 8).map(function (i) { return i.nombre; }).join(', ') || '(vacía)');
          else if (r.resultados) msg += r.resultados.length ? r.resultados.length + ' encontrado(s):\n' + r.resultados.map(function (x) { return '· ' + x.ruta; }).join('\n') : 'Sin resultados.';
          else if (r.ventanas) msg += r.ventanas.length + ' ventana(s): ' + (r.ventanas.map(function (v) { return v.titulo; }).join(', ') || 'ninguna');
          else if (r.fondo != null) msg += 'Fondo cambiado a ' + r.fondo + '.';
          else if (r.memoriaJS) msg += 'Ventanas: ' + r.ventanas + ' · Apps: ' + r.apps + ' · Archivos: ' + r.archivos;
          else msg += 'Hecho.';
          try { if (typeof window.addChat === 'function') window.addChat('you', text); } catch (e) {}
          try { if (typeof window.reply === 'function') { window.reply(msg); return; } } catch (e) {}
          try { if (typeof window.personaReply === 'function') { window.personaReply(msg); return; } } catch (e) {}
          return;
        }
      } catch (e) {}
      return origSend.call(this, text);
    };
    console.log('[OS] send() hooked');
    return true;
  }

  /* ═══════════════════════════════════════════════════════════
     FONDO SEGURO · <img> en vez de CSS background
  ═══════════════════════════════════════════════════════════ */
  function aplicarFondoSeguro(url, nombre) {
    var wp = $('#osWallpaper');
    if (!wp) return;
    wp.innerHTML = '';
    wp.style.backgroundImage = 'linear-gradient(135deg,#04070d 0%,#0a2038 50%,#0d2b4a 100%)';
    wp.style.backgroundSize = 'cover';
    wp.style.backgroundPosition = 'center';
    wp.style.backgroundColor = '#040806';
    if (!url) {
      try { localStorage.removeItem('aniaos_wall_url'); } catch (e) {}
      toastOS('Fondo restaurado');
      return;
    }
    var img = document.createElement('img');
    img.className = 'wall-img';
    img.alt = '';
    img.onload = function () {
      console.log('[Fondo] OK:', url, img.naturalWidth + 'x' + img.naturalHeight);
      if (nombre) toastOS('🎨 Fondo: ' + nombre);
    };
    img.onerror = function () {
      console.warn('[Fondo] Error:', url);
      img.remove();
      try { localStorage.removeItem('aniaos_wall_url'); } catch (e) {}
      toastOS('No pude cargar el fondo');
    };
    img.src = url;
    wp.appendChild(img);
    try { localStorage.setItem('aniaos_wall_url', url); } catch (e) {}
  }

  /* ═══════════════════════════════════════════════════════════
     CHAT MINIMIZABLE · añade botón a header + FAB para restaurar
  ═══════════════════════════════════════════════════════════ */
  function setupChatMinimize() {
    var app = document.getElementById('app');
    if (!app || app.__chatMinWired) return;
    app.__chatMinWired = true;

    // Botón minimizar dentro del header de ANIA
    var header = app.querySelector('header');
    if (header && !document.getElementById('chatMinBtn')) {
      var minBtn = document.createElement('button');
      minBtn.id = 'chatMinBtn';
      minBtn.type = 'button';
      minBtn.title = 'Minimizar chat';
      minBtn.setAttribute('aria-label', 'Minimizar chat');
      minBtn.innerHTML = '─';
      minBtn.onclick = function (e) { e.stopPropagation(); toggleChatMin(true); };
      header.appendChild(minBtn);
    }

    // FAB flotante para restaurar (oculto por defecto, aparece cuando minimized)
    if (!document.getElementById('chatFab')) {
      var fab = document.createElement('button');
      fab.id = 'chatFab';
      fab.type = 'button';
      fab.title = 'Abrir chat de Ania';
      fab.setAttribute('aria-label', 'Abrir chat de Ania');
      fab.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:26px;height:26px">' +
          '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' +
        '</svg>' +
        '<span class="chat-fab-label">ANIA</span>';
      fab.onclick = function () { toggleChatMin(false); };
      document.body.appendChild(fab);
    }

    // Restaurar estado (default = minimizado en móvil, expandido en desktop)
    var saved = null;
    try { saved = localStorage.getItem('os_chat_min'); } catch (e) {}
    var minimized;
    if (saved === null) {
      minimized = DEVICE.isPhone; // primera vez: minimizado en móvil
    } else {
      minimized = saved === '1';
    }
    applyChatMin(minimized);
  }

  function applyChatMin(min) {
    var b = document.body;
    b.classList.toggle('os-chat-min', !!min);
    try { localStorage.setItem('os_chat_min', min ? '1' : '0'); } catch (e) {}
    // Ajustar FAB según estado y modo OS
    var fab = document.getElementById('chatFab');
    if (fab) {
      var visible = !!min && b.classList.contains('os-on');
      fab.classList.toggle('on', visible);
    }
  }

  function toggleChatMin(force) {
    var next = (typeof force === 'boolean') ? force : !document.body.classList.contains('os-chat-min');
    applyChatMin(next);
  }

  // Exponer para debug
  window.OSChatMin = {
    toggle: toggleChatMin,
    minimize: function () { applyChatMin(true); },
    restore: function () { applyChatMin(false); },
    isMinimized: function () { return document.body.classList.contains('os-chat-min'); }
  };

  /* ═══════════════════════════════════════════════════════════
     ENTRAR / SALIR DEL OS
  ═══════════════════════════════════════════════════════════ */
  function enterOS() {
    document.body.classList.add('os-on');
    document.body.classList.remove('app-on');

    var returnFab = document.getElementById('returnFab');
    if (returnFab) returnFab.classList.add('on');

    // Refrescar FAB del chat según estado de minimización
    var fab = document.getElementById('chatFab');
    if (fab) {
      var min = document.body.classList.contains('os-chat-min');
      fab.classList.toggle('on', min);
    }

    tickOSClock();
    try { renderOSDesktop(); } catch (e) { console.warn('[OS] renderDesktop:', e); }
    try { renderOSStartMenu(); } catch (e) { console.warn('[OS] renderStartMenu:', e); }

    var wallUrl = null;
    try { wallUrl = localStorage.getItem('aniaos_wall_url'); } catch (e) {}
    if (wallUrl) { aplicarFondoSeguro(wallUrl, null); return; }

    var wall = null;
    try { wall = localStorage.getItem('aniaos_wall'); } catch (e) {}
    var wp = $('#osWallpaper');
    if (wall != null && wp) {
      var walls = [
        'linear-gradient(135deg,#04070d 0%,#0a2038 50%,#0d2b4a 100%)',
        'linear-gradient(135deg,#1c4a77 0%,#0d2440 60%,#04070d 100%)',
        'linear-gradient(135deg,#0e1e38 0%,#3e5a80 50%,#8a5a4a 100%)',
        'linear-gradient(135deg,#0a0f1a 0%,#0d2440 50%,#0f1a2e 100%)'
      ];
      wp.innerHTML = '';
      wp.style.backgroundImage = walls[Number(wall)] || walls[0];
      wp.style.backgroundSize = 'cover';
      wp.style.backgroundPosition = 'center';
      wp.style.backgroundColor = '#040806';
    }
  }

  function exitOS() {
    document.body.classList.remove('os-on');
    document.body.classList.add('app-on');

    var returnFab = document.getElementById('returnFab');
    if (returnFab) returnFab.classList.remove('on');

    // Ocultar FAB del chat al salir del OS (el estado se conserva)
    var fab = document.getElementById('chatFab');
    if (fab) fab.classList.remove('on');

    closeOSStart();
  }

  function osShutdown() {
    document.body.classList.remove('os-on');
    document.body.classList.remove('app-on');
    var app = document.getElementById('app');
    if (app) app.style.display = 'none';
    var boot = document.getElementById('boot');
    if (boot) { boot.style.display = 'flex'; boot.classList.remove('hide'); }
    var lb = document.getElementById('loginBox');
    var rb = document.getElementById('registerBox');
    var bs = document.getElementById('bootStart');
    if (lb) lb.style.display = 'flex';
    if (rb) rb.style.display = 'none';
    if (bs) bs.style.display = 'none';
    var ids = [];
    OS.wins.forEach(function (w, id) { ids.push(id); });
    ids.forEach(function (id) { closeOSWin(id); });
    var log = document.getElementById('bootLog');
    if (log) log.innerHTML = '';
    document.querySelectorAll('.overlay.on').forEach(function (o) { o.classList.remove('on'); });
    if (app) app.style.display = '';
    var returnFab = document.getElementById('returnFab');
    if (returnFab) returnFab.classList.remove('on');
    var fab = document.getElementById('chatFab');
    if (fab) fab.classList.remove('on');
    console.log('[OS] Shutdown → login');
  }
  window.OSShutdown = osShutdown;

  /* ═══════════════════════════════════════════════════════════
     WIRE BUTTONS
  ═══════════════════════════════════════════════════════════ */
  function wireButtons() {
    var sb = $('#osStartBtn');
    if (sb) sb.onclick = function (e) { e.stopPropagation(); toggleOSStart(); };

    document.addEventListener('pointerdown', function (e) {
      if (!e.target.closest('#osTaskbar') && !e.target.closest('#osStartMenu')) closeOSStart();
    });

    $$('#osStartMenu [data-os]').forEach(function (b) {
      b.onclick = function () {
        var a = b.dataset.os;
        closeOSStart();
        if (a === 'toggleAnia') exitOS();
        else if (a === 'shutdown') osShutdown();
      };
    });

    var ex = $('#osExit');
    if (ex) ex.onclick = function () { osShutdown(); };

    var returnFab = document.getElementById('returnFab');
    if (returnFab && !returnFab.__wired) {
      returnFab.__wired = true;
      returnFab.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        try { exitOS(); } catch (err) { console.warn('[OS] exitOS:', err); }
      });
    }

    var btnMiniOS = document.getElementById('btnMiniOS');
    if (btnMiniOS && !btnMiniOS.__wired) {
      btnMiniOS.__wired = true;
      btnMiniOS.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof window.closeDock === 'function') { try { window.closeDock(); } catch (err) {} }
        var dockDrawer = document.getElementById('dockDrawer');
        var dockBackdrop = document.getElementById('dockBackdrop');
        if (dockDrawer) dockDrawer.classList.remove('on');
        if (dockBackdrop) dockBackdrop.classList.remove('on');
        setTimeout(function () {
          try { enterOS(); } catch (err) { console.warn('[OS] enterOS:', err); }
        }, 150);
      });
    }

    var btnMood = document.getElementById('btnMood');
    var dockMoodIcon = document.getElementById('dockMoodIcon');
    var moodBubble = document.getElementById('moodBubble');
    if (btnMood && !btnMood.__wired) {
      btnMood.__wired = true;
      btnMood.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (moodBubble) { try { moodBubble.click(); } catch (err) {} }
      });
    }

    if (moodBubble && dockMoodIcon) {
      var syncMood = function () {
        var txt = (moodBubble.textContent || '').trim();
        if (txt && txt !== dockMoodIcon.textContent.trim()) {
          dockMoodIcon.textContent = txt;
        }
      };
      var obs = new MutationObserver(syncMood);
      obs.observe(moodBubble, { childList: true, characterData: true, subtree: true, attributes: true });
      syncMood();
    }
  }

  /* ═══════════════════════════════════════════════════════════
     INIT
  ═══════════════════════════════════════════════════════════ */
  var _osReady = false;

  function initOS() {
    if (_osReady) return;
    _osReady = true;
    try { OS.loadFS(); } catch (e) { console.warn('[OS] loadFS:', e); }
    applyDeviceClasses();
    wireButtons();
    setupChatMinimize();
    tickOSClock();

    // Actualizar clases al rotar / redimensionar
    window.addEventListener('resize', debounce(refreshDevice, 200));
    window.addEventListener('orientationchange', function () { setTimeout(refreshDevice, 150); });

    console.log('[OS] Mini-OS listo ·', Object.keys(APPS).length, 'apps ·', Object.keys(OS.FS).length,
      'carpetas · device:', DEVICE.type, '/', DEVICE.os);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOS);
  } else {
    initOS();
  }
  setTimeout(initOS, 3000);

  var _hookTries = 0;
  (function tickHook() {
    _hookTries++;
    if (hookSend()) return;
    if (_hookTries < 200) setTimeout(tickHook, 200);
    else console.warn('[OS] send() nunca apareció tras 40s');
  })();

  window.addEventListener('load', function () {
    setTimeout(function () { wireButtons(); setupChatMinimize(); }, 500);
  });

  /* ═══════════════════════════════════════════════════════════
     API GLOBAL
  ═══════════════════════════════════════════════════════════ */
  window.OS = OS;
  window.OS_APPS = APPS;
  window.IC = IC;
  window.OS_DEVICE = DEVICE;
  window.OS_createWindow = createOSWindow;
  window.OS_closeWindow = closeOSWin;
  window.OS_focusWindow = focusOSWin;
  window.OS_minimizeWindow = minimizeOSWin;
  window.OS_toggleMaxWindow = toggleOSMax;
  window.OS_renderStartMenu = renderOSStartMenu;
  window.OS_renderDesktop = renderOSDesktop;
  window.OS_enter = enterOS;
  window.OS_exit = exitOS;
  window.OS_aplicarFondo = aplicarFondoSeguro;
  console.log('[OS] API global expuesta ✓');
})();
