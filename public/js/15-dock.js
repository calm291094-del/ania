/* ============================================================
   15-DOCK · FAB + drawer tipo control center
   - Abre/cierra el drawer al pulsar el FAB
   - Cierra con backdrop, ESC, botón "CERRAR" y swipe-down
   - Reutiliza los ids existentes (btnTasks, btnJarvis, ...)
     para que ningún archivo JS anterior deba modificarse
============================================================ */
'use strict';

(function(){
  const fab      = document.getElementById('dockFab');
  const backdrop = document.getElementById('dockBackdrop');
  const drawer   = document.getElementById('dockDrawer');
  const closeBtn = document.getElementById('dockClose');
  if (!fab || !drawer) return;

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

  // Al pulsar cualquier item, cerrar el drawer tras un instante
  // (para que el handler del item abra su modal/sheet encima)
  drawer.querySelectorAll('.dock-item').forEach(item => {
    item.addEventListener('click', () => {
      setTimeout(cerrar, 90);
    });
  });

  // Cerrar con ESC
  document.addEventListener('keydown', (e)=>{
    if (e.key === 'Escape' && open) cerrar();
  });

  // Swipe down para cerrar
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

  // Exponer API (por si otro módulo quiere abrirlo)
  window.Dock = {
    abrir, cerrar, toggle,
    isOpen(){ return open; }
  };

  console.log('✓ Dock control-center cargado (FAB + drawer)');
})();
