# xling Settings Command 实施计划

## 项目概述

基于 Codex 的架构分析，本文档详细规划 `xling settings` 命令的实现，用于统一管理 Claude Code、Codex 和 Gemini CLI 三个工具的配置。

## 架构设计

### 核心原则应用

- **KISS**: 单一 `settings` 命令入口，适配器隐藏工具差异
- **YAGNI**: 仅实现 list/get/set/unset/switch-profile，不做过度设计
- **DRY**: 共享路径解析和序列化工具
- **SOLID**:
  - **SRP**: 每个适配器只负责一个工具的配置管理
  - **OCP**: 新增工具只需添加适配器，无需修改命令层
  - **LSP**: 所有适配器实现统一接口，行为一致
  - **ISP**: CLI 参数保持专注，不臃肿
  - **DIP**: 命令层依赖抽象接口，不依赖具体实现

### 目录结构（基于 oclif）

```
xling/
├── bin/
│   └── run.js                    # CLI 可执行入口
├── src/
│   ├── commands/                 # oclif 命令目录
│   │   └── settings/
│   │       ├── index.ts          # settings 主命令
│   │       ├── list.ts           # settings:list 子命令
│   │       ├── get.ts            # settings:get 子命令
│   │       ├── set.ts            # settings:set 子命令
│   │       ├── unset.ts          # settings:unset 子命令
│   │       └── switch.ts         # settings:switch 子命令
│   ├── domain/
│   │   ├── types.ts              # 共享类型定义
│   │   ├── interfaces.ts         # SettingsAdapter 接口
│   │   └── validators.ts         # 配置验证逻辑
│   ├── services/
│   │   └── settings/
│   │       ├── adapters/
│   │       │   ├── base.ts       # 抽象基类
│   │       │   ├── claude.ts     # Claude Code 适配器
│   │       │   ├── codex.ts      # Codex 适配器
│   │       │   └── gemini.ts     # Gemini CLI 适配器
│   │       ├── fsStore.ts        # 文件系统操作
│   │       └── dispatcher.ts     # 适配器调度器
│   └── utils/
│       ├── logger.ts             # 日志工具
│       ├── errors.ts             # 错误类型
│       └── format.ts             # 输出格式化
├── test/                         # oclif 测试目录
│   ├── fixtures/                 # 测试数据
│   │   ├── claude/
│   │   ├── codex/
│   │   └── gemini/
│   ├── commands/                 # 命令测试
│   └── helpers/                  # 测试辅助
└── docs/
    └── settings.md               # 使用文档
```

## 技术选型

### 1. CLI 框架: **oclif**

**理由**:
- 企业级 CLI 框架，被 Heroku、Salesforce、Twilio、Shopify 等使用
- 完善的插件系统，易于扩展（符合 OCP 原则）
- 内置参数解析、命令测试、自动文档生成
- 优秀的 TypeScript 支持，类型安全
- 支持子命令和复杂的参数/选项配置
- 内置 `--json` 标志支持，便于脚本化
- 提供 `this.log()`, `this.warn()`, `this.error()` 等便捷方法

**核心特性**:
- 命令类继承 `Command` 基类
- 使用 `Args` 定义位置参数（支持 string, integer, boolean, url, file, directory 等类型）
- 使用 `Flags` 定义选项（支持 required, default, multiple, env, options 等配置）
- 支持参数关系（dependsOn, exclusive, exactlyOne, relationships 等）
- 内置错误处理和日志方法

**安装**:
```bash
bun add @oclif/core
bun add -d oclif
```

### 2. TOML 解析: **@std/toml**

**理由**:
- Deno 标准库的一部分，质量有保证
- 浏览器兼容，可在 Bun 中使用
- API 简洁：`parse()` 和 `stringify()`
- 支持通过 JSR (JavaScript Registry) 安装
- 无额外依赖，轻量级
- 类型安全，完整的 TypeScript 支持

**API**:
```typescript
import { parse, stringify } from "@std/toml";

// TOML 字符串 -> 对象
const obj = parse(tomlString);

// 对象 -> TOML 字符串
const toml = stringify(obj);
```

**安装**:
```bash
bun add @std/toml
```

### 3. 测试框架: **Vitest**

