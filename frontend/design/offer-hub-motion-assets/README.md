# Offer Hub · 动效补充包

沿用上一版 DeepSeek 娘角色与日式插画风格，按个人作品场景补充动作与交互反馈。本包可独立预览，也可与原素材包一起放入同一 Vite 项目。

## 包含内容

- 6 组角色逐帧动画：挥手欢迎、思考与想通、敲键盘、翻书讲解、掌握庆祝、重试修复；每组 8 帧。
- 18 份透明动态 WebP：每组提供 96／192／288px；18 份对应静态封面。
- 12 份 CSS 序列图：每组提供 192／288px 单帧、8 帧横排，可通过 CSS 控制开始、循环与结束。
- 12 份动画 SVG：加载点、沙漏、翻书、完成勾、继续提示、里程碑，各有亮暗版本。
- 24 种 CSS 界面动效，及 React 18 组件、资源索引、触发规则、48 张逐帧 PNG、6 张生成原稿和 GIF 预览。

所有 `public/` 中的单个图像资源控制在 150,000 字节以内；原稿、逐帧 PNG 和预览 GIF 不用于网站首屏，不受该上限约束。角色动画为 8 帧手绘感动画；头像、衣纹和头发存在少量帧间差异。桌面原立绘的呼吸动效是 CSS 整图轻微变换，没有声称提供 Live2D 骨骼或口型模型。

## 立即查看

解压后双击 `preview/index.html`：支持动作播放与重播、明暗切换、减少动态效果、完整 UI 动效演示与 VN 对话示例。`preview/*.gif` 可直接打开查看动作，`frames/` 提供按顺序命名的透明 PNG。

## 接入 React 18 + Vite 6

1. 将 `public/assets/offer-hub-motion/` 复制到现有项目同名位置。
2. 将 `integration/` 内三个 TSX/TS 文件放入同一个组件目录。
3. 在入口 HTML 引入两份 CSS；部署于子路径时使用相应 BASE_URL。

```html
<link rel="stylesheet" href="/assets/offer-hub-motion/motion.css">
<link rel="stylesheet" href="/assets/offer-hub-motion/frames.css">
```

```tsx
// 一次性欢迎；重新触发时改变 playKey。
<MotionSprite name="wave" playKey={welcomeEventId} size={144} />

// 由真实业务状态控制；结束请求后应卸载或切回静态状态。
{isSubmitting && <MotionSprite name="thinking" size={96} />}

// 仅成功记录掌握后触发。
<MotionSprite name="celebrate" playKey={masteryEventId} loop={false} />

<BookmarkButton pressed={bookmarked} onChange={setBookmarked} />
<MasteryProgress value={masteryPercent} />
<DialogueText text={paragraph} speed={40} revealAll={showWholeParagraph} />
```

`MotionSprite` 的 `disabled` 可连接站点“减少动态效果”开关；系统 `prefers-reduced-motion`、页面切到后台、角色离开视口时自动回到静态封面。重新可见时，未完成的动画从头开始。默认挥手与庆祝仅播一次，其余默认循环；业务结束后需要清除对应 loading/working 状态。

生产环境优先使用 `MotionSprite`，其可控制暂停与重播。直接 `<img src=".../animated/typing-192.webp">` 适合无法写 CSS 的使用位置，但 animated WebP 自身没有暂停 API；必须通过替换为 `posters/` 图片落实 reduced-motion 和后台停止。

96px 动图用于小型引导，192px 适合移动端，288px 适合桌面 144px 以 2× 分辨率显示。MotionSprite 在显示尺寸 ≤96px 时选择192px序列图，更大尺寸选择288px序列图；建议显示在96–160px范围内。桌面大尺寸角色使用原素材包静态立绘配合入场／呼吸效果。

## 目录

| 路径 | 用途 |
|---|---|
| `public/assets/offer-hub-motion/animated` | 透明动态 WebP |
| `public/assets/offer-hub-motion/sprites` | 8 帧横排序列图 |
| `public/assets/offer-hub-motion/posters` | 各尺寸静态降级封面 |
| `public/assets/offer-hub-motion/vectors` | 亮暗主题动画 SVG |
| `public/assets/offer-hub-motion/fallbacks` | 预览所需的原立绘、头像与场景 |
| `integration/` | React 组件与类型化资源索引 |
| `frames/`、`masters/` | 逐帧 PNG 与生成原稿 |
| `docs/` | 触发规则、提示词、体积与校验记录 |
| `preview/` | 离线交互预览、GIF 与组合截图 |

前端组件的视觉转场与序列图播放使用 CSS transitions/keyframes，未增加 Lottie、GSAP 或其他动画库；另提供可独立播放的动态 WebP。逐字台词使用 JavaScript 推进文本内容，完整段落提供给屏幕阅读器。无音效、自动播放声音或后台行为上报。
