/* ============================================================
   15-DOCK · FAB + drawer tipo control center
   + Runas dinámicas según la hora (Tensei Slime × Overlord)
============================================================ */
'use strict';

(function(){
  const fab      = document.getElementById('dockFab');
  const backdrop = document.getElementById('dockBackdrop');
  const drawer   = document.getElementById('dockDrawer');
  const closeBtn = document.getElementById('dockClose');
  if (!fab || !drawer) return;

  /* ============================================================
     RUNAS · 4 configuraciones según la hora del día
     Inspiradas en: Overlord Runecraft (50 lesser, 25 middle,
     10 upper, 5 top runes) + Tensei Slime (暴風の紋章)
  ============================================================ */
  const RUNAS = [
    {
      // 06:00 – 11:59 · Amanecer
      desde: 6, hasta: 12,
      nombre: 'BERKANO',
      titulo: 'Renacimiento',
      letra: 'ᛒ',
      color: '#2de08a',
      colorGlow: 'rgba(45,224,138,0.7)',
      // 8 runas en el anillo exterior
      anillo: ['ᚠ','ᚢ','ᚦ','ᚨ','ᚱ','ᚲ','ᚷ','ᚹ'],
      // velocidad de giro del anillo exterior (segundos por vuelta)
      velocidad: 24
    },
    {
      // 12:00 – 17:59 · Mediodía
      desde: 12, hasta: 18,
      nombre: 'SOWILO',
      titulo: 'Sol',
      letra: 'ᛋ',
      color: '#ffb547',
      colorGlow: 'rgba(255,181,71,0.7)',
      anillo: ['ᛋ','ᛏ','ᛒ','ᛖ','ᛗ','ᛚ','ᛜ','ᛞ'],
      velocidad: 18
    },
    {
      // 18:00 – 23:59 · Atardecer
      desde: 18, hasta: 24,
      nombre: 'OTHALA',
      titulo: 'Hogar',
      letra: 'ᛟ',
      color: '#ff5470',
      colorGlow: 'rgba(255,84,112,0.7)',
      anillo: ['ᛟ','ᛞ','ᛚ','ᛜ','ᛗ','ᛖ','ᛒ','ᛏ'],
      velocidad: 30
    },
    {
      // 00:00 – 05:59 · Madrugada
      desde: 0, hasta: 6,
      nombre: 'ANSUZ',
      titulo: 'Sabiduría',
      letra: 'ᚨ',
      color: '#9fdcff',
      colorGlow: 'rgba(159,220,255,0.7)',
      anillo: ['ᚨ','ᛒ','ᚦ','ᛗ','ᚱ','ᚲ','ᚷ','ᛏ'],
      velocidad: 40
    }
  ];

  // Devuelve la runa activa según la hora actual (0-23)
  function runaActual(){
    const h = new Date().getHours();
    return RUNAS.find(r => h >= r.desde && h < r.hasta) || RUNAS[0];
  }

  /* ============================================================
     Construir el SVG del FAB con la runa actual
     Estructura: 3 capas concéntricas
       1. Anillo exterior de 8 runas anglosajonas (gira lento)
       2. Círculo mágico con hexagrama (Tensei Slime)
       3. Runa central grande (Overlord)
  ============================================================ */
  function construirSVG(runa){
    return `
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" class="rune-svg">
        <defs>
          <radialGradient id="runeCore" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stop-color="${runa.color}" stop-opacity="0.9"/>
            <stop offset="60%"  stop-color="${runa.color}" stop-opacity="0.15"/>
            <stop offset="100%" stop-color="${runa.color}" stop-opacity="0"/>
          </radialGradient>
          <filter id="runeGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.6" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        <!-- 1. Anillo exterior de 8 runas (gira) -->
        <g class="rune-ring" style="transform-origin:50px 50px;">
          ${runa.anillo.map((letra, i) => {
            const ang = (i / 8) * 360;
            return `<text
              x="50" y="8"
              text-anchor="middle"
              font-size="5"
              fill="${runa.color}"
              fill-opacity="0.75"
              font-family="monospace"
              transform="rotate(${ang} 50 50)"
              style="filter:drop-shadow(0 0 1.5px ${runa.colorGlow});"
            >${letra}</text>`;
          }).join('')}
        </g>

        <!-- 2. Círculo mágico estilo Tensei Slime -->
        <circle cx="50" cy="50" r="34"
          fill="none"
          stroke="${runa.color}"
          stroke-opacity="0.22"
          stroke-width="0.5"
          stroke-dasharray="1 2"/>
        <circle cx="50" cy="50" r="28"
          fill="none"
          stroke="${runa.color}"
          stroke-opacity="0.35"
          stroke-width="0.6"/>
        <circle cx="50" cy="50" r="22"
          fill="none"
          stroke="${runa.color}"
          stroke-opacity="0.25"
          stroke-width="0.4"
          stroke-dasharray="3 1.5"/>

        <!-- Hexagrama tenue -->
        <g stroke="${runa.color}" stroke-opacity="0.28" stroke-width="0.4" fill="none">
          <polygon points="50,26 71,62 29,62"/>
          <polygon points="50,74 29,38 71,38"/>
        </g>

        <!-- Puntos cardinales (marcas rúnicas) -->
        <g fill="${runa.color}" fill-opacity="0.8">
          <circle cx="50" cy="14" r="1"/>
          <circle cx="86" cy="50" r="1"/>
          <circle cx="50" cy="86" r="1"/>
          <circle cx="14" cy="50" r="1"/>
        </g>

        <!-- 3. Halo central -->
        <circle cx="50" cy="50" r="14" fill="url(#runeCore)"/>

        <!-- 4. Runa central grande (Overlord) -->
        <text
          x="50" y="50"
          text-anchor="middle"
          dominant-baseline="central"
          font-size="26"
          font-family="serif"
          fill="${runa.color}"
          filter="url(#runeGlow)"
          style="font-weight:400;"
        >${runa.letra}</text>
      </svg>
    `;
  }

  /* ============================================================
     Aplicar runa al FAB
  ============================================================ */
  let runaAplicada = null;

  function aplicarRuna(runa, forzar){
    if (!forzar && runaAplicada === runa.nombre) return;
    runaAplicada = runa.nombre;

    // Inyectar SVG
    fab.innerHTML = construirSVG(runa);

    // Colores dinámicos via CSS custom properties
    fab.style.setProperty('--rune-color', runa.color);
    fab.style.setProperty('--rune-glow', runa.colorGlow);
    fab.style.setProperty('--rune-speed', runa.velocidad + 's');

    // Actualizar title accesible
    fab.title = `Menú · ${runa.titulo} (${runa.nombre})`;

    // Cambiar color del texto del drawer para coherencia cromática
    document.documentElement.style.setProperty('--rune-accent', runa.color);
    document.documentElement.style.setProperty('--rune-accent-glow', runa.colorGlow);
  }

  function refrescarRuna(){
    aplicarRuna(runaActual(), false);
  }

  // Aplicar al arrancar
  refrescarRuna();

  // Refrescar cada minuto (para detectar cambio de hora)
  setInterval(refrescarRuna, 60 * 1000);

  // También al volver de background
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refrescarRuna();
  });

  /* ============================================================
     Abrir / cerrar drawer
  ============================================================ */
  let open = false;

  function abrir(){
    if (open) return;
    open = true;
    drawer.classList.add('open');
    backdrop.classList.add('on');
    fab.classList.add('open');
  }

  function cerrar(){
    if (!open) return;
    open = false;
    drawer.classList.remove('open');
    backdrop.classList.remove('on');
    fab.classList.remove('open');
  }

  function toggle(){ open ? cerrar() : abrir(); }

  fab.onclick = toggle;
  backdrop.onclick = cerrar;
  if (closeBtn) closeBtn.onclick = cerrar;

  drawer.querySelectorAll('.dock-item').forEach(item => {
    item.addEventListener('click', () => {
      setTimeout(cerrar, 90);
    });
  });

  document.addEventListener('keydown', (e)=>{
    if (e.key === 'Escape' && open) cerrar();
  });

  /* Swipe down para cerrar */
  let startY = 0, startT = 0, moved = 0, dragging = false;
  drawer.addEventListener('touchstart', e => {
    startY = e.touches[0].clientY;
    startT = Date.now();
    moved = 0;
    dragging = true;
  }, {passive:true});

  drawer.addEventListener('touchmove', e => {
    if (!dragging) return;
    const dy = e.touches[0].clientY - startY;
    if (dy > 0){
      moved = dy;
      drawer.style.transition = 'none';
      drawer.style.transform = `translateX(-50%) translateY(${dy}px)`;
    }
  }, {passive:true});

  drawer.addEventListener('touchend', () => {
    if (!dragging) return;
    dragging = false;
    drawer.style.transition = '';
    drawer.style.transform = '';
    const time = Date.now() - startT;
    if (moved > 110 || (moved > 40 && time < 220)){
      cerrar();
    }
    startY = 0; moved = 0;
  });

  /* API pública */
  window.Dock = {
    abrir, cerrar, toggle,
    isOpen(){ return open; },
    runaActual(){ return runaActual(); }
  };

  console.log('✓ Dock control-center cargado · runa:', runaAplicada);
})();
