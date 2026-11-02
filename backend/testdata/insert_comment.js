// 写入评论（comments）和评论点赞（user_interactions）种子数据。需要先执行 insert_question.js：
// 写入前会检查 target_type=1 的评论引用的 question_id 都已存在于 question。
// 评论者是 insert_comment_users.sql 里的 3 个测试用户，MySQL 里没有这几个用户时 user_name 会是空串。
//
// 用法（在 backend/testdata 下）：
//   node insert_comment.js           按 comment_id 幂等写入，可重复执行
//   node insert_comment.js --reset   先清空 comments 集合、删掉 3 个测试用户的交互记录，再写入
//
// 用户：seed-user-001 小明（seed_alice）、seed-user-002 小红（seed_bob）、seed-user-003 小刚（seed_carol），
// 密码都是 123456；seed-user-ghost 不在 MySQL 里，代表已注销的用户。
//
// 覆盖的场景（都在 q101 下，target_type=1）：
//   - 顶层评论：正常 c001 ~ c004 共 4 条；c005 审核中、c006 已删除，都不应返回
//   - 排序：按 create_time 是 c001 < c002 < c003 < c004，按 thumbs_up 降序是 c002 > c001 > c003 > c004，
//     按 view_count 降序是 c003 > c001 > c002 > c004，三种顺序都不一样
//   - 子评论：c001 下正常 7 条（r001 ~ r007，按时间正序），r008 已删除；默认嵌套前 5 条，sub_comment_total=7。
//     c001 的 child_count 故意写成 8（删除回复时没减），sub_comment_total 不应读它
//   - c002 下 1 条（r101），c003 下没有子评论（sub_comments 应为 []）
//   - 已注销用户：c004 和 r005 的作者是 seed-user-ghost，r006 回复的是 seed-user-ghost
//   - 隔离：c201 在 q102 下；c301 的 target_type=2（面经），target_id 恰好也叫 q101
//   - 点赞（小刚登录）：c001、r002、r101 已赞；r003 的点赞已取消（status=0）；c002 只有 target_type=1 的记录、
//     c003 只有点踩记录，都不算已赞。小明登录时只有 c002 已赞

import { assertRefsExist, bj, RESET, run, seedCollection } from './common.js';

const ALICE = 'seed-user-001';
const BOB = 'seed-user-002';
const CAROL = 'seed-user-003';
const GHOST = 'seed-user-ghost';
const SEED_USERS = [ALICE, BOB, CAROL];

// comments.status，见 状态与枚举.md
const STATUS_REVIEWING = 1;
const STATUS_NORMAL = 2;
const STATUS_DELETED = 5;

// user_interactions 的枚举值
const TARGET_QUESTION = 1;
const TARGET_COMMENT = 3;
const TYPE_LIKE = 1;
const TYPE_DISLIKE = 2;

// comment 补齐一条评论的全部字段；question_id 只有评论对象是题目时才有值
function comment(id, f) {
  const targetType = f.targetType ?? 1;
  const targetID = f.targetID ?? 'q101';
  const t = bj(f.time);
  return {
    comment_id: id,
    target_type: targetType,
    target_id: targetID,
    question_id: targetType === 1 ? targetID : '',
    user_id: f.user,
    content: f.content,
    parent_id: f.parent ?? '',
    reply_to: f.replyTo ?? '',
    child_count: f.childCount ?? 0,
    thumbs_up: f.thumbsUp ?? 0,
    view_count: f.viewCount ?? 0,
    status: f.status ?? STATUS_NORMAL,
    create_time: t,
    update_time: t,
  };
}

