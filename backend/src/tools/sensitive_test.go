package tools

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// 这些测试会改包级的 currentFilter，不能加 t.Parallel()

// useWords 把词表写进临时文件并作为当前版本加载，测试结束后恢复原来的版本，返回文件路径
func useWords(t *testing.T, content string) string {
	t.Helper()
	old := currentFilter.Load()
	t.Cleanup(func() { currentFilter.Store(old) })

	path := filepath.Join(t.TempDir(), "words.txt")
	writeWords(t, path, content)
	if err := LoadSensitiveWords(path); err != nil {
		t.Fatalf("LoadSensitiveWords: %v", err)
	}
	return path
}

// writeWords 先写临时文件再 rename 覆盖，和文档里推荐的更新方式一样
func writeWords(t *testing.T, path, content string) {
	t.Helper()
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.Rename(tmp, path); err != nil {
		t.Fatal(err)
	}
}

func TestFilterSensitiveWords(t *testing.T) {
	useWords(t, "傻逼\n煞笔\n操你妈\n草泥马\n脑残\n")
	cases := []struct {
		name string
		in   string
		want string
	}{
		{"没有敏感词", "这道题解析写得很清楚", "这道题解析写得很清楚"},
		{"空串", "", ""},
		{"按字符数打码", "你是傻逼吧", "你是**吧"},
		{"多个词", "傻逼和脑残", "**和**"},
		{"连续出现", "傻逼傻逼", "****"},
		{"中英混排", "abc草泥马def", "abc***def"},
	}
	for _, c := range cases {
		if got := FilterSensitiveWords(c.in); got != c.want {
			t.Errorf("%s: FilterSensitiveWords(%q) = %q, want %q", c.name, c.in, got, c.want)
		}
	}
}

func TestFilterSensitiveWordsLongestFirst(t *testing.T) {
	// 文件里短词在前，排序后仍应长词优先
	useWords(t, "操你\n操你妈\n")
	if got, want := FilterSensitiveWords("操你妈的，操你的"), "***的，**的"; got != want {
		t.Errorf("FilterSensitiveWords = %q, want %q", got, want)
	}
}

// 仓库里带的词库文件必须能加载，否则服务起不来
func TestShippedWordsFile(t *testing.T) {
	words, err := readSensitiveWords("../sensitive_words.txt")
	if err != nil {
		t.Fatalf("readSensitiveWords: %v", err)
	}
	if len(words) == 0 {
		t.Fatal("shipped words file has no words")
	}
}

func TestReadSensitiveWords(t *testing.T) {
	dir := t.TempDir()
	write := func(name, content string) string {
		p := filepath.Join(dir, name)
		if err := os.WriteFile(p, []byte(content), 0o644); err != nil {
			t.Fatal(err)
		}
		return p
	}

	t.Run("规范化", func(t *testing.T) {
		// BOM、CRLF、首尾空白、空行、注释、重复词都要处理掉
		p := write("ok.txt", "\xEF\xBB\xBF# 注释\r\n  脑残 \r\n\r\n傻逼\n脑残\n  # 缩进的注释\nab\n")
		got, err := readSensitiveWords(p)
		if err != nil {
			t.Fatal(err)
		}
		if want := []string{"傻逼", "脑残", "ab"}; strings.Join(got, ",") != strings.Join(want, ",") {
			t.Errorf("words = %q, want %q", got, want)
		}
	})

	bad := []struct {
		name    string
		path    string
		wantErr string
	}{
		{"文件不存在", filepath.Join(dir, "missing.txt"), "no such file"},
		{"空文件", write("empty.txt", ""), "has no words"},
		{"只有注释和空行", write("comments.txt", "# a\n\n   \n"), "has no words"},
		{"不是 UTF-8（写到一半截断的汉字）", write("broken.txt", "傻逼\n脑\xe6\xae\n"), "invalid UTF-8"},
		{"超过大小上限", write("big.txt", strings.Repeat("a", maxWordsFileSize+1)), "larger than"},
	}
	for _, c := range bad {
		t.Run(c.name, func(t *testing.T) {
			_, err := readSensitiveWords(c.path)
			if err == nil || !strings.Contains(err.Error(), c.wantErr) {
				t.Errorf("err = %v, want containing %q", err, c.wantErr)
			}
		})
	}
}

func TestLoadSensitiveWordsMissingFile(t *testing.T) {
	// 启动时加载失败要返回错误，由 main 终止启动
	if err := LoadSensitiveWords(filepath.Join(t.TempDir(), "missing.txt")); err == nil {
		t.Fatal("LoadSensitiveWords on missing file: want error")
	}
}

