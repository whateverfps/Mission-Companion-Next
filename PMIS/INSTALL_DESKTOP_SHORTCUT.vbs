Option Explicit
Dim fso, shell, appDir, desktop, shortcut, target, iconPath, launcher
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
appDir = fso.GetParentFolderName(WScript.ScriptFullName)
launcher = appDir & "\LAUNCH_MISSION_PMIS.cmd"
iconPath = appDir & "\assets\mission_pmis.ico"
desktop = shell.SpecialFolders("Desktop")
Set shortcut = shell.CreateShortcut(desktop & "\Mission PMIS.lnk")
shortcut.TargetPath = launcher
shortcut.WorkingDirectory = appDir
shortcut.WindowStyle = 7
shortcut.Description = "Mission PMIS - Engineering Operations Platform"
If fso.FileExists(iconPath) Then shortcut.IconLocation = iconPath
shortcut.Save
MsgBox "Mission PMIS desktop shortcut created.", vbInformation, "Mission PMIS"
