/**
 * XbStore — 前台用户功能模块（浏览历史记录 / 已读置灰 / 收藏归组弹窗 / 线报状态投票）
 * 依赖（footer 先行加载）：lscache、jQuery、layer
 * 数据归属：收藏在服务端（mochu_us_clllist，文章页收藏按钮走 mochu_us.js，
 *          成功后经 xbcolltoggle 事件桥触发"收藏到分组"弹窗）；
 *          浏览历史只负责记录（histAdd 存本机 lscache 30 天/500 条），
 *          查看入口=悬浮工具栏双 tab 抽屉（xbfavdrawer.js，20261005 起）；
 *          已读置灰与 main.js 共用 cross_domain_visited_links 键。
 * 20261005 收敛：原独立浏览历史抽屉（#xb-history）与侧栏"我的收藏"卡及其控制器
 *          （favBlock/favTab/openFavRowPop/refreshFavBlock 等）已删除。
 * 20261005 二轮：收藏改为"先问存到哪个分组再落库"——拦截收藏点击弹选组（未建过分组
 *          也弹，可顺手新建），选定后放行 mochu_us.js 原收藏逻辑，成功事件里归组。
 */
var XbStore = (function () {
  'use strict';
  var $ = window.jQuery;

  var HIST_KEY = 'xb_history';                     // 浏览历史（lscache，30 天）
  var VISITED_KEY = 'cross_domain_visited_links';  // 已读集合（与 main.js 共用）
  var HIST_MAX = 500;
  var HIST_TTL_MIN = 30 * 24 * 60;
  // 注意：本模块先于 meta.php（defer 链末位）执行，__xb_uid 必须调用时动态读取，
  // 不得在模块加载时缓存
  function uid() { return window.__xb_uid || 0; }

  function ls(key) { try { return lscache.get(key); } catch (e) { return null; } }
  function lsSet(key, val, mins) { try { lscache.set(key, val, mins); } catch (e) {} }

  function esc(s) {
    return $('<div>').text(s == null ? '' : String(s)).html();
  }

  /* ============ 收藏归组：先问存到哪个分组，再执行收藏（20261005 用户定稿顺序） ============ */
  /* 旧顺序（先落库弹"收藏成功"再补问分组）已废弃：拦截 .mochu-us-coll 点击（未登录/
     已收藏态放行插件原逻辑），先弹选组弹窗，选定后合成一次点击放行 mochu_us.js 真实
     收藏（按钮态/"收藏成功"提示都在选择之后），成功事件里把预选分组经 collect_move 落库。
     拦截未接管的路径（其他入口触发收藏成功）兜底仍必弹选组。 */

  var passNextCollect = false;   // 放行 collectFlow 里合成的收藏点击
  var pendingGid = null;         // 预选分组 id（''=未分组；null=无预选）
  var pendingName = '';
  var collectBusy = false;

  function bindCollectIntercept() {
    document.addEventListener('click', function (e) {
      if (!e.target || !e.target.closest) return;
      var btn = e.target.closest('.mochu-us-coll');
      if (!btn) return;
      if (passNextCollect) { passNextCollect = false; return; } // 合成点击放行
      var artid = parseInt(btn.getAttribute('date-acid'), 10) || 0;
      if (!artid || !uid() || btn.classList.contains('mochu-us-buttonhover')) return; // 游客/取消收藏走插件原逻辑
      e.preventDefault();
      e.stopImmediatePropagation();
      collectFlow(btn);
    }, true);
  }

  function collectFlow(btn) {
    if (collectBusy) return;
    collectBusy = true;
    var release = function () { collectBusy = false; };
    $.get('/plus/json/collect.php', { group: 'all' }, function (res) {
      var groups = (res && res.code === 200 && res.groups) ? res.groups : [];
      pickGroup(groups, '', function (gid, gname) {
        release();
        if (gid === null) return; // 点空白/其他方式关闭弹窗=取消，不收藏（20261005 用户反馈修复）
        pendingGid = gid;         // ''=未分组（点过"确定"才会到这里）
        pendingName = gname || '';
        passNextCollect = true;
        btn.click();              // 放行 mochu_us.js：真实收藏 + 按钮态 + "收藏成功"提示
      });
    }, 'json').fail(function () {
      release();
      passNextCollect = true;     // 分组清单拉取失败：退回原直接收藏行为
      btn.click();
    });
  }

  // 通用选组弹窗：确定 → cb(gid, gname)；未点确定关闭（点空白/取消）→ cb(null, null)=取消收藏流程。
  // 新建分组走"关旧层重建"（layer 定高不随内容生长）；绑定一律 scope 到本层 layero
  //（重建时旧层 DOM 尚未移除，全局 id 选择器会绑到将死的旧按钮上）。
  function pickGroup(groups, selInit, cb) {
    var sel = selInit || '';      // 仅驱动 radio 勾选态
    var reported = false, rebuilding = false;
    function listHtml() {
      var h = '<label class="xb-grouppick-it"><input type="radio" name="xbgp" value=""' + (sel === '' ? ' checked' : '') + '><span>未分组</span></label>';
      groups.forEach(function (g) {
        h += '<label class="xb-grouppick-it"><input type="radio" name="xbgp" value="' + esc(g.id) + '"' + (String(g.id) === String(sel) ? ' checked' : '') + '><span>' + esc(g.name) + '</span></label>';
      });
      // 踩坑：列表内容必须随 content 一起进 layer.open——layer 的 auto 高度按初始
      // content 计算，事后填充会被裁掉（新建分组按钮/确定行不可见）
      return h + '<button type="button" class="xb-grouppick-add" id="xbgp-add">＋ 新建分组</button>';
    }
    var idx = layer.open({
      type: 1, title: false, closeBtn: 0, area: ['300px', 'auto'], shadeClose: true,
      skin: 'xb-grouppick-layer',
      content: '<div class="xb-grouppick"><div class="xb-grouppick-hd">收藏到分组</div>'
        + '<div class="xb-grouppick-list">' + listHtml() + '</div>'
        + '<div class="xb-grouppick-ft"><a class="xb-grouppick-more" href="/login.html#/Collectlist" target="_blank" rel="nofollow">管理分组</a>'
        + '<button type="button" id="xbgp-ok" class="xb-grouppick-ok">确定</button></div></div>',
      success: function (layero) {
        layero.find('#xbgp-add').on('click', function () {
          var cur = layero.find('input[name="xbgp"]:checked').val() || '';
          layer.prompt({ title: '新建分组（20 字以内）', formType: 0, maxlength: 20 }, function (name, i) {
            name = $.trim(name || '');
            if (!name) { layer.msg('分组名称不能为空'); return; }
            $.post('/plus/json/collect_group.php', { name: name }, function (r) {
              if (r && r.code === 200) {
                layer.close(i);
                layer.msg('已创建分组「' + name + '」');
                var fresh = r.groups || [];
                var newSel = fresh.length ? String(fresh[fresh.length - 1].id) : cur;
                rebuilding = true;
                layer.close(idx);
                pickGroup(fresh, newSel, cb);
              } else {
                layer.msg((r && r.msg) || '创建失败');
              }
            }, 'json');
          });
        });
        layero.find('#xbgp-ok').on('click', function () {
          var v = layero.find('input[name="xbgp"]:checked').val() || '';
          var name = '';
          groups.forEach(function (g) { if (String(g.id) === String(v)) name = g.name; });
          reported = true;
          layer.close(idx);
          cb(v, name);
        });
      },
      end: function () {
        if (rebuilding) { rebuilding = false; return; }
        if (!reported) cb(null, null);
      }
    });
  }

  // 收藏成功桥（mochu_us.js 触发 xbcolltoggle）：有预选 → 归组；无预选（兜底路径）→ 必弹选组
  // 20261016：触发端改原生 CustomEvent + jQuery trigger 双发；这里对应双注册 + 去重——
  // 新原生派发会同时命中两条注册（jQuery 对自定义事件也走原生监听），300ms 同键去重；
  // 只剩旧 mochu_us.js（缓存）时 jQuery 分支兜底；只剩新触发时原生分支兜底。
  function bindCollToggleBridge() {
    function handle(id, on) {
      if (typeof id === 'undefined' || id === null) return;
      if (!on) return;
      var artid = parseInt(id, 10) || 0;
      if (pendingGid !== null) {
        var gid = pendingGid, gname = pendingName;
        pendingGid = null; pendingName = '';
        if (!gid) return; // 未分组：无需归组
        $.post('/plus/json/collect_move.php', { artid: artid, gid: gid }, function (r) {
          if (r && r.code === 200 && gname) layer.msg('已归入「' + gname + '」');
        }, 'json');
        return;
      }
      openGroupPicker(artid);
    }
    var lastKey = '', lastTs = 0;
    function dedup(id, on) {
      // 无效投递必须先挡在记账之前：原生派发经 jQuery 内部监听转过来时不带附加实参
      // （id=undefined），若让它覆写 lastKey，随后合法的 jQuery trigger 会被当成"另一个事件"重复处理
      if (typeof id === 'undefined' || id === null || !on) return;
      var key = String(id) + ':' + String(!!on), now = Date.now();
      if (key === lastKey && now - lastTs < 300) return;
      lastKey = key; lastTs = now;
      handle(id, on);
    }
    document.addEventListener('xbcolltoggle', function (e) {
      var d = e.detail || {};
      dedup(d.id, d.on);
    });
    if (window.jQuery) {
      window.jQuery(document).on('xbcolltoggle', function (e, id, on) { dedup(id, on); });
    }
  }

  // 兜底选组（收藏已落库后补问）：确定后直接归组
  function openGroupPicker(artid) {
    $.get('/plus/json/collect.php', { group: 'all' }, function (res) {
      var groups = (res && res.code === 200 && res.groups) ? res.groups : [];
      pickGroup(groups, '', function (gid, gname) {
        if (gid === null || gid === '') return;
        $.post('/plus/json/collect_move.php', { artid: artid, gid: gid }, function (r) {
          if (r && r.code === 200) {
            layer.msg(gname ? '已归入「' + gname + '」' : '已归组');
          } else {
            layer.msg((r && r.msg) || '移动失败');
          }
        }, 'json');
      });
    }, 'json').fail(function () { /* 拉取失败不打断收藏结果，维持未分组 */ });
  }

  /* ============ 列表行增强：已读整行置灰 ============ */

  // 主列表不做收藏星标（收藏入口=文章页按钮 + 工具栏抽屉），仅做已读整行置灰（含 IAS 追加行）
  function injectRows() {
    var rows = document.querySelectorAll('li.article-list:not(.xb-done)');
    for (var i = 0; i < rows.length; i++) {
      var li = rows[i];
      li.classList.add('xb-done');
      var a = li.querySelector('.title a[href*=".html"]');
      if (!a) continue;
      markVisitedRow(li, a);
    }
  }

  function visitedMap() {
    var v = ls(VISITED_KEY);
    return (v && typeof v === 'object') ? v : {};
  }

  function markVisitedRow(li, a) {
    var p;
    try { var u = new URL(a.href, location.href); p = u.pathname + u.search; } catch (e) { return; }
    if (visitedMap()[p]) {
      li.classList.add('visited-row');
      a.classList.add('visited');
    }
  }

  function markVisitedRows() {
    var rows = document.querySelectorAll('li.article-list:not(.xb-visit-chk)');
    for (var i = 0; i < rows.length; i++) {
      var li = rows[i];
      li.classList.add('xb-visit-chk');           // 判定过就不再重判（20261016 性能）
      if (li.classList.contains('visited-row')) continue;
      var a = li.querySelector('.title a');
      if (a) markVisitedRow(li, a);
    }
  }

  /* ============ 浏览历史记录（本机；查看入口在 xbfavdrawer.js 双 tab 抽屉） ============ */

  function histAll() {
    var h = ls(HIST_KEY);
    return Array.isArray(h) ? h : [];
  }

  function histAdd(path, title, cate, cid, comm) {
    if (!path) return;
    var h = histAll().filter(function (x) { return x.p !== path; });
    h.unshift({ p: path, t: title, d: Date.now(), c: cate || '', i: parseInt(cid, 10) || 0, m: parseInt(comm, 10) || 0 });
    if (h.length > HIST_MAX) h.length = HIST_MAX;
    lsSet(HIST_KEY, h, HIST_TTL_MIN);
  }

  function recordArticleVisit() {
    var nav = document.querySelector('.pc-nav');
    if (!nav || !nav.dataset.artid) return;
    var h1 = document.querySelector('.art-title');
    var title = (h1 && h1.textContent ? h1.textContent : document.title.split('_')[0] || document.title).trim();
    histAdd(location.pathname, title, nav.dataset.catename || '', nav.dataset.cateid || 0, nav.dataset.comm || 0);
    var v = visitedMap();
    if (!v[location.pathname]) {
      v[location.pathname] = true;
      lsSet(VISITED_KEY, v, HIST_TTL_MIN);
    }
  }

  /* ============ 初始化 ============ */

  function init() {
    // 文章页：补记浏览历史 + 已读集合（main.js 只认列表点击，此处补直开场景）
    recordArticleVisit();

    injectRows();

    // 文章页收藏按钮：先问分组再收藏（拦截）+ 成功事件桥（预选归组/兜底选组）
    bindCollectIntercept();
    bindCollToggleBridge();

    // 点击列表行即时整行置灰：main.js 只标了链接文字色，visited-row 若等
    // MutationObserver 兜底需等到下一次 DOM 变化（worker 轮询/IAS），表现为
    // "点击后过几秒才半透明"，且期间与已置灰行呈现两种效果
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('.title a[href*=".html"]') : null;
      if (!a) return;
      var li = a.closest('li.article-list');
      if (!li) return;
      li.classList.add('visited-row');
      a.classList.add('visited');
    }, true);

    // IAS 追加行 / 猜你喜欢 / 侧栏 JS 拼串行 → 动态补注入
    /* 20261016 性能：原先任何 body 子节点变化都触发全文档重扫，而页面上的「秒数倒计时」
       （.xb-monitor-tip / .shuatime 每 1s 重写一次文本节点 = childList 变化）会让这条
       扫描链永远空转（实测每 250~600ms 一次全列表扫描）。现在只放行与列表行相关的
       变化（倒计时那两处 update 直接跳过），行访问态判定也只做一次（.xb-visit-chk 标记）。 */
    if (window.MutationObserver) {
      var MO_SKIP = '.xb-monitor-tip,.shuatime';
      var moNeed = false, moTimer = null;
      var mo = new MutationObserver(function (records) {
        for (var i = 0; i < records.length; i++) {
          var t = records[i].target;
          if (t && t.nodeType === 1 && t.matches && t.matches(MO_SKIP)) { continue; }
          moNeed = true;
          break;
        }
        if (!moNeed) { return; }
        clearTimeout(moTimer);
        moTimer = setTimeout(function () {
          moTimer = null; moNeed = false;
          injectRows();
          markVisitedRows();
        }, 250);
      });
      mo.observe(document.body, { childList: true, subtree: true });
    }

    // 线报状态共治：文章页状态条 / 列表批量灰标
    var navEl = document.querySelector('.pc-nav');
    if (navEl && navEl.dataset.artid) initStatusBar(navEl.dataset.artid);
    else if (document.querySelector('#mainbox .listbox')) scanListStatus();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {};
})();


