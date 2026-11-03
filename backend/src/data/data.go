package data

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"

	"offer-hub/config"
)

const connectTimeout = 10 * time.Second

var (
	data *Data
	rdb  *redis.Client
)

type Data struct {
	MySQL   *gorm.DB
	MongoDB *mongo.Database

	mongoClient *mongo.Client
}

// NewData 建立 MySQL 和 MongoDB 连接，成功后可通过 GetData 获取。
func NewData(conf *config.TomlConfig) (*Data, error) {
	db, err := newMySQL(conf.MySQL)
	if err != nil {
		return nil, err
	}

	client, err := newMongo(conf.MongoDB)
	if err != nil {
		if sqlDB, e := db.DB(); e == nil {
			_ = sqlDB.Close()
		}
		return nil, err
	}

	data = &Data{
		MySQL:       db,
		MongoDB:     client.Database(conf.MongoDB.Database),
		mongoClient: client,
	}
	return data, nil
}

// GetData 返回 NewData 创建的全局实例。
func GetData() *Data {
	return data
}

// EnsureMongoIndexes 建好业务依赖的 MongoDB 唯一索引，启动时调用一次。
// 索引已存在时 CreateOne 什么都不做，所以重复启动没有影响；
// 已有数据违反唯一约束（存在重复记录）时会建失败，需要先清理重复数据。
//   - user_interactions：同一用户对同一目标的同一种交互只有一条记录，UpsertLike 并发时靠它防止插入两条
func EnsureMongoIndexes() error {
	ctx, cancel := context.WithTimeout(context.Background(), connectTimeout)
	defer cancel()

	indexes := map[string]bson.D{
		"user_interactions": {
			{Key: "user_id", Value: 1},
			{Key: "target_type", Value: 1},
			{Key: "target_id", Value: 1},
			{Key: "interaction_type", Value: 1},
		},
	}
	for coll, keys := range indexes {
		idx := mongo.IndexModel{Keys: keys, Options: options.Index().SetUnique(true)}
		if _, err := GetData().MongoDB.Collection(coll).Indexes().CreateOne(ctx, idx); err != nil {
			return fmt.Errorf("create unique index on %s: %w", coll, err)
		}
	}
	return nil
}

// Close 关闭 MySQL 和 MongoDB 连接，ctx 控制等待 MongoDB 归还连接的最长时间。
func (d *Data) Close(ctx context.Context) error {
	var errs []error
	if sqlDB, err := d.MySQL.DB(); err != nil {
		errs = append(errs, fmt.Errorf("get mysql db: %w", err))
	} else if err := sqlDB.Close(); err != nil {
		errs = append(errs, fmt.Errorf("close mysql: %w", err))
	}
	if err := d.mongoClient.Disconnect(ctx); err != nil {
		errs = append(errs, fmt.Errorf("disconnect mongodb: %w", err))
	}
	return errors.Join(errs...)
}

func newMySQL(c config.MySQLConfig) (*gorm.DB, error) {
	dsn := fmt.Sprintf("%s:%s@tcp(%s)/%s?charset=utf8mb4&parseTime=True&loc=Asia%%2FShanghai",
		c.User, c.Pwd, c.URL, c.DBName)
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		return nil, fmt.Errorf("connect mysql: %w", err)
	}
	return db, nil
}

func newMongo(c config.MongoDBConfig) (*mongo.Client, error) {
	opts := options.Client().
		ApplyURI(c.URL).
		SetMaxPoolSize(c.MaxPool).
		SetMinPoolSize(c.MinPool)
	if c.User != "" {
		opts.SetAuth(options.Credential{Username: c.User, Password: c.Pwd})
	}

	ctx, cancel := context.WithTimeout(context.Background(), connectTimeout)
	defer cancel()

	client, err := mongo.Connect(ctx, opts)
	if err != nil {
		return nil, fmt.Errorf("connect mongodb: %w", err)
	}
	if err := client.Ping(ctx, nil); err != nil {
		_ = client.Disconnect(context.Background())
		return nil, fmt.Errorf("ping mongodb: %w", err)
	}
	return client, nil
}

// InitRedis 建立 Redis 连接，供 JWT 黑名单和限流使用，成功后可通过 GetRedis 获取。
func InitRedis(conf *config.TomlConfig) (*redis.Client, error) {
	client := redis.NewClient(&redis.Options{
		Addr:     conf.Redis.URL,
		Password: conf.Redis.Pwd,
		DB:       conf.Redis.DB,
	})

	ctx, cancel := context.WithTimeout(context.Background(), connectTimeout)
	defer cancel()
	if err := client.Ping(ctx).Err(); err != nil {
		_ = client.Close()
		return nil, fmt.Errorf("connect redis: %w", err)
	}

	rdb = client
	return rdb, nil
}

// GetRedis 返回 InitRedis 创建的全局实例。
func GetRedis() *redis.Client {
	return rdb
}
