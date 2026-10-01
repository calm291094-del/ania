/* ============================================================
   01-LINGUA · normalización, corrección difusa, jerga cubana
============================================================ */
'use strict';

const LINGUA = (() => {
  const sinDiacriticos = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'');

  const LEX_V5 = [
    [/\bq\b|\bk\b|\bke\b/g, 'que'],
    [/\bxq\b|\bporq\b/g, 'porque'],
    [/\btmb\b|\btb\b/g, 'tambien'],
    [/\bgrax\b|\bgracias\b/g, 'gracias'],
    [/\bhl\b/g, 'hola'],
    [/\btoy\b/g, 'estoy'],
    [/\btas\b/g, 'estas'],
    [/\bta\b/g, 'esta'],
    [/\bvoh\b/g, 'tu'],
    [/\basere\b|\bacere\b/g, 'amigo'],
    [/\bcompai?\b|\bcompa\b/g, 'companero'],
    [/\bherma(no|na)?\b/g, 'hermano'],
    [/\bsocio\b/g, 'amigo'],
    [/\bchama\b/g, 'chica'],
    [/\bchamo\b/g, 'chico'],
    [/\bpinga\b/g, ''],
    [/\bbol[aá]\b/g, 'que tal']
  ];
  const LEX = [
    [/\b(que\s+)?bola[so]?\b|\bque\s+vol[aa]\b/g, 'que tal'],
    [/\basere\b|\bacere\b|\bcompay\b/g, 'amigo'],
    [/\bchama\b|\bchamaco\b/g, 'chico'],
    [/\bchio\b|\bachanta\b|\bchao\b/g, 'adios'],
    [/\btremendo\b|\btempleao\b/g, 'muy bueno'],
    [/\bchevere\b|\bchen\b/g, 'genial'],
    [/\bjama\b|\bjamar\b/g, 'comer'],
    [/\bjeva\b/g, 'novia'],
    [/\bpincha\b|\bpinchar\b/g, 'trabajar'],
    [/\bguagua\b/g, 'autobus'],
    [/\bmaquina\b/g, 'coche'],
    [/\bpa\b/g, 'para'],
    [/\bta\b/g, 'esta'],
    [/\bne\b|\bnye\b/g, ''],
    [/\bmate\b|\bcobre\b/g, 'mira']
  ];
  const FIX = [
    [/klima|klimma/g, 'clima'],
    [/musika|muzica|mu[sz]ica/g, 'musica'],
    [/reko[rh]dame/g, 'recordame'],
    [/kal[ck]ula[gj]?/g, 'calcula'],
    [/peli[sz]\b/g, 'pelicula'],
    [/dokumento/g, 'documento'],
    [/bu[sz]came/g, 'buscame'],
    [/po[nm]me/g, 'ponme']
  ];
  const STT = [[
    /\b(a[nñ]{1,2}[ijy]a?|ana|anja|aña|hania|onia|anea|anie|anio|anni[ae]|a[nñ]{1,2}[iy]a)\b/g,
    'ania'
  ]];

  function normalizar(texto){
    let t = String(texto||'').toLowerCase().trim();
    t = sinDiacriticos(t);
    t = t.replace(/[¿?¡!.,;:"'`´()[\]]/g, ' ').replace(/\s+/g,' ').trim();
    for(const [re, sub] of STT) t = t.replace(re, ' '+sub+' ');
    for(const [re, sub] of LEX) t = t.replace(re, ' '+sub+' ');
    for(const [re, sub] of LEX_V5) t = t.replace(re, ' '+sub+' ');
    for(const [re, sub] of FIX) t = t.replace(re, sub);
    return t.replace(/\s+/g,' ').trim();
  }

  function dist(a, b){
    const m = a.length, n = b.length;
    if(!m) return n; if(!n) return m;
    let prev = Array.from({length:n+1}, (_,i)=>i);
    for(let i=1;i<=m;i++){
      const cur = [i];
      for(let j=1;j<=n;j++) cur[j] = Math.min(prev[j]+1, cur[j-1]+1, prev[j-1] + (a[i-1]===b[j-1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }

  function corregir(norm, vocabulario){
    const words = norm.split(' ');
    const out = [];
    let corregido = false;
    for(const w of words){
      if(w.length < 4 || vocabulario.has(w)){ out.push(w); continue; }
      let best = null, bd = Math.ceil(w.length*0.34);
      for(const v of vocabulario){ const d = dist(w, v); if(d < bd){ bd = d; best = v; } }
      if(best){ out.push(best); corregido = true; } else out.push(w);
    }
    return { text: out.join(' '), corregido };
  }

  return { normalizar, dist, corregir };
})();

const VOCAB = new Set(('clima musica hora fecha tarea tareas recordame recordatorio agenda temporizador pospon limpia busca buscame informacion quien traduce calcula convierte contrasena noticias abre mapa youtube github wikipedia biblioteca documentos diario respaldame luna meteoros estrellas adivina personaje siempre escuchame silencio habla diagnostico ayuda chiste consejo secreto frase dado reunion correo prepara dia pelicula pc agente lluvia cafetera cafe isekai zombie anime pan astro tecnologia volumen captura pantalla portapapeles bloquea apaga cerebro foto hablamos oido hud sesion vision gestos whisper relay manana hoy mediodia minutos horas todos').split(' '));

function entender(raw){
  const norm = LINGUA.normalizar(raw);
  const { text, corregido } = LINGUA.corregir(norm, VOCAB);
  if(corregido) toast('Interpretado como: «'+text+'»');
  return text;
}