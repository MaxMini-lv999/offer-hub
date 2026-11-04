package ctrl

// MaxListOffset 分页最多跳过多少条。skip 越大，MongoDB 要先数过去的文档越多，再往后翻直接返回参数错误
const MaxListOffset = 10000

// NormalizePage 给分页参数补默认值：page 默认 1，page_size 默认 defaultSize、超过 maxSize 按 maxSize 处理。
// 要跳过的条数超过 MaxListOffset 时返回 false。所有分页接口共用，补完后 (page-1)*pageSize 一定不溢出
func NormalizePage(page, pageSize *int, defaultSize, maxSize int) bool {
	if *page <= 0 {
		*page = 1
	}
	if *pageSize <= 0 {
		*pageSize = defaultSize
	}
	if *pageSize > maxSize {
		*pageSize = maxSize
	}
	// 等价于 (page-1)*page_size > MaxListOffset。用除法比：page 特别大时乘法会溢出成负数，反而通过检查
	return *page-1 <= MaxListOffset / *pageSize
}
