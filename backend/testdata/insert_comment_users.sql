-- 写入评论种子数据用到的测试用户（MySQL t_user_info），需要先执行 init_mysql_schema.sql。
-- insert_comment.js 和 demo_comments.js 里评论的 user_id / reply_to 引用的就是这里的 user_id。
--
-- 用法（在 backend/testdata 下）：
--   docker exec -i mysql-dev mysql -uroot -p1234 offer_hub < insert_comment_users.sql
--
-- 按 user_id 幂等写入：已存在的用户会被恢复成下面的资料，可重复执行。
-- 所有账号的密码都是 123456（bcrypt 哈希），可以直接登录，用来测 user_liked。
-- seed-user-ghost 故意不写入：它代表已注销的用户，评论列表里 user_name / user_avatar 应为空串。
--
-- 头像（图片在 frontend/public/avatars/，由前端静态托管）：
--   - 内置默认头像 /avatars/default/01.svg ~ 12.svg：注册时随机分配的那种，下面随机挑了 11 个用户，
--     seed-user-002 和 seed-user-015 恰好抽到同一张（07）
--   - 自定义头像 /avatars/custom/<user_id>.png：模拟用户自己上传的图片，11 个用户
--   - seed-user-003 的头像地址打不开（example.com），用来看图片加载失败时的兜底
-- 其他场景：seed-user-022 已禁用（user_status=-1），登录返回 403，但他发过的评论照常显示；
-- vip、user_type、sex、introduction 都有不同取值，用来看个人资料接口。
-- 枚举值见 doc/design/状态与枚举.md：sex 1未知 2男 3女；user_type 1普通 2内测；user_status 1正常 -1禁用。

-- 容器里 mysql 客户端默认按 latin1 发送，不加这句中文昵称会被二次编码成乱码
SET NAMES utf8mb4;

SET @pwd = '$2a$12$tm45JjxS.UjJtJhN6ngqueC/2SdGtqvoj.hLfuZEOFH.ktZgz8jtu';

INSERT INTO `t_user_info`
  (`user_id`, `username`, `password`, `nick_name`, `avatar`, `introduction`, `sex`, `vip`, `user_status`, `user_type`, `create_time`)
