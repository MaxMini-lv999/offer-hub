package ngin

import "github.com/gin-gonic/gin"

// CreateGin 创建 Gin 实例并挂载全局中间件。
func CreateGin() *gin.Engine {
	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())
	return r
}
