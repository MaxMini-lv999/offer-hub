# Offer Hub 原创视觉素材包

本次交付为前端素材与接入资料。共 22 张 AI 生成 PNG 母图、44 张 WebP 网页导出、24 个面试官表情、6 个 Q 版状态，以及可编辑 SVG 装饰。gallery.html 是离线素材目录，不是已实现的题库业务网站。

## 快速查看

解压后直接打开 gallery.html。可以切换亮暗主题、面试官、表情与场景，检查透明边缘及不同背景下的表现。也可以在本目录运行 python3 -m http.server 8000，然后打开 http://localhost:8000/gallery.html。

## 文件说明

- originals/：22 张完整 PNG，保留生成分辨率和透明通道，用于设计与后续衍生。
- web/desktop/、web/mobile/：两档 WebP；每张均不超过 150,000 字节。生产页面只加载所需档位。
- vectors/：可编辑的墨线、网点、斜线、进度印章及可选品牌小标。
- manifest.json：每张图的文件路径、尺寸、文件体积、用途、透明属性和图集坐标。
- integration/：素材注册表、React 18 展示示例、OKLCH token 与 Tailwind 3 合并片段。
- docs/：页面适用规则、角色设定、提示词、体积校验与使用说明。

## 接入已有 Vite 项目

把 web/ 和 vectors/ 放到 public/offer-hub-assets/ 下，目录结构保持不变。复制 integration/ 内的代码到 src 中并按项目结构调整 import。示例组件默认资源根目录为 /offer-hub-assets。

```tsx
<ArtImage id="deepseek" decorative={false} />
<AtlasSprite id="deepseek_expressions" index={2} size={72} />
```

表情顺序为倾听、讲解、思考、鼓励、疑惑、庆祝。墨樱 Q 版顺序为欢迎、思考、编程、搜索、达成、迷路。图集为 3 列 × 2 行；每格是静态状态，不是连续动画。桌面完整立绘仅有一个静态姿势，表情差分用于头像或半身窗口，不能视为完整身体的面部替换图层。

标题、题目、答案、按钮、标签均使用真实 HTML；不要把图片中偶然出现的纹理当作文字内容。SVG 小标为可选新方案，已有品牌标识时继续保留现有标识。交互图标继续使用项目的 reicon-react。

## 使用范围与来源

插画均通过内置图片生成工具创作；角色服装、发型与插画为本次设计，未使用现有游戏角色。四位品牌拟人角色是非官方创作，未取得品牌方商用授权。本包不包含品牌授权书，也不把生成行为视为取得品牌许可。

字体文件、配音、BGM 不在本次交付中。字体沿用项目的合规资源；Noto Serif SC 的 unicode-range 子集与 font-display: swap 需由项目字体构建流程提供。功能按钮及对话框使用 CSS，不用位图替代。

本包已校验文件数量、尺寸、透明通道及 WebP 体积。LCP、CLS、WCAG 完整页面表现、键盘交互和题目列表密度，需在实际业务项目接入后验证；本次未收到原仓库，不声明已达到这些整站指标。

