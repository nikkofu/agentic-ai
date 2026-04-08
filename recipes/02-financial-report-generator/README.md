# Financial Report Generator Recipe

这个配方演示如何使用 DAG 工作流并发采集信息，再由 Writer Agent 汇总输出财经研报。

## 目标

- 并发采集市场新闻、公司动态、宏观信号
- 汇总为结构化研报（摘要、要点、风险、结论）
- 降低单线程检索的时延和信息遗漏

## 文件说明

- `runtime.yaml`：运行时配置（接入 Brave Search MCP）
- `workflow.yaml`：DAG 工作流定义（3 个 researcher 并发 + 1 个 writer 汇总）
- `prompt.md`：可选主提示词模板

## 前置条件

1. 已设置环境变量：
   - `OPENROUTER_API_KEY`
   - `BRAVE_API_KEY`
2. 安装依赖：

```bash
npm install
```

## 执行方式

```bash
npx tsx src/cli/runTask.ts \
  -p "$(cat recipes/02-financial-report-generator/prompt.md)" \
  --workflow recipes/02-financial-report-generator/workflow.yaml \
  --verbose
```

## 产出建议格式

- Executive Summary
- Market Signals
- Company Highlights
- Macro Context
- Risk & Uncertainty
- Final Recommendation

## 调优建议

- 若追求速度：减少并发分支输入长度
- 若追求质量：提高 researcher reasoner 等级
- 若追求成本：收缩 fallback 模型列表
