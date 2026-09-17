# 加盟商运营诊断 MVP 项目进度跟踪

> 维护方: 陈子卓野的智能伙伴（飞书/豆包工作侧）
> 创建时间: 2026-09-16 23:48
> 最新更新: 2026-09-17 00:10（Day 1 启动确认 + 3 个问题解锁）
> 项目周期: 2026-09-16（启动） ~ 2026-09-25（MVP 验收）

---

## 一、当前状态

- **项目阶段**：P0 完成（架构定稿）→ P1 进行中（Day 1 解锁，Codex 可启动）
- **今日完成**：
  - 架构文档 7 章 + 8 附录（A-H 含 10 个 1 分钟归因 E2E 场景）落 https://my.feishu.cn/docx/ZDaAdGuh0oLOdcxNlUscJ2uZnzD
  - MVP 交付物打包（10 份文件，5 JSON + 4 MD + 1 PR 模板）→ https://my.feishu.cn/file/Y3rPbFC4BoHmDjxLPhccvhYqnfd
  - 验收场景 v1（10 个 E2E + mock 响应）→ https://my.feishu.cn/file/U7rqbqMlbo8DO9xOIjncIU50nkf
  - **3 个启动阻塞已解锁**（详见第五节）
- **待启动**：
  - Codex Day 1（fork / wrangler init / 3 路由骨架 / CI / 9/17 18:00 Day 1 PR）

---

## 二、Day 1 红线动作完成情况（我这一侧）

| # | 动作 | 状态 | 说明 |
|---|---|---|---|
| 1 | 打包 5 份结构化交付物 | ✅ 完成 | `deliverables/v1/` 下 5 个 JSON |
| 2 | 打包 4 份 knowhow MD | ✅ 完成 | `knowhow/v1/` 下 4 份 |
| 3 | 建 PR 模板 | ✅ 完成 | `.github/PULL_REQUEST_TEMPLATE.md`（含业务 review checklist）|
| 4 | 上传到飞书云盘 | ✅ 完成 | zip 文件 token: Y3rPbFC4BoHmDjxLPhccvhYqnfd |
| 5 | 项目进度跟踪文档 | ✅ 完成 | 即本文件，3 个问题解锁后更新 |
| 6 | 验收场景 v1 | ✅ 完成 | acceptance_scenarios_v1.md，10 个 1 分钟归因 E2E + mock 响应 |
| 7 | MEMORY 同步 | ✅ 完成 | 架构定稿 + 交付物清单 + 行业基准 + Demo 飞书集成结构 |

---

## 三、Day 1 Codex 这一侧（解锁，可启动）

| # | 动作 | 状态 | 依赖 |
|---|---|---|---|
| 1 | 直接在 demo 仓库 commit（已有权限） | 🟢 可启动 | user 已确认 Codex 有 push 权限 |
| 2 | 建 dev 分支 | 🟢 可启动 | - |
| 3 | wrangler init + 复用已配 secret | 🟢 可启动 | demo 已配 4 组 secret（详见第六节）|
| 4 | 3 路由骨架（webhook/rag/skill） | 🟢 可启动 | - |
| 5 | CI 配置（lint + test + deploy） | 🟢 可启动 | - |
| 6 | 9/17 18:00 前交 Day 1 PR | ⏳ 待启动 | - |

**Codex 不需要新开任何 app / 暴露任何 webhook** —— 直接复用 demo 已配置的体系。

---

## 四、关键里程碑

| 日期 | 里程碑 | 状态 | 负责人 |
|---|---|---|---|
| 9/16 | 架构定稿 | ✅ 完成 | 我 |
| 9/17 | Day 1 启动 | 🟢 已解锁 | 我 ✅ / Codex 🟢 |
| 9/18 | Worker + D1 schema PR | ⬜ 待启动 | Codex |
| 9/19 | 飞书 webhook 接通 | ⬜ 待启动 | Codex |
| 9/20 | RAG 检索实现 | ⬜ 待启动 | Codex |
| 9/21 | Skill 调用 + AI 助手 + 三语 UI | ⬜ 待启动 | Codex |
| 9/22 | 集成联调 | ⬜ 待启动 | Codex |
| 9/23 | Mock 数据灌入 | ⬜ 待启动 | Codex + 我 review |
| 9/24 | 5 档研判验证 | ⬜ 待启动 | Codex |
| **9/25** | **MVP 验收** | ⬜ 待启动 | 三方 |
| 10/23 | 阈值 v2 拍板 | ⬜ 待启动 | 我 + user |

