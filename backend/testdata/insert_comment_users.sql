-- 写入评论种子数据用到的 3 个测试用户（MySQL t_user_info），需要先执行 init_mysql_schema.sql。
-- insert_comment.js 里评论的 user_id / reply_to 引用的就是这里的 user_id。
--
-- 用法（在 backend/testdata 下）：
--   docker exec -i mysql-dev mysql -uroot -p1234 offer_hub < insert_comment_users.sql
--
-- 按 user_id 幂等写入：已存在的用户会被恢复成下面的昵称和头像，可重复执行。
-- 三个账号的密码都是 123456（bcrypt 哈希），可以直接登录，用来测 user_liked。
-- seed-user-ghost 故意不写入：它代表已注销的用户，评论列表里 user_name / user_avatar 应为空串。

-- 容器里 mysql 客户端默认按 latin1 发送，不加这句中文昵称会被二次编码成乱码
SET NAMES utf8mb4;

INSERT INTO `t_user_info` (`user_id`, `username`, `password`, `nick_name`, `avatar`) VALUES
  ('seed-user-001', 'seed_alice', '$2a$12$tm45JjxS.UjJtJhN6ngqueC/2SdGtqvoj.hLfuZEOFH.ktZgz8jtu', '小明', 'https://example.com/avatar/alice.png'),
  ('seed-user-002', 'seed_bob',   '$2a$12$tm45JjxS.UjJtJhN6ngqueC/2SdGtqvoj.hLfuZEOFH.ktZgz8jtu', '小红', 'https://example.com/avatar/bob.png'),
  ('seed-user-003', 'seed_carol', '$2a$12$tm45JjxS.UjJtJhN6ngqueC/2SdGtqvoj.hLfuZEOFH.ktZgz8jtu', '小刚', 'https://example.com/avatar/carol.png')
ON DUPLICATE KEY UPDATE
  `nick_name` = VALUES(`nick_name`),
  `avatar`    = VALUES(`avatar`);
