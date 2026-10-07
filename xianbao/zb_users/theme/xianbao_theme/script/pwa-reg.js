/**
 * 线报酷 PWA 注册器 + 安装提示（2026-10-07）
 * 依赖：/sw.js（站点根目录）、/manifest.json
 * 行为：https 且支持 SW 时注册；捕获 beforeinstallprompt 后展示底部安装条；
 *      用户关闭后 localStorage 记忆 7 天不再打扰；已安装（display-mode:standalone）不展示。
 */
(function () {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:') return;

  navigator.serviceWorker.register('/sw.js?v=1', { scope: '/' }).catch(function () {});

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

  var deferred = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    if (standalone() || dismissed()) return;
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
    if (standalone() || dismissed()) return;
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