/* ============ 线报状态共治（匿名轻投票，IP+UA 哈希防刷） ============ */

var ST_NAMES = { 1: '仍有效', 2: '已失效', 3: '已抢完' };
var ST_SHORT = { 1: '有效', 2: '失效', 3: '抢完' };
var ST_CLS = { 1: 'ok', 2: 'bad', 3: 'gone' };
var ST_KEY = { 1: 'alive', 2: 'dead', 3: 'done' };

/* 20261016 游客票面本地对账 —— nginx 游客页缓存按 URL 共享一份 HTML（TTL 60s），
   直出在里面的 mine（我方投态）与票数因此会滞后，甚至属于"暖页"的那个访客：
   表现就是"投完刷新，看着跟没投一样"。故本地另存一份"我投过哪些"（localStorage，
   与 IP+UA 哈希的服务端投票口径互补），加载时与直出态对账：
     · 一致 → 不动（绝大多数场景零开销、零请求）；
     · 本地有我方记录、直出为 0 → 直接按记录原地纠偏（缓存页常见），再回源刷新票数；
     · 直出说我投过、本地无记录 → 无法本地判定真伪（可能是别人暖的页），回源取权威值。
   localStorage 不可用（隐私模式/配额满）时整体退出，退回只信服务端直出。 */
