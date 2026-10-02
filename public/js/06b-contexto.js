/* ============================================================
   06B-CONTEXTO · Memoria conversacional de corto plazo
   Recuerda los últimos N temas, emociones y patrones para que
   Ania no repita respuestas y pueda hacer "callbacks" naturales.
============================================================ */
'use strict';

const Contexto = {
  // Últimos turnos (máx 8)
  turnos: [],
  // Últimos temas mencionados (máx 12)
  temas: [],
  // Última respuesta textual (para evitar repetirla)
  ultimaRespuesta: '',
  // Cuántas veces seguidas ha respondido sin preguntar de vuelta
  rachaSinPregunta: 0,

  /* Registrar un turno (usuario + respuesta de Ania) */
  registrar(userText, aniaText, emocion){
    this.turnos.push({
      u: String(userText).slice(0, 200),
      a: String(aniaText).slice(0, 300),
      e: emocion || 'neutral',
      t: Date.now()
    });
    if (this.turnos.length > 8) this.turnos.shift();

    // Extraer temas (sustantivos clave) del texto del usuario
    this._extraerTemas(userText);

    this.ultimaRespuesta = aniaText;
  },

  /* Extrae temas relevantes del texto del usuario */
  _extraerTemas(texto){
    const low = LINGUA.normalizar(texto);
    // Temas conocidos (ampliable)
    const TEMAS_CLAVE = {
      cafe: /\b(cafe|espresso|barista|grano|latte|capuchino)\b/,
      anime: /\b(anime|manga|isekai|rimuru|ainz|subaru|konosuba|overlord)\b/,
      zombies: /\b(zombie|apocalipsis|superviviente|walking)\b/,
      astro: /\b(estrella|luna|planeta|galaxia|cosmos|nebulosa|agujero)\b/,
      pan: /\b(pan|masa|harina|amas|hornea)\b/,
      tech: /\b(programa|codigo|javascript|python|pc|computadora|software)\b/,
      musica: /\b(musica|lo-fi|lofi|jazz|sawano|kajiura)\b/,
      comida: /\b(comida|cena|almuerzo|desayuno|receta|cocinar|pizza|arroz)\b/,
      trabajo: /\b(trabajo|reunion|jefe|oficina|proyecto)\b/,
      salud: /\b(enfermo|dolor|salud|ejercicio|cansado|descanso)\b/,
      amor: /\b(amor|novia|novio|pareja|te quiero|gusta alguien)\b/,
      soledad: /\b(solo|sola|soledad|nadie me)\b/,
      estres: /\b(estres|ansiedad|nervioso|agobio|preocupa)\b/
    };
    for (const [tema, re] of Object.entries(TEMAS_CLAVE)){
      if (re.test(low)){
        this.temas.push({ tema, t: Date.now() });
        if (this.temas.length > 12) this.temas.shift();
      }
    }
  },

  /* Devuelve el tema más reciente que no sea el actual */
  temaAnterior(actual){
    for (let i = this.temas.length - 1; i >= 0; i--){
      if (this.temas[i].tema !== actual) return this.temas[i].tema;
    }
    return null;
  },

  /* Devuelve el tema dominante de los últimos 3 turnos */
  temaDominante(){
    if (!this.temas.length) return null;
    const conteo = {};
    const ahora = Date.now();
    for (const t of this.temas){
      if (ahora - t.t > 120000) continue;  // solo últimos 2 min
      conteo[t.tema] = (conteo[t.tema] || 0) + 1;
    }
    const entrada = Object.entries(conteo).sort((a,b) => b[1] - a[1])[0];
    return entrada ? entrada[0] : null;
  },

  /* ¿Ya respondió esta misma frase recientemente? */
  respuestaRepetida(nueva){
    if (!this.ultimaRespuesta) return false;
    const a = LINGUA.normalizar(nueva).slice(0, 60);
    const b = LINGUA.normalizar(this.ultimaRespuesta).slice(0, 60);
    return a === b || (a.length > 20 && b.includes(a));
  },

  /* ¿El usuario está en racha emocional (triste, estresado, etc.)? */
  rachaEmocional(){
    const ultimos = this.turnos.slice(-3);
    if (ultimos.length < 2) return null;
    const emociones = ultimos.map(t => t.e).filter(e => e !== 'neutral');
    if (emociones.length < 2) return null;
    // Si todas son iguales o del mismo "grupo negativo", devolverla
    const negativas = ['tristeza', 'ira', 'miedo'];
    if (emociones.every(e => e === emociones[0])) return emociones[0];
    if (emociones.filter(e => negativas.includes(e)).length >= 2) return 'negativa';
    return null;
  }
};
