// 写入题目（question）种子数据。需要先执行 insert_bank_and_series.js：
// 写入前会检查每道题 bank_list 里的 bank_id 都已存在于 question_bank。
//
// 用法（在 backend/testdata 下）：
//   node insert_question.js           按 question_id 幂等写入，可重复执行
//   node insert_question.js --reset   先清空 question 集合再写入
//
// 每次执行都会把题目恢复成下面的初始值（view_count 等计数也会被重置）。
// create_time / update_time 按北京时间书写；order 取数组下标 + 1。
//
// q101 ~ q106 与之前手工插入的数据保持一致，后面的题覆盖这些场景：
//   - 状态：q106 / q125 隐藏（status=2），q111 删除（status=3），所有接口和题库计数都不应返回它们
//   - 热门排序：q107 hot_degree 最高（95）但 view_count 很低（150），q108 正好相反，
//     按 hot_degree 和按 view_count 排出来的顺序不同
//   - 排序并列：q103 和 q109 的 view_count 都是 300，用来看 _id 兜底排序是否稳定
//   - 多题库：q105（b001+b002）、q113（b002+b007）、q119（b006+b007）、q133（b009+b010）
//   - keyword：q107 标题含 "count(*)"（正则特殊字符）；q110 只在正文里有 "两阶段提交"；
//     q103 标题是小写 "redis"、q105 正文是大写 "REDIS"（大小写不敏感）
//   - tags：$all 组合查询，比如 tags=Go&tags=并发 只命中 q119 / q123 / q124
//   - VIP：q109、q113、q122、q129、q133
//   - 时区：q121 创建于北京时间 2025-01-01 00:30，按 UTC 或美东时间格式化会显示成 2024-12-31
//   - 分页：后端开发下正常状态的题共 21 道，默认 page_size=20 时第 2 页有 1 道
//   - 空题库：b004 没有任何题目
//   - 题目解析：只有 q101、q102 有 analysis_content，游客详情里应为空串

import { Long } from 'mongodb';
import { assertRefsExist, bj, run, seedCollection } from './common.js';

const STATUS_NORMAL = 1;
const STATUS_HIDDEN = 2;
const STATUS_DELETED = 3;

