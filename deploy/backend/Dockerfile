# 二进制由 deploy.sh 在本机交叉编译好（CGO_ENABLED=0），服务器上只打包，不编译：服务器内存紧
FROM alpine:3.20
# tzdata：MySQL DSN 里 loc=Asia/Shanghai 要读时区库；ca-certificates 备用
RUN apk add --no-cache tzdata ca-certificates \
    && adduser -D -H -u 10001 app
WORKDIR /app
COPY offer-hub /app/offer-hub
USER app
EXPOSE 8180
ENTRYPOINT ["/app/offer-hub"]
