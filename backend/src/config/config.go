package config

import (
	"fmt"
	"os"

	"github.com/BurntSushi/toml"
)

// Conf 全局配置，Init 成功后可用。
var Conf *TomlConfig

type TomlConfig struct {
	Common        CommonConfig    `toml:"COMMON"`
	MySQL         MySQLConfig     `toml:"MySQL"`
	MongoDB       MongoDBConfig   `toml:"MongoDB"`
	Redis         RedisConfig     `toml:"Redis"`
	JWT           JWTConfig       `toml:"JWT"`
	RateLimit     RateLimitConfig `toml:"RateLimit"`
	AuthRateLimit RateLimitConfig `toml:"AuthRateLimit"` // 登录、注册专用，按 IP 计数，和 RateLimit 分开计
	Sensitive     SensitiveConfig `toml:"Sensitive"`
}

type CommonConfig struct {
	Port    int  `toml:"port"`
	OpenTLS bool `toml:"open_tls"`
}

type MySQLConfig struct {
	URL    string `toml:"url"`
	User   string `toml:"user"`
	Pwd    string `toml:"pwd"`
	DBName string `toml:"db_name"`
}

type MongoDBConfig struct {
	URL      string `toml:"url"`
	User     string `toml:"user"`
	Pwd      string `toml:"pwd"`
	Database string `toml:"database"`
	MaxPool  uint64 `toml:"max_pool"`
	MinPool  uint64 `toml:"min_pool"`
}

type RedisConfig struct {
	URL string `toml:"url"`
	Pwd string `toml:"pwd"`
	DB  int    `toml:"db"`
}

type JWTConfig struct {
	Secret string `toml:"secret"`
	Expire int    `toml:"expire"` // 小时
	Enable bool   `toml:"enable"`
}

type RateLimitConfig struct {
	Enable        bool `toml:"enable"`
	WindowSeconds int  `toml:"window_seconds"`
	MaxRequests   int  `toml:"max_requests"`
}

// SensitiveConfig 评论敏感词库，词库文件改了不用重启，每 ReloadIntervalSeconds 秒检查一次
type SensitiveConfig struct {
	WordsFile             string `toml:"words_file"` // 相对路径相对于启动时的工作目录，和配置文件一样
	ReloadIntervalSeconds int    `toml:"reload_interval_seconds"`
}

// Init 读取配置文件并赋值给 Conf。
// configPath 为空时按环境变量 APP_ENV 选择 config-{APP_ENV}.toml，APP_ENV 未设置时为 test。
func Init(configPath string) error {
	if configPath == "" {
		env := os.Getenv("APP_ENV")
		if env == "" {
			env = "test"
		}
		configPath = fmt.Sprintf("config-%s.toml", env)
	}

	var c TomlConfig
	md, err := toml.DecodeFile(configPath, &c)
	if err != nil {
		return fmt.Errorf("load config %s: %w", configPath, err)
	}
	// 漏写 [AuthRateLimit] 时按默认值开启，不能因为少一段配置就没了防暴力破解；要关闭得显式写 enable = false
	if !md.IsDefined("AuthRateLimit") {
		c.AuthRateLimit = defaultAuthRateLimit
	}
	// 漏写 [Sensitive] 时用默认词库，评论不能因为少一段配置就不过滤敏感词
	if !md.IsDefined("Sensitive") {
		c.Sensitive = defaultSensitive
	}
	if err := checkSensitive(c.Sensitive); err != nil {
		return fmt.Errorf("config %s: %w", configPath, err)
	}
	if err := checkRateLimit("RateLimit", c.RateLimit); err != nil {
		return fmt.Errorf("config %s: %w", configPath, err)
	}
	if err := checkRateLimit("AuthRateLimit", c.AuthRateLimit); err != nil {
		return fmt.Errorf("config %s: %w", configPath, err)
	}
	Conf = &c
	return nil
}

// defaultAuthRateLimit 登录、注册限流的默认值：每个 IP 每 60 秒最多 10 次
var defaultAuthRateLimit = RateLimitConfig{Enable: true, WindowSeconds: 60, MaxRequests: 10}

// checkRateLimit 开启限流时窗口和上限都必须大于 0：
// 窗口为 0 时算窗口号会除以 0；上限为 0 时所有请求都会被拒绝
func checkRateLimit(name string, rl RateLimitConfig) error {
	if rl.Enable && (rl.WindowSeconds <= 0 || rl.MaxRequests <= 0) {
		return fmt.Errorf("%s window_seconds and max_requests must be > 0", name)
	}
	return nil
}

// defaultSensitive 敏感词库的默认值：启动目录下的 sensitive_words.txt，每 5 秒检查一次
var defaultSensitive = SensitiveConfig{WordsFile: "sensitive_words.txt", ReloadIntervalSeconds: 5}

// checkSensitive 词库路径不能为空；检查间隔必须大于 0，time.NewTicker 收到 0 会 panic
func checkSensitive(s SensitiveConfig) error {
	if s.WordsFile == "" {
		return fmt.Errorf("Sensitive words_file must not be empty")
	}
	if s.ReloadIntervalSeconds <= 0 {
		return fmt.Errorf("Sensitive reload_interval_seconds must be > 0")
	}
	return nil
}
