# @zoeymind/logger

通用彩色日志库，支持浏览器和Node.js环境，具有美观的颜色输出和可配置的选项。

## 特性

- ✅ **跨平台**: 支持浏览器和Node.js环境
- ✅ **多颜色**: 支持debug、info、warn、error、success等多种颜色
- ✅ **可配置**: 灵活的配置选项
- ✅ **Logo展示**: 启动时显示应用Logo
- ✅ **时间戳**: 可选的时间戳显示
- ✅ **TypeScript**: 完整的类型支持

## 安装

```bash
pnpm install @zoeymind/logger
```

## 使用方法

### 基础使用

```typescript
import logger from '@zoeymind/logger'

// 基本日志输出
logger.info('应用启动成功')
logger.success('操作完成')
logger.warn('这是一个警告')
logger.error('发生了错误')
logger.debug('调试信息')
```

### 自定义配置

```typescript
import { createLogger } from '@zoeymind/logger'

const customLogger = createLogger({
  show: true, // 是否显示日志
  showLogo: true, // 是否显示Logo
  showTimestamp: true, // 是否显示时间戳
  showLevel: true, // 是否显示日志级别
  prefix: 'API', // 日志前缀
  colors: {
    info: '#3b82f6', // 自定义颜色
    success: '#10b981'
  }
})

customLogger.info('自定义配置的日志')
```

### 动态配置

```typescript
import logger from '@zoeymind/logger'

// 获取当前配置
const config = logger.getConfig()

// 更新配置
logger.setConfig({
  showTimestamp: false,
  prefix: 'MyApp'
})
```

## 配置选项

| 选项            | 类型       | 默认值   | 描述                     |
| --------------- | ---------- | -------- | ------------------------ |
| `show`          | boolean    | `true`   | 是否显示日志输出         |
| `showLogo`      | boolean    | `true`   | 是否在首次使用时显示Logo |
| `showTimestamp` | boolean    | `true`   | 是否显示时间戳           |
| `showLevel`     | boolean    | `true`   | 是否显示日志级别         |
| `prefix`        | string     | -        | 日志前缀                 |
| `colors`        | ColorTheme | 默认主题 | 自定义颜色主题           |

## 颜色主题

默认颜色主题：

```typescript
{
  debug: '#6b7280',    // 灰色
  info: '#3b82f6',     // 蓝色
  warn: '#f59e0b',     // 黄色
  error: '#ef4444',    // 红色
  success: '#10b981',  // 绿色
  timestamp: '#9ca3af', // 浅灰色
  prefix: '#8b5cf6',   // 紫色
}
```

## 日志级别

- `debug`: 调试信息（灰色）
- `info`: 一般信息（蓝色）
- `warn`: 警告信息（黄色）
- `error`: 错误信息（红色）
- `success`: 成功信息（绿色）

## 环境差异

### Node.js环境

- 使用ANSI颜色代码
- 显示ASCII艺术Logo
- 支持终端颜色输出

### 浏览器环境

- 使用CSS颜色样式
- 显示简化Logo
- 支持浏览器控制台颜色

## 示例输出

```
   ╔══════════════════════════════════════╗
   ║              🧠 AIMIND               ║
   ║        Intelligent Mind Mapping      ║
   ╚══════════════════════════════════════╝
   Ready to enhance your thinking! 🚀

[2025-01-08 10:30:15.123] [INFO ] 应用启动成功
[2025-01-08 10:30:15.456] [SUCCESS] 数据加载完成
[2025-01-08 10:30:15.789] [WARN ] 配置文件未找到，使用默认配置
[2025-01-08 10:30:16.012] [ERROR] 连接数据库失败
```