/* 键/上限一律走函数取字面量：本模块的 init() 会在 bundle 执行到本文件顶层 var 之前同步跑
   （defer 脚本执行时 document.readyState 已是 interactive → IIFE 尾部的同步 init() 分支），
   故这里不能依赖顶层 var 的赋值顺序，只能依赖函数声明提升。 */
function stLsKey() { return 'xb_st_mine'; }
var stLsOk = null;
function stLsUsable() {
  if (stLsOk === true || stLsOk === false) return stLsOk;
  try {
    window.localStorage.setItem('xb_st_probe', '1');
    window.localStorage.removeItem('xb_st_probe');
    stLsOk = true;
  } catch (e) { stLsOk = false; }
  return stLsOk;
}
function stLocalGet(artid) {
  if (!stLsUsable()) return 0;
  artid = parseInt(artid, 10) || 0; // initStatusBar 传进来的是 data-artid（字符串），此处归一化
  try {
    var parts = String(window.localStorage.getItem(stLsKey()) || '').split(',');
    for (var i = parts.length - 1; i >= 0; i--) {
      var kv = parts[i].split(':');
      if (parseInt(kv[0], 10) === artid) return parseInt(kv[1], 10) || 0;
    }
  } catch (e) {}
  return 0;
}
function stLocalSet(artid, st) {
  if (!stLsUsable()) return;
  artid = parseInt(artid, 10) || 0;
  if (!artid) return;
  try {
    var keep = [], parts = String(window.localStorage.getItem(stLsKey()) || '').split(',');
    for (var i = 0; i < parts.length; i++) {
      var kv = parts[i].split(':');
      if (kv[0] && parseInt(kv[0], 10) !== artid) keep.push(parts[i]);
    }
    if (st) keep.push(artid + ':' + st);
    if (keep.length > 40) keep = keep.slice(keep.length - 40);
    window.localStorage.setItem(stLsKey(), keep.join(','));
  } catch (e) {}
}
// 直出/AJAX 渲染出的投态与汇总（都从 DOM 读，两处渲染产物同构）
function stDomMine(root) {
  var b = root.querySelector('.xb-st-btn.mine');
  return b ? (parseInt(b.getAttribute('data-st'), 10) || 0) : 0;
}
function stDomSum(root) {
  var el = root.querySelector('.xb-statusbar');
  var raw = el ? (el.getAttribute('data-sum') || '') : '';
  if (!raw) return null;
  try {
    var s = JSON.parse(raw);
    return (s && typeof s === 'object') ? s : null;
  } catch (e) { return null; }
}

