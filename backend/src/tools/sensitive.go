package tools

import (
	"bufio"
	"bytes"
	"context"
	"crypto/sha256"
	"fmt"
	"io"
	"log"
	"os"
	"slices"
	"strings"
	"sync/atomic"
	"time"
	"unicode/utf8"
)

// 敏感词库热更新：启动时 LoadSensitiveWords 首次加载，之后 WatchSensitiveWords 定时重读词库文件，
// 内容变了就构建一个新的过滤器，建好后整个替换掉旧的。
//
// 并发安全靠"建好再换、换的是整个指针"：
//   - sensitiveFilter 构建完成后只读，任何 goroutine 都不会再改它
//   - currentFilter 是 atomic.Pointer，换版本是一次原子写，请求读到的要么是旧版本、要么是新版本，
//     不会读到构建到一半的
//   - 旧版本不用手动释放：正在用它的请求用完后，GC 自然回收
//
// 写者只有一个：启动时的 LoadSensitiveWords，之后只有 WatchSensitiveWords 这一个 goroutine

// maxWordsFileSize 词库文件大小上限，超过按加载失败处理，防止配错路径读进一个大文件
const maxWordsFileSize = 4 << 20 // 4MB

// utf8BOM Windows 记事本保存 UTF-8 文件时会在开头加上它，读的时候去掉
var utf8BOM = []byte{0xEF, 0xBB, 0xBF}

// sensitiveFilter 一个版本的敏感词过滤器，构建完成后只读
type sensitiveFilter struct {
	replacer    *strings.Replacer
	fingerprint [sha256.Size]byte // 规范化后词表的哈希，判断新读到的词库和当前版本是不是同一份
	wordCount   int
}

// currentFilter 当前生效的过滤器版本
var currentFilter atomic.Pointer[sensitiveFilter]

// FilterSensitiveWords 把 s 里的敏感词替换成等长的 *，例："你是傻逼吧" → "你是**吧"。
// 只做原文精确匹配，中间插空格、符号的变体识别不了。
// 每次调用只读一次 currentFilter，整段文本都用同一个版本过滤，不会前半段旧词库、后半段新词库；
// 发表评论和修改评论都只调它一次，所以两边的过滤规则始终一致
func FilterSensitiveWords(s string) string {
	f := currentFilter.Load()
	if f == nil {
		// 启动时 LoadSensitiveWords 失败会直接退出，走到这里说明调用顺序写错了，宁可报错也不能放过敏感词
		panic("tools: sensitive words not loaded, call LoadSensitiveWords first")
	}
	return f.replacer.Replace(s)
}

// LoadSensitiveWords 启动时调用，首次加载词库。失败（文件不存在、格式不对、词库为空等）返回错误，
// 调用方应终止启动：这时还没有上一版本可以兜底
func LoadSensitiveWords(path string) error {
	words, err := readSensitiveWords(path)
	if err != nil {
		return err
	}
	f := newSensitiveFilter(words)
	currentFilter.Store(f)
	log.Printf("sensitive words loaded: %d words from %s", f.wordCount, path)
	return nil
}

// WatchSensitiveWords 每隔 interval 重读一次词库文件，内容变了就换上新版本，ctx 取消时返回。
// 必须在 LoadSensitiveWords 成功之后调用，一般用 go 启动。
// 加载失败时继续用上一版本，同样的错误只打一次日志，恢复后再打一条
func WatchSensitiveWords(ctx context.Context, path string, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	lastErr := ""
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}

		next, err := reloadSensitiveWords(path)
		if err != nil {
			if err.Error() != lastErr {
				log.Printf("reload sensitive words, keep previous version: %v", err)
				lastErr = err.Error()
			}
			continue
		}
		if lastErr != "" {
			log.Printf("reload sensitive words recovered: %s", path)
			lastErr = ""
		}
		if next != nil {
			log.Printf("sensitive words reloaded: %d words from %s", next.wordCount, path)
		}
	}
}

