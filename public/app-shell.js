(() => {
  const path = location.pathname.replace(/\/+$/, '') || '/';
  const active = (target) => path === target ? ' active' : '';
  const style = document.createElement('style');
  style.textContent = `
    body.app-shell-ready{padding:54px 0 0 220px!important;min-height:100vh}.app-shell-top{position:fixed;z-index:1000;top:0;left:0;right:0;height:54px;display:flex;align-items:center;gap:14px;padding:0 22px;background:#fff;border-bottom:1px solid #e5e6eb;color:#1f2329}.app-shell-logo{display:flex;align-items:center;gap:9px;font-weight:700;font-size:16px}.app-shell-logo i{display:grid;place-items:center;width:28px;height:28px;border-radius:8px;background:#3370ff;color:#fff;font-style:normal;font-size:16px}.app-shell-divider{height:22px;width:1px;background:#e5e6eb}.app-shell-meta{font-size:12px;color:#646a73}.app-shell-badge{padding:4px 8px;border-radius:5px;background:#e0f5e8;color:#25783c;font-size:12px}.app-shell-side{position:fixed;z-index:900;left:0;top:54px;bottom:0;width:220px;overflow:auto;padding:18px 10px;background:#fff;border-right:1px solid #e5e6eb}.app-shell-group{margin:0 0 18px}.app-shell-group-title{padding:0 10px 7px;color:#8f959e;font-size:12px}.app-shell-link{display:flex;align-items:center;gap:9px;padding:9px 10px;margin:2px 0;border-radius:6px;color:#1f2329;text-decoration:none;font-size:14px}.app-shell-link:hover{background:#f5f8ff;color:#3370ff}.app-shell-link.active{background:#e8f0ff;color:#2468e8;font-weight:600}.app-shell-link i{width:18px;text-align:center;font-style:normal}.app-shell-ready .product-nav{display:none!important}.app-shell-ready .container,.app-shell-ready .wrap{max-width:calc(100vw - 250px)}
    @media(max-width:800px){body.app-shell-ready{padding:103px 0 0!important}.app-shell-top{padding:0 14px}.app-shell-meta{display:none}.app-shell-side{top:54px;right:0;bottom:auto;width:auto;height:49px;display:flex;align-items:center;overflow-x:auto;padding:5px 8px;border-bottom:1px solid #e5e6eb;border-right:0;white-space:nowrap}.app-shell-group{display:flex;margin:0}.app-shell-group-title{display:none}.app-shell-link{margin:0;padding:7px 9px;font-size:13px}.app-shell-link i{display:none}.app-shell-ready .container,.app-shell-ready .wrap{max-width:none}.app-shell-badge{margin-left:auto}}
  `;
  document.head.appendChild(style);
  const shell = () => {
    if (document.querySelector('.app-shell-top')) return;
    document.body.classList.add('app-shell-ready');
    const header = document.createElement('header'); header.className = 'app-shell-top';
    header.innerHTML = '<div class="app-shell-logo"><i>◈</i>小笼包门店运营</div><span class="app-shell-divider"></span><span class="app-shell-meta">库存、任务与盘点闭环</span><span class="app-shell-badge">演示环境</span>';
    const side = document.createElement('aside'); side.className = 'app-shell-side';
    side.innerHTML = `<div class="app-shell-group"><div class="app-shell-group-title">业务总览</div><a class="app-shell-link${active('/')}" href="/"><i>◈</i>运营中心</a></div><div class="app-shell-group"><div class="app-shell-group-title">库存管理</div><a class="app-shell-link${active('/ledger')}" href="/ledger/"><i>▤</i>库存台账</a><a class="app-shell-link${active('/flows')}" href="/flows/"><i>⇅</i>库存流水</a><a class="app-shell-link${active('/diagnosis')}" href="/diagnosis/"><i>◎</i>库存研判</a><a class="app-shell-link${active('/simulator')}" href="/simulator/"><i>↹</i>库存模拟器</a></div><div class="app-shell-group"><div class="app-shell-group-title">日常运营</div><a class="app-shell-link${active('/count-plans')}" href="/count-plans/"><i>□</i>盘点计划</a><a class="app-shell-link${active('/documents')}" href="/documents/"><i>▧</i>库存单据</a><a class="app-shell-link${active('/transfers')}" href="/transfers/"><i>⇄</i>调拨管理</a></div><div class="app-shell-group"><div class="app-shell-group-title">第三方外部工具</div><a class="app-shell-link${active('/sync')}" href="/sync/"><i>↗</i>飞书同步</a><a class="app-shell-link${active('/notifications')}" href="/notifications/"><i>◌</i>机器人推送</a></div>`;
    document.body.append(header, side);
  };
  const loadTransferReview = () => {
    if (path !== '/transfers' || document.querySelector('script[data-store-transfer-review]')) return;
    const script = document.createElement('script'); script.src = '/store-transfer-review.js'; script.dataset.storeTransferReview = 'true';
    document.head.appendChild(script);
  };
  if (document.body) { shell(); loadTransferReview(); }
  else document.addEventListener('DOMContentLoaded', () => { shell(); loadTransferReview(); }, { once: true });
})();
