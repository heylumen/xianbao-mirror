/**
 * 到价提醒入口（20261124 站长选型 B）——文章页「设到价提醒」弹窗
 * 约束：只做入口与提交；触发判定全在服务端（xbpush_price_watch_note），前端不参与判断。
 */
(function () {
  if (window.xbPwBound) { return; }
  window.xbPwBound = 1;

  function qs(s, r) { return (r || document).querySelector(s); }

  function close(mask) {
    if (!mask) { return; }
    mask.remove();
    document.documentElement.style.overflow = '';
  }

  function open(box) {
    var title = box.getAttribute('data-title') || '';
    var mall = box.getAttribute('data-mall') || '';
    var price = parseFloat(box.getAttribute('data-price')) || 0;
    var low = parseFloat(box.getAttribute('data-low')) || 0;
    var suggested = price > 0 ? Math.round(price * 0.9 * 10) / 10 : '';

    var mask = document.createElement('div');
    mask.className = 'xbpw-mask';
    mask.innerHTML =
      '<div class="xbpw-dlg" role="dialog" aria-modal="true" aria-label="设到价提醒">'
      + '<div class="xbpw-hd">设到价提醒<button type="button" class="xbpw-x" data-xbpw-close aria-label="关闭">×</button></div>'
      + '<div class="xbpw-bd">'
      + '<p class="xbpw-t">' + title.replace(/</g, '&lt;') + '</p>'
      + '<p class="xbpw-kv"><span>当前价 <b>¥' + price + '</b></span>'
      + (low > 0 ? '<span>90 天最低 <b>¥' + low + '</b></span>' : '')
      + (mall ? '<span>' + mall.replace(/</g, '&lt;') + '</span>' : '') + '</p>'
      + '<label class="xbpw-lb" for="xbpwTarget">目标价（元）</label>'
      + '<input class="xbpw-in" id="xbpwTarget" type="number" inputmode="decimal" min="0.01" step="0.01" value="' + suggested + '">'
      + '<p class="xbpw-hint">降到这个价或更低时通知你。<b>只有新线报出现该商品时才会判断</b>，没有新帖就不会提醒。</p>'
      + '<p class="xbpw-err" data-xbpw-err hidden></p>'
      + '</div>'
      + '<div class="xbpw-ft"><button type="button" class="xbpw-btn" data-xbpw-close>取消</button>'
      + '<button type="button" class="xbpw-btn pri" data-xbpw-save>保存</button></div>'
      + '</div>';
    document.body.appendChild(mask);
    document.documentElement.style.overflow = 'hidden';
    var inp = qs('#xbpwTarget', mask);
    if (inp) { inp.focus(); inp.select(); }

    mask.addEventListener('click', function (e) {
      if (e.target === mask || e.target.closest('[data-xbpw-close]')) { close(mask); }
      if (e.target.closest('[data-xbpw-save]')) { save(mask, box, { title: title, mall: mall, price: price }); }
    });
    mask.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { close(mask); }
    });
  }

  function save(mask, box, info) {
    var inp = qs('#xbpwTarget', mask);
    var err = qs('[data-xbpw-err]', mask);
    var btn = qs('[data-xbpw-save]', mask);
    var target = parseFloat(inp && inp.value);
    function fail(msg) { if (err) { err.textContent = msg; err.hidden = false; } }
    if (!(target > 0)) { return fail('请填写有效的目标价'); }
    if (target >= info.price) { return fail('目标价要低于当前价 ' + info.price + ' 元'); }
    if (btn) { btn.disabled = true; btn.textContent = '保存中…'; }
    var base = 'act=save&title=' + encodeURIComponent(info.title)
      + '&mall=' + encodeURIComponent(info.mall)
      + '&target=' + encodeURIComponent(target)
      + '&base=' + encodeURIComponent(info.price);
    // CSRF 实时取：主题 meta.php 里已有同款用法（/json/csrf.php）。
    // 不在页面里嵌 token —— 文章页会被游客缓存，静态 token 会过期导致提交必然 100。
    fetch('/zb_users/plugin/mochu_us/json/csrf.php', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (j) { return (j && (j.data || j.csrfToken)) || ''; })
      .catch(function () { return ''; })
      .then(function (tk) {
        return fetch('/zb_users/plugin/mochu_us/json/pricewatch_fun.php?act=save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: base + (tk ? '&csrfToken=' + encodeURIComponent(tk) : ''),
          credentials: 'same-origin'
        });
      }).then(function (r) { return r.json(); }).then(function (d) {
      if (d && d.code === 0) {
        close(mask);
        var tip = qs('.pc-watch-tip', box);
        if (tip) { tip.innerHTML = '已设提醒：降到 <b>' + target + ' 元</b> 时通知你'; }
        box.setAttribute('data-saved', '1');
      } else if (d && d.code === 100) {
        location.href = '/login.html';
      } else {
        if (btn) { btn.disabled = false; btn.textContent = '保存'; }
        fail((d && d.msg) || '保存失败，请稍后重试');
      }
    }).catch(function () {
      if (btn) { btn.disabled = false; btn.textContent = '保存'; }
      fail('网络异常，请稍后重试');
    });
  }

  document.addEventListener('click', function (e) {
    var bt = e.target.closest && e.target.closest('[data-xbpw-open]');
    if (!bt) { return; }
    var box = bt.closest('.pc-watch');
    if (box) { open(box); }
  });
})();
