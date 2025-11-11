## 项目基础约定

- **运行时**：本项目默认使用 Bun（>= 1.3.2）。所有开发、构建、测试脚本统一通过 `bun` 命令执行。
- **语言**：业务逻辑全部使用 TypeScript；如需 JavaScript 辅助脚本需在文档中注明原因。
- **构建工具**：使用 tsdown 进行 TypeScript 编译，基于 rolldown 提供快速构建和打包。
- **代码检查**：使用 oxlint 进行代码质量检查，基于 Rust 的高性能 linter。
- **代码格式化**：使用 oxfmt 进行代码格式化，兼容 Prettier 配置。
- **测试框架**：单元与集成测试统一使用 Vitest，默认命令为 `bun test`。
- **CLI 框架**：使用 oclif 构建命令行工具，支持子命令、参数验证和自动文档生成。

## 环境准备

1. 安装 Bun（推荐 `curl -fsSL https://bun.sh/install | bash`）。
2. 在仓库根目录执行 `bun install` 安装依赖。
3. 运行 `bun run build` 编译 TypeScript 代码。
4. 运行 `./bin/run.js --help` 验证 CLI 工具正常工作。
5. 运行 `bun lint` 和 `bun fmt` 格式化代码。
6. 运行 `bun test` 或 `bun test --watch` 确认测试通过。

## 开发约定

- 新增 npm scripts 需在 `package.json` 中声明，并通过 `bun run <script>` 调用。
- TypeScript 保持严格模式，公共 API 必须提供类型定义。
- 所有新功能必须配套 Vitest 用例；若暂无法测试需在 PR 中说明原因及补充计划。
- 遵循 SOLID 原则：单一职责、开闭原则、里氏替换、接口隔离、依赖倒置。

## 项目结构

```
xling/
├── src/
│   ├── bin.ts               # CLI 入口点（编译到 dist/bin.js）
│   ├── commands/           # oclif 命令（文件系统路由）
│   │   └── settings/       # settings 命令组
│   │       ├── list.ts     # settings:list
│   │       ├── get.ts      # settings:get
│   │       ├── set.ts      # settings:set
│   │       ├── switch.ts   # settings:switch
│   │       └── inspect.ts  # settings:inspect
│   ├── domain/             # 领域模型
│   │   ├── types.ts        # 核心类型定义
│   │   ├── interfaces.ts   # 接口定义
│   │   └── validators.ts   # 验证器
│   ├── services/           # 业务逻辑
│   │   └── settings/
│   │       ├── adapters/   # 工具适配器
│   │       │   ├── base.ts     # 抽象基类
│   │       │   ├── claude.ts   # Claude Code 适配器
│   │       │   ├── codex.ts    # Codex 适配器
│   │       │   └── gemini.ts   # Gemini CLI 适配器
│   │       ├── fsStore.ts      # 文件系统操作
│   │       └── dispatcher.ts   # 调度器
│   └── utils/              # 工具函数
│       ├── errors.ts       # 错误类型
│       ├── logger.ts       # 日志工具
│       └── format.ts       # 格式化工具
├── test/                   # 测试和 fixtures
└── dist/                   # 编译输出（tsdown）
    ├── run.js              # 编译后的 CLI 入口（可执行）
    ├── commands/           # 编译后的命令
    ├── services/           # 编译后的服务
    └── ...
```

## 架构设计

### 适配器模式

项目使用适配器模式统一管理不同 AI CLI 工具的配置：

- **BaseAdapter**: 抽象基类，实现通用逻辑（DRY 原则）
- **ClaudeAdapter**: Claude Code 配置适配器（JSON 格式）
- **CodexAdapter**: Codex 配置适配器（TOML 格式，支持 profile）
- **GeminiAdapter**: Gemini CLI 配置适配器（JSON 格式）

### 调度器

`SettingsDispatcher` 负责将请求路由到对应的适配器：

- 依赖 `SettingsAdapter` 接口，不依赖具体实现（DIP 原则）
- 新增工具只需注册适配器，无需修改命令层（OCP 原则）

### 命令层

使用 oclif 构建 CLI 命令：

