/* ============================================================
   12-RESPOND · el gran cerebro: respond() + send() + comandos de voz
   v2 · Cerebro H5 movido ANTES de búsquedas externas
============================================================ */
'use strict';

let lastKB = null;

async function respond(raw){
  const t = raw.trim();
  const low = entender(raw);
  bumpStat('msgs');
  S.lastUserTs = Date.now();

  if(S.awaitingCity){
    if(/cancela|olvida|nada/.test(low)){ S.awaitingCity=false; return personaReply('Clima cancelado.'); }
    if(low.split(/\s+/).length <= 4){ S.awaitingCity=false; return weatherForCity(raw.trim()); }
    S.awaitingCity = false;
  }

  /* ---- Akinator ---- */
  if(AK.active){
    if(/cancela|termina|basta/.test(low)){ AK.active=false; return personaReply('Cerrado.'); }
    if(AK.await){
      if(/^si\b|^claro/.test(low)){ AK.active=false; AK.await=false; return personaReply('¡'+AK.guess.n+'! ¿Te lo dije?'); }
      if(/^no\b|^nel/.test(low)){ AK.active=false; AK.await=false; return personaReply('¿Cómo? Revancha.'); }
      return personaReply('Sí o no.');
    }
    if(/^si\b|^claro/.test(low)) return akAnswer(1);
    if(/^no\b|^nel/.test(low)) return akAnswer(0);
    return akAnswer(0.5);
  }

  /* ---- Trivia ---- */
  if (Trivia.active){
    if(/cancela|termina|basta/.test(low)){ Trivia.active=false; return personaReply('Cerrado.'); }
    if (Trivia.answer(raw)) return;
  }

  let m;

  /* ---- continuación: cuéntame más ---- */
  if(/cuentame\s+mas|que\s+mas|sigue\b|continua/.test(low)){
    if(isOffline() && !Brain.localReady && LocalMind.last){
      const cont = LocalMind.mas();
      if(cont) return personaReply(cont);
    }
    if(lastKB) return personaReply(pick(lastKB) + ' ¿Sigo?');
  }

  /* ---- oído / HUD / sesión ---- */
  if(/oido\s+local|activa\s+whisper/.test(low)){
    Ears.on ? Ears.stop() : await Ears.start();
    return personaReply(Ears.on ? 'Oído local activo: te escucho 100% en tu dispositivo.' : 'Oído apagado.');
  }
  if(/abre\s+(?:el\s+)?hud|modo\s+hud|gestos/.test(low)){ HUD.open(); return personaReply('HUD abierto. Puño=pausa, palma=silencio, victoria=siguiente.'); }
  if(/cierra\s+(?:el\s+)?hud/.test(low)){ HUD.close(); return personaReply('HUD cerrado.'); }
  m = low.match(/conecta\s+(?:la\s+)?sesion(?:\s+(?:en\s+)?(ws?:\/\/\S+))?/);
  if(m){ Relay.connect(m[1]); return personaReply('Abriendo sesión multidevice.'); }
  if(/cierra\s+(?:la\s+)?sesion/.test(low)){ Relay.disconnect(); return personaReply('Sesión cerrada.'); }

  /* ---- GitHub ---- */
  m = low.match(/conecta\s+github(?:\s+(?:con\s+)?(?:token|clave)\s+(\w+))?/);
  if(m){
    if(!m[1]) return personaReply('Dime: «conecta github con token [tu-token]». Crear en github.com/settings/tokens → scope: repo.');
    const r = await GitHub.connect(m[1]);
    return personaReply(r.ok ? 'GitHub conectado. Todo lo que aprenda se guarda en tu repo.' : r.error);
  }
  if(/sincroniza\s+github/.test(low)){
    if(!GitHub.token) return personaReply('Primero: «conecta github con token [...]»');
    await GitHub.pull(); await GitHub.push();
    return personaReply('Sincronizado.');
  }
  m = low.match(/aprende\s+que\s+(.+)|aprende\s+(.+)/);
  if(m){
    const fact = (m[1]||m[2]||'').trim();
    if(fact.length<3) return personaReply('¿Qué quieres que aprenda?');
    Learned.add(fact,'manual');
    return personaReply('Aprendido: «'+fact+'». Guardado'+(GitHub.token?' en memoria Y en GitHub.':' en memoria local.'));
  }
  if(/que\s+has\s+aprendido/.test(low)){
    return personaReply(Learned.count() ? Learned.count()+' cosas:\n'+Learned.list.slice(-5).map(l=>'· '+l.texto).join('\n') : 'Aún nada. «aprende que [...]»');
  }

  /* ---- cerebro (GGUF) ---- */
  if(/carga\s+(?:el\s+)?cerebro|cargar\s+gguf/.test(low)){ await Brain.loadLocal(true); return; }
  if(/pi[eé]nsalo|usa\s+(?:el\s+)?cerebro|opina/.test(low)){
    setPhase('thinking');
    const r = await Brain.think(raw);
    return personaReply(r || LocalMind.think(raw, low));
  }
  if(/mira\s+(?:esta\s+)?(?:foto|imagen)/.test(low)){ $('imgFile').click(); return personaReply('Elige la foto.'); }

  /* ---- música / ambiente ---- */
  if(/ponme\s+musica|pon\s+musica/.test(low)){ Music.start(); return personaReply('Lo-fi procedural en vivo.', 'Poniendo música.'); }
  if(/pon\s+(?:la\s+)?lluvia/.test(low)){ Ambient.start('lluvia'); return personaReply('Lluvia generada gota a gota.', 'Poniendo la lluvia.'); }
  if(/pon\s+(?:la\s+)?cafeter/.test(low)){ Ambient.start('cafeteria'); return personaReply('Cafetería encendida.', 'Ambiente de cafetería.'); }
  if(/para\s+(?:la\s+)?(?:musica|lluvia|cafeteria|ambiente)/.test(low)){ Ambient.stop(); Music.stop(); return personaReply('Detenido.'); }
  m = low.match(/(?:pon|reproduce)\s+(.+?)\s+en\s+youtube/);
  if(m){ window.open('https://music.youtube.com/search?q='+encodeURIComponent(m[1]), '_blank'); return personaReply('Abriendo YouTube Music.'); }

  /* ---- memoria episódica ---- */
  m = low.match(/que\s+hablamos\s+(?:de|sobre)\s+(.+)|que\s+te\s+dije\s+(?:de|sobre)\s+(.+)/);
  if(m){
    const q = m[1]||m[2];
    const hits = Episodio.search(q);
    if(hits.length){
      let s = 'Esto recuerdo:\n';
      hits.forEach(h=>{ s += '· ['+h.fecha+'] '+h.e.text.slice(0,160)+'\n'; });
      return personaReply(s.trim());
    }
    return personaReply('No encuentro «'+q+'» en mi memoria episódica.');
  }

  /* ---- memoria del usuario ---- */
  m = t.match(/\b(?:me\s+llamo|soy)\s+([A-Za-zÁÉÍÓÚÑÜáéíóúñü][a-záéíóúñü]{1,19})\b/i);
  if(m && !/^soy\s+(triste|feliz|cansad)/i.test(m[0])){
    const word = m[1];
    if(!/^soy\b/i.test(m[0]) || /^[A-ZÁÉÍÓÚÑÜ]/.test(word)){
      Mind.d.nombre = word[0].toUpperCase()+word.slice(1);
      Mind.save(); setOperator();
      return personaReply('Encantada, '+Mind.d.nombre+'.');
    }
  }
  m = low.match(/me\s+gusta[n]?\s+(?:el\s+|la\s+)?(.{2,60})/);
  if(m){
    Mind.d.gustos.push(m[1].replace(/[.?¡!]/g,'').trim()); Mind.save();
    return personaReply('Anotado: te gusta '+m[1].trim()+'.');
  }
  if(/que\s+sabes\s+de\s+mi|mi\s+memoria/.test(low)){
    openMem();
    return personaReply(Episodio.log.length+' líneas, '+Mind.d.gustos.length+' gustos.');
  }
  if(/olvida\s+(?:todo|mi\s+memoria)/.test(low)){
    if(!S.confirmWipe){ S.confirmWipe=true; return personaReply('¿Seguro? Otra vez.'); }
    S.confirmWipe=false;
    Mind.d = {nombre:null, gustos:[], hechos:[], visitas:0, primerDia:null, ultimoDia:null};
    Episodio.log = []; store.set('episodio', []);
    Mind.save(); setOperator();
    return personaReply('Mente limpia. ¿Quién eres?');
  }

  /* ---- tareas ---- */
  if(/(recordame|recuerda|anota|apunta|agenda|tarea:|recordatorio)/.test(low) && !/tareas?$|pendiente/.test(low)){
    const p = parseTask(t);
    const recur = parseRecur(low);
    if(recur && !p.when){ const d = new Date(); d.setHours(9,0,0,0); if(d <= Date.now()) d.setDate(d.getDate()+1); p.when = d.getTime(); }
    addTask(p.text, p.when, {recur});
    if(p.when) return personaReply('Anotado: «'+p.text+'». Te lo recuerdo '+fmtWhen(p.when).replace('· ','')+'.', 'Anotado: '+p.text+'.');
    return personaReply('Anotado: «'+p.text+'», sin hora.');
  }
  if(/mis tareas|que\s+tengo\s+pendiente/.test(low)){
    openSheet();
    const pend = tasks.filter(tk=>!tk.done);
    if(!pend.length) return personaReply('Agenda vacía.');
    let s = 'Tienes '+pend.length+':\n';
    pend.slice(0,8).forEach((tk,i)=>{ s += (i+1)+'. '+tk.text+'\n'; });
    return personaReply(s.trim());
  }
  m = low.match(/(?:tarea|recordatorio)\s+(?:hecha|completada)/);
  if(m){
    const tk = tasks.find(x=>!x.done);
    if(tk){ tk.done=true; cancelTimer(tk.id); Sync.markDone(tk); saveTasks(); renderTasks(); return personaReply('«'+tk.text+'» completada.'); }
    return personaReply('Sin pendientes.');
  }
  m = low.match(/pospon(?:la|lo)?\s*(?:en\s+)?(\d+)\s*(segundos?|minutos?|horas?)/);
  if(m){
    const tk = [...tasks].reverse().find(x=>x.fired && !x.done);
    if(tk){
      const n = +m[1];
      const ms = /^seg/.test(m[2]) ? n*1e3 : (/^min/.test(m[2]) ? n*6e4 : n*36e5);
      tk.when = Date.now()+ms; tk.fired=false;
      saveTasks(); renderTasks(); scheduleTask(tk);
      return personaReply('«'+tk.text+'» pospuesta '+n+' '+m[2]+'.');
    }
    return personaReply('Nada que posponer.');
  }
  m = low.match(/(?:temporizador|timer)\s*(?:de|en)?\s*(\d+)\s*(segundos?|minutos?|horas?)/);
  if(m){
    const n = +m[1];
    const ms = /^seg/.test(m[2]) ? n*1e3 : (/^min/.test(m[2]) ? n*6e4 : n*36e5);
    wakeOn();
    timers.set('t'+Date.now(), setTimeout(()=>{
      ensureAudio(); alarmSound();
      notify('ANIA', 'Fin del temporizador');
      personaReply('Temporizador finalizado.', 'Tu temporizador ha terminado.');
    }, ms));
    return personaReply('Temporizador de '+n+' '+m[2]+'.', 'Temporizador en marcha.');
  }

  /* ---- Pomodoro ---- */
  m = low.match(/pomodoro\s+(?:de\s+)?(\d+)/);
  if(m){ Pomodoro.start(+m[1]); return personaReply('Pomodoro de '+m[1]+' min.'); }
  if(/para\s+pomodoro/.test(low)){ Pomodoro.stop(); return personaReply('Detenido.'); }

  /* ---- Trivia / imágenes / resumen ---- */
  if(/trivia/.test(low)){ Trivia.start(); return; }
  m = low.match(/dib[uú]jame\s+(.+)|genera\s+imagen\s+(?:de\s+)?(.+)|crea\s+imagen\s+(?:de\s+)?(.+)/);
  if(m){ return generateImage((m[1]||m[2]||m[3]).trim()); }
  if(/resume\s+(?:la\s+)?(?:conversaci[oó]n|chat)/.test(low)){
    showThinking();
    const lines = Episodio.log.slice(-30);
    if(lines.length<10){ hideThinking(); return personaReply('Necesito más conversación (10+ mensajes).'); }
    const summary = await Brain.think('Resume en 2-3 frases:\n'+lines.map(l=>l.role+': '+l.text).join('\n').slice(0,2000));
    hideThinking();
    return personaReply(summary || 'No pude resumir.');
  }

  /* ---- hora / secretaría ---- */
  if(/que\s+hora|hora\s+es/.test(low)){
    const d = new Date();
    return personaReply(d.toLocaleTimeString('es-ES')+' — '+d.toLocaleDateString('es-ES',{weekday:'long', day:'numeric', month:'long'})+'.', 'Son las '+d.toLocaleTimeString('es-ES',{hour:'numeric',minute:'2-digit'})+'.');
  }
  if(/prepara\s+(?:mi\s+)?dia|briefing/.test(low)){
    setPhase('thinking');
    let s = 'INFORME EJECUTIVO · '+new Date().toLocaleDateString('es-ES',{weekday:'long', day:'numeric', month:'long'})+'\n\n';
    const g = geoCache();
    if(g){ try{ const d = await getWeather(g); updateChip(g,d); s += '· Clima: '+Math.round(d.current.temperature_2m)+'°C ('+g.city+')\n'; }catch(e){} }
    const hoy = tasks.filter(t2=>!t2.done && t2.when && new Date(t2.when).toDateString()===new Date().toDateString());
    s += '· Agenda: '+(hoy.length ? hoy.length+' items' : 'libre')+'\n';
    s += '· Cerebro: '+(Brain.localReady?'local':(isOffline()?'LocalMind':'nube'))+' · Oído: '+(Ears.on?'local':'google')+'\n';
    s += '· Documentos: '+DocBrain.count()+' · Luna: '+moonInfo().phase+'\n\n';
    s += 'Frase: '+pick(QUOTES);
    return personaReply(s, 'Informe ejecutivo listo.');
  }
  m = low.match(/reunion\s+con\s+(.+?)\s+a\s+las?\s+(.+)/);
  if(m){
    const cuando = parseWhen(' a las '+m[2]+' ');
    addTask('Reunión con '+m[1].trim(), cuando);
    if(cuando) addTask('Preparar reunión', cuando - 15*60000);
    return personaReply('Reunión agendada, pre-aviso 15 min antes.');
  }

  /* ---- astro ---- */
  if(/fase\s+(?:tiene\s+)?la\s+luna|luna\s+hoy/.test(low)){
    const mi = moonInfo();
    return personaReply('La luna está '+mi.phase+', '+mi.illum+'% iluminada.', 'La luna está '+mi.phase+'.');
  }
  if(/proxima\s+lluvia\s+de\s+estrellas|meteoros/.test(low)){
    const s = nextShower();
    if(s) return personaReply('Próxima: '+s.name+' en '+s.diff+' días.');
  }

  /* ---- clima ---- */
  if(/clima|temperatura/.test(low)) return weatherIntent();
  if(/donde\s+estoy|mi\s+ubicacion/.test(low)){
    if(isOffline()){ const g = geoCache(); return personaReply(g?('Última: '+g.city):'Sin conexión.'); }
    setPhase('thinking');
    let g = geoCache();
    if(!g || Date.now()-g.t > 864e5) g = await locate();
    return personaReply(g ? ('Estás en '+g.city+'.') : 'No pude obtener tu ubicación.');
  }

  /* ---- documentos / PC ---- */
  if(/entrena(?:r)?\s+con\s+documentos/.test(low)){ $('docDir').click(); return personaReply('Elige la carpeta.'); }
  if(/mis\s+documentos/.test(low)){
    return personaReply(DocBrain.count() ? DocBrain.count()+' fragmentos de '+DocBrain.sources().length+' doc(s).' : 'Sin documentos. «entrena con mis documentos».');
  }
  if(/indexa|escanea\s+pc/.test(low)){ $('pcDir').click(); return personaReply('Dame la carpeta.'); }
  m = low.match(/busca\s+en\s+(?:la\s+)?pc\s+(.+)/);
  if(m && PC.count()){
    const hits = PC.search(m[1].trim());
    if(hits.length){
      lastPC = hits;
      let s = 'Encontrado:\n';
      hits.forEach((h,i)=>{ s += (i+1)+'. '+h.name+'\n   ↳ '+h.path+'\n'; });
      return personaReply(s);
    }
    return personaReply('Nada de «'+m[1]+'» en el índice.');
  }

  /* ---- diario / backup ---- */
  if(/muestrame\s+(?:tu\s+)?diario/.test(low)){ openDiary(); return personaReply('Mi diario.'); }
  if(/respaldame|backup/.test(low)){ backupExport(); return personaReply('Backup generado.'); }

  /* ---- agente PC ---- */
  if(/abre\s+(?:mi\s+)?(?:pc|equipo|explorador)/.test(low)){
    if(Agent.ok){
      const r = await Agent.ask({type:'openApp', app:'explorer'});
      return personaReply(r && r.ok ? 'Abriendo.' : 'No pude.');
    }
    return personaReply('Necesito el agente local.');
  }
  if(/captura|pantallazo/.test(low)){
    if(!Agent.ok) return personaReply('La captura la hace el agente local.');
    toast('Capturando...');
    const r = await Agent.ask({type:'screenshot'}, 20000);
    if(r && r.ok && r.data){
      addImageLine('data:image/png;base64,'+r.data, 'Captura');
      return personaReply('Ahí está tu pantalla.');
    }
    return personaReply('No pude capturar.');
  }
  m = low.match(/(?:sube|baja)\s+(?:el\s+)?volumen/);
  if(m){
    if(!Agent.ok) return personaReply('Volumen con agente local.');
    await Agent.ask({type:'volume', action:/sube/.test(m[0])?'up':'down', steps:5});
    return personaReply('Volumen ajustado.');
  }
  if(/apaga\s+(?:la\s+)?pc/.test(low) && Agent.ok){
    await Agent.ask({type:'power', action:'shutdown', minutes:10});
    return personaReply('Apagado en 10 min.');
  }

  /* ---- abrir sitios ---- */
  m = low.match(/(?:abre|abrir|ve\s+a)\s+(?:el\s+|la\s+)?(\w+)/);
  if(m){
    const k = m[1];
    if(/mapa/.test(k)){
      const g = geoCache();
      window.open(g ? 'https://www.google.com/maps?q='+g.lat+','+g.lon : 'https://www.google.com/maps', '_blank');
      return personaReply('Abriendo el mapa.');
    }
    if(SITES[k]){
      window.open('https://www.'+(k==='x'?'x.com':k+'.com'), '_blank');
      return personaReply('Abriendo '+SITES[k]+'.');
    }
  }

  /* ================================================================
     ⭐ CEREBRO H5 (PRIORIDAD SOBRE BÚSQUEDAS EXTERNAS) ⭐
     Se ejecuta ANTES de cualquier búsqueda en internet. Si tiene una
     entrada con score >= 30, responde con ella y no toca Wikipedia.
  ================================================================ */
  if (typeof CerebroH5 !== 'undefined' && CerebroH5.cargado) {
    const respH5 = CerebroH5.responder(raw);
    if (respH5){
      console.log('[respond] H5 catch:', raw.slice(0,50));
      return personaReply(respH5);
    }
  }

  /* ---- búsqueda (solo si el H5 no encontró nada) ---- */
  m = low.match(/(?:busca|buscame|informacion\s+(?:de|sobre))\s+(.+)/);
  if(m) return doSearch(m[1].trim());
  m = low.match(/(?:quien\s+(?:es|fue)|que\s+(?:es|fue)|hablame\s+de)\s+(.+)/);
  if(m) return doSearch(m[1].trim());

  /* ---- afecto ---- */
  if(/te\s+quiero|te\s+amo|abrazo|eres\s+genial/.test(low)) return personaReply(pick(LOVE));
  if(/gracias/.test(low)) return personaReply(pick(['De nada. Pan y café solucionan el 80%.','Un placer.']));

  /* ---- comandos con alias (/) ---- */
  const cmdAlias = normalizeCommand(raw);
  if (cmdAlias) {
    const resp = manejarComandoAlias(cmdAlias.cmd, raw);
    if (resp) return personaReply(resp);
  }

  /* ---- análisis emocional ---- */
  const analisisEmo = EMO_V2.analizar(raw);
  if (analisisEmo.emocion !== 'neutral') {
    EMO_V2.actualizarEstado(analisisEmo.emocion);
    Episodio.log.push({ t: Date.now(), role:'you', text: raw, emocion: analisisEmo.emocion, intensidad: analisisEmo.intensidad });
  }

  /* ---- entrenamiento exacto (JSON interno) ---- */
  const trained = trainMatch(low);
  if(trained) return personaReply(trained);

  /* ---- empatía ---- */
  if(/(?:estoy|me\s+siento|ando)\s+\w+/.test(low)){
    for(const e of EMO) if(e.re.test(low)) return personaReply(pick(e.out));
  }

  /* ---- preguntas sobre Ania ---- */
  if(/quien\s+eres|como\s+te\s+llamas/.test(low))
    return personaReply('Soy Ania: cerebro razonador, oído local, visión, secretaria y compañera. '+P.lema());
  if(/como\s+estas/.test(low))
    return personaReply('Bien: '+(Brain.localReady?'razonando local':(isOffline()?'conversando offline':'nube'))+', ánimo '+mood().tag+'. ¿Y tú?');

  /* ---- charla temática ---- */
  const TOPICS = [
    [/overlord|tensei|slime|re:zero|rimuru|ainz|subaru|isekai|konosuba/, KB.isekai],
    [/zombie|caminante|walking\s*dead|zombieland/, KB.zombies],
    [/cafe|espresso|barista|pour/, KB.cafe],
    [/estrella|planeta|galax|agujero\s+negro|luna|astronom/, KB.astro],
    [/inteligencia\s+artificial|\bia\b|programar|ciber/, KB.tech],
    [/pan\b|masa\s+madre|panader/, KB.pan],
    [/musica|artista|cancion/, KB.musica]
  ];
  if(/cuentame\s+algo|dime\s+algo/.test(low)) return personaReply(pick([...KB.cafe,...KB.isekai,...KB.astro,...KB.tech]));
  if(/dime\s+una\s+frase/.test(low)) return personaReply(freshPick('quotes', QUOTES));
  for(const [re, kb] of TOPICS){
    if(re.test(low)){ lastKB = kb; return personaReply(pick(kb)+' Di «cuéntame más».'); }
  }

  /* ---- NÚCLEO AUTÓNOMO · comandos de voz ---- */
  if (window.Autonomo){
    // Consultar estado
    if (/que\s+has\s+hecho|que\s+hiciste|autonomia|autonomo|estado\s+autonomo|que\s+estas\s+haciendo\s+sola/.test(low)){
      const info = Autonomo.info();
      const últimas = Autonomo.historial.slice(0, 3).map(h =>
        '· ' + new Date(h.t).toLocaleTimeString('es-ES', {hour:'2-digit',minute:'2-digit'}) +
        ' — ' + h.desc
      ).join('\n');
      const estado = info.activo ? '🟢 activo' : '⏸ pausado';
      return personaReply(
        `Núcleo autónomo ${estado}.\n` +
        `· ${info.reglasActivas}/${info.reglas} reglas activas\n` +
        `· ${info.ejecuciones} ejecuciones registradas\n` +
        `· Último ciclo: ${info.ultimoCiclo}\n\n` +
        (últimas ? 'Últimas acciones:\n' + últimas : 'Sin acciones registradas todavía.')
      );
    }

    // Activar / desactivar
    if (/desactiva\s+(?:la\s+)?autonomia|para\s+(?:el\s+)?autonomo|pausa\s+autonomia/.test(low)){
      Autonomo.desactivar();
      return personaReply('Núcleo autónomo pausado. Sigo disponible por chat.');
    }
    if (/activa\s+(?:la\s+)?autonomia|reactiva\s+(?:el\s+)?autonomo|reanuda\s+autonomia/.test(low)){
      Autonomo.reactivar();
      return personaReply('Núcleo autónomo reactivado. Vuelvo a trabajar en segundo plano.');
    }

    // Forzar tick manual
    if (/ejecuta\s+(?:las\s+)?reglas\s+ahora|fuerza\s+(?:el\s+)?tick|corre\s+autonomia/.test(low)){
      await Autonomo.forzarTick();
      return personaReply('Tick forzado. Revisa el panel de autonomía para ver qué se disparó.');
    }

    // Listar reglas
    if (/que\s+reglas\s+tienes|lista\s+(?:las\s+)?reglas|muestra\s+(?:las\s+)?reglas/.test(low)){
      const lista = Autonomo.reglas.map(r => {
        const on = Autonomo.reglaActiva(r.id) ? '✓' : '○';
        return `${on} ${r.id}: ${r.descripcion}`;
      }).join('\n');
      return personaReply('Mis reglas autónomas:\n\n' + lista);
    }
  }
   
  /* ---- sistema ---- */
  if(/que\s+sabes\s+hacer|ayuda|comandos/.test(low)){
    renderChips(['Piénsalo: ¿qué opinas del café?','Oído local','Abre el hud','Prepara mi día','Ponme música','Adivina mi personaje']);
    return personaReply(
      'Sistemas v10:\n'+
      '· Cerebro razonador — «piénsalo»\n'+
      '· LOCALMIND offline — sin red ni GGUF converso con: entrenamiento interno, documentos, memoria y KB\n'+
      '· Oído local — «oído local» (Whisper offline)\n'+
      '· HUD — «abre el hud»\n'+
      '· Sesión multidevice · memoria episódica · secretaría · agenda · PC · música · clima · luna · Akinator · backup'
    );
  }
  if(/silencio|callate/.test(low)){ S.muted = true; store.set('muted', true); return addChat('ania','Voz off. Di «habla».'); }
  if(/^habla$|activa\s+la\s+voz/.test(low)){ S.muted = false; store.set('muted', false); return reply('Voz reactivada.'); }
  if(/diagnostico/.test(low)){ runDiag(); openModal('settingsModal'); return personaReply('Escaneo.'); }
  if(/adivina\s+personaje/.test(low)){ akStart(); return; }
  if(/chiste/.test(low)) return personaReply(freshPick('jokes', JOKES));
  if(/consejo|un\s+tip/.test(low)) return personaReply('Regla 32: café bien hecho y cinco minutos de silencio.');

  /* ============================================================
     MÓDULOS DE NEGOCIO · comandos de voz (Fase Jarvis)
  ============================================================ */

  /* FINANZAS */
  if (window.Finanzas){
    m = low.match(/\bgast[eé]\s+(\d+(?:[.,]\d+)?)\s*(?:en\s+|de\s+)?(.+)?$/);
    if (m){
      const monto = parseFloat(m[1].replace(',', '.'));
      const cat = (m[2] || 'general').trim().slice(0, 40);
      try{
        await Finanzas.registrarGasto(monto, cat);
        return personaReply(`Anotado: gasto de ${monto} en ${cat}.`);
      }catch(e){ return personaReply('No pude guardar el gasto: ' + e.message); }
    }
    m = low.match(/\b(?:ingres[eé]|gan[eé]|cobr[eé]|recib[ií])\s+(\d+(?:[.,]\d+)?)\s*(?:de\s+|en\s+)?(.+)?$/);
    if (m){
      const monto = parseFloat(m[1].replace(',', '.'));
      const cat = (m[2] || 'general').trim().slice(0, 40);
      try{
        await Finanzas.registrarIngreso(monto, cat);
        return personaReply(`Ingreso de ${monto} registrado (${cat}).`);
      }catch(e){ return personaReply('No pude guardar: ' + e.message); }
    }
    if (/c[oó]mo\s+va\s+el\s+mes|balance|mis\s+finanzas|c[oó]mo\s+van\s+las\s+cuentas|cu[aá]nto\s+llevo/.test(low)){
      try{ return personaReply(await Finanzas.resumenTexto()); }
      catch(e){ return personaReply('No pude leer las finanzas.'); }
    }
  }

  /* INVENTARIO */
  if (window.Inventario){
    m = low.match(/\bvend[ií]\s+(\d+(?:[.,]\d+)?)\s+(?:de\s+|unidades?\s+de\s+)?(.+)$/);
    if (m){
      const cant = parseFloat(m[1].replace(',', '.'));
      const nombre = m[2].trim();
      try{
        const prods = await Inventario.listar(nombre);
        const p = prods.find(x => x.nombre.toLowerCase().includes(nombre.toLowerCase()));
        if (!p) return personaReply(`No encuentro "${nombre}" en el inventario.`);
        await Inventario.mover(p.id, 'salida', cant, 'venta por voz', true);
        return personaReply(`Venta registrada: ${cant} ${p.unidad} de ${p.nombre}. Ingreso sumado a finanzas.`);
      }catch(e){ return personaReply(e.message); }
    }
    m = low.match(/\b(?:a[nñ]ad[ií]|agreg[ué]|met[ií]|ingres[eé])\s+(\d+(?:[.,]\d+)?)\s+(?:de\s+|unidades?\s+de\s+)?(.+?)(?:\s+al?\s+inventario)?$/);
    if (m){
      const cant = parseFloat(m[1].replace(',', '.'));
      const nombre = m[2].trim();
      try{
        const prods = await Inventario.listar(nombre);
        const p = prods.find(x => x.nombre.toLowerCase().includes(nombre.toLowerCase()));
        if (!p) return personaReply(`No encuentro "${nombre}". Créalo primero en el panel JARVIS.`);
        await Inventario.mover(p.id, 'entrada', cant);
        return personaReply(`Entrada: ${cant} ${p.unidad} de ${p.nombre}.`);
      }catch(e){ return personaReply(e.message); }
    }
    m = low.match(/\b(?:cu[aá]nto|cu[aá]nta)\s+(?:me\s+queda\s+de\s+|hay\s+de\s+|tengo\s+de\s+)(.+)$/);
    if (m){
      const nombre = m[1].trim();
      try{
        const prods = await Inventario.listar(nombre);
        if (!prods.length) return personaReply(`No encuentro "${nombre}".`);
        const p = prods[0];
        return personaReply(`${p.nombre}: ${p.cantidad} ${p.unidad} (mínimo ${p.minimo}).`);
      }catch(e){ return personaReply('No pude consultar.'); }
    }
    if (/stock\s+cr[ií]tico|qu[eé]\s+falta|bajo\s+stock|qu[eé]\s+(?:hay\s+que\s+)?reponer|alerta\s+stock/.test(low)){
      try{
        const criticos = await Inventario.bajoStock();
        if (!criticos.length) return personaReply('Sin alertas de stock. Todo en orden.');
        return personaReply('⚠ Bajo stock:\n' + criticos.map(p => `· ${p.nombre}: ${p.cantidad}/${p.minimo} ${p.unidad}`).join('\n'));
      }catch(e){ return personaReply('No pude consultar.'); }
    }
    if (/c[oó]mo\s+va\s+el\s+inventario|resumen\s+(?:del\s+)?inventario/.test(low)){
      try{ return personaReply(await Inventario.resumenTexto()); }
      catch(e){ return personaReply('No pude leer el inventario.'); }
    }
  }

  /* COMPRAS */
  if (window.Compras){
    m = low.match(/\b(?:a[nñ]ad[ií]|agreg[ué]|met[ií]|apunt[aá]|pon(?:me)?)\s+(.+?)\s+(?:a\s+la\s+(?:compra|lista)|al?\s+(?:carrito|super))(?:\s+(.+))?$/);
    if (m){
      const txt = m[1].trim();
      const nombreLista = (m[2] || '').trim() || null;
      try{
        if (nombreLista){
          await Compras.listar();
          let lista = Compras._cache.find(l => l.nombre.toLowerCase() === nombreLista.toLowerCase());
          if (!lista) lista = await Compras.crear(nombreLista);
          await Compras.agregar(lista.id, txt, 1, 'u', 'general');
        } else {
          await Compras.agregarRapido(txt, 1, 'u');
        }
        return personaReply('Añadido a la compra: ' + txt);
      }catch(e){ return personaReply(e.message); }
    }
    m = low.match(/\b(?:ya\s+)?compr[eé]\s+(.+)$/);
    if (m){
      const txt = m[1].trim();
      try{
        await Compras.listar();
        let encontrado = null;
        for(const l of Compras._cache){
          const it = (l.items || []).find(i => !i.comprado && i.texto.toLowerCase().includes(txt.toLowerCase()));
          if (it){ encontrado = { listaId: l.id, itemId: it.id, texto: it.texto }; break; }
        }
        if (encontrado){
          await Compras.marcar(encontrado.listaId, encontrado.itemId, true);
          return personaReply('✓ Marcado como comprado: ' + encontrado.texto);
        }
        return personaReply('No encuentro "' + txt + '" en ninguna lista.');
      }catch(e){ return personaReply(e.message); }
    }
    if (/qu[eé]\s+(?:tengo\s+que\s+comprar|falta\s+comprar|hay\s+que\s+comprar)|lista\s+de\s+compras|mis\s+compras/.test(low)){
      try{
        const pends = await Compras.pendientes();
        if (!pends.length) return personaReply('Listas al día. Nada que comprar.');
        const porLista = {};
        pends.forEach(p => { porLista[p.lista] = porLista[p.lista] || []; porLista[p.lista].push(p); });
        let s = '🛒 Pendientes de comprar:\n';
        for(const [nombre, items] of Object.entries(porLista)){
          s += `\n• ${nombre}:\n`;
          items.slice(0, 8).forEach(i => { s += `   · ${i.texto}${i.cantidad > 1 ? ' (x' + i.cantidad + ')' : ''}\n`; });
        }
        return personaReply(s.trim());
      }catch(e){ return personaReply(e.message); }
    }
    if (/mu[eé]strame\s+(?:las\s+)?(?:listas|compras)|abre\s+(?:las\s+)?(?:compras|listas)|panel\s+de\s+compras/.test(low)){
      openModal('jarvisModal');
      if (typeof switchJarvisTab === 'function') switchJarvisTab('compras');
      return personaReply('Ahí tienes tus listas.');
    }
  }

  /* DASHBOARD */
  if (/mu[eé]strame\s+(?:el\s+)?panel|abre\s+(?:el\s+)?(?:dashboard|panel\s+principal)|c[oó]mo\s+va\s+todo|resumen\s+general/.test(low)){
    if (window.Dashboard){ Dashboard.abrir(); return personaReply('Panel principal.'); }
  }

  /* MODO JARVIS */
  if (window.JarvisUI){
    if (/activa\s+(?:el\s+)?modo\s+jarvis|pon\s+(?:el\s+)?modo\s+jarvis|jarvis\s+on/.test(low)){
      JarvisUI.activar();
      return personaReply('Modo JARVIS activado. HUD en línea, sonidos calibrados.');
    }
    if (/desactiva\s+(?:el\s+)?modo\s+jarvis|jarvis\s+off|quita\s+el\s+hud/.test(low)){
      JarvisUI.desactivar();
      return personaReply('Modo JARVIS apagado.');
    }
  }

  /* ---- cortesía ---- */
  if(/adios|chao|hasta\s+luego/.test(low)) return personaReply('Hasta pronto. Que mañana sea bonito.');
  if(/^hola|^buenas|^hey/.test(low)){
    const h = new Date().getHours();
    return personaReply((h<12?'Buenos días':h<20?'Buenas tardes':'Buenas noches')+(Mind.nombre()?', '+Mind.nombre():'')+'. '+pick(['¿Misiones o sobremesa?','¿Qué necesitamos?']));
  }

  /* ================================================================
     ÚLTIMO RECURSO — LA CASCADA v10
  ================================================================ */
  if(isOffline() && !Brain.localReady){
    const lib = Library.find(low);
    if(lib) return personaReply(lib.extract + '\n[de tu biblioteca]');
    return personaReply(LocalMind.think(raw, low));
  }
  setPhase('thinking');
  const q = low.replace(/^(?:por\s+favor|ania)\s*/,'');
  const ai = await Brain.think(q);
  if(ai) return personaReply(ai);
  const w = await wikiSummary(q);
  if(w){
    Library.save(q, w.extract.slice(0,520));
    personaReply(w.extract.slice(0,520)+'\n[guardado]');
  } else {
    personaReply(LocalMind.think(raw, low));
  }
}

