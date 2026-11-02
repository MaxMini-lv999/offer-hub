package tools

import "testing"

func TestFilterSensitiveWords(t *testing.T) {
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

func TestNewSensitiveReplacerLongestFirst(t *testing.T) {
	// 短词放前面，排序后仍应长词优先；空串要被跳过
	r := newSensitiveReplacer([]string{"操你", "", "操你妈"})
	if got, want := r.Replace("操你妈的，操你的"), "***的，**的"; got != want {
		t.Errorf("Replace = %q, want %q", got, want)
	}
}
