## 关联信息

- 关联任务 / Issue：[链接]
- 关联架构文档：[附录 X](https://my.feishu.cn/docx/ZDaAdGuh0oLOdcxNlUscJ2uZnzD)
- 关联交付物：`docs/deliverables/v1/[文件名]`

---

## 变更类型（必填）

- [ ] 新功能（feat）
- [ ] 修复（fix）
- [ ] 重构（refactor）
- [ ] 文档（docs）
- [ ] 性能（perf）
- [ ] 测试（test）

---

## 变更摘要（必填，1-3 句话）

> 简明扼要描述这个 PR 做了什么 / 为什么做 / 改了哪些文件

---

## 业务可行性 Review（Codex 提交后由「陈子卓野的智能伙伴」审核）

> 这一节由 reviewer 填写，不需要提交者预填

- [ ] **数据流**：从 Base 表 / 飞书 webhook → Skill → AI 助手的数据流是否正确？
- [ ] **异常判定逻辑**：阈值 / 决策树 / 5 档输出是否符合 `d2_d1_s1_t2.json` 定义？
- [ ] **Prompt 调优**：是否引入了新的 Prompt 文案？是否在 `prompt_templates.md` 之外？
- [ ] **响应动作**：是否触发了响应动作？是否在 `response_action_map.json` 的 16 条动作之内？
- [ ] **门店数据隔离**：是否只查询 / 修改了涉及门店的数据？
- [ ] **三语适配**：UI 是否在 zh-CN / en-US / id-ID 三语下都正确显示？

> 如果以上任何一项不通过，请明确指出哪一项、改动建议是什么。

---

## 代码风格 Review（Codex 提交后由陈子卓野 user 审核）

> 这一节由 reviewer 填写

- [ ] TypeScript 类型完整
- [ ] 测试覆盖率 ≥ 70%
- [ ] Lint 通过
- [ ] Wrangler dev 本地起动成功
- [ ] CI 通过

---

## 验收清单（必填，对照附录 G.5 MVP DoD）

> 这一节由提交者勾选

- [ ] 三语 HTML App（移动端 375px 适配）
- [ ] 飞书 webhook 集成（三路：接收 / 回调 / 推送）
- [ ] RAG 检索（命中率 ≥ 85%）
- [ ] Skill 15 个全接入（单测 ≥ 70%）
- [ ] 5 档研判输出（20 个 mock 场景验证）
- [ ] 响应动作闭环（16 条动作 + 5 步反馈）
- [ ] 部署可访问（健康检查 200）

---

## 测试场景（必填，至少 3 个）

> 列出这个 PR 涉及的具体测试场景

1. 场景 1：[场景描述 + 预期结果]
2. 场景 2：[场景描述 + 预期结果]
3. 场景 3：[场景描述 + 预期结果]

---

## 已知限制（必填，无则写"无"）

> 这个 PR 有什么已知限制 / 待优化项 / 暂时妥协的方案

---

## Checklist（提交前必过）

- [ ] 本地 `wrangler dev` 测试通过
- [ ] 单元测试通过
- [ ] Lint 通过
- [ ] CI 通过
- [ ] 文档更新（如果改动了接口 / 配置 / 流程）
- [ ] 变更摘要清晰
- [ ] 业务可行性 review 请求发出（在 PR 描述中 @ 陈子卓野的智能伙伴）
- [ ] 验收清单勾选

---

## 截图 / 录屏（如果有 UI 变更）

> 附上变更前后的截图或录屏（移动端 + 桌面端各一张）

---

> **架构参考**：[《加盟商运营诊断与总部管理双轨推送架构》](https://my.feishu.cn/docx/ZDaAdGuh0oLOdcxNlUscJ2uZnzD)
> **交付物参考**：[`docs/deliverables/v1/`](https://github.com/joearkon/inventory-count-closure-demo/tree/main/docs/deliverables/v1)
> **Knowhow 参考**：[`docs/knowhow/v1/`](https://github.com/joearkon/inventory-count-closure-demo/tree/main/docs/knowhow/v1)