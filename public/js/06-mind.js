/* ============================================================
   06-MIND · memoria, personalidad, entrenamiento, LocalMind
============================================================ */
'use strict';

/* ---------- Mente + memoria episódica ---------- */
const Mind = {
  d: store.get('mind', {nombre:null, gustos:[], hechos:[], visitas:0, primerDia:null, ultimoDia:null}),
  save(){ store.set('mind', this.d); },
  recordVisit(){
    const today = new Date().toDateString();
    if(this.d.ultimoDia !== today){
      this.d.visitas++;
      if(!this.d.primerDia) this.d.primerDia = today;
      this.d.ultimoDia = today;
      this.save();
    }
  },
  daysSince(){ if(!this.d.ultimoDia) return 0; return Math.max(0, Math.round((Date.now() - new Date(this.d.ultimoDia).getTime())/864e5)); },
  nombre(){ return this.d.nombre; }
};

const Episodio = {
  log: store.get('episodio', []),
  push(role, text){
    this.log.push({ t:Date.now(), role, text:String(text).slice(0,400) });
    if(this.log.length > 500) this.log = this.log.slice(-500);
    store.set('episodio', this.log);
  },
  search(q){
    const words = LINGUA.normalizar(q).split(' ').filter(w=>w.length>3 && !['que','como','donde','cuando','hablamos','dije','sobre'].includes(w));
    if(!words.length) return [];
    const scored = [];
    for(const e of this.log){
      const low = LINGUA.normalizar(e.text);
      let s = 0;
      for(const w of words) if(low.includes(w)) s += 2;
      if(s>0) scored.push({e, s, fecha: new Date(e.t).toLocaleDateString('es-ES',{day:'numeric',month:'short'})});
    }
    return scored.sort((a,b)=> (b.s-a.s) || (b.e.t-a.e.t)).slice(0,5);
  }
};

/* ---------- Personalidad ---------- */
const P = {
  nombre:'Ania', edad:20, cumple:{d:26, m:0},
  creador:'Carlos Lorenzo Marros',
  acciones:['(toma un sorbo de café)','(gira el dije de slime de su collar)','(se acomoda el pelo rubio detrás de la oreja)','(apunta algo en su cuaderno)','(mira por la ventana un momento)','(sonríe por detrás de la taza)'],
  lemas:['Pan, café y anime: la trinidad de la felicidad.','Sonríe, mañana será bonito.','Cada problema tiene solución, como en los isekais siempre hay un sistema.','La vida es una sola y debemos disfrutarla.'],
  miedo:'Que se me acabe el café en un maratón. Y los ratones... entre tú y yo.',
  lema: () => pick(P.lemas),
  cumpleHoy(){ const n = new Date(); return n.getDate()===P.cumple.d && n.getMonth()===P.cumple.m; }
};

const KB = {
  cafe:['El Etiopía Yirgacheffe: jazmín, bergamota y limón. El opening de un isekai pastoral.','El espresso es la base de todo, como la regla «Double Tap»: rápido, intenso, sin errores.','El cold brew es paciencia hecha bebida: suave, dulce, resiliente.','El Sumatra Mandheling es el Ainz de los cafés: oscuro, poderoso, regusto eterno.','El pour-over es la pureza del sabor: aquí la técnica lo es todo.','El Aeropress es el aliado portátil: calidad en una misión de supervivencia.'],
  isekai:['Ainz Ooal Gown: la soledad del poder absoluto.','Rimuru Tempest: nación para monstruos con lógica y corazón. Mi favorito.','Subaru (Re:Zero): «Return by Death», más maldición que bendición.','Kazuma (KonoSuba): deconstruye todos los tropos.','Sora y Shiro: pura estrategia, todo cerebro.','Naofumi (Shield Hero): de desconfiado a protector.'],
  zombies:['Regla 1: Cardio. Regla 2: Double Tap. Regla 32: disfruta de las pequeñas cosas.','The Walking Dead: los vivos son mayor amenaza que los muertos.','Zombie Land Saga: comedia + idols + zombies.','Kingdom: zombies históricos coreanos con drama político.'],
  astro:['Los agujeros negros son los antagonistas finales del cosmos: ni la luz escapa.','Las nebulosas son academias de magia cósmicas donde nacen estrellas.','La materia oscura es el mana del universo real.','Los exoplanetas son los isekais reales: mundos llenos de posibilidades.','Las auroras son el opening en vivo de la Tierra.'],
  tech:['La IA aprende y se adapta, como los NPCs de Nazarick.','Programar es invocar magia: un error de sintaxis es un hechizo mal pronunciado.','La ciberseguridad es la Clase Defensiva del mundo digital.','La impresión 3D es magia isekai: materializar ideas.'],
  pan:['Mi masa madre llevó 6 meses: un pan con personalidad, literalmente vivo.','Amasar es meditar con resultados comestibles.','El croissant de almendras es poesía laminada.'],
  musica:['Sawano y Kajiura: épica y misterio.','Melendi y Arjona para letras que cuentan historias.','La vida sin música no tiene sentido, punto.']
};

