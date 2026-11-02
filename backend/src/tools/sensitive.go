package tools

import (
	"slices"
	"strings"
	"unicode/utf8"
)

// sensitiveWords 敏感词库，目前是示例词表，上线前换成正式词库
var sensitiveWords = []string{
	"傻逼",
	"煞笔",
	"操你妈",
	"草泥马",
	"脑残",
}

// sensitiveReplacer 把敏感词替换成等长的 *。启动时建一次，strings.Replacer 并发安全
var sensitiveReplacer = newSensitiveReplacer(sensitiveWords)

// newSensitiveReplacer 用词库构建替换器。
// strings.Replacer 内部是前缀树，同一位置有多个词能匹配时取参数里靠前的，
// 所以先按长度降序排，保证长词优先：词库有"操你"和"操你妈"时，"操你妈的" → "***的"，而不是 "**妈的"
func newSensitiveReplacer(words []string) *strings.Replacer {
	sorted := slices.Clone(words)
	slices.SortFunc(sorted, func(a, b string) int { return len(b) - len(a) })

	oldnew := make([]string, 0, 2*len(sorted))
	for _, w := range sorted {
		if w == "" {
			continue // 空串会在每个位置都匹配上
		}
		oldnew = append(oldnew, w, strings.Repeat("*", utf8.RuneCountInString(w)))
	}
	return strings.NewReplacer(oldnew...)
}

// FilterSensitiveWords 把 s 里的敏感词替换成等长的 *，例："你是傻逼吧" → "你是**吧"。
// 只做原文精确匹配，中间插空格、符号的变体识别不了
func FilterSensitiveWords(s string) string {
	return sensitiveReplacer.Replace(s)
}
