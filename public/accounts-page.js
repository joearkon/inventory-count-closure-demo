(() => {
  const by = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#039;', '"':'&quot;' }[char]));
  let data = null, page = 1;
  const pageSize = 8;
  async function api(path, options = {}) {
    const response = await fetch(path, { headers: { 'Content-Type':'application/json' }, ...options });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw Error(payload.error || '操作失败');
    return payload;
  }
  const roleName = (id) => data?.roles.find((item) => item.id === id)?.name || id;
  const orgName = (id) => data?.organizations.find((item) => item.id === id)?.name || id;
  const scopeText = (account) => account.org_scope_type === 'all' ? '全部区域与门店' : account.org_scope_type === 'region' ? account.org_ids.map(orgName).join('、') : account.store_codes.join('、');
  function renderSummary() {
    by('count-all').textContent = data.accounts.length;
    by('count-active').textContent = data.accounts.filter((item) => item.status === 'active').length;
    by('count-role').textContent = data.roles.length;
    by('count-scope').textContent = new Set(data.accounts.flatMap((item) => item.org_scope_type === 'all' ? data.stores.map((store) => store.store_code) : item.store_codes)).size;
  }
  function renderCurrent() {
    const account = data.session?.account;
    by('current').innerHTML = account ? `<span class="muted">当前登录身份</span><strong>${esc(account.display_name)}</strong><span>${account.role_ids.map((id) => esc(roleName(id))).join(' / ')} · ${esc(scopeText(account))}</span>` : '暂无可用的当前身份';
  }
  function renderAccounts() {
    const result = window.ListPager.slice(data.accounts, page, pageSize); page = result.page;
    by('accounts').innerHTML = result.items.length ? result.items.map((account) => `<tr><td><div class="person">${esc(account.display_name)}${account.id === data.session?.account?.id ? ' <span class="tag active">当前登录</span>' : ''}</div><div class="muted">${esc(account.email)}</div></td><td>${esc(account.identity_label)}</td><td>${account.role_ids.map((id) => `<span class="tag">${esc(roleName(id))}</span>`).join('')}</td><td><span class="tag scope">${esc(scopeText(account))}</span></td><td><span class="tag ${account.status}">${account.status === 'active' ? '启用' : '停用'}</span></td><td><div class="row-actions"><button class="btn secondary small" data-edit="${esc(account.id)}">编辑</button></div></td></tr>`).join('') : '<tr><td colspan="6" class="empty">暂无账号</td></tr>';
    window.ListPager.render('pager', result, (next) => { page = next; renderAccounts(); });
    document.querySelectorAll('[data-edit]').forEach((button) => button.onclick = () => editAccount(button.dataset.edit));
  }
  function renderDefinitions() {
    by('role-checks').innerHTML = data.roles.map((role) => `<label class="check-option"><input type="checkbox" name="role" value="${esc(role.id)}">${esc(role.name)}</label>`).join('');
    by('org-checks').innerHTML = data.organizations.filter((item) => item.type === 'region').map((org) => `<label class="check-option"><input type="checkbox" name="org" value="${esc(org.id)}">${esc(org.name)}</label>`).join('') || '<span class="muted">暂无区域</span>';
    by('store-checks').innerHTML = data.stores.map((store) => `<label class="check-option"><input type="checkbox" name="store" value="${esc(store.store_code)}">${esc(store.store_code)} · ${esc(store.store_name)}</label>`).join('');
    by('roles').innerHTML = data.roles.map((role) => `<div class="role"><b>${esc(role.name)}<span class="tag scope">${role.level === 'store' ? '门店' : role.level === 'region' ? '区域' : '总部'}</span></b><small>${esc(role.description)}</small></div>`).join('');
  }
  function render() { renderSummary(); renderCurrent(); renderAccounts(); }
  function syncScope() {
    const scope = by('scope').value;
    by('org-field').style.display = scope === 'region' ? '' : 'none';
    by('store-field').style.display = scope === 'all' ? 'none' : '';
  }
  function resetForm() {
    by('form').reset(); by('account-id').value = ''; by('form-title').textContent = '新建账号'; by('message').textContent = ''; by('message').className = 'message'; syncScope();
  }
  function editAccount(id) {
    const account = data.accounts.find((item) => item.id === id); if (!account) return;
    by('account-id').value = account.id; by('display-name').value = account.display_name; by('email').value = account.email; by('provider').value = account.identity_provider; by('scope').value = account.org_scope_type; by('status').value = account.status;
    document.querySelectorAll('[name=role]').forEach((node) => { node.checked = account.role_ids.includes(node.value); });
    document.querySelectorAll('[name=org]').forEach((node) => { node.checked = account.org_ids.includes(node.value); });
    document.querySelectorAll('[name=store]').forEach((node) => { node.checked = account.store_codes.includes(node.value); });
    by('form-title').textContent = `编辑 · ${account.display_name}`; by('message').textContent = ''; syncScope(); window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  by('scope').onchange = syncScope; by('clear').onclick = resetForm; by('create').onclick = resetForm;
  by('form').onsubmit = async (event) => {
    event.preventDefault(); const save = by('save'); save.disabled = true; by('message').textContent = '保存中…'; by('message').className = 'message';
    const payload = { id:by('account-id').value || undefined, display_name:by('display-name').value, email:by('email').value, identity_provider:by('provider').value, status:by('status').value, org_scope_type:by('scope').value, role_ids:[...document.querySelectorAll('[name=role]:checked')].map((node) => node.value), org_ids:[...document.querySelectorAll('[name=org]:checked')].map((node) => node.value), store_codes:[...document.querySelectorAll('[name=store]:checked')].map((node) => node.value) };
    try { data = await api('/api/accounts', { method:'POST', body:JSON.stringify(payload) }); by('message').textContent = '已保存'; render(); resetForm(); }
    catch (error) { by('message').textContent = error.message; by('message').className = 'message error'; }
    finally { save.disabled = false; }
  };
  async function load() {
    try { const [config, session] = await Promise.all([api('/api/accounts/config'), api('/api/auth/session')]); data = { ...config, session }; document.querySelector('.notice').innerHTML = '<b>轻量演示鉴权已启用。</b> 登录会话、角色和门店范围由服务端校验；正式飞书 OAuth、邮箱验证码发送及生产密钥管理将在下一阶段启用。'; renderDefinitions(); render(); resetForm(); }
    catch (error) { by('accounts').innerHTML = `<tr><td colspan="6" class="empty">${esc(error.message)}</td></tr>`; by('current').textContent = '账户配置暂不可用'; }
  }
  load();
})();
