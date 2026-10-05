/**
 * XbFavDrawer — 悬浮工具栏「浏览历史 + 我的收藏」双 tab 抽屉（20261005 转正）
 * 前身是复刻 xbstore.js 浏览历史抽屉的预览（.xb-hdrawer 方案 D），用户确认形态后转正：
 *   - 原独立浏览历史抽屉（#xb-history）与侧栏「我的收藏」卡已删除，本抽屉是唯一入口；
 *   - 浏览历史 tab 与原抽屉同源：共用 lscache xb_history 键（记录在 xbstore.js histAdd）；
 *   - 我的收藏 tab：collect.php 分组胶囊 + 翻页 + 行管理（移动分组/删除），游客显示登录引导。
 * 入口：悬浮工具栏时钟按钮 #xb-favbtn。
 * 依赖（footer 先行加载）：lscache、jQuery、layer；须排在 xbstore.js 之后。
 * 注意：本模块先于 meta.php（defer 链末位）执行，__xb_uid 必须调用时动态读取。
 */
var XbFavDrawer = (function () {
  'use strict';
  var $ = window.jQuery;

  var HIST_KEY = 'xb_history';               // 与 xbstore.js 浏览历史共用同一存储
  var HIST_TTL_MIN = 30 * 24 * 60;

  var drawer = null, mask = null;
  var mode = 'hist';                          // hist | fav（跨开关记忆）
  var fav = { g: 'all', page: 1, pages: 1, groups: [], total: 0 };
  var clrTimer = null;
  var MGR_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-more"></use></svg>';

  function uid() { return window.__xb_uid || 0; }

  function esc(s) {
    return $('<div>').text(s == null ? '' : String(s)).html();
  }

  function lsGet(key) { try { return lscache.get(key); } catch (e) { return null; } }
  function lsSet(key, val, mins) { try { lscache.set(key, val, mins); } catch (e) {} }
  function lsDel(key) { try { lscache.remove(key); } catch (e) {} }

  function fmtTime(ts) {
    var d = new Date(ts);
    var p = function (n) { return n < 10 ? '0' + n : '' + n; };
    return p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  /* 时间徽章：走全站四级规则（list.js xb_time_badge：今天=红 HH:MM/昨天=MM-DD HH:MM/今年=MM-DD/往年=全日期）。
   * list.js 为 defer 晚于本文件求值，但抽屉行渲染发生在用户交互后，实际可用；仍加守卫兜底旧格式 */
  function timeBadge(ts) {
    if (typeof window.xb_time_badge === 'function') {
      if (ts < 1e11) { ts *= 1000; } // collect.php 的 ts 为秒级 unix，Date 需毫秒（修复收藏行 1970-01-xx）
      var d = new Date(ts);
      var p2 = function (n) { return n < 10 ? '0' + n : '' + n; };
      return window.xb_time_badge(d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()), p2(d.getHours()) + ':' + p2(d.getMinutes()));
    }
    return '<time class="badge">' + fmtTime(ts) + '</time>';
  }

  /* ============ 浏览历史 tab（复刻 xbstore.js 行为，共用 xb_history 存储） ============ */

  function histAll() {
    var h = lsGet(HIST_KEY);
    return Array.isArray(h) ? h : [];
  }

  function histRemove(path) {
    var h = histAll().filter(function (x) { return x.p !== path; });
    lsSet(HIST_KEY, h, HIST_TTL_MIN);
  }

  function histRowsHtml(items, q) {
    var qe = q ? esc(q) : '', html = '';
    items.forEach(function (x) {
      var t = esc(x.t);
      if (qe && t.indexOf(qe) > -1) t = t.split(qe).join('<span class="xhd-hit">' + qe + '</span>');
      html += '<li class="article-list" data-path="' + esc(x.p) + '">'
        + (x.i ? '<span class="figure cg' + x.i + '"></span>' : '')
        + '<p class="title"><a href="' + esc(x.p) + '">' + t + '</a>'
        + '<span class="badge com"><svg class="xb-ic" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-comment"></use></svg>' + (Number(x.m) > 0 ? esc(x.m) : '0') + '</span>'
        + timeBadge(x.d)
        + '<button type="button" class="xb-hdel" aria-label="删除这条记录"><svg viewBox="0 0 24 24"><use href="#i-trash"></use></svg></button>'
        + '</p></li>';
    });
    return html;
  }

  function histRender() {
    if (!drawer) return;
    var q = ((drawer.querySelector('.xhd-search input') || {}).value || '').trim();
    var items = histAll();
    if (q) items = items.filter(function (x) { return String(x.t || '').indexOf(q) > -1; });
    var ul = drawer.querySelector('.xfd-histlist');
    ul.innerHTML = items.length
      ? histRowsHtml(items, q)
      : '<li class="xhd-empty">' + (q || histAll().length ? '没有匹配的记录' : '暂无浏览记录') + '</li>';
    var clr = drawer.querySelector('.xhd-clear');
    if (clr) { clearTimeout(clrTimer); clr.classList.remove('arm'); clr.textContent = '清空历史'; }
    syncCnt();
  }

  function syncCnt() {
    if (!drawer) return;
    var cnt = drawer.querySelector('.xhd-cnt');
    if (!cnt) return;
    if (mode === 'fav') {
      cnt.textContent = drawer.classList.contains('xfd-favguest') ? '' : '共 ' + fav.total + ' 条';
      return;
    }
    var rows = drawer.querySelectorAll('.xfd-histlist li.article-list').length;
    var q = ((drawer.querySelector('.xhd-search input') || {}).value || '').trim();
    cnt.textContent = q ? rows + ' / ' + histAll().length + ' 条' : rows + ' 条';
  }

  /* ============ 我的收藏 tab（collect.php：分组胶囊 + 翻页 + 行管理） ============ */

  function guestCardHtml() {
    return '<li class="xhd-empty xfd-guest"><div class="xb-empty">'
      + '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-bookmark"></use></svg>'
      + '<b>登录后可同步收藏</b><span class="sub">在文章详情页点击收藏按钮，内容多端同步不丢失</span>'
      + '<a class="xb-favlogin" href="/login.html" target="_blank" rel="nofollow">去登录</a></div></li>';
  }

  function favRowHtml(it) {
    return '<li class="article-list xb-done" data-fid="' + (it.id || 0) + '" data-gid="' + (it.gid || 0) + '">'
      + (it.cateid ? '<span class="figure cg' + (it.cateid | 0) + '"></span>' : '')
      + '<p class="title"><a href="' + esc(it.url) + '" title="' + esc(it.title) + '" target="_blank">' + esc(it.title) + '</a>'
      + '<span class="badge com"><svg class="xb-ic" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-comment"></use></svg>' + (Number(it.comm) > 0 ? esc(it.comm) : '0') + '</span>'
      + (it.ts ? timeBadge(it.ts) : '<time class="badge">' + esc(it.time) + '</time>')
      + '<button type="button" class="xb-favmgr" aria-label="管理这条收藏">' + MGR_SVG + '</button>'
      + '</p></li>';
  }

  function renderChips() {
    if (!drawer) return;
    var html = '<span class="xb-favtab' + (fav.g === 'all' ? ' active' : '') + '" data-g="all">全部</span>';
    fav.groups.forEach(function (g) {
      html += '<span class="xb-favtab' + (String(g.id) === String(fav.g) ? ' active' : '') + '" data-g="' + esc(g.id) + '">' + esc(g.name) + '</span>';
    });
    if (fav.groups.length) {
      html += '<span class="xb-favtab' + (fav.g === 'none' ? ' active' : '') + '" data-g="none">未分组</span>';
    }
    html += '<span class="xb-favtab xb-favtab-add" data-g="add" title="添加分组">＋ 添加分组</span>';
    drawer.querySelector('.xfd-chips').innerHTML = html;
  }

  function favRender(res) {
    if (!drawer) return;
    var ul = drawer.querySelector('.xfd-favwrap .xhd-list');
    if (!res || res.code !== 200) {
      // 游客 / 会话过期：登录引导，隐藏分组胶囊与底部管理
      drawer.classList.add('xfd-favguest');
      ul.innerHTML = guestCardHtml();
      var oldPager = drawer.querySelector('.xfd-favwrap .xb-favpager');
      if (oldPager) oldPager.remove();
      syncCnt();
      return;
    }
    drawer.classList.remove('xfd-favguest');
    fav.groups = res.groups || [];
    fav.total = res.total || 0;
    fav.page = res.page || 1;
    fav.pages = Math.max(1, res.pages || 1);
    var list = res.list || [];
    var html = '';
    list.forEach(function (it) { html += favRowHtml(it); });
    if (!html) {
      html = '<li class="xhd-empty">' + esc(fav.g !== 'all'
        ? '该分组还没有收藏，点行右侧"···"可移入'
        : '暂无收藏，可在文章详情页点击收藏按钮') + '</li>';
    }
    ul.innerHTML = html;
    var wrap = drawer.querySelector('.xfd-favwrap');
    var pager = wrap.querySelector('.xb-favpager');
    if (fav.pages > 1) {
      if (!pager) {
        pager = document.createElement('div');
        pager.className = 'xb-favpager';
        pager.innerHTML = '<button type="button" class="xb-favpg" data-d="-1" aria-label="上一页">‹</button>'
          + '<span class="xb-favpgn"></span>'
          + '<button type="button" class="xb-favpg" data-d="1" aria-label="下一页">›</button>';
        wrap.appendChild(pager);
      }
      pager.querySelector('.xb-favpgn').textContent = fav.page + '/' + fav.pages;
    } else if (pager) {
      pager.remove();
    }
    renderChips();
    syncCnt();
  }

  // 按组取数并渲染（tab 切换每次重拉，删/移/他处收藏后保持新鲜；游客直接本地出登录卡）
  function favGo(g, page) {
    fav.g = String(g || 'all');
    fav.page = Math.max(1, parseInt(page, 10) || 1);
    if (!drawer) return;
    if (!uid()) { favRender(null); return; }
    renderChips();
    $.get('/plus/json/collect.php', { group: fav.g, page: fav.page }, favRender, 'json');
  }

  // 行管理弹窗：移动分组 chips + 删除收藏（两步确认），复用 xb-grouppick-layer 皮肤与 xb-favpop 样式
  function openRowPop(li) {
    var fid = li.getAttribute('data-fid');
    var gid = li.getAttribute('data-gid') || '0';
    var a = li.querySelector('.title a');
    var title = a ? a.textContent : '';
    var groups = fav.groups;
    var html = '<div class="xb-favpop"><div class="xb-favpop-t">' + esc(title) + '</div>';
    html += '<div class="xb-favpop-sec">移动到分组</div><div class="xb-favpop-chips">';
    html += '<span class="xb-favpop-chip' + (gid === '0' ? ' on' : '') + '" data-gid="">未分组</span>';
    groups.forEach(function (gp) {
      html += '<span class="xb-favpop-chip' + (String(gp.id) === String(gid) ? ' on' : '') + '" data-gid="' + gp.id + '">' + esc(gp.name) + '</span>';
    });
    html += '</div><div class="xb-favpop-acts"><button type="button" class="xb-favpop-del">删除收藏</button></div></div>';
    var idx = layer.open({ type: 1, title: false, closeBtn: 0, area: ['280px', 'auto'], shadeClose: true, skin: 'xb-grouppick-layer', content: html });
    var root = document.querySelector('.xb-favpop');
    if (!root) return;
    root.querySelectorAll('.xb-favpop-chip').forEach(function (c) {
      c.addEventListener('click', function () {
        var to = c.getAttribute('data-gid') || '';
        if (String(to) === String(gid)) { layer.close(idx); return; }
        $.post('/plus/json/collect_move.php', { artid: fid, gid: to }, function (r) {
          if (r && r.code === 200) {
            var name = '未分组';
            groups.forEach(function (gp) { if (String(gp.id) === String(to)) name = gp.name; });
            layer.close(idx);
            layer.msg('已移至「' + name + '」');
            afterFavChange();
          } else {
            layer.msg((r && r.msg) || '移动失败');
          }
        }, 'json');
      });
    });
    var del = root.querySelector('.xb-favpop-del');
    if (del) {
      var armed = false;
      del.addEventListener('click', function () {
        if (!armed) { // 两步确认：先亮红，再真删
          armed = true;
          del.classList.add('armed');
          del.textContent = '确认删除？';
          return;
        }
        $.post('/plus/json/collect_del.php', { artid: fid }, function (r) {
          if (r && r.code === 200) {
            layer.close(idx);
            layer.msg('已删除');
            afterFavChange();
          } else {
            layer.msg((r && r.msg) || '删除失败');
          }
        }, 'json');
      });
    }
  }

  // 收藏变化后：抽屉当前窗格刷新（侧栏收藏卡已移除，无需同步）
  function afterFavChange() {
    favGo(fav.g, fav.page);
  }

  function addGroup() {
    layer.prompt({ title: '添加分组（20 字以内）', formType: 0, maxlength: 20 }, function (name, i) {
      name = $.trim(name || '');
      if (!name) { layer.msg('分组名称不能为空'); return; }
      $.post('/plus/json/collect_group.php', { name: name }, function (r) {
        if (r && r.code === 200) {
          layer.close(i);
          layer.msg('已添加分组「' + name + '」');
          fav.groups = r.groups || [];
          var last = fav.groups.length ? String(fav.groups[fav.groups.length - 1].id) : 'all';
          favGo(last, 1);
        } else {
          layer.msg((r && r.msg) || '创建失败');
        }
      }, 'json');
    });
  }

  /* ============ 抽屉壳（复用 .xb-hdrawer 全套外观/移动端底部滑出） ============ */

  function setMode(m) {
    mode = (m === 'fav') ? 'fav' : 'hist';
    drawer.classList.toggle('mode-fav', mode === 'fav');
    drawer.classList.toggle('mode-hist', mode === 'hist');
    drawer.querySelectorAll('.xfd-tab').forEach(function (t) {
      t.classList.toggle('on', t.getAttribute('data-t') === mode);
    });
    if (mode === 'hist') histRender();
    else favGo(fav.g, fav.page);
  }

  function close() {
    if (!drawer || !drawer.classList.contains('on')) return;
    drawer.classList.remove('on');
    mask.classList.remove('on');
    document.documentElement.classList.remove('xhd-lock');
    setTimeout(function () {
      if (drawer && !drawer.classList.contains('on')) {
        drawer.style.display = 'none';
        mask.style.display = 'none';
      }
    }, 300);
    var b = document.getElementById('xb-favbtn');
    if (b) b.focus();
  }

  function build() {
    if (drawer) return;
    mask = document.createElement('div');
    mask.className = 'xb-hmask';
    mask.style.display = 'none';
    drawer = document.createElement('aside');
    drawer.className = 'xb-hdrawer xb-fdraw mode-hist';
    drawer.style.display = 'none';
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-modal', 'true');
    drawer.setAttribute('aria-label', '浏览历史与我的收藏');
    drawer.innerHTML = '<div class="xhd-hd">'
      + '<div class="xhd-hdrow">'
      + '<div class="xfd-tabs" role="tablist">'
      + '<button type="button" class="xfd-tab on" data-t="hist" role="tab">浏览历史</button>'
      + '<button type="button" class="xfd-tab" data-t="fav" role="tab">我的收藏</button>'
      + '</div>'
      + '<span class="xhd-cnt"></span>'
      + '<button type="button" class="xhd-x" aria-label="关闭">×</button></div>'
      + '<label class="xhd-search"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-search"></use></svg>'
      + '<input type="text" placeholder="在历史记录中筛选…" maxlength="40"></label>'
      + '<div class="xfd-chips"></div>'
      + '</div>'
      + '<div class="xhd-bd">'
      + '<ul class="xhd-list xfd-histlist"></ul>'
      + '<div class="xfd-favwrap"><ul class="xhd-list"></ul></div>'
      + '</div>'
      + '<div class="xhd-ft">'
      + '<div class="xfd-fthist"><button type="button" class="xhd-clear">清空历史</button><span class="xhd-tip">仅保存在本设备浏览器</span></div>'
      + '<div class="xfd-ftfav"><span class="xhd-tip">收藏于文章页 · 多端同步</span><a class="xfd-favmore" href="/login.html#/Collectlist" target="_blank" rel="nofollow">管理收藏</a></div>'
      + '</div>';
    document.body.appendChild(mask);
    document.body.appendChild(drawer);

    mask.addEventListener('click', close);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });

    var tId = null;
    drawer.querySelector('.xhd-search input').addEventListener('input', function () {
      clearTimeout(tId);
      tId = setTimeout(histRender, 120);
    });

    // 抽屉内交互总委托：tab / 分组胶囊 / 翻页 / 行管理 / 历史删行 / 清空 / 关闭
    drawer.addEventListener('click', function (e) {
      if (!e.target || !e.target.closest) return;
      var el;
      if ((el = e.target.closest('.xfd-tab'))) { setMode(el.getAttribute('data-t')); return; }
      if ((el = e.target.closest('.xfd-chips .xb-favtab'))) {
        var g = el.getAttribute('data-g');
        if (g === 'add') addGroup(); else favGo(g, 1);
        return;
      }
      if ((el = e.target.closest('.xfd-favwrap .xb-favpg'))) {
        var to = fav.page + parseInt(el.getAttribute('data-d') || '0', 10);
        if (to >= 1 && to <= fav.pages) favGo(fav.g, to);
        return;
      }
      if ((el = e.target.closest('.xfd-favwrap .xb-favmgr'))) {
        e.preventDefault();
        e.stopPropagation();
        var li = el.closest('li.article-list');
        if (li) openRowPop(li);
        return;
      }
      if ((el = e.target.closest('.xfd-histlist .xb-hdel'))) {
        var hli = el.closest('li.article-list');
        if (hli) {
          histRemove(hli.getAttribute('data-path'));
          hli.style.transition = 'opacity .15s';
          hli.style.opacity = '.25';
          setTimeout(function () { hli.remove(); syncCnt(); }, 150);
        }
        return;
      }
      if (e.target.closest('.xhd-x')) { close(); return; }
      var clr = e.target.closest('.xhd-clear');
      if (clr) {
        if (!clr.classList.contains('arm')) {
          clr.classList.add('arm');
          clr.textContent = '确认清空？';
          clrTimer = setTimeout(function () { clr.classList.remove('arm'); clr.textContent = '清空历史'; }, 2500);
        } else {
          clearTimeout(clrTimer);
          lsDel(HIST_KEY);
          histRender();
        }
      }
    });
  }

  function open() {
    build();
    drawer.style.display = '';
    mask.style.display = '';
    void drawer.offsetWidth; // 强制回流，让 transform 过渡生效
    drawer.classList.add('on');
    mask.classList.add('on');
    document.documentElement.classList.add('xhd-lock');
    histRender();
    setMode(mode); // fav 模式每次打开重拉，保证他处收藏后新鲜
    // 桌面端聚焦搜索框；移动端弹系统键盘反而打断，不聚焦
    if (mode === 'hist' && window.matchMedia && window.matchMedia('(min-width:1101px)').matches) {
      var inp = drawer.querySelector('.xhd-search input');
      if (inp) inp.focus();
    }
  }

  /* ============ 初始化：悬浮工具栏书签按钮 ============ */

  function init() {
    var toolbar = document.getElementById('toolbar');
    if (toolbar && !document.getElementById('xb-favbtn')) {
      var btn = document.createElement('div');
      btn.id = 'xb-favbtn';
      btn.className = 'btn sb br';
      btn.setAttribute('title', '浏览历史 · 我的收藏');
      btn.setAttribute('tabindex', '0');
      btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-history"></use></svg>';
      btn.addEventListener('click', open);
      toolbar.appendChild(btn);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { open: open, setMode: setMode };
})();
