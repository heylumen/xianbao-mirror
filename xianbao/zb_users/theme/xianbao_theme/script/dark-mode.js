/*<script>
    // 读取cookie
    function getCookie(name) {
        var prefix = name + "=";
        var cookieStartIndex = document.cookie.indexOf(prefix);
        if (cookieStartIndex == -1) {
            return null;
        }
        var cookieEndIndex = document.cookie.indexOf(";", cookieStartIndex + prefix.length);
        if (cookieEndIndex == -1) {
            cookieEndIndex = document.cookie.length;
        }
        return decodeURIComponent(document.cookie.substring(cookieStartIndex + prefix.length, cookieEndIndex));
    }
    
    // 如果cookie中night为1，设置黑色背景
    if (getCookie("night") === "1") {
        document.documentElement.className += " night";
    }
</script>*/

//夜间模式
//生效态三态判定（20261006）：cookie night=1 锁定夜 / 0 锁定日 / 无 cookie 跟随系统 prefers-color-scheme
function isWebapp() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
           window.navigator.standalone === true;
}

function xbNightEffective() {
    var ck = (window.zbp && zbp.cookie) ? zbp.cookie.get("night") : (document.cookie.match(/(?:^|;\s*)night=([^;]*)/) || [])[1];
    if (ck === '1') { return true; }
    if (ck === '0') { return false; }
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
}

// ============================================================
// 多主题体系（20261006，测试站）：
//   白天=默认；夜间=html.night；其余=html[data-xb-theme]；
//   跟随系统=prefers-color-scheme 实时落白天/夜间。
//   选择存 cookie xb_theme（365 天）；旧 night cookie 只读兼容（xbThemeGet 回退），
//   用户显式选主题时删除旧 night cookie，避免双源打架。
//   主题块本体在 /design/tokens.css（v20261006a 起），换值不换名。
// ============================================================
var XB_THEMES = ['system','day','night','eye','parchment','solarized','sunset','gray',
                 'dracula','nord','tokyo','catppuccin','rosepine','gruvbox','everforest','one-dark'];
var XB_THEMES_DARK = { night:1, sunset:1, gray:1, dracula:1, nord:1, tokyo:1,
                       catppuccin:1, rosepine:1, gruvbox:1, everforest:1, 'one-dark':1 };

function xbThemeValid(t) { return XB_THEMES.indexOf(t) > -1; }

function xbThemeGet() {
    var t = (window.zbp && zbp.cookie) ? zbp.cookie.get('xb_theme') : (document.cookie.match(/(?:^|;\s*)xb_theme=([^;]*)/) || [])[1];
    if (t && xbThemeValid(t)) { return t; }
    // 旧夜间锁定 cookie 只读兼容（未选过主题的老用户保持原夜间/白天状态）
    var ck = (window.zbp && zbp.cookie) ? zbp.cookie.get('night') : (document.cookie.match(/(?:^|;\s*)night=([^;]*)/) || [])[1];
    if (ck === '1') { return 'night'; }
    if (ck === '0') { return 'day'; }
    return 'system';
}

function xbThemeResolve(t) {
    if (t !== 'system') { return t; }
    return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'night' : 'day';
}

// 主题块懒加载（20261019 从 tokens.css 拆出独立文件）：
//   tokens.css 只留 :root(亮色) + html.night，13 个暗色主题块（28KB 原文 / 5.7KB gzip）
//   移到 /design/tokens-themes.css。默认亮色/跟随系统落亮色的用户不再下载这部分；
//   夜间用户走 html.night（仍在 tokens.css 内，零额外请求）。
//   回访用户（cookie 已是某个暗色主题）由 header.php 首绘前的内联脚本直接 <link> 注入，
//   不等本文件（defer 在首绘之后，晚了会先闪一帧默认亮色）。本函数只处理运行期切换。
function xbThemeCssLoaded() {
    return !!document.getElementById('xb-theme-css');
}

function xbThemeCssEnsure() {
    if (xbThemeCssLoaded()) { return; }
    var html = document.documentElement;
    var l = document.createElement('link');
    l.id = 'xb-theme-css';
    l.rel = 'stylesheet';
    // 版本戳与 header.php / src/index.php 的 tokens.css 戳分开维护（只改主题块时升这个）
    l.href = '/design/tokens-themes.css?v=2026101901';
    // 主题块按 html[data-xb-theme] 选择器生效：属性已挂好，样式到达即生效。
    // 加载失败不阻断页面（无样式=回落默认亮色令牌，可读）。
    html.appendChild(l);
}

