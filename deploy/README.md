# 线上部署（offer-hub.top）

单机 Docker Compose：MySQL、MongoDB、Redis、后端、Nginx 都在服务器 `api@43.142.106.238` 的 `~/offer-hub` 下。
访问链路：浏览器 → Cloudflare（Full (strict)）→ 源站 Nginx :8443 → 后端 :8180（只在容器网络内）。

```
访客 ──HTTPS──▶ Cloudflare ──HTTPS :8443──▶ nginx ─┬─ 前端静态文件（frontend-dist）
                                                   └─ /api /auth /home ──▶ backend ──▶ mysql / mongo / redis
```

## 发版

在仓库根目录：

```bash
deploy/deploy.sh
```

本机交叉编译后端、`npm run build` 前端，打包上传到 `~/offer-hub/.incoming`，再 `sudo` 执行 `remote.sh`：
替换文件、从模板生成 `config-online.toml`、`docker compose up -d --build`、建 MongoDB 索引。
backend/、frontend/ 有未提交改动时拒绝部署，线上版本记在服务器的 `~/offer-hub/REVISION`。

## 只在服务器上、不入库的东西

| 文件 | 内容 |
|---|---|
| `~/offer-hub/.env` | MySQL / MongoDB / Redis 密码和 JWT secret，首次部署随机生成，root 600 |
| `~/offer-hub/config-online.toml` | 每次发版由 `config-online.toml.tmpl` + `.env` 生成 |
| `~/offer-hub/certs/origin.{pem,key}` | Cloudflare Origin 证书，到期 2041-11-05 |

`.env` 一旦生成就不要改：数据库密码只在数据卷第一次初始化时生效，改了 `.env` 后端会连不上。

## Cloudflare 设置

- SSL/TLS：Full (strict)；Always Use HTTPS：开
- Origin Rule：Hostname = `offer-hub.top` → Destination port `8443`
  （机房在大陆、域名未备案，腾讯会拦截 80/443 上的未备案域名，所以回源走 8443。备案完成后可以删掉这条规则，直接回源 443）

Nginx 只接受 Cloudflare IP 段的连接（`nginx/cloudflare-allow.conf`），直连源站 IP 会被断开；
真实访客 IP 取自 `CF-Connecting-IP`（`nginx/cloudflare-ips.conf`）。Cloudflare 的 IP 段偶尔会变，更新：

```bash
for c in $(curl -s https://www.cloudflare.com/ips-v4) $(curl -s https://www.cloudflare.com/ips-v6); do echo "set_real_ip_from $c;"; done
```

## 访客真实 IP 和限流

Nginx 用 Cloudflare 的 `CF-Connecting-IP` 覆盖写 `X-Real-IP` 再转给后端。后端只信任 compose 网关 `172.30.0.1`
（宿主机 nginx 经 docker-proxy 连进来时的源地址，见 `[COMMON] trusted_proxies` 和 `ngin.CreateGin`），
所以后端的 `[RateLimit]`（每人每分钟 120 次）、`[AuthRateLimit]`（每 IP 每分钟 10 次登录注册）按真实访客计数。
Nginx 的 `limit_req` 是额外一层按 IP 的粗限流。

## 常用运维命令（服务器上，`cd ~/offer-hub`）

```bash
sudo docker compose ps
sudo docker compose logs -f --tail 100 backend
sudo docker compose restart backend
# 进 MySQL / MongoDB（密码在 .env）
sudo sh -c '. ./.env; docker compose exec mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD" offer_hub'
sudo sh -c '. ./.env; docker compose exec mongo mongosh -u root -p "$MONGO_ROOT_PASSWORD" --authenticationDatabase admin offer_hub'
```

敏感词库 `~/offer-hub/sensitive_words.txt` 改了自动热更新；发版时会被仓库里的版本覆盖，长期改动请改仓库里的 `backend/src/sensitive_words.txt`。

## 备份

`backup.sh` 每天 04:30 由 `/etc/cron.d/offer-hub-backup`（remote.sh 安装）以 root 执行：mysqldump + mongodump，
存到 `/home/api/offer-hub-backups/<日期>/`，保留 7 天，日志在 `/var/log/offer-hub-backup.log`。恢复命令写在脚本开头。
备份和数据在同一台机器上，只防误删误改，定期把备份目录拷到别处才能防机器故障。

## 演示账号

种子数据里的 23 个 `seed-user-*` 账号在线上已改成随机密码（明文没有保存），不能登录，评论、头像照常显示。
重新执行 `insert_comment_users.sql` 会把密码恢复成 123456，线上不要执行。
