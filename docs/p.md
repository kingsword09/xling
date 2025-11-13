# Xling Prompt Command (`xling p`)

## 概述

`xling p` 命令提供类似 `claude -p` 的提示词交互体验，支持多 AI 提供商配置、智能模型路由和自动降级重试。

## 特性

- 🔀 **多提供商支持**: 配置多个 API 提供商（OpenAI、Azure、自定义等）
- 🎯 **智能路由**: 根据请求的模型自动选择支持的提供商
- 🔄 **自动降级**: 失败时自动切换到备用提供商
- ⚡ **优先级控制**: 通过 priority 字段控制提供商选择顺序
- 🔐 **安全配置**: 配置文件自动设置 600 权限保护 API 密钥

## 配置

### 配置文件位置

`~/.claude/xling.json` (与 Claude Code 配置目录相同)

### 配置结构

```json
{
  "providers": [
    {
      "name": "openai-primary",
      "baseUrl": "https://api.openai.com/v1",
      "apiKey": "sk-proj-xxx",
      "models": ["gpt-4", "gpt-4-turbo", "gpt-4o", "gpt-3.5-turbo"],
      "priority": 1,
      "timeout": 60000
    },
    {
      "name": "openai-backup",
      "baseUrl": "https://api.openai.com/v1",
      "apiKey": "sk-proj-yyy",
      "models": ["gpt-4", "gpt-3.5-turbo"],
      "priority": 2
    },
    {
      "name": "custom-provider",
      "baseUrl": "https://custom-ai.example.com/v1",
      "apiKey": "custom-key",
      "models": ["llama-3-70b", "mixtral-8x7b"],
      "priority": 10,
      "headers": {
        "X-Custom-Header": "value"
      }
    }
  ],
  "defaultModel": "gpt-4",
  "retryPolicy": {
    "maxRetries": 2,
    "backoffMs": 1000
  }
}
```

### 配置字段说明

#### Provider 配置

- `name`: 提供商名称（唯一标识符）
- `baseUrl`: API 基础 URL
- `apiKey`: API 密钥
- `models`: 该提供商支持的模型列表
- `priority`: 优先级（数字越小优先级越高，默认最低）
- `timeout`: 请求超时时间（毫秒，可选）
- `headers`: 自定义请求头（可选）

#### 全局配置

- `defaultModel`: 默认使用的模型（可选）
- `retryPolicy`: 重试策略
  - `maxRetries`: 最大重试次数
  - `backoffMs`: 退避延迟（毫秒，指数增长）

## 使用方法

### 基础用法

```bash
# 简单提示
xling p "Explain quantum computing"

# 指定模型
xling p --model gpt-4-turbo "Write a poem about AI"

# 使用系统提示
xling p --system "You are a helpful coding assistant" "How to use async/await?"
```

### 从文件读取

```bash
# 读取文件作为上下文
xling p -f README.md "Summarize this document"

# 读取多个文件
xling p -f src/main.ts -f src/utils.ts "Review this code"
```

### 从 stdin 读取

```bash
# Git diff 审查
git diff | xling p --stdin "Review this diff and suggest improvements"

# 代码审查
cat myfile.py | xling p --stdin "Find potential bugs in this code"
```

### 输出格式

```bash
# JSON 输出
xling p --json "What is 2+2?"

# 禁用流式输出
xling p --no-stream "Generate a long story"
```

### 高级选项

```bash
# 温度控制
xling p --temperature 0.7 "Creative writing task"

# 最大令牌数
xling p --max-tokens 500 "Brief summary please"

# 组合使用
xling p \
  --model gpt-4 \
  --system "You are a code reviewer" \
  --temperature 0.3 \
  -f src/app.ts \
  "Review this code for security issues"
```

## 工作原理

### 智能路由

1. 用户指定模型（或使用 defaultModel）
2. 系统查找支持该模型的所有提供商
3. 按 priority 排序提供商
4. 使用第一个提供商发送请求

### 自动降级

如果请求失败：

1. 检查错误是否可重试：
   - ✅ 网络错误 (ECONNREFUSED, ETIMEDOUT)
   - ✅ 5xx 服务器错误
   - ✅ 429 速率限制
   - ❌ 4xx 客户端错误（不可重试）

2. 如果可重试且有其他提供商：
   - 应用指数退避延迟
   - 切换到下一个提供商
   - 重新尝试请求

3. 如果所有提供商都失败：
   - 抛出 `AllProvidersFailedError`
   - 显示所有错误详情

### 示例场景

假设配置了 3 个提供商支持 `gpt-4`:

```
openai-primary (priority: 1)
openai-backup (priority: 2)
azure-openai (priority: 3)
```

执行 `xling p --model gpt-4 "Hello"`:

1. 尝试 `openai-primary`
2. 如果失败（网络错误），等待 1 秒
3. 尝试 `openai-backup`
4. 如果失败，等待 2 秒
5. 尝试 `azure-openai`
6. 如果全部失败，报告所有错误

## 管理配置

### 通过 settings 命令

```bash
# 查看配置
xling settings:list --tool xling --scope user

# 检查配置详情
xling settings:inspect --tool xling --scope user
```

### 手动编辑

```bash
# 在编辑器中打开
vim ~/.claude/xling.json

# 或使用您喜欢的编辑器
code ~/.claude/xling.json
```

## 常见问题

### Q: 如何添加新的提供商？

编辑 `~/.claude/xling.json`，在 `providers` 数组中添加：

```json
{
  "name": "my-provider",
  "baseUrl": "https://api.example.com/v1",
  "apiKey": "your-key",
  "models": ["model-name"],
  "priority": 5
}
```

### Q: 如何设置默认模型？

在配置文件顶层添加：

```json
{
  "defaultModel": "gpt-4",
  "providers": [...]
}
```

### Q: 为什么提示"Model not supported"？

检查：
1. 模型名称是否拼写正确
2. 至少有一个提供商的 `models` 列表包含该模型
3. 运行 `xling settings:list --tool xling` 查看可用模型

### Q: 如何调试请求失败？

查看日志输出，包含：
- 尝试的提供商
- 失败原因
- 是否进行了重试

### Q: API 密钥安全吗？

配置文件自动设置 600 权限（仅所有者可读写）。但仍建议：
- 不要将配置文件提交到版本控制
- 定期轮换 API 密钥
- 使用专用密钥而非主账户密钥

## 技术细节

### 使用的技术栈

- **AI SDK**: `@ai-sdk/openai-compatible` + `ai`
- **配置管理**: 扩展现有 settings 系统
- **CLI 框架**: Oclif

### 架构

```
xling p 命令
    ↓
ModelRouter (路由 + 重试)
    ↓
ProviderRegistry (模型索引)
    ↓
PromptClient (AI SDK 封装)
    ↓
OpenAI Compatible API
```

## 贡献

欢迎贡献！如果发现问题或有改进建议，请提交 Issue 或 Pull Request。
