#!/usr/bin/env bash
set -euo pipefail

WORKSPACE="/root/.openclaw/workspace"
REPO="$WORKSPACE/assistant-kit-sanitized"
cd "$REPO"

TMP_LIST=$(mktemp)
clawhub list > "$TMP_LIST"

# 生成 Markdown 列表
SKILLS_MD=$(awk 'NF>=2 {print "- `"$1"` `"$2"`"}' "$TMP_LIST")
if [ -z "$SKILLS_MD" ]; then
  SKILLS_MD="- （暂无技能）"
fi

# 更新时间
UPDATED_AT=$(date -u '+%Y-%m-%d %H:%M UTC')

# 更新 SKILLS.md 区块
awk -v list="$SKILLS_MD" -v ts="$UPDATED_AT" '
BEGIN{inblock=0}
/<!-- SKILLS_LIST_START -->/{print; print "更新时间：" ts "\n"; print list; inblock=1; next}
/<!-- SKILLS_LIST_END -->/{inblock=0; print; next}
!inblock{print}
' SKILLS.md > SKILLS.md.tmp && mv SKILLS.md.tmp SKILLS.md

# Git 提交与推送（有变更才提交）
git add SKILLS.md
if ! git diff --cached --quiet; then
  git commit -m "chore: 自动更新技能清单"
  git push origin master
fi

rm -f "$TMP_LIST"
