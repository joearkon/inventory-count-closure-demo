(() => {
  const by = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#039;', '"':'&quot;' }[char]));
  const portal = document.body.dataset.portal === 'hq' ? 'hq' : 'mobile';
  let options = null;

  const roleNames = (account) => account.role_ids.map((id) => options.roles.find((role) => role.id === id)?.name || id).join(' / ');
  const targetLabel = (account) => account.store_codes.length ? account.store_codes.join('、') : '全部区域与门店';

  async function enterAs(account, button) {
    const message = by('message');
    message.textContent = '';
    document.querySelectorAll('.account').forEach((node) => { node.disabled = true; });
    button.classList.add('selected');
    const original = button.innerHTML;
    button.innerHTML = `${original}<span class="enter-state">正在进入…</span>`;
    try {
      const response = await fetch('/api/auth/demo-login', {
        method:'POST', headers:{ 'content-type':'application/json' },
        body:JSON.stringify({ account_id:account.id, portal })
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || '进入失败');
      const next = new URLSearchParams(location.search).get('next');
      location.href = next && next.startsWith('/') && !next.startsWith('//') ? next : data.home;
    } catch (error) {
      message.textContent = error.message;
      button.innerHTML = original;
      document.querySelectorAll('.account').forEach((node) => { node.disabled = false; });
    }
  }

  async function load() {
    const response = await fetch(`/api/auth/options?portal=${encodeURIComponent(portal)}`);
    const data = await response.json();
    if (!response.ok) throw Error(data.error || '人物读取失败');
    options = data;
    by('accounts').innerHTML = data.accounts.map((account) => `<button class="account" type="button" data-account-id="${esc(account.id)}"><span class="avatar">${esc(account.display_name.slice(0,1))}</span><span class="account-copy"><b>${esc(account.display_name)}</b><small>${esc(roleNames(account))} · ${esc(targetLabel(account))}</small></span><span class="enter-arrow">进入</span></button>`).join('');
    document.querySelectorAll('.account').forEach((button) => {
      const account = data.accounts.find((item) => item.id === button.dataset.accountId);
      button.onclick = () => enterAs(account, button);
    });
  }

  load().catch((error) => {
    by('accounts').textContent = '人物读取失败';
    by('message').textContent = error.message;
  });
})();
