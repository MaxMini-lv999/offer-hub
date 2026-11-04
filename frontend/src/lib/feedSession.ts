/**
 * 沉浸式刷题「推荐」模式的本次访问记录，存在 sessionStorage：同一个标签页里刷新还在，关掉标签页或新开一个就重新开始。
 * 推荐队列由随机种子决定（同一个种子，后端返回的顺序固定），所以只记种子和几个 ID，刷新后按同样的参数重建同一个队列
 */
export interface RecommendSession {
  /** 随机种子，本次访问不变 */
  seed: number
  /** 本次访问看过的题，重建队列时跳过它们，保证不重复 */
  seen: string[]
  /** 当前队列建立时已经看过的题，这个队列里跳过 */
  exclude: string[]
  /** 固定在队首的题：打开分享链接、或刷新时 URL 里的题不在队列里，就把它放在第一道 */
  anchor?: string
}

const STORAGE_KEY = 'offer-hub-feed'
/** seen 最多记这么多条，再多就丢掉最早的，免得 sessionStorage 越写越大 */
const SEEN_LIMIT = 2000

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(v => typeof v === 'string')
}

function read(): RecommendSession | null {
  try {
    const parsed = JSON.parse(
      sessionStorage.getItem(STORAGE_KEY) ?? ''
    ) as Partial<RecommendSession>
    if (
      typeof parsed.seed !== 'number' ||
      !Number.isSafeInteger(parsed.seed) ||
      parsed.seed <= 0 ||
      !isStringArray(parsed.seen) ||
      !isStringArray(parsed.exclude)
    ) {
      return null
    }
    return {
      seed: parsed.seed,
      seen: parsed.seen,
      exclude: parsed.exclude,
      anchor: typeof parsed.anchor === 'string' ? parsed.anchor : undefined,
    }
  } catch {
    return null
  }
}

export function saveRecommendSession(session: RecommendSession) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch {
    // 写不进去（隐私模式、空间满）时刷新后重新开始，不影响这次刷题
  }
}

/** 新的随机种子：1 ~ 2^31，JavaScript 和后端的 int64 都能精确表示 */
function newSeed() {
  return Math.floor(Math.random() * 2 ** 31) + 1
}

/** 全新的一次访问：新种子，什么都没看过；firstId 是 URL 里带的题，放在队首 */
export function newRecommendSession(firstId?: string): RecommendSession {
  return { seed: newSeed(), seen: [], exclude: [], anchor: firstId }
}

/**
 * 进入推荐模式时拿到本次访问的记录：
 * - 这个标签页第一次进来：全新的一次访问
 * - URL 带着题目 ID（刷新、浏览器后退回来）：沿用原来的队列，页面按 ID 找回位置；找不到时再用 rebuildRecommendSession 把它放到队首
 * - 没带题目 ID（从导航栏、分类模式切过来）：重建队列，跳过已经看过的题
 */
export function openRecommendSession(firstId?: string): RecommendSession {
  const stored = read()
  if (!stored) return newRecommendSession(firstId)
  if (firstId) return stored
  return rebuildRecommendSession(stored)
}

/** 重建推荐队列：种子不变，跳过已经看过的题；anchor 是要放在队首的题 */
export function rebuildRecommendSession(
  session: RecommendSession,
  anchor?: string
): RecommendSession {
  return { ...session, exclude: session.seen, anchor }
}

/** 记一道看过的题 */
export function markSeen(session: RecommendSession, questionId: string): RecommendSession {
  if (session.seen.includes(questionId)) return session
  return { ...session, seen: [...session.seen, questionId].slice(-SEEN_LIMIT) }
}
