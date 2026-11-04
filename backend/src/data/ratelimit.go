package data

import (
	"context"
	"fmt"
	"time"
)

// rateLimitPrefix 限流计数 key 前缀，完整 key 为 "rate_limit:<keyID>:<windowStart>"
const rateLimitPrefix = "rate_limit:"

// IncrRateLimit 把 keyID 在第 windowStart 个窗口的请求计数 +1，返回 +1 之后的值。
// 计数第一次创建时设置过期时间 ttl，窗口过去后 Redis 自动删除
func IncrRateLimit(ctx context.Context, keyID string, windowStart int64, ttl time.Duration) (int64, error) {
	key := fmt.Sprintf("%s%s:%d", rateLimitPrefix, keyID, windowStart)
	count, err := GetRedis().Incr(ctx, key).Result()
	if err != nil {
		return 0, fmt.Errorf("incr IncrRateLimit: %w", err)
	}
	// 计数为 1 说明这个窗口的 key 刚创建
	if count == 1 {
		if err := GetRedis().Expire(ctx, key, ttl).Err(); err != nil {
			return 0, fmt.Errorf("expire IncrRateLimit: %w", err)
		}
	}
	return count, nil
}