/* ---------- send() con cola offline ---------- */
let busy = false;
const pendingQ = [];

async function _sendCore(text){
  if(!text) return;
  if(busy){ pendingQ.push(text); return; }
  busy = true;
  try{
    addChat('you', text);
    Episodio.push('you', text);
    S.lastUserTs = Date.now();
    $('chips').innerHTML = '';
    await respond(text);
  } finally {
    busy = false;
    const nxt = pendingQ.shift();
    if(nxt) _sendCore(nxt);
  }
}

async function send(text){
  if (!text) return;
  if (isOffline()){
    OfflineQueue.push(text);
    addChat('you', text);
    addChat('sys', '⚠ Sin conexión · guardado en cola (' + OfflineQueue.count() + '). Se enviará al reconectar.');
    return;
  }
  return _sendCore(text);
}

async function procesarColaOffline(){
  const lista = OfflineQueue.list();
  if (!lista.length) return;
  addChat('sys', '✉ Reconectado · procesando ' + lista.length + ' mensaje(s) en cola...');
  for (const item of lista){
    if (isOffline()) break;
    try{
      await _sendCore(item.msg);
      OfflineQueue.remove(item.id);
      await new Promise(r => setTimeout(r, 800));
    }catch(e){
      console.warn('Fallo al procesar cola:', e.message);
      break;
    }
  }
  if (!OfflineQueue.count()) addChat('sys', '✔ Cola vacía');
}

addEventListener('online', ()=>{ setTimeout(procesarColaOffline, 1200); });