**理由**:
- 符合 AGENTS.md 约定
- 与 Bun 原生集成
- 快速且支持 watch 模式
- 兼容 Jest API，易于上手
- oclif 官方推荐的测试框架之一

**安装**:
```bash
bun add -d vitest
```

### 4. 其他依赖

- `zod`: 运行时类型验证
- `cli-table3`: 表格格式化输出（oclif 不内置表格）
- `chalk`: 终端颜色输出（oclif 内置，但可单独使用）

## 详细实施步骤

### 阶段 1: 项目基础搭建 (复杂度: 简单)

#### 任务 1.1: 初始化项目结构
- **输入**: 当前 package.json
- **输出**: 完整的目录结构和基础配置
- **步骤**:
  1. 创建 src/ 目录结构
  2. 配置 TypeScript (tsconfig.json)
  3. 配置 Vitest (vitest.config.ts)
  4. 更新 package.json 添加依赖和脚本
- **验收标准**: `bun install` 成功，目录结构完整

#### 任务 1.2: 使用 oclif 初始化项目
```bash
# 使用 oclif 生成器初始化项目（可选，或手动创建）
npx oclif generate xling

# 或手动安装依赖
bun add @oclif/core @std/toml zod cli-table3
bun add -d @types/node vitest oclif @oclif/test
```

#### 任务 1.3: 配置 TypeScript
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**依赖**: 无
**里程碑**: M1 - 项目骨架完成

---

### 阶段 2: 领域模型定义 (复杂度: 中等)

#### 任务 2.1: 定义核心类型 (src/domain/types.ts)

```typescript
export type ToolId = 'claude' | 'codex' | 'gemini';
export type Scope = 'user' | 'project' | 'local' | 'system';
export type SettingAction = 'list' | 'get' | 'set' | 'unset' | 'switch-profile' | 'inspect';
export type OutputFormat = 'json' | 'table';

export interface SettingsPayload {
  tool: ToolId;
  scope: Scope;
  action: SettingAction;
  key?: string;
  value?: string;
  profile?: string;
  format?: OutputFormat;
  dryRun?: boolean;
  filePath?: string;
}

export interface SettingsResult {
  success: boolean;
  data?: Record<string, unknown>;
  message?: string;
  filePath?: string;
  diff?: string;
}
```

#### 任务 2.2: 定义适配器接口 (src/domain/interfaces.ts)

```typescript
export interface SettingsAdapter {
  readonly toolId: ToolId;

  list(scope: Scope): Promise<Record<string, unknown>>;
  get(scope: Scope, key: string): Promise<unknown>;
  set(scope: Scope, key: string, value: unknown, dryRun?: boolean): Promise<SettingsResult>;
  unset(scope: Scope, key: string, dryRun?: boolean): Promise<SettingsResult>;

  // 可选方法
  switchProfile?(profile: string): Promise<SettingsResult>;
  inspect?(scope: Scope): Promise<{ path: string; exists: boolean; content?: string }>;

  // 工具特定方法
  resolvePath(scope: Scope): string;
  validateScope(scope: Scope): boolean;
}
```

#### 任务 2.3: 实现验证器 (src/domain/validators.ts)

使用 Zod 定义验证 schema，确保输入参数合法性。

**依赖**: 任务 1.2
**验收标准**: 类型定义完整，通过 TypeScript 编译

---

### 阶段 3: 工具层实现 (复杂度: 简单)

#### 任务 3.1: 文件系统工具 (src/services/settings/fsStore.ts)

**功能**:
- `resolveHome(path: string)`: 解析 ~ 为用户目录
- `ensureDir(path: string)`: 确保目录存在
- `readJSON(path: string)`: 读取 JSON 文件
- `writeJSON(path: string, data: object, backup?: boolean)`: 写入 JSON（支持备份）
- `readTOML(path: string)`: 读取 TOML 文件
- `writeTOML(path: string, data: object, backup?: boolean)`: 写入 TOML
- `deepMerge(target: object, source: object)`: 深度合并对象

**技术难点**:
- 跨平台路径处理（Windows vs Unix）
- 原子写入（先写临时文件再重命名）

#### 任务 3.2: 日志和错误处理

