<div align="center">

<h1>ANIA</h1>

<img src="fondo.png" alt="ANIA · Núcleo Personal" width="880">

<p><strong>Asistente personal tipo JARVIS que vive en un solo archivo HTML</strong></p>

<p><em>voz femenina · personalidad propia · memoria de usuario · clima · agenda · login multiusuario · modo offline</em></p>

<p>
  <img src="https://img.shields.io/badge/HTML5-un%20solo%20archivo-2de08a?style=flat-square">
  <img src="https://img.shields.io/badge/PWA-instalable-39ff9b?style=flat-square">
  <img src="https://img.shields.io/badge/MODO%20OFFLINE-nativo-9fdcff?style=flat-square">
  <img src="https://img.shields.io/badge/APIs-0%20claves-ffb547?style=flat-square">
  <img src="https://img.shields.io/badge/build-sin%20framework-79a88f?style=flat-square">
  <img src="https://img.shields.io/badge/licencia-MIT-556677?style=flat-square">
</p>

</div>

---

```text
» ANIA KERNEL v4.2 · núcleo personal
» compilando módulos de red ............ OK
» cargando núcleo de personalidad ...... OK
» esperando credenciales del operador _

  > despertar a ania
  ANIA ▸ Buenos días, Carlos. Todos mis sistemas están operativos.
```

**Ania** no es un chatbot genérico: es un personaje con identidad completa — 20 años, graduada
de la Academia Eden, especialista en isekai, series zombie, café de especialidad, astronomía y
tecnología — que te habla con voz femenina, recuerda tu nombre y tus gustos, agenda tus tareas
con recordatorios de voz y notificaciones, y te acompaña **incluso cuando no tienes internet**.

Creada por **Carlos Lorenzo Marros**.

---

## » Características

| Módulo | Qué hace |
|---|---|
| **Voz bidireccional** | Habla con voz femenina en español y te escucha por micrófono (Chrome/Edge) |
| **Personalidad propia** | Respuestas en su voz, micro-acciones narradas *(toma un sorbo de café)*, humor, empatía y gustos definidos |
| **Memoria de usuario** | «me llamo Carlos» → lo recuerda para siempre, junto a tus gustos y tus datos |
| **Login multiusuario** | Lee `usuarios.json` desde GitHub, reconoce tu nombre y cachea credenciales para login offline |
| **Agenda + recordatorios** | «recuérdame tomar agua a las 10:30 am» → alarma, notificación y aviso por voz, una sola vez, con «pospón 10 minutos» |
| **Clima y ubicación** | GPS + clima en tiempo real con recomendación personal incluida |
| **Búsqueda y conocimiento** | Wikipedia (resúmenes y resultados) + respuestas instantáneas de DuckDuckGo |
| **Traducción** | 8 idiomas de destino, frases naturales |
| **Noticias** | Titulares vía backend propio opcional, con «abre la noticia 2» |
| **Cálculos** | «calcula 12*9+3» o «cuánto es 23 por 4» |
| **Modo offline** | Detección automática: sin red sigue funcionando todo lo local + knowledge base de sus especialidades |
| **Reactor visual** | Núcleo canvas que respira, escucha, piensa y habla · 4 esencias de color |
| **PWA instalable** | App a pantalla completa en Android/iOS; con service worker funciona sin conexión |
| **Sincronización** | Opcional: backend propio + tareas desde Telegram, con protección anti-duplicados |

---

## » Empezar en 2 minutos

### Opción A · Uso local (sin nada más)

1. Descarga `index.html`.
2. Ábrelo con Chrome o Edge. **Listo.**

> Funciona sin internet: personalidad, memoria, agenda, recordatorios, cálculos,
> hora y charla. Solo clima / búsqueda / traducción necesitan red.

### Opción B · GitHub Pages (PWA completa)

1. Crea un repositorio **público** en GitHub.
2. **Add file → Upload files** → arrastra `index.html`, `manifest.json`, `icon.svg`, `sw.js`, `README.md` y `fondo.png`.
3. **Settings → Pages** → *Deploy from a branch* → `main` / `(root)` → **Save**.
4. En 1–2 minutos estará viva en `https://tu-usuario.github.io/tu-repo/`.
5. Ábrela en tu móvil (Chrome) → menú **⋮ → Instalar aplicación**.

> Con el service worker incluido, la app instalada funciona **sin conexión**.
> También puedes generar el kit completo desde dentro de la propia app:
> **INSTALAR → DESCARGAR KIT GITHUB (ZIP)** — Ania empaqueta su propio código.

---

## » Login y usuarios

Las credenciales se leen en vivo de:

```text
https://raw.githubusercontent.com/calm291094-del/meditech-tienda/main/usuarios.json
```

```json
{
  "username": "cliente",
  "password": "Cliente123",
  "name": "cliente",
  "email": "cliente@gmail.com",
  "role": "user",
  "fecha": "2026-07-07T12:29:43.970Z"
}
```

- Al iniciar sesión, Ania reconoce el campo `name` y te saluda por tu nombre.
- La lista se **cachea en el dispositivo**: el login también funciona sin conexión.
- La sesión se recuerda entre visitas (cerrar sesión en Ajustes).
- Existe **modo invitado** como puerta de escape si no hay red ni caché.

> ⚠️ **Seguridad**: al ser un repo público, las contraseñas viajan en texto plano y son
> visibles para cualquiera. Para uso casual está bien; para algo serio, valida el login
> en el backend y guarda solo hashes (bcrypt / argon2).