const QUESTIONS = [
  // ---------- 原有数据 q101 ~ q106 ----------
  {
    question_id: 'q101', title: 'Redis 的持久化机制有哪些？',
    content: 'Redis 提供了 RDB 和 AOF 两种持久化方式。',
    analysis_content: 'RDB 是定时快照，恢复快但可能丢最后一次快照之后的数据；AOF 记录每条写命令，数据更完整但文件更大。生产上一般两者同时开启。',
    bank_list: ['b002'], job_name: '后端开发', difficulty: 2, tags: ['Redis', '数据库'],
    hot_degree: 85, view_count: 1024, thumbs_up_count: 256, dislike_count: 12,
    create_time: '2024-01-01 12:00:00',
  },
  {
    question_id: 'q102', title: 'MySQL 索引为什么用 B+ 树？',
    content: 'MySQL 的 InnoDB 存储引擎选择 B+ 树作为索引结构，主要有以下几个原因。第一，B+ 树是多路平衡查找树，每个节点可以存放大量的键，树的高度通常只有三到四层，一次查询只需要很少的磁盘 IO。第二，B+ 树的非叶子节点只存放键不存放数据，同样大小的页能容纳更多的键，进一步降低树高。第三，所有数据都存放在叶子节点，并且叶子节点之间用双向链表相连，范围查询和排序只需要顺序遍历链表即可，这是哈希索引和普通 B 树都做不到的。第四，查询任何一条记录都要走到叶子节点，查询性能稳定，不会忽快忽慢。【这句话在第一百五十个字之后，游客看不到】',
    analysis_content: '答题时按"树高 → 非叶子节点不存数据 → 叶子链表支持范围查询 → 查询性能稳定"的顺序说，最后可以对比哈希索引和 B 树。',
    bank_list: ['b001'], job_name: '后端开发', difficulty: 3, tags: ['MySQL', '数据库'],
    hot_degree: 90, view_count: 2048, thumbs_up_count: 512, dislike_count: 3,
    create_time: '2024-02-01 12:00:00',
  },
  {
    question_id: 'q103', title: 'redis 缓存穿透怎么解决？',
    content: '可以用布隆过滤器或缓存空值。',
    bank_list: ['b002'], job_name: '后端开发', difficulty: 2, tags: ['Redis', '缓存'],
    hot_degree: 60, view_count: 300, thumbs_up_count: 50, dislike_count: 30,
    create_time: '2024-03-01 12:00:00',
  },
  {
    question_id: 'q104', title: 'Vue 的响应式原理',
    content: 'Vue 3 基于 Proxy 实现响应式。',
    bank_list: ['b003'], job_name: '前端开发', difficulty: 1, tags: ['Vue', '前端'],
    hot_degree: 70, view_count: 800, thumbs_up_count: 100, dislike_count: 5,
    create_time: '2024-04-01 12:00:00',
  },
  {
    question_id: 'q105', title: 'MySQL 事务隔离级别',
    content: '四种隔离级别：读未提交、读已提交、可重复读、串行化。顺便和 REDIS 的事务做个对比。',
    bank_list: ['b001', 'b002'], job_name: '后端开发', difficulty: 1, tags: ['MySQL', 'Redis', '数据库'],
    hot_degree: 40, view_count: 50, thumbs_up_count: 10, dislike_count: 1,
    create_time: '2024-05-01 12:00:00',
  },
  {
    question_id: 'q106', title: 'Redis 已隐藏的题',
    content: 'status=2，任何查询都不应该出现。',
    bank_list: ['b002'], job_name: '后端开发', difficulty: 2, tags: ['Redis'], status: STATUS_HIDDEN,
    hot_degree: 99, view_count: 9999, thumbs_up_count: 999, dislike_count: 0,
    create_time: '2024-06-01 12:00:00',
  },

  // ---------- MySQL题库 b001 ----------
  {
    question_id: 'q107', title: 'MySQL 中 count(*) 和 count(1) 有什么区别？',
    content: '## 结论\n\nInnoDB 下 `count(*)` 和 `count(1)` 性能基本一致，`count(字段)` 会跳过 NULL。',
    bank_list: ['b001'], job_name: '后端开发', difficulty: 1, tags: ['MySQL', 'SQL'],
    hot_degree: 95, view_count: 150, thumbs_up_count: 80, dislike_count: 2,
    create_time: '2024-06-15 10:30:00',
  },
  {
    question_id: 'q108', title: '什么是 MVCC？它解决了什么问题？',
    content: 'MVCC 通过 **undo log 版本链** 和 **ReadView** 实现一致性读，让读写互不阻塞。',
    bank_list: ['b001'], job_name: '后端开发', difficulty: 3, tags: ['MySQL', '事务', '数据库'],
    hot_degree: 30, view_count: 5000, thumbs_up_count: 600, dislike_count: 8,
    create_time: '2024-07-01 14:00:00', update_time: '2024-09-01 09:15:00',
  },
  {
    question_id: 'q109', title: 'MySQL 慢查询如何定位和优化？',
    content: '1. 开启慢查询日志\n2. 用 `EXPLAIN` 看执行计划\n3. 针对性加索引或改写 SQL',
    bank_list: ['b001'], job_name: '后端开发', difficulty: 2, tags: ['MySQL', '性能优化'], vip: true,
    hot_degree: 55, view_count: 300, thumbs_up_count: 40, dislike_count: 4,
    create_time: '2024-07-20 16:45:00',
  },
  {
    question_id: 'q110', title: 'redo log 和 binlog 的区别',
    content: 'redo log 是 InnoDB 的物理日志，binlog 是 Server 层的逻辑日志，两者通过两阶段提交保证一致。',
    bank_list: ['b001'], job_name: '后端开发', difficulty: 3, tags: ['MySQL', '日志'],
    hot_degree: 65, view_count: 700, thumbs_up_count: 90, dislike_count: 6,
    create_time: '2024-08-05 11:20:00',
  },
  {
    question_id: 'q111', title: 'MySQL 的锁有哪些？（已删除）',
    content: 'status=3，任何查询都不应该出现。',
    bank_list: ['b001'], job_name: '后端开发', difficulty: 2, tags: ['MySQL'], status: STATUS_DELETED,
    hot_degree: 88, view_count: 3000, thumbs_up_count: 200, dislike_count: 20,
    create_time: '2024-08-10 10:00:00',
  },

  // ---------- Redis题库 b002 ----------
  {
    question_id: 'q112', title: 'Redis 为什么这么快？',
    content: '纯内存操作、单线程避免上下文切换、IO 多路复用、高效的数据结构。',
    bank_list: ['b002'], job_name: '后端开发', difficulty: 1, tags: ['Redis'],
    hot_degree: 75, view_count: 1500, thumbs_up_count: 300, dislike_count: 10,
    create_time: '2024-08-20 09:00:00',
  },
  {
    question_id: 'q113', title: 'Redis 分布式锁怎么实现？要注意哪些问题？',
    content: '`SET key value NX PX 30000` 加锁，释放时用 Lua 脚本校验 value，注意锁续期和误删。',
    bank_list: ['b002', 'b007'], job_name: '后端开发', difficulty: 3, tags: ['Redis', '分布式锁', '并发'], vip: true,
    hot_degree: 80, view_count: 900, thumbs_up_count: 150, dislike_count: 9,
    create_time: '2024-09-10 20:30:00',
  },
  {
    question_id: 'q114', title: 'Redis 的过期删除和内存淘汰策略',
    content: '过期删除：惰性删除 + 定期删除。内存淘汰：noeviction、allkeys-lru、volatile-lru 等 8 种。',
    bank_list: ['b002'], job_name: '后端开发', difficulty: 2, tags: ['Redis', '缓存'],
    hot_degree: 50, view_count: 420, thumbs_up_count: 60, dislike_count: 3,
    create_time: '2024-09-25 15:10:00',
  },

  // ---------- Gin题库 b005 ----------
  {
    question_id: 'q115', title: 'Gin 的中间件是怎么执行的？c.Next() 和 c.Abort() 有什么作用？',
    content: '中间件按注册顺序组成 handler 链，`c.Next()` 执行后续 handler，`c.Abort()` 阻止后续 handler 执行，但不会中断当前函数。',
    bank_list: ['b005'], job_name: '后端开发', difficulty: 2, tags: ['Go', 'Gin', '中间件'],
    hot_degree: 72, view_count: 640, thumbs_up_count: 88, dislike_count: 2,
    create_time: '2024-10-08 10:00:00',
  },
  {
    question_id: 'q116', title: 'Gin 的路由是怎么实现的？',
    content: 'Gin 基于 httprouter，用前缀树（radix tree）存路由，每种 HTTP 方法一棵树。',
    bank_list: ['b005'], job_name: '后端开发', difficulty: 3, tags: ['Go', 'Gin'],
    hot_degree: 45, view_count: 210, thumbs_up_count: 30, dislike_count: 1,
    create_time: '2024-10-20 17:00:00',
  },
  {
    question_id: 'q117', title: 'ShouldBind 和 Bind 的区别',
    content: '`Bind` 绑定失败会自动返回 400 并 `Abort`；`ShouldBind` 只返回 error，由调用方决定怎么响应。',
    bank_list: ['b005'], job_name: '后端开发', difficulty: 1, tags: ['Go', 'Gin'],
    hot_degree: 35, view_count: 180, thumbs_up_count: 25, dislike_count: 0,
    create_time: '2024-11-02 13:30:00',
  },

  // ---------- Go基础题库 b006 ----------
  {
    question_id: 'q118', title: 'Go 中 slice 和数组的区别？扩容机制是怎样的？',
    content: '数组是值类型、长度固定；slice 是对底层数组的引用（指针、len、cap），`append` 超过 cap 时扩容。',
    bank_list: ['b006'], job_name: '后端开发', difficulty: 2, tags: ['Go', 'slice'],
    hot_degree: 82, view_count: 1800, thumbs_up_count: 320, dislike_count: 7,
    create_time: '2024-11-15 09:40:00',
  },
  {
    question_id: 'q119', title: 'Go 的 map 是并发安全的吗？',
    content: '不是，并发读写会直接 fatal。可以用 `sync.RWMutex` 加锁，或者使用 `sync.Map`。',
    bank_list: ['b006', 'b007'], job_name: '后端开发', difficulty: 2, tags: ['Go', 'map', '并发'],
    hot_degree: 78, view_count: 1100, thumbs_up_count: 210, dislike_count: 4,
    create_time: '2024-12-01 10:10:00',
  },
  {
    question_id: 'q120', title: 'Go 中 nil slice 和空 slice 有什么区别？',
    content: '`var s []int` 是 nil，JSON 序列化为 `null`；`s := []int{}` 或 `make([]int, 0)` 是空 slice，序列化为 `[]`。',
    bank_list: ['b006'], job_name: '后端开发', difficulty: 1, tags: ['Go', 'slice'],
    hot_degree: 20, view_count: 90, thumbs_up_count: 15, dislike_count: 0,
    create_time: '2024-12-10 21:00:00',
  },
  {
    question_id: 'q121', title: 'Go 的 defer 执行顺序与常见陷阱',
    content: 'defer 按 LIFO 顺序执行，参数在 defer 语句处求值；注意循环里 defer 和对返回值的修改。',
    bank_list: ['b006'], job_name: '后端开发', difficulty: 2, tags: ['Go'],
    hot_degree: 58, view_count: 520, thumbs_up_count: 70, dislike_count: 3,
    create_time: '2025-01-01 00:30:00',
  },
  {
    question_id: 'q122', title: 'interface 的底层结构是什么？',
    content: '空接口是 `eface`（类型 + 数据指针），非空接口是 `iface`（itab + 数据指针）。',
    bank_list: ['b006'], job_name: '后端开发', difficulty: 3, tags: ['Go', 'interface'], vip: true,
    hot_degree: 48, view_count: 260, thumbs_up_count: 45, dislike_count: 2,
    create_time: '2025-01-18 14:20:00',
  },

  // ---------- Go并发题库 b007 ----------
  {
    question_id: 'q123', title: 'GMP 调度模型是什么？',
    content: 'G 是 goroutine，M 是系统线程，P 是逻辑处理器；M 必须绑定 P 才能运行 G，空闲时会从别的 P 偷任务。',
    bank_list: ['b007'], job_name: '后端开发', difficulty: 3, tags: ['Go', 'GMP', '并发'],
    hot_degree: 92, view_count: 2600, thumbs_up_count: 480, dislike_count: 5,
    create_time: '2025-02-10 10:00:00', update_time: '2025-03-01 18:00:00',
  },
  {
    question_id: 'q124', title: 'channel 的底层实现与关闭规则',
    content: 'channel 底层是 `hchan`（环形缓冲区 + 收发等待队列 + 锁）。重复关闭或向已关闭的 channel 发送会 panic。',
    bank_list: ['b007'], job_name: '后端开发', difficulty: 3, tags: ['Go', 'channel', '并发'],
    hot_degree: 68, view_count: 760, thumbs_up_count: 110, dislike_count: 3,
    create_time: '2025-02-28 16:30:00',
  },
  {
    question_id: 'q125', title: 'context 包的作用和使用场景（已隐藏）',
    content: 'status=2，任何查询都不应该出现。',
    bank_list: ['b007'], job_name: '后端开发', difficulty: 2, tags: ['Go', 'context', '并发'], status: STATUS_HIDDEN,
    hot_degree: 97, view_count: 4000, thumbs_up_count: 300, dislike_count: 2,
    create_time: '2025-03-05 11:00:00',
  },

  // ---------- Vue题库 b003 ----------
  {
    question_id: 'q126', title: 'Vue 中 computed 和 watch 的区别',
    content: '`computed` 有缓存，依赖不变不会重新计算；`watch` 用于在数据变化时执行副作用。',
    bank_list: ['b003'], job_name: '前端开发', difficulty: 1, tags: ['Vue', '前端'],
    hot_degree: 52, view_count: 450, thumbs_up_count: 60, dislike_count: 2,
    create_time: '2025-03-12 10:00:00',
  },
  {
    question_id: 'q127', title: 'Vue 3 的 Composition API 解决了什么问题？',
    content: '解决 Options API 下逻辑分散、复用困难的问题，配合 TypeScript 类型推导更好。',
    bank_list: ['b003'], job_name: '前端开发', difficulty: 2, tags: ['Vue', '前端'],
    hot_degree: 62, view_count: 380, thumbs_up_count: 55, dislike_count: 1,
    create_time: '2025-03-30 15:00:00',
  },

  // ---------- React题库 b008 ----------
  {
    question_id: 'q128', title: 'React Hooks 的使用规则是什么？',
    content: '只能在函数组件顶层调用，不能放在条件、循环或嵌套函数里，以保证每次渲染的调用顺序一致。',
    bank_list: ['b008'], job_name: '前端开发', difficulty: 2, tags: ['React', '前端'],
    hot_degree: 66, view_count: 980, thumbs_up_count: 140, dislike_count: 6,
    create_time: '2025-04-15 09:30:00',
  },
  {
    question_id: 'q129', title: 'React 中 key 的作用',
    content: 'key 帮助 diff 算法识别列表元素，避免用数组下标作为 key 导致错误复用。',
    bank_list: ['b008'], job_name: '前端开发', difficulty: 1, tags: ['React', '前端'], vip: true,
    hot_degree: 33, view_count: 1200, thumbs_up_count: 160, dislike_count: 4,
    create_time: '2025-05-02 19:00:00',
  },

  // ---------- RAG题库 b009 / Prompt工程题库 b010 ----------
  {
    question_id: 'q130', title: '什么是 RAG？它和微调有什么区别？',
    content: 'RAG 在生成前检索外部知识并拼进上下文；微调则是改模型参数。RAG 更新知识成本低，可追溯来源。',
    bank_list: ['b009'], job_name: 'AI开发', difficulty: 2, tags: ['RAG', '大模型'],
    hot_degree: 86, view_count: 1300, thumbs_up_count: 230, dislike_count: 5,
    create_time: '2025-05-20 10:00:00',
  },
  {
    question_id: 'q131', title: 'RAG 中如何选择文本切分（chunk）策略？',
    content: '按语义边界切分并保留适当重叠，chunk 太大召回不准，太小上下文不足。',
    bank_list: ['b009'], job_name: 'AI开发', difficulty: 3, tags: ['RAG', '向量检索'],
    hot_degree: 44, view_count: 240, thumbs_up_count: 35, dislike_count: 1,
    create_time: '2025-06-08 14:00:00',
  },
  {
    question_id: 'q132', title: 'Prompt 中的 few-shot 是什么？',
    content: '在提示词里给出少量输入输出示例，引导模型按示例的格式和风格作答。',
    bank_list: ['b010'], job_name: 'AI开发', difficulty: 1, tags: ['Prompt', '大模型'],
    hot_degree: 38, view_count: 560, thumbs_up_count: 70, dislike_count: 2,
    create_time: '2025-06-25 11:30:00',
  },
  {
    question_id: 'q133', title: '如何减少大模型的幻觉？',
    content: '- 用 RAG 提供可靠上下文\n- 在 Prompt 里要求"不知道就说不知道"\n- 对输出做事实校验',
    bank_list: ['b009', 'b010'], job_name: 'AI开发', difficulty: 3, tags: ['大模型', 'RAG', 'Prompt'], vip: true,
    hot_degree: 74, view_count: 870, thumbs_up_count: 120, dislike_count: 3,
    create_time: '2025-07-10 16:00:00',
  },
];

// toDoc 补全默认值并转换类型，字段顺序与 data.Question 一致：
// analysis_content 默认空串、status 默认正常、vip 默认 false、update_time 默认等于 create_time
function toDoc(q, i) {
  const createTime = bj(q.create_time);
  return {
    question_id: q.question_id,
    title: q.title,
    content: q.content,
    analysis_content: q.analysis_content ?? '',
    bank_list: q.bank_list,
    job_name: q.job_name,
    difficulty: q.difficulty,
    tags: q.tags,
    status: q.status ?? STATUS_NORMAL,
    vip: q.vip ?? false,
    hot_degree: q.hot_degree,
    view_count: q.view_count,
    thumbs_up_count: q.thumbs_up_count,
    dislike_count: q.dislike_count,
    order: Long.fromNumber(i + 1),
    create_time: createTime,
    update_time: q.update_time ? bj(q.update_time) : createTime,
  };
}

await run(async (db) => {
  await assertRefsExist(
    db,
    'question_bank',
    'bank_id',
    QUESTIONS.flatMap((q) => q.bank_list),
    '请先执行 node insert_bank_and_series.js',
  );
  await seedCollection(db, 'question', 'question_id', QUESTIONS.map(toDoc));
});
