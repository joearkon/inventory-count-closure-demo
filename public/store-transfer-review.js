(() => {
  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char]));
  const fmt = (value) => Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 3 });
  const by = (id) => document.getElementById(id);
  function panel() {
    let node = by('store-request-panel'); if (node) return node;
    const anchor = by('demo-rows')?.closest('.panel'); if (!anchor) return null;
    node = document.createElement('section'); node.id = 'store-request-panel'; node.className = 'panel';
    node.innerHTML = '<div class="panel-head"><h2>门店调拨流转追溯</h2><span>总部只监控，不审核</span></div><div class="note">调出门店提交即扣减库存；调入门店收货确认后增加库存。总部仅追溯单据、处理异常和查看未收货风险。</div><div class="table-wrap"><table><thead><tr><th>调拨单号</th><th>日期</th><th>调出门店</th><th>调入门店</th><th>物料</th><th>当前流转</th><th>追溯</th></tr></thead><tbody id="store-request-rows"></tbody></table></div>';
    anchor.before(node); return node;
  }
  async function render() {
    if (!panel()) return;
    try {
      const response = await fetch('/api/feishu-sync/state?view=transfers', { cache: 'no-store' }); const state = await response.json();
      if (!response.ok) throw Error(state.error || '读取失败');
      const rows = state.transfers?.store_requests || [];
      by('store-request-rows').innerHTML = rows.length ? rows.map((row) => `<tr><td><b>${esc(row.request_no)}</b><br><small>门店 HTML 提交</small></td><td>${esc(row.business_date)}</td><td>${esc(row.from_store_code)}</td><td>${esc(row.to_store_code)}</td><td>${esc(row.material_name)}<br><b>${fmt(row.qty)} ${esc(row.unit)}</b></td><td>${row.status === 'pending_receipt' ? '<span class="tag demo">调出已记账 · 待调入收货</span>' : '<span class="tag">调入已收货 · 双边已入账</span>'}</td><td><small>调出：${esc(row.outbound_event_id || '—')}<br>调入：${esc(row.inbound_event_id || '待收货')}</small></td></tr>`).join('') : '<tr><td colspan="7" class="empty">暂无门店调拨流转记录。</td></tr>';
    } catch (error) { by('store-request-rows').innerHTML = `<tr><td colspan="7" class="empty">读取门店调拨失败：${esc(error.message)}</td></tr>`; }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render, { once: true }); else render();
})();
