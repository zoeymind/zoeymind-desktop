# DeskApp - Tauri 2.0 桌面应用模板

基于 Tauri 2.0 + React 19 + shadcn/ui 的现代化桌面应用模板。

## 技术栈

- **前端框架**: React 19 + TypeScript
- **构建工具**: Vite 7
- **UI 组件库**: shadcn/ui
- **数据获取**: TanStack Query
- **状态管理**: Zustand
- **路由**: React Router DOM v7
- **样式**: Tailwind CSS 4
- **表单验证**: react-hook-form + zod
- **桌面框架**: Tauri 2.0

## 项目结构

```
src/
├── __tests__/          # 测试文件
├── components/         # React 组件
│   ├── auth/          # 认证相关组件
│   ├── layouts/       # 布局组件
│   ├── providers/     # Context Providers
│   └── ui/            # shadcn/ui 组件
├── hooks/             # React Hooks
│   └── queries/       # TanStack Query hooks
├── lib/               # 工具函数
│   ├── api.ts         # API 客户端
│   ├── api-error.ts   # API 错误处理
│   └── utils.ts       # 通用工具
├── pages/             # 页面组件
├── routes/            # 路由配置
├── stores/            # Zustand stores
├── types/             # TypeScript 类型
├── main.tsx           # 入口文件
└── App.tsx            # 根组件
```

## 快速开始

### 安装依赖

```bash
pnpm install
```

### 开发

```bash
# 启动开发服务器（Web）
pnpm dev

# 启动 Tauri 开发模式
pnpm tauri:dev
```

### 构建

```bash
# 构建 Web 版本
pnpm build

# 构建 Tauri 应用
pnpm tauri:build
```

## 添加 shadcn/ui 组件

```bash
pnpm shadcn@latest add <component-name>
```

例如：

```bash
pnpm shadcn@latest add button
pnpm shadcn@latest add card
pnpm shadcn@latest add dialog
```

## 功能特性

- ✅ React Router DOM v7 路由配置
- ✅ TanStack Query 数据获取
- ✅ Zustand 状态管理
- ✅ 暗色模式支持
- ✅ API 客户端封装
- ✅ 类型安全的 TypeScript 配置
- ✅ 路径别名配置（@/\*）

## 开发指南

### 添加新页面

1. 在 `src/pages/` 创建页面组件
2. 在 `src/routes/index.tsx` 添加路由配置

### 使用 TanStack Query

```tsx
import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api"

function MyComponent() {
  const { data, isLoading } = useQuery({
    queryKey: ["myData"],
    queryFn: () => apiClient.get("/api/data"),
  })

  // ...
}
```

### 使用 Zustand Store

```tsx
import { useAppStore } from "@/stores/use-app-store"

function MyComponent() {
  const { theme, setTheme } = useAppStore()
  // ...
}
```

### 使用 shadcn/ui 组件

```tsx
import { Button } from "@/components/ui/button"

function MyComponent() {
  return <Button>点击我</Button>
}
```

## 环境变量

创建 `.env` 文件：

```env
VITE_API_URL=http://localhost:3000
```

## 许可证

MIT
