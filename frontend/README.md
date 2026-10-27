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
