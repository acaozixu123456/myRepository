$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Write-Host '需要 Node.js 20+。安装后重新运行。'; Read-Host; exit 1 }
Set-Location $root
Write-Host '启动 HITOKOTO Codex Pro 通道…'
$job = Start-Process -PassThru -NoNewWindow node -ArgumentList 'local/codex-bridge/server.mjs'
Start-Sleep -Seconds 2
Start-Process 'http://127.0.0.1:43127/'
Write-Host '已打开 HITOKOTO。这个窗口保持运行即可；不需要打开 Codex 界面。'
Write-Host '按 Enter 停止 Pro 通道。'
Read-Host
Stop-Process -Id $job.Id -ErrorAction SilentlyContinue