// reloadSensitiveWords 重读一次词库文件，内容变了就换上新版本并返回它，词表没变返回 nil。
// 读取或解析失败时返回错误，currentFilter 不动，请求继续用上一版本
func reloadSensitiveWords(path string) (*sensitiveFilter, error) {
	words, err := readSensitiveWords(path)
	if err != nil {
		return nil, err
	}
	// 只调整了顺序、注释、空行，或者文件被 touch 了一下，词表没变，不用重建、也不用换
	if cur := currentFilter.Load(); cur != nil && cur.fingerprint == fingerprintOf(words) {
		return nil, nil
	}
	next := newSensitiveFilter(words)
	currentFilter.Store(next)
	return next, nil
}

// readSensitiveWords 读词库文件并规范化：一行一个词，去掉首尾空白，跳过空行和 # 开头的注释行，
// 去重后按长度降序排（规则见 sortWords）。
// 文件不是合法 UTF-8 或者一个词都没有时返回错误：大多是文件写到一半（先清空再写入的编辑器、
// echo > 覆盖）或者写错了文件，这种内容不能拿来替换正在用的版本
func readSensitiveWords(path string) ([]string, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("open words file: %w", err)
	}
	defer file.Close()

	content, err := io.ReadAll(io.LimitReader(file, maxWordsFileSize+1))
	if err != nil {
		return nil, fmt.Errorf("read words file: %w", err)
	}
	if len(content) > maxWordsFileSize {
		return nil, fmt.Errorf("words file %s larger than %d bytes", path, maxWordsFileSize)
	}
	content = bytes.TrimPrefix(content, utf8BOM)

	var words []string
	scanner := bufio.NewScanner(bytes.NewReader(content))
	scanner.Buffer(nil, maxWordsFileSize) // 默认一行最多 64KB，放宽到文件上限，超长行不会让读取失败
	for line := 1; scanner.Scan(); line++ {
		w := strings.TrimSpace(scanner.Text())
		if w == "" || strings.HasPrefix(w, "#") {
			continue
		}
		if !utf8.ValidString(w) {
			return nil, fmt.Errorf("words file %s line %d: invalid UTF-8", path, line)
		}
		words = append(words, w)
	}
	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("scan words file %s: %w", path, err)
	}
	if len(words) == 0 {
		return nil, fmt.Errorf("words file %s has no words", path)
	}

	sortWords(words)
	return slices.Compact(words), nil
}

// sortWords 按字节长度降序排，长度相同按字典序。
// strings.Replacer 内部是前缀树，同一位置有多个词能匹配时取参数里靠前的，
// 所以长词必须在前：词库有"操你"和"操你妈"时，"操你妈的" → "***的"，而不是 "**妈的"。
// 长度相同再按字典序，是为了同一份词表不管文件里怎么排，排完都一样，指纹才能用来判断内容有没有变
func sortWords(words []string) {
	slices.SortFunc(words, func(a, b string) int {
		if len(a) != len(b) {
			return len(b) - len(a)
		}
		return strings.Compare(a, b)
	})
}

// fingerprintOf 计算排好序、去过重的词表的指纹。词里不会有换行（按行读的），用 \n 拼接不会有歧义
func fingerprintOf(words []string) [sha256.Size]byte {
	return sha256.Sum256([]byte(strings.Join(words, "\n")))
}

// newSensitiveFilter 用排好序、去过重的词表构建一个完整的过滤器。
// strings.NewReplacer 只是记下参数，第一次 Replace 时才真正建前缀树，
// 所以这里先空跑一次，把构建放在换上去之前，换上去的就是建好的，第一个评论请求不用替它付构建的开销
func newSensitiveFilter(words []string) *sensitiveFilter {
	oldnew := make([]string, 0, 2*len(words))
	for _, w := range words {
		oldnew = append(oldnew, w, strings.Repeat("*", utf8.RuneCountInString(w)))
	}
	r := strings.NewReplacer(oldnew...)
	r.Replace("")

	return &sensitiveFilter{
		replacer:    r,
		fingerprint: fingerprintOf(words),
		wordCount:   len(words),
	}
}
