#!/usr/bin/env bash
# 每日备份 MySQL 和 MongoDB，保留最近 7 天。由 /etc/cron.d/offer-hub-backup 以 root 每天 04:30 执行
# （remote.sh 每次部署时安装）。手动执行：sudo bash ~/offer-hub/backup.sh
#
# 备份放在本机 /home/api/offer-hub-backups/<日期>/，只防误删、误改数据，防不了整台机器坏掉；
# 重要的话定期把这个目录拷到别处。
# Redis 里只有限流计数和登出黑名单，丢了无所谓，不备份。
#
# 恢复：
#   gunzip -c mysql.sql.gz | docker compose exec -T mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" offer_hub'
#   docker compose exec -T mongo sh -c 'mongorestore -u root -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --archive --gzip --drop' < mongo.archive.gz
set -euo pipefail

DIR=$(cd "$(dirname "$0")" && pwd)
BACKUP_ROOT=/home/api/offer-hub-backups
KEEP_DAYS=7
cd "$DIR"

OUT=$BACKUP_ROOT/$(date +%F)
mkdir -p "$OUT"
chmod 700 "$BACKUP_ROOT" "$OUT"

# 密码用容器自己的环境变量，不出现在宿主机的命令行里
docker compose exec -T mysql sh -c \
  'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines --triggers offer_hub 2>/dev/null' \
  | gzip > "$OUT/mysql.sql.gz.tmp"
mv "$OUT/mysql.sql.gz.tmp" "$OUT/mysql.sql.gz"

docker compose exec -T mongo sh -c \
  'mongodump -u root -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --db offer_hub --archive --gzip --quiet' \
  > "$OUT/mongo.archive.gz.tmp"
mv "$OUT/mongo.archive.gz.tmp" "$OUT/mongo.archive.gz"

# 空文件说明导出失败了（比如容器没起来），报错退出，cron 日志里能看到
for f in mysql.sql.gz mongo.archive.gz; do
  [[ $(stat -c %s "$OUT/$f") -gt 100 ]] || { echo "backup $f is empty" >&2; exit 1; }
done

find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -mtime +$KEEP_DAYS -exec rm -rf {} +
echo "$(date '+%F %T') backup ok: $(du -sh "$OUT" | cut -f1) $OUT"
