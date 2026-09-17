#!/bin/bash
# sync-references-to-github.sh
# 把 references/ 目录推到 GitHub 仓库的 references/ 子目录
# 用法: GH_TOKEN=ghp_xxx ./sync-references-to-github.sh [commit-message]
#
# 二次复用：下次架构文档更新后，重新跑这个脚本即可
#
# 署名策略（option C）：
#   - author = PAT 所有者（你本人）
#   - 加 trailer: Co-authored-by: 陈子卓野的工作伙伴 <noreply@joearkon.com>

set -e

REPO="joearkon/inventory-count-closure-demo"
BRANCH="main"
COMMIT_MSG="${1:-feat(references): 同步架构 + 验收 + MVP package v1}"

# AI 合作作者署名
CO_AUTHOR_NAME="陈子卓野的工作伙伴"
CO_AUTHOR_EMAIL="noreply@joearkon.com"

if [ -z "$GH_TOKEN" ]; then
  echo "❌ 错误: 请设置 GH_TOKEN 环境变量"
  echo "用法: GH_TOKEN=ghp_xxx $0 [commit-message]"
  exit 1
fi

# references 源目录（脚本同级目录下的 references/）
SRC_DIR="$(cd "$(dirname "$0")" && pwd)/references"
if [ ! -d "$SRC_DIR" ]; then
  echo "❌ 错误: 找不到 references/ 目录 ($SRC_DIR)"
  exit 1
fi

# 完整 commit message（含 trailer）
FULL_MSG="${COMMIT_MSG}

Co-authored-by: ${CO_AUTHOR_NAME} <${CO_AUTHOR_EMAIL}>"

# 找到 main 分支的最新 commit SHA
echo "🔍 查询 $REPO@$BRANCH 最新 commit..."
SHA=$(curl -sS -H "Authorization: Bearer $GH_TOKEN" \
  "https://api.github.com/repos/$REPO/git/refs/heads/$BRANCH" | \
  python3 -c "import sys,json; print(json.load(sys.stdin)['object']['sha'])")
echo "   最新 commit SHA: $SHA"

# 找到最新 commit 的 tree SHA
TREE_SHA=$(curl -sS -H "Authorization: Bearer $GH_TOKEN" \
  "https://api.github.com/repos/$REPO/git/commits/$SHA" | \
  python3 -c "import sys,json; print(json.load(sys.stdin)['tree']['sha'])")
echo "   Tree SHA: $TREE_SHA"

# 创建 blob 数组（每个文件一个 blob）
echo "📦 上传文件到 references/ 子目录..."
BLOBS_JSON="[]"
for file_path in $(cd "$SRC_DIR" && find . -type f); do
  rel_path="${file_path#./}"
  gh_path="references/$rel_path"
  full_path="$SRC_DIR/$rel_path"
  echo "   - $gh_path"

  content=$(base64 -w 0 "$full_path")

  blob_json=$(curl -sS -X POST \
    -H "Authorization: Bearer $GH_TOKEN" \
    -H "Content-Type: application/json" \
    "https://api.github.com/repos/$REPO/git/blobs" \
    -d "{\"content\":\"$content\",\"encoding\":\"base64\"}")
  blob_sha=$(echo "$blob_json" | python3 -c "import sys,json; print(json.load(sys.stdin)['sha'])")

  BLOBS_JSON=$(echo "$BLOBS_JSON" | python3 -c "
import sys, json
arr = json.loads(sys.stdin.read())
arr.append({'path': '$gh_path', 'mode': '100644', 'type': 'blob', 'sha': '$blob_sha'})
print(json.dumps(arr))
")
done

echo "🌳 创建新 tree..."
TREE_RESPONSE=$(curl -sS -X POST \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.github.com/repos/$REPO/git/trees" \
  -d "{\"base_tree\":\"$TREE_SHA\",\"tree\":$BLOBS_JSON}")
NEW_TREE_SHA=$(echo "$TREE_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['sha'])")
echo "   新 Tree SHA: $NEW_TREE_SHA"

echo "📝 创建 commit（带 AI Co-authored-by trailer）..."
COMMIT_RESPONSE=$(curl -sS -X POST \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.github.com/repos/$REPO/git/commits" \
  -d "$(python3 -c "
import json
msg = '''$FULL_MSG'''
print(json.dumps({
    'message': msg,
    'tree': '$NEW_TREE_SHA',
    'parents': ['$SHA']
}))
")")
NEW_COMMIT_SHA=$(echo "$COMMIT_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['sha'])")
echo "   新 Commit SHA: $NEW_COMMIT_SHA"

echo "🚀 推送到 $BRANCH..."
PUSH_RESPONSE=$(curl -sS -X PATCH \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.github.com/repos/$REPO/git/refs/heads/$BRANCH" \
  -d "{\"sha\":\"$NEW_COMMIT_SHA\"}")
echo "$PUSH_RESPONSE" | python3 -c "import sys,json; r=json.load(sys.stdin); print('   ✅ 推送成功:', r.get('object',{}).get('url','OK'))"

echo ""
echo "✨ 全部完成！访问 https://github.com/$REPO/tree/$BRANCH/references"
echo "📝 Commit message:"
echo "---"
echo "$FULL_MSG"
echo "---"