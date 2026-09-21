ANIA
ANIA · Núcleo Personal

Asistente personal, secretaria ejecutiva y compañera que vive en un solo archivo HTML

voz · personalidad propia · memoria · música procedural · agente de PC · entrenamiento con documentos · modo offline

            

» ANIA KERNEL v6.0 · núcleo personal» LINGUA: cubano + typos + tildes ... OK» escucha continua: palabra «Ania» .. OK» música procedural + agente PC ..... OK» esperando credenciales del operador _  > que bolá  ANIA ▸ ¡Hola! ¿Misiones o sobremesa?  > ania, ponme musika  ANIA ▸ Ahí va: lo-fi procedural, acordes de jazz y vinilo, generado en vivo.        (sin tilde y con typo: entendido igual)

Ania no es un chatbot genérico: es un personaje con identidad completa — 20 años, graduadade la Academia Eden, especialista en isekai, series zombie, café de especialidad, astronomía ytecnología — que te habla con voz femenina, recuerda tu nombre y tus gustos, agenda tareasrecurrentes, entrena con tus propios documentos, controla tu PC con un agente opcional yte acompaña incluso cuando no tienes internet.

Y te puede escribir normal, con faltas de ortografía, con o sin tilde, en coloquial o en cubano:«klima», «ponme musikita», «que bolá, abre mi pc».

Creada por Carlos Lorenzo Marros.
» Características
Módulo	Qué hace
LINGUA	Entiende sin tilde, con typos, coloquial y cubano: 4 capas de normalización + corrección difusa (Levenshtein) + fonética del STT («aña» → «Ania»)
Voz bidireccional	Voz femenina en español + micrófono; escucha continua opt-in con palabra de activación «Ania» (se calla sola cuando va a responder)
Agente del PC (opcional)	«abre mi pc», «sube el volumen», «captura mi pantalla» (aparece en el chat), «apaga la pc», «busca en toda la pc», «lee mi portapapeles», «abre [url] en el pc»
Índice del PC	Indexa tus carpetas (películas, música...) y encuentra archivos con búsqueda difusa, 100% local
Música procedural	Lo-fi generado en vivo con WebAudio: acordes de jazz, vinilo crujiente, ritmo lento. Cero archivos, cero internet
Ambiente	Lluvia y cafetería sintetizadas gota a gota: «pon lluvia», «pon la cafetería»
Secretaría ejecutiva	«prepara mi día» (informe ejecutivo), reuniones con pre-aviso de 15 min, redacción de correos
Agenda + recordatorios	Recurrentes («todos los días», «cada lunes»), canales de aviso separados web/Telegram (sin duplicar), «pospón 10 minutos»
Memoria de usuario	«me llamo Carlos» → lo recuerda para siempre, junto a gustos y datos
Login multiusuario	usuarios.json desde GitHub, caché para login offline y modo invitado
Entrenamiento con documentos	Carpeta local o documentos/ en el repo (.txt/.md/.csv/.docx/.doc/.pdf) + JSON de respuestas fijas editable dentro del HTML
Biblioteca offline	Cada búsqueda de Wikipedia se guarda y se lee sin conexión
Clima, astro y entorno	Clima en tiempo real, fase lunar y lluvias de meteoros (cálculo local), reactor que cambia con el clima real
IA conversacional	Gratuita y sin clave (Pollinations) como último recurso online, con la personalidad de Ania
Diario + Backup total	Bitácora diaria automática y export/import de todo tu universo en JSON
Terminal real	Historial de comandos con ↑/↓, autocompletado con Tab, atajos Ctrl+K/Ctrl+M
Extras	Akinator isekai, Adivina, conversor de unidades y bases, reloj mundial, generador de contraseñas, frases célebres
PWA instalable	App a pantalla completa; con service worker funciona sin conexión
» Empezar
Opción A · Uso local (sin nada más)

    Descarga index.html.
    Ábrelo con Chrome o Edge. Listo.

    Funciona sin internet: personalidad, memoria, agenda, música, PC, luna, Akinario y charla.Solo clima / búsqueda / IA necesitan red.

Opción B · GitHub Pages (PWA completa)

    Haz fork o clona este repo.
    Settings → Pages → Deploy from a branch → main / (root) → Save.
    Ábrela en el móvil (Chrome) → menú ⋮ → Instalar aplicación.

    Con el service worker incluido, la app instalada funciona sin conexión.También puedes generar el kit completo desde dentro de la propia app:INSTALAR → DESCARGAR KIT GITHUB (ZIP) — Ania empaqueta su propio código.

Opción C · Agente del PC (opcional, modo Iron Man)

cd agentenpm install wsset ANIA_TOKEN=mi-clave-secreta      # Windows (o usa siempre la variable de entorno)node ania-agent.js

Luego en Ania: «conecta el agente con clave mi-clave-secreta».El puente escucha solo en 127.0.0.1, exige token y usa listas blancas de apps y rutas.Para auto-inicio silencioso, copia agente/ania-agent.vbs en shell:startup.

    El agente publicado trae un token de ejemplo. Si editas tu copia local con la clave real,no subas ese cambio al repo.

» Login y usuarios

Las credenciales se leen en vivo de:

