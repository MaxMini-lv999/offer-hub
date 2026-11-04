package service

import "time"

// beijing 接口里所有时间都按北京时间输出。用固定 +8 时区而不是 time.LoadLocation("Asia/Shanghai")：
// 中国没有夏令时，结果一样，而且不依赖运行环境里的时区数据库（精简的容器镜像里可能没有）
var beijing = time.FixedZone("CST", 8*60*60)

// formatTime 把时间格式化成北京时间的 "2006-01-02 15:04:05"。
// 不能用 .Local()：结果会随服务器所在时区变化，服务器不在东八区时就差了几个小时。
// MongoDB 读出来的是 UTC，MySQL 按 DSN 的 loc 读出来的是北京时间，统一 .In(beijing) 后都正确
func formatTime(t time.Time) string {
	return t.In(beijing).Format(time.DateTime)
}