- `src/utils/logger.ts`: 使用 chalk 实现彩色日志
- `src/utils/errors.ts`: 定义自定义错误类型
- `src/utils/format.ts`: 实现 JSON 和 Table 格式化

**依赖**: 任务 1.2
**验收标准**: 单元测试覆盖率 > 80%

---

### 阶段 4: 适配器实现 (复杂度: 复杂)

#### 任务 4.1: 抽象基类 (src/services/settings/adapters/base.ts)

实现通用逻辑，减少重复代码（DRY 原则）。

#### 任务 4.2: Claude Code 适配器 (src/services/settings/adapters/claude.ts)

**配置文件路径**:
- `user`: `~/.claude/settings.json`
- `project`: `<cwd>/.claude/settings.json`
- `local`: `<cwd>/.claude/settings.local.json`

**关键实现**:
```typescript
export class ClaudeAdapter extends BaseAdapter {
  readonly toolId = 'claude';

  resolvePath(scope: Scope): string {
    switch (scope) {
      case 'user': return '~/.claude/settings.json';
      case 'project': return '.claude/settings.json';
      case 'local': return '.claude/settings.local.json';
      default: throw new InvalidScopeError(scope);
    }
  }

  async list(scope: Scope): Promise<Record<string, unknown>> {
    const path = this.resolvePath(scope);
    return await fsStore.readJSON(path);
  }

  // ... 其他方法实现
}
```

**技术难点**:
- 处理分层配置的优先级
- 支持嵌套键（如 `theme.dark.background`）

#### 任务 4.3: Codex 适配器 (src/services/settings/adapters/codex.ts)

**配置文件路径**:
- `user`: `~/.codex/config.toml`
- `profile`: `~/.codex/config.toml` 中的 `[profiles.<name>]` 块

**关键实现**:
```typescript
export class CodexAdapter extends BaseAdapter {
  readonly toolId = 'codex';

  async switchProfile(profile: string): Promise<SettingsResult> {
    const config = await fsStore.readTOML(this.resolvePath('user'));
    if (!config.profiles?.[profile]) {
      throw new ProfileNotFoundError(profile);
    }
    // 切换逻辑
  }

  // ... 其他方法实现
}
```

**技术难点**:
- TOML 格式的正确解析和序列化
- Profile 切换逻辑

#### 任务 4.4: Gemini CLI 适配器 (src/services/settings/adapters/gemini.ts)

**配置文件路径**:
- `user`: `~/.gemini/settings.json`
- `project`: `<cwd>/.gemini/settings.json`
- `system`: 平台相关路径（需调研）

**技术难点**:
- 系统级配置路径的跨平台处理
- 权限检查

**依赖**: 任务 2.2, 3.1
**验收标准**: 每个适配器通过单元测试，覆盖所有方法

---

### 阶段 5: 调度器实现 (复杂度: 中等)

#### 任务 5.1: 实现调度器 (src/services/settings/dispatcher.ts)

```typescript
export class SettingsDispatcher {
  private adapters: Map<ToolId, SettingsAdapter>;

  constructor() {
    this.adapters = new Map([
      ['claude', new ClaudeAdapter()],
      ['codex', new CodexAdapter()],
      ['gemini', new GeminiAdapter()],
    ]);
  }

  async execute(payload: SettingsPayload): Promise<SettingsResult> {
    const adapter = this.adapters.get(payload.tool);
    if (!adapter) {
      throw new UnsupportedToolError(payload.tool);
    }

    switch (payload.action) {
      case 'list': return { success: true, data: await adapter.list(payload.scope) };
      case 'get': return { success: true, data: await adapter.get(payload.scope, payload.key!) };
      // ... 其他 action
    }
  }
}
```

**SOLID 体现**:
- **OCP**: 新增工具只需在构造函数中注册
- **DIP**: 依赖 SettingsAdapter 接口，不依赖具体实现

**依赖**: 任务 4.1-4.4
**验收标准**: 集成测试覆盖所有 action 和 tool 组合

---

### 阶段 6: CLI 命令实现（基于 oclif）(复杂度: 中等)

#### 任务 6.1: CLI 入口 (bin/run.js)

```javascript
#!/usr/bin/env node

import {execute} from '@oclif/core'

await execute({development: false, dir: import.meta.url})
```

