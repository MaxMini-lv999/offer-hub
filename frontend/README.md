# offer-hub 前端

React 18 + TypeScript + Vite 6 + Tailwind CSS 3 + shadcn/ui + React Router v6 + React Query + axios + React Hook Form + Zod，图标用 [Iconify](https://iconify.design)（`unplugin-icons` 构建时编译，见下面「图标」）。

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
- shadcn 的部分组件（Dialog、Select 等）内部用 `lucide-react`，`add` 时会自动装上；把组件里的图标换成 Iconify 的 Solar 图标，再 `npm uninstall lucide-react`，全站只用一套图标。
- `unplugin-icons` 锁在 22.2.x：之后的版本依赖 `@iconify/utils` 3.1+，用到 Node 20 才有的 `node:util.styleText`，在 Node 18 上 vite 配置直接加载失败。

## 图标

图标来自 [Iconify](https://icon-sets.iconify.design/)，由 `unplugin-icons` 在构建时从 `@iconify-json/<图标集>` 编译成 React 组件：只打包用到的图标，运行时不请求 api.iconify.design，不会先空白再闪出来。

```tsx
import IconRefresh from '~icons/solar/refresh-linear'

<IconRefresh className="size-4" />
```

- **界面图标统一用 Solar 的 linear 款**（`~icons/solar/<名字>-linear`，1.5px 描边、圆角端点），到 [Solar 图标集](https://icon-sets.iconify.design/solar/) 按名字搜。不要混用别的界面图标集。
- **尺寸**用 Tailwind 的 `size-*` 类（`size-3.5` = 14px、`size-4` = 16px、`size-8` = 32px），不写就是 `1em`，跟随字号。shadcn 的 Button、DropdownMenuItem 里会被 `[&_svg]:size-4` 统一成 16px。
- **颜色**跟随文字色（`currentColor`），改颜色就改 `text-*`。
- 图标默认带 `aria-hidden="true"`（`vite.config.ts` 里统一加的），只有图标、没有文字的按钮要自己写 `aria-label`。
- 组件命名用 `Icon` + 图标含义，如 `IconChevronLeft`（Solar 叫 `alt-arrow-left`）。
- **题库的技术品牌 logo**（`components/BankLogo.tsx`）用单色品牌图标集：`simple-icons`（MongoDB、Go、React、Vue），MySQL 和 Redis 用 `devicon-plain`（Simple Icons 的 MySQL 带字标、Redis 是新标，40px 方框里看不清）。颜色在 `BankLogo.tsx` 里按品牌色给。
- 用新的图标集先装对应的 JSON 包：`npm i -D @iconify-json/<图标集>`（`unplugin-icons` 的自动安装没开）。
- 许可：Solar 是 CC BY 4.0（作者 480 Design），Simple Icons 是 CC0，Devicon 是 MIT。

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

- **布局按页面类型区分，视觉风格全站统一**：
  - 入口页（首页）是「封面 + 目录」：一个墨线分镜格（`components/bento.tsx` 的 `BentoCard`）里依次是封面（标题、搜索、插画）、今日一题头条、一行学习进度和继续上次；下面是题库目录，职位方向桌面端竖排、手机端横排，题库按系列分组成索引行，点线引到题数。
  - 检索页（全部题目、题库页）是「检索工作台」：一行标题，主栏是吸顶筛选栏 + 紧凑题目列表（`components/QuestionList.tsx` 的 `QuestionWorkbench`，≥1280px 一行一题），右侧热门题目桌面端吸顶、往下滚收起、往上滚展开（`HotContent` 的 `sticky`），手机端排在列表下面。
  - 阅读页（题目详情）是左侧题目栏 + 正文；VN 见下一条。
- **VN**（题目详情的模拟面试、登录、404 和出错页）：`components/vn/`（`VNStage`、`DialogueBox`、`NameTag`、`ChoiceList`、`Backlog`、`StageNotice`）和 `components/InterviewMode.tsx`。逐字显示在 `hooks/useTypewriter.ts`，键盘操作在 `hooks/useVNKeys.ts`，解析分段在 `utils/segments.ts`。
- **Token**：颜色、难度色、代码高亮、动效都在 `src/index.css` 的 CSS 变量里，亮暗两套，对比度按 WCAG AA 校验过；Tailwind 的映射在 `tailwind.config.js`。樱红只用于品牌标识、VN 姓名牌、推进提示和掌握进度，天青只用于 VN 选项高亮和系统提示，按钮和交互强调仍用墨色。
- **字体**：标题和台词用思源宋体 600、代码用 JetBrains Mono 400，都通过 `@fontsource` 自托管（宋体按 unicode-range 分片，只下载用到的字）；正文用系统黑体。
- **主题**：跟随系统，导航栏可手动切换，记在 localStorage（`lib/theme.ts`，`index.html` 里有首屏前套主题的脚本）。
- **本机记录**：掌握程度和最近浏览先存在 localStorage（`lib/progress.ts`），登录接口接入后改成同步到账号。

### 插画与动效素材

- 素材来自动效包 `design/offer-hub-motion-assets/`：澜汐的 6 组 8 帧 Q 版动作、3 张立绘、昼夜两张书房场景、12 份动画 SVG，触发规则在包里的 `docs/triggers.md`。网页只发布用到的部分，在 `public/offer-hub-motion/`：`sprites/`（8 帧横排序列图）、`posters/`（静态封面）、`vectors/`（亮暗两份 SVG）、`fallbacks/`（立绘和场景）；包里的 `animated/` 动态 WebP 没用到，不发布。
- 登记表是 `src/constants/art.ts`，组件在 `components/art.tsx`：
  - `ArtImage`：场景和立绘。
  - `CharacterSprite`：Q 版动作。先显示静态封面，序列图解码完、进入视口才开始播；系统减少动态效果、页面切到后台、离开视口时停在封面。
  - `MotionVector`：动画 SVG，按主题选亮色或暗色文件。
  - CSS 在 `src/motion.css`：动效包 `motion.css` 里用到的部分，加上 `frames.css` 的逐帧 keyframes（动效包重新生成后整段替换）。
- 各处用法：
  - 首页封面：书房场景 + 欢迎立绘（入场 + 呼吸），手机端不加载；手机端的新手引导配一次挥手。
  - 掌握进度：掌握过题目时显示完成勾，满 10 题换成樱红的里程碑星。
  - 登录：欢迎立绘站在左边（水平翻转，让手势朝向表单），手机端改成对话框头像挥一次手。
  - 登录弹窗（`components/auth/LoginDialog.tsx`，站内所有登录入口都打开它，`/login`、`/register` 只留给直接打开链接的人）：标题旁 56px 头像，每次打开挥一次手。表单 `components/auth/AuthForm.tsx` 和登录页共用，按需加载，游客在浏览器空闲时预先下载。
  - 模拟面试：立绘随步骤换（念题伸手、想一想托腮、讲解捧书）；对话框头像念题挥一次手、想一想时循环托腮、每段讲解翻一次书、标记「会了」庆祝一次，其余停在静态封面。
  - 列表空状态（搜索无结果托腮、还没有题目捧书）、列表出错（修理）、404 和出错页（托腮、修理）：都是静态封面。
  - 按需加载页面的首屏占位：翻书 SVG。
- 动作要和真实状态绑定：步骤切换、请求结束就停，不用庆祝动画代替保存结果。除了 VN，一屏最多一个角色，所以首页目录的空状态和出错只用图标（封面已经有立绘）。
- 澜汐是没有品牌授权的品牌拟人（蓝鲸母题，动效包里叫「DeepSeek 娘」），页面上只用中文名，只限个人作品集等非商用场景，商用前要换成原创角色。
- 动效包里的 `masters/`、`frames/`（约 31MB PNG）和 `public/`（网页文件的原件，和 `public/offer-hub-motion/` 重复）已加进 `.gitignore`。包里的 `preview/index.html` 要靠 `public/`，本地有原件时直接打开就能看。
- 旧素材包 `offer-hub-assets` 已停用：网页文件已删除，需要时从提交 ab211f7 恢复；`design/offer-hub-assets/` 只留作存档，页面不要再引用。站点标识改成 `components/Header.tsx` 里的内联 SVG，颜色跟随主题；favicon 是 `public/favicon.svg`。
- 目前的缺口：
  - 立绘只有 512×768 一档，桌面 VN 舞台上约 580px 高，在高分屏上偏软，需要补一档 1024×1536（≤300KB）；
  - 场景只有 1536×864 一档，手机端也下载这一张（约 135KB），可以补一档 800 宽的手机档。
