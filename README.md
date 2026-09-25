<div align="center">
  <h1>ANIA</h1>
  <img src="icon.svg" alt="ANIA · Núcleo Personal" width="880">
  <p><strong>Asistente personal con voz, personalidad, memoria, backend propio y modo offline real</strong></p>
  <p><em>voz · cerebro colectivo · panel admin · agentes IA · agente PC · PWA instalable</em></p>
  <p>
    <img src="https://img.shields.io/badge/backend-Node.js-2de08a?style=flat-square">
    <img src="https://img.shields.io/badge/deploy-Render-39ff9b?style=flat-square">
    <img src="https://img.shields.io/badge/PWA-instalable-9fdcff?style=flat-square">
    <img src="https://img.shields.io/badge/OFFLINE-nativo-ffb547?style=flat-square">
    <img src="https://img.shields.io/badge/seguridad-scrypt+AES--256--GCM-ff7d94?style=flat-square">
    <img src="https://img.shields.io/badge/licencia-MIT-556677?style=flat-square">
  </p>
</div>

---

    » ANIA KERNEL v10.0 · edición Jarvis
    » LINGUA: cubano + typos + tildes .... OK
    » registro público + roles ........... OK
    » cerebro colectivo anonimizado ...... OK
    » agentes IA (mejoras/seguridad) ..... OK
    » logo reactivo 5 estados ............ OK
    » esperando credenciales del operador _

      > que bolá
      ANIA ▸ ¡Hola! ¿Misiones o sobremesa?
      > ania, ponme musika
      ANIA ▸ Lo-fi procedural en marcha.
            (sin tilde y con typo: entendido igual)

**Ania** no es un chatbot genérico: es un personaje con identidad propia — 20 años, egresada de la Academia Eden, especialista en isekai, zombies, café de especialidad, astronomía y tecnología. Tiene voz femenina, memoria privada cifrada, agenda recurrente, control del PC mediante un agente opcional, entrenamiento con tus propios documentos, y **funciona incluso sin internet**.

**Ahora con backend propio**: registro público, login con contraseñas hasheadas, panel de administración con Bento UI, cerebro colectivo que aprende de todos los usuarios sin revelar datos privados, y 3 agentes IA que mejoran el proyecto solos.

Creada por **Carlos Lorenzo Marros**.

---

## » Arquitectura general

┌──────────────────────────┐ ┌───────────────────────────┐
│ GitHub Pages (frontend) │◄─────►│ Render (backend Node.js) │
│ https://…github.io/ania │ │ https://ania-….onrender │
└──────────────────────────┘ └───────────────────────────┘
│ │
│ │
▼ ▼
┌──────────────────┐ ┌────────────────────────┐
│ Tu PC local │ │ GitHub como base DB │
│ agente PC + Vosk│ │ usuarios.enc.json │
│ ania.py │ │ memorias.enc.json │
└──────────────────┘ │ conocimiento.json │
│ admin-log.json │
└────────────────────────┘


- **Frontend** en GitHub Pages: `public/index.html` (HTML+CSS+JS en un solo archivo).
- **Backend** en Render: `servidor.js` (Node.js + Express).
- **Base de datos**: tu propio repositorio de GitHub, cifrado con AES-256-GCM.
- **Agentes IA**: GitHub Actions ejecutándose en segundo plano sin que la página esté abierta.
- **Modo offline total**: `ania.py` arranca todo en local con Node instalado.

---

## » Características completas

### 🧠 Núcleo de Ania

| Módulo | Qué hace |
|---|---|
| **LINGUA** | Entiende sin tilde, con typos, coloquial y cubano (corrección difusa + fonética del micrófono) |
| **LocalMind** | Motor conversacional 100% offline con jerarquía: entrenamiento → episodios → documentos → KB → memoria |
| **Cerebro colectivo** | Ania aprende de todos los usuarios. Lo público se comparte, lo privado se cifra y jamás se filtra |
| **Memoria episódica** | Recuerda conversaciones pasadas y las cita por fecha |
| **Personalidad** | Identidad fija: gustos, miedos, forma de hablar, referencias |
| **Voz bidireccional** | TTS femenino en español + micrófono nativo + Vosk offline |

### 🔐 Cuentas y seguridad

