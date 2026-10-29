package data

import (
	"context"
	"fmt"
	"time"
)

// tokenBlacklistPrefix 黑名单 key 前缀，完整 key 为 "blacklist:<token>"
const tokenBlacklistPrefix = "blacklist:"

// AddTokenToBlacklist 把 token 写入黑名单，ttl 到期后 Redis 自动删除
func AddTokenToBlacklist(ctx context.Context, token string, ttl time.Duration) error {
	key := tokenBlacklistPrefix + token
	if err := GetRedis().Set(ctx, key, "1", ttl).Err(); err != nil {
		return fmt.Errorf("set AddTokenToBlacklist: %w", err)
	}
	return nil
}

// IsTokenInBlacklist 判断 token 是否在黑名单里
func IsTokenInBlacklist(ctx context.Context, token string) (bool, error) {
	key := tokenBlacklistPrefix + token
	n, err := GetRedis().Exists(ctx, key).Result()
	if err != nil {
		return false, fmt.Errorf("exists IsTokenInBlacklist: %w", err)
	}

	return n > 0, nil
}