func TestReloadSensitiveWords(t *testing.T) {
	path := useWords(t, "傻逼\n脑残\n")
	v1 := currentFilter.Load()

	// 内容没变：同一份词表换了顺序、加了注释和空行，不切换版本
	writeWords(t, path, "# 调整了顺序\n脑残\n\n傻逼\n傻逼\n")
	next, err := reloadSensitiveWords(path)
	if err != nil || next != nil || currentFilter.Load() != v1 {
		t.Fatalf("same words: next = %v, err = %v, version changed = %v", next, err, currentFilter.Load() != v1)
	}

	// 加载失败：继续用上一版本
	for name, content := range map[string]string{"空文件": "", "不是 UTF-8": "傻逼\n\xff\n"} {
		writeWords(t, path, content)
		if _, err := reloadSensitiveWords(path); err == nil {
			t.Errorf("%s: want error", name)
		}
		if currentFilter.Load() != v1 {
			t.Fatalf("%s: version changed after failed reload", name)
		}
	}
	os.Remove(path)
	if _, err := reloadSensitiveWords(path); err == nil || currentFilter.Load() != v1 {
		t.Fatalf("missing file: err = %v, version changed = %v", err, currentFilter.Load() != v1)
	}
	if got := FilterSensitiveWords("傻逼脑残八股"); got != "****八股" {
		t.Errorf("after failed reloads: got %q, want old version result", got)
	}

	// 内容变了：换上新版本
	writeWords(t, path, "傻逼\n脑残\n八股\n")
	next, err = reloadSensitiveWords(path)
	if err != nil || next == nil || currentFilter.Load() != next || next.wordCount != 3 {
		t.Fatalf("changed words: next = %v, err = %v", next, err)
	}
	if got := FilterSensitiveWords("傻逼脑残八股"); got != "******" {
		t.Errorf("after reload: got %q, want %q", got, "******")
	}
}

func TestWatchSensitiveWords(t *testing.T) {
	path := useWords(t, "苹果\n")
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		WatchSensitiveWords(ctx, path, 10*time.Millisecond)
		close(done)
	}()

	writeWords(t, path, "苹果\n香蕉\n")
	waitFor(t, func() bool { return FilterSensitiveWords("苹果香蕉") == "****" })

	// 改坏之后继续用上一版本，再改好又能生效
	writeWords(t, path, "\xff")
	time.Sleep(50 * time.Millisecond)
	if got := FilterSensitiveWords("苹果香蕉"); got != "****" {
		t.Errorf("after broken file: got %q, want previous version", got)
	}
	writeWords(t, path, "香蕉\n")
	waitFor(t, func() bool { return FilterSensitiveWords("苹果香蕉") == "苹果**" })

	cancel()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("WatchSensitiveWords did not return after ctx cancel")
	}
}

func waitFor(t *testing.T, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for !cond() {
		if time.Now().After(deadline) {
			t.Fatal("condition not met within 2s")
		}
		time.Sleep(5 * time.Millisecond)
	}
}

// 评论请求和词库更新同时发生：请求只能看到某一个完整版本的结果。
// 版本 A 只有"苹果"，版本 B 只有"香蕉"。"苹果香蕉" 过滤后只能是 "**香蕉"（A）或 "苹果**"（B），
// 出现 "****" 或原文就说明读到了两个版本拼起来的、或者没建完的过滤器。用 go test -race 跑能同时查数据竞争
func TestConcurrentFilterAndReload(t *testing.T) {
	path := useWords(t, "苹果\n")
	const input = "苹果香蕉"
	valid := map[string]bool{"**香蕉": true, "苹果**": true}

	var stop atomic.Bool
	var wg sync.WaitGroup
	var calls atomic.Int64
	for range 8 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for !stop.Load() {
				if got := FilterSensitiveWords(input); !valid[got] {
					t.Errorf("FilterSensitiveWords(%q) = %q, not from a single version", input, got)
					return
				}
				calls.Add(1)
			}
		}()
	}

	// 写者：在 A、B 之间来回切，每次都真的换版本
	swaps := 0
	for i := range 200 {
		content := "苹果\n"
		if i%2 == 0 {
			content = "香蕉\n"
		}
		writeWords(t, path, content)
		next, err := reloadSensitiveWords(path)
		if err != nil || next == nil {
			t.Fatalf("reload %d: next = %v, err = %v", i, next, err)
		}
		swaps++
	}
	stop.Store(true)
	wg.Wait()
	t.Logf("%d swaps, %d concurrent filter calls", swaps, calls.Load())
}