| Módulo | Qué hace |
|---|---|
| **Registro público** | Cualquiera crea cuenta con nombre completo, email, usuario y contraseña |
| **Login** | Contraseñas con **scrypt** + sal única por usuario |
| **Super admin** | Por variable `SUPERADMIN_EMAIL` en Render. Puede todo |
| **Roles** | `user`, `admin`, `superadmin` con permisos diferenciados |
| **Cambio de contraseña** | El usuario cambia la suya; el admin resetea la de otros |
| **Rate limiting** | Login (5/15min), registro (3/h), password (5/h), API general (300/15min) |
| **Bloqueo / desbloqueo** | Admin bloquea usuarios sin eliminar su cuenta |
| **Eliminación** | Super admin elimina cuenta + borra su memoria privada |
| **Tokens HMAC-SHA256** | Sesiones firmadas con expiración de 30 días |
| **Cifrado en reposo** | Todos los datos sensibles cifrados con **AES-256-GCM** antes de subir a GitHub |
| **Helmet + trust proxy** | Cabeceras de seguridad y detección correcta de IPs detrás de proxies |

### 🎛️ Panel de administración

| Módulo | Qué hace |
|---|---|
| **Bento UI** | Cuadrícula de tarjetas modernas con glassmorphism y hover states |
| **Stats en vivo** | Usuarios totales, activos 7d, bloqueados, conocimiento acumulado |
| **Lista de usuarios** | Nombre, email, rol, estado, última conexión, fecha de registro |
| **Acciones** | Hacer admin, bloquear, resetear contraseña, eliminar |
| **Sugerencias del agente** | Las 5 mejoras más recientes generadas por IA |
| **Reporte de seguridad** | Vulnerabilidades detectadas por el agente de seguridad |
| **Log admin** | Historial de todas las acciones administrativas |

### 🤖 Agentes IA (GitHub Actions)

| Agente | Qué hace | Cuándo corre |
|---|---|---|
| **Auto-Improvement** | Analiza el código y sugiere 5 mejoras priorizadas | Diario 3am UTC |
| **Security Scan** | Audita dependencias y código en busca de vulnerabilidades | Diario 5am UTC |
| **Personalization** | Genera perfiles anónimos por usuario (temas, tono, horario) | Diario 4am UTC |
| **Keep-Alive** | Ping a Render para que no se duerma | Cada 10 min |

### 🎨 Interfaz

| Módulo | Qué hace |
|---|---|
| **Logo reactivo** | 5 estados (`idle`, `listening`, `thinking`, `speaking`, `offline`) con animaciones distintas: glow, scanline, ondas, ecualizador, glitch RGB |
| **NotifyX** | Sistema de notificaciones premium con glassmorphism |
| **Perfil de usuario** | Cada uno ve sus temas favoritos, tono y horario detectados por el agente |
| **Cola offline** | Los mensajes escritos sin conexión se guardan y se envían al reconectar |
| **Notificaciones nativas** | Alertas del sistema operativo incluso con la pestaña cerrada |
| **Bento UI** | Rediseño del panel de admin con tarjetas glassmorphism |

### 🖥️ Agente del PC (opcional)

- «abre mi pc», «sube el volumen», «captura mi pantalla», «bloquea el pc», «apaga la pc», «lee mi portapapeles»
- Escucha **solo en 127.0.0.1**, exige token y usa listas blancas de apps y rutas
- Auto-inicio con `agente/ania-agent.vbs` en `shell:startup`
- **Desactivado por defecto**: se activa con `store.set('agentActivado', true)`

### 📴 Modo offline real

- **Vosk** (39 MB) para reconocimiento de voz offline en Chrome/Firefox
- **LocalMind** conversacional sin backend ni internet
- **Música procedural** con WebAudio (lo-fi, lluvia, cafetería)
- **Biblioteca** de búsquedas guardadas para leer sin conexión
- **`ania.py`**: lanzador local que arranca todo con un comando

---

## » Empezar (3 opciones)

### Opción A · Usar la versión en la nube (más fácil)

1. Abre **https://calm291094-del.github.io/ania/** o **https://ania-oqct.onrender.com/**
2. Crea una cuenta o entra como invitado.
3. En móvil (Chrome): menú ⋮ → **"Instalar aplicación"** para tenerla como app.

### Opción B · Correr todo en tu PC con `ania.py`

**Requisitos:** Python 3.8+ y Node.js 18+.

