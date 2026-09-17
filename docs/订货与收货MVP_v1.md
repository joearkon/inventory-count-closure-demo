# 订货与收货 MVP v1

## 目标

为库存研判和跟进工单提供可执行的“紧急补货草稿”和“收货草稿”，同时坚持所有库存写入由人工确认。当前实现保存在 R2 演示状态中，不回写飞书、不自动推送，也不重算或改写历史流水。

## 页面

- `/purchase-orders/`：订货单列表与新建订货草稿，列表每页 15 条。
- `/receipt-orders/`：收货单列表与新建收货草稿，列表每页 15 条。
- `/procurement-detail/?type=purchase&id=...`：订货单详情、状态、物料、关联收货和操作记录。
- `/procurement-detail/?type=receipt&id=...`：收货单详情、关联订货单、入库流水和操作记录。

列表与详情分开，创建功能通过页内 Tab 展示，避免所有信息堆叠在一个长页面。

## 状态流转

订货单：

```text
draft
  → pending_receipt
  → partially_received
  → received

draft / 未发生收货的 pending_receipt
  → cancelled
```

收货单：

```text
draft → received
draft → cancelled
```

订货草稿保存和订货确认提交都不改变库存。收货草稿也不改变库存；只有 `draft → received` 的人工确认动作会逐条生成 `receipt` 库存事件。同一收货单只能确认一次。

## 数据关系

订货单和收货单均支持多物料明细。收货单可关联 `order_id / order_no`，也可以作为独立收货创建。关联订货单时，收货数量不得超过该物料未收数量；允许多次收货并将订货单更新为部分收货或已收货。

两类单据预留：

- `source_work_order_id`
- `source_type`：`manual / work_order / restock_request / ai_suggestion`
- `urgency`：`normal / urgent / critical`

由工单创建时，草稿及其最终收货流水会关联回工单详情。

## API

- `POST /api/purchase-orders`
- `GET /api/purchase-orders/:id`
- `POST /api/purchase-orders/:id/submit`
- `POST /api/purchase-orders/:id/cancel`
- `POST /api/receipt-orders`
- `GET /api/receipt-orders/:id`
- `POST /api/receipt-orders/:id/confirm`
- `POST /api/receipt-orders/:id/cancel`
- `GET /api/state?view=procurement`

## 验证

`tests/procurement-orders.mjs` 覆盖：

1. 两个列表页和详情页可访问；
2. 两项物料订货草稿；
3. 草稿不写库存；
4. 人工提交订货；
5. 第一批收货后为部分收货；
6. 第二批收货后为已收货；
7. 每条确认物料生成一条收货库存流水；
8. 重复确认返回 409；
9. 独立收货草稿取消后不写库存。

## 当前边界

- 没有供应商主档、价格、税费、结算和审批链。
- 没有与真实飞书订货/收货表双向同步。
- 已确认收货沿用现有库存事件撤销机制，尚未提供整张收货单冲销页面；生产版需增加红冲而非直接编辑历史流水。
- 当前为演示状态存储，不包含并发版本号；服务端确认时会再次核验订货未收数量和收货单状态，以降低重复入库风险。
