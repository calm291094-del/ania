import urllib.request
import os

url = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
destino = "hand_landmarker.task"

print("Descargando el modelo...")
try:
    urllib.request.urlretrieve(url, destino)
    print(f"¡Éxito! Archivo guardado como: {os.path.abspath(destino)}")
except Exception as e:
    print(f"Error al descargar: {e}")