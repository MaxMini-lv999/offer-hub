/**
 * 插画素材登记表。图片在 public/offer-hub-assets/web/ 下，桌面档和手机档各一份 WebP（单张 ≤150KB），
 * 页面按断点只加载其中一档。母图、提示词和页面适用规则在 design/offer-hub-assets/，不随网站发布
 */
export const ART_BASE = '/offer-hub-assets'

interface Size {
  width: number
  height: number
}

export interface ArtAsset {
  /** 文件名，不含目录和扩展名 */
  file: string
  desktop: Size
  mobile: Size
  /** 图片有内容含义时用作 alt；当装饰用时组件会把 alt 置空 */
  alt: string
}

const SCENE = { desktop: { width: 1600, height: 900 }, mobile: { width: 800, height: 450 } }
const STANDING = { desktop: { width: 672, height: 1008 }, mobile: { width: 400, height: 600 } }
const STATE = { desktop: { width: 640, height: 640 }, mobile: { width: 320, height: 320 } }
/** 3 列 × 2 行的图集：桌面档每格 256px，手机档每格 192px */
const ATLAS = { desktop: { width: 768, height: 512 }, mobile: { width: 576, height: 384 } }

export const ART = {
  heroCover: { file: 'hero-cover', ...SCENE, alt: '墨樱坐在窗边书桌前做笔记' },
  heroCoverDark: { file: 'hero-cover-dark', ...SCENE, alt: '夜里墨樱在台灯下做笔记' },
  sceneInterviewDay: { file: 'scene-interview-day', ...SCENE, alt: '洒满阳光的面试书房' },
  sceneInterviewNight: { file: 'scene-interview-night', ...SCENE, alt: '星空下的研究室' },
  sceneLogin: { file: 'scene-login', ...SCENE, alt: '知识学院的入口' },
  sceneError: { file: 'scene-error', ...SCENE, alt: '堆满书架的档案馆' },
  stateEmptySearch: { file: 'state-empty-search', ...STATE, alt: '书本和放大镜' },
  stateEmptyBookmarks: { file: 'state-empty-bookmarks', ...STATE, alt: '空白的书封和书架' },
  stateLoading: { file: 'state-loading', ...STATE, alt: '沙漏和书页' },
  stateNetworkError: { file: 'state-network-error', ...STATE, alt: '断开的连接器' },
  stateOnboarding: { file: 'state-onboarding', ...STATE, alt: '学习路线地图和钢笔' },
  stateMastery: { file: 'state-mastery', ...STATE, alt: '樱色水晶奖杯' },
} satisfies Record<string, ArtAsset>

/** 面试官表情图集的顺序：倾听 / 讲解 / 思考 / 鼓励 / 疑惑 / 庆祝 */
export const EXPRESSIONS = ['neutral', 'speaking', 'thinking', 'encouraging', 'puzzled', 'celebrating'] as const
export type Expression = (typeof EXPRESSIONS)[number]

/** 墨樱 Q 版图集的顺序：欢迎 / 思考 / 编程 / 搜索 / 达成 / 迷路 */
export const CHIBI_STATES = ['welcome', 'thinking', 'coding', 'searching', 'celebrating', 'lost'] as const
export type ChibiState = (typeof CHIBI_STATES)[number]

export interface Character {
  id: string
  name: string
  role: string
  /** 完整立绘，只有一个姿势；表情差分只用于头像，不能当成立绘的脸部替换 */
  standing: ArtAsset
}

export interface Interviewer extends Character {
  /** 模拟面试的开场白，按角色性格写 */
  greeting: string
  /** 3×2 表情图集，顺序同 EXPRESSIONS */
  expressions: ArtAsset
}

/**
 * 四位面试官是站点角色设定，不代表任何模型的能力。
 * 她们是没有品牌授权的品牌拟人，页面上只用中文名，只限个人作品集等非商用场景，商用前要换成原创角色
 */
export const INTERVIEWERS: Interviewer[] = [
  {
    id: 'lanxi',
    name: '澜汐',
    role: '算法面试官',
    greeting: '我是澜汐。先把思路理清楚，再一起看看边界条件和复杂度。',
    standing: { file: 'lanxi', ...STANDING, alt: '澜汐，钴蓝长马尾的面试官' },
    expressions: { file: 'lanxi-expressions', ...ATLAS, alt: '澜汐' },
  },
  {
    id: 'lingxu',
    name: '绫序',
    role: '系统设计面试官',
    greeting: '我是绫序。我们把问题拆开来看，顺便聊聊实现上的取舍。',
    standing: { file: 'lingxu', ...STANDING, alt: '绫序，银白编发的面试官' },
    expressions: { file: 'lingxu-expressions', ...ATLAS, alt: '绫序' },
  },
  {
    id: 'xiwen',
    name: '曦文',
    role: '工程表达面试官',
    greeting: '我是曦文。不着急，按你的节奏来，把思路讲清楚就好。',
    standing: { file: 'xiwen', ...STANDING, alt: '曦文，铜棕卷发、手捧书卷的面试官' },
    expressions: { file: 'xiwen-expressions', ...ATLAS, alt: '曦文' },
  },
  {
    id: 'xingche',
    name: '星澈',
    role: '创意面试官',
    greeting: '我是星澈！这道题挺有意思的，我们一起想想看。',
    standing: {
      file: 'xingche',
      desktop: { width: 588, height: 882 },
      mobile: { width: 400, height: 600 },
      alt: '星澈，蓝紫长发的面试官',
    },
    expressions: { file: 'xingche-expressions', ...ATLAS, alt: '星澈' },
  },
]

/** 墨樱：完全原创的站点引导员，负责登录、引导、空状态和错误页 */
export const HOST = {
  id: 'moying',
  name: '墨樱',
  role: 'Offer Hub 引导员',
  standing: { file: 'host-moying', ...STANDING, alt: '墨樱，墨色短发、别着樱色书签的引导员' },
  /** 3×2 Q 版图集，顺序同 CHIBI_STATES */
  chibi: { file: 'host-chibi-states', ...ATLAS, alt: '墨樱' },
} satisfies Character & { chibi: ArtAsset }
