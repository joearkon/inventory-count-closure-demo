(() => {
  if (!document.body.matches('[data-view="store"]')) return;
  const esc = (v) => String(v ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[c]));
  const fmt = (v) => Number(v || 0).toLocaleString('zh-CN', { maximumFractionDigits: 3 });
  const storeCode = new URLSearchParams(location.search).get('store') || 'STORE001';

  async function photoPreview(file) {
    if (!file?.type?.startsWith('image/')) throw Error('请上传照片文件。');
    const source = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
    const image = await new Promise((resolve, reject) => { const node = new Image(); node.onload = () => resolve(node); node.onerror = reject; node.src = source; });
    const ratio = Math.min(1, 1280 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.width * ratio)); canvas.height = Math.max(1, Math.round(image.height * ratio));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.72);
  }
  async function post(path, body) {
    const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const result = await response.json().catch(() => ({})); if (!response.ok) throw Error(result.error || '操作失败'); return result;
  }
  function reviewPanel(review, plan) {
    const upload = (title = '拍照上传盘点单', copy = '请将物料名、数量和单位拍完整；系统识别后直接生成盘点结果。') => `<label class="count-photo-picker"><input id="plan-count-photo" type="file" accept="image/*" capture="environment"><span>📷</span><b>${title}</b><small>${copy}</small></label>`;
    if (!review) return `<section class="count-stage state-pending"><div class="count-stage-head"><span class="count-stage-dot">1</span><div><b>状态：待上传盘点照片</b><small>盘点尚未开始，上传照片后才会进入识别。</small></div><em>未完成</em></div><div class="count-photo-primary">${upload()}<div class="manual-count-status" id="manual-count-status">照片会留档给总部查看；此处不需要逐项手工填写。</div></div></section>`;
    const exceptions = (review.lines || []).filter((line) => line.status !== 'recognized');
    const retry = upload('重新拍照上传', '请让物料名、数量和单位完整入镜，避免反光和倾斜。');
    if (exceptions.length) {
      const readable = review.recognized_count || 0;
      const status = readable ? `识别不完整：仅 ${readable}/${plan.material_count} 项可用` : `本次未识别出可提交的盘点数据（0/${plan.material_count}）`;
      return `<section class="count-stage state-warning"><div class="count-stage-head"><span class="count-stage-dot">2</span><div><b>状态：待重新拍照</b><small>${status}。照片已收到，但本次盘点还没有完成。</small></div><em>未完成</em></div><div class="count-photo-primary">${retry}<div class="manual-count-status" id="manual-count-status">重新上传会覆盖本次识别结果；不可靠的数量不会进入库存台账。</div></div></section>`;
    }
    return `<section class="count-stage state-ready"><div class="count-stage-head"><span class="count-stage-dot">2</span><div><b>状态：识别完成，待确认提交</b><small>已可靠识别 ${plan.material_count}/${plan.material_count} 项；点击确认后才算完成门店盘点。</small></div><em>待确认</em></div><div class="count-photo-primary"><button class="btn btn-primary" id="count-photo-confirm" type="button">确认并提交盘点结果</button>${retry}<div class="manual-count-status" id="manual-count-status">提交后，照片与识别结果会一起留档给总部查看。</div></div></section>`;
  }
  async function loadPlan() {
    try {
      const state = window.loadStoreBootstrap ? await window.loadStoreBootstrap() : await (await fetch('/api/store/bootstrap?store=' + encodeURIComponent(storeCode), { cache: 'no-store' })).json();
      const plans = (state.countPlans || []).filter((item) => item.store_code === storeCode).sort((a, b) => (a.status === 'pending_store_count' ? -1 : 0) - (b.status === 'pending_store_count' ? -1 : 0) || String(b.created_at || '').localeCompare(String(a.created_at || '')));
      const plan = plans[0]; const slot = document.querySelector('#daily-count-task'); if (!slot) return;
      const completedSlot = document.querySelector('#recent-completed-list');
      if (!plan) { slot.innerHTML = ''; window.storeTaskUiRefresh?.(); return; }
      const lines = (plan.lines || []).map((line) => `<li>${esc(line.material_name)}：理论 ${fmt(line.theoretical_qty)} ${esc(line.unit)}</li>`).join('');
      const pending = plan.status === 'pending_store_count';
      const stateText = pending ? '必做' : plan.status === 'pending_hq_review' ? '待总部复核' : '已完成';
      const title = plan.plan_type === 'diagnosis_risk' ? `总部研判下发 · ${plan.material_count} 项异常物料盘点` : plan.plan_type === 'diagnosis_full' ? '总部研判下发 · 全物料盘点' : plan.plan_type === 'targeted_material' ? `总部研判下发 · ${esc(plan.target_material_name)}盘点` : plan.plan_type === 'manual_material_set' ? '总部下发 · 不定期物料盘点' : plan.plan_type === 'work_order_material_set' ? '跟进工单 · 指定物料盘点' : '总部每日物料盘点';
      const review = (state.countPhotoReviews || []).find((item) => item.plan_no === plan.plan_no);
      const card = `<div class="task-item demo-flow ${pending ? '' : 'closed-task'}"><span class="store-demo-float">${plan.plan_type?.startsWith('diagnosis') ? '研判单' : '计划单'}</span><div class="task-icon ${pending ? 'blue' : 'green'}">${pending ? '📋' : '✓'}</div><div class="task-body"><div class="task-title">${title}<span class="badge-direct">${stateText}</span></div><div class="task-code">任务编号：${esc(plan.plan_no)}${plan.parent_case_id ? ` · 关联研判：${esc(plan.parent_case_no || plan.parent_case_id)}` : ''}</div><div class="task-meta">${esc(plan.business_date)} · 盘点 ${plan.material_count} 项物料；理论库存已在下发时冻结为快照。</div><details class="task-detail"><summary>查看本次盘点物料</summary><ul style="margin:8px 0 0 18px;line-height:1.7">${lines}</ul></details>${pending ? reviewPanel(review, plan) : `<div class="task-action"><span class="closed-copy">${esc(plan.submission_note || '门店已提交，当前无需重复操作。')}</span></div>`}</div></div>`;
      slot.innerHTML = pending ? card : ''; if (!pending && completedSlot) completedSlot.innerHTML = card;
      const status = document.querySelector('#manual-count-status');
      document.querySelector('#plan-count-photo')?.addEventListener('change', async (event) => {
        const file = event.target.files?.[0]; if (!file) return;
        const label = event.currentTarget.closest('.count-photo-picker'); label?.classList.add('is-uploading');
        if (status) status.textContent = '正在上传照片并识别盘点数量…';
        try { await post('/api/count-photo-recognition', { planNo: plan.plan_no, filename: file.name, previewData: await photoPreview(file) }); window.invalidateStoreBootstrap?.(); await loadPlan(); }
        catch (error) { if (status) status.textContent = `照片识别失败：${error.message}`; label?.classList.remove('is-uploading'); }
      });
      const submitRecognizedReview = async () => {
        const button = document.querySelector('#count-photo-confirm'); const message = document.querySelector('#manual-count-status');
        if (!review || !button) return;
        const actuals = Object.fromEntries((review.lines || []).map((line) => [`${line.material_name}|${line.unit}`, Number(line.actual_qty)]));
        button.disabled = true; button.textContent = '提交中…'; if (message) message.textContent = '正在保存盘点明细并回算总部研判…';
        try {
          await post('/api/count-photo-recognition/confirm', { reviewId: review.id, actuals });
          window.invalidateStoreBootstrap?.(); await loadPlan();
        } catch (error) { if (message) message.textContent = `提交失败：${error.message}`; button.disabled = false; button.textContent = '确认并提交盘点结果'; }
      };
      document.querySelector('#count-photo-confirm')?.addEventListener('click', submitRecognizedReview);
      window.storeTaskUiRefresh?.();
    } catch (_) { /* 保留既有离线任务卡 */ }
  }
  window.storeCountPlanReload = loadPlan; loadPlan();
})();
