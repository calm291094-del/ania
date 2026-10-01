#!/usr/bin/env bash
# ania-desktop.sh · Arranca ANIA como app de escritorio
# Uso: ./ania-desktop.sh

cd "$(dirname "$0")"
python3 ania-desktop.py "$@"