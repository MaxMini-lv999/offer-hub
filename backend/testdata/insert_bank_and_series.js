// 写入题库系列（question_bank_series）和题库（question_bank）种子数据。
// 必须先于 insert_question.js 执行：题目的 bank_list 引用这里的 bank_id。
//
// 用法（在 backend/testdata 下）：
//   node insert_bank_and_series.js           按 series_id / bank_id 幂等写入，可重复执行
//   node insert_bank_and_series.js --reset   先清空这两个集合再写入
//
// 覆盖的场景：
//   - 三个职位方向：后端开发（3 个系列）、前端开发（2 个）、AI开发（1 个），order 在每个方向内从 1 开始
//   - s006 前端工程化：没有任何题库的空系列
//   - b004 MongoDB题库：没有任何题目的空题库，count 应为 0

import { Long } from 'mongodb';
import { assertRefsExist, bj, run, seedCollection } from './common.js';

const CREATE_TIME = '2024-01-01 09:00:00';

const SERIES = [
  { series_id: 's001', series_name: '数据库', job_name: '后端开发', order: 1 },
  { series_id: 's002', series_name: '框架', job_name: '后端开发', order: 2 },
  { series_id: 's004', series_name: 'Go语言', job_name: '后端开发', order: 3 },
  { series_id: 's003', series_name: 'JS基础', job_name: '前端开发', order: 1 },
  { series_id: 's006', series_name: '前端工程化', job_name: '前端开发', order: 2 },
  { series_id: 's005', series_name: '大模型应用', job_name: 'AI开发', order: 1 },
];

const BANKS = [
  { bank_id: 'b001', series_id: 's001', bank_name: 'MySQL题库', desc: 'MySQL核心知识点', job_name: '后端开发', order: 1 },
  { bank_id: 'b002', series_id: 's001', bank_name: 'Redis题库', desc: 'Redis核心知识点', job_name: '后端开发', order: 2 },
  { bank_id: 'b004', series_id: 's001', bank_name: 'MongoDB题库', desc: '暂无题目，用来测试空题库', job_name: '后端开发', order: 3 },
  { bank_id: 'b005', series_id: 's002', bank_name: 'Gin题库', desc: 'Gin 路由、中间件与参数绑定', job_name: '后端开发', order: 1 },
  { bank_id: 'b006', series_id: 's004', bank_name: 'Go基础题库', desc: 'slice、map、interface 等语言基础', job_name: '后端开发', order: 1 },
  { bank_id: 'b007', series_id: 's004', bank_name: 'Go并发题库', desc: 'GMP、channel、context 与并发安全', job_name: '后端开发', order: 2 },
  { bank_id: 'b003', series_id: 's003', bank_name: 'Vue题库', desc: 'Vue核心知识点', job_name: '前端开发', order: 1 },
  { bank_id: 'b008', series_id: 's003', bank_name: 'React题库', desc: 'Hooks、渲染机制与性能优化', job_name: '前端开发', order: 2 },
  { bank_id: 'b009', series_id: 's005', bank_name: 'RAG题库', desc: '检索增强生成的原理与工程实践', job_name: 'AI开发', order: 1 },
  { bank_id: 'b010', series_id: 's005', bank_name: 'Prompt工程题库', desc: '提示词设计与大模型调优', job_name: 'AI开发', order: 2 },
];

await run(async (db) => {
  const time = bj(CREATE_TIME);

  const series = SERIES.map((s) => ({
    ...s,
    order: Long.fromNumber(s.order),
    create_time: time,
    update_time: time,
  }));
  await seedCollection(db, 'question_bank_series', 'series_id', series);

  await assertRefsExist(
    db,
    'question_bank_series',
    'series_id',
    BANKS.map((b) => b.series_id),
    '请检查 SERIES 和 BANKS 的 series_id 是否对应',
  );

  const banks = BANKS.map((b) => ({
    bank_id: b.bank_id,
    series_id: b.series_id,
    bank_name: b.bank_name,
    bank_logo: `https://static.example.com/offer-hub/bank/${b.bank_id}.png`,
    desc: b.desc,
    job_name: b.job_name,
    order: Long.fromNumber(b.order),
    create_time: time,
    update_time: time,
  }));
  await seedCollection(db, 'question_bank', 'bank_id', banks);
});
