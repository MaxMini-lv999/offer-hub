// 两个种子脚本共用的部分：读配置、连 MongoDB、按业务 ID 幂等写入。

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoClient } from 'mongodb';
import { parse } from 'smol-toml';

const SRC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const CONNECT_TIMEOUT_MS = 10_000; // 与 data.connectTimeout 一致

// 带 --reset 时先清空本脚本负责的集合，再写入种子
export const RESET = process.argv.includes('--reset');

// loadConfig 与 config.Init 一致：按 APP_ENV 读 backend/src/config-{APP_ENV}.toml，未设置时为 test。
// 线上环境直接拒绝，避免误把种子写进线上库。
export function loadConfig() {
  const env = process.env.APP_ENV || 'test';
  if (env === 'online') {
    throw new Error('APP_ENV=online：种子脚本只能用于本地/测试环境');
  }
  const file = path.join(SRC_DIR, `config-${env}.toml`);
  const conf = parse(readFileSync(file, 'utf8'));
  return { file, mongo: conf.MongoDB };
}

// connectMongo 与 data.newMongo 一致：URI + 连接池大小 + 可选账号密码，连上后 ping 一次
export async function connectMongo(c) {
  const opts = {
    maxPoolSize: c.max_pool,
    minPoolSize: c.min_pool,
    connectTimeoutMS: CONNECT_TIMEOUT_MS,
    serverSelectionTimeoutMS: CONNECT_TIMEOUT_MS,
  };
  if (c.user) {
    opts.auth = { username: c.user, password: c.pwd };
  }
  const client = new MongoClient(c.url, opts);
  await client.connect();
  await client.db('admin').command({ ping: 1 });
  return client;
}

// bj 把北京时间字符串（"2024-01-01 12:00:00"）转成 Date，存进 MongoDB 的是对应的 UTC 时刻
export function bj(s) {
  return new Date(`${s.replace(' ', 'T')}+08:00`);
}

// seedCollection 把 docs 按业务主键 key 写入集合：已存在的用种子字段覆盖，不存在的插入，
// 所以重复执行结果不变。业务主键上的唯一索引不存在时会顺便建好。
export async function seedCollection(db, name, key, docs) {
  const coll = db.collection(name);
  await coll.createIndex({ [key]: 1 }, { unique: true });

  if (RESET) {
    const { deletedCount } = await coll.deleteMany({});
    console.log(`[${name}] --reset：已清空 ${deletedCount} 条`);
  }

  const ops = docs.map((doc) => ({
    updateOne: { filter: { [key]: doc[key] }, update: { $set: doc }, upsert: true },
  }));
  const r = await coll.bulkWrite(ops, { ordered: true });
  const unchanged = r.matchedCount - r.modifiedCount;
  console.log(
    `[${name}] 种子 ${docs.length} 条：新增 ${r.upsertedCount}，更新 ${r.modifiedCount}，无变化 ${unchanged}`,
  );

  const seedIDs = docs.map((doc) => doc[key]);
  const extra = await coll.distinct(key, { [key]: { $nin: seedIDs } });
  if (extra.length > 0) {
    console.log(
      `[${name}] 提示：库里还有 ${extra.length} 条不在种子里（${extra.join(', ')}），会影响列表和计数结果，需要清掉请加 --reset`,
    );
  }
}

// assertRefsExist 检查 ids 都已存在于 collection 的 key 字段里（MongoDB 没有外键，写入前自己查）
export async function assertRefsExist(db, collection, key, ids, hint) {
  const existing = new Set(await db.collection(collection).distinct(key));
  const missing = [...new Set(ids)].filter((id) => !existing.has(id));
  if (missing.length > 0) {
    throw new Error(`${collection} 里缺少 ${key}：${missing.join(', ')}。${hint}`);
  }
}

// run 统一处理连接、日志和退出码
export async function run(main) {
  let client;
  try {
    const { file, mongo } = loadConfig();
    console.log(`配置文件：${file}`);
    console.log(`MongoDB：${mongo.url} / ${mongo.database}${RESET ? '（--reset）' : ''}`);
    client = await connectMongo(mongo);
    await main(client.db(mongo.database));
    console.log('完成');
  } catch (err) {
    console.error(`失败：${err.message}`);
    process.exitCode = 1;
  } finally {
    await client?.close();
  }
}