#### 任务 6.2: Settings List 命令 (src/commands/settings/list.ts)

```typescript
import {Command, Flags} from '@oclif/core'
import {SettingsDispatcher} from '../../services/settings/dispatcher.js'
import Table from 'cli-table3'

export default class SettingsList extends Command {
  static summary = 'List all settings for a tool'

  static description = `
    Display all configuration settings for the specified AI CLI tool.
    Supports multiple scopes (user, project, local, system).
  `

  static examples = [
    '<%= config.bin %> <%= command.id %> --tool claude --scope user',
    '<%= config.bin %> <%= command.id %> --tool codex --scope user --json',
  ]

  static flags = {
    tool: Flags.string({
      char: 't',
      description: 'AI CLI tool to manage',
      options: ['claude', 'codex', 'gemini'],
      default: 'claude',
    }),
    scope: Flags.string({
      char: 's',
      description: 'Configuration scope',
      options: ['user', 'project', 'local', 'system'],
      default: 'user',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(SettingsList)

    try {
      const dispatcher = new SettingsDispatcher()
      const result = await dispatcher.execute({
        tool: flags.tool as any,
        scope: flags.scope as any,
        action: 'list',
      })

      if (this.jsonEnabled()) {
        this.logJson(result)
      } else {
        // 使用 cli-table3 格式化输出
        const table = new Table({
          head: ['Key', 'Value'],
          colWidths: [30, 50],
        })

        for (const [key, value] of Object.entries(result.data || {})) {
          table.push([key, JSON.stringify(value)])
        }

        this.log(table.toString())
      }
    } catch (error) {
      this.error(error as Error, {exit: 1})
    }
  }
}
```

#### 任务 6.3: Settings Get 命令 (src/commands/settings/get.ts)

```typescript
import {Args, Command, Flags} from '@oclif/core'
import {SettingsDispatcher} from '../../services/settings/dispatcher.js'

export default class SettingsGet extends Command {
  static summary = 'Get a specific setting value'

  static args = {
    key: Args.string({
      description: 'Setting key to retrieve',
      required: true,
    }),
  }

  static flags = {
    tool: Flags.string({
      char: 't',
      description: 'AI CLI tool to manage',
      options: ['claude', 'codex', 'gemini'],
      default: 'claude',
    }),
    scope: Flags.string({
      char: 's',
      description: 'Configuration scope',
      options: ['user', 'project', 'local', 'system'],
      default: 'user',
    }),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(SettingsGet)

    try {
      const dispatcher = new SettingsDispatcher()
      const result = await dispatcher.execute({
        tool: flags.tool as any,
        scope: flags.scope as any,
        action: 'get',
        key: args.key,
      })

      if (this.jsonEnabled()) {
        this.logJson(result)
      } else {
        this.log(`${args.key}: ${JSON.stringify(result.data)}`)
      }
    } catch (error) {
      this.error(error as Error, {exit: 1})
    }
  }
}
```

#### 任务 6.4: Settings Set 命令 (src/commands/settings/set.ts)

```typescript
import {Args, Command, Flags} from '@oclif/core'
import {SettingsDispatcher} from '../../services/settings/dispatcher.js'

export default class SettingsSet extends Command {
  static summary = 'Set a setting value'

  static args = {
    key: Args.string({
      description: 'Setting key to set',
      required: true,
    }),
    value: Args.string({
      description: 'Setting value',
      required: true,
    }),
  }

  static flags = {
    tool: Flags.string({
      char: 't',
      description: 'AI CLI tool to manage',
      options: ['claude', 'codex', 'gemini'],
      default: 'claude',
    }),
    scope: Flags.string({
      char: 's',
      description: 'Configuration scope',
      options: ['user', 'project', 'local', 'system'],
      default: 'user',
    }),
    'dry-run': Flags.boolean({
      description: 'Preview changes without applying',
      default: false,
    }),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(SettingsSet)

    try {
      const dispatcher = new SettingsDispatcher()
      const result = await dispatcher.execute({
        tool: flags.tool as any,
        scope: flags.scope as any,
        action: 'set',
        key: args.key,
        value: args.value,
        dryRun: flags['dry-run'],
      })

      if (flags['dry-run']) {
        this.warn('DRY RUN - No changes applied')
        if (result.diff) {
          this.log('\nPreview:')
          this.log(result.diff)
        }
      } else {
        this.log(`✓ Set ${args.key} = ${args.value}`)
      }
    } catch (error) {
      this.error(error as Error, {exit: 1})
    }
  }
}
```

