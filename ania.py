#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ANIA · Lanzador local todo-en-uno
Arranca el servidor web + el agente PC y abre la app en el navegador.

Uso:
    python ania.py               → instala si hace falta y arranca (modo local)
    python ania.py --no-install  → arranca sin instalar (ya tienes node_modules)
    python ania.py --no-agent    → arranca sin el agente PC
    python ania.py --cloud       → usa GitHub como persistencia (requiere GITHUB_TOKEN)

Requiere: Python 3.8+ y Node.js 18+
"""

import os
import sys
import json
import time
import socket
import signal
import shutil
import base64
import secrets
import subprocess
import threading
import webbrowser
import urllib.request
from pathlib import Path

# ==================== CONFIG ====================
RAIZ = Path(__file__).parent.resolve()
PUERTO_WEB = int(os.environ.get('ANIA_PORT_WEB', '10000'))
PUERTO_AGENTE = int(os.environ.get('ANIA_PORT_AGENT', '8765'))
URL = f'http://localhost:{PUERTO_WEB}'
TIMEOUT_ARRANQUE = 30
SECRETS_FILE = RAIZ / '.ania-secrets.json'

ES_WINDOWS = os.name == 'nt'

# Forzar UTF-8 en consola Windows (evita UnicodeEncodeError con emojis y acentos)
if ES_WINDOWS:
    try:
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
    except Exception:
        pass
    try:
        os.system('')  # habilita secuencias ANSI en cmd.exe antiguo
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


# ==================== VERIFICACIONES ====================
def check_node():
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


def check_npm():
    if not (shutil.which('npm') or shutil.which('npm.cmd')):
        err('npm no está disponible.')
        sys.exit(1)


def check_archivos():
    """Verifica que los archivos críticos existan antes de intentar arrancar."""
    requeridos = ['servidor.js', 'package.json', 'public/index.html']
    faltantes = [f for f in requeridos if not (RAIZ / f).exists()]
    if faltantes:
        err(f'Faltan archivos críticos: {", ".join(faltantes)}')
        print('  Asegúrate de ejecutar ania.py desde la raíz del proyecto.')
        sys.exit(1)
    # Aviso si falta el módulo de persistencia local
    if not (RAIZ / 'persistencia-local.js').exists():
        warn('No encuentro persistencia-local.js — el modo local no funcionará.')
        warn('Créalo o usa: python ania.py --cloud')


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
        time.sleep(0.5)
    return False


# ==================== SECRETOS ====================
def cargar_o_crear_secretos():
    """
    Carga los secretos desde .ania-secrets.json o los genera y los persiste.
    Así, reiniciar ania.py NO invalida los datos cifrados previamente.
    Respeta variables de entorno ya definidas por el usuario.
    """
    datos = {}
    if SECRETS_FILE.exists():
        try:
            datos = json.loads(SECRETS_FILE.read_text(encoding='utf-8'))
        except Exception as e:
            warn(f'No pude leer {SECRETS_FILE.name}: {e}')
            warn('Regenerando secretos (los datos cifrados previos quedarán ilegibles).')
            datos = {}

    generadores = {
        'ANIA_SECRET':       lambda: base64.b64encode(secrets.token_bytes(48)).decode(),
        'ANIA_TOKEN_SECRET': lambda: base64.b64encode(secrets.token_bytes(48)).decode(),
        'ANIA_TOKEN':        lambda: secrets.token_hex(16),
    }

    cambiado = False
    for k, gen in generadores.items():
        # Si ya está en el entorno, respetamos ese valor
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

    # Exportar al entorno sin sobreescribir lo que ya exista
    for k, v in datos.items():
        os.environ.setdefault(k, v)

    return datos


# ==================== INSTALACIÓN ====================
def instalar_deps(carpeta, no_install):
    carpeta = Path(carpeta)
    node_modules = carpeta / 'node_modules'
    package_json = carpeta / 'package.json'

    if not package_json.exists():
        warn(f'Sin package.json en {carpeta.name}, se omite')
        return True

    if node_modules.exists() and any(node_modules.iterdir()):
        log(f'Dependencias ya instaladas en {carpeta.name}/')
        return True

    if no_install:
        warn(f'Faltan dependencias en {carpeta.name}/ y usaste --no-install')
        return False

    log(f'Instalando dependencias en {carpeta.name}/ (necesita internet)...')
    try:
        subprocess.check_call(
            ['npm', 'install'],
            cwd=str(carpeta),
            shell=ES_WINDOWS,
        )
        log(f'Dependencias de {carpeta.name}/ listas')
        return True
    except subprocess.CalledProcessError as e:
        err(f'Fallo al instalar en {carpeta.name}/: {e}')
        return False


# ==================== PROCESOS ====================
procesos = []
_saliendo = False


def lanzar(cmd, cwd, nombre, env_extra=None):
    env = os.environ.copy()
    if env_extra:
        env.update(env_extra)
    try:
        kwargs = dict(
            cwd=str(cwd),
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
            # Grupo de procesos nuevo → podemos matar el árbol entero con taskkill /T
            kwargs['creationflags'] = subprocess.CREATE_NEW_PROCESS_GROUP
        else:
            # Sesión propia → podemos usar os.killpg
            kwargs['start_new_session'] = True

        p = subprocess.Popen(cmd, **kwargs)
        procesos.append((p, nombre))
        return p
    except Exception as e:
        err(f'No pude lanzar {nombre}: {e}')
        return None


def bombear_salida(proceso, prefijo):
    """Lee la salida del proceso y la reimprime prefijada."""
    try:
        for linea in proceso.stdout:
            linea = linea.rstrip()
            if not linea:
                continue
            try:
                print(f'{C.GRIS}[{prefijo}]{C.FIN} {linea}')
            except UnicodeEncodeError:
                print(f'[{prefijo}] {linea.encode("ascii", "replace").decode()}')
    except Exception:
        pass


def matar_arbol(p, timeout=3):
    """Mata un proceso y todos sus hijos, funcionando en Windows y Unix."""
    if p.poll() is not None:
        return
    try:
        if ES_WINDOWS:
            # taskkill /T mata el árbol completo
            subprocess.run(
                ['taskkill', '/F', '/T', '/PID', str(p.pid)],
                capture_output=True, check=False,
            )
        else:
            # Grupo de sesión nuevo → mandamos señal a todo el grupo
            try:
                os.killpg(os.getpgid(p.pid), signal.SIGTERM)
            except Exception:
                p.terminate()
            try:
                p.wait(timeout=timeout)
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


def parar_todo(sig=None, frame=None):
    global _saliendo
    if _saliendo:
        return
    _saliendo = True
    print()
    log('Deteniendo Ania...')
    for p, nombre in procesos:
        matar_arbol(p)
    log('Ania detenida. ¡Hasta la próxima!')
    sys.exit(0)


# ==================== MAIN ====================
def main():
    print()
    print(f'{C.VERDE}{C.NEGRITA}')
    print('    ╔══════════════════════════════════════╗')
    print('    ║      ANIA · Lanzador local           ║')
    print('    ║      Pan, café y anime.              ║')
    print('    ╚══════════════════════════════════════╝')
    print(f'{C.FIN}')

    no_install = '--no-install' in sys.argv
    no_agent   = '--no-agent'   in sys.argv
    cloud      = '--cloud'      in sys.argv

    # 1. Verificar archivos críticos
    check_archivos()

    # 2. Cargar/generar secretos (persisten entre ejecuciones)
    secretos = cargar_o_crear_secretos()

    # 3. Modo de persistencia
    if cloud:
        if not os.environ.get('GITHUB_TOKEN'):
            err('--cloud requiere la variable GITHUB_TOKEN definida.')
            sys.exit(1)
        os.environ['ANIA_MODO'] = 'nube'
    else:
        os.environ.setdefault('ANIA_MODO', 'local')

    modo = os.environ.get('ANIA_MODO', 'local').upper()
    log(f'Modo de persistencia: {modo}')

    # 4. Node y npm
    check_node()
    check_npm()

    # 5. Verificar puertos
    if not puerto_libre(PUERTO_WEB):
        err(f'El puerto {PUERTO_WEB} está ocupado. Cierra lo que lo use.')
        sys.exit(1)
    if not no_agent and not puerto_libre(PUERTO_AGENTE):
        warn(f'El puerto {PUERTO_AGENTE} está ocupado. Sigo sin el agente.')
        no_agent = True

    # 6. Instalar dependencias
    if not instalar_deps(RAIZ, no_install):
        sys.exit(1)
    if not no_agent:
        if not instalar_deps(RAIZ / 'agente', no_install):
            warn('El agente no se instalará. Sigo sin él.')
            no_agent = True

    # 7. Arrancar servidor web
    log('Arrancando servidor web...')
    servidor = lanzar(['node', 'servidor.js'], RAIZ, 'servidor')
    if not servidor:
        sys.exit(1)
    threading.Thread(target=bombear_salida, args=(servidor, 'ANIA'), daemon=True).start()

    # 8. Arrancar agente PC (con el token inyectado explícitamente)
    if not no_agent:
        log('Arrancando agente PC...')
        agente = lanzar(
            ['node', 'ania-agent.js'],
            RAIZ / 'agente',
            'agente',
            env_extra={
                'ANIA_TOKEN': secretos['ANIA_TOKEN'],
                'ANIA_PORT': str(PUERTO_AGENTE),
            },
        )
        if agente:
            threading.Thread(target=bombear_salida, args=(agente, 'AGENTE'), daemon=True).start()

    # 9. Esperar a que el servidor responda
    log(f'Esperando a {URL} ...')
    if esperar_servidor(URL + '/ania/health', TIMEOUT_ARRANQUE):
        log('Servidor listo ✓')
    else:
        warn('El servidor tarda más de lo esperado, abro el navegador igual')

    # 10. Abrir navegador
    log(f'Abriendo {URL} en el navegador...')
    try:
        webbrowser.open(URL)
    except Exception:
        warn(f'Abre manualmente en tu navegador: {URL}')

    # 11. Info útil al usuario
    print()
    print(f'{C.CIAN}╔════════════════════════════════════════════════════════╗{C.FIN}')
    print(f'{C.CIAN}║{C.FIN}  ANIA está en marcha. Pulsa {C.NEGRITA}Ctrl+C{C.FIN} para detenerla.  {C.CIAN}║{C.FIN}')
    print(f'{C.CIAN}╚════════════════════════════════════════════════════════╝{C.FIN}')

    if not no_agent:
        print()
        print(f'{C.AMBAR}⚠  Token del agente PC:{C.FIN}')
        print(f'   {C.NEGRITA}{secretos["ANIA_TOKEN"]}{C.FIN}')
        print(f'   Si el agente no se conecta automáticamente, abre la consola')
        print(f'   del navegador (F12) y ejecuta:')
        print(f'   {C.GRIS}store.set("agentToken", "{secretos["ANIA_TOKEN"]}"){C.FIN}')
        print()

    if modo == 'LOCAL':
        print(f'{C.GRIS}   Modo LOCAL: los datos se guardan cifrados en ./datos/{C.FIN}')
        print(f'{C.GRIS}   Borrar {SECRETS_FILE.name} invalida todo lo cifrado.{C.FIN}')
    else:
        print(f'{C.GRIS}   Modo NUBE: los datos se guardan cifrados en tu repo GitHub.{C.FIN}')
    print()

    # 12. Loop principal — detectar muerte de procesos
    try:
        while True:
            time.sleep(1)
            for p, nombre in list(procesos):
                if p.poll() is not None:
                    err(f'El proceso {nombre} ha terminado inesperadamente')
                    parar_todo()
    except KeyboardInterrupt:
        parar_todo()


if __name__ == '__main__':
    signal.signal(signal.SIGINT, parar_todo)
    if hasattr(signal, 'SIGTERM'):
        signal.signal(signal.SIGTERM, parar_todo)
    main()
