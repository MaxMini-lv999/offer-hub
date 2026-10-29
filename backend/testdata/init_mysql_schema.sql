-- 创建 MySQL 用户表 t_user_info，字段与索引以 doc/design/数据字典.md 为准。
-- 只建表，不写入任何数据；IF NOT EXISTS 保证可重复执行，已存在的表不会被改动。
--
-- 用法（在 backend/testdata 下，库 offer_hub 由 docker-compose 自动创建）：
--   docker exec -i mysql-dev mysql -uroot -p1234 offer_hub < init_mysql_schema.sql
--
-- 说明：
--   - email / phone 默认值是 ''，注册接口不收这两个字段，所以只建普通索引；
--     建成唯一索引会让第二个注册的用户因为重复的 '' 而失败
--   - 带默认值的 tinyint 字段也设为 NOT NULL，避免 Go 侧扫描到 NULL
--   - user_status 有 -1（禁用），所以 tinyint 不能用 UNSIGNED

CREATE TABLE IF NOT EXISTS `t_user_info` (
  `id`           INT           NOT NULL AUTO_INCREMENT COMMENT '主键',
  `user_id`      VARCHAR(256)  NOT NULL COMMENT '用户唯一标识，UUID',
  `username`     VARCHAR(50)   NOT NULL COMMENT '登录用户名',
  `password`     VARCHAR(100)  NOT NULL COMMENT 'bcrypt 加密后的密码',
  `nick_name`    VARCHAR(256)  NOT NULL DEFAULT '' COMMENT '昵称，默认与 username 相同',
  `avatar`       VARCHAR(256)  NOT NULL DEFAULT '' COMMENT '头像图片 URL',
  `introduction` VARCHAR(1024) NOT NULL DEFAULT '' COMMENT '个人简介',
  `phone`        VARCHAR(256)  NOT NULL DEFAULT '' COMMENT '手机号',
  `email`        VARCHAR(256)  NOT NULL DEFAULT '' COMMENT '邮箱',
  `sex`          TINYINT       NOT NULL DEFAULT 1 COMMENT '性别：1未知 2男 3女',
  `vip`          TINYINT       NOT NULL DEFAULT 0 COMMENT '是否 VIP：0否 1是',
  `user_status`  TINYINT       NOT NULL DEFAULT 1 COMMENT '账号状态：1正常 -1禁用',
  `user_type`    TINYINT       NOT NULL DEFAULT 1 COMMENT '用户类型：1普通用户 2内测用户',
  `create_time`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '注册时间',
  `update_time`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_id` (`user_id`),
  UNIQUE KEY `uk_username` (`username`),
  KEY `idx_phone` (`phone`),
  KEY `idx_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';
