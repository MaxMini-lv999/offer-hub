package ngin

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

// clientIPOf 用 CreateGin(proxies) 处理一个请求，返回 handler 里 c.ClientIP() 的结果
func clientIPOf(t *testing.T, proxies []string, remoteAddr string, header map[string]string) string {
	t.Helper()
	gin.SetMode(gin.TestMode)
	r, err := CreateGin(proxies)
	if err != nil {
		t.Fatalf("CreateGin(%v): %v", proxies, err)
	}
	var got string
	r.GET("/ip", func(c *gin.Context) { got = c.ClientIP() })

	req := httptest.NewRequest(http.MethodGet, "/ip", nil)
	req.RemoteAddr = remoteAddr
	for k, v := range header {
		req.Header.Set(k, v)
	}
	r.ServeHTTP(httptest.NewRecorder(), req)
	return got
}

func TestCreateGinClientIP(t *testing.T) {
	const proxy = "172.30.0.1"
	cases := []struct {
		name    string
		proxies []string
		remote  string
		header  map[string]string
		want    string
	}{
		{"不配代理时忽略 X-Real-IP", nil, "203.0.113.9:5000", map[string]string{"X-Real-IP": "1.2.3.4"}, "203.0.113.9"},
		{"可信代理转发时取 X-Real-IP", []string{proxy}, proxy + ":5000", map[string]string{"X-Real-IP": "1.2.3.4"}, "1.2.3.4"},
		{"非可信来源伪造 X-Real-IP 无效", []string{proxy}, "203.0.113.9:5000", map[string]string{"X-Real-IP": "1.2.3.4"}, "203.0.113.9"},
		{"可信代理也不读 X-Forwarded-For", []string{proxy}, proxy + ":5000", map[string]string{"X-Forwarded-For": "1.2.3.4"}, proxy},
		{"CIDR 形式", []string{"172.30.0.0/24"}, proxy + ":5000", map[string]string{"X-Real-IP": "1.2.3.4"}, "1.2.3.4"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := clientIPOf(t, tc.proxies, tc.remote, tc.header); got != tc.want {
				t.Errorf("ClientIP = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestCreateGinInvalidProxy(t *testing.T) {
	if _, err := CreateGin([]string{"not-an-ip"}); err == nil {
		t.Fatal("非法的代理地址应该返回错误")
	}
}
