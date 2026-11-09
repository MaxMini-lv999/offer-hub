package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"offer-hub/config"
	"offer-hub/data"
	"offer-hub/ngin"
	rt "offer-hub/router"
	"offer-hub/tools"
)

// shutdownTimeout 为排空在途请求、关闭数据连接各自留出的最长时间。
const shutdownTimeout = 10 * time.Second

// HTTP 服务的超时。接口的请求体和响应体都很小，正常请求远用不到这么久
const (
	readHeaderTimeout = 5 * time.Second  // 读完请求头的最长时间，防慢速发送请求头占住连接
	readTimeout       = 10 * time.Second // 读完整个请求（头 + 体）的最长时间
	// writeTimeout 从读完请求头到写完响应的最长时间，超时后连接被关掉，客户端收不到响应。
	// 要大于最慢的正常请求：注册登录的 bcrypt 加上几次数据库查询，远小于这个值
	writeTimeout = 15 * time.Second
	idleTimeout  = 60 * time.Second // keep-alive 连接空闲多久后关闭
)

func main() {
	if err := run(); err != nil {
		log.Fatal(err)
	}
}

// run 不直接 log.Fatal，保证 defer 中的连接关闭一定会执行。
func run() error {
	if err := config.Init(""); err != nil {
		return fmt.Errorf("init config: %w", err)
	}

	// 敏感词库：启动时必须加载成功，之后后台定时检查文件，变了就热更新。
	// watchCtx 在 run 返回时取消，检查的 goroutine 随之退出
	sensitive := config.Conf.Sensitive
	if err := tools.LoadSensitiveWords(sensitive.WordsFile); err != nil {
		return fmt.Errorf("load sensitive words: %w", err)
	}
	watchCtx, stopWatch := context.WithCancel(context.Background())
	defer stopWatch()
	go tools.WatchSensitiveWords(watchCtx, sensitive.WordsFile, time.Duration(sensitive.ReloadIntervalSeconds)*time.Second)

	d, err := data.NewData(config.Conf)
	if err != nil {
		return fmt.Errorf("init data: %w", err)
	}

	defer func() {
		ctx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
		defer cancel()
		if err := d.Close(ctx); err != nil {
			log.Printf("close data: %v", err)
		}
	}()

	if err := data.EnsureMongoIndexes(); err != nil {
		return fmt.Errorf("ensure mongo indexes: %w", err)
	}

	rdb, err := data.InitRedis(config.Conf)
	if err != nil {
		return fmt.Errorf("init redis: %w", err)
	}
	defer func() {
		if err := rdb.Close(); err != nil {
			log.Printf("close redis: %v", err)
		}
	}()

	router, err := ngin.CreateGin(config.Conf.Common.TrustedProxies)
	if err != nil {
		return fmt.Errorf("create gin: %w", err)
	}
	rt.RegisterRouter(router)

	// 不设超时的话，一个连接可以无限期地慢慢发请求头（Slowloris），或者连上之后什么都不发，一直占着连接和 goroutine
	srv := &http.Server{
		Addr:              fmt.Sprintf(":%d", config.Conf.Common.Port),
		Handler:           router,
		ReadHeaderTimeout: readHeaderTimeout,
		ReadTimeout:       readTimeout,
		WriteTimeout:      writeTimeout,
		IdleTimeout:       idleTimeout,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	errCh := make(chan error, 1)
	go func() {
		log.Printf("listening on %s", srv.Addr)
		errCh <- srv.ListenAndServe()
	}()

	select {
	case err := <-errCh:
		return fmt.Errorf("run server: %w", err)
	case <-ctx.Done():
	}
	// 恢复默认信号处理，关闭过程中再按一次 Ctrl+C 可强制退出。
	stop()
	log.Println("shutting down...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("shutdown server: %w", err)
	}
	log.Println("server stopped")
	return nil
}
