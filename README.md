ANIA · Núcleo Personal

    Asistente personal tipo JARVIS que vive en un solo archivo HTML.Con voz, personalidad propia, memoria de usuario, clima, agenda con recordatorios,búsqueda, traducción, login multiusuario y modo offline. Sin claves de API. Sin servidores propios obligatorios.

ANIA

HTML5PWAOfflineAPIsLicencia

Ania no es un chatbot genérico: es un personaje con identidad completa — 20 años, graduada de laAcademia Eden, especialista en isekai, series zombie, café de especialidad, astronomía y tecnología —que te habla con voz femenina, recuerda tu nombre y tus gustos, te agenda tareas con recordatoriosde voz y notificaciones, y te acompaña incluso cuando no tienes internet.

Creada por Carlos Lorenzo Marros.
» Características
Módulo	Qué hace
Voz bidireccional	Habla con voz femenina en español (síntesis del navegador) y te escucha por micrófono (Chrome/Edge)
Personalidad propia	Respuestas en su voz, micro-acciones narradas (toma un sorbo de café), humor, empatía y gustos definidos
Memoria de usuario	Guarda tu nombre, tus gustos y tus datos: «me llamo Carlos» y no lo olvida nunca
Login multiusuario	Lee usuarios.json desde GitHub, reconoce tu nombre automáticamente y cachea las credenciales para login offline
Agenda + recordatorios	«recuérdame tomar agua a las 10:30 am» → alarma sonora, notificación del sistema y aviso por voz, una sola vez, con «pospón 10 minutos»
Clima y ubicación	Geolocalización GPS + clima en tiempo real con recomendación personal (Open-Meteo + Nominatim)
Búsqueda y conocimiento	Wikipedia (resúmenes y resultados) + respuestas instantáneas de DuckDuckGo vía JSONP
Traducción	8 idiomas de destino con MyMemory
Noticias	Titulares vía backend propio opcional, con «abre la noticia 2»
Cálculos	«calcula 12*9+3» o «cuánto es 23 por 4»
Modo offline	Detección automática: sin red sigue funcionando todo lo local + su knowledge base de especialidades
Reactor visual	Núcleo animado en canvas que respira, escucha, piensa y habla; 4 "esencias" de color
PWA instalable	Instalable en Android/iOS como app a pantalla completa; con service worker funciona sin conexión
Sincronización	Opcional: backend propio (Render) + tareas desde Telegram
» Instalación rápida (2 minutos)
Opción A · Uso local (sin GitHub)

    Descarga index.html.
    Ábrelo con Chrome o Edge. Eso es todo.

    Funciona sin internet: personalidad, memoria, agenda, recordatorios, cálculos,hora y charla. Solo clima/búsqueda/traducción necesitan red.

Opción B · GitHub Pages (PWA completa)

    Crea un repositorio público en GitHub.
    Add file → Upload files → arrastra index.html, manifest.json, icon.svg, sw.js y README.md.
    Settings → Pages → Source: Deploy from a branch → Branch: main / (root) → Save.
    En 1-2 minutos estará viva en https://tu-usuario.github.io/tu-repo/.
    Ábrela en tu móvil (Chrome) → menú ⋮ → Instalar aplicación. Con el service workerincluido, la app instalada funciona sin conexión.

También puedes generar el kit completo desde dentro de la propia app:botón INSTALAR → DESCARGAR KIT GITHUB (ZIP) — Ania empaqueta su propio código.
» Login y usuarios

Las credenciales se leen de este archivo (raw.githubusercontent permite CORS):

https://raw.githubusercontent.com/calm291094-del/meditech-tienda/main/usuarios.json

Formato de cada usuario:

{  "username": "cliente",  "password": "Cliente123",  "name": "cliente",  "email": "cliente@gmail.com",  "role": "user",  "fecha": "2026-07-07T12:29:43.970Z"}

    Al iniciar sesión, Ania reconoce el campo name y te saluda por tu nombre.
    La lista se cachea en el dispositivo: el login también funciona sin conexión.
    La sesión se recuerda entre visitas (Cerrar sesión en Ajustes).
    Existe modo invitado como puerta de escape si no hay red ni caché.

    ⚠️ Aviso de seguridad: como el repo es público, las contraseñas viajan en textoplano y son visibles para cualquiera. Para uso casual está bien; para algo serio,valida el login en el backend y guarda solo hashes (bcrypt/argon2).

