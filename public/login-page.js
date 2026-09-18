(() => {
  const by = (id) => document.getElementById(id), esc = (v) => String(v ?? '').replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
  let options = null;
  const roleNames = (account) => account.role_ids.map((id) => options.roles.find((role) => role.id === id)?.name || id).join(' / ');
  function select(account) { by('email').value = account.email; document.querySelectorAll('.account').forEach((node) => node.classList.toggle('selected', node.dataset.email === account.email)); }
  async function load() {
    const response = await fetch('/api/auth/options'), data = await response.json(); options = data;
    by('accounts').innerHTML = data.accounts.map((account) => `<button class="account" type="button" data-email="${esc(account.email)}"><span class="avatar">${esc(account.display_name.slice(0,1))}</span><span><b>${esc(account.display_name)}</b><small>${esc(roleNames(account))} · ${esc(account.store_codes.length ? account.store_codes.join('、') : '全品牌')}</small></span></button>`).join('');
    document.querySelectorAll('.account').forEach((node) => node.onclick = () => select(data.accounts.find((item) => item.email === node.dataset.email)));
    const preferred = data.accounts.find((item) => item.role_ids.includes('hq_operations')) || data.accounts[0]; if (preferred) select(preferred);
  }
  by('form').onsubmit = async (event) => {
    event.preventDefault(); const button = by('submit'); button.disabled = true; by('message').textContent = '';
    try {
      const response = await fetch('/api/auth/login', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ email:by('email').value, password:by('password').value }) });
      const data = await response.json(); if (!response.ok) throw Error(data.error || '登录失败');
      const next = new URLSearchParams(location.search).get('next'); location.href = next && next.startsWith('/') && !next.startsWith('//') ? next : data.home;
    } catch (error) { by('message').textContent = error.message; button.disabled = false; }
  };
  load().catch((error) => { by('accounts').textContent = '账号读取失败'; by('message').textContent = error.message; });
})();
