# offer-hub 后端

开发命令见根目录 `CLAUDE.md`，接口和数据结构见 `doc/design/`。

## MongoDB 索引

题库查询链路（题目列表、题库目录、热门题目、评论、点赞和掌握标记）用到的索引由 `testdata/init_mongo_indexes.js` 创建。脚本可以重复执行：只建索引，不改数据，不删索引，在种子数据（`testdata` 下 `npm run seed`）之前、之后执行都可以。

### 执行

```bash
cd backend
mongosh "mongodb://127.0.0.1:27017/offer_hub" testdata/init_mongo_indexes.js
```

库名以 `src/config-test.toml` 里 `[MongoDB]` 的 `database` 为准，不是 `offer_hub` 时改连接串最后一段。连接串里不写库名时，mongosh 默认连 `test` 库，脚本会直接报错退出。

每个集合会打印 `created`（新建）或 `exists`（已存在，跳过），最后打印 `mongo indexes initialized`。

### 索引清单

| 集合 | 索引名 | 键 | 服务的查询 |
|---|---|---|---|
| question | `question_id_1`（唯一） | question_id | 题目详情、点赞计数 |
| question | `idx_question_status_order` | status, order, _id | 全部题目（无筛选 / 关键词） |
| question | `idx_question_status_bank_order` | status, bank_list, order, _id | 题库页列表、题库内导航、题库题数统计 |
| question | `idx_question_status_tags_order` | status, tags, order, _id | 按标签筛选 |
| question | `idx_question_status_difficulty_order` | status, difficulty, order, _id | 按难度筛选 |
| question | `idx_question_status_job_hot_degree` | status, job_name, hot_degree(-1), _id | 热门题目 |
| question_bank_series | `series_id_1`（唯一） | series_id | 系列 ID 唯一 |
| question_bank_series | `idx_question_bank_series_job_order` | job_name, order | 题库目录（传 job_name 时） |
| question_bank | `bank_id_1`（唯一） | bank_id | 题库 ID 唯一 |
| question_bank | `idx_question_bank_job_order` | job_name, order | 题库目录（传 job_name 时） |
| user_question_tag | `user_id_1_question_id_1`（唯一） | user_id, question_id | 标记幂等、详情页的掌握状态 |
| user_question_tag | `idx_user_question_tag_user_tag_question` | user_id, tag, question_id | 登录用户的列表按掌握状态筛选 |
| user_interactions | `user_id_1_target_type_1_target_id_1_interaction_type_1`（唯一） | user_id, target_type, target_id, interaction_type | 点赞幂等、是否点赞、批量查点赞状态 |
| comments | `comment_id_1`（唯一） | comment_id | 查单条评论、回复时查父评论、删除、修改、点赞计数 |
| comments | `idx_comments_target_parent_status_time` | target_type, target_id, parent_id, status, create_time, _id | 评论列表（顶层倒序、"查看更多回复"正序都直接按索引取） |
| comments | `idx_comments_parent_status_time` | parent_id, status, create_time, _id | 顶层评论附带的子评论（parent_id $in，SORT_MERGE 归并） |

设计取舍（详细注释在脚本开头）：

- **唯一索引沿用 MongoDB 默认名**。种子脚本（`common.js`）和后端启动时的 `data.EnsureMongoIndexes` 也会建这几个唯一索引，同样的键换个名字再建会报 `IndexOptionsConflict`（code 85），后建的一方失败，后端直接启动不了。
- **列表索引不以 job_name 开头**。前端调 `/question/list` 不传 job_name，查询条件里没有索引的第一个字段时 MongoDB 不会用这个索引。
- **_id 放进列表索引**。列表按 `(order, _id)` 排序，_id 兜底保证分页稳定；索引里带上 _id，默认排序才能直接按索引顺序取一页，没有内存排序。
- **bank_list 和 tags 不放进同一个索引**。两者都是数组，一个复合索引里最多只能有一个数组字段。
- **不为每种组合建索引**。其他排序字段（create_time、view_count 等）和多条件组合只靠上面的索引缩小范围，再在内存里排序。点赞数存在题目和评论文档里，不从 `user_interactions` 统计，所以这个集合只有唯一索引。

### 验证

连上数据库（`mongosh "mongodb://127.0.0.1:27017/offer_hub"`）后查看索引：

```js
db.question.getIndexes()
db.question_bank.getIndexes()
db.question_bank_series.getIndexes()
db.user_question_tag.getIndexes()
db.user_interactions.getIndexes()
db.comments.getIndexes()
```

题库页列表的 explain。前端进入题库时发的就是这种查询：只带 bank_id，按 order 升序，每页 20 条：

```js
db.question.find({ status: 1, bank_list: 'b001' }).sort({ order: 1, _id: 1 }).limit(20).explain('executionStats')
```

预期：

- `queryPlanner.winningPlan` 是 `LIMIT ← FETCH ← IXSCAN`，`indexName` 为 `idx_question_status_bank_order`，不是 `COLLSCAN`
- 没有 `SORT` 阶段，结果直接按索引顺序取出
- `executionStats.totalDocsExamined` 等于返回条数，明显小于集合总文档数（`db.question.countDocuments()`）

热门题目同理，应命中 `idx_question_status_job_hot_degree`，`totalDocsExamined` 等于 limit：

```js
db.question.find({ status: 1, job_name: '后端开发' }).sort({ hot_degree: -1, _id: 1 }).limit(10).explain('executionStats')
```

评论列表默认按时间倒序，应倒着扫 `idx_comments_target_parent_status_time`，没有 `SORT` 阶段。data 层的 `_id` 兜底方向跟随主排序，如果写成 `{ create_time: -1, _id: 1 }`，即使有这个索引也会多出一个 `SORT` 阶段：

```js
db.comments.find({ target_type: 1, target_id: 'q142', parent_id: '', status: 2 }).sort({ create_time: -1, _id: -1 }).limit(20).explain('executionStats')
```

本地种子数据只有几十道题，扫描量的差别不明显，主要看有没有用上索引、有没有 `SORT` 阶段。
