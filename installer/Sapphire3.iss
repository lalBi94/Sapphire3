; Installateur Windows de Sapphire 3.
; Construit par scripts/build-installer.mjs avec ISCC.exe.
; Installation par utilisateur : aucun droit administrateur requis.

#ifndef AppVersion
  #define AppVersion "0.1.0"
#endif
#ifndef AppVersionNumeric
  #define AppVersionNumeric "0.1.0.0"
#endif
#ifndef StagingDir
  #define StagingDir "..\build\release\Sapphire3-windows"
#endif
#ifndef OutputDir
  #define OutputDir "..\build\release"
#endif

#define AppName "Sapphire 3"
#define AppExe "Sapphire3.exe"
#define AppPublisher "Sapphire 3 contributors"
#define AppUrl "https://github.com/lalBi94/Sapphire3"

[Setup]
AppId={{6C0E7B2A-9F4D-4E1B-9C2A-3D5F7A8B1C90}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppUrl}
AppSupportURL={#AppUrl}/issues
AppUpdatesURL={#AppUrl}/releases
VersionInfoVersion={#AppVersionNumeric}
VersionInfoDescription={#AppName} installer
VersionInfoProductName={#AppName}
DefaultDirName={localappdata}\Programs\Sapphire 3
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
OutputDir={#OutputDir}
OutputBaseFilename=Sapphire3-{#AppVersion}-windows-setup
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
CloseApplications=yes
RestartApplications=no
LicenseFile=..\LICENSE
UninstallDisplayName={#AppName}
UninstallDisplayIcon={app}\{#AppExe}
DisableWelcomePage=no
AllowNoIcons=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "french"; MessagesFile: "compiler:Languages\French.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "{#StagingDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\{#AppExe}"
Name: "{group}\{cm:UninstallProgram,{#AppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExe}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#AppExe}"; Description: "{cm:LaunchProgram,{#StringChange(AppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; Les fichiers du programme sont retirés par l'installateur. Les données utilisateur,
; préférences et fichiers .sp3 enregistrés ailleurs ne sont jamais supprimés.

[Code]
// Vérifie la présence du runtime WebView2 avant de copier l'application.
function WebView2Present(): Boolean;
begin
  Result :=
    DirExists(ExpandConstant('{pf32}\Microsoft\EdgeWebView\Application')) or
    DirExists(ExpandConstant('{pf64}\Microsoft\EdgeWebView\Application')) or
    DirExists(ExpandConstant('{localappdata}\Microsoft\EdgeWebView\Application'));
end;

// Avertit sans bloquer : l'utilisateur peut installer WebView2 puis relancer Sapphire 3.
procedure InitializeWizard();
begin
  if not WebView2Present() then
  begin
    MsgBox(
      'Microsoft Edge WebView2 is required to run Sapphire 3.' + #13#10 + #13#10 +
      'Install the Evergreen WebView2 Runtime from Microsoft, then start Sapphire 3.',
      mbInformation, MB_OK);
  end;
end;
