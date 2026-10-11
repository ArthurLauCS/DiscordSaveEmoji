[Setup]
AppId=DiscordSaveEmoji
AppName=Discord Save Emoji
AppVersion=1.0.0
AppPublisher=ArthurLauCS
AppPublisherURL=https://github.com/ArthurLauCS/DiscordSaveEmoji
DefaultDirName={localappdata}\Programs\DiscordSaveEmoji
DefaultGroupName=Discord Save Emoji
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
OutputDir=..\dist
OutputBaseFilename=DSE-Setup-1.0.0-x64
SetupIconFile=..\assets\icon.ico
UninstallDisplayIcon={app}\DSE.exe
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
AppMutex=Local\DSE.Desktop
CloseApplications=no

[Files]
Source: "..\build\app\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[InstallDelete]
Type: files; Name: "{app}\docs\saved-result.png"

[Icons]
Name: "{group}\Discord Save Emoji"; Filename: "{app}\DSE.exe"
Name: "{autodesktop}\Discord Save Emoji"; Filename: "{app}\DSE.exe"

[Registry]
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueName: "DiscordSaveEmoji"; Flags: uninsdeletevalue

[Run]
Filename: "{app}\DSE.exe"; Description: "Launch Discord Save Emoji"; Flags: nowait postinstall skipifsilent

; The user's .env and binding are outside {app}; uninstall and upgrades preserve them.
