## 项目基础约定

- **运行时**：本项目默认使用 Bun（>= 1.1）。所有开发、构建、测试脚本统一通过 `bun` 命令执行。
- **语言**：业务逻辑全部使用 TypeScript；如需 JavaScript 辅助脚本需在文档中注明原因。
- **测试框架**：单元与集成测试统一使用 Vitest，默认命令为 `bun test`。

## 环境准备

1. 安装 Bun（推荐 `curl -fsSL https://bun.sh/install | bash`）。
2. 在仓库根目录执行 `bun install` 安装依赖。
3. 运行 `bun test` 或 `bun test --watch` 确认测试通过。

## 开发约定

- 新增 npm scripts 需在 `package.json` 中声明，并通过 `bun run <script>` 调用。
- TypeScript 保持严格模式，公共 API 必须提供类型定义。
- 所有新功能必须配套 Vitest 用例；若暂无法测试需在 PR 中说明原因及补充计划。
