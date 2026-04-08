# GitHub Issue Solver Recipe

这个配方演示如何在 `agentic-ai` 中结合 `mcp-github` 与 `mcp-filesystem`，实现从 Issue 分析到修复建议与补丁落地的半自动闭环。

## 目标

- 读取指定 GitHub Issue 的上下文（标题、描述、评论）
- 在本地代码目录中定位可疑文件与调用链
- 生成修复方案与补丁草案
- 将修复结果回写到 Issue 评论（可选）

## 前置条件

1. 已配置环境变量：
   - `OPENROUTER_API_KEY`
   - `GITHUB_PERSONAL_ACCESS_TOKEN`
2. 项目根目录下存在可写 `data/` 目录（供 filesystem MCP 使用）
3. 已安装依赖：

```bash
npm install
```

## 文件说明

- `runtime.yaml`：该配方建议的运行时配置（含 GitHub + Filesystem MCP）
- `prompt.md`：建议输入到 `runTask` 的任务提示词模板

## 使用方式

### 1) 应用配方配置（可选）

你可以将 `runtime.yaml` 的内容合并到主配置 `config/runtime.yaml`，或临时替换后运行。

### 2) 准备任务提示词

将 `prompt.md` 内容复制后，替换其中：
- `<owner/repo>`
- `<issue_number>`
- `<local_project_path>`

### 3) 执行任务

```bash
npx tsx src/cli/runTask.ts -p "$(cat recipes/01-github-issue-solver/prompt.md)" --verbose
```

## 预期产物

- 本地：修复建议、影响文件列表、补丁草案
- GitHub：可选自动评论（需要在提示词中开启）

## 安全建议

- 在提示词中明确限制：
  - 不允许删除关键目录
  - 不允许修改 CI/CD 与 secrets 相关文件
  - 每次改动前先给出计划与影响评估