VALUES
  ('seed-user-001', 'seed_alice',  @pwd, '小明',             '/avatars/custom/seed-user-001.png', '在读研究生，后端方向。',                       2, 0,  1, 1, '2024-02-20 10:00:00'),
  ('seed-user-002', 'seed_bob',    @pwd, '小红',             '/avatars/default/07.svg',           '',                                             3, 0,  1, 1, '2024-02-21 10:00:00'),
  ('seed-user-003', 'seed_carol',  @pwd, '小刚',             'https://example.com/avatar/carol.png', '',                                          2, 0,  1, 1, '2024-02-22 10:00:00'),
  ('seed-user-004', 'seed_dave',   @pwd, '阿杰',             '/avatars/default/03.svg',           'Go 后端两年，在一家做 SaaS 的公司写业务和中间件。', 2, 1,  1, 2, '2024-03-15 20:12:00'),
  ('seed-user-005', 'seed_erin',   @pwd, '林小鹿',           '/avatars/custom/seed-user-005.png', '27 届前端，正在准备春招，React 学习中。',       3, 0,  1, 1, '2025-09-01 09:30:00'),
  ('seed-user-006', 'seed_frank',  @pwd, '老周',             '/avatars/default/10.svg',           '做了八年后端，现在主要负责面试和带新人。',     2, 1,  1, 2, '2024-01-10 11:00:00'),
  ('seed-user-007', 'seed_grace',  @pwd, 'Grace',            '/avatars/custom/seed-user-007.png', 'AI 应用开发，做 RAG 和 Agent 相关的项目。',     3, 1,  1, 1, '2025-05-01 14:20:00'),
  ('seed-user-008', 'seed_henry',  @pwd, '秃头程序员',       '/avatars/custom/seed-user-008.png', '头发换经验，经验换 offer。',                   2, 0,  1, 1, '2024-06-01 23:05:00'),
  ('seed-user-009', 'seed_ivy',    @pwd, 'Gopher小陈',       '/avatars/default/12.svg',           '喜欢看 runtime 源码的 Gopher。',               1, 0,  1, 2, '2024-10-01 10:10:00'),
  ('seed-user-010', 'seed_jack',   @pwd, '杰克不加班',       '/avatars/custom/seed-user-010.png', '能用一行解决的绝不写两行。',                   2, 0,  1, 1, '2024-07-12 18:40:00'),
  ('seed-user-011', 'seed_kate',   @pwd, '柠檬茶',           '/avatars/default/05.svg',           '数据库方向，偶尔写写博客。',                   3, 0,  1, 1, '2024-05-20 13:14:00'),
  ('seed-user-012', 'seed_leo',    @pwd, 'Leo_刷题中',       '/avatars/custom/seed-user-012.png', '每天三道题，坚持打卡中。',                     2, 0,  1, 1, '2025-08-10 07:00:00'),
  ('seed-user-013', 'seed_mia',    @pwd, '米娅',             '/avatars/custom/seed-user-013.png', '前端工程师，Vue 技术栈。',                     3, 0,  1, 1, '2025-03-01 09:00:00'),
  ('seed-user-014', 'seed_nick',   @pwd, '夜猫子',           '/avatars/custom/seed-user-014.png', '白天上班，晚上刷题。',                         1, 0,  1, 1, '2024-09-03 01:30:00'),
  ('seed-user-015', 'seed_olivia', @pwd, '奥利奥',           '/avatars/default/07.svg',           'Java 转 Go 中。',                              3, 0,  1, 1, '2025-01-15 10:00:00'),
  ('seed-user-016', 'seed_paul',   @pwd, '保罗',             '/avatars/default/01.svg',           'DBA，专治各种慢查询。',                        2, 1,  1, 1, '2024-04-08 15:00:00'),
  ('seed-user-017', 'seed_quinn',  @pwd, '半糖',             '/avatars/custom/seed-user-017.png', '26 届，已上岸，回来分享面经。',                 3, 0,  1, 1, '2025-11-20 19:00:00'),
  ('seed-user-018', 'seed_ryan',   @pwd, '春招冲冲冲',       '/avatars/default/09.svg',           '双非本科，目标大厂后端。',                     2, 0,  1, 1, '2025-10-08 21:00:00'),
  ('seed-user-019', 'seed_sara',   @pwd, 'Sara',             '/avatars/custom/seed-user-019.png', '算法工程师，转做大模型应用。',                 3, 1,  1, 1, '2025-04-22 10:30:00'),
  ('seed-user-020', 'seed_tom',    @pwd, '汤姆猫',           '/avatars/custom/seed-user-020.png', '养了一只橘猫的后端开发。',                     1, 0,  1, 1, '2024-08-18 12:00:00'),
  ('seed-user-021', 'seed_uma',    @pwd, '雨天',             '/avatars/default/02.svg',           '',                                             1, 0,  1, 1, '2025-06-30 20:00:00'),
  ('seed-user-022', 'seed_victor', @pwd, '维克多',           '/avatars/default/11.svg',           '',                                             2, 0, -1, 1, '2024-12-05 16:00:00'),
  ('seed-user-023', 'seed_wendy',  @pwd, '今天也要好好刷题', '/avatars/default/06.svg',           '考研失败，转战春招。',                         3, 0,  1, 1, '2026-01-12 22:00:00')
ON DUPLICATE KEY UPDATE
  `nick_name`    = VALUES(`nick_name`),
  `avatar`       = VALUES(`avatar`),
  `introduction` = VALUES(`introduction`),
  `sex`          = VALUES(`sex`),
  `vip`          = VALUES(`vip`),
  `user_status`  = VALUES(`user_status`),
  `user_type`    = VALUES(`user_type`),
  `create_time`  = VALUES(`create_time`);
