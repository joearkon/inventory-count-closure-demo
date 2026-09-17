(() => {
  const by = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[char]));
  const fmt = (value) => Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 3 });
  let state = null;
  let currentPage = 1;
  const statusLabel = (plan) => plan.status === 'pending_hq_review' ? '待总部复核' : plan.status === 'closed' ? '已完成' : plan.submitted_material_count ? '待补齐物料' : '待门店盘点';
  const policy = (item) => item.count_policy || (item.daily_count_enabled === false ? 'optional' : 'daily');

  async function api(path, options = {}) {
    const response = await fetch(path, { headers: { 'content-type': 'application/json', ...(options.headers || {}) }, ...options });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '操作失败');
    return result;
  }
  function show(message, type = '') { by('count-message').textContent = message; by('count-message').className = `message ${type}`; }
  function switchTab(name, updateHash = true) {
    const target = ['plans','materials','manual'].includes(name) ? name : 'plans';
    document.querySelectorAll('[data-count-tab]').forEach((button) => button.classList.toggle('active', button.dataset.countTab === target));
    document.querySelectorAll('[data-count-panel]').forEach((panel) => { panel.hidden = panel.dataset.countPanel !== target; });
    by('generate').hidden = target !== 'plans';
    if (updateHash) history.replaceState(null, '', `#${target}`);
  }
  function renderPlans(plans = state?.countPlans || []) {
    const rows = plans.slice().sort((left, right) => `${right.business_date}${right.created_at}`.localeCompare(`${left.business_date}${left.created_at}`));
    const page = window.ListPager.slice(rows, currentPage, 10); currentPage = page.page;
    by('rows').innerHTML = page.items.length ? page.items.map((plan) => {
      const lines = (plan.lines || []).map((line) => `<div class="line"><b>${esc(line.material_name)}</b><small>理论 ${fmt(line.theoretical_qty)} ${esc(line.unit)}</small></div>`).join('');
      const type = ({ daily_full: '每日计划', manual_material_set: '不定期盘点', work_order_material_set: '工单盘点', targeted_material: '定向盘点', targeted_material_set: '定向盘点' }[plan.plan_type] || '盘点计划');
      return `<tr><td><b>${esc(plan.plan_no || plan.id)}</b><br><small>${esc(type)}</small></td><td>${esc(plan.store_code)}</td><td>${esc(plan.business_date)}</td><td>${plan.material_count} 项<details><summary>查看物料</summary><div class="lines">${lines}</div></details></td><td><span class="tag ${plan.status === 'pending_hq_review' ? 'review' : ''}">${statusLabel(plan)}</span>${plan.instruction ? `<br><small>${esc(plan.instruction)}</small>` : ''}</td><td>${new Date(plan.created_at).toLocaleString('zh-CN', { hour12: false })}</td></tr>`;
    }).join('') : '<tr><td colspan="6" class="empty">尚未生成盘点计划。</td></tr>';
    window.ListPager.render('count-plan-pager', page, (next) => { currentPage = next; renderPlans(plans); });
  }
  function renderMaterials() {
    const materials = state?.materialCatalog || [];
    by('material-policy-rows').innerHTML = materials.map((item) => `<tr><td><b>${esc(item.material_name)}</b><br><small>${esc(item.brand || '')}</small></td><td>${esc(item.base_unit)}<br><small>采购：${esc(item.procurement_unit)} × ${fmt(item.conversion_factor || 1)}</small></td><td><select data-policy="${esc(item.material_name)}"><option value="daily" ${policy(item) === 'daily' ? 'selected' : ''}>每日盘点</option><option value="optional" ${policy(item) === 'optional' ? 'selected' : ''}>按需盘点</option></select></td><td>${esc(item.remark || '—')}</td></tr>`).join('');
    by('manual-materials').innerHTML = materials.filter((item) => item.status !== 'inactive').map((item) => `<label class="material-check"><input type="checkbox" value="${esc(item.material_name)}"><span><b>${esc(item.material_name)}</b><small>${policy(item) === 'daily' ? '每日盘点' : '按需盘点'} · ${esc(item.base_unit)}</small></span></label>`).join('');
    document.querySelectorAll('[data-policy]').forEach((select) => select.onchange = async () => {
      select.disabled = true;
      try {
        const result = await api('/api/material-catalog/count-policy', { method: 'POST', body: JSON.stringify({ material_name: select.dataset.policy, count_policy: select.value }) });
        state.materialCatalog = result.material_catalog;
        renderMaterials(); show(`${select.dataset.policy} 已设为${select.value === 'daily' ? '每日盘点' : '按需盘点'}。`, 'ok');
      } catch (error) { show(error.message, 'error'); select.disabled = false; }
    });
  }
  function renderSelectors() {
    const stores = (state?.storeMasters || []).filter((item) => item.status !== '停用');
    by('manual-store').innerHTML = stores.map((item) => `<option value="${esc(item.store_code)}">${esc(item.store_code)} · ${esc(item.store_name)}</option>`).join('');
    const defaultDate = state?.feishuImport?.latest_business_date || new Date().toISOString().slice(0, 10);
    by('manual-date').value = defaultDate;
  }
  async function load() {
    state = await api('/api/state?view=count-plans', { cache: 'no-store' }); currentPage = 1;
    renderPlans(); renderMaterials(); renderSelectors();
    const query = new URLSearchParams(location.search), workOrder = query.get('source_work_order_id') || query.get('work_order');
    if (workOrder) {
      switchTab('manual'); by('manual-source').value = 'work_order'; by('work-order-wrap').hidden = false; by('manual-work-order').value = workOrder;
      if (query.get('store') && [...by('manual-store').options].some((option) => option.value === query.get('store'))) by('manual-store').value = query.get('store');
      if (query.get('date')) by('manual-date').value = query.get('date');
      const material = query.get('material');
      if (material) document.querySelectorAll('#manual-materials input').forEach((input) => { input.checked = input.value === material; });
    }
  }
  by('generate').onclick = async () => {
    const button = by('generate'); button.disabled = true; button.textContent = '生成中…';
    try { const result = await api('/api/count-plans/generate', { method: 'POST' }); state = result; currentPage = 1; renderPlans(result.countPlans); show(result.generated_count ? `已生成 ${result.generated_count} 张每日盘点单。` : '今日每日盘点单已存在或已刷新。', 'ok'); }
    catch (error) { show(error.message, 'error'); }
    finally { button.disabled = false; button.textContent = '生成今日每日计划'; }
  };
  by('manual-source').onchange = () => by('work-order-wrap').hidden = by('manual-source').value !== 'work_order';
  document.querySelectorAll('[data-count-tab]').forEach((button) => button.onclick = () => switchTab(button.dataset.countTab));
  by('manual-form').onsubmit = async (event) => {
    event.preventDefault();
    const names = [...document.querySelectorAll('#manual-materials input:checked')].map((input) => input.value);
    if (!names.length) return show('请至少选择一个盘点物料。', 'error');
    const button = by('manual-submit'); button.disabled = true;
    try {
      const result = await api('/api/count-plans/manual', { method: 'POST', body: JSON.stringify({ store_code: by('manual-store').value, business_date: by('manual-date').value, material_names: names, source_type: by('manual-source').value, source_work_order_id: by('manual-work-order').value, instruction: by('manual-instruction').value }) });
      state.countPlans = result.countPlans; currentPage = 1; renderPlans();
      document.querySelectorAll('#manual-materials input:checked').forEach((input) => input.checked = false);
      show(`已下发 ${result.plan.plan_no}，共 ${result.plan.material_count} 项物料。`, 'ok'); switchTab('plans');
    } catch (error) { show(error.message, 'error'); }
    finally { button.disabled = false; }
  };
  switchTab(location.hash.slice(1) || (new URLSearchParams(location.search).get('work_order') ? 'manual' : 'plans'), false);
  load().catch((error) => { show(error.message, 'error'); by('rows').innerHTML = `<tr><td colspan="6" class="empty">${esc(error.message)}</td></tr>`; });
})();
