#!/bin/zsh
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
if ! command -v node >/dev/null 2>&1; then
  echo "需要 Node.js 20+。安装后重新双击这个文件。"
  read -k 1
  exit 1
fi
cd "$DIR"
echo "启动 HITOKOTO Codex Pro 通道…"
node "$DIR/server.mjs" &
PID=$!
sleep 2
open "http://127.0.0.1:43127/"
echo "\n已打开 HITOKOTO。这个窗口保持运行即可；不需要打开 Codex 界面。"
echo "关闭这个窗口或按 Ctrl+C 会停止 Pro 通道。"
wait $PID
