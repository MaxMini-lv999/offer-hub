# offer-hub 前端

React 18 + TypeScript + Vite 6 + Tailwind CSS 3 + shadcn/ui + React Router v6 + React Query + axios + React Hook Form + Zod，图标用 [Reicon](https://reicon.dev)（`reicon-react`）。

## 命令

```bash
npm install
npm run dev      # http://localhost:3001，/api、/auth、/home 代理到 http://localhost:8180（Go 后端）
npm run build
npm run lint
```

## 版本说明

本机 Node 是 18，下面几个依赖锁在兼容 Node 18 / React 18 的大版本，升级前先看这里：

- **shadcn 必须用 `npx shadcn@2.3.0 add <组件>`**，不要用 `shadcn@latest`。latest 需要 Node 20+，而且生成的是 React 19 + Tailwind 4 写法（去掉了 `forwardRef`），在 React 18 下 ref 会丢。
- Tailwind 3（不是 4），对应 `tailwind-merge` 2.x。
- Vite 6 + `@vitejs/plugin-react` 4（Vite 7 需要 Node 20.19+）。
- shadcn 的部分组件（Dialog、Select 等）内部用 `lucide-react`，`add` 时会自动装上，组件内部保留即可；业务代码里的图标统一用 `reicon-react`。

## 目录

```
src/
├── components/
│   ├── provider/   # Context Provider（React Query 等）
│   └── ui/         # shadcn/ui 组件（CLI 生成）
├── pages/          # 页面组件
├── services/       # API 请求函数（一个接口一个函数）
├── hooks/          # 自定义 Hook（useQuery / useMutation 封装）
├── types/          # TypeScript 类型（字段名和后端 JSON 保持一致，snake_case）
├── lib/            # 工具库：axios.ts（axios 实例）、request.ts（解析后端响应）、utils.ts（shadcn 的 cn）
├── utils/          # 工具函数
├── App.tsx         # 路由表 + 全局 Provider（BrowserRouter、React Query）
└── main.tsx        # 入口
```

请求链路：`pages` → `hooks`（React Query）→ `services` → `lib/request.ts` → `lib/axios.ts`。

- `lib/axios.ts`：axios 实例。`baseURL` 为空，接口路径要写全（`/api/v1/...`），开发时由 Vite 代理到后端；自动带 `Authorization: Bearer <token>`；HTTP 401 或 `code` 401 时清除本地 token。
- `lib/request.ts`：`get` / `post` 解析后端 `{ code, msg, data }`，`code === 0` 时直接返回 `data`，否则抛出 `ApiError`（带 `code` 和 `msg`）。

## 设计系统：Light Novel Bento × Galgame VN

在原来的直角编辑风上增量演进：保留直角、无投影、墨色强调、反色和下划线交互态，只新增宋体标题与 display 字号、樱红和天青两种限定用途色、插画立绘层和 VN 模式。

- **Bento**（首页、题库页、全部题目页的页头）：`components/bento.tsx`。手机单列、平板 6 栏、桌面 12 栏，平板以上行高 160px，卡片尺寸 1×1 / 2×1 / 2×2，1px 墨线分格。
- **VN**（题目详情的模拟面试、登录、404 和出错页）：`components/vn/`（`VNStage`、`DialogueBox`、`NameTag`、`ChoiceList`、`Backlog`、`StageNotice`）和 `components/InterviewMode.tsx`。逐字显示在 `hooks/useTypewriter.ts`，键盘操作在 `hooks/useVNKeys.ts`，解析分段在 `utils/segments.ts`。
- **Token**：颜色、难度色、代码高亮、动效都在 `src/index.css` 的 CSS 变量里，亮暗两套，对比度按 WCAG AA 校验过；Tailwind 的映射在 `tailwind.config.js`。樱红只用于品牌标识、VN 姓名牌、推进提示和掌握进度，天青只用于 VN 选项高亮和系统提示，按钮和交互强调仍用墨色。
- **字体**：标题和台词用思源宋体 600、代码用 JetBrains Mono 400，都通过 `@fontsource` 自托管（宋体按 unicode-range 分片，只下载用到的字）；正文用系统黑体。
- **主题**：跟随系统，导航栏可手动切换，记在 localStorage（`lib/theme.ts`，`index.html` 里有首屏前套主题的脚本）。
- **本机记录**：掌握程度和最近浏览先存在 localStorage（`lib/progress.ts`），登录接口接入后改成同步到账号。

### 插画素材

- 网页用的 WebP 和 SVG 在 `public/offer-hub-assets/`（`web/desktop`、`web/mobile`、`vectors/`），登记表是 `src/constants/art.ts`，用 `components/art.tsx` 的 `ArtImage`（按断点只下载一档）、`AtlasSprite`（3×2 图集取一格）、`InkDecor`（单色 SVG 当遮罩，颜色跟随主题）显示。
- 母图、提示词、页面适用规则在 `design/offer-hub-assets/`，不随网站发布；`originals/`（约 50MB PNG）已加进 `.gitignore`，需要版本管理时用 Git LFS。
- 四位面试官（澜汐、绫序、曦文、星澈）是没有品牌授权的品牌拟人，页面上只用中文名，只限个人作品集等非商用场景，商用前要换成原创角色；墨樱是原创角色。
- 补位图要遵循 `design/offer-hub-assets/docs/characters.md` 的一致性要求，从母图衍生，导出 desktop 和 mobile 两档 WebP（1x 单张 ≤150KB），再登记到 `src/constants/art.ts`。目前的缺口：
  - 墨樱没有表情图集，手机端头像暂用 Q 版「欢迎」格；
  - 立绘桌面档只有 672×1008，高分屏上偏软，需要补一档 1344×2016 的 2x（≤300KB）。
