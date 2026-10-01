' ania-desktop.vbs · Arranca ANIA como app de escritorio sin consola
' Uso: doble clic en este archivo
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Directorio del script (raíz del proyecto)
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Comando: pythonw ania-desktop.py (pythonw = sin consola en Windows)
comando = "pythonw """ & scriptDir & "\ania-desktop.py"""

' Ejecutar sin ventana (0 = oculto, False = no esperar)
sh.CurrentDirectory = scriptDir
sh.Run comando, 0, False