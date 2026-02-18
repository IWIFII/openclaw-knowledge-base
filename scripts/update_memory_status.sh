#!/usr/bin/env bash
set -euo pipefail

WORKSPACE="/root/.openclaw/workspace"
REPO="$WORKSPACE/assistant-kit-sanitized"
cd "$REPO"

NOW=$(date -u '+%Y-%m-%d %H:%M UTC')
MEMORY_FILE="$WORKSPACE/MEMORY.md"
MEMORY_DIR="$WORKSPACE/memory"

if [ -f "$MEMORY_FILE" ]; then
  MEMORY_EXISTS="是"
else
  MEMORY_EXISTS="否"
fi

if [ -d "$MEMORY_DIR" ]; then
  LOG_COUNT=$(find "$MEMORY_DIR" -maxdepth 1 -type f -name '20*.md' | wc -l | tr -d ' ')
else
  LOG_COUNT=0
fi

cat > MEMORY_STATUS.md <<EOF2
# 记忆维护状态（自动更新）

本文件用于记录本地记忆维护任务的执行状态（脱敏）。

## 最近一次维护

- 状态：已执行
- 时间：$NOW
- 说明：仅同步维护状态，不同步原始记忆内容。

## 统计

- memory 日志文件数量：$LOG_COUNT
- MEMORY.md 是否存在：$MEMORY_EXISTS
EOF2

git add MEMORY_STATUS.md
if ! git diff --cached --quiet; then
  git commit -m "chore: 自动更新记忆维护状态"
  git push origin master
fi
