package service

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"offer-hub/config"
)

// Claims JWT 的 payload：user_id 加上标准字段（exp 过期时间、iat 签发时间）
type Claims struct {
	UserID string `json:"user_id"`
	jwt.RegisteredClaims
}

// GenerateToken 为 userID 签发 HS256 token，有效期取配置 [JWT] expire（单位：小时）
func GenerateToken(userID string) (string, error) {
	now := time.Now()
	claims := Claims{
		UserID: userID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(time.Duration(config.Conf.JWT.Expire) * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(now),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	s, err := token.SignedString([]byte(config.Conf.JWT.Secret))
	if err != nil {
		return "", fmt.Errorf("sign token GenerateToken: %w", err)
	}

	return s, nil
}

// ParseToken 校验并解析 token：签名、算法（只认 HS256）、过期时间都通过才返回 claims，
// 返回的 claims.ExpiresAt 一定不为 nil
func ParseToken(tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr,
		&Claims{},
		func(t *jwt.Token) (any, error) { return []byte(config.Conf.JWT.Secret), nil },
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithExpirationRequired(),
		// 严格 base64 解码：签名末位字符含 2 个填充位，非严格时同一 token 有 4 种写法都能验签，
		// 黑名单按原始字符串存，会被换写法绕过
		jwt.WithStrictDecoding(),
	)
	if err != nil {
		return nil, fmt.Errorf("parse ParseToken: %w", err)
	}
	claims, ok := token.Claims.(*Claims)
	if !ok {
		return nil, errors.New("assert claims ParseToken: unexpected claims type")
	}

	return claims, nil
}
