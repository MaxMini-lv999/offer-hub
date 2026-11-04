package config

import (
	"fmt"
	"os"

	"github.com/BurntSushi/toml"
)

// Conf 全局配置，Init 成功后可用。
var Conf *TomlConfig

type TomlConfig struct {
	Common    CommonConfig    `toml:"COMMON"`
	MySQL     MySQLConfig     `toml:"MySQL"`
	MongoDB   MongoDBConfig   `toml:"MongoDB"`
	Redis     RedisConfig     `toml:"Redis"`
	JWT       JWTConfig       `toml:"JWT"`
	RateLimit RateLimitConfig `toml:"RateLimit"`
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
	if _, err := toml.DecodeFile(configPath, &c); err != nil {
		return fmt.Errorf("load config %s: %w", configPath, err)
	}
	// 窗口为 0 时算窗口号会除以 0；上限为 0 时所有请求都会被拒绝
	if rl := c.RateLimit; rl.Enable && (rl.WindowSeconds <= 0 || rl.MaxRequests <= 0) {
		return fmt.Errorf("config %s: RateLimit window_seconds and max_requests must be > 0", configPath)
	}
	Conf = &c
	return nil
}
