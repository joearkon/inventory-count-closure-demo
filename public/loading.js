(() => {
  const id = 'app-loading-mask';
  document.documentElement.classList.add('app-is-loading');
  const mount = () => {
    if (document.getElementById(id)) return;
    const mask = document.createElement('div');
    mask.id = id;
    mask.setAttribute('role', 'status');
    mask.setAttribute('aria-live', 'polite');
    mask.innerHTML = '<span class="app-loading-spinner" aria-hidden="true"></span><span>正在加载数据…</span>';
    const style = document.createElement('style');
    style.textContent = '#app-loading-mask{position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:13px;background:rgba(247,248,250,.94);color:#4e5969;font:14px -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;opacity:1;transition:opacity .22s ease}.app-loading-spinner{width:30px;height:30px;border:3px solid #dce8ff;border-top-color:#3370ff;border-radius:50%;animation:app-loading-spin .7s linear infinite}@keyframes app-loading-spin{to{transform:rotate(360deg)}}#app-loading-mask.app-loading-hidden{opacity:0;pointer-events:none}';
    document.head.appendChild(style);
    document.documentElement.appendChild(mask);
  };
  const dismiss = () => {
    const mask = document.getElementById(id);
    document.documentElement.classList.remove('app-is-loading');
    if (!mask) return;
    mask.classList.add('app-loading-hidden');
    window.setTimeout(() => mask.remove(), 260);
  };
  mount();
  window.addEventListener('load', () => window.setTimeout(dismiss, 120), { once: true });
  window.addEventListener('pageshow', dismiss);
  window.setTimeout(dismiss, 8000);
})();