---

## 五、阻塞解锁（9/17 00:10）

| 问题 | 决定 | 影响 |
|---|---|---|
| **GitHub push 权限** | user 确认 Codex 有权限管理 demo 仓库 | Codex 直接 commit，无需 fork / 无需 user 后续动作 |
| **Bot 凭据** | demo 已配 `FEISHU_APP_ID` + `FEISHU_APP_SECRET`，Codex 复用 | 不需要新开 app / 不需要"协调 bot" |
| **Webhook URL** | 复用 demo 的 `FEISHU_WEBHOOK_URL`（推）+ `FEISHU_VERIFICATION_TOKEN`（收）| Codex 不需要新暴露服务 |

---

## 六、demo 已配置的飞书集成（Codex 直接复用）

| Cloudflare Workers Secret | 用途 | 来源 |
|---|---|---|
| `FEISHU_APP_ID` + `FEISHU_APP_SECRET` | 读 Base（销售明细 / BOM / 台账 / 调拨等 9 表）| demo 已配，user 已确认 |
| `FEISHU_WEBHOOK_URL` + `FEISHU_SIGNING_SECRET` | 主动推群消息 | demo 已配 |
| `FEISHU_VERIFICATION_TOKEN` | 接收群消息事件 | demo 已配 |
| `DOUBAO_API_KEY` + `DOUBAO_MODEL` | AI 助手调方舟 | demo 已配 |

**Base 表清单**（worker.js line 73-81 已硬编码）：

| 表 | table_id |
|---|---|
| 门店销售明细 | `tbly9ewKpWTpeQzC` |
| 商品档案 | `tbl5TpmrmGN8A7tW` |
| 物料主数据 | `tblFTA3dL0z2gNFu` |
| 库存台账 | `tblGDep7xILyvVgy` |
| 调拨单主表 | `tblGCN6WftHFSjyg` |
| 调拨单明细 | `tblroRBpqqCdrTVv` |
| 门店库存流水 | `tblG341iQHvU1nSc` |
| 真实 BOM | `tbl3DtZPX3kwct1A` |

Base token 仍是 `SVwKb8N17aQDNSsuddmcL95fnLg`（即"门店库存管理 Demo"那张多维表）。

---

## 七、待 Codex 拍板事项

1. Cloudflare 账号 / 项目名 / 域名（demo 已有 → Codex 直接复用还是另开？）
2. wrangler 配置（D1 ID + R2 bucket 名 — demo 已配 `inventory-count-closure-demo-db` / `inventory-count-closure-demo-state`）
3. CI 选型（GitHub Actions / 其他）
4. TypeScript / 框架选型（Hono / 其他）
5. 是否沿用 demo 已有的 6 个印尼语 tool 名字（lapor_kerugian / transfer_stok / stok_opname / receipt_inventory / request_restock / query_inventory）

---

## 八、风险与阻塞

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| ~~Bot 凭据迟迟不到位~~ | ~~中~~ | ~~高~~ | ✅ 已解锁（demo 已配） |
| Codex 9/17 没能启动 | 中 | 高 | 验收日顺延一天 |
| Mock 数据不全 | 低 | 中 | 我准备 30 天仿真数据 |
| 误报率超 15% | 低 | 中 | 10/23 阈值校准 |
| Base 表与 demo 硬编码不一致 | 低 | 中 | 沿用 demo 的 9 个表，无需新增 |

---

## 九、链接索引

- 架构文档：https://my.feishu.cn/docx/ZDaAdGuh0oLOdcxNlUscJ2uZnzD
- MVP 交付物 zip：https://my.feishu.cn/file/Y3rPbFC4BoHmDjxLPhccvhYqnfd
- 验收场景 v1：https://my.feishu.cn/file/U7rqbqMlbo8DO9xOIjncIU50nkf
- Demo 仓库：https://github.com/joearkon/inventory-count-closure-demo
- 任务派发（已启动）：
  - [门店端 HTML App + AI 助手交互原型](https://aily.feishu.cn/tasks/7686161387520822226)
  - [总部端飞书互动卡片机器人原型](https://aily.feishu.cn/tasks/7686161387646635219)

---

> **下次更新**：2026-09-17 18:00（Day 1 收工时）
> **下次大更新**：2026-09-22（P2 收工时）