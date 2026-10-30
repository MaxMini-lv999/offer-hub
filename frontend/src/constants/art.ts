/**
 * 素材登记表。网页用的文件在 public/offer-hub-motion/，来自动效包 design/offer-hub-motion-assets/
 * （逐帧原稿、触发规则、校验记录都在那里，不随网站发布）。旧的 offer-hub-assets 已停用，页面不要再引用
 */
export const ART_BASE = '/offer-hub-motion'

export interface ArtAsset {
  /** 相对 ART_BASE 的路径 */
  file: string
  width: number
  height: number
  /** 图片有内容含义时用作 alt；当装饰用时组件会把 alt 置空 */
  alt: string
}

export function artSrc(art: ArtAsset) {
  return `${ART_BASE}/${art.file}`
}

/** 提前在后台下载之后才会显示的图（比如 VN 里换姿势的立绘），换图时不闪空白 */
export function preloadArt(...arts: ArtAsset[]) {
  for (const art of arts) new Image().src = artSrc(art)
}

const SCENE = { width: 1536, height: 864 }
const PORTRAIT = { width: 512, height: 768 }

export const ART = {
  sceneDay: { file: 'fallbacks/interview-day.webp', ...SCENE, alt: '洒满阳光的书房' },
  sceneNight: { file: 'fallbacks/interview-night.webp', ...SCENE, alt: '夜里亮着壁灯的书房' },
  portraitWelcome: { file: 'fallbacks/portrait-welcome.webp', ...PORTRAIT, alt: '澜汐，蓝色长发的鲸尾女仆，伸手示意' },
  portraitThinking: { file: 'fallbacks/portrait-thinking.webp', ...PORTRAIT, alt: '澜汐托着下巴思考' },
  portraitExplain: { file: 'fallbacks/portrait-explain.webp', ...PORTRAIT, alt: '澜汐捧着书讲解' },
} satisfies Record<string, ArtAsset>

/**
 * 澜汐的 Q 版 8 帧动作，时长和默认是否循环取自动效包的 manifest.json。
 * 每个动作有 192px 和 288px 两档 8 帧横排序列图（sprites/）和同尺寸的静态封面（posters/），
 * 序列图的最后一帧和封面是同一个姿势，播完切回封面不会跳。什么场景用哪个动作见动效包 docs/triggers.md
 */
export const MOTIONS = {
  wave: { label: '挥手欢迎', duration: 1500, loop: false },
  thinking: { label: '思考', duration: 2400, loop: true },
  typing: { label: '敲键盘', duration: 1280, loop: true },
  explain: { label: '翻书讲解', duration: 1840, loop: true },
  celebrate: { label: '庆祝', duration: 1520, loop: false },
  repair: { label: '修理', duration: 1680, loop: true },
} as const
export type MotionName = keyof typeof MOTIONS

/** vectors/ 下的 64px 动画 SVG，亮暗各一份，颜色写死在文件里，按主题选文件 */
export type VectorName = 'book' | 'check' | 'continue' | 'dots' | 'hourglass' | 'milestone'

/**
 * 澜汐：站点唯一的角色，在登录、引导、空状态、出错页当引导员，在模拟面试里当面试官。
 * 她是没有品牌授权的品牌拟人（蓝鲸母题），页面上只用中文名，只限个人作品集等非商用场景，商用前要换成原创角色
 */
export const GUIDE = {
  name: '澜汐',
  role: 'Offer Hub 引导员',
} as const