» Comandos que Ania entiende
Categoría	Ejemplos
Hora y fecha	«¿qué hora es?» · «¿qué fecha es hoy?»
Clima / ubicación	«¿cómo está el clima?» · «¿dónde estoy?» · «clima en Bogotá»
Búsqueda	«busca agujeros negros» · «¿quién es Ada Lovelace?» · «información sobre Roma»
Noticias	«noticias de hoy» · «noticias de tech» · «abre la noticia 2»
Traducción	«traduce buenos días al japonés»
Cálculos	«calcula 12*9+3» · «cuánto es 23 por 4 más 2»
Agenda	«recuérdame estudiar a las 18:00» · «recuérdame llamar a Ana en 20 minutos» · «mis tareas» · «tarea hecha» · «borra la tarea de estudiar» · «limpia la agenda»
Posponer	«pospón 10 minutos» (tras un recordatorio)
Temporizadores	«temporizador de 5 minutos»
Memoria	«me llamo Carlos» · «me gusta el café» · «recuerda que tengo examen el viernes» · «¿qué sabes de mí?» · «olvídate de todo»
Navegación	«abre youtube» · «abre el mapa» · «abre github»
Sistema	«diagnóstico» · «silencio» / «habla» · «instálame» · «ayuda»
Sobremesa	«cuéntame un secreto» · «cuéntame algo curioso» · «un chiste» · «un consejo» · «¿cuál es tu café favorito?» · «¿qué harías en un apocalipsis zombie?»

Las horas aceptan am/pm, «de la tarde/noche», «en N minutos», «mañana a las 9» y «al mediodía».
» Arquitectura

Todo el sistema cabe en un único index.html (~1500 líneas, cero dependencias de build):

index.html├── CONFIG            · URLs del backend y de usuarios.json├── Login             · usuarios.json + sesión persistente + caché offline├── MENTE             · memoria del usuario (localStorage)├── PERSONALIDAD      · identidad, gustos, knowledge base local offline├── Reactor           · núcleo canvas (hex-stream, onda de voz, partículas)├── Voz               · síntesis (TTS) + reconocimiento (STT) del navegador├── Agenda            · tareas, recordatorios con disparo único, posposición├── Sync              · sincronización opcional con backend (anti-duplicados)├── Servicios         · clima, geolocalización, Wikipedia, DDG (JSONP), traducción├── Cerebro           · parser de intenciones en español natural└── PWA               · manifest dinámico + service worker + kit ZIP autogenerado

APIs públicas usadas (ninguna requiere clave):
Servicio	Uso	Coste
Open-Meteo	Clima actual + pronóstico	gratuito
Nominatim (OpenStreetMap)	Geocodificación y ubicación	gratuito
Wikipedia (REST + Action API)	Conocimiento y búsquedas	gratuito
DuckDuckGo Instant Answer	Respuestas rápidas (vía JSONP)	gratuito
MyMemory	Traducción	gratuito
Web Speech API / Notification / Battery	Voz, notificaciones, diagnóstico	nativas del navegador

Sincronización opcional: si tu backend (Render) está en línea, las tareas se compartencon Telegram y entre dispositivos. Si está caído, Ania funciona 100% en modo local sinquejarse — el pull nunca re-importa tareas vencidas y el push nunca duplica.
» Estructura del repositorio

├── index.html      # toda la aplicación (UI + lógica + personalidad)├── manifest.json   # manifiesto PWA├── icon.svg        # icono de la app├── sw.js           # service worker · caché offline├── docs/│   └── ania-banner.png└── README.md

» Solución de problemas
Problema	Solución
El micrófono no responde	El reconocimiento de voz solo funciona en Chrome/Edge. Revisa permisos del sitio
Ania no habla	El primer toque en la página habilita el audio (política de los navegadores). Prueba «habla»
No me da el clima	Autoriza el permiso de ubicación, o dile «clima en [ciudad]»
Los recordatorios no suenan	Deben dispararse con la app abierta. Instalada como PWA con SW, la ventana es mucho mayor
El botón SYNC dice "no disponible"	Tu backend en Render free "duerme": el primer ping tarda ~1 min en despertarlo
El login falla sin conexión	Solo falla la primera vez (sin caché). Tras un login exitoso, queda cacheado
» Hoja de ruta

     Hash de contraseñas validado en backend
     Sincronización de memoria y ajustes entre dispositivos
     Widgets de clima y tareas en la pantalla de inicio
     Reconocimiento de voz continuo (modo siempre escuchando)
     Más idiomas de interfaz (config regional)

» Créditos y licencia

Ania — concepto, diseño y personalidad: Carlos Lorenzo Marros.

Publicado bajo licencia MIT. Puedes usarla, modificarla y llevar a tu propiaAnia a donde quieras... solo recuerda darle buen café.