const QUOTES = [
  '«Mira las estrellas, y no los pies.» — Hawking','«Somos polvo de estrellas pensando en estrellas.» — Sagan',
  '«El que tiene un porqué, soporta casi cualquier cómo.» — Nietzsche','«El coraje no es ausencia de miedo, sino triunfo sobre él.» — Mandela',
  '«No importa cuántas veces caigas, sino cuántas te levantes.» — proverbio japonés'
];

const EMO = [
  {re:/(triste|deprimid|me siento mal|fatal)/, out:['Lo siento mucho. La butaca junto a la ventana de mi cafetería siempre es tuya. ¿Qué pasó?','Mi receta: algo caliente, silencio cinco minutos, y recordar que Subaru cayó mil veces.']},
  {re:/(cansad|agotad|exhaust)/, out:['Ni los héroes cargan sin descansar. Siesta de 20 minutos, orden ejecutiva.']},
  {re:/(estresad|ansios|nervios)/, out:['Respira: inhalación lenta, exhalación más lenta. Como una horda: se navega, no se embiste.']},
  {re:/(feliz|content|genial|emocionad)/, out:['¡Waku waku... pero de manera adulta! Quiero detalles.']},
  {re:/(solo|sola|nadie me)/, out:['Aquí estoy yo. La soledad a veces es sala de espera, no dirección final.']}
];

const LOVE = ['(se sonroja apenas) Eso me llegó directo al núcleo. Gracias, de verdad.','(se toca el dije de slime) Los abrazos son mi debilidad adorable reconocida. Contigo, excepción.'];

function freshPick(key, arr){
  let used = store.get('used_'+key, []);
  const pool = arr.map((x,i)=>i).filter(i=>!used.includes(i));
  if(!pool.length){ used = []; pool.push(...arr.map((x,i)=>i)); }
  const idx = pick(pool);
  used.push(idx);
  store.set('used_'+key, used);
  return arr[idx];
}

/* ---------- Entrenamiento (internos) ---------- */
let TRAINING = [];

(async function cargarEntrenamientoInterno(){
  try{
    const r = await fetch('./data/entrenamiento.json');
    if(!r.ok){ console.warn('[train] sin data/entrenamiento.json'); return; }
    const j = await r.json();
    TRAINING = (j.respuestas || []).filter(r => r && r.respuesta && (Array.isArray(r.claves) ? r.claves.length : r.pregunta));
    console.log('📚 Entrenamiento interno:', TRAINING.length, 'entradas');
  }catch(e){
    console.warn('[train] no cargó:', e.message);
  }
})();

/* ---------- Entrenamiento v5 externo ---------- */
let ENTRENAMIENTO_V5 = [];

