' Abre o iniciar-estoque.bat sem mostrar janela (usado pelo início automático do Windows).
Set sh = CreateObject("WScript.Shell")
pasta = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
sh.Run "cmd /c """ & pasta & "\iniciar-estoque.bat""", 0, False
