/* ============================================================
   expandir-entrenamiento.js
   Lee data/entrenamiento.json y genera variantes + seguimientos
   para cada entrada, produciendo entrenamiento.json expandido.
   
   Uso:
     node tools/expandir-entrenamiento.js
   
   Entrada:  public/data/entrenamiento.json
   Salida:   public/data/entrenamiento-expandido.json
   Luego renombra el archivo expandido al original.
============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const RUTA_ENTRADA = path.join(__dirname, '..', 'public', 'data', 'entrenamiento.json');
const RUTA_SALIDA  = path.join(__dirname, '..', 'public', 'data', 'entrenamiento-expandido.json');

/* Prefijos y sufijos que dan variación natural */
const PREFIJOS = [
  'Mmm, ',
  'Mira, ',
  'A ver, ',
  'Piénsalo así: ',
  'Te lo digo directo: ',
  'Sin rodeos: ',
  '(da un sorbo pensativo) ',
  '(sonríe) ',
  'Ok, escucha: ',
  'Te cuento: '
];

const SUFIJOS = [
  ' ¿Te sirve así?',
  ' ¿Y tú qué opinas?',
  ' ¿Algo más de esto?',
  ' Dime si quieres que profundice.',
  ' ¿Lo hablamos o cambiamos de tema?',
  ' ¿Te resuena?',
  ' ¿Por qué lo preguntas?'
];

/* Los temas y sus seguimientos temáticos */
const SEGUIMIENTOS_POR_CLAVE = {
  cafe:      ['¿Cómo lo tomas tú?', '¿Espresso o filtrado?', '¿Es tu primera taza?'],
  anime:     ['¿Ves anime seguido?', '¿Cuál es tu favorito?', '¿Prefieres sub o doblaje?'],
  zombies:   ['¿Te gustan las pelis de zombies?', '¿Tienes kit de emergencia?', '¿Regla 32 aplicada?'],
  astro:     ['¿Has mirado el cielo últimamente?', '¿Te gusta la astronomía?', '¿Viste la última lluvia de estrellas?'],
  pan:       ['¿Horneas algo?', '¿Tienes masa madre?', '¿Te gusta cocinar?'],
  tech:      ['¿En qué trabajas?', '¿Qué lenguaje usas?', '¿Programas seguido?'],
  musica:    ['¿Qué escuchas ahora?', '¿Tienes playlist favorita?', '¿Te gusta lo-fi?'],
  comida:    ['¿Qué cocinas mejor?', '¿Tienes antojo de algo?', '¿Ya comiste?'],
  trabajo:   ['¿Cómo va la carga?', '¿Mucho lío?', '¿Puedes delegar algo?'],
  salud:     ['¿Cómo te sientes hoy?', '¿Descansaste bien?', '¿Necesitas parar?'],
  amor:      ['¿Cómo va el corazón?', '¿Alguien en mente?', '¿Es un tema abierto o solo curiosidad?'],
  soledad:   ['Aquí sigo, por si acaso.', '¿Quieres hablar o distraerte?', 'No estás solo conmigo.'],
  estres:    ['¿Qué te aprieta más?', 'Respira cinco minutos.', '¿Necesitas desahogarte?'],
  default:   ['¿Algo más?', '¿Te ayudo con otra cosa?', '¿Seguimos?']
};

/* Detecta a qué tema pertenece una entrada */
function detectarTema(entrada){
  const texto = (entrada.claves || []).join(' ').toLowerCase() +
                ' ' + (entrada.respuesta || '').toLowerCase();
  for (const tema of Object.keys(SEGUIMIENTOS_POR_CLAVE)){
    if (tema === 'default') continue;
    if (texto.includes(tema)) return tema;
  }
  // Búsquedas indirectas
  if (/caf[eé]|espresso|latte/.test(texto)) return 'cafe';
  if (/anime|manga|isekai/.test(texto)) return 'anime';
  if (/estrella|luna|cosmos/.test(texto)) return 'astro';
  if (/program|c[oó]digo|pc|software/.test(texto)) return 'tech';
  return 'default';
}

/* Genera 2-3 variantes de una respuesta */
function generarVariantes(respuesta){
  const variantes = [];
  const r = respuesta.trim();
  if (r.length < 30) return variantes;  // muy corta para variantes

  // Variante 1: prefijo
  variantes.push(PREFIJOS[Math.floor(Math.random() * PREFIJOS.length)] +
                 r.charAt(0).toLowerCase() + r.slice(1));

  // Variante 2: sufijo (si no termina en pregunta)
  if (!r.endsWith('?')){
    variantes.push(r.replace(/[.!]$/, '') + '. ' +
                   SUFIJOS[Math.floor(Math.random() * SUFIJOS.length)]);
  }

  // Variante 3: reformulación con prefijo distinto
  if (r.length > 60){
    variantes.push(PREFIJOS[Math.floor(Math.random() * PREFIJOS.length)] +
                   r.charAt(0).toLowerCase() + r.slice(1));
  }

  return variantes;
}

/* Procesa todo el archivo */
function procesar(entrada){
  const out = { ...entrada };

  // Normalizar
  if (!out.respuesta && out.responses && out.responses.length){
    out.respuesta = out.responses[0];
    out.variantes = out.responses.slice(1);
  }

  // Generar variantes automáticas
  if (out.respuesta && (!out.variantes || out.variantes.length < 2)){
    const generadas = generarVariantes(out.respuesta);
    out.variantes = [...(out.variantes || []), ...generadas].slice(0, 4);
  }

  // Añadir seguimientos contextuales
  if (!out.seguimientos || !out.seguimientos.length){
    const tema = detectarTema(out);
    out.seguimientos = SEGUIMIENTOS_POR_CLAVE[tema] || SEGUIMIENTOS_POR_CLAVE.default;
  }

  return out;
}

/* Main */
function main(){
  if (!fs.existsSync(RUTA_ENTRADA)){
    console.error('✗ No existe', RUTA_ENTRADA);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(RUTA_ENTRADA, 'utf8'));
  const entradas = data.respuestas || data.entrenamiento || data;
  const lista = Array.isArray(entradas) ? entradas : [];

  console.log('📚 Entradas originales:', lista.length);

  const expandidas = lista.map(e => {
    if (typeof e === 'string') return e;  // separador de sección
    return procesar(e);
  });

  const salida = data.respuestas ? { ...data, respuestas: expandidas } :
                 data.entrenamiento ? { ...data, entrenamiento: expandidas } :
                 expandidas;

  fs.writeFileSync(RUTA_SALIDA, JSON.stringify(salida, null, 2), 'utf8');

  const conVariantes = expandidas.filter(e => e && e.variantes && e.variantes.length).length;
  console.log('✅ Generado:', RUTA_SALIDA);
  console.log('   Entradas con variantes:', conVariantes);
  console.log('   Entradas con seguimientos:', expandidas.filter(e => e && e.seguimientos && e.seguimientos.length).length);
}

main();
