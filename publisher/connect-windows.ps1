param([string]$GitHubCLI = '')
$ErrorActionPreference = 'Stop'
$deskRoot = Split-Path $PSScriptRoot -Parent
if (-not $GitHubCLI) { $GitHubCLI = (Get-Command gh -ErrorAction Stop).Source }
if (-not (Test-Path -LiteralPath $GitHubCLI -PathType Leaf)) { throw 'GitHub CLI not found' }
Write-Host 'INFO//DESK - connect the Windows background publisher' -ForegroundColor Cyan
Write-Host 'Run this window directly from Windows, not from an AI command sandbox.'
function Test-DeskGitHubLogin {
    $deskPreference=$ErrorActionPreference
    try {
        $ErrorActionPreference='Continue'
        & $GitHubCLI auth status --active --hostname github.com *> $null
        return ($LASTEXITCODE -eq 0)
    } finally { $ErrorActionPreference=$deskPreference }
}
if (-not (Test-DeskGitHubLogin)) {
    Write-Host 'Complete GitHub login in the browser. If asked to authenticate Git, choose N.'
    & $GitHubCLI auth login --hostname github.com --git-protocol https --web
    if ($LASTEXITCODE -ne 0) { throw 'GitHub login was not completed; publisher remains paused.' }
}
if (-not (Test-DeskGitHubLogin)) { throw 'GitHub login is not available in this Windows session.' }
& (Join-Path $PSScriptRoot 'install-task.ps1') -Paused -GitHubCLI $GitHubCLI
Push-Location $deskRoot
try {
    & py -3.14 (Join-Path $PSScriptRoot 'collect.py') --publish
    if ($LASTEXITCODE -ne 0) { throw 'Snapshot could not be published; task remains paused.' }
    & (Join-Path $PSScriptRoot 'control-task.ps1') -Action Resume
    Write-Host 'Connected. The background publisher is enabled.' -ForegroundColor Green
} finally { Pop-Location }