**依赖**: 任务 5.1
**验收标准**:
- 所有参数正确解析
- 错误处理友好（使用 oclif 的 `this.error()`）
- 输出格式正确（支持 `--json` 标志）
- 命令帮助自动生成

---

### 阶段 7: 测试和文档 (复杂度: 中等)

#### 任务 7.1: 单元测试

为每个模块编写测试：
- `tests/unit/adapters/claude.test.ts`
- `tests/unit/adapters/codex.test.ts`
- `tests/unit/adapters/gemini.test.ts`
- `tests/unit/fsStore.test.ts`
- `tests/unit/dispatcher.test.ts`

使用 fixtures 模拟配置文件。

#### 任务 7.2: 集成测试

- `tests/integration/settings.test.ts`: 端到端测试完整流程

#### 任务 7.3: 文档编写

- `docs/settings.md`: 详细使用文档
- 更新 `README.md`: 添加快速开始指南

**依赖**: 所有前置任务
**验收标准**:
- 测试覆盖率 > 80%
- 文档完整清晰

---

## 里程碑

- **M1 (Week 1)**: 项目骨架和领域模型完成
- **M2 (Week 2)**: 工具层和适配器实现完成
- **M3 (Week 3)**: CLI 命令和调度器完成
- **M4 (Week 4)**: 测试和文档完成，发布 v0.1.0

## 风险和缓解措施

### 风险 1: Gemini CLI 配置方式不明确
**缓解**: 优先实现 Claude 和 Codex 适配器，Gemini 作为最后实现

### 风险 2: 跨平台路径处理复杂
**缓解**: 使用 Node.js 的 `path` 模块，编写充分的单元测试

### 风险 3: TOML 解析库兼容性问题
**缓解**: 提前验证 @iarna/toml 与 Bun 的兼容性

## 下一步行动

1. 确认技术选型（CLI 框架、TOML 库）
2. 执行阶段 1: 项目基础搭建
3. 并行开发阶段 2 和阶段 3
4. 按顺序完成阶段 4-7

## 附录: 命令示例（基于 oclif）

```bash
# 列出 Claude Code 的用户级配置
xling settings:list --tool claude --scope user

# 列出配置（JSON 格式）
xling settings:list --tool claude --scope user --json

# 获取特定配置项
xling settings:get theme --tool claude --scope user

# 设置 Gemini CLI 的模型
xling settings:set model gemini-1.5-pro --tool gemini --scope user

# 预览修改（不实际写入）
xling settings:set theme dark --tool claude --scope project --dry-run

# 删除配置项
xling settings:unset theme --tool claude --scope project

# 切换 Codex 的 profile
xling settings:switch oss --tool codex

# 查看命令帮助
xling settings:list --help
xling settings:set --help

# 查看所有命令
xling --help
```

## oclif vs Commander.js 对比

| 特性 | oclif | Commander.js |
|------|-------|--------------|
| 企业级支持 | ✅ Heroku, Salesforce 等 | ✅ 广泛使用 |
| 插件系统 | ✅ 内置 | ❌ 需自行实现 |
| 自动文档生成 | ✅ | ❌ |
| TypeScript 支持 | ✅ 原生支持 | ✅ 通过 @types |
| 测试工具 | ✅ @oclif/test | ❌ 需自行配置 |
| JSON 输出 | ✅ 内置 --json | ❌ 需自行实现 |
| 子命令 | ✅ 文件系统路由 | ✅ 手动注册 |
| 学习曲线 | 中等 | 简单 |
| 适用场景 | 复杂 CLI 工具 | 简单脚本 |

**选择 oclif 的理由**：
- xling 是一个需要扩展的工具（未来可能支持更多 AI CLI）
- 需要插件系统来支持不同工具的适配器
- 自动文档生成减少维护成本
- 企业级质量保证
