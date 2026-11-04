package service

import (
	"context"
	"fmt"
	"time"

	"offer-hub/data"
)

// RateLimiter 固定窗口限流器：同一个 keyID 在每个窗口内最多放行 limit 次请求
type RateLimiter struct {
	limit  int           // 每个窗口最多放行的请求数
	window time.Duration // 窗口长度，至少 1 秒
}

// NewRateLimiter 创建限流器，limit 和 window 必须大于 0（启动时由配置校验保证）
func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
	return &RateLimiter{limit: limit, window: window}
}

// Allow 给 keyID 在当前窗口的计数 +1，没超过 limit 返回 true。
// Redis 出错时返回 false 和 err，放行还是拒绝由调用方决定
func (l *RateLimiter) Allow(ctx context.Context, keyID string) (bool, error) {
	// 窗口号 = Unix 秒数 / 窗口秒数，同一窗口内的请求落在同一个 key 上
	windowStart := time.Now().Unix() / int64(l.window.Seconds())
	// 多留 1 秒，保证 key 在窗口结束之前不会过期
	count, err := data.IncrRateLimit(ctx, keyID, windowStart, l.window+time.Second)
	if err != nil {
		return false, fmt.Errorf("count RateLimiter Allow: %w", err)
	}
	return count <= int64(l.limit), nil
}
