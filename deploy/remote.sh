#!/usr/bin/env bash
# 服务器端：把 .incoming 里的新版本换进部署目录，生成密码和配置，docker compose 启动。
# 由 deploy.sh 以 root 调用：sudo bash <dir>/.incoming/remote.sh <dir>
set -euo pipefail

DIR=${1:?usage: remote.sh <deploy dir>}
IN=$DIR/.incoming
cd "$DIR"

# 上传中断时 .incoming 是半截的，不能拿来替换线上文件；deploy.sh 解包成功后才写 .complete
if [[ ! -f $IN/.complete ]]; then
  echo "$IN 不完整（没有 .complete），重新执行 deploy.sh 上传" >&2
  exit 1
fi

# 1. 新文件换进来。.env、config-online.toml、certs 只在服务器上，不动。
# 这些文件和目录大多 bind mount 进了容器，bind mount 绑的是 inode：rm/mv 换掉之后容器里还是旧的（或已删除的）那份。
# 所以文件用 cat > 原地覆盖，目录先清空内容再拷进去，inode 保持不变
for f in docker-compose.yml config-online.toml.tmpl remote.sh backup.sh sensitive_words.txt REVISION; do
  cat "$IN/$f" > "$f"
done
for d in backend nginx mysql-init mongo-init frontend-dist; do
  mkdir -p "$d"
  find "$d" -mindepth 1 -delete
  cp -a "$IN/$d/." "$d/"
done
rm -rf "$IN" frontend-dist.old

# 2. 首次部署：随机生成密码。hex 字符串，放进 DSN、URI 不用转义
if [[ ! -f .env ]]; then
  echo "==> 生成 .env"
  umask 077
  {
    echo "MYSQL_ROOT_PASSWORD=$(openssl rand -hex 24)"
    echo "MONGO_ROOT_PASSWORD=$(openssl rand -hex 24)"
    echo "REDIS_PASSWORD=$(openssl rand -hex 24)"
    echo "JWT_SECRET=$(openssl rand -hex 32)"
  } > .env
fi
chmod 600 .env

# 3. 每次都从模板重新生成后端配置，模板改了随发版生效
set -a; . ./.env; set +a
sed -e "s/__MYSQL_ROOT_PASSWORD__/$MYSQL_ROOT_PASSWORD/" \
    -e "s/__MONGO_ROOT_PASSWORD__/$MONGO_ROOT_PASSWORD/" \
    -e "s/__REDIS_PASSWORD__/$REDIS_PASSWORD/" \
    -e "s/__JWT_SECRET__/$JWT_SECRET/" \
    config-online.toml.tmpl > config-online.toml
# 容器里后端以 uid 10001 运行，要能读
chown 10001 config-online.toml && chmod 400 config-online.toml

# 4. 证书：没有 Cloudflare Origin 证书时先放一张自签的，让 nginx 能起来（此时 Cloudflare 只能用 Full，不能 strict）
mkdir -p certs
if [[ ! -f certs/origin.pem ]]; then
  echo "==> 没有 certs/origin.pem，生成临时自签证书"
  openssl req -x509 -nodes -newkey rsa:2048 -days 30 -subj "/CN=offer-hub.top" \
    -keyout certs/origin.key -out certs/origin.pem 2>/dev/null
fi
chmod 600 certs/origin.key

# 5. 启动。backend 镜像每次重建（二进制变了）
echo "==> docker compose up"
docker compose up -d --build --remove-orphans
docker compose exec -T nginx nginx -s reload >/dev/null 2>&1 || true

# 6. MongoDB 列表查询索引（脚本幂等，只建不删）
echo "==> MongoDB 索引"
docker compose exec -T mongo mongosh --quiet -u root -p "$MONGO_ROOT_PASSWORD" \
  --authenticationDatabase admin "mongodb://127.0.0.1:27017/offer_hub" /mongo-init/init_mongo_indexes.js | tail -1

# 7. 每日备份（见 backup.sh）
echo "30 4 * * * root bash $DIR/backup.sh >> /var/log/offer-hub-backup.log 2>&1" > /etc/cron.d/offer-hub-backup
chmod 644 /etc/cron.d/offer-hub-backup

docker image prune -f >/dev/null
echo "==> 已部署 $(cat REVISION)"
docker compose ps --format 'table {{.Service}}\t{{.Status}}'