// 档案头 v3（20261005 定稿）：头部灰带内 白底胶囊结论 + 30px 投票钮 + 反馈计数
// 接口 summary 键名是 alive/dead/done（原版用 sum[1..3] 取数 → 单项计数恒 0 的隐患，此处修复）
// 结论显示：>=3 票走接口 result（共识，带百分比）；1~2 票本地取当前领先项即时透出（无百分比），0 票才显示"待反馈"
// 领先项按钮（非本人所投）= 语义色浅底（lead ok/bad/gone）；本人所投 = 黑色反白（mine 优先于 lead）
function stBarHtml(sum, mine) {
  function n(k) { return (sum && sum[ST_KEY[k]]) || 0; }
  var total = (sum && sum.total) || 0;
  // 20261013 速率闸门：接口对"近 10 分钟票数超阈值"的篇目下发 burst=1，
  // 本篇一律不出结论/领先项（票数照显），避免堆票换可信度。判定权威在服务端，此处只消费。
  var burst = !!(sum && sum.burst);
  var lead = 0, consensus = false;
  if (!burst && sum && total >= 3 && sum.result) {
    lead = sum.result;
    consensus = true;
  } else if (!burst && total > 0) {
    var best = 0;
    [1, 2, 3].forEach(function (k) {
      if (n(k) > best) { best = n(k); lead = k; }
    });
  }
  // data-sum：供 reconcileStatusBar 原地重画（票数在缓存页里同样会滞后 60s）
  var sumAttr = '{"alive":' + n(1) + ',"dead":' + n(2) + ',"done":' + n(3) + ',"total":' + total
    + ',"result":' + ((sum && sum.result) || 0) + ',"burst":' + (burst ? 1 : 0) + '}';
  var html = '<div class="xb-statusbar" role="group" aria-label="线报状态投票" data-sum=\'' + sumAttr + '\'>';
  if (lead) {
    html += '<span class="xb-st-verdict ' + ST_CLS[lead] + '"><span class="dot"></span>' + ST_NAMES[lead]
      + (consensus ? ' <b>' + Math.round(n(lead) / total * 100) + '%</b>' : '') + '</span>';
  } else {
    html += '<span class="xb-st-verdict none"><span class="dot"></span>待反馈</span>';
  }
  html += '<span class="xb-st-votes" title="' + (total ? total + ' 人已反馈' : '点击反馈这条线报的状态') + '">';
  // 20261006："抢完"(3) 投票下线只留两钮；历史 3 票仍计入 summary（lead=3 只显结论不出钮）
  [1, 2].forEach(function (k) {
    var cnt = n(k);
    var cls = 'xb-st-btn' + (mine === k ? ' mine' : (lead === k ? ' lead ' + ST_CLS[k] : ''));
    html += '<button type="button" class="' + cls + '" data-st="' + k + '">'
      + ST_SHORT[k] + (cnt ? ' <em>' + cnt + '</em>' : '') + '</button>';
  });
  html += '</span>';
  // 右侧计数三态（20261005）：已投=感谢反馈+参与数；有票未投=已有 N 人反馈+邀请；0 票=引导第一票
  var fb;
  if (mine) { fb = '感谢反馈，已有 ' + total + ' 人参与'; }
  else if (total) { fb = '已有 ' + total + ' 人反馈，快来投一票告诉大家'; }
  else { fb = '还没有人反馈，投一票告诉大家'; }
  html += '<span class="xb-st-fb">' + fb + '</span>';
  html += '</div>';
  return html;
}