---

## » Comandos que Ania entiende

<details>
<summary><strong>Ver la lista completa de comandos</strong></summary>

| Categoría | Ejemplos |
|---|---|
| Hora y fecha | «¿qué hora es?» · «¿qué fecha es hoy?» |
| Clima / ubicación | «¿cómo está el clima?» · «¿dónde estoy?» · «clima en Bogotá» |
| Búsqueda | «busca agujeros negros» · «¿quién es Ada Lovelace?» |
| Noticias | «noticias de hoy» · «noticias de tech» · «abre la noticia 2» |
| Traducción | «traduce buenos días al japonés» |
| Cálculos | «calcula 12*9+3» · «cuánto es 23 por 4 más 2» |
| Agenda | «recuérdame estudiar a las 18:00» · «mis tareas» · «tarea hecha» · «limpia la agenda» |
| Posponer | «pospón 10 minutos» (tras un recordatorio) |
| Temporizadores | «temporizador de 5 minutos» |
| Memoria | «me llamo Carlos» · «me gusta el café» · «¿qué sabes de mí?» · «olvídate de todo» |
| Navegación | «abre youtube» · «abre el mapa» · «abre github» |
| Sistema | «diagnóstico» · «silencio» / «habla» · «instálame» · «ayuda» |
| Sobremesa | «cuéntame un secreto» · «un chiste» · «un consejo» · «¿cuál es tu café favorito?» |

Las horas aceptan `am/pm`, «de la tarde/noche», «en N minutos», «mañana a las 9» y «al mediodía».

</details>

---

## » Modo offline

| Con internet | Sin internet |
|---|---|
| Clima y ubicación en tiempo real | Clima en caché |
| Búsqueda, conocimiento, traducción | Knowledge base local de sus especialidades |
| Noticias + sincronización con Telegram | Agenda y recordatorios 100% locales |
| Login en vivo contra `usuarios.json` | Login con caché + modo invitado |
| Voz, memoria, cálculos, personalidad | Voz, memoria, cálculos, personalidad |

La transición es automática: si la red se cae, Ania te avisa y cambia al **núcleo local**
sin perder una sola función local.

---

## » Arquitectura

Todo el sistema cabe en **un único `index.html`** (~1500 líneas, cero build, cero framework):

```text
index.html
├── Login             · usuarios.json + sesión persistente + caché offline
├── Mente             · memoria del usuario (localStorage)
├── Personalidad      · identidad, gustos, knowledge base offline
├── Reactor           · núcleo canvas (hex-stream, onda de voz, partículas)
├── Voz               · síntesis (TTS) + reconocimiento (STT) del navegador
├── Agenda            · tareas, recordatorios con disparo único, posposición
├── Sync              · backend opcional (anti-duplicados, degradación limpia)
├── Servicios         · clima, geolocalización, Wikipedia, DDG (JSONP), traducción
├── Cerebro           · parser de intenciones en español natural
└── PWA               · manifest + service worker + kit ZIP autogenerado
```

**APIs públicas usadas — ninguna requiere clave:**

| Servicio | Uso |
|---|---|
| Open-Meteo | Clima actual + pronóstico |
| Nominatim · OpenStreetMap | Geocodificación y ubicación |
| Wikipedia · REST + Action API | Conocimiento y búsquedas |
| DuckDuckGo · Instant Answer | Respuestas rápidas (vía JSONP) |
| MyMemory | Traducción |
| Web Speech / Notification / Battery | Voz, avisos y diagnóstico del dispositivo |

---

## » Estructura del repositorio

```text
├── index.html      # toda la aplicación (UI + lógica + personalidad)
├── manifest.json   # manifiesto PWA
├── icon.svg        # icono de la app
├── sw.js           # service worker · caché offline
├── fondo.png       # imagen de portada
├── docs/
│   └── ania-banner.png
└── README.md
```

---

## » Problemas conocidos

<details>
<summary><strong>Ver soluciones rápidas</strong></summary>

| Problema | Solución |
|---|---|
| El micrófono no responde | El reconocimiento de voz solo funciona en **Chrome/Edge**. Revisa permisos del sitio |
| Ania no habla | El primer toque en la página habilita el audio (política del navegador). Prueba «habla» |
| No me da el clima | Autoriza el permiso de ubicación, o dile «clima en [ciudad]» |
| Los recordatorios no suenan | Deben dispararse con la app abierta. Instalada como PWA, la ventana es mucho mayor |
| El botón SYNC dice "no disponible" | El backend free de Render "duerme": el primer ping tarda ~1 min en despertarlo |
| El login falla sin conexión | Solo falla la primera vez (sin caché). Tras un login exitoso, queda cacheado |

</details>

---

## » Hoja de ruta

- [ ] Hash de contraseñas validado en backend
- [ ] Sincronización de memoria y ajustes entre dispositivos
- [ ] Widgets de clima y tareas en pantalla de inicio
- [ ] Reconocimiento de voz continuo (modo siempre escuchando)
- [ ] Más idiomas de interfaz

---

## » Créditos y licencia

Ania — concepto, diseño y personalidad: **Carlos Lorenzo Marros**.

Publicado bajo la licencia **MIT**. Puedes usarla, modificarla y llevarte a tu propia Ania
a donde quieras... solo recuerda darle buen café.

<div align="center">

---

*«Pan, café y anime: la trinidad de la felicidad.»* — **Ania**

</div>
