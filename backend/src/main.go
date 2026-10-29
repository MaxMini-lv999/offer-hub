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
)

// shutdownTimeout 为排空在途请求、关闭数据连接各自留出的最长时间。
const shutdownTimeout = 10 * time.Second

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

	rdb, err := data.InitRedis(config.Conf)
	if err != nil {
		return fmt.Errorf("init redis: %w", err)
	}
	defer func() {
		if err := rdb.Close(); err != nil {
			log.Printf("close redis: %v", err)
		}
	}()

	router := ngin.CreateGin()
	rt.RegisterRouter(router)

	srv := &http.Server{
		Addr:    fmt.Sprintf(":%d", config.Conf.Common.Port),
		Handler: router,
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
