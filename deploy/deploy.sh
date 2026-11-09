#!/usr/bin/env bash
# 一键发版：本机编译后端二进制 + 构建前端，打包传到服务器，在服务器上 docker compose 重启。
#
# 用法（仓库根目录）：
#   deploy/deploy.sh                 # 部署当前 HEAD，工作区必须干净
#   DEPLOY_HOST=api@1.2.3.4 deploy/deploy.sh
#
# 服务器需要先装好 docker 和 compose 插件（见 deploy/README.md）。
# 远端用 sudo 执行 remote.sh，会提示输入 sudo 密码。
set -euo pipefail

DEPLOY_HOST=${DEPLOY_HOST:-api@43.142.106.238}
REMOTE_DIR=${REMOTE_DIR:-offer-hub} # 相对远端用户的家目录
SSH=${SSH:-ssh}

ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT"

if [[ -n $(git status --porcelain -- backend frontend) ]]; then
  echo "backend/ 或 frontend/ 有未提交的改动，先提交再部署（线上版本要能对应到 commit）" >&2
  exit 1
fi
REV=$(git rev-parse --short HEAD)

STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT
echo "==> 部署 $REV，暂存目录 $STAGE"

# 后端：从 git archive 取源码编译，和工作区隔离；静态链接，服务器上的 alpine 镜像直接跑
echo "==> 编译后端"
mkdir -p "$STAGE/src" "$STAGE/out/backend"
git archive HEAD backend/src | tar -x -C "$STAGE/src"
(cd "$STAGE/src/backend/src" && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
  go build -trimpath -ldflags "-s -w" -o "$STAGE/out/backend/offer-hub" .)

# 前端：用工作区现成的 node_modules 构建（上面已确认工作区干净，等于 HEAD）
echo "==> 构建前端"
(cd frontend && npm run build >/dev/null)

echo "==> 打包"
OUT=$STAGE/out
cp deploy/docker-compose.yml deploy/config-online.toml.tmpl deploy/remote.sh deploy/backup.sh "$OUT/"
cp deploy/backend/Dockerfile "$OUT/backend/"
cp -r deploy/nginx "$OUT/nginx"
mkdir -p "$OUT/mysql-init" "$OUT/mongo-init"
cp backend/testdata/init_mysql_schema.sql "$OUT/mysql-init/"
cp backend/testdata/init_mongo_indexes.js "$OUT/mongo-init/"
cp backend/src/sensitive_words.txt "$OUT/"
cp -r frontend/dist "$OUT/frontend-dist"
echo "$REV" > "$OUT/REVISION"

echo "==> 上传到 $DEPLOY_HOST:~/$REMOTE_DIR"
tar -C "$OUT" -czf - . | $SSH "$DEPLOY_HOST" "rm -rf ~/$REMOTE_DIR/.incoming && mkdir -p ~/$REMOTE_DIR/.incoming && tar -xzf - -C ~/$REMOTE_DIR/.incoming && touch ~/$REMOTE_DIR/.incoming/.complete"

echo "==> 远端启动"
$SSH -t "$DEPLOY_HOST" "sudo bash ~/$REMOTE_DIR/.incoming/remote.sh ~/$REMOTE_DIR"
