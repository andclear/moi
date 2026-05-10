# 《回音 / Echo》数据模型文档

本文档记录项目数据模型的演进。阶段 0 仅建立文档入口，正式本地数据结构会在阶段 2 实现。

## 阶段 0 范围

- 保留 `src/db` 目录作为 Dexie 数据层入口。
- 保留 `src/schemas` 目录作为 Zod schema 入口。
- 暂不创建运行时数据表，避免在业务模型冻结前引入迁移负担。

## 后续模型方向

- `Project`：单个角色创作项目。
- `DossierDocument`：Markdown 角色档案正文。
- `DossierBlockMeta`：档案块来源、锁定状态与确认状态。
- `GenerationTask`：AI 调用任务与统计。
- `WorldEntry`：世界书条目。
- `GreetingVariant`：开场白候选。
- `TrialRun`：终审测试结果。
- `HistorySnapshot`：历史快照。
- `ExportRecord`：导出记录。