function initStatusBar(artid) {
  // 20261005：post-single.php 服务端已直出完整状态条（无 AJAX 弹入感）——槽位有内容时只绑投票，不再首拉
  var root = document.getElementById('xb-statusbar-root');
  // 20261005：正文太短时服务端直出空槽位（data-off）——不做任何注入，连 AJAX 兜底也跳过
  if (root && root.dataset.off) return;
  if (!root) {
    root = document.createElement('div');
    root.id = 'xb-statusbar-root';
    root.className = 'xb-stband';
    var head = document.querySelector('.art-head');
    if (head && head.parentNode) head.parentNode.insertBefore(root, head.nextSibling);
    else { var host = document.querySelector('.art-main'); if (host) host.appendChild(root); }
  }
  if (root.querySelector('.xb-statusbar')) {
    bindStatusVote(root, artid);
    // 对账延到下一个宏任务：本模块的 init() 会在 bundle 执行到本文件顶层 var 之前同步跑
    // （见 stLsKey 处注释：defer 脚本执行时 readyState 已是 interactive），而 ST_NAMES/ST_SHORT
    // 等渲染表与 localStorage 记录都是顶层 var —— 同步调用会读到未初始化值。setTimeout 0
    // 保证整个 bundle 的顶层语句（含后续模块）都已跑完，代价只是纠偏晚一帧。
    setTimeout(function () { reconcileStatusBar(root, artid, false); }, 0);
    return;
  }
  // 兜底：旧缓存页/槽位缺失时仍走 AJAX 首拉（GET 返回 mine，已投显示"感谢反馈"）
  $.get('/plus/json/status_vote.php', { artid: artid }, function (res) {
    if (!res || res.code !== 200) return;
    root.innerHTML = stBarHtml(res.summary, (res.mine | 0));
    bindStatusVote(root, artid);
    reconcileStatusBar(root, artid, true); // 刚拉的是权威值 → 只顺带把本地记录收敛过去
  }, 'json');
}