- 文件系统路由：`src/commands/settings/list.ts` → `xling settings:list`
- 内置参数验证、帮助文档生成、JSON 输出支持
- 统一的错误处理和日志输出

## 支持的工具

### Claude Code

- **Scopes**: user, project, local
- **配置文件**:
  - User: `~/.claude/settings.json`
  - Project: `.claude/settings.json`
  - Local: `.claude/settings.local.json`

### Codex

- **Scopes**: user
- **配置文件**: `~/.codex/config.toml`
- **特性**: Profile 切换

### Gemini CLI

- **Scopes**: user, project, system
- **配置文件**:
  - User: `~/.gemini/settings.json`
  - Project: `.gemini/settings.json`
  - System: 平台相关路径

## 常用命令

```bash
# 开发
bun run build          # 使用 tsdown 编译 TypeScript
bun run dev            # 监听模式编译（tsdown --watch）

# 代码质量
bun run lint           # 使用 oxlint 检查代码
bun run lint:fix       # 使用 oxlint 自动修复问题
bun run format         # 使用 oxfmt 格式化代码
bun run format:check   # 检查代码格式
bun run typecheck      # TypeScript 类型检查（tsc --noEmit）

> Lint/format 风格通过 `.oxlintrc.json` 与 `.oxfmtrc.json` 统一配置（参考 [oxlint 官方文档](https://oxc.rs/docs/guide/usage/linter/config.html)）。  
> 其中强制使用双引号、显式分号，并忽略 `dist/`、`node_modules/` 等生成目录。

# 测试
bun test               # 运行测试
bun test:watch         # 监听模式测试
bun test:coverage      # 测试覆盖率

# 使用 CLI（示例）
./dist/run.js --help                                       # 查看帮助/全局命令

# settings:list - 默认摘要，--table/--json 切换
./dist/run.js settings:list --tool claude --scope user
./dist/run.js settings:list --tool codex --table

# settings:get - 查看完整配置文件，可 --no-json 文本模式
./dist/run.js settings:get --tool claude --scope user
./dist/run.js settings:get --tool codex --no-json

# settings:set - 通过 IDE 编辑 Claude 变体
./dist/run.js settings:set --tool claude --scope user --name hxi            # 创建/编辑 settings.hxi.json（默认 VS Code）
./dist/run.js settings:set --tool claude --scope project --name default --ide cursor --no-json

# settings:switch - Codex profile / Claude 变体切换
./dist/run.js settings:switch oss --tool codex
./dist/run.js settings:switch hxi --tool claude --scope user

# settings:inspect - 查看文件状态（默认 JSON，可 --no-json）
./dist/run.js settings:inspect --tool claude --scope user
./dist/run.js settings:inspect --tool codex --no-json
```

## 扩展指南

### 添加新的 AI CLI 工具

1. 在 `src/services/settings/adapters/` 创建新的适配器类
2. 继承 `BaseAdapter` 并实现必要方法
3. 在 `SettingsDispatcher` 构造函数中注册适配器
4. 更新类型定义 `ToolId` 添加新工具

示例：

```typescript
// src/services/settings/adapters/newtool.ts
export class NewToolAdapter extends BaseAdapter {
  readonly toolId = 'newtool' as const;

  resolvePath(scope: Scope): string {
    // 实现路径解析
  }

  validateScope(scope: Scope): boolean {
    // 实现 scope 验证
  }
}

// src/services/settings/dispatcher.ts
constructor() {
  this.adapters = new Map<ToolId, SettingsAdapter>();
  // ... 其他适配器
  this.adapters.set('newtool', new NewToolAdapter());
}
```

### 添加新的命令

1. 在 `src/commands/settings/` 创建新的命令文件
2. 继承 `Command` 类并实现 `run` 方法
3. 定义 `args` 和 `flags`
4. oclif 会自动注册命令

## 注意事项

- 配置文件操作使用原子写入（临时文件 + 重命名）
- settings 相关命令只依赖 `--tool`、`--scope` 等 flag 控制行为，不再提供 `developerShortcuts` 这类键级配置
- 自动备份现有配置文件（`.bak` 后缀）
- 所有错误继承自 `XlingError` 基类
- 使用 Zod 进行运行时类型验证
