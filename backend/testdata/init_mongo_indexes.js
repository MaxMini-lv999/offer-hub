// 题库查询链路用到的 MongoDB 索引。可重复执行：同名、同定义的索引已存在时 createIndex 什么都不做。
// 只建索引：不改数据、不删索引，也不碰下面 6 个集合以外的集合。
//
// 用法（在 backend 下执行；脚本只用 mongosh 当前连接的库，不写连接地址）：
//   mongosh "mongodb://127.0.0.1:27017/offer_hub" testdata/init_mongo_indexes.js
// 库名以 src/config-test.toml 里 [MongoDB] database 为准。种子数据（npm run seed）之前、之后执行都行。
//
// 索引照着 data 层的真实查询设计（data/question.go、comment.go、interaction.go、user_question_tag.go）：
//   - 题目列表按 (sort_by, _id) 排序，_id 兜底让分页稳定，所以 _id 也放进索引：
//     默认的 order 升序这样能直接按索引顺序取一页，不用把命中的题全捞出来在内存里排
//   - 前端调 /question/list 不传 job_name，所以列表索引不以 job_name 开头：
//     查询条件里没有索引的第一个字段时，MongoDB 不会用这个索引（除非它正好能提供排序）
//   - bank_list 和 tags 都是数组，不能放进同一个复合索引：
//     一个文档里两个被索引的字段都是数组时，MongoDB 会拒绝建索引和写入（cannot index parallel arrays）
//   - 其他排序（create_time、view_count 等）和多条件组合只靠下面的索引缩小范围，再在内存里排，不为每种组合加索引
//
// 命名：查询用的索引叫 idx_<集合>_<字段>。唯一索引沿用 MongoDB 默认名（如 question_id_1），因为种子脚本
// （common.js 的 seedCollection）和后端启动时的 data.EnsureMongoIndexes 也会建它们：同样的键换个名字再建
// 会报 IndexOptionsConflict（code 85），后建的那一方失败，后端直接启动不了。

const INDEXES = {
  question: [
    // 题目详情、点赞计数 $inc、种子按它 upsert
    { key: { question_id: 1 }, name: 'question_id_1', unique: true },
    // 全部题目页：不带筛选或只带 keyword；只按 status 统计总数时只扫索引，不读文档
    { key: { status: 1, order: 1, _id: 1 }, name: 'idx_question_status_order' },
    // 题库页列表、题库内导航（meta/list）、题库目录里的题数统计（CountQuestionByBankIDs）
    { key: { status: 1, bank_list: 1, order: 1, _id: 1 }, name: 'idx_question_status_bank_order' },
    // 按标签筛选；tags 用 $all 时按第一个标签走索引，其余标签在取到的文档上过滤
    { key: { status: 1, tags: 1, order: 1, _id: 1 }, name: 'idx_question_status_tags_order' },
    // 按难度筛选
    {
      key: { status: 1, difficulty: 1, order: 1, _id: 1 },
      name: 'idx_question_status_difficulty_order',
    },
    // 热门题目（ListHotQuestions）：按 hot_degree 降序取前 N 条，前端总会带 job_name
    {
      key: { status: 1, job_name: 1, hot_degree: -1, _id: 1 },
      name: 'idx_question_status_job_hot_degree',
    },
  ],
  question_bank_series: [
    { key: { series_id: 1 }, name: 'series_id_1', unique: true },
    // 题库目录传了 job_name 时按岗位取系列
    { key: { job_name: 1, order: 1 }, name: 'idx_question_bank_series_job_order' },
  ],
  question_bank: [
    { key: { bank_id: 1 }, name: 'bank_id_1', unique: true },
    // 题库目录传了 job_name 时按岗位取题库（ListQuestionBank 只按 job_name 过滤、按 order 排，不按系列查）
    { key: { job_name: 1, order: 1 }, name: 'idx_question_bank_job_order' },
  ],
  user_question_tag: [
    // 同一用户对同一道题只有一条标记，详情页查标记也走它
    { key: { user_id: 1, question_id: 1 }, name: 'user_id_1_question_id_1', unique: true },
    // 登录用户的题目列表按掌握状态（user_tag）筛选：查出这个用户某种标记的全部 question_id，只扫索引
    {
      key: { user_id: 1, tag: 1, question_id: 1 },
      name: 'idx_user_question_tag_user_tag_question',
    },
  ],
  user_interactions: [
    // 同一用户对同一目标的同一种交互只有一条记录，保证点赞幂等。
    // 是否点赞（IsQuestionLiked）、批量查点赞状态（GetLikedTargetIDs 的 target_id $in）也走它，
    // status 在取到的文档上过滤，最多多读几条已取消的记录，所以不再单独建索引。
    // 点赞数存在 question.thumbs_up_count / comments.thumbs_up 里，不从这个集合统计，也不需要统计用的索引
    {
      key: { user_id: 1, target_type: 1, target_id: 1, interaction_type: 1 },
      name: 'user_id_1_target_type_1_target_id_1_interaction_type_1',
      unique: true,
    },
  ],
  comments: [
    // 按 comment_id 查一条评论（详情、回复时查父评论、删除、修改、点赞计数 $inc）；种子脚本也会建它，沿用默认名
    { key: { comment_id: 1 }, name: 'comment_id_1', unique: true },
    // 评论列表（ListComments）：4 个等值条件在前，排序字段在后（ESR）。
    // 顶层评论默认 create_time 倒序、"查看更多回复"默认正序，data 层的 _id 兜底方向跟随主排序，
    // 一个升序索引正着扫、倒着扫都能直接取一页，不用内存排序；分页前的 CountDocuments 只扫索引
    {
      key: { target_type: 1, target_id: 1, parent_id: 1, status: 1, create_time: 1, _id: 1 },
      name: 'idx_comments_target_parent_status_time',
    },
    // 顶层评论附带的子评论（ListSubCommentsByParentIDs）：parent_id $in 一页顶层评论的 ID，按 create_time 正序。
    // $in 的每个值各取一段已经排好序的索引，再归并（SORT_MERGE），不用把所有回复读出来再排
    {
      key: { parent_id: 1, status: 1, create_time: 1, _id: 1 },
      name: 'idx_comments_parent_status_time',
    },
  ],
};

// 集合还不存在时 getIndexes 会报 NamespaceNotFound（code 26），当作没有索引；createIndex 会顺便建出集合
function indexNames(coll) {
  try {
    return new Set(coll.getIndexes().map((idx) => idx.name));
  } catch (err) {
    if (err.code === 26) {
      return new Set();
    }
    throw err;
  }
}

function ensureIndexes(name, indexes) {
  print(`creating indexes for ${name}...`);
  const coll = db.getCollection(name);
  const before = indexNames(coll);
  for (const { key, ...options } of indexes) {
    coll.createIndex(key, options);
    const state = before.has(options.name) ? 'exists ' : 'created';
    print(`  ${state} ${options.name} ${JSON.stringify(key)}${options.unique ? ' unique' : ''}`);
  }
  print(`indexes for ${name} ready: ${[...indexNames(coll)].join(', ')}`);
}

// 连接串里没写库名时 mongosh 连的是 test 库，在那里建索引没有意义
if (db.getName() === 'test') {
  throw new Error(
    '当前连接的是 test 库，请在连接串里带上库名，例如 mongodb://127.0.0.1:27017/offer_hub',
  );
}

print(`database: ${db.getName()}`);
for (const [name, indexes] of Object.entries(INDEXES)) {
  ensureIndexes(name, indexes);
}
print('mongo indexes initialized');
