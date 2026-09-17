# 业务层文档索引

> **本目录定位**：从业务角度定义 MOMOYO 加盟商运营的关键规则与流程，作为产品 / 工程 / 商务 / 财务之间对齐的"单源真相"。
>
> **谁负责**：本目录由「陈子卓野的工作伙伴」（豆包）输出；与 `../knowhow/` 业务侧的 knowhow 互补，但本目录更偏向 **MVP 可落地的字段 / 流程 / 状态定义**。
>
> **撰写日期**：2026-09-17
>
> **当前版本**：v1（MVP 业务定义阶段）

---

## 文档清单

| 文档 | 用途 | 状态 |
|---|---|---|
| [franchisee_metric_definition_v1.md](./franchisee_metric_definition_v1.md) | 加盟商经营指标定义表（5 类 34 项 × 8 字段 + 可信度）| ✅ 完成 |
| [franchisee_ordering_settlement_v1.md](./franchisee_ordering_settlement_v1.md) | 加盟商订货结算流程（10 节点状态机 + 异常处理）| ✅ 完成 |

---

## 阅读顺序

- **产品经理 / 业务方**：先看 `franchisee_metric_definition_v1.md` → 再看 `franchisee_ordering_settlement_v1.md`
- **Codex / 工程师**：先看 `franchisee_ordering_settlement_v1.md` 11 章（P1/P2/P3 分阶段）→ 看 `franchisee_metric_definition_v1.md` 的字段定义
- **财务 / 商务**：直接看 `franchisee_ordering_settlement_v1.md` 的 2/4/5/6/7/8 章

---

## 三阶段对应

```
v1（本目录）            v2（Codex 实施）         v3（V2 单独项目）
┌─────────────┐        ┌──────────────┐        ┌─────────────┐
│ 业务定义层    │  ───►  │ 数据层 + 投放   │  ───►  │ 支付 + 信用   │
│             │        │              │        │             │
│ • 5 类指标   │        │ • Base 3 表  │        │ • 支付网关    │
│   34 项× 8 字段│       │ • 12 态状态机│        │ • 信用评分    │
│ • 10 节点流程│        │ • 门店助手 3 路 │       │ • 税务合规   │
│   + 异常处理 │        │ • 总部看板   │        │ • 物流 API   │
└─────────────┘        └──────────────┘        └─────────────┘
   2026-09-17            9/18 - 10/中            V2 项目
```

---

## 评审要求

### 周六前必须拍板

| 项目 | 来源 | 谁拍板 |
|---|---|---|
| 试点加盟商范围 | 1 家 vs 多家（MMY-BANTEN-SANGGIANG 优先）| Joe + 总部商务 |
| 5 类指标权重 | 哪些 P1 / 哪些 P2 / 哪些 P3 | Joe + 财务 |
| 10 节点流程边界 | 货到付款是否启用 / 短货补偿 30% 是否合规 | 总部财务 |
| Base 3 张新表 schema | Codex 出初稿 → Joe 审 | Joe + Codex |

### 可推迟到 V2

- 信用评分卡权重（已给默认值）
- 印尼 PPN 税务发票（监管稳定后再做）
- 物流 API 实时集成（先用人工录入）
- 多币种报价（先 IDR 单币种）

---

## 与其他文档的引用关系

| 文档 | 引用本目录 | 引用本目录的目的 |
|---|---|---|
| `../knowhow/v2/store_operations_anomaly.md` | 5 维度异常判定 | S1-S5 用于指标的"加盟商动作"字段 |
| `../knowhow/v2/store_operations_scenarios_v1.md` | ST-1 ~ ST-5 场景 | 验证指标的 MVP 场景 |
| `../../knowhow/v1/inventory_anomaly.md` | D1/D2/S1/T2 异常 | 库存差异类指标的对齐 |
| 产品场景文档（飞书云端）| 本目录 | 加盟商运营诊断和跟踪大方向 |