//应用主题到 html/body（t 为原始选择，内部解析跟随系统）；webapp 客户端只认深浅布尔
function xbThemeApply(t) {
    t = xbThemeResolve(t);
    var html = document.documentElement, dark = !!XB_THEMES_DARK[t];
    // 暗色主题（night 除外，night 令牌在 tokens.css 内）先确保主题块已就位，
    // 避免"属性已挂、样式未到"的一帧默认亮色
    if (t !== 'night' && t !== 'day' && t !== 'system') { xbThemeCssEnsure(); }
    html.classList.add('theme-switching');
    if (t === 'night') {
        html.classList.add('night');
        document.body.classList.add('night');
        html.removeAttribute('data-xb-theme');
    } else {
        html.classList.remove('night');
        document.body.classList.remove('night');
        if (t === 'day') { html.removeAttribute('data-xb-theme'); }
        else { html.setAttribute('data-xb-theme', t); }
    }
    if (isWebapp()) {
        window.webapp.night(dark);
        window.webapp.color();
    }
    setTimeout(function () { html.classList.remove('theme-switching'); }, 250);
}

function xbThemeSet(t) {
    if (!xbThemeValid(t)) { return; }
    if (window.zbp && zbp.cookie) { zbp.cookie.set('xb_theme', t, 365); } else { document.cookie = 'xb_theme=' + t + '; expires=' + new Date(Date.now()+365*864e5).toUTCString() + '; path=/'; }
    // 删除旧夜间锁定 cookie：语义已并入 xb_theme
    document.cookie = 'night=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    xbThemeApply(t);
    xbThemeSyncMenu();
}

//菜单勾选态同步（页面缓存下服务端 markup 固定，激活态只能客户端画）
function xbThemeSyncMenu() {
    var menu = document.getElementById('xbThemeMenu');
    if (!menu) { return; }
    var cur = xbThemeGet();
    var opts = menu.querySelectorAll('.xb-tm-opt');
    for (var i = 0; i < opts.length; i++) {
        var fs = opts[i].getAttribute('data-fs'), tl = opts[i].getAttribute('data-tl');
        if (opts[i].getAttribute('data-t') === cur) { opts[i].classList.add('on'); }
        else if (fs !== null) { if (fs === xbFsGet()) { opts[i].classList.add('on'); } else { opts[i].classList.remove('on'); } }
        else if (tl !== null) { if (tl === xbTlGet()) { opts[i].classList.add('on'); } else { opts[i].classList.remove('on'); } }
        else { opts[i].classList.remove('on'); }
    }
}

//菜单开合（触发键 header #xbThemeBtn；fixed 定位锚定按钮下缘）
function xbThemeMenuToggle(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    var menu = document.getElementById('xbThemeMenu');
    var btn = document.getElementById('xbThemeBtn');
    if (!menu || !btn) { return; }
    var willOpen = menu.hidden;
    if (willOpen) {
        menu.hidden = false; // 先显示才能量宽（hidden 态 offsetWidth=0）
        var r = btn.getBoundingClientRect();
        menu.style.top = (r.bottom + 8) + 'px';
        // 右偏移夹紧：优先对齐按钮右缘，放不下时内收到视口右缘留 8px（移动端菜单比按钮右侧空间宽）
        var wantRight = Math.max(8, window.innerWidth - r.right);
        var maxRight = Math.max(8, window.innerWidth - menu.offsetWidth - 8);
        menu.style.right = Math.min(wantRight, maxRight) + 'px';
        xbThemeSyncMenu();
    } else {
        menu.hidden = true;
    }
    btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
}