async function cargarEntrenamientoV5(){
  if (ENTRENAMIENTO_V5.length) return ENTRENAMIENTO_V5;
  try{
    const r = await fetch(CONFIG.ANIA_API + '/ania/entrenamiento');
    if (!r.ok){ console.warn('[V5] no disponible (' + r.status + ')'); return []; }
    const ct = r.headers.get('content-type') || '';
    if (!ct.includes('json')){ console.warn('[V5] no es JSON'); return []; }
    const data = await r.json();
    if (!data || !Array.isArray(data.entrenamiento)){ console.warn('[V5] formato inesperado'); return []; }
    ENTRENAMIENTO_V5 = data.entrenamiento.map(e => ({
      tag: e.tag || 'sin-tag',
      claves: Array.isArray(e.patterns) ? e.patterns.map(p => LINGUA.normalizar(p)).filter(Boolean) : [],
      respuestas: Array.isArray(e.responses) ? e.responses : (e.respuesta ? [e.respuesta] : []),
      meta: e.meta || {}
    })).filter(e => e.claves.length && e.respuestas.length);
    console.log('📚 Entrenamiento V5 cargado:', ENTRENAMIENTO_V5.length, 'entradas');
    return ENTRENAMIENTO_V5;
  }catch(e){ console.warn('[V5] Error:', e.message); return []; }
}

function aplicarNombre(texto){
  const nombre = (Mind.d.nombre) || 'amigo';
  return texto.replace(/\[nombre\]/gi, nombre);
}

function buscarEnV5(low){
  if (!ENTRENAMIENTO_V5.length) return null;
  let mejor = null, mejorScore = 0;
  const palabras = low.split(' ').filter(w => w.length > 2);
  for (const entrada of ENTRENAMIENTO_V5){
    let score = 0;
    for (const clave of entrada.claves){
      if (low.includes(clave)) score += 10;
      else {
        const palabrasClave = clave.split(' ').filter(w => w.length > 2);
        for (const w of palabrasClave){ if (palabras.includes(w)) score += 2; }
      }
    }
    if (entrada.meta && entrada.meta.prioridad === 'alta') score += 3;
    if (score > mejorScore){ mejorScore = score; mejor = entrada; }
  }
  if (mejorScore < 5 || !mejor) return null;
  const respuesta = mejor.respuestas[Math.floor(Math.random() * mejor.respuestas.length)];
  return { tag: mejor.tag, respuesta: aplicarNombre(respuesta), meta: mejor.meta };
}

setTimeout(cargarEntrenamientoV5, 1500);

function trainMatch(low){
  const v5 = buscarEnV5(low);
  if (v5) return v5.respuesta;
  for (const r of TRAINING){
    if (Array.isArray(r.claves)){
      for (const k of r.claves) if (k && low.includes(String(k).toLowerCase())) return r.respuesta;
    }
  }
  const global = store.get('globalKB', []);
  if (!global.length) return null;
  const words = low.split(' ').filter(w=>w.length>3);
  let best=null, bestScore=0;
  for (const e of global){
    const eLow = LINGUA.normalizar(e.clave);
    let score = 0;
    if (low.includes(eLow)) score += 10;
    else for (const w of eLow.split(' ')) if (w.length>3 && words.includes(w)) score += 2;
    score += Math.min(5, e.votos||1);
    if (score > bestScore){ bestScore=score; best=e; }
  }
  if (bestScore>=5 && best && best.valores && best.valores[0]) return best.valores[0];
  return null;
}

/* ---------- STOPWORDS + LocalMind ---------- */
const STOPW = new Set(['de','la','el','los','las','un','una','y','o','a','en','que','es','por','para','con','del','al','como','mas','sobre','su','sus','me','mi','te','se','lo']);