const COMMENTS = [
  // ---------- q101 顶层评论 ----------
  comment('c001', { user: ALICE, content: '这道题解析写得很清楚', time: '2024-03-01 10:00:00', thumbsUp: 10, viewCount: 100, childCount: 8 }),
  comment('c002', { user: BOB, content: 'AOF 重写那段能再展开讲讲吗', time: '2024-03-02 10:00:00', thumbsUp: 30, viewCount: 20, childCount: 1 }),
  comment('c003', { user: CAROL, content: '面试被问到过混合持久化', time: '2024-03-03 10:00:00', thumbsUp: 5, viewCount: 300 }),
  comment('c004', { user: GHOST, content: '这题我背过', time: '2024-03-04 10:00:00', thumbsUp: 1, viewCount: 5 }),
  comment('c005', { user: ALICE, content: '审核中的评论', time: '2024-03-05 10:00:00', status: STATUS_REVIEWING }),
  comment('c006', { user: BOB, content: '已删除的评论', time: '2024-03-06 10:00:00', status: STATUS_DELETED }),

  // ---------- c001 的子评论 ----------
  comment('r001', { user: BOB, parent: 'c001', replyTo: ALICE, content: '同意', time: '2024-03-01 11:00:00' }),
  comment('r002', { user: CAROL, parent: 'c001', replyTo: BOB, content: '+1', time: '2024-03-01 12:00:00', thumbsUp: 2 }),
  comment('r003', { user: ALICE, parent: 'c001', replyTo: CAROL, content: '谢谢', time: '2024-03-01 13:00:00' }),
  comment('r004', { user: BOB, parent: 'c001', replyTo: ALICE, content: 'RDB 那段也不错', time: '2024-03-01 14:00:00' }),
  comment('r005', { user: GHOST, parent: 'c001', replyTo: BOB, content: '已注销用户的回复', time: '2024-03-01 15:00:00' }),
  comment('r006', { user: CAROL, parent: 'c001', replyTo: GHOST, content: '回复一个已注销的用户', time: '2024-03-01 16:00:00' }),
  comment('r007', { user: ALICE, parent: 'c001', replyTo: CAROL, content: '第 7 条回复', time: '2024-03-01 17:00:00' }),
  comment('r008', { user: BOB, parent: 'c001', replyTo: ALICE, content: '已删除的回复', time: '2024-03-01 18:00:00', status: STATUS_DELETED }),

  // ---------- c002 的子评论 ----------
  comment('r101', { user: ALICE, parent: 'c002', replyTo: BOB, content: '文档第 3 节有讲', time: '2024-03-02 11:00:00' }),

  // ---------- 隔离：别的题、别的 target_type ----------
  comment('c201', { user: BOB, targetID: 'q102', content: 'q102 下的评论', time: '2024-03-01 09:00:00' }),
  comment('c301', { user: CAROL, targetType: 2, content: '面经下的评论，target_id 恰好也叫 q101', time: '2024-03-01 09:30:00' }),
];

// interaction 构造一条交互记录
function interaction(user, targetType, targetID, interactionType, status) {
  const t = bj('2024-03-10 10:00:00');
  return {
    user_id: user,
    target_type: targetType,
    target_id: targetID,
    interaction_type: interactionType,
    status,
    create_time: t,
    update_time: t,
  };
}

const INTERACTIONS = [
  interaction(CAROL, TARGET_COMMENT, 'c001', TYPE_LIKE, 1),
  interaction(CAROL, TARGET_COMMENT, 'r002', TYPE_LIKE, 1),
  interaction(CAROL, TARGET_COMMENT, 'r101', TYPE_LIKE, 1),
  interaction(CAROL, TARGET_COMMENT, 'r003', TYPE_LIKE, 0), // 已取消
  interaction(CAROL, TARGET_QUESTION, 'c002', TYPE_LIKE, 1), // target_type 不对
  interaction(CAROL, TARGET_COMMENT, 'c003', TYPE_DISLIKE, 1), // 点踩不是点赞
  interaction(ALICE, TARGET_COMMENT, 'c002', TYPE_LIKE, 1),
];

// seedInteractions 按 (user_id, target_type, target_id, interaction_type) 幂等写入。
// --reset 只删 3 个测试用户的记录，不动其他用户的点赞
async function seedInteractions(db) {
  const coll = db.collection('user_interactions');
  if (RESET) {
    const { deletedCount } = await coll.deleteMany({ user_id: { $in: SEED_USERS } });
    console.log(`[user_interactions] --reset：已删除测试用户的 ${deletedCount} 条`);
  }

  const ops = INTERACTIONS.map((doc) => ({
    updateOne: {
      filter: {
        user_id: doc.user_id,
        target_type: doc.target_type,
        target_id: doc.target_id,
        interaction_type: doc.interaction_type,
      },
      update: { $set: doc },
      upsert: true,
    },
  }));
  const r = await coll.bulkWrite(ops, { ordered: true });
  console.log(`[user_interactions] 种子 ${INTERACTIONS.length} 条：新增 ${r.upsertedCount}，更新 ${r.modifiedCount}`);
}

await run(async (db) => {
  const questionIDs = COMMENTS.filter((c) => c.target_type === 1).map((c) => c.target_id);
  await assertRefsExist(db, 'question', 'question_id', questionIDs, '请先执行 node insert_question.js');

  await seedCollection(db, 'comments', 'comment_id', COMMENTS);
  await seedInteractions(db);
});
