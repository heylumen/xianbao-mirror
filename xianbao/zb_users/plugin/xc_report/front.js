/*!
 * 内容举报弹窗 · 前台原生实现（20261122 去 layui）
 *
 * 与 script/script.js（layui 整包，后台列表页仍在用）完全独立：
 *   - 无 jQuery / 无 layui 依赖，只用原生 DOM + fetch
 *   - 只负责前台：文章页「举报」按钮 → 取表单 → 提交 → 三态反馈
 *   - 服务端契约不变：ajax.php?act=xc_report_gethtml / xc_report_pstdata / xc_report_pstemail
 *     字段名（aid/type/url/Option[]/Remarks/Contact/Code）与 layui 版逐字一致
 *
 * 对外保留同名入口 window.xc_report_reportbut(id, type)，主题模板与 is_theme/is_mochu_us
 * 注入的按钮都不需要改。
 */
(function () {
  'use strict';

  var BLOGHOST = (typeof bloghost === 'string' && bloghost) ? bloghost : '/';
  if (BLOGHOST.charAt(BLOGHOST.length - 1) !== '/') { BLOGHOST += '/'; }
  var AJAX = BLOGHOST + 'zb_users/plugin/xc_report/ajax.php';

  var state = { inst: null, busy: false };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function shellHtml(title) {
    return ''
      + '<div class="xb-rp-mask" id="xbRpMask">'
      + '<div class="xb-rp" id="xbRp" role="dialog" aria-modal="true" aria-labelledby="xbRpTitle" tabindex="-1">'
      + '<div class="xb-rp-hd">'
      + '<h3 id="xbRpTitle">' + esc(title) + '</h3>'
      + '<button type="button" class="xb-rp-x" aria-label="关闭">'
      + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'
      + '</button>'
      + '</div>'
      + '<div class="xb-rp-bd" id="xbRpBd"></div>'
      + '<div class="xb-rp-state" id="xbRpState" role="status" aria-live="polite">'
      + '<span class="xb-rp-spin" data-st="loading" aria-hidden="true"></span>'
      + '<span class="xb-rp-ic ok" data-st="done" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 12.5l5 5L20 6.5"/></svg></span>'
      + '<span class="xb-rp-ic bad" data-st="error" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 7v7M12 17.2v.1"/></svg></span>'
      + '<p id="xbRpMsg"></p>'
      + '</div>'
      + '<div class="xb-rp-ft">'
      + '<button type="button" class="xb-rp-btn" data-act="cancel">取消</button>'
      + '<button type="button" class="xb-rp-btn primary" data-act="ok">提交</button>'
      + '</div>'
      + '</div>'
      + '</div>';
  }

  /* 统一 POST：act + 其余字段，返回 JSON（失败抛错） */
  function post(data) {
    var body = new URLSearchParams();
    Object.keys(data).forEach(function (k) {
      var v = data[k];
      if (Array.isArray(v)) { v.forEach(function (x) { body.append(k + '[]', x); }); }
      else { body.append(k, v == null ? '' : v); }
    });
    return fetch(AJAX, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: body.toString()
    }).then(function (r) {
      if (!r.ok) { throw new Error('HTTP ' + r.status); }
      return r.json();
    });
  }

  /* 服务端返回的 msg 里可能带 <a>（未登录提示），只允许 a 标签白名单渲染 */
  function msgHtml(msg) {
    var s = String(msg == null ? '' : msg);
    if (s.indexOf('<') === -1) { return esc(s); }
    var div = document.createElement('div');
    div.innerHTML = s;
    var out = '';
    Array.prototype.forEach.call(div.childNodes, function (n) {
      if (n.nodeType === 3) { out += esc(n.nodeValue); return; }
      if (n.nodeType !== 1) { return; }
      if (n.tagName === 'A') {
        var href = n.getAttribute('href') || '';
        if (!/^https?:\/\//i.test(href) && href.charAt(0) !== '/') { href = '#'; }
        out += '<a class="xc_report_alerta" href="' + esc(href) + '" target="_blank" rel="noopener">' + esc(n.textContent) + '</a>';
        return;
      }
      out += esc(n.textContent);
    });
    return out;
  }

  function open(title, html) {
    /* 先收掉上一个实例，再建新的（注意：不能在本函数第一行调 close() ——
       它内部依赖已初始化的 mask/host，函数声明虽提升但 var 仍是 undefined） */
    if (state.inst && state.inst.close) { state.inst.close(); }

    var host = document.createElement('div');
    host.innerHTML = shellHtml(title);
    document.body.appendChild(host);

    var mask = host.querySelector('.xb-rp-mask');
    var panel = host.querySelector('.xb-rp');
    var bd = host.querySelector('.xb-rp-bd');
    var msgEl = host.querySelector('#xbRpMsg');
    var okBtn = host.querySelector('[data-act="ok"]');
    var cancelBtn = host.querySelector('[data-act="cancel"]');

    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    /* 不能只 append form —— 服务端在「未登录 / 今日已报过」时返回的是纯文本提示，
       没有 form。所以整段搬进去，form 自然也在其中。 */
    while (wrap.firstChild) { bd.appendChild(wrap.firstChild); }
    var form = bd.querySelector('#xc_report_form');
    /* 没有表单（未登录 / 今日已报过 / 参数错误）：底部只留「关闭」，别让用户点「提交」 */
    if (!form) {
      okBtn.style.display = 'none';
      cancelBtn.textContent = '关闭';
    }

    var prevFocus = document.activeElement;
    var removed = false;

    function unlock() {
      document.documentElement.classList.remove('xb-splock');
      document.body.style.paddingRight = '';
    }

    function close() {
      if (removed) { return; }
      removed = true;
      mask.classList.remove('on');
      unlock();
      setTimeout(function () { if (host.parentNode) { host.parentNode.removeChild(host); } }, 240);
      document.removeEventListener('keydown', onKey, true);
      state.inst = null;
      try { if (prevFocus && prevFocus.focus) { prevFocus.focus({ preventScroll: true }); } } catch (e) {}
    }

    function setState(kind, msg) {
      panel.setAttribute('data-state', kind || '');
      msgEl.innerHTML = msg ? msgHtml(msg) : '';
      if (!kind) {
        okBtn.style.display = '';
        okBtn.textContent = '提交';
        cancelBtn.style.display = '';
        cancelBtn.textContent = '取消';
        return;
      }
      if (kind === 'loading') { return; }
      if (kind === 'done') {
        okBtn.style.display = 'none';
        cancelBtn.textContent = '关闭';
      } else {
        okBtn.style.display = '';
        okBtn.textContent = '重试';
        cancelBtn.style.display = '';
        cancelBtn.textContent = '取消';
      }
    }

    function submit() {
      if (!form || state.busy) { return; }
      var picked = form.querySelectorAll('input[name="Option[]"]:checked');
      if (!picked.length) {
        setState('error', '请选择“举报类型”！');
        return;
      }
      state.busy = true;
      okBtn.disabled = true;
      cancelBtn.disabled = true;
      setState('loading', '');

      var data = { act: 'xc_report_pstdata' };
      ['aid', 'type', 'url', 'Remarks', 'Contact', 'Code'].forEach(function (k) {
        var el = form.querySelector('[name="' + k + '"]');
        if (el) { data[k] = el.value; }
      });
      data['Option'] = Array.prototype.map.call(picked, function (x) { return x.value; });

      post(data).then(function (res) {
        state.busy = false;
        okBtn.disabled = false;
        cancelBtn.disabled = false;
        if (res && res.code === 0) {
          setState('done', res.msg || '信息提交成功！');
          /* 收集到举报 ID 后通知管理员（原 layui 版同样在成功后补发，失败静默） */
          var id = form.querySelector('[name="aid"]');
          post({ act: 'xc_report_pstemail', id: id ? id.value : '' }).catch(function () {});
          /* 服务端有唯一索引/去重逻辑：今天已报过同一篇时返回 code=2 → 走 else 分支提示 */
        } else if (res && res.code === 2) {
          setState('error', res.msg || '不能重复提交反馈数据！');
        } else {
          setState('error', (res && res.msg) || '提交失败，请稍后重试！');
        }
      }).catch(function () {
        state.busy = false;
        okBtn.disabled = false;
        cancelBtn.disabled = false;
        setState('error', '网络异常，请稍后重试！');
      });
    }

    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab') { return; }
      var f = panel.querySelectorAll('button, input:not([type="hidden"]), textarea, a[href], [tabindex]:not([tabindex="-1"])');
      var vis = Array.prototype.filter.call(f, function (x) {
        return !x.disabled && x.offsetParent !== null;
      });
      if (!vis.length) { return; }
      var first = vis[0], last = vis[vis.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }

    mask.addEventListener('click', function (e) {
      if (e.target === mask) { close(); return; }
      var b = e.target.closest ? e.target.closest('button') : null;
      if (!b || !panel.contains(b)) { return; }
      if (b.classList.contains('xb-rp-x') || b.getAttribute('data-act') === 'cancel') { close(); return; }
      if (b.getAttribute('data-act') === 'ok') {
        if (panel.getAttribute('data-state') === 'error' && !state.busy) {
          /* 「重试」：错误态回到表单，让用户改完再提交 */
          setState('', '');
          return;
        }
        submit();
      }
    });

    document.addEventListener('keydown', onKey, true);
    document.documentElement.classList.add('xb-splock');
    /* 锁滚动时补回滚动条宽度，避免背景横向跳动 */
    var sbw = window.innerWidth - document.documentElement.clientWidth;
    if (sbw > 0) { document.body.style.paddingRight = sbw + 'px'; }

    /* 入场：下一帧再加 .on，保证 transition 生效 */
    requestAnimationFrame(function () { mask.classList.add('on'); });
    /* 焦点先落在容器上（不是第一个单选框）：否则一打开就像「已选中第一项」，
       键盘用户仍可 Tab 进去，Esc 也照常生效 */
    setTimeout(function () {
      try { panel.focus({ preventScroll: true }); } catch (e) {}
    }, 120);

    state.inst = { close: close, submit: submit, panel: panel, form: form };
    return state.inst;
  }

  /* 主入口：保持与 layui 版同名同签名 */
  window.xc_report_reportbut = function (id, type) {
    type = type || 'article';
    if (state.busy || state.inst) { return; }

    /* 取表单期间给按钮一点即时反馈（不引入 layer loading） */
    var busyMask = document.createElement('div');
    busyMask.className = 'xb-rp-mask on';
    busyMask.innerHTML = '<div class="xb-rp xb-rp--mini" role="status" aria-live="polite">'
      + '<div class="xb-rp-state" style="display:flex">'
      + '<span class="xb-rp-spin" aria-hidden="true"></span><p>加载中…</p></div></div>';
    document.body.appendChild(busyMask);

    post({
      act: 'xc_report_gethtml',
      id: id,
      type: type,
      url: window.location.href
    }).then(function (res) {
      if (busyMask.parentNode) { busyMask.parentNode.removeChild(busyMask); }
      if (res && res.code === 0 && res.html) {
        open(res.title || '内容举报', res.html);
      } else {
        open('提示', '<div class="xb-rp-msg">' + msgHtml((res && res.msg) || '加载失败，请稍后重试！') + '</div>');
      }
    }).catch(function () {
      if (busyMask.parentNode) { busyMask.parentNode.removeChild(busyMask); }
      open('提示', '<div class="xb-rp-msg">网络异常，举报表单加载失败，请稍后重试！</div>');
    });
  };

  /* 无表单的纯提示弹窗（取表单失败 / 未登录）也复用同一外壳：补上 .xb-rp-msg 的排版 */
  window.xb_report_alert = function (msg, title) {
    open(title || '提示', '<div class="xb-rp-msg">' + msgHtml(msg) + '</div>');
  };
})();