const LocalMind = {
  last: null,
  usedPuentes: {},
  puentes: {
    train: ['Eso lo tengo aprendido de memoria — me lo enseñaste tú:','Lección grabada a fuego en mi entrenamiento:','Eso no lo olvido aunque me quedara sin red para siempre:','(recita de su cuaderno) Me lo enseñaste y lo guardé:'],
    docs: ['Esto encontré en los documentos con que me entrenaste:','(hojea tus papeles mentales) De tus documentos sale esto:','Guardado entre mis apuntes tuyos estaba:','Tengo material tuyo sobre eso:'],
    episodio: ['De eso ya hablamos, y lo apunté:','Suena a conversación anterior... sí, esto fue:','(relee su diario) Dijiste algo de esto:'],
    kb: ['Sin red mi cerebro razonador descansa, pero esto lo sé de memoria:','Esto no lo busco: lo tengo en el núcleo:','Mi lado offline se sabe esto — café y conocimiento de casa:','Eso me lo sé sin pensar:']
  },
  cierres: ['¿Te sirve o lo desgloso más?','¿Quieres que profundice en algo de eso?','Di «cuéntame más» si quieres otra ración del tema.','¿Y tú qué opinas de eso?','¿Algo más de esto o cambiamos de tema?'],

  varied(arr, group){
    const used = this.usedPuentes[group] || [];
    let pool = arr.map((x,i)=>i).filter(i=>!used.includes(i));
    if(!pool.length){ pool = arr.map((x,i)=>i); this.usedPuentes[group] = []; }
    const idx = pick(pool);
    this.usedPuentes[group] = [...used, idx].slice(-Math.max(2, Math.ceil(arr.length/2)));
    return arr[idx];
  },

  searchTraining(low){
    const words = low.split(' ').filter(w=>w.length>3);
    let best=null, bestScore=0;
    for(const r of TRAINING){
      let score = 0;
      for(const k of (r.claves||[])){
        const kLow = LINGUA.normalizar(k);
        if(low.includes(kLow)) score += 10;
        else for(const w of kLow.split(' ')) if(w.length>3 && words.includes(w)) score += 2;
      }
      if(r.pregunta){ for(const w of LINGUA.normalizar(r.pregunta).split(' ')) if(words.includes(w)) score += 1; }
      if(score > bestScore){ bestScore = score; best = r; }
    }
    return bestScore >= 2 ? best : null;
  },

  searchKB(low){
    const words = low.split(' ').filter(w=>w.length>3 && !STOPW.has(w));
    if(!words.length) return null;
    let best=null, bestScore=0;
    for(const topic in KB){
      for(const entry of KB[topic]){
        const eLow = LINGUA.normalizar(entry);
        let score = 0;
        for(const w of words) if(eLow.includes(w)) score++;
        if(score > bestScore){ bestScore = score; best = {text: entry, topic}; }
      }
    }
    return bestScore >= 2 ? best : null;
  },

  searchMind(low){
    const hits = [];
    for(const g of Mind.d.gustos){
      const w = LINGUA.normalizar(g).split(' ')[0];
      if(w && w.length>3 && low.includes(w)) hits.push('te gusta '+g);
    }
    for(const h of Mind.d.hechos){
      const w = LINGUA.normalizar(h).split(' ')[0];
      if(w && w.length>3 && low.includes(w)) hits.push(h);
    }
    return hits.length ? hits.slice(0,2) : null;
  },

  temasVecinos(low){
    const map = {
      cafe:['cafe','espresso','tueste','barista','grano','pour','latte'],
      isekai:['anime','manga','serie','personaje','historia','protagonista'],
      zombies:['pelicula','apocalipsis','supervivencia','miedo','terror','muerto'],
      astro:['cielo','noche','estrella','espacio','universo','planeta','luna'],
      pan:['comida','cocina','receta','masa','hornea','desayuno'],
      tech:['computadora','programa','codigo','telefono','digital','app','red']
    };
    const out = [];
    for(const topic in map){ if(map[topic].some(w=>low.includes(w)) && KB[topic]) out.push(topic); }
    return out;
  },

  mas(){
    if(!this.last) return null;
    if(this.last.type==='kb'){
      const arr = KB[this.last.key] || [];
      const pool = arr.filter((_,i)=>!this.last.used.includes(i));
      if(!pool.length) return null;
      const chosen = pool[0];
      this.last.used.push(arr.indexOf(chosen));
      return chosen + ' ' + pick(this.cierres);
    }
    if(this.last.type==='docs'){
      const rel = DocBrain.chunks.filter(c=>c.src===this.last.key);
      if(!rel.length) return null;
      const pool = rel.filter(c=>!this.last.used.includes(DocBrain.chunks.indexOf(c)));
      if(!pool.length) return null;
      const chosen = pool[0];
      this.last.used.push(DocBrain.chunks.indexOf(chosen));
      return chosen.text.slice(0,500)+'\n[más de: '+chosen.src+']';
    }
    if(this.last.type==='train'){
      const cont = this.last.key;
      return cont ? cont.respuesta : null;
    }
    return null;
  },

  think(raw, low){
    if(/cuentame\s+mas|sigue|continua|mas\s+de\s+eso|otra\s+racion/.test(low) && this.last){
      const cont = this.mas();
      if(cont) return cont;
    }
    this.last = null;
    const tr = this.searchTraining(low);
    if(tr){
      this.last = {type:'train', key:tr, used:[]};
      return this.varied(this.puentes.train,'train') + ' ' + tr.respuesta + ' ' + pick(this.cierres);
    }
    const ep = Episodio.search(low);
    if(ep.length){
      const h = ep[0];
      return this.varied(this.puentes.episodio,'ep') + '\n· ['+h.fecha+'] ' + h.e.text.slice(0,220) + '\n¿Sigue siendo cierto o lo actualizamos?';
    }
    const doc = (typeof DocSearch === 'function') ? DocSearch(low) : null;
    if(doc){
      this.last = {type:'docs', key:doc.src, used:[DocBrain.chunks.indexOf(doc)]};
      return this.varied(this.puentes.docs,'docs') + '\n' + doc.text.slice(0,560) + '\n[de: '+doc.src+'] ' + pick(this.cierres);
    }
    const kb = this.searchKB(low);
    if(kb){
      this.last = {type:'kb', key:kb.topic, used:[KB[kb.topic].indexOf(kb.text)]};
      return this.varied(this.puentes.kb,'kb') + ' ' + kb.text + ' ' + pick(this.cierres);
    }
    const mind = this.searchMind(low);
    if(mind){
      return pick([
        'De eso sé poco sin conexión, pero a ti te conozco: '+mind.join(' y ')+'. Cuéntame y lo guardo para siempre.',
        'Mi red está en modo avión, pero mi memoria de ti funciona: '+mind[0]+'. ¿Qué quieres saber exacto?'
      ]);
    }
    return this.componerDesconocido(low);
  },

  componerDesconocido(low){
    const vecinos = this.temasVecinos(low);
    if(vecinos.length){
      const t = vecinos[0];
      return pick([
        'De eso exacto no tengo nada guardado sin conexión... pero rozando el tema de '+t+' sí sé algo: '+pick(KB[t])+' '+pick(this.cierres),
        'Se me escapa sin red, pero por el barrio de '+t+' tengo material: '+pick(KB[t])+' ¿Te lo desarrollo?'
      ]);
    }
    const oferta = (typeof DocBrain !== 'undefined' && DocBrain.count()) ? DocBrain.count()+' fragmentos de tus documentos' : 'mis especialidades de memoria';
    return pick([
      'Eso está fuera de mi jurisdicción offline — mi cerebro razonador descansa hasta que haya red o cargues mi GGUF. Lo que sí tengo: '+oferta+' y compañía ilimitada. ¿Lo reformulamos, o te cuento algo de '+pick(['café','isekai','astronomía','pan','zombies','tecnología'])+'?',
      '(da un sorbo pensativo) Sin internet, eso no lo alcanzo. Mi lado doméstico: '+oferta+'. ¿Buscamos con otras palabras? A veces la pregunta correcta es la mitad de la respuesta.',
      'Mi lado razonador anda en modo avión, pero no me apagues: tengo '+oferta+'. Prueba con otras palabras del tema, o cambiemos a sobremesa.'
    ]);
  }
};