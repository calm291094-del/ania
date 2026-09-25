#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ANIA · Lanzador local todo-en-uno
Arranca el servidor web + el agente PC y abre la app en el navegador.

Uso:
    python ania.py               → instala si hace falta y arranca
    python ania.py --no-install  → arranca sin instalar (ya tienes node_modules)
    python ania.py --no-agent    → arranca sin el agente PC

Requiere: Python 3.8+ y Node.js 18+
"""

import os
import sys
import time
import socket
import signal
import shutil
import subprocess
import threading
import webbrowser
import urllib.request
from pathlib import Path

# ==================== CONFIG ====================
RAIZ = Path(__file__).parent.resolve()
PUERTO_WEB = 10000
PUERTO_AGENTE = 8765
URL = f'http://localhost:{PUERTO_WEB}'
TIMEOUT_ARRANQUE = 30

# ==================== COLORES ====================
class C:
    VERDE   = '\033[92m'
    AMBAR   = '\033[93m'
    ROJO    = '\033[91m'
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
            shell=(os.name == 'nt')
        )
        log(f'Dependencias de {carpeta.name}/ listas')
        return True
    except subprocess.CalledProcessError as e:
        err(f'Fallo al instalar en {carpeta.name}/: {e}')
        return False

# ==================== PROCESOS ====================
procesos = []

def lanzar(cmd, cwd, nombre):
    try:
        p = subprocess.Popen(
            cmd,
            cwd=str(cwd),
            shell=(os.name == 'nt'),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            encoding='utf-8',
            errors='replace'
        )
        procesos.append((p, nombre))
        return p
    except Exception as e:
        err(f'No pude lanzar {nombre}: {e}')
        return None

def bombear_salida(proceso, prefijo):
    try:
        for linea in proceso.stdout:
            linea = linea.rstrip()
            if linea:
                print(f'{C.GRIS}[{prefijo}]{C.FIN} {linea}')
    except Exception:
        pass

def parar_todo(sig=None, frame=None):
    print()
    log('Deteniendo Ania...')
    for p, nombre in procesos:
        if p.poll() is None:
            try:
                p.terminate()
                p.wait(timeout=3)
            except Exception:
                try: p.kill()
                except Exception: pass
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

    check_node()
    check_npm()

    if not puerto_libre(PUERTO_WEB):
        err(f'El puerto {PUERTO_WEB} está ocupado. Cierra lo que lo use.')
        sys.exit(1)
    if not no_agent and not puerto_libre(PUERTO_AGENTE):
        warn(f'El puerto {PUERTO_AGENTE} está ocupado. Sigo sin el agente.')
        no_agent = True

    if not instalar_deps(RAIZ, no_install):
        sys.exit(1)
    if not no_agent:
        if not instalar_deps(RAIZ / 'agente', no_install):
            warn('El agente no se instalará. Sigo sin él.')
            no_agent = True

    log('Arrancando servidor web...')
    servidor = lanzar(['node', 'servidor.js'], RAIZ, 'servidor')
    if not servidor:
        sys.exit(1)
    threading.Thread(target=bombear_salida, args=(servidor, 'ANIA'), daemon=True).start()

    if not no_agent:
        log('Arrancando agente PC...')
        agente = lanzar(['node', 'ania-agent.js'], RAIZ / 'agente', 'agente')
        if agente:
            threading.Thread(target=bombear_salida, args=(agente, 'AGENTE'), daemon=True).start()

    log(f'Esperando a {URL} ...')
    if esperar_servidor(URL + '/ania/health', TIMEOUT_ARRANQUE):
        log('Servidor listo ✓')
    else:
        warn('El servidor tarda más de lo esperado, abro el navegador igual')

    log(f'Abriendo {URL} en el navegador...')
    webbrowser.open(URL)

    print()
    log('Ania está en marcha. Pulsa Ctrl+C para detener.')
    print()

    try:
        while True:
            time.sleep(1)
            for p, nombre in list(procesos):
                if p.poll() is not None:
                    err(f'El proceso {nombre} ha terminado')
                    parar_todo()
    except KeyboardInterrupt:
        parar_todo()

if __name__ == '__main__':
    signal.signal(signal.SIGINT, parar_todo)
    if hasattr(signal, 'SIGTERM'):
        signal.signal(signal.SIGTERM, parar_todo)
    main()