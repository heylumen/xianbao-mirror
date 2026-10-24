/*! app/main.js | 页面级初始化：二维码/文章复制/PWA/访问追踪/CK链接弹层 | 依赖: jQuery, lscache, ClipboardJS | 20261005: 域名改写与抓取评论楼主链接已转服务端直出（service_ssr.php） | 20261015: 复制文案跟随 data-tkl——无口令的淘宝链接显示"复制链接" | 20261017: 打开链接/APP打开 的可操作兜底（应用内返回入口已下线） | 20261018: APP打开 iOS 分流恢复本页直跳 scheme（iframe/异步open 双试探在 iOS 全失效致唤不起） | 20261018: 复制文案升级图文双格式——text/html 保留正文图并绝对化为同源代理 URL（QQ/微信粘贴自动拉图）；ClipboardItem 富写→execCommand 富文本→textarea 三级降级；纯文本口径逐字节不变 */


$(function () {
    $('#qr-img').attr('src', 'https://qrickit.com/api/qr.php?qrsize=200&d=' + window.location.protocol +'//' + window.location.hostname + $('#qr-img').attr('src'));
});
/* 复制文案（20261018 图文双格式）：
   - text/plain：口径与旧版逐字节一致（删图、链接展开裸 URL、空白归并）
   - text/html：保留正文图，src 绝对化——正文图在展示态已被服务端收口到同源代理
     /plus/api/image.php（免 Referer、公网可拉），QQ/微信桌面版粘贴 HTML 会自动联网取图
   写入三级降级：ClipboardItem 富写 → execCommand('copy') 富文本 → textarea 纯文本。
   注意不能走 ClipboardJS：其 execCommand(纯文本) 在兜底路径里会同步覆盖刚写入的富文本。
   语法约束：es2018、无 lookbehind；ClipboardItem 用 typeof 判定（基线 Chrome66/iOS12 不一定有） */