$(document).ready(function() {

    // 兜底同步（html 上的 night / data-xb-theme 已由 head 内联脚本首绘前挂好）
    xbThemeApply(xbThemeGet());

    //跟随系统：仅当前选择是「跟随系统」时，系统深浅切换实时跟随
    if (window.matchMedia) {
        var mq = window.matchMedia('(prefers-color-scheme: dark)');
        var xbThemeSys = function(e) {
            if (xbThemeGet() !== 'system') { return; }
            if (isWebapp()) {
                window.webapp.night(e.matches);
                window.webapp.color();
            } else {
                xbThemeApply('system');
            }
        };
        if (mq.addEventListener) { mq.addEventListener('change', xbThemeSys); }
        else if (mq.addListener) { mq.addListener(xbThemeSys); }
    }

    //主题菜单交互：外点/Esc 关闭，选项点击即换主题
    var tbtn = document.getElementById('xbThemeBtn');
    var tmenu = document.getElementById('xbThemeMenu');
    if (tbtn && tmenu) {
        document.addEventListener('click', function(e) {
            if (tmenu.hidden) { return; }
            if (tmenu.contains(e.target) || tbtn.contains(e.target)) { return; }
            tmenu.hidden = true;
            tbtn.setAttribute('aria-expanded', 'false');
        });
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && !tmenu.hidden) { tmenu.hidden = true; tbtn.setAttribute('aria-expanded', 'false'); }
        });
        tmenu.addEventListener('click', function(e) {
            var opt = e.target.closest ? e.target.closest('.xb-tm-opt') : null;
            if (!opt) { return; }
            // 字号档位 / 标题行数分组：改后菜单不关（可连续试档），仅主题项点完关闭
            var fs = opt.getAttribute('data-fs'), tl = opt.getAttribute('data-tl');
            if (fs !== null) { xbFsSet(fs); return; }
            if (tl !== null) { xbTlSet(tl); return; }
            xbThemeSet(opt.getAttribute('data-t'));
            tmenu.hidden = true;
            tbtn.setAttribute('aria-expanded', 'false');
        });
    }

});


//夜间模式切换（挂 theme-switching 冻结 250ms：换肤瞬间禁用全部过渡，防止"换肤动画化"）
function xbNightApply(on) {
    document.documentElement.classList.add('theme-switching');
    if (on) {
        document.documentElement.classList.add("night");
        document.body.classList.add("night");
    } else {
        document.documentElement.classList.remove("night");
        document.body.classList.remove("night");
    }
    setTimeout(function () { document.documentElement.classList.remove('theme-switching'); }, 250);
}

function switchNightMode() {
    //旧夜间切换入口（pwa/书签可能仍调用）：现映射为「在夜间/白天间切换」并写 xb_theme
    xbThemeSet(xbNightEffective() ? 'day' : 'night');
}

//列表密度切换（舒适=默认 / 紧凑=html.density-compact 换行几何令牌）
//cookie 键 density；html 上的 class 由 head 内联脚本首绘前挂好，此处只做切换

// ============================================================
// 字号档位 + 列表标题行数（20261009）：复用主题菜单（#xbThemeMenu 内 data-fs / data-tl 分组）
//   字号：cookie xb_fs（''=标准 / s / l / xl）→ html.xb-fs-*（--fscale 单一系数，style.css 消费）
//   行数：cookie xb_tlines（''=一行 / 2）→ html.xb-tl2（全站两行 clamp）
//   html 上的 class 由 header.php head 内联脚本首绘前挂好（防跳变），此处负责设置/应用/菜单勾选
// ============================================================
function xbFsValid(v) { return v === '' || v === 's' || v === 'l' || v === 'xl'; }
function xbFsGet() {
    var v = (window.zbp && zbp.cookie) ? zbp.cookie.get('xb_fs') : (document.cookie.match(/(?:^|;\s*)xb_fs=([^;]*)/) || [])[1];
    return xbFsValid(v) ? v : '';
}
function xbFsApply(v) {
    var html = document.documentElement;
    html.classList.remove('xb-fs-s', 'xb-fs-l', 'xb-fs-xl');
    if (v) { html.classList.add('xb-fs-' + v); }
}
function xbFsSet(v) {
    if (!xbFsValid(v)) { return; }
    if (window.zbp && zbp.cookie) { zbp.cookie.set('xb_fs', v, 365); } else { document.cookie = 'xb_fs=' + v + '; expires=' + new Date(Date.now()+365*864e5).toUTCString() + '; path=/'; }
    xbFsApply(v);
    xbThemeSyncMenu();
}
function xbTlGet() {
    return zbp.cookie.get('xb_tlines') === '2' ? '2' : '';
}
function xbTlApply(v) {
    if (v === '2') { document.documentElement.classList.add('xb-tl2'); }
    else { document.documentElement.classList.remove('xb-tl2'); }
}
function xbTlSet(v) {
    if (v !== '' && v !== '2') { return; }
    zbp.cookie.set('xb_tlines', v, 365);
    xbTlApply(v);
    xbThemeSyncMenu();
}