1. Descarga el repo (`git clone` o ZIP).
2. En la carpeta del proyecto, **una vez con internet**:
npm install
cd agente
npm install
cd ..

3. Ejecuta:
python ania.py

4. Se abre el navegador solo con Ania funcionando + agente PC activo.

**Modo offline en casa**: copia la carpeta completa (con `node_modules/`) a un USB y ejecuta `python ania.py` sin internet.

### Opción C · Desplegar tu propio backend

**Backend en Render:**

1. Fork del repo.
2. En [render.com](https://render.com): **New → Web Service** → conecta tu fork.
3. Configura:
- **Build Command**: `npm install`
- **Start Command**: `node servidor.js`
- **Health Check Path**: `/ania/health`
- **Instance Type**: Free
4. Añade las variables de entorno (abajo).
5. Espera al **Live**.

---

## » Variables de entorno (Render)

| Variable | Descripción | Cómo generarla |
|---|---|---|
| `GITHUB_TOKEN` | Token Fine-grained con permiso `Contents: Read & Write` sobre tu repo `ania` | https://github.com/settings/tokens?type=beta |
| `ANIA_SECRET` | Clave maestra para cifrar usuarios y memorias | `openssl rand -base64 48` |
| `ANIA_TOKEN_SECRET` | Clave para firmar sesiones HMAC | `openssl rand -base64 48` |
| `SUPERADMIN_EMAIL` | Email que se convierte automáticamente en super admin | tu correo |

**⚠️ Importante:** si pierdes `ANIA_SECRET`, los usuarios y memorias cifradas quedan irrecuperables.

**Secrets en GitHub Actions** (Settings → Secrets → Actions):

| Nombre | Valor |
|---|---|
| `ANIA_SECRET` | El mismo valor que en Render |

---

## » Comandos que Ania entiende

<details>
<summary><strong>Ver lista completa</strong></summary>

| Categoría | Ejemplos |
|---|---|
| Escucha | «siempre escúchame» → luego «Ania, ...» |
| Cuenta | «me llamo Carlos» · «cambiar mi contraseña» |
| Panel admin | «diagnóstico» · abre el panel con el botón ADMIN |
| PC (agente) | «abre mi pc» · «sube el volumen» · «captura mi pantalla» · «bloquea el pc» · «apaga la pc» |
| PC (índice) | «indexa mi pc» · «busca en la pc [película]» |
| Música | «ponme música» · «pon [canción] en youtube» · «pon lluvia» · «pon la cafetería» |
| Secretaría | «prepara mi día» · «reunión con Ana a las 15:00» |
| Agenda | «recuérdame tomar agua todos los días a las 9 am» · «mis tareas» · «pospón 10 minutos» |
| Memoria | «¿qué sabes de mí?» · «olvida todo» |
| Astro | «¿qué fase tiene la luna?» · «próxima lluvia de estrellas» |
| Clima | «¿cómo está el clima?» · «clima en Bogotá» |
| Conocimiento | «busca agujeros negros» · «¿quién es Ada Lovelace?» |
| Documentos | «entrena con mis documentos» · «busca en mis documentos [tema]» |
| Cerebro | «piénsalo» · «carga el cerebro» (GGUF local) |
| Offline | «oído local» (Whisper) · automático Vosk sin internet |
| Extras | «calcula 12*9+3» · «genera una contraseña» · «adivina mi personaje» |

</details>

---

## » Entrenamiento con documentos

**Por GitHub (público):** sube archivos a `documentos/` y lista sus nombres en `documentos/indice.json`:

```json
["apuntes.txt", "recetas.docx", "manual.pdf"]
```

Por carpeta local (privado): «entrena con mis documentos» → eliges la carpeta → nada sale de tu dispositivo.

» Estructura del repositorio
```json
ania/
├── servidor.js              ← backend Node.js (Render)
├── ania.py                  ← lanzador local todo-en-uno
├── package.json             ← deps del backend
├── .github/workflows/
│   ├── deploy-pages.yml     ← despliegue a GitHub Pages
│   ├── agent.yml            ← agente de mejoras
│   ├── seguridad.yml        ← agente de seguridad
│   ├── personalizacion.yml  ← agente de personalización
│   └── keep-alive.yml       ← ping a Render
├── agente/
│   ├── mejoras.js           ← agente IA de sugerencias
│   ├── seguridad.js         ← agente de auditoría
│   ├── personalizacion.js   ← agente de perfiles
│   ├── ania-agent.js        ← puente PC (WebSocket)
│   └── package.json
├── public/                  ← todo el frontend
│   ├── index.html           ← toda la app (HTML+CSS+JS)
│   ├── manifest.json        ← PWA
│   ├── sw.js                ← service worker
│   ├── icon.svg             ← icono
│   ├── vendor/              ← NotifyX, Vosk (local, sin CDN)
│   ├── fonts/               ← Share Tech Mono (local)
│   └── models/              ← modelo Vosk (~39 MB)
├── datos/                   ← datos cifrados (se generan solos)
│   ├── usuarios.enc.json
│   ├── memorias.enc.json
│   ├── conocimiento.json
│   ├── admin-log.json
│   ├── sugerencias.json
│   ├── security-report.json
│   └── perfiles.json
├── documentos/              ← entrenamiento por carpeta
├── modelos/                 ← modelos GGUF (opcional)
└── README.md
```

APIs externas usadas (todas gratuitas, sin clave):
Open-Meteo (clima) · Nominatim (geolocalización) · Wikipedia · DuckDuckGo · MyMemory (traducción) · Pollinations (IA) · jsDelivr/Statically (CDN) · GitHub API · APIs nativas del navegador (voz, notificaciones, batería, vibración, wake lock).
» Problemas conocidos y soluciones
<details> <summary><strong>Ver soluciones</strong></summary>
Problema	Solución
Actualicé index.html pero sale la versión vieja	Sube también sw.js incrementando el CACHE (ania-v9 → ania-v10)
El micrófono no responde en móvil	Chrome Android: desactivar "Bola rápida" de MIUI, dar permiso al sitio
Chrome dice "este sitio no puede solicitar permiso"	Hay una superposición activa (asistente de juego, burbujas). Desactívala
La "escucha activa" no detecta la palabra "Ania"	En móvil no es fiable por diseño del navegador. Usa pulsar el micrófono directamente
Vosk no carga el modelo	El archivo .tar.gz debe estar en GitHub Releases o Statically CDN, no en GitHub normal (>25 MB)
Firefox no tiene reconocimiento nativo	Es una limitación del navegador. Usa Vosk o cambia a Chrome/Edge
El agente PC no conecta	¿Corre node ania-agent.js? ¿Token idéntico? ¿store.set('agentActivado', true)?
El login falla sin conexión	Solo funciona online. Usa python ania.py en local para tenerlo offline
npm ci falla en GitHub Actions	Usa npm install en su lugar (no hay package-lock.json)
Cannot GET / en Render	Falta public/index.html o el servidor.js no sirve estáticos
Rate limiting bloquea a todos	Falta app.set('trust proxy', 1) para detectar IPs reales
njsscan falla en npm	No es un paquete de npm; usar basesec en su lugar
</details>
» Hoja de ruta

    ☑     Reconocimiento de voz continuo con palabra de activación
    ☑     Entrenamiento con documentos propios
    ☑     Control del PC vía agente local
    ☑     Agenda recurrente con canales separados
    ☑     Hash de contraseñas con scrypt
    ☑     Registro público multiusuario
    ☑     Super admin + panel de administración
    ☑     Cerebro colectivo con privacidad garantizada
    ☑     Memoria cifrada AES-256-GCM
    ☑     Rate limiting en todos los endpoints sensibles
    ☑     Agentes IA (mejoras, seguridad, personalización)
    ☑     Logo reactivo de 5 estados
    ☑     Notificaciones nativas del sistema
    ☑     Cola offline de mensajes
    ☑     Reconocimiento de voz offline con Vosk
    ☑     Lanzador local ania.py
    □     Recuperación de contraseña por email
    □     Sincronización cifrada entre dispositivos
    □     PIN local de bloqueo
    □     Panel de moderación de conocimiento compartido
    □     Gráficos históricos en el panel admin
    □     Editor visual de la personalidad de Ania
    □     Modo multijugador / salas compartidas

» Créditos y licencia

Ania — concepto, diseño y personalidad: Carlos Lorenzo Marros.

Licencia MIT. Llévate tu propia Ania a donde quieras... solo dale buen café.
<div align="center">

«Pan, café y anime: la trinidad de la felicidad.» — Ania
</div> ```
