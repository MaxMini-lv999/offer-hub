package service

import (
	"bytes"
	"encoding/base64"
	"strings"
	"testing"

	"offer-hub/config"
)

// base64url 的字母表，字符在里面的下标就是它代表的 6 位值
const base64URLAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"

// useTestJWTConfig 换上测试用的 JWT 配置，测试结束后恢复
func useTestJWTConfig(t *testing.T) {
	t.Helper()
	old := config.Conf
	t.Cleanup(func() { config.Conf = old })
	config.Conf = &config.TomlConfig{JWT: config.JWTConfig{Secret: "test-secret", Expire: 1}}
}

// paddingVariants 返回 token 签名末位字符的另外 3 种写法：只改末位字符的最低 2 位（填充位）。
// HS256 签名 32 字节 = 256 位，base64url 编成 43 个字符共 258 位，末位字符的低 2 位是填充位
func paddingVariants(t *testing.T, token string) []string {
	t.Helper()
	last := token[len(token)-1]
	v := strings.IndexByte(base64URLAlphabet, last)
	if v < 0 {
		t.Fatalf("last char %q is not base64url", last)
	}
	var variants []string
	for i := 0; i < 4; i++ {
		alt := v&^3 | i // 高 4 位不变，低 2 位换成 0~3
		if alt == v {
			continue
		}
		variants = append(variants, token[:len(token)-1]+string(base64URLAlphabet[alt]))
	}
	return variants
}

// 回归测试：登出绕过漏洞（提交 95caf32）。ParseToken 去掉 jwt.WithStrictDecoding() 时这个测试会失败
func TestParseTokenRejectsPaddingVariants(t *testing.T) {
	useTestJWTConfig(t)

	token, err := GenerateToken("u1")
	if err != nil {
		t.Fatalf("GenerateToken: %v", err)
	}
	if _, err := ParseToken(token); err != nil {
		t.Fatalf("ParseToken(original): %v", err)
	}

	sig := token[strings.LastIndexByte(token, '.')+1:]
	if len(sig) != 43 {
		t.Fatalf("signature has %d chars, want 43 (HS256)", len(sig))
	}
	want, err := base64.RawURLEncoding.Strict().DecodeString(sig)
	if err != nil {
		t.Fatalf("decode original signature: %v", err)
	}

	variants := paddingVariants(t, token)
	if len(variants) != 3 {
		t.Fatalf("got %d variants, want 3", len(variants))
	}
	for _, v := range variants {
		// 先确认漏洞的前提成立：非严格解码时，换了写法的签名解出来是同一串字节，
		// 也就是说如果 ParseToken 不严格解码，这个 token 会验签通过
		got, err := base64.RawURLEncoding.DecodeString(v[strings.LastIndexByte(v, '.')+1:])
		if err != nil || !bytes.Equal(got, want) {
			t.Fatalf("variant %q should decode to the same signature without strict decoding", v[len(v)-3:])
		}
		// 黑名单按 token 原文存，原文不同的写法必须在验签这一步就被拒绝
		if _, err := ParseToken(v); err == nil {
			t.Errorf("ParseToken accepted padding variant ...%s of ...%s", v[len(v)-3:], token[len(token)-3:])
		}
	}
}