$(function() {
    if ($(".article-content").length === 0) return;

    function xbCopyAbsUrl(u) {
        try { return new URL(u, location.href).href; } catch (e) { return u; }
    }
    function xbCopyEscapeHtml(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    // 纯文本：旧管线原样搬移（产物必须与旧版逐字节一致）
    function xbCopyBuildText() {
        const title = $("#mainbox .art-title").text().trim();
        const contentEl = document.querySelector("#mainbox .article-content");
        if (!contentEl) return title || '';

        const clone = contentEl.cloneNode(true);

        // ⭐ 第一步：立即彻底移除 img 和二维码图标（在任何文本提取之前）
        clone.querySelectorAll('img, i.url-qr').forEach(el => el.remove());

        // 第二步：链接只保留纯URL
        clone.querySelectorAll('a[href]').forEach(el => {
            const url = el.getAttribute('href');
            el.replaceWith(document.createTextNode(url));
        });

        // 第三步：<br> → 换行符
        clone.querySelectorAll('br').forEach(el => {
            el.replaceWith(document.createTextNode('\n'));
        });

        // 第四步：块级元素加换行
        clone.querySelectorAll('p, div').forEach(el => {
            el.prepend('\n');
            el.append('\n');
        });

        // 第五步：提取纯文本
        let rawText = clone.textContent || '';

        // ⭐ 第六步：保险过滤 —— 移除可能从 alt/title 泄露的图片描述文字
        rawText = rawText
            .replace(/[ \t]+/g, ' ')
            .replace(/ *\n */g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();

        const result = title ? `${title}\n\n${rawText}` : rawText;
        return result;
    }
    // HTML：保留正文图（表情小图与复制小按钮不带上），URL 全部绝对化
    function xbCopyBuildHtml() {
        const title = $("#mainbox .art-title").text().trim();
        const contentEl = document.querySelector("#mainbox .article-content");
        if (!contentEl) return { html: '', hasImg: false };
        const clone = contentEl.cloneNode(true);
        clone.querySelectorAll('script, style, img.expression, i.url-qr').forEach(el => el.remove());
        // 20261023：.copy 是正文里的口令/小程序码（如「#小程序://…」），必须保留内容，只剥外层标签
        clone.querySelectorAll('.copy').forEach(el => {
            el.replaceWith(document.createTextNode(el.textContent || ''));
        });
        clone.querySelectorAll('img[src]').forEach(el => {
            el.setAttribute('src', xbCopyAbsUrl(el.getAttribute('src')));
            el.removeAttribute('data-fancybox');
            el.removeAttribute('loading');
        });
        clone.querySelectorAll('a[href]').forEach(el => {
            el.setAttribute('href', xbCopyAbsUrl(el.getAttribute('href')));
            el.removeAttribute('data-fancybox');
        });
        let inner = '';
        try { inner = clone.innerHTML; } catch (e) { inner = ''; }
        const head = title ? '<div><strong>' + xbCopyEscapeHtml(title) + '</strong></div>' : '';
        const hasImg = clone.querySelectorAll('img').length > 0;
        return { html: head + '<div>' + inner + '</div>', hasImg: hasImg };
    }
    // ② execCommand 富文本兜底（同步、须尽量贴近点击手势；img 与页面同 URL=缓存命中，不强拉新流量）
    function xbCopyExecHtml(html, ok, fail) {
        try {
            if (document.queryCommandSupported && document.queryCommandSupported('copy')) {
                const host = document.createElement('div');
                host.setAttribute('contenteditable', 'true');
                host.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;';
                host.innerHTML = html;
                document.body.appendChild(host);
                const range = document.createRange();
                range.selectNodeContents(host);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
                let doneOk = false;
                try { doneOk = document.execCommand('copy'); } catch (e2) {}
                sel.removeAllRanges();
                document.body.removeChild(host);
                if (doneOk) { ok(); return; }
            }
        } catch (e) {}
        fail();
    }
    // ③ textarea 纯文本兜底（对齐 xbCopySilent 写法）
    function xbCopyTextOnly(text) {
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            let ok2 = false;
            try { ok2 = document.execCommand('copy'); } catch (e3) {}
            document.body.removeChild(ta);
            return !!ok2;
        } catch (e) { return false; }
    }
    function xbCopyWrite(html, text, hasImg) {
        let done = false;
        const ok = (withImg) => { if (!done) { done = true; layer.msg(withImg ? '复制成功（含图片）' : '复制成功'); } };
        const fail = () => { if (!done) { done = true; console.error('Copy failed: all tiers'); layer.msg('复制失败，请手动长按进行复制。'); } };
        const tier3 = () => { if (xbCopyTextOnly(text)) { ok(false); } else { fail(); } };
        const tier2 = () => { xbCopyExecHtml(html, () => ok(hasImg), tier3); };
        // ① ClipboardItem 富写（Chrome 76+/Safari 13.1+；reject 或异常落下一级）
        if (navigator.clipboard && window.isSecureContext && typeof ClipboardItem === 'function') {
            try {
                const item = new ClipboardItem({
                    'text/html': new Blob([html], { type: 'text/html' }),
                    'text/plain': new Blob([text], { type: 'text/plain' })
                });
                navigator.clipboard.write([item]).then(() => ok(hasImg), tier2);
                return;
            } catch (e) {}
        }
        tier2();
    }
    // 委托绑定：按钮服务端直出且无竞争处理器，ClipboardJS 绑定已移除（见上）
    $(document).on('click', '.mochu-us-copy', function () {
        const txt = xbCopyBuildText();
        const built = xbCopyBuildHtml();
        let htm = built.html;
        if (!htm) { htm = '<div>' + xbCopyEscapeHtml(txt).replace(/\n/g, '<br>') + '</div>'; }
        xbCopyWrite(htm, txt, built.hasImg);
    });
});

$(document).ready(function(){
    if ($('.art-content .copy').length === 0) return;
    // 只创建一个实例（旧版每次点击 new 一个 ClipboardJS 且不销毁，越点越多）
    var clipboard2 = new ClipboardJS('.art-content .copy', {
        text: function (trigger) { return $(trigger).text(); }
    });
    clipboard2.on('success', function(e){ layer.msg("复制成功"); e.clearSelection(); });
    clipboard2.on('error', function(e){ console.error('复制失败:', e.action); layer.msg('复制失败，请手动复制文本'); });
});
// 2026-10-09：原此处注册的 script/pwa.js（fetch 拦截 + 动态响应入库）已停用并改为自毁清退，
// Safari 全系不注册 SW（见 pwa-reg.js）；Chrome/Android 由 /pwa-sw.js 承担，避免双 SW 叠加拦截。
// 跨域名路径匹配的访问链接跟踪（无日志版）
(function() {
  // 配置项
  const config = {
    cacheKey: 'cross_domain_visited_links',
    linkSelector: '.article-list a',
    visitedClass: 'visited',
    visitedColor: '#afafaf',
    expireDays: 30,
    domainsToIgnore: [
      'xanbao.fun', 'news.xianbao.fun',
      'ixbk.fun', 'news.ixbk.fun',
      'ixbk.net', 'news.ixbk.net'
    ]
  };
  
  // 提取纯路径（忽略协议和指定域名）
  function getPurePath(url) {
    try {
      const urlObj = new URL(url);
      if (config.domainsToIgnore.some(domain => urlObj.hostname.endsWith(domain))) {
        return urlObj.pathname + urlObj.search;
      }
      return url;
    } catch {
      return url;
    }
  }
  
  // 标记已访问链接
  function markVisitedLinks() {
    const visitedPaths = lscache.get(config.cacheKey) || {};
    const currentPath = getPurePath(window.location.href);
    
    document.querySelectorAll(config.linkSelector).forEach(link => {
      const linkPath = getPurePath(link.href);
      if (visitedPaths[linkPath] || linkPath === currentPath) {
        link.classList.add(config.visitedClass);
        link.style.color = config.visitedColor;
      }
    });
  }
  
  // 记录点击的链接
  function recordClick(e) {
    let target = e.target;
    while (target && target.tagName !== 'A') {
      target = target.parentElement;
      if (!target) return;
    }
    
    if (target && target.matches(config.linkSelector)) {
      const visitedPaths = lscache.get(config.cacheKey) || {};
      const purePath = getPurePath(target.href);
      
      if (!visitedPaths[purePath]) {
        visitedPaths[purePath] = true;
        lscache.set(config.cacheKey, visitedPaths, config.expireDays);
        target.classList.add(config.visitedClass);
        target.style.color = config.visitedColor;
      }
    }
  }
  
  function startTracking() {
    document.addEventListener('click', recordClick, true);
    markVisitedLinks();
  }

  // 自动初始化（lscache 由 footer defer 链保证先于本文件加载，无需动态补载）
  startTracking();
})();
(function(){
  var $ = jQuery;

  /* ===== 自注入 CSS ===== */
  (function injectCss() {
    if (document.getElementById('ck-link-style')) return;
    var css = [
      '.ck-link-pop{position:fixed;z-index:99999;background:#fff;border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,0.15);min-width:140px;max-width:90vw;overflow:hidden;display:none;animation:ckFadeIn .15s ease-out}',
      '@keyframes ckFadeIn{from{opacity:0;transform:translateY(-4px) scale(0.98)}to{opacity:1;transform:translateY(0) scale(1)}}',
      '.ck-link-pop .ck-link-item{display:flex;align-items:center;padding:10px 15px;color:#333;font-size:14px;cursor:pointer;user-select:none;transition:background .15s;white-space:nowrap}',
      '.ck-link-pop .ck-link-item + .ck-link-item{border-top:1px solid #f0f0f0}',
      '.ck-link-pop .ck-link-item:hover,.ck-link-pop .ck-link-item:active{background:#f7f8fa}',
      '.ck-link-pop .ck-link-item svg.xb-ic{font-size:16px;margin-right:10px;flex:none;}',
      '.ck-layer.msg{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.75);color:#fff;padding:10px 20px;border-radius:8px;font-size:14px;z-index:100000;display:none}',
      '.ck-qrcode-box{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:20px;border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,0.2);text-align:center;z-index:100001;display:none}',
      '.ck-qrcode-box .ck-qrcode-tip{margin-top:10px;font-size:12px;color:#999}',
      '.ck-qrcode-box .ck-qrcode-close{position:absolute;top:6px;right:10px;cursor:pointer;font-size:20px;color:#999}'
    ].join('');
    var style = document.createElement('style');
    style.id = 'ck-link-style';
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);
  })();

  /* ===== 环境检测（移动端非 QQ/微信浏览器可拉起 APP） ===== */
  var ua = navigator.userAgent.toLowerCase();
  var isAppBrowser = /android|iphone|ipad|ipod|mobile/i.test(ua) && !/qq\//.test(ua) && !/micromessenger/.test(ua);
  /* 独立窗口（PWA / 小米「网页应用」等）：无浏览器外壳，popup 与 sched 行为都与普通浏览器不同 */
  function xbIsStandalone() {
    try {
      return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
    } catch (e) { return false; }
  }
  /* iOS 设备判定（20261018）：iOS Safari/WKWebView 拉起 App 只认"本页直跳 scheme"——
     iframe 设 src 会被静默忽略、异步 window.open 不在手势上下文必被弹窗拦截。
     且 iOS 对未安装 App 的自定义协议只静默忽略、不会像安卓容器那样把本页顶成错误页，
     所以 iOS 恢复 location.href 直跳是安全的。 */
  function xbIsIOS() {
    return /iphone|ipad|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  /* ===== 链接类型与拉起 scheme ===== */
  function getLinkType(url) {
    var u = (url || '').toLowerCase();
    if (/taobao\.com|tmall\.com|tb\.cn/.test(u)) return 'taobao';
    if (/jd\.com|jd\.cn|jdmobile/.test(u))        return 'jd';
    return null;
  }
  function buildScheme(type, url) {
    if (type === 'taobao') {
      var enc = url.replace(/^https?:\/\//i, '');
      return 'taobao://' + enc;
    }
    if (type === 'jd') {
      var params = JSON.stringify({ category: 'jump', des: 'm', url: url });
      return 'openapp.jdmobile://virtual?params=' + encodeURIComponent(params);
    }
    return null;
  }


  /* ===== 弹窗 DOM ===== */
  var $pop = $('<div class="ck-link-pop"></div>').appendTo('body');

  function closePop() { $pop.hide().empty(); }

  /* ===== 构建菜单 ===== */
  function buildMenu($a) {
    /* 20261010：转链异步改写 href/data-tkl，弹层打开时快照是转链前旧值（复现：显示"转链成功"
       但复制/打开仍是旧链），全部改为动作执行时实时读取锚点当前值 */
    var getHref = function () { return $a.attr('href') || ''; };
    var getCopyText = function () { return $a.attr('data-tkl') || getHref(); };
    var linkType = getLinkType(getHref());
    /* 20261015：文案跟随实际复制内容——只有锚点带 data-tkl（转链产出的淘口令）才是口令，
       转链失败/活动类淘宝链接无口令，仍显示"复制淘口令"会复制到普通链接（用户反馈 7215457） */
    var hasTkl = function () { return !!$a.attr('data-tkl'); };
    var copyLabel = function () { return (linkType == 'taobao' && hasTkl()) ? '复制淘口令' : '复制链接'; };
    var scheme = (isAppBrowser && linkType) ? function () { return buildScheme(linkType, getHref()); } : null;

    var items = [
      { label: '打开链接', icon: 'link',
        /* 20261017 二轮：容器里 window.open 可能既不报错也不出现（返回非 null 的假窗口），
           所以不能只看返回值 —— 开完 900ms 回查本页可见性：新标签接管了才会 hidden；仍可见
           ＝没开成，收掉假窗口并给出可操作兜底（已复制链接 + 当前窗口打开）。 */
        action: function(){
          var u = getHref();
          if (!u) { return; }
          if (xbIsStandalone()) { try { location.href = u; } catch (e) {} return; }
          var w = null;
          try { w = window.open(u, '_blank'); } catch (e) {}
          if (!w) {
            xbOpenFallback(u, u, '本窗口无法新建标签。已复制链接，也可以在当前窗口打开。');
            return;
          }
          setTimeout(function () {
            if (document.visibilityState === 'hidden') { return; }
            try { if (w && !w.closed) { w.close(); } } catch (e) {}
            xbOpenFallback(u, u, '本窗口无法新建标签。已复制链接，也可以在当前窗口打开。');
          }, 900);
        } },
      { label: copyLabel(), icon: 'copy',
        action: function(){ doCopy(getCopyText()); } }
    ];


    if (scheme) {
      items.push({ label: 'APP打开', icon: 'app',
        action: function(){ openApp(scheme(), getHref(), linkType, getCopyText(), linkType === 'taobao' && hasTkl()); } });
    }
    items.push({ label: '生成二维码', icon: 'qr',
      action: function(){ showQrcode(getHref()); } });

    $pop.empty();
    $.each(items, function(i, it){
      $('<div class="ck-link-item"></div>')
        .html('<svg class="xb-ic" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-' + it.icon + '"></use></svg><span>' + it.label + '</span>')
        .on('click', function(e){
          e.stopPropagation();
          closePop();
          it.action();
        })
        .appendTo($pop);
    });
  }

  /* ===== 定位（跟随鼠标/触摸点，而非链接矩形） ===== */
  function positionPop($a, e) {
    var popW = Math.min(220, Math.max(180, $pop.outerWidth()));
    var popH = $pop.outerHeight() || 100;
    var x = (e && typeof e.clientX === 'number') ? e.clientX : 0;
    var y = (e && typeof e.clientY === 'number') ? e.clientY : 0;
    if (!x && !y) { // 兜底：无坐标时用链接矩形
      var rect = $a[0].getBoundingClientRect();
      x = rect.left; y = rect.bottom;
    }    var left = x - 12;
    var top = y + 14;
    if (left + popW > window.innerWidth - 8) left = window.innerWidth - popW - 8;
    if (left < 8) left = 8;
    if (top + popH > window.innerHeight - 8) top = y - popH - 10;
    if (top < 8) top = Math.min(y + 14, window.innerHeight - popH - 8);
    $pop.css({ left: Math.round(left) + 'px', top: Math.round(top) + 'px' });
  }

  /* 20261017 唤起方式重做（小米「网页应用」实测报障）：原实现直接 location.href = scheme，
     容器/系统不认这个协议时浏览器会把当前文档整页顶成错误页（ERR_UNKNOWN_URL_SCHEME），
     本页被卸载 → 下面 5 秒兜底永远跑不到，用户卡死在"网页不存在"且返回失效。
     改为两条都不动本页的路子：
       ① 隐藏 iframe 试探：iOS 与多数安卓容器认，失败只留一个空白 iframe；
       ② 1.2 秒后本页仍可见 → 再开新窗口试探：失败的错误页落在新窗口里，本页完好。
     独立窗口不做 ②（那里的 window.open 已被 header 的 PWA 补丁改写成原地跳转，会把 ① 的防线绕回去）。
  ===== 20261018 iOS 分流（iOS 用户报障：升级后「APP打开」唤不起淘宝/京东 App）=====
     上述 ①② 两条试探路在 iOS 上全部失效：iOS Safari/WKWebView 从不在 iframe 里拉起 App
     （iframe 设自定义协议 src 被静默丢弃），异步 setTimeout 里的 window.open 不在手势上下文、
     必被 Safari 弹窗拦截 —— 于是 4 秒兜底必触发，「之前可以」的唤起全废。
     iOS 分流恢复 10-17 前的本页直跳：location.href = scheme（iOS 对未安装 App 的 scheme
     只静默忽略本页不动，安全）；安卓（含小米容器）仍走 iframe+新窗口试探不变。 */
  /* 容器兜底（20261017 二轮，真机探针实测后改）：小米「网页应用」这类容器自报 display-mode=browser
     —— 没有标签栏（window.open 既不报错也不出现）、不转发自定义协议、返回也不接历史。
     ⇒ 任何"跳出去"的动作都要能回退成"不离开本站"的可操作提示：先静默复制链接，再弹一个
       二选一（当前窗口打开 / 知道了），绝不再出现"点了没反应"或整页被顶掉。 */
  function xbCopySilent(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(text); return; }
    } catch (e) {}
    try {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta);
    } catch (e) {}
  }
  function xbOpenFallback(url, copyText, msg) {
    xbCopySilent(copyText || url);
    if (window.layer && layer.confirm) {
      layer.confirm(msg, { title: '打开链接', btn: ['当前窗口打开', '知道了'] },
        function (i) { layer.close(i); try { location.href = url; } catch (e) {} },
        function (i) { layer.close(i); });
    } else if (window.layer && layer.msg) { layer.msg(msg, { time: 4000 }); }
  }

  function openApp(scheme, href, linkType, copyText, isTkl) {
  /* iOS 分流（20261018）：本页直跳是 iOS 唯一可靠的唤起方式，且必须在点击手势的同步栈里。
     唤起成功本页会被切走（visibilitychange/pagehide 照常监听，兜底不会误弹）。 */
  if (xbIsIOS()) {
    var iosHidden = false;
    function iosOnHide() {
      if (document.visibilityState === 'hidden') iosHidden = true;
    }
    document.addEventListener('visibilitychange', iosOnHide);
    window.addEventListener('pagehide', iosOnHide);
    try { location.href = scheme; } catch (e) {}
    setTimeout(function () {
      document.removeEventListener('visibilitychange', iosOnHide);
      window.removeEventListener('pagehide', iosOnHide);
      if (!iosHidden && document.visibilityState !== 'hidden') {
        xbOpenFallback(href, copyText, linkType === 'taobao'
          ? (isTkl ? '未能唤起淘宝APP。已复制淘口令，也可以在当前窗口打开链接。' : '未能唤起淘宝APP。已复制链接，也可以在当前窗口打开。')
          : '未能唤起京东APP。已复制链接，也可以在当前窗口打开网页版。');
      }
    }, 4000);
    return;
  }

  var hidden = false;
  function onHide() {
    if (document.visibilityState === 'hidden') hidden = true;
  }
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', onHide);

  var ifr = document.createElement('iframe');
  ifr.setAttribute('aria-hidden', 'true');
  ifr.style.cssText = 'position:absolute;width:0;height:0;border:0;visibility:hidden';
  try { ifr.src = scheme; document.body.appendChild(ifr); } catch (e) {}
  setTimeout(function () { try { ifr.parentNode && ifr.parentNode.removeChild(ifr); } catch (e) {} }, 3000);

  if (!xbIsStandalone()) {
    setTimeout(function () {
      if (hidden || document.visibilityState === 'hidden') { return; }
      try { window.open(scheme, '_blank'); } catch (e) {}
    }, 1200);
  }

  setTimeout(function() {
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('pagehide', onHide);

    // 用触发时刻判断更合理
    if (!hidden && document.visibilityState !== 'hidden') {
      xbOpenFallback(href, copyText, linkType === 'taobao'
        ? (isTkl ? '未能唤起淘宝APP。已复制淘口令，也可以在当前窗口打开链接。' : '未能唤起淘宝APP。已复制链接，也可以在当前窗口打开。')
        : '未能唤起京东APP（本窗口可能不支持唤醒外部APP）。已复制链接，也可以在当前窗口打开网页版。');
    }
  }, 4000);
}

  /* ===== 复制（navigator.clipboard 优先，execCommand 兜底） ===== */
  function doCopy(text) {
    fallback(text);
  }
  function fallback(text) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function(){ layer.msg('已复制'); }, function(){ oldCopy(text); });
    } else {
      oldCopy(text);
    }
  }
  function oldCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch(e){}
    document.body.removeChild(ta);
    layer.msg(ok ? '已复制' : '复制失败，请长按手动复制');
  }

  /* ===== 二维码（fancybox > layer > 自建弹窗） ===== */
  function showQrcode(text) {
    var qrUrl = 'https://qrickit.com/api/qr.php?qrsize=200&d=' + encodeURIComponent(text);

    if (typeof layer !== 'undefined' && layer.open) {
      layer.open({
        type: 1,
        title: false,
        closeBtn: 1,
        shadeClose: true,
        area: ['240px', '280px'],
        content: '<div style="text-align:center;padding:20px 0"><img src="' + qrUrl + '" width="200" height="200"/><p style="margin-top:10px;color:#999;font-size:12px">扫码访问</p></div>'
      });
      return;
    }
    
  }

  /* ===== 事件绑定：捕获阶段拦截，避免父页面脚本 stopPropagation 导致 jQuery 委托失效 ===== */
  document.addEventListener('click', function(e){
    var $a = $(e.target).closest('.art-content .article-content a,.art-fujia-content .c-neirong a,.art-fujia-content .huifuneirong a');
    if (!$a.length) {
      if (!$(e.target).closest('.ck-link-pop').length) closePop();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    try { e.stopImmediatePropagation(); } catch(ex){}

    buildMenu($a);
    $pop.show();
    positionPop($a, e);
  }, true);

  // 页面一开始滚动就关闭菜单（捕获阶段，先于页面其他脚本执行）
  document.addEventListener('scroll', function(){
    if ($pop.is(':visible')) closePop();
  }, true);

  // 点击弹窗外部 / 按 Esc 关闭（菜单项内部已 stopPropagation）
  $(document).on('click', function(){ closePop(); });
  $(document).on('keydown', function(e){ if (e.keyCode === 27) closePop(); });
})();
/* 侧栏滚动跟随（方案 B2，20261005：原生 position:sticky 替换 theia）。
   theia 依赖 scroll 事件每帧重算 fixed/absolute+transform，恒滞后一帧且有
   模式切换跳变（滚动"一抖一抖"）；原生 sticky 由合成器驱动、零滚动监听。
   "下钉上追"用 top=min(顶栏+16, 视口-16-侧栏高) 表达：矮侧栏=恒吸顶；
   高侧栏 top 为负 → 向下滚底部先钉、回滚自然跟随上移。
   侧栏高度变化（关注/收藏卡异步加载、图片）由 ResizeObserver 重算；
   ≤1100px 的 CSS 已把 #sidebar 覆盖回 static，这里跳过不设 top。 */
