/*! app/main.js | 页面级初始化：域名替换/二维码/文章复制/PWA/访问追踪/CK链接弹层 | 依赖: jQuery, lscache, ClipboardJS */
$(function(){var fujia=$(".art-fujia-content").html();if(fujia){var catename=$(".pc-nav").data("catename");fujia=fujia.replace(new RegExp(/<span class="author">(.*?)(<span|<\/span>)/,"g"),'<span class="author"><a href="/record/'+catename+'/$1.html">$1</a>$2');fujia=fujia.replace(new RegExp(/<span class="dianpingming">(.*?)(<span|<\/span>)/,"g"),'<span class="dianpingming"><a href="/record/'+catename+'/$1.html">$1</a>$2');fujia=fujia.replace(new RegExp(/<span class="huifuming">(.*?)(<span|<\/span>)/,"g"),'<span class="huifuming"><a href="/record/'+catename+'/$1.html">$1</a>$2');$(".art-fujia-content").html(fujia)}$(".article-content img").each(function(){if($(this).attr("src").toLowerCase().endsWith(".svg")){return}$(this).attr("data-fancybox","article-img")});$(".art-fujia-content img").each(function(){$(this).attr("data-fancybox","pinglun-img")})});
$(function () {
    var currentProtocol = window.location.protocol;
    var currentDomain = document.domain;

    var domainsToReplace = [
        "v1.xianbao.fun",
        "v2.xianbao.fun",
        "v3.xianbao.fun",
        "v4.xianbao.fun",
        "new.ixbk.fun",
        "new.xianbao.fun",
        "new.ixbk.net",
        "news.ixbk.fun",
        "news.xianbao.fun",
        "news.ixbk.net",
        "www.xianbaoku.net"
    ];

    var domainPattern = new RegExp(
        'https?://(' + domainsToReplace.map(function (domain) {
            return domain.replace(/\./g, '\\.');
        }).join('|') + ')',
        'g'
    );
    var noProtocolPattern = new RegExp(
        '(^|\\s)(' + domainsToReplace.map(function (domain) {
            return domain.replace(/\./g, '\\.');
        }).join('|') + ')(\\s|$)',
        'g'
    );

    function replaceDomain(html) {
        html = html.replace(domainPattern, currentProtocol + '//' + currentDomain);
        html = html.replace(noProtocolPattern, '$1' + currentDomain + '$3');
        return html;
    }

    var selectors = [".article-content", ".art-fujia-content"];

    selectors.forEach(function (selector) {
        var element = $(selector);
        if (element.length > 0) {
            element.html(function (_, html) {
                return replaceDomain(html);
            });
        }
    });
    
    $('#qr-img').attr('src', 'https://qrickit.com/api/qr.php?qrsize=200&d=' + window.location.protocol +'//' + window.location.hostname + $('#qr-img').attr('src'));
});
$(function() {
    if ($(".article-content").length > 0) {
    const clipboard = new ClipboardJS('.mochu-us-copy', {
        text: function () {
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
            // 匹配 <img> 的 alt/title 内容特征（商品名+价格组合）
            rawText = rawText
                .replace(/[ \t]+/g, ' ')
                .replace(/ *\n */g, '\n')
                .replace(/\n{3,}/g, '\n\n')
                .trim();

            const result = title ? `${title}\n\n${rawText}` : rawText;
            console.log(result);
            return result;
        }
    });

    clipboard.on('success', () => layer.msg('复制成功'));
    clipboard.on('error', (e) => {
        console.error('Copy failed:', e.action, e.trigger);
        layer.msg('复制失败，请手动长按进行复制。');
    });
}
});

$(document).ready(function(){$('.art-content .copy').click(function(){var textToCopy=$(this).text();var clipboard2=new ClipboardJS('.art-content .copy',{text:function(){return textToCopy}});clipboard2.on('success',function(e){layer.msg("复制成功");e.clearSelection()});clipboard2.on('error',function(e){console.error('复制失败:',e.action);layer.msg('复制失败，请手动复制文本')})})});
// function url_qr(){$('.url-qr').remove();$('.article-content a:not(.imgreader a):not(.g-biaoti a), .art-fujia .c-neirong a:not(.dianpingming a):not(.huifuming a)').each(function(){var linkHref=$(this).attr('href');var newIcon=$('<i>',{class:'url-qr hidden-sm-md-lg iconfont icon-qr','data-fancybox':'url-qr',href:'https://qrickit.com/api/qr.php?qrsize=200&d='+encodeURIComponent(linkHref)});$(this).after(newIcon)});}
$(function () {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/zb_users/theme/xianbao_theme/script/pwa.js')
      .then((registration) => {
        console.log('Service Worker 注册成功: ', registration);
      })
      .catch((error) => {
        console.log('Service Worker 注册失败: ', error);
      });
  }
});
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
  
  // 初始化
  function initTracker() {
    if (typeof lscache === 'undefined') {
      const script = document.createElement('script');
      script.src = '/zb_users/theme/xianbao_theme/script/vendor/lscache.min.js';
      script.onload = startTracking;
      document.head.appendChild(script);
    } else {
      startTracking();
    }
  }
  
  function startTracking() {
    document.addEventListener('click', recordClick, true);
    markVisitedLinks();
  }
  
  // 自动初始化
  initTracker();
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
      '.ck-link-pop .ck-link-item i.iconfont{font-size:16px;margin-right:10px;}',
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
    var href = $a.attr('href') || '';
    var copyText = $a.attr('data-tkl') || href;
    var linkType = getLinkType(href);
    var scheme = (isAppBrowser && linkType) ? buildScheme(linkType, href) : null;

    var items = [
      { label: '打开链接', icon: 'link',
        action: function(){ window.open(href, '_blank'); } },
      { label: linkType=='taobao'?'复制淘口令':'复制链接', icon: 'fuzhi',
        action: function(){ doCopy(copyText); } }
    ];
    
    
    if (scheme) {
      items.push({ label: 'APP打开', icon: 'app',
        action: function(){ openApp(scheme, href, linkType, copyText); } });
    }
    items.push({ label: '生成二维码', icon: 'qr',
      action: function(){ showQrcode(href); } });

    $pop.empty();
    $.each(items, function(i, it){
      $('<div class="ck-link-item"></div>')
        .html('<i class="iconfont icon-' + it.icon + '"></i><span>' + it.label + '</span>')
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

  function openApp(scheme, href, linkType, copyText) {
  var start = Date.now();
  var hidden = false;
  function onHide() {
    if (document.visibilityState === 'hidden') hidden = true;
  }
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', onHide);

  try { location.href = scheme; } catch (e) {}

  setTimeout(function() {
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('pagehide', onHide);

    // 用触发时刻判断更合理
    if (!hidden && document.visibilityState !== 'hidden') {
      if (linkType === 'taobao') {
        doCopy(copyText);
        setTimeout(function() {
          layer.msg('淘宝APP唤起失败，已为你复制淘口令', { time: 3000 });
        }, 100);
      } else {
        layer.msg('京东APP唤起失败，正在跳转网页中', { time: 3000 });
        // 用 location.href 更不易被拦截；window.open 需要用户手势
        setTimeout(function() {
          location.href = href;
        }, 1000);
      }
    }
  }, 5000); // 建议 3000ms 起
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