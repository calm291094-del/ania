' ania-agent.vbs · inicia el agente de Ania sin ventana negra
' Colócalo en: Win+R → shell:startup
Set sh = CreateObject("WScript.Shell")
sh.Run "node """ & Replace(WScript.ScriptFullName, "ania-agent.vbs", "ania-agent.js") & """", 0, False
