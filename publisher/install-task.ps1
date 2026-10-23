param([switch]$Paused, [string]$GitHubCLI = '')
$ErrorActionPreference = 'Stop'
# Runs as the current logged-in user; no Windows password is stored.
$deskRoot = Split-Path $PSScriptRoot -Parent
if (-not $GitHubCLI) { $GitHubCLI = (Get-Command gh -ErrorAction Stop).Source }
if (-not (Test-Path -LiteralPath $GitHubCLI -PathType Leaf)) { throw 'GitHub CLI not found' }
$deskRuntime = Join-Path $env:LOCALAPPDATA 'INFO-DESK\publisher'
New-Item -ItemType Directory -Force -Path $deskRuntime | Out-Null
# Machine-specific paths are generated locally, never included in the public repo.
[System.IO.File]::WriteAllText((Join-Path $deskRuntime 'runtime.json'), (@{gh=$GitHubCLI} | ConvertTo-Json), [System.Text.UTF8Encoding]::new($false))
$deskPython = (& py -3.14 -c 'import sys; print(sys.executable)').Trim()
$deskPythonWindowless = Join-Path (Split-Path $deskPython -Parent) 'pythonw.exe'
if (-not (Test-Path -LiteralPath $deskPythonWindowless)) { throw 'Python 3.14 pythonw.exe not found' }
$deskScript = Join-Path $PSScriptRoot 'collect.py'
$deskAction = New-ScheduledTaskAction -Execute $deskPythonWindowless -Argument ('"' + $deskScript + '" --publish --scheduled') -WorkingDirectory $deskRoot
$deskTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1)
$deskSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 8) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$deskPrincipal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
$deskName = 'INFO-DESK Longbridge Market Publisher'
$existing = Get-ScheduledTask -TaskName $deskName -ErrorAction SilentlyContinue
if ($existing -and $existing.Actions.Arguments -notlike '*collect.py*') { throw 'Unrecognised task; refusing overwrite' }
Register-ScheduledTask -TaskName $deskName -Action $deskAction -Trigger $deskTrigger -Settings $deskSettings -Principal $deskPrincipal -Description 'Public market-only Longbridge snapshots; data branch only; no trading/account APIs.' -Force | Out-Null
if ($Paused) { Disable-ScheduledTask -TaskName $deskName | Out-Null }
Get-ScheduledTask -TaskName $deskName | Select-Object TaskName,State