/* 直出态 vs 本地投态记录对账（20261016，见文件上方"游客票面本地对账"注释）。
   fresh=true 表示当前 DOM 是刚从接口拿的权威值（AJAX 首拉/投票响应）→ 只收敛本地记录；
   fresh=false 表示 DOM 来自页面直出（可能是 nginx 缓存的共享副本）→ 不一致时纠偏。 */
function reconcileStatusBar(root, artid, fresh) {
  var htmlMine = stDomMine(root);
  if (fresh) { stLocalSet(artid, htmlMine); return; }
  if (!stLsUsable()) return;
  var localMine = stLocalGet(artid);
  if (htmlMine === localMine) return; // 一致：不动（绝大多数请求在此返回，零请求）
  // 本地有我方记录 → 先按记录原地纠偏（票数照用直出汇总），避免"看着像没投"再闪一下
  var sum = stDomSum(root);
  if (localMine && sum) {
    root.innerHTML = stBarHtml(sum, localMine);
    bindStatusVote(root, artid);
  }
  // 再回源一次：取权威投态（缓存页里的 mine 可能是别人暖的）+ 最新票数
  $.get('/plus/json/status_vote.php', { artid: artid }, function (res) {
    if (!res || res.code !== 200) return;
    var mine = res.mine | 0;
    root.innerHTML = stBarHtml(res.summary, mine);
    bindStatusVote(root, artid);
    stLocalSet(artid, mine);
  }, 'json');
}

