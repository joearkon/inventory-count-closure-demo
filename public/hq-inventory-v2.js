(() => {
  if (!document.body.matches('[data-view="hq"]')) return;
  const esc = (v) => String(v ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[c]));
  const fmt = (v) => Number(v || 0).toLocaleString('zh-CN', { maximumFractionDigits: 3 });
  const materialKey = (r) => `${r.material_name}|${r.unit}`;
  const risk = (r) => r.theoretical_closing_qty < 0 ? ['负库存', 'danger'] : r.safety_qty != null && r.theoretical_closing_qty < r.safety_qty ? ['低于安全库存', 'warning'] : ['正常', 'good'];
  let data, chosenStore = '', chosenMaterial = '';
  const host = document.createElement('section');
  host.id = 'inventory-hq'; host.className = 'section inventory-hq';
  host.innerHTML = '<div class="section-header"><div><div class="section-title">门店库存风险总览</div><div class="section-extra">各门店独立回算；点击门店下钻库存与风险，再按物料查看跨店库存矩阵。</div></div><div class="section-extra" id="inventory-hq-summary">读取中…</div></div><div id="inventory-hq-content"></div>';
  const anchor = document.querySelector('#anomaly-workspace'); anchor?.parentNode.insertBefore(host, anchor);
  const css = document.createElement('style');
  css.textContent = '.inventory-hq{overflow:visible}.risk-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;padding:16px 20px}.risk-card{position:relative;text-align:left;border:1px solid #e5e6eb;border-radius:8px;background:#fff;padding:14px;cursor:pointer;font:inherit;color:inherit}.risk-card:hover,.risk-card.active{border-color:#91b4ff;background:#f7faff}.risk-card b{font-size:16px}.risk-card small{display:block;margin-top:5px;color:#8f959e}.risk-kpis{display:flex;gap:12px;margin-top:12px}.risk-kpis span{font-size:12px;color:#646a73}.risk-kpis strong{color:#1f2329}.risk-badge{position:absolute;right:12px;top:12px;font-size:11px;border-radius:4px;padding:3px 6px}.risk-badge.danger{background:#ffe8e8;color:#d72a2a}.risk-badge.warning{background:#fff4df;color:#b87300}.risk-badge.good{background:#e8f7ee;color:#2a9d3f}.store-detail,.matrix-panel,.transfer-panel{margin:0 20px 16px;border:1px solid #edf0f5;border-radius:8px;overflow:hidden}.inventory-hq .panel-head{padding:13px 15px;background:#fafbfc;display:flex;justify-content:space-between;align-items:center}.inventory-hq .panel-head h3{margin:0;font-size:14px}.inventory-hq table{width:100%;border-collapse:collapse;min-width:720px}.inventory-hq th,.inventory-hq td{padding:10px 12px;text-align:left;border-bottom:1px solid #f0f1f3;font-size:13px}.inventory-hq th{background:#fafbfc;color:#8f959e;font-size:12px;font-weight:500}.inventory-hq .table-wrap{overflow:auto}.matrix-tools{padding:12px 15px}.matrix-tools select{padding:6px 8px;border:1px solid #dcdfe5;border-radius:5px;background:#fff}.inventory-hq .muted{padding:16px;color:#8f959e;font-size:13px}.inventory-hq .amount-danger{color:#d72a2a;font-weight:600}.inventory-hq .amount-warning{color:#b87300;font-weight:600}.transfer-btn{white-space:nowrap}@media(max-width:760px){.risk-grid{grid-template-columns:1fr}.risk-kpis{flex-wrap:wrap}.store-detail,.matrix-panel,.transfer-panel{margin:0 12px 14px}}';
  document.head.appendChild(css);

  const getMaterials = () => {
    const map = new Map(); (data.storeViews || []).forEach((v) => (v.ledger || []).forEach((r) => map.set(materialKey(r), { material_name: r.material_name, unit: r.unit })));
    return [...map.values()].sort((a, b) => a.material_name.localeCompare(b.material_name, 'zh-CN'));
  };
  const findRow = (view, material) => (view.ledger || []).find((r) => materialKey(r) === materialKey(material));
  function recommendations(material, views) {
    if (!material) return []; const pairs = views.map((view) => ({ view, row: findRow(view, material) })).filter((x) => x.row);
    const donors = pairs.map((x) => ({ store: x.view.store_code, available: Math.max(0, Number(x.row.theoretical_closing_qty || 0) - Number(x.row.safety_qty || 0)) })).filter((x) => x.available > 0);
    const targets = pairs.map((x) => ({ store: x.view.store_code, need: Math.max(0, Number(x.row.safety_qty || 0) - Number(x.row.theoretical_closing_qty || 0)) })).filter((x) => x.need > 0);
    const result = []; targets.forEach((to) => { const from = donors.find((x) => x.store !== to.store && x.available > 0); if (!from) return; const qty = Math.min(from.available, to.need); result.push({ from, to, qty }); from.available -= qty; }); return result;
  }
  function render() {
    const views = data.storeViews || [], summary = data.hqSummary || {}, outlet = document.querySelector('#inventory-hq-content');
    document.querySelector('#inventory-hq-summary').textContent = views.length ? `${summary.store_count || views.length} 家门店 · ${summary.active_material_anomalies || 0} 条库存研判` : '等待飞书销售数据';
    if (!views.length) { outlet.innerHTML = '<div class="muted">同步到至少一家门店的销售与 BOM 数据后，将生成风险总览和物料矩阵。</div>'; return; }
    if (!views.some((v) => v.store_code === chosenStore)) chosenStore = views[0].store_code;
    const materials = getMaterials(); if (!materials.some((m) => materialKey(m) === chosenMaterial)) chosenMaterial = materialKey(materials[0] || {});
    const selected = views.find((v) => v.store_code === chosenStore), material = materials.find((m) => materialKey(m) === chosenMaterial);
    const cards = views.map((v) => { const rows = v.ledger || [], alerts = rows.filter((r) => risk(r)[1] !== 'good'), negatives = rows.filter((r) => r.theoretical_closing_qty < 0), worst = negatives.length ? ['存在负库存', 'danger'] : alerts.length ? ['库存预警', 'warning'] : ['库存正常', 'good']; return `<button class="risk-card ${v.store_code === chosenStore ? 'active' : ''}" data-store="${esc(v.store_code)}"><b>${esc(v.store_code)}</b><span class="risk-badge ${worst[1]}">${worst[0]}</span><small>${esc(v.business_date)} · 销售 ${fmt(v.sales_qty)} 杯</small><div class="risk-kpis"><span>物料 <strong>${rows.length}</strong></span><span>风险 <strong>${alerts.length}</strong></span><span>负库存 <strong>${negatives.length}</strong></span></div></button>`; }).join('');
    const detailRows = selected.ledger.map((r) => { const [name, level] = risk(r); return `<tr><td><b>${esc(r.material_name)}</b><br><small>${esc(r.unit)}</small></td><td>${fmt(r.opening_qty)} ${esc(r.unit)}</td><td>− ${fmt(r.bom_consumption_qty)} ${esc(r.unit)}</td><td class="amount-${level}">${fmt(r.theoretical_closing_qty)} ${esc(r.unit)}</td><td>${r.safety_qty == null ? '—' : `${fmt(r.safety_qty)} ${esc(r.unit)}`}</td><td><span class="risk-badge ${level}" style="position:static">${name}</span></td><td><a class="source" href="/ledger/">查看台账</a></td></tr>`; }).join('');
    const matrixHeads = views.map((v) => `<th>${esc(v.store_code)}</th>`).join('');
    const matrixCells = views.map((v) => { const r = findRow(v, material); if (!r) return '<td>未建账</td>'; const [name, level] = risk(r); return `<td class="amount-${level}">${fmt(r.theoretical_closing_qty)} ${esc(r.unit)}<br><small>${name}</small></td>`; }).join('');
    const options = materials.map((m) => `<option value="${esc(materialKey(m))}" ${materialKey(m) === chosenMaterial ? 'selected' : ''}>${esc(m.material_name)}（${esc(m.unit)}）</option>`).join('');
    const recs = recommendations(material, views);
    const transferRows = recs.map((r) => { const payload = encodeURIComponent(JSON.stringify({ from_store_code: r.from.store, to_store_code: r.to.store, material_name: material.material_name, unit: material.unit, qty: r.qty })); return `<tr><td>${esc(material.material_name)} ${esc(material.unit)}</td><td>${esc(r.from.store)} · ${fmt(r.from.available + r.qty)} ${esc(material.unit)}</td><td>${esc(r.to.store)} · ${fmt(r.to.need)} ${esc(material.unit)}</td><td><b>${fmt(r.qty)} ${esc(material.unit)}</b></td><td><button class="btn btn-primary transfer-btn" data-transfer="${payload}">执行模拟调拨</button></td></tr>`; }).join('');
    const transfer = recs.length ? `<div class="table-wrap"><table><thead><tr><th>物料</th><th>调出门店 / 可调余量</th><th>调入门店 / 缺口</th><th>建议数量</th><th>操作</th></tr></thead><tbody>${transferRows}</tbody></table></div>` : `<div class="muted">${views.length < 2 ? '当前只有 1 家门店；新增其他门店销售并完成首日盘点后，会自动计算跨店调拨推荐。' : '当前所选物料没有同时满足“缺货门店”和“有安全余量门店”的组合。'}</div>`;
    outlet.innerHTML = `<div class="risk-grid">${cards}</div><div class="store-detail"><div class="panel-head"><h3>${esc(chosenStore)} · 门店库存详情</h3><span>${esc(selected.business_date)} · 独立回算</span></div><div class="table-wrap"><table><thead><tr><th>物料</th><th>有效期初</th><th>BOM 消耗</th><th>理论期末</th><th>安全库存</th><th>风险</th><th></th></tr></thead><tbody>${detailRows}</tbody></table></div></div><div class="matrix-panel"><div class="panel-head"><h3>物料跨门店库存矩阵</h3><span>库存不跨店抵消</span></div><div class="matrix-tools">物料　<select id="matrix-material">${options}</select></div><div class="table-wrap"><table><thead><tr><th>物料</th>${matrixHeads}</tr></thead><tbody><tr><td><b>${esc(material.material_name)}</b><br><small>${esc(material.unit)}</small></td>${matrixCells}</tr></tbody></table></div></div><div class="transfer-panel"><div class="panel-head"><h3>调拨推荐</h3><span>调出后仍须不低于安全库存</span></div>${transfer}</div>`;
    outlet.querySelectorAll('[data-store]').forEach((b) => b.onclick = () => { chosenStore = b.dataset.store; render(); });
    outlet.querySelector('#matrix-material').onchange = (e) => { chosenMaterial = e.target.value; render(); };
    outlet.querySelectorAll('[data-transfer]').forEach((b) => b.onclick = () => transfer(JSON.parse(decodeURIComponent(b.dataset.transfer)), b));
  }
  async function transfer(payload, button) {
    if (!confirm(`确认模拟调拨 ${payload.material_name} ${payload.qty}${payload.unit}：${payload.from_store_code} → ${payload.to_store_code}？`)) return;
    button.disabled = true; button.textContent = '回算中…';
    try { const r = await fetch('/api/material-transfers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }), result = await r.json(); if (!r.ok) throw Error(result.error || '调拨失败'); await load(); }
    catch (error) { alert(error.message); button.disabled = false; button.textContent = '执行模拟调拨'; }
  }
  async function load() { try { data = await (await fetch('/api/feishu-sync/state', { cache: 'no-store' })).json(); render(); } catch (error) { document.querySelector('#inventory-hq-summary').textContent = '库存数据读取失败'; document.querySelector('#inventory-hq-content').innerHTML = `<div class="muted">${esc(error.message)}</div>`; } }
  load();
})();
