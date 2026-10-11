param([string]$Iscc = "${env:ProgramFiles(x86)}/Inno Setup 6/ISCC.exe", [switch]$SkipInstaller)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot)
$root = (Get-Location).Path
$build = Join-Path $root 'build'
$app = Join-Path $build 'app'
if (Test-Path $build) {
    $resolved = (Resolve-Path -LiteralPath $build).Path
    if ($resolved -ne (Join-Path $root 'build')) { throw 'Unexpected build directory' }
    Remove-Item -LiteralPath $resolved -Recurse -Force
}
New-Item -ItemType Directory -Force $app,"$app/runtime","$app/assets" | Out-Null
node windows/build-help.mjs
if ($LASTEXITCODE -ne 0) { throw 'Help build failed' }
# Explicit allowlist: never copy .env, saved binding, logs, or private screenshots.
Copy-Item bot.js,app.js,config.js,emoji.js,save.js,i18n.js,package.json,package-lock.json,.env.example -Destination $app
Copy-Item locales,docs -Destination $app -Recurse
Copy-Item assets/icon.png -Destination "$app/assets"
npm ci --omit=dev --prefix $app --ignore-scripts
if ($LASTEXITCODE -ne 0) { throw 'Dependency install failed' }
$node = (Get-Command node).Source
Copy-Item $node -Destination "$app/runtime/node.exe"
$version = (& $node --version)
Invoke-WebRequest "https://raw.githubusercontent.com/nodejs/node/$version/LICENSE" -OutFile "$app/runtime/LICENSE.txt"
Add-Type -AssemblyName System.Drawing
$bitmap = [System.Drawing.Bitmap]::new((Join-Path $root 'assets/icon.png'))
$small = [System.Drawing.Bitmap]::new($bitmap, [System.Drawing.Size]::new(64,64))
$icon = [System.Drawing.Icon]::FromHandle($small.GetHicon())
$stream = [IO.File]::Create((Join-Path $root 'assets/icon.ico'))
$icon.Save($stream); $stream.Dispose(); $icon.Dispose(); $small.Dispose(); $bitmap.Dispose()
Copy-Item assets/icon.ico -Destination "$app/assets"
$compiler = "$env:WINDIR/Microsoft.NET/Framework64/v4.0.30319/csc.exe"
@('/nologo','/target:winexe','/platform:x64','/optimize+',
    '/reference:System.Windows.Forms.dll','/reference:System.Drawing.dll','/reference:System.Web.Extensions.dll',
    ('/out:"' + (Join-Path $app 'DSE.exe') + '"'),
    ('/win32icon:"' + (Join-Path $root 'assets\icon.ico') + '"'),
    ('"' + (Join-Path $root 'windows\Desktop.cs') + '"')) | Set-Content "$build/compile.rsp" -Encoding utf8
& $compiler "@$build/compile.rsp"
if ($LASTEXITCODE -ne 0) { throw 'Desktop build failed' }
Copy-Item README.md,README.en.md,README.zh-TW.md,TESTING.md -Destination $app
node windows/verify-package.mjs $app
if ($LASTEXITCODE -ne 0) { throw 'Package verification failed' }
if ($SkipInstaller) { return }
& $Iscc /Qp windows/installer.iss
if ($LASTEXITCODE -ne 0) { throw 'Installer build failed' }
Get-FileHash dist/DSE-Setup-1.0.0-x64.exe -Algorithm SHA256 | ForEach-Object { "$($_.Hash.ToLower())  DSE-Setup-1.0.0-x64.exe" } | Set-Content dist/SHA256SUMS.txt -Encoding ascii