function bindStatusVote(root, artid) {
  root.querySelectorAll('.xb-st-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      var st = b.getAttribute('data-st');
      $.post('/plus/json/status_vote.php', { artid: artid, status: st }, function (res) {
        if (res && res.code === 200) {
          root.innerHTML = stBarHtml(res.summary, parseInt(st, 10));
          bindStatusVote(root, artid);
          stLocalSet(artid, parseInt(st, 10));
          // 90s 内让本人请求绕过 nginx 游客页缓存：否则紧接着的刷新会命中投票前的旧页
          // （键是 $scheme$host$request_uri，不含访客身份），又变回"看着像没投"。
          // 与 core.js 重新抓取路径同一手段（update.php 也用 xb_nocache_window）。
          if (typeof xb_nocache_window === 'function') xb_nocache_window();
          layer.msg('感谢反馈');
        } else {
          layer.msg((res && res.msg) || '提交失败');
        }
      }, 'json');
    });
  });
}

// 列表页：批量拉取当前页线报状态，失效率高的行打灰标 + 状态角标
function scanListStatus() {
  var ids = [], map = {};
  document.querySelectorAll('#mainbox .listbox .article-list .title a[href*=".html"]').forEach(function (a) {
    var li0 = a.closest('li.article-list') || a.closest('.article-list');
    if (li0 && (li0.querySelector('.xb-st-flag') || li0.classList.contains('xb-st-chk'))) return; // 20261005: 服务端已判定（xb-st-chk）/已直出角标
    var m = (a.getAttribute('href') || '').match(/\/(\d+)\.html/);
    var id = m ? parseInt(m[1], 10) : 0;
    if (id && ids.indexOf(id) === -1 && ids.length < 60) { ids.push(id); map[id] = li0; }
  });
  if (!ids.length) return;
  $.get('/plus/json/status_vote.php', { ids: ids.join(',') }, function (res) {
    if (!res || res.code !== 200 || !res.summaries) return;
    ids.forEach(function (id) {
      var sum = res.summaries[id];
      var li = map[id];
      if (!sum || !li || !sum.result || sum.result === 1) return; // 仅标注 已失效/已抢完
      li.classList.add('xb-st-dead');
      var t = li.querySelector('.title');
      if (t && !t.querySelector('.xb-st-flag')) {
        var f = document.createElement('span');
        f.className = 'xb-st-flag';
        f.textContent = ST_NAMES[sum.result];
        t.insertBefore(f, t.firstChild);
      }
    });
  }, 'json');
}