https://raw.githubusercontent.com/calm291094-del/meditech-tienda/main/usuarios.json

{  "username": "cliente",  "password": "Cliente123",  "name": "cliente",  "email": "cliente@gmail.com",  "role": "user",  "fecha": "2026-07-07T12:29:43.970Z"}

    Al iniciar sesión, Ania reconoce el campo name y te saluda por tu nombre.
    La lista se cachea en el dispositivo: el login también funciona sin conexión.
    La sesión se recuerda entre visitas (cerrar sesión en Ajustes).
    Existe modo invitado si no hay red ni caché.

    ⚠️ Seguridad: al ser un repo público, las contraseñas viajan en texto plano. Para usocasual está bien; para blindarlo, valida el login en el backend y guarda hashes (bcrypt/argon2).

» Comandos que Ania entiende
Ver la lista completa de comandos
» Entrenamiento con documentos

Vía GitHub (público): sube tus archivos a documentos/ y lista sus nombres endocumentos/indice.json:

["apuntes.txt", "recetas.docx", "manual.pdf"]

Vía local (privado): «entrena con mis documentos» → eliges la carpeta → todo quedaen tu dispositivo, nada sale de él.

Formatos: .txt · .md · .csv · .json · .docx · .doc (mejor esfuerzo) · .pdf (mejor esfuerzo).

Además, al final del index.html hay un JSON de entrenamiento interno editable:respuestas fijas que Ania prioriza sobre su propio conocimiento.
» Modo offline
Con internet	Sin internet
Clima y ubicación en tiempo real	Clima en caché
Búsqueda, conocimiento, traducción, IA	Biblioteca offline + documentos entrenados + knowledge local
Noticias + sincronización con Telegram	Agenda y recordatorios 100% locales
Login en vivo contra usuarios.json	Login con caché + modo invitado
Búsqueda del agente en todo el disco	Índice local del PC + música procedural + luna + Akinator
Voz, memoria, secretaría, personalidad	Voz, memoria, secretaría, personalidad

La transición es automática: si la red se cae, Ania te avisa y cambia al núcleo localsin perder una sola función local.
» Arquitectura

Todo el sistema cabe en un único index.html (cero build, cero framework):

index.html├── Login             · usuarios.json + sesión + caché offline├── LINGUA            · 4 capas: tildes, typos, cubano, fonética STT + fuzzy├── Mente             · memoria del usuario (localStorage)├── Personalidad      · identidad, KB offline, entrenamiento JSON interno├── Reactor + bgfx    · núcleo canvas + clima real + lluvia/estrellas de fondo├── Voz               · TTS/STT + escucha continua con palabra «Ania»├── Música/Ambiente   · lo-fi, lluvia y cafetería procedural (WebAudio)├── Agenda            · recurrentes, canales web/Telegram, disparo único├── PC + Agente       · índice de archivos + puente ws://127.0.0.1├── Secretaría        · briefing ejecutivo, correos, reuniones├── DocBrain          · entrenamiento con documentos (txt/docx/pdf)├── Diario + Backup   · bitácora automática + export/import total├── Sync              · backend opcional (anti-duplicados, degradación limpia)├── Servicios         · clima, wiki, DDG (JSONP), traducción, Pollinations├── Cerebro           · parser de intenciones (español natural + cubano)└── PWA               · manifest + service worker + kit ZIP autogenerado

APIs públicas usadas — ninguna requiere clave:
Servicio	Uso
Open-Meteo	Clima actual + pronóstico
Nominatim · OpenStreetMap	Geocodificación y ubicación
Wikipedia · REST + Action API	Conocimiento y búsquedas
DuckDuckGo · Instant Answer	Respuestas rápidas (vía JSONP)
MyMemory	Traducción
Pollinations	IA conversacional con personalidad
Web Speech / Notification / Battery / WakeLock / Vibration	APIs nativas del navegador
» Estructura del repositorio

├── index.html      # toda la aplicación (UI + lógica + personalidad)├── manifest.json   # manifiesto PWA├── icon.svg        # icono de la app├── sw.js           # service worker · caché offline + refresh de documentos├── fondo.png       # imagen de portada├── documentos/│   ├── indice.json # lista de archivos de entrenamiento│   └── (tus .txt / .docx / .pdf)├── agente/         # puente del PC (opcional)│   ├── ania-agent.js│   ├── ania-agent.vbs│   └── package.json└── README.md

» Problemas conocidos
Ver soluciones rápidas
» Hoja de ruta

     Reconocimiento de voz continuo con palabra de activación
     Entrenamiento con documentos propios
     Control del PC vía agente local
     Agenda recurrente y canales de aviso separados
     Hash de contraseñas validado en backend (login por API con token)
     Sincronización de memoria y ajustes entre dispositivos
     Atajos en pantalla de inicio (manifest shortcuts) y periodic sync
     PIN local de bloqueo (WebCrypto)
     Trivia temática y más juegos
     Más idiomas de interfaz

» Créditos y licencia

Ania — concepto, diseño y personalidad: Carlos Lorenzo Marros.

Publicado bajo la licencia MIT. Puedes usarla, modificarla y llevarte a tu propia Aniaa donde quieras... solo recuerda darle buen café.

«Pan, café y anime: la trinidad de la felicidad.» — Ania
