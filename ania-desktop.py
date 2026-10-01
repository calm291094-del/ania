#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ANIA DESKTOP · App nativa con pywebview
Arranca servidor-local.js en un hilo y abre una ventana nativa.

Uso:
    python ania-desktop.py               → arranca con ventana nativa
    python ania-desktop.py --debug       → abre DevTools
    python ania-desktop.py --fullscreen  → ventana maximizada
    python ania-desktop.py --browser     → usa el navegador (modo fallback)

Requiere: Python 3.8+, Node.js 18+ y pywebview
"""

import os
import sys
import time
import json
import socket
import base64
import secrets
import signal
import subprocess
import threading
import urllib.request
import urllib.error
from pathlib import Path

# ==================== CONFIG ====================
RAIZ = Path(__file__).parent.resolve()
PUERTO_WEB = int(os.environ.get('ANIA_PORT_WEB', '10000'))
URL = f'http://127.0.0.1:{PUERTO_WEB}'
TIMEOUT_ARRANQUE = 30
SECRETS_FILE = RAIZ / '.ania-secrets.json'
ES_WINDOWS = os.name == 'nt'

# Forzar UTF-8 en consola Windows
if ES_WINDOWS:
    try:
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
    except Exception:
        pass
    try:
        os.system('')
    except Exception:
        pass

# ==================== COLORES ====================
class C:
    VERDE   = '\033[92m'
    AMBAR   = '\033[93m'
    ROJO    = '\033[91m'
    CIAN    = '\033[96m'
    GRIS    = '\033[90m'
    NEGRITA = '\033[1m'
    FIN     = '\033[0m'

def log(msg, color=C.VERDE):  print(f'{color}»{C.FIN} {msg}')
def err(msg):                 print(f'{C.ROJO}✖{C.FIN} {msg}')
def warn(msg):                print(f'{C.AMBAR}⚠{C.FIN} {msg}')


# ==================== SECRETOS ====================
def cargar_o_crear_secretos():
    """Carga los secretos desde .ania-secrets.json o los genera y los persiste."""
    datos = {}
    if SECRETS_FILE.exists():
        try:
            datos = json.loads(SECRETS_FILE.read_text(encoding='utf-8'))
        except Exception as e:
            warn(f'No pude leer {SECRETS_FILE.name}: {e}')
            datos = {}

    generadores = {
        'ANIA_SECRET':       lambda: base64.b64encode(secrets.token_bytes(48)).decode(),
        'ANIA_TOKEN_SECRET': lambda: base64.b64encode(secrets.token_bytes(48)).decode(),
        'ANIA_TOKEN':        lambda: secrets.token_hex(16),
    }

    cambiado = False
    for k, gen in generadores.items():
        if os.environ.get(k):
            datos[k] = os.environ[k]
            continue
        if not datos.get(k):
            datos[k] = gen()
            cambiado = True

    if cambiado:
        try:
            SECRETS_FILE.write_text(json.dumps(datos, indent=2), encoding='utf-8')
            if not ES_WINDOWS:
                try:
                    os.chmod(SECRETS_FILE, 0o600)
                except Exception:
                    pass
            log(f'Secretos guardados en {SECRETS_FILE.name}')
        except Exception as e:
            warn(f'No pude guardar secretos: {e}')

    for k, v in datos.items():
        os.environ.setdefault(k, v)

    return datos


# ==================== VERIFICACIONES ====================
def check_node():
    import shutil
    if not shutil.which('node'):
        err('Node.js no está instalado o no está en el PATH.')
        print('  Descárgalo en: https://nodejs.org  (versión LTS)')
        sys.exit(1)
    try:
        v = subprocess.check_output(['node', '--version'], text=True).strip()
        log(f'Node.js detectado: {v}')
    except Exception as e:
        err(f'No pude ejecutar Node.js: {e}')
        sys.exit(1)


def check_archivos():
    requeridos = ['servidor-local.js', 'package.json', 'public/index.html']
    faltantes = [f for f in requeridos if not (RAIZ / f).exists()]
    if faltantes:
        err(f'Faltan archivos críticos: {", ".join(faltantes)}')
        sys.exit(1)


def puerto_libre(puerto):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(('127.0.0.1', puerto))
            return True
        except OSError:
            return False


def esperar_servidor(url, timeout):
    inicio = time.time()
    while time.time() - inicio < timeout:
        try:
            with urllib.request.urlopen(url, timeout=2) as r:
                if r.status < 500:
                    return True
        except Exception:
            pass
        time.sleep(0.4)
    return False


# ==================== SERVIDOR EN HILO ====================
servidor_proc = [None]

def arrancar_servidor():
    """Lanza servidor-local.js en un subproceso."""
    env = os.environ.copy()
    env['ANIA_MODO'] = 'local'
    env['PORT'] = str(PUERTO_WEB)

    kwargs = dict(
        cwd=str(RAIZ),
        shell=ES_WINDOWS,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        encoding='utf-8',
        errors='replace',
        env=env,
    )
    if ES_WINDOWS:
        kwargs['creationflags'] = subprocess.CREATE_NEW_PROCESS_GROUP
    else:
        kwargs['start_new_session'] = True

    p = subprocess.Popen(['node', 'servidor-local.js'], **kwargs)
    servidor_proc[0] = p

    # Reenviar salida a la consola con prefijo
    def bombear():
        try:
            for linea in p.stdout:
                linea = linea.rstrip()
                if linea:
                    try:
                        print(f'{C.GRIS}[ANIA]{C.FIN} {linea}')
                    except UnicodeEncodeError:
                        print(f'[ANIA] {linea.encode("ascii", "replace").decode()}')
        except Exception:
            pass
    threading.Thread(target=bombear, daemon=True).start()
    return p


def detener_servidor():
    """Mata el servidor Node.js y todo su árbol."""
    p = servidor_proc[0]
    if not p or p.poll() is not None:
        return
    try:
        if ES_WINDOWS:
            subprocess.run(['taskkill', '/F', '/T', '/PID', str(p.pid)],
                           capture_output=True, check=False)
        else:
            try:
                os.killpg(os.getpgid(p.pid), signal.SIGTERM)
            except Exception:
                p.terminate()
            try:
                p.wait(timeout=3)
            except subprocess.TimeoutExpired:
                try:
                    os.killpg(os.getpgid(p.pid), signal.SIGKILL)
                except Exception:
                    p.kill()
    except Exception:
        try:
            p.kill()
        except Exception:
            pass


# ==================== MAIN ====================
def main():
    # 1. Verificar archivos y Node
    check_archivos()
    check_node()

    # 2. Cargar/generar secretos
    secretos = cargar_o_crear_secretos()

    # 3. Verificar puerto
    if not puerto_libre(PUERTO_WEB):
        err(f'El puerto {PUERTO_WEB} está ocupado. Cierra lo que lo use.')
        sys.exit(1)

    # 4. Arrancar servidor Node.js
    log('Arrancando servidor local...')
    arrancar_servidor()

    # 5. Esperar a que responda
    log(f'Esperando a {URL} ...')
    if not esperar_servidor(URL + '/ania/health', TIMEOUT_ARRANQUE):
        err('El servidor no respondió a tiempo.')
        detener_servidor()
        sys.exit(1)
    log('Servidor listo ✓')

    # 6. Decidir modo
    usar_browser = '--browser' in sys.argv
    debug = '--debug' in sys.argv
    fullscreen = '--fullscreen' in sys.argv

    if usar_browser:
        # Fallback: abrir en navegador
        import webbrowser
        log('Abriendo en el navegador...')
        webbrowser.open(URL)
        try:
            while True:
                time.sleep(1)
                if servidor_proc[0] and servidor_proc[0].poll() is not None:
                    err('El servidor terminó.')
                    break
        except KeyboardInterrupt:
            pass
        finally:
            detener_servidor()
        return

    # 7. Ventana nativa con pywebview
    try:
        import webview
    except ImportError:
        err('pywebview no está instalado.')
        print('  Instálalo con: pip install pywebview')
        print('  O ejecuta con --browser para usar el navegador.')
        detener_servidor()
        sys.exit(1)

    log('Abriendo ventana nativa...')

    window = webview.create_window(
        title='ANIA · Núcleo Personal',
        url=URL,
        width=1280,
        height=820,
        min_size=(900, 600),
        background_color='#040806',
        fullscreen=fullscreen,
        text_select=True,
    )

    def on_closed():
        log('Ventana cerrada. Deteniendo servidor...')
        detener_servidor()

    window.events.closed += on_closed

    # 8. Iniciar GUI (bloqueante hasta cerrar)
    try:
        webview.start(debug=debug)
    except KeyboardInterrupt:
        pass
    finally:
        detener_servidor()
        log('ANIA detenida. ¡Hasta la próxima!')


if __name__ == '__main__':
    signal.signal(signal.SIGINT, lambda *a: (detener_servidor(), sys.exit(0)))
    if hasattr(signal, 'SIGTERM'):
        signal.signal(signal.SIGTERM, lambda *a: (detener_servidor(), sys.exit(0)))
    main()