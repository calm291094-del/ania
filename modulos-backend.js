// modulos-backend.js · ANIA · endpoints de negocio
// Finanzas · Inventario · Compras · Dashboard
// Se monta desde servidor.js con:
//   require('./modulos-backend')(app, { auth, leer, escribir, loadUsers });
const crypto = require('crypto');

module.exports = function montarModulos(app, deps){
  const { auth, leer, escribir } = deps;

  /* ============================================================
     HELPERS
  ============================================================ */
  function num(n){
    const v = typeof n === 'number' ? n : parseFloat(String(n).replace(',', '.'));
    if (!isFinite(v)) return null;
    return Math.round(v * 1000) / 1000;
  }
  function money(n){
    const v = num(n);
    return v === null ? null : Math.round(v * 100) / 100;
  }
  function pct(a, b){ return b ? Math.round((a / b) * 10000) / 100 : 0; }

  /* ============================================================
     FINANZAS
  ============================================================ */
  const TIPOS_FIN = ['ingreso', 'gasto'];

  app.get('/ania/finanzas/movimientos', auth, async (req, res) => {
    try{
      const lista = await leer('finanzas/' + req.user.id + '.json') || [];
      const desde = req.query.desde ? +req.query.desde : 0;
      const hasta = req.query.hasta ? +req.query.hasta : Date.now();
      const tipo  = req.query.tipo;
      const cat   = req.query.categoria;
      let out = lista.filter(m => m.fecha >= desde && m.fecha <= hasta);
      if (tipo) out = out.filter(m => m.tipo === tipo);
      if (cat)  out = out.filter(m => m.categoria === cat);
      out.sort((a,b) => b.fecha - a.fecha);
      res.json({ ok:true, total: out.length, movimientos: out.slice(0, 500) });
    }catch(e){ res.status(500).json({ error:'error al leer finanzas' }); }
  });

  app.post('/ania/finanzas/movimiento', auth, async (req, res) => {
    try{
      const { tipo, monto, categoria, nota } = req.body || {};
      if (!TIPOS_FIN.includes(tipo))
        return res.status(400).json({ error:'tipo inválido (ingreso|gasto)' });
      const m = money(monto);
      if (m === null || m <= 0)
        return res.status(400).json({ error:'monto inválido' });
      const mov = {
        id: crypto.randomUUID(),
        tipo, monto: m,
        categoria: String(categoria || 'general').trim().slice(0, 40),
        nota: String(nota || '').trim().slice(0, 200),
        fecha: Date.now(),
        usuario: req.user.usuario
      };
      const lista = await leer('finanzas/' + req.user.id + '.json') || [];
      lista.push(mov);
      if (lista.length > 5000) lista.splice(0, lista.length - 5000);
      await escribir('finanzas/' + req.user.id + '.json', lista);
      res.json({ ok:true, movimiento: mov, total: lista.length });
    }catch(e){ res.status(500).json({ error:'error al guardar' }); }
  });

  app.delete('/ania/finanzas/movimiento/:id', auth, async (req, res) => {
    try{
      const lista = await leer('finanzas/' + req.user.id + '.json') || [];
      const antes = lista.length;
      const out = lista.filter(m => m.id !== req.params.id);
      if (out.length === antes) return res.status(404).json({ error:'no existe' });
      await escribir('finanzas/' + req.user.id + '.json', out);
      res.json({ ok:true, eliminados: antes - out.length });
    }catch(e){ res.status(500).json({ error:'error al eliminar' }); }
  });

  app.get('/ania/finanzas/resumen', auth, async (req, res) => {
    try{
      const desde = req.query.desde ? +req.query.desde : 0;
      const hasta = req.query.hasta ? +req.query.hasta : Date.now();
      const lista = await leer('finanzas/' + req.user.id + '.json') || [];
      const periodo = lista.filter(m => m.fecha >= desde && m.fecha <= hasta);
      const ingresos = periodo.filter(m => m.tipo === 'ingreso').reduce((a,m) => a + m.monto, 0);
      const gastos   = periodo.filter(m => m.tipo === 'gasto').reduce((a,m) => a + m.monto, 0);
      const porCategoria = {};
      periodo.filter(m => m.tipo === 'gasto').forEach(m => {
        porCategoria[m.categoria] = (porCategoria[m.categoria] || 0) + m.monto;
      });
      const serieDiaria = {};
      periodo.forEach(m => {
        const d = new Date(m.fecha).toISOString().slice(0, 10);
        serieDiaria[d] = serieDiaria[d] || { ingreso: 0, gasto: 0 };
        serieDiaria[d][m.tipo] += m.monto;
      });
      const totalIngresos = Object.values(serieDiaria).reduce((a,d) => a + d.ingreso, 0);
      const totalGastos   = Object.values(serieDiaria).reduce((a,d) => a + d.gasto, 0);
      res.json({
        ok:true, desde, hasta,
        ingresos: Math.round(ingresos * 100) / 100,
        gastos: Math.round(gastos * 100) / 100,
        balance: Math.round((ingresos - gastos) * 100) / 100,
        porCategoria, serieDiaria,
        movimientos: periodo.length,
        margen: pct(ingresos - gastos, ingresos)
      });
    }catch(e){ res.status(500).json({ error:'error al calcular resumen' }); }
  });

  /* ============================================================
     INVENTARIO
  ============================================================ */
  app.get('/ania/inventario/productos', auth, async (req, res) => {
    try{
      const lista = await leer('inventario/' + req.user.id + '.json') || [];
      const q = (req.query.q || '').toLowerCase().trim();
      const filtrados = q
        ? lista.filter(p =>
            p.nombre.toLowerCase().includes(q) ||
            (p.sku||'').toLowerCase().includes(q) ||
            (p.categoria||'').toLowerCase().includes(q))
        : lista;
      res.json({ ok:true, total: filtrados.length, productos: filtrados });
    }catch(e){ res.status(500).json({ error:'error al leer inventario' }); }
  });

  app.post('/ania/inventario/producto', auth, async (req, res) => {
    try{
      const { nombre, sku, precio, costo, cantidad, minimo, unidad, categoria } = req.body || {};
      if (!nombre || String(nombre).trim().length < 2)
        return res.status(400).json({ error:'nombre inválido' });
      const lista = await leer('inventario/' + req.user.id + '.json') || [];
      const nuevo = {
        id: crypto.randomUUID(),
        nombre: String(nombre).trim().slice(0, 80),
        sku: String(sku || '').trim().slice(0, 40),
        precio: num(precio) || 0,
        costo: num(costo) || 0,
        cantidad: num(cantidad) || 0,
        minimo: num(minimo) || 0,
        unidad: String(unidad || 'u').slice(0, 10),
        categoria: String(categoria || 'general').slice(0, 40),
        creado: Date.now(),
        actualizado: Date.now()
      };
      lista.push(nuevo);
      await escribir('inventario/' + req.user.id + '.json', lista);
      res.json({ ok:true, producto: nuevo });
    }catch(e){ res.status(500).json({ error:'error al crear producto' }); }
  });

  app.put('/ania/inventario/producto/:id', auth, async (req, res) => {
    try{
      const lista = await leer('inventario/' + req.user.id + '.json') || [];
      const idx = lista.findIndex(p => p.id === req.params.id);
      if (idx < 0) return res.status(404).json({ error:'no existe' });
      const NUM_FIELDS = ['precio','costo','cantidad','minimo'];
      const STR_FIELDS = ['nombre','sku','unidad','categoria'];
      const cambios = req.body || {};
      for(const k of NUM_FIELDS){
        if (cambios[k] !== undefined){
          const v = num(cambios[k]);
          if (v !== null) lista[idx][k] = v;
        }
      }
      for(const k of STR_FIELDS){
        if (cambios[k] !== undefined)
          lista[idx][k] = String(cambios[k]).slice(0, 80);
      }
      lista[idx].actualizado = Date.now();
      await escribir('inventario/' + req.user.id + '.json', lista);
      res.json({ ok:true, producto: lista[idx] });
    }catch(e){ res.status(500).json({ error:'error al actualizar' }); }
  });

  app.delete('/ania/inventario/producto/:id', auth, async (req, res) => {
    try{
      const lista = await leer('inventario/' + req.user.id + '.json') || [];
      const out = lista.filter(p => p.id !== req.params.id);
      if (out.length === lista.length) return res.status(404).json({ error:'no existe' });
      await escribir('inventario/' + req.user.id + '.json', out);
      res.json({ ok:true });
    }catch(e){ res.status(500).json({ error:'error al eliminar' }); }
  });

  app.post('/ania/inventario/movimiento', auth, async (req, res) => {
    try{
      const { productoId, tipo, cantidad, nota, precio } = req.body || {};
      if (!['entrada','salida','ajuste'].includes(tipo))
        return res.status(400).json({ error:'tipo inválido (entrada|salida|ajuste)' });
      const c = num(cantidad);
      if (c === null || c < 0)
        return res.status(400).json({ error:'cantidad inválida' });
      const lista = await leer('inventario/' + req.user.id + '.json') || [];
      const prod = lista.find(p => p.id === productoId);
      if (!prod) return res.status(404).json({ error:'producto no existe' });
      const antes = prod.cantidad || 0;
      if (tipo === 'entrada') prod.cantidad = antes + c;
      else if (tipo === 'salida'){
        if (antes < c) return res.status(400).json({ error:'stock insuficiente', disponible: antes });
        prod.cantidad = antes - c;
      } else {
        prod.cantidad = c;
      }
      prod.actualizado = Date.now();

      // Si es una venta (salida con precio), registra también el ingreso en finanzas
      if (tipo === 'salida' && precio && prod.precio){
        const finanzas = await leer('finanzas/' + req.user.id + '.json') || [];
        finanzas.push({
          id: crypto.randomUUID(),
          tipo: 'ingreso',
          monto: Math.round(prod.precio * c * 100) / 100,
          categoria: 'ventas',
          nota: 'Venta: ' + prod.nombre + ' x' + c,
          fecha: Date.now(),
          usuario: req.user.usuario
        });
        await escribir('finanzas/' + req.user.id + '.json', finanzas);
      }

      const hist = await leer('inventario/' + req.user.id + '.movimientos.json') || [];
      hist.push({
        id: crypto.randomUUID(),
        productoId, nombre: prod.nombre,
        tipo, cantidad: c,
        antes, despues: prod.cantidad,
        nota: String(nota || '').slice(0, 200),
        fecha: Date.now()
      });
      if (hist.length > 2000) hist.splice(0, hist.length - 2000);
      await escribir('inventario/' + req.user.id + '.json', lista);
      await escribir('inventario/' + req.user.id + '.movimientos.json', hist);
      res.json({ ok:true, producto: prod, antes, despues: prod.cantidad });
    }catch(e){ res.status(500).json({ error:'error al mover stock' }); }
  });

  app.get('/ania/inventario/bajo-stock', auth, async (req, res) => {
    try{
      const lista = await leer('inventario/' + req.user.id + '.json') || [];
      const criticos = lista
        .filter(p => (p.minimo||0) > 0 && (p.cantidad||0) <= (p.minimo||0))
        .sort((a,b) => (a.cantidad - a.minimo) - (b.cantidad - b.minimo));
      res.json({ ok:true, total: criticos.length, productos: criticos });
    }catch(e){ res.status(500).json({ error:'error' }); }
  });

  app.get('/ania/inventario/resumen', auth, async (req, res) => {
    try{
      const lista = await leer('inventario/' + req.user.id + '.json') || [];
      const totalProductos = lista.length;
      const unidades = lista.reduce((a,p) => a + (p.cantidad||0), 0);
      const valorCosto = lista.reduce((a,p) => a + (p.costo||0)*(p.cantidad||0), 0);
      const valorVenta = lista.reduce((a,p) => a + (p.precio||0)*(p.cantidad||0), 0);
      const criticos = lista.filter(p => (p.minimo||0) > 0 && (p.cantidad||0) <= (p.minimo||0)).length;
      res.json({
        ok:true,
        totalProductos,
        unidades,
        criticos,
        valorCosto: Math.round(valorCosto * 100) / 100,
        valorVenta: Math.round(valorVenta * 100) / 100,
        margenPotencial: Math.round((valorVenta - valorCosto) * 100) / 100,
        margenPct: pct(valorVenta - valorCosto, valorVenta)
      });
    }catch(e){ res.status(500).json({ error:'error' }); }
  });

  app.get('/ania/inventario/movimientos', auth, async (req, res) => {
    try{
      const hist = await leer('inventario/' + req.user.id + '.movimientos.json') || [];
      res.json({ ok:true, total: hist.length, movimientos: hist.slice(-200).reverse() });
    }catch(e){ res.status(500).json({ error:'error' }); }
  });

  /* ============================================================
     COMPRAS
  ============================================================ */
  app.get('/ania/compras/listas', auth, async (req, res) => {
    try{
      const listas = await leer('compras/' + req.user.id + '.json') || [];
      res.json({ ok:true, total: listas.length, listas });
    }catch(e){ res.status(500).json({ error:'error' }); }
  });

  app.post('/ania/compras/lista', auth, async (req, res) => {
    try{
      const { nombre } = req.body || {};
      if (!nombre || String(nombre).trim().length < 2)
        return res.status(400).json({ error:'nombre inválido' });
      const listas = await leer('compras/' + req.user.id + '.json') || [];
      const nueva = {
        id: crypto.randomUUID(),
        nombre: String(nombre).trim().slice(0, 60),
        items: [], creada: Date.now(), actualizada: Date.now()
      };
      listas.push(nueva);
      await escribir('compras/' + req.user.id + '.json', listas);
      res.json({ ok:true, lista: nueva });
    }catch(e){ res.status(500).json({ error:'error al crear lista' }); }
  });

  app.delete('/ania/compras/lista/:id', auth, async (req, res) => {
    try{
      const listas = await leer('compras/' + req.user.id + '.json') || [];
      const out = listas.filter(l => l.id !== req.params.id);
      await escribir('compras/' + req.user.id + '.json', out);
      res.json({ ok:true });
    }catch(e){ res.status(500).json({ error:'error' }); }
  });

  app.post('/ania/compras/lista/:id/item', auth, async (req, res) => {
    try{
      const { texto, cantidad, unidad, categoria } = req.body || {};
      if (!texto || String(texto).trim().length < 1)
        return res.status(400).json({ error:'texto requerido' });
      const listas = await leer('compras/' + req.user.id + '.json') || [];
      const lista = listas.find(l => l.id === req.params.id);
      if (!lista) return res.status(404).json({ error:'lista no existe' });
      const item = {
        id: crypto.randomUUID(),
        texto: String(texto).trim().slice(0, 80),
        cantidad: num(cantidad) || 1,
        unidad: String(unidad || 'u').slice(0, 10),
        categoria: String(categoria || 'general').slice(0, 40),
        comprado: false, t: Date.now()
      };
      lista.items.push(item);
      lista.actualizada = Date.now();
      await escribir('compras/' + req.user.id + '.json', listas);
      res.json({ ok:true, item });
    }catch(e){ res.status(500).json({ error:'error al agregar item' }); }
  });

  app.put('/ania/compras/lista/:id/item/:itemId', auth, async (req, res) => {
    try{
      const listas = await leer('compras/' + req.user.id + '.json') || [];
      const lista = listas.find(l => l.id === req.params.id);
      if (!lista) return res.status(404).json({ error:'lista no existe' });
      const item = lista.items.find(i => i.id === req.params.itemId);
      if (!item) return res.status(404).json({ error:'item no existe' });
      if (req.body.comprado !== undefined) item.comprado = !!req.body.comprado;
      if (req.body.texto !== undefined) item.texto = String(req.body.texto).slice(0, 80);
      lista.actualizada = Date.now();
      await escribir('compras/' + req.user.id + '.json', listas);
      res.json({ ok:true, item });
    }catch(e){ res.status(500).json({ error:'error al actualizar item' }); }
  });

  app.delete('/ania/compras/lista/:id/item/:itemId', auth, async (req, res) => {
    try{
      const listas = await leer('compras/' + req.user.id + '.json') || [];
      const lista = listas.find(l => l.id === req.params.id);
      if (!lista) return res.status(404).json({ error:'lista no existe' });
      lista.items = lista.items.filter(i => i.id !== req.params.itemId);
      lista.actualizada = Date.now();
      await escribir('compras/' + req.user.id + '.json', listas);
      res.json({ ok:true });
    }catch(e){ res.status(500).json({ error:'error al eliminar item' }); }
  });

  /* ============================================================
     DASHBOARD · todo lo que necesita la pantalla Jarvis
  ============================================================ */
app.get('/ania/dashboard', auth, async (req, res) => {
    try{
      const uid = req.user?.id;
      if (!uid) return res.status(401).json({ ok:false, error:'sin usuario en token' });

      console.log('[DASHBOARD] uid:', uid);

      const safeArray = async (rel) => {
        try{
          const v = await leer(rel);
          if (Array.isArray(v)) return v;
          if (v && typeof v === 'object') return [];   // por si acaso es objeto
          return [];
        }catch(err){
          console.warn('[DASHBOARD] leer() falló en', rel, '→', err.message);
          return [];
        }
      };

      const [finanzas, inv, listas] = await Promise.all([
        safeArray('finanzas/' + uid + '.json'),
        safeArray('inventario/' + uid + '.json'),
        safeArray('compras/' + uid + '.json')
      ]);

      const ahora = new Date();
      const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).getTime();
      const mes = finanzas.filter(m => m && m.fecha >= inicioMes);
      const ingresos = mes.filter(m => m.tipo === 'ingreso').reduce((a,m) => a + (Number(m.monto)||0), 0);
      const gastos   = mes.filter(m => m.tipo === 'gasto').reduce((a,m) => a + (Number(m.monto)||0), 0);

      const criticos = inv
        .filter(p => p && (p.minimo||0) > 0 && (p.cantidad||0) <= (p.minimo||0))
        .sort((a,b) => (a.cantidad - a.minimo) - (b.cantidad - b.minimo))
        .slice(0, 8);

      const listasPendientes = listas.map(l => ({
        id: l.id || null,
        nombre: l.nombre || '(sin nombre)',
        pendientes: (l.items||[]).filter(i => !i.comprado).length,
        total: (l.items||[]).length
      }));

      const payload = {
        ok:true,
        balanceMes: {
          ingresos: Math.round(ingresos*100)/100,
          gastos: Math.round(gastos*100)/100,
          balance: Math.round((ingresos-gastos)*100)/100
        },
        stockCritico: criticos.map(p => ({
          id: p.id, nombre: p.nombre,
          cantidad: p.cantidad, minimo: p.minimo, unidad: p.unidad
        })),
        listas: listasPendientes
      };

      console.log('[DASHBOARD] OK · finanzas:', finanzas.length, 'inv:', inv.length, 'listas:', listas.length);
      res.json(payload);

    }catch(e){
      console.error('[DASHBOARD] ✖ ERROR:', e.message);
      console.error(e.stack);
      res.status(500).json({
        ok:false,
        error: 'error al cargar dashboard',
        debug: e.message,
        stack: (e.stack||'').split('\n').slice(0,5).join(' | ')
      });
    }
  });

  console.log('✓ Módulos backend ANIA montados (finanzas · inventario · compras · dashboard)');
};
