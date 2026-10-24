/**
 * 线报酷 PWA 注册器 + 安装提示（2026-10-07）
 * 依赖：/sw.js（站点根目录）、/manifest.json
 * 行为：https 且支持 SW 时注册；捕获 beforeinstallprompt 后展示底部安装条；
 *      用户关闭后 localStorage 记忆 7 天不再打扰；已安装（display-mode:standalone）不展示。
 *
 * 2026-10-08：安装提示仅移动端展示——桌面 Chrome 的 beforeinstallprompt 在地址栏
 * 已有原生安装图标，底部弹条效果不佳且遮挡内容，故桌面（含平板窄窗）不再弹；
 * Service Worker 注册与离线能力对所有端保留不变。
 *
 * 2026-10-17：**安卓全系不再引导安装**（不再显示底部安装条，且 preventDefault 拦掉浏览器
 *      原生安装提示）——真机探针实测安卓"添加到桌面"落到无标签栏的网页应用容器：
 *      window.open 不报错也不出现、自定义协议不转发、系统返回不接网页历史（详见 AGENTS.md
 *      §9 2026-10-17 三条）。SW 注册与离线能力不受影响。
 *
 * 2026-10-09：Safari 全系不再注册 SW——iOS 上所有浏览器（含 Chrome 等套壳，均走
 * WebKit 的 SW 实现）与桌面 Safari 的旧版本（15.x~16.x 早期）在页面被 SW 控制时，
 * 子资源请求会随机挂起/失败（WebKit 已知缺陷）：CSS 挂起=整页无样式、同源图片
 * （logo/头像）挂起=破图"?"、每次导航经 SW=点击卡顿。历史注册由自毁版 /sw.js
 * 负责清退；Chrome/Android（Blink）不受影响，改注册 /pwa-sw.js。
 */
(function () {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:') return;

  var ua = navigator.userAgent || '';
  var isIOS = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  var isDesktopSafari = /Safari/i.test(ua) && !/Chrome|Chromium|Edg|Edge|Firefox|FxiOS|CriOS/i.test(ua);
  if (isIOS || isDesktopSafari) return;

  navigator.serviceWorker.register('/pwa-sw.js?v=2', { scope: '/' }).catch(function () {});

  var DISMISS_KEY = 'xb_pwa_no';
  var DISMISS_DAYS = 7;

  function dismissed() {
    try {
      var t = parseInt(localStorage.getItem(DISMISS_KEY) || '0', 10);
      return t > 0 && (Date.now() - t) < DISMISS_DAYS * 86400000;
    } catch (e) { return false; }
  }
  function standalone() {
    return window.matchMedia && window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
  }
  // 移动端判定：UA 命中移动端，或触屏 + 窄视口（覆盖 UA 被改写的手机浏览器）
  function isMobile() {
    try {
      if (/Android|iPhone|iPad|iPod|Mobile|HarmonyOS|Windows Phone/i.test(navigator.userAgent)) return true;
      return (navigator.maxTouchPoints > 0) && Math.min(screen.width, screen.height) <= 820;
    } catch (e) { return false; }
  }

  var deferred = null;
  /* 20261017：**安卓全系不再引导安装**（站长拍板）。真机探针实测：安卓各型号"添加到桌面"后
     自报 display-mode=browser —— 那是无标签栏的浏览器窗口，window.open 不报错也不出现、
     自定义协议不转发给系统、系统返回手势也不接网页历史（打开链接/打开APP/返回三件事全废）。
     ⇒ 一律 preventDefault 拦掉浏览器原生安装提示（否则小米/Chrome 自己还会弹），也不再显示
     我们自己的底部安装条。iOS 侧逻辑保留（iOS 本来不触发 beforeinstallprompt，仅作兼容）。
     Service Worker 注册不受影响（静态资源缓存与离线兜底照旧）。 */
  var isAndroid = /Android|HarmonyOS/i.test(ua);
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    if (isAndroid) { return; }
    deferred = e;
    if (standalone() || dismissed() || !isMobile()) return;
    // 轻微延迟，避免打断首屏
    setTimeout(showTip, 2500);
  });

  window.addEventListener('appinstalled', function () {
    hideTip();
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (e) {}
    deferred = null;
  });

  function ensureTip() {
    var tip = document.getElementById('xb-pwa-tip');
    if (tip) return tip;
    tip = document.createElement('div');
    tip.id = 'xb-pwa-tip';
    tip.className = 'xb-pwa-tip';
    tip.setAttribute('role', 'dialog');
    tip.setAttribute('aria-label', '安装到桌面');
    tip.innerHTML =
      '<span class="xb-pwa-ic" aria-hidden="true">📲</span>' +
      '<span class="xb-pwa-tx">安装线报酷<small>添加到主屏幕，秒开直达</small></span>' +
      '<button type="button" class="xb-pwa-ok">安装</button>' +
      '<button type="button" class="xb-pwa-no" aria-label="关闭">×</button>';
    document.body.appendChild(tip);
    tip.querySelector('.xb-pwa-ok').addEventListener('click', function () {
      if (!deferred) { hideTip(); return; }
      deferred.prompt();
      deferred.userChoice.then(function () {
        deferred = null;
        hideTip();
      });
    });
    tip.querySelector('.xb-pwa-no').addEventListener('click', function () {
      hideTip();
      try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (e) {}
    });
    return tip;
  }
  function showTip() {
    if (standalone() || dismissed() || !isMobile()) return;
    var tip = ensureTip();
    // 双 rAF 确保过渡动画生效
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { tip.classList.add('on'); });
    });
  }
  function hideTip() {
    var tip = document.getElementById('xb-pwa-tip');
    if (tip) { tip.classList.remove('on'); setTimeout(function () { tip.remove(); }, 350); }
  }
})();
