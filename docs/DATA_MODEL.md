# 《来岛上 / MOI》数据模型文档

本文档记录项目数据模型的演进。阶段 2 已建立本地 IndexedDB 数据底座。

## 阶段 2 范围

- `src/db/db.ts` 定义 Dexie 数据库实例。
- `src/db/schema.ts` 定义 IndexedDB 表结构和索引。
- `src/db/types.ts` 定义核心业务数据类型。
- `src/db/repositories` 提供所有本地持久化入口，页面不得直接操作 Dexie 表。
- `src/db/services` 提供自动保存和历史快照恢复服务。
- `src/schemas` 提供 Zod 运行时校验。

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

## 本地表

- `settings`：API 设置和界面偏好。
- `activations`：本地激活状态缓存。
- `adminSettings`：后台管理前端状态缓存，不保存管理员密钥。
- `projects`：当前角色项目、Markdown 档案、当前步骤和阶段结果。
- `histories`：从任意节点恢复所需的历史快照。
- `generations`：AI 生成任务、输入摘要、输出、Token 和耗时。
- `exports`：导出版本、JSON 摘要和 PNG 写入信息。
