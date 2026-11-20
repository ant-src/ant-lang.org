# Installs the ant binary for this Windows machine from the GitHub releases of ant-src/ant.
#
#   irm https://ant-lang.org/install.ps1 | iex
#
# $env:ANT_VERSION = 'vX.Y.Z' installs that release instead of the latest one.
# $env:ANT_INSTALL_DIR names the directory to install into: ~\bin by default, the directory
# install.sh uses under Git Bash. The directory is added to the user's PATH.

# Everything is in one script block, invoked as it closes, so a download cut short runs nothing.
& {
  $ErrorActionPreference = 'Stop'
  # Windows PowerShell 5.1 draws a progress bar that slows downloads many times over.
  $ProgressPreference = 'SilentlyContinue'
  # Windows PowerShell 5.1 can default to TLS 1.0, which GitHub refuses.
  [Net.ServicePointManager]::SecurityProtocol =
    [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

  $repo = 'ant-src/ant'
  $version = if ($env:ANT_VERSION) { $env:ANT_VERSION } else { 'latest' }

  # The machine value is the native architecture, also from an x64 PowerShell on an ARM64 machine.
  $arch = switch ([Environment]::GetEnvironmentVariable('PROCESSOR_ARCHITECTURE', 'Machine')) {
    'AMD64' { 'amd64' }
    'ARM64' { 'arm64' }
    default { throw "Unsupported architecture: $_" }
  }

  $dir = if ($env:ANT_INSTALL_DIR) { $env:ANT_INSTALL_DIR } else { Join-Path $HOME 'bin' }
  $asset = "ant_windows_$arch.exe"

  if ($version -eq 'latest') {
    $url = "https://github.com/$repo/releases/latest/download/$asset"
  } else {
    $url = "https://github.com/$repo/releases/download/$version/$asset"
  }

  $tmp = Join-Path ([IO.Path]::GetTempPath()) ([IO.Path]::GetRandomFileName())
  try {
    Write-Host "Downloading $asset ($version)"
    Invoke-WebRequest $url -OutFile $tmp -UseBasicParsing

    $target = Join-Path $dir 'ant.exe'
    New-Item -ItemType Directory -Force $dir | Out-Null
    Move-Item -Force $tmp $target
  } finally {
    Remove-Item -Force -ErrorAction SilentlyContinue $tmp
  }
  Write-Host "Installed $target"

  # Read and write the registry value as stored, so entries such as %USERPROFILE%\... stay unexpanded.
  $key = Get-Item 'HKCU:\Environment'
  $path = $key.GetValue('Path', '', 'DoNotExpandEnvironmentNames')
  $entries = @($path -split ';' | Where-Object { $_ })
  if ($entries -notcontains $dir) {
    $kind = if ($path) { $key.GetValueKind('Path') } else { 'ExpandString' }
    Set-ItemProperty 'HKCU:\Environment' Path (($entries + $dir) -join ';') -Type $kind
    # Setting a variable through .NET tells running programs that the environment changed, so
    # terminals opened from now on see the new PATH without signing out.
    [Environment]::SetEnvironmentVariable('ANT_INSTALL_PATH_CHANGED', '1', 'User')
    [Environment]::SetEnvironmentVariable('ANT_INSTALL_PATH_CHANGED', $null, 'User')
    Write-Host "Added $dir to your PATH"
  }
  if (($env:Path -split ';') -notcontains $dir) {
    $env:Path = "$dir;$env:Path"
  }

  # New terminals search the system PATH before the user's, so an ant there, such as Apache Ant,
  # runs instead of this one.
  $first = $null
  $dirs = ([Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
    [Environment]::GetEnvironmentVariable('Path', 'User')) -split ';' | Where-Object { $_ }
  foreach ($d in $dirs) {
    foreach ($ext in $env:PATHEXT -split ';') {
      $file = "$($d.TrimEnd('\'))\ant$ext"
      if (!$first -and (Test-Path -LiteralPath $file -PathType Leaf -ErrorAction SilentlyContinue)) {
        $first = $file
      }
    }
  }
  if ($first -and $first -ne $target) {
    Write-Warning "New terminals run $first for 'ant': it comes first on PATH. Run $target, or remove the other one from PATH."
  }
}