$(function () {
  var sb = document.getElementById('sidebar');
  if (!sb) return;
  /* 顶栏 20261011 起不再吸顶，侧栏吸顶只留 16px 视口边距 */
  function xbSideStickyUpdate() {
    if (window.innerWidth <= 1100) return;
    var h = sb.getBoundingClientRect().height;
    if (!h) return;
    var top = Math.min(16, window.innerHeight - 16 - h);
    sb.style.top = top + 'px';
  }
  if ('ResizeObserver' in window) new ResizeObserver(xbSideStickyUpdate).observe(sb);
  window.addEventListener('resize', xbSideStickyUpdate, { passive: true });
  xbSideStickyUpdate();
});

/* 侧栏钉住投影（is-pinned）已于 20261004 晚移除：上下滚动不再有阴影动画 */

/* 文章页底部按钮行（20261005；二轮按个数分档）：≤768px 单行居中。
   档位由服务端直出：≤3 钮挂 xb-btfull（全称文案+14px），4~5 钮两字+12px；
   JS 负责放不下时的等比缩小（尺寸已 em 化）与档位兜底，桌面端不动 */
(function () {
  var BASE = 12, FULL = 14, FULL_FLOOR = 10.5, SHRINK_FLOOR = 8; /* BASE/FULL 与 style.css 移动端基准一致 */
  /* 换行检测（20261006 重写）：flex 填满布局下按钮宽度恒等于行宽，原 need/avail 对比
     永不收敛会无谓缩字号；改为检测按钮是否换行（top 不一致）——单行即收敛 */
  function isWrapped() {
    var btns = document.querySelectorAll('.xb-artfoot-btns .xb-qlink,.xb-artfoot-btns .mochu-us-colluser');
    if (btns.length < 2) return false;
    var top0 = btns[0].getBoundingClientRect().top;
    for (var i = 1; i < btns.length; i++) {
      if (btns[i].getBoundingClientRect().top > top0 + 2) return true;
    }
    return false;
  }
  function fitArtBtns() {
    var row = document.querySelector('.xb-artfoot-btns');
    if (!row) return;
    if (window.innerWidth > 768) { row.style.fontSize = ''; return; }
    var FULL = 14, BASE = 12, FULL_FLOOR = 10.5, SHRINK_FLOOR = 8;
    row.style.fontSize = '';
    var full = row.classList.contains('xb-btfull');
    if (!full) {
      /* 两字紧凑档：12px 起步，换行则步进缩小到单行（下限 8px） */
      var fs = BASE;
      var n = 0;
      while (isWrapped() && fs > SHRINK_FLOOR && n < 12) { fs -= 0.5; row.style.fontSize = fs + 'px'; n++; }
      return;
    }
    /* 全称放大档：14px 放不下则等比缩（下限 10.5px），仍换行退两字档 */
    var fs2 = FULL;
    var n2 = 0;
    row.style.fontSize = fs2 + 'px';
    while (isWrapped() && fs2 > FULL_FLOOR && n2 < 12) { fs2 -= 0.5; row.style.fontSize = fs2 + 'px'; n2++; }
    if (!isWrapped()) return;
    row.classList.remove('xb-btfull');
    fitArtBtns();
  }
  var fitT;
  window.addEventListener('resize', function () { clearTimeout(fitT); fitT = setTimeout(fitArtBtns, 120); }, { passive: true });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitArtBtns);
  window.addEventListener('load', fitArtBtns);
  fitArtBtns();
})();
/* 评论点赞（20261007）：事件委托，toggle 语义，游客按 IP 去重 */
(function () {
  if (document.__xbCmtLikeBound) return;
  document.__xbCmtLikeBound = 1;
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('.xb-cmtlike') : null;
    if (!el) return;
    if (el.dataset.busy) return;
    el.dataset.busy = '1';
    fetch('/plus/json/cmtlike.php', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'cmtid=' + encodeURIComponent(el.getAttribute('data-cmt') || '')
    }).then(function (r) { return r.json(); }).then(function (j) {
      delete el.dataset.busy;
      if (!j || j.code !== 0) return;
      var em = el.querySelector('em');
      if (em) em.textContent = j.count;
      el.classList.toggle('on', !!j.liked);
    }).catch(function () { delete el.dataset.busy; });
  });
})();

