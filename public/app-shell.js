(() => {
  window.ListPager = window.ListPager || {
    slice(items, page = 1, pageSize = 20) {
      const total = items.length, pages = Math.max(1, Math.ceil(total / pageSize));
      const safePage = Math.min(Math.max(1, Number(page) || 1), pages);
      return { items: items.slice((safePage - 1) * pageSize, safePage * pageSize), page: safePage, pages, total, pageSize };
    },
    render(target, result, onPage) {
      const node = typeof target === 'string' ? document.getElementById(target) : target;
      if (!node) return;
      const { page, pages, total, pageSize } = result;
      node.innerHTML = `<span>第 ${page} / ${pages} 页 · 共 ${total} 条 · 每页 ${pageSize} 条</span><div><button type="button" data-list-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>上一页</button><button type="button" data-list-page="${page + 1}" ${page >= pages ? 'disabled' : ''}>下一页</button></div>`;
      node.querySelectorAll('[data-list-page]').forEach((button) => button.onclick = () => onPage(Number(button.dataset.listPage)));
    }
  };
  const path = location.pathname.replace(/\/+$/, '') || '/';
  const prototypeShell = true;
  const active = (target) => (path === target || (target === '/work-orders' && path === '/work-order')) ? ' active' : '';
  if (!document.querySelector('link[data-hq-prototype-theme]')) {
    const theme = document.createElement('link'); theme.rel = 'stylesheet'; theme.href = '/hq-prototype.css'; theme.dataset.hqPrototypeTheme = 'true'; document.head.appendChild(theme);
  }
  const style = document.createElement('style');
  style.textContent = `
    body.app-shell-ready{padding:52px 0 0 220px!important;min-height:100vh}.app-shell-top{position:fixed;z-index:1000;top:0;left:0;right:0;height:52px;display:flex;align-items:center;gap:14px;padding:0 24px;background:#fff;border-bottom:1px solid #e2e8f0;color:#1e293b}.app-shell-logo{display:flex;align-items:center;gap:9px;font-weight:700;font-size:16px}.app-shell-logo i{display:grid;place-items:center;width:28px;height:28px;border-radius:8px;background:#3370ff;color:#fff;font-style:normal;font-size:16px}.app-shell-divider{height:22px;width:1px;background:#e5e6eb}.app-shell-meta{font-size:12px;color:#646a73}.app-shell-badge{padding:4px 8px;border-radius:5px;background:#e0f5e8;color:#25783c;font-size:12px}.app-shell-identity{margin-left:auto;padding:6px 9px;border-radius:6px;background:#f5f7fa;color:#3b3f45;text-decoration:none;font-size:12px}.app-shell-identity:hover{background:#e8f0ff;color:#2468e8}.app-shell-logout{border:0;background:transparent;color:#646a73;cursor:pointer;font-size:12px}.app-shell-side{position:fixed;z-index:900;left:0;top:52px;bottom:0;width:220px;overflow:auto;padding:18px 10px;background:#fff;border-right:1px solid #e5e6eb}.app-shell-group{margin:0 0 18px}.app-shell-group-title{padding:0 10px 7px;color:#8f959e;font-size:12px}.app-shell-link{display:flex;align-items:center;gap:9px;padding:9px 10px;margin:2px 0;border-radius:6px;color:#1f2329;text-decoration:none;font-size:14px}.app-shell-link:hover{background:#f5f8ff;color:#3370ff}.app-shell-link.active{background:#e8f0ff;color:#2468e8;font-weight:600}.app-shell-link i{width:18px;text-align:center;font-style:normal}.app-shell-ready .product-nav{display:none!important}.app-shell-ready .container,.app-shell-ready .wrap{max-width:calc(100vw - 250px)}.list-pager{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 15px;border-top:1px solid #eef0f3;background:#fff;color:#646a73;font-size:12px}.list-pager div{display:flex;gap:7px}.list-pager button{border:1px solid #dcdfe6;background:#fff;color:#2468e8;border-radius:6px;padding:5px 9px;cursor:pointer}.list-pager button:disabled{color:#b8bdc5;background:#f7f8fa;cursor:not-allowed}
    body.inventory-prototype-shell{padding-top:52px!important;background:#f1f5f9!important}.inventory-prototype-shell .app-shell-top{left:220px;height:52px;border-color:#e2e8f0}.inventory-prototype-shell .app-shell-logo,.inventory-prototype-shell .app-shell-divider,.inventory-prototype-shell .app-shell-meta,.inventory-prototype-shell .app-shell-badge{display:none}.inventory-prototype-shell .app-shell-side{top:0;padding:0 8px 18px;background:#0f2540;border:0;color:#cbd5e1}.prototype-side-brand{display:flex;align-items:center;gap:10px;height:52px;margin:0 -8px 14px;padding:0 20px;border-bottom:1px solid rgba(255,255,255,.08);color:#f1f5f9;font-weight:700}.prototype-side-brand i{display:grid;place-items:center;width:28px;height:28px;border-radius:6px;background:#e8843c;color:#fff;font-style:normal}.inventory-prototype-shell .app-shell-group-title{color:#64748b}.inventory-prototype-shell .app-shell-link{color:#94a3b8}.inventory-prototype-shell .app-shell-link:hover{background:rgba(255,255,255,.05);color:#e2e8f0}.inventory-prototype-shell .app-shell-link.active{background:rgba(232,132,60,.15);color:#fcd34d}.inventory-prototype-shell .app-shell-identity{background:#f8fafc;color:#1e293b}
    @media(max-width:800px){body.app-shell-ready{padding:101px 0 0!important}.app-shell-top{padding:0 14px}.app-shell-meta{display:none}.app-shell-side{top:52px;right:0;bottom:auto;width:auto;height:49px;display:flex;align-items:center;overflow-x:auto;padding:5px 8px;border-bottom:1px solid #e5e6eb;border-right:0;white-space:nowrap}.app-shell-group{display:flex;margin:0}.app-shell-group-title{display:none}.app-shell-link{margin:0;padding:7px 9px;font-size:13px}.app-shell-link i{display:none}.app-shell-ready .container,.app-shell-ready .wrap{max-width:none}.app-shell-badge{display:none}.app-shell-identity{margin-left:auto;max-width:128px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}}
  `;
  document.head.appendChild(style);
  const shell = () => {
    if (document.querySelector('.app-shell-top')) return;
    document.body.classList.add('app-shell-ready');
    if (prototypeShell) document.body.classList.add('inventory-prototype-shell');
    document.title = document.title.replace(/ · 库存研判$/, ' · 小笼包门店运营');
    const header = document.createElement('header'); header.className = 'app-shell-top';
    header.innerHTML = '<div class="app-shell-page-title">总部运营后台</div><span class="environment-label">演示环境</span><a class="app-shell-identity" href="/accounts/">当前身份：读取中</a><button class="app-shell-logout" type="button">退出</button>';
    const side = document.createElement('aside'); side.className = 'app-shell-side';
    side.innerHTML = `<div class="app-shell-group"><div class="app-shell-group-title">总部运营</div><a class="app-shell-link${active('/')}" href="/"><i>▦</i>运营总览</a><a class="app-shell-link${active('/work-orders')}" href="/work-orders/"><i>▣</i>跟进工单</a><a class="app-shell-link${active('/diagnosis-v3')}" href="/diagnosis-v3/"><i>△</i>异常研判</a></div><div class="app-shell-group"><div class="app-shell-group-title">日常运营</div><a class="app-shell-link${active('/count-plans')}" href="/count-plans/"><i>□</i>盘点计划</a><a class="app-shell-link${active('/purchase-orders')}" href="/purchase-orders/"><i>订</i>订货管理</a><a class="app-shell-link${active('/receipt-orders')}" href="/receipt-orders/"><i>收</i>收货管理</a><a class="app-shell-link${active('/transfers')}" href="/transfers/"><i>⇄</i>调拨管理</a><a class="app-shell-link${active('/documents')}" href="/documents/"><i>▧</i>库存单据</a></div><div class="app-shell-group"><div class="app-shell-group-title">库存数据</div><a class="app-shell-link${active('/ledger')}" href="/ledger/"><i>▤</i>库存台账</a><a class="app-shell-link${active('/flows')}" href="/flows/"><i>⇅</i>库存流水</a><a class="app-shell-link${active('/simulator')}" href="/simulator/"><i>↹</i>库存模拟器</a></div><div class="app-shell-group"><div class="app-shell-group-title">系统协同</div><a class="app-shell-link${active('/sync')}" href="/sync/"><i>↗</i>飞书同步</a><a class="app-shell-link${active('/notifications')}" href="/notifications/"><i>◌</i>机器人推送</a><a class="app-shell-link${active('/accounts')}" href="/accounts/"><i>♙</i>账户与角色</a></div>`;
    if (prototypeShell) side.insertAdjacentHTML('afterbegin', '<div class="prototype-side-brand"><i>◈</i><span>小笼包门店运营</span></div>');
    document.body.append(header, side);
    header.querySelector('.app-shell-logout').onclick = async () => { await fetch('/api/auth/logout', { method:'POST' }).catch(() => null); location.href = '/hq-login/'; };
    updateIdentity();
  };
  const updateIdentity = async () => {
    const target = document.querySelector('.app-shell-identity'); if (!target) return;
    try {
      const response = await fetch('/api/auth/session');
      if (response.status === 401) { location.href = `/hq-login/?next=${encodeURIComponent(location.pathname + location.search)}`; return; }
      if (!response.ok) throw Error('unavailable');
      const payload = await response.json();
      const account = payload.account;
      target.textContent = account ? `当前身份：${account.display_name}` : '当前身份：未设置';
      target.title = account ? `${account.display_name} · ${(account.role_ids || []).join(' / ')}` : '前往账户与角色配置';
      const roles = new Set(account?.role_ids || []), isAdmin = roles.has('hq_admin'), isHq = isAdmin || roles.has('hq_operations');
      target.href = isAdmin ? '/accounts/' : payload.home || '/';
      document.querySelectorAll('.app-shell-link[href="/accounts/"]').forEach((node) => { node.closest('.app-shell-group').style.display = isAdmin ? '' : 'none'; });
      document.querySelectorAll('.app-shell-link[href="/notifications/"],.app-shell-link[href="/sync/"]').forEach((node) => { node.style.display = isHq ? '' : 'none'; });
    } catch { target.textContent = '当前身份：演示'; }
  };
  window.addEventListener('demo-account-changed', updateIdentity);
  const loadTransferReview = () => {
    if (path !== '/transfers' || document.querySelector('script[data-store-transfer-review]')) return;
    const script = document.createElement('script'); script.src = '/store-transfer-review.js'; script.dataset.storeTransferReview = 'true';
    document.head.appendChild(script);
  };
  if (document.body) { shell(); loadTransferReview(); }
  else document.addEventListener('DOMContentLoaded', () => { shell(); loadTransferReview(); }, { once: true });
})();
