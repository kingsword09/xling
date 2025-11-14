# Generate AI-Powered Git Commit Message

使用 AI 分析当前 git 仓库的所有变更，生成专业的提交信息建议（中英文双语版本）。

## 执行指令

请执行以下命令来生成 git 提交信息：

```bash
xling sx gcm
```

## 功能说明

此命令会：
1. **收集 git 变更**：分析所有变更（包括 staged、unstaged 和 untracked 文件）
2. **AI 智能分析**：通过 xling 的多提供商 AI 系统分析代码变更的语义和影响
3. **生成提交信息**：返回结构化的提交信息建议，包含：
   - 中文版本的提交信息
   - 英文版本的提交信息
   - 符合 Conventional Commits 规范的格式建议

## 工作原理

该命令调用 xling 的 `gcm` shortcut（Generate Commit Message），其内部实现：
- 使用 git diff 和 git ls-files 收集所有变更
- 将变更内容通过管道传递给 `xling p --stdin`
- AI 模型分析变更并生成符合最佳实践的提交信息

## 前置条件

1. **xling CLI 已安装**：确保 xling 命令可用
2. **AI 提供商已配置**：在 `~/.claude/xling.json` 中配置了至少一个 prompt provider
3. **Git 仓库**：当前目录必须是一个 git 仓库
4. **有变更内容**：仓库中存在未提交的变更

## 使用示例

在 Claude Code 中输入：
```
/xling:commit-msg
```

Claude 将执行 `xling sx gcm` 并显示生成的提交信息建议。

## 注意事项

- 此命令**仅生成**提交信息，不会执行 `git add`、`git commit` 或 `git push`
- 生成的是建议信息，您可以根据需要修改后再使用
- 如果 AI 提供商请求失败，xling 会自动尝试备用提供商
- 建议先 review 生成的提交信息，确认准确性后再实际提交

## 相关命令

- `xling sx` - 查看所有可用的 xling shortcuts
- `xling p` - 直接使用 xling 执行 AI prompt
- `xling settings:get` - 查看当前配置

## 配置参考

如需自定义提交信息生成的 prompt，可修改 `~/.claude/xling.json` 中的 `shortcuts.gcm` 配置。

默认 prompt：
```
分析代码变更并生成提交信息建议，分为中英文版本
```

您可以根据项目需求调整 prompt，例如：
- 指定提交信息风格（Conventional Commits、语义化版本等）
- 要求特定的详细程度
- 添加项目特定的上下文要求