/* SSE 实时线报流（20261007 升级：sse_on 开启时 meta.php 不启动 worker 轮询，本连接为唯一
 * 实时通道；event:new 行入队后直接调 window.xb_consume_addhtml 渲染（消费函数由 meta.php
 * 定义，与 worker 通道共用渲染/去重/标红/绿点状态）。
 * 启动时机：main.js 与 meta.php 均为 defer 且 main.js 在前——xb_sse_on 在 meta.php 里定义，
 * 必须等 load（defer 全部执行完）再建连接，否则本 IIFE 读到 undefined 直接退出（V1 的 bug）。 */
(function () {
  function xbSseStart() {
    if (window.xb_sse_on !== 1 || !window.EventSource || window.__xbEs) return;
    try {
      var es = new EventSource('/plus/json/stream.php?cate=' + (window.xb_sse_cate || 0));
      window.__xbEs = es;
      es.addEventListener('new', function (e) {
        try {
          var rows = JSON.parse(e.data);
          if (Array.isArray(rows) && rows.length && Array.isArray(window.addhtmlarr)) {
            for (var xi = 0; xi < rows.length; xi++) {
              var xr = rows[xi];
              if (typeof window.xb_poll_guard === 'function') {
                xr = window.xb_poll_guard(xr);
                if (xr === null || xr === undefined) { continue; }
              }
              window.addhtmlarr.push(xr);
            }
          }
        } catch (_) {}
        if (typeof window.xb_consume_addhtml === 'function') { window.xb_consume_addhtml(); }
      });
      es.addEventListener('bye', function () { es.close(); window.__xbEs = null; setTimeout(xbSseStart, 1500); });
    } catch (_) {}
  }
  if (document.readyState === 'complete') { xbSseStart(); }
  else { window.addEventListener('load', xbSseStart); }
})();
