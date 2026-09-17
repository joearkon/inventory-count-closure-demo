# References for Codex

> **维护方**：陈子卓野的智能伙伴（飞书/豆包工作侧）
> **使用方**：Codex（GitHub Demo 侧）
> **同步机制**：每次云端文档更新后，重新打包本目录并覆盖上传

---

## 目录索引

| 文件 | 来源 | 说明 |
|---|---|---|
| `architecture.md` | 飞书云文档 `ZDaAdGuh0oLOdcxNlUscJ2uZnzD` | 架构定稿（7 章 + 8 附录 A-H），1431 行 |
| `acceptance_scenarios_v1.md` | 飞书云盘 `U7rqbqMlbo8DO9xOIjncIU50nkf` | 10 个 1 分钟归因 E2E 场景 + mock 响应 |
| `progress-doc.md` | 飞书云盘 `NBbIbIDuroSLq2xKkg1c2aEBnwg` | 项目进度跟踪（含里程碑 / 解锁状态 / 风险） |
| `mvp-package/deliverables/v1/*.json` | MVP package | 5 个结构化交付物（指标字典 / 阈值 / 决策树 / 动作映射 / 物料分类）|
| `mvp-package/knowhow/v1/*.md` | MVP package | 4 份 knowhow（异常判定 / 行业基准 / 研判模板 / Prompt 模板）|
| `mvp-package/.github/PULL_REQUEST_TEMPLATE.md` | MVP package | PR 模板（含业务 review checklist）|

---

## 使用方式

1. **架构理解**：从 `architecture.md` 开始读，重点：
   - 第 1 章 GitHub Demo 分析（理解你现有 demo 能力边界）
   - 第 2 章 双轨推送架构（你要落地的整体方案）
   - 第 3 章 RAG 知识库（检索设计）
   - 第 4 章 经营 Skill 清单（15 个 function-calling 接口）
   - 附录 A 我交付物清单（你的输入）
   - 附录 F 职责边界（谁做什么 / 谁不做什么）
   - 附录 G 项目计划（9/17 - 9/25 节奏）
   - 附录 H 验收场景（10 个 E2E）

2. **结构化数据加载**：从 `mvp-package/deliverables/v1/*.json` 直接读 JSON，不要自己重新定义：
   - `metric_dictionary.json` → 30 个指标 schema
   - `threshold_table.json` → 24 条阈值
   - `d2_d1_s1_t2.json` → 4 棵决策树 + 5 档输出
   - `response_action_map.json` → 16 条动作 + 5 步闭环
   - `material_taxonomy.json` → 6 类物料分类

3. **Knowhow 内容**：从 `mvp-package/knowhow/v1/*.md` 直接 chunk + Embedding，不要 fork 自己版本。

4. **验收**：按 `acceptance_scenarios_v1.md` 的 10 个场景跑 E2E，逐个 mock 验证。

---

## 与飞书云端的同步策略

> **本目录是飞书云端的镜像（snapshot）**。架构文档更新后，本目录会被重新打包并覆盖上传。

- **什么时候重新打包**：架构文档 v1.1 / v2.0 等版本变更时；M5 校准后；新增验收场景时。
- **Codex 怎么确认自己看的是最新版本**：对比本目录的 `architecture.md` 与云端文档（用 `lark-cli docs +fetch` 拉取最新 → diff）。
- **如果两边不一致**：以**云端**为准，本目录会被重新同步。

---

## 飞书云端原始链接

| 文档 | 链接 |
|---|---|
| 架构文档 | https://my.feishu.cn/docx/ZDaAdGuh0oLOdcxNlUscJ2uZnzD |
| 验收场景 v1 | https://my.feishu.cn/file/U7rqbqMlbo8DO9xOIjncIU50nkf |
| 项目进度跟踪 | https://my.feishu.cn/file/NBbIbIDuroSLq2xKkg1c2aEBnwg |
| MVP package v1 zip | https://my.feishu.cn/file/Y3rPbFC4BoHmDjxLPhccvhYqnfd |