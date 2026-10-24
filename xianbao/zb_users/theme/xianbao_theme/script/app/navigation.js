/*! app/navigation.js | 顶部导航、二级导航、移动端菜单、搜索开关、工具栏、面包屑 | 依赖: jQuery */
/* 手机二级导航已于 20261004 晚改 header.php 服务端渲染（PHP 原生激活态，
 * 预设映射同步维护于 Ucenter Shezhi_jiban.php DH_PRESET 与 header.php）；
 * 本文件仅保留：展开面板、激活项滚动居中等交互增强。 */
/* 20261016 首绘闸门配套：Profiler 实测本文件 ready 回调是 defer 链执行最贵的主题脚本
 * （2x CPU 节流 ~26ms，仅次于 jQuery 本体），但其全部工作（激活态居中/工具栏/返回顶部/
 * 友链图标/搜索开合/面包屑激活）都不在首屏关键路径上，且闸门（header.php html.xb-boot）
 * 要到 DOMContentLoaded 之后才放行——把 ready 回调统一推迟到 defer 链结束后的首个空闲帧，
 * 主列表筛选/标红等真正要赶 DCL 的逻辑先行，本文件不再挤占 TBT。绑定型交互（点击/悬停）
 * 在用户首个交互前就绪即可，空闲回调在 DCL 后立即排队，实际延迟 <100ms。 */
/* 激活项滚动居中（20261006 二轮定稿：自然滚动夹取）——激活项对齐屏幕中线，
 * 但仅限"滚一下就能到"的情形：滚动量夹在 [0, 最大可滚] 内，不注入任何补白。
 * 靠前的激活项保持自然位置（用户定调：不强行把前几项挪到中间），
 * 靠后的激活项滚到尽头露出为止。供 nav2（header.php 服务端激活）与
 * rank.js（rt-tabs/tip-nav 激活项）共用。 */
function xbNavScrollActive(itemEl) {
    if (!itemEl || itemEl.nodeType !== 1) return;
    var el = itemEl, scroller = null;
    while (el && el !== document.body) {
        var ox = getComputedStyle(el).overflowX;
        if (ox === "auto" || ox === "scroll") { scroller = el; break; }
        el = el.parentElement;
    }
    if (!scroller) return;
    /* 内容一屏放得下（无横向溢出）时无需滚动 */
    if (scroller.scrollWidth <= scroller.clientWidth + 1) return;
    var iRect = itemEl.getBoundingClientRect();
    if (iRect.width <= 0) return;
    var delta = (iRect.left + iRect.width / 2) - window.innerWidth / 2;
    var max = scroller.scrollWidth - scroller.clientWidth;
    scroller.scrollLeft = Math.min(max, Math.max(0, scroller.scrollLeft + delta));
}
/* nav2 激活项居中（服务端已标 nav2-ul-li） */
function nav2Center() {
    var ulEl = document.querySelector(".nav2-ul");
    if (ulEl) xbNavScrollActive(ulEl.querySelector(".nav2-ul-li"));
}
/* 全部 ready 回调集中推迟到空闲时（见文件头 20261016 注释）：
 * xbReady(fn) = DOMContentLoaded 后的空闲帧执行；期间用户若已点击，仍会执行（不丢交互）。
 * xbNavScrollActive/nav2Center/xbNavRecenterAll 保持全局函数（rank.js/resize 依赖），不动。 */
function xbReady(fn) {
    if (document.readyState !== 'loading') {
        (window.requestIdleCallback || function (f) { setTimeout(f, 50); })(fn);
    } else {
        document.addEventListener('DOMContentLoaded', function () {
            (window.requestIdleCallback || function (f) { setTimeout(f, 50); })(fn);
        });
    }
}
xbReady(function() {nav2Center();});
$(window).on("load", nav2Center);
/* 旋转/缩放后全部横滑条重居中（rt-tabs/tip-nav 的激活项由 rank.js 首次载入居中，这里统一兜底） */
function xbNavRecenterAll() {
    nav2Center();
    var act = document.querySelector(".rt-tabs span.active");
    if (act) xbNavScrollActive(act);
    act = document.querySelector(".tip-nav span.active");
    if (act) xbNavScrollActive(act);
}
var xbNavCenterTimer;
$(window).on("resize", function() { clearTimeout(xbNavCenterTimer); xbNavCenterTimer = setTimeout(xbNavRecenterAll, 150); });

xbReady(function () {
    var $toggle = $(".nav2-toggle"), $list = $("#nav2-list"), $panel = $("#nav2-panel");
    if ($toggle.length && $list.length && $panel.length) {
        function closePanel() {
            $panel.removeClass("open");
            $toggle.removeClass("expanded");
            $toggle.attr("aria-expanded", "false");
            $toggle.attr({"aria-label": "展开分类", "title": "展开分类"});
        }
        $toggle.on("click", function () {
            var expanded = !$toggle.hasClass("expanded");
            /* 面板内容已由 header.php 服务端分组直出（20261005 方案 A），此处仅开合 */
            if (expanded) {
                $panel.addClass("open");
            } else {
                $panel.removeClass("open");
            }
            $toggle.toggleClass("expanded", expanded);
            $toggle.attr("aria-expanded", expanded ? "true" : "false");
            $toggle.attr({"aria-label": expanded ? "收起分类" : "展开分类", "title": expanded ? "收起分类" : "展开分类"});
        });
        /* 20261005：滚动不再自动关闭展开面板（用户要求滑动时保持展开），仅点击 toggle 开合 */
    }
});
xbReady(function(){$("#toolbar").each(function(){$(this).find("#qr").mouseenter(function(){$(this).find("#qr-img").fadeIn("fast")});$(this).find("#qr").mouseleave(function(){$(this).find("#qr-img").fadeOut("fast")});$(this).find("#totop").click(function(){$("html, body").animate({"scroll-top":0},"fast")})});var a=false;$(window).scroll(function(){var b=$(window).scrollTop();if(b>500){$("#toolbar").data("status",true)}else{$("#toolbar").data("status",false)}if($("#toolbar").data("status")!=a){a=$("#toolbar").data("status");if(a){$("#totop").show()}else{$("#totop").hide()}}})});xbReady(function(){var a=$("#flink a");a.prepend('<svg class="xb-ic" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-link"></use></svg> ')});
$(function () {
    // 缓存常用选择器和路径
    const $breadcrumbLink = $(".mianbaoxie a").eq(1);
    const currentPath = window.location.pathname;
    const currentSearch = window.location.search;
    const dangurl = $breadcrumbLink.attr("href");
    
    // 定义分类映射关系
    const categoryMap = {
        "xianbaoku": [
            "/guanyu.html", "/mianze.html", "/guanggao.html", "/tougao.html",
            "/category-xianbaoku/", "/category-jiaocheng/", "/category-gonggao/", "/category-guidang/"
        ],
        "guanzhu": [
            "/category-guanzhu1/","/category-guanzhu2/","/category-guanzhu3/"
        ],
        "zuankeba": [
            "/category-zuankeba/", "/zuankeba-hot.html"
        ],
        "xinzuanba": [
            "/category-xinzuanba/", "/xinzuanba-hot.html"
        ],
        "haodan": [
            // 动态检查包含"haodan"
        ],
        "zhidemai": [
            "/zhidemai-hot.html"
            // 动态检查包含"zhidemai"
        ],
        "douban": [
            "/category-douban/", "/category-douban-maizu/", "/category-douban-pinzu/",
            "/category-douban-fazu/", "/category-douban-maolife/", "/category-douban-maobathtub/",
            "/category-douban-gouzu/", "/douban-hot.html"
        ],
        "weibo": [
            "/weibo-hot.html"
            // 动态检查包含"weibo"
        ],
        "xiaodigu": [
            "/category-xiaodigu/"
        ],
        "smzdm": [
            "/category-smzdm"
        ],
        "qita": [
            "/category-kuan/", "/category-huluxia/", "/category-huizong/", "/category-zuixin/",
            "/category-xiaodao/", "/category-iqnew/", "/category-qqjishu/",
            "/category-yyok/", "/category-huodong/", "/category-mianfei/"
        ]
    };

    // 检查路径是否匹配
    function checkPath(category) {
        const paths = categoryMap[category];
        if (!paths) return false;
        
        // 静态路径检查
        if (paths.some(path => currentPath === path || dangurl === path)) {
            return true;
        }
        
        // 动态路径检查
        if (category === "haodan" && (currentPath.includes("haodan") || currentSearch.includes("cate=haodan"))) {
            return true;
        }
        if (category === "zhidemai" && (currentPath.includes("zhidemai") || currentSearch.includes("cate=19"))) {
            return true;
        }
        if (category === "weibo" && dangurl && dangurl.includes("weibo")) {
            return true;
        }
        
        return false;
    }

    // 确定激活的导航项
    let activeCategory = null;
    for (const category in categoryMap) {
        if (checkPath(category)) {
            activeCategory = category;
            break;
        }
    }

    // 设置active类
    if (activeCategory) {
        $(`#navbar-category-${activeCategory}`).addClass("active");
    } else if ($(".pc-nav").attr("data-pagealias")) {
        $("#navbar-page-paihangbang").addClass("active");
    } else {
        $("#nvabar-item-index").addClass("active");
    }
});
/* mnav C2（20261005）：列表抽屉入口（m-nav-btn）与其开合逻辑整体下线——按钮 markup 已从 header.php
   移除，抽屉（.responsive-nav）无触发途径恒隐藏；下方抽屉内折叠/当前页标记两个绑定因选择器
   要求 .m-nav 无 .pc-nav 类（该类永在）而恒不命中，保留为惰性代码 */
/* 抽屉内分类折叠（20261005 修复：toggle-btn 是 <a> 的子元素，旧 children() 绑定永不生效且箭头点击会跳转链接；
   仅抽屉态（m-nav 无 pc-nav 类）生效，PC 端 hover 下拉不受影响） */
/* 抽屉内分类折叠（20261005 方案 A：li.open 驱动父项加粗与箭头旋转，slideToggle 不变） */
xbReady(function(){$(document).on("click",".responsive-nav .m-nav:not(.pc-nav) .toggle-btn",function(e){e.preventDefault();e.stopPropagation();var $li=$(this).closest("li"),$sub=$li.children(".sub-nav");if(!$sub.length)return;var opening=$sub.is(":hidden");$sub.stop(true,false).slideToggle(200);$li.toggleClass("open",opening)})});
/* 移动端搜索面板开合（20261023）：面板 fixed 悬浮但背景页仍能滚，顶栏（含关闭键）会被带出屏幕 ⇒
   开合同步给 <html> 挂/摘 xb-splock（style.css ≤1100px 媒体查询锁 html/body 溢出）；遮罩点按可直接关闭。 */
xbReady(function(){var $sb=$("#search-button");$sb.click(function(){var on=!$sb.hasClass("xb-on");$sb.toggleClass("xb-on",on);$("#mask-hidden").toggleClass("mask-show",on);$("#search-area").fadeToggle("fast");document.documentElement.classList.toggle("xb-splock",on)});$("#mask-hidden").click(function(){if($sb.hasClass("xb-on"))$sb.click()})});
/* 抽屉当前页子项绿点标记（20261005 方案 A）：按 pathname 精确匹配，PC 端同加类但样式仅抽屉态生效 */
xbReady(function(){var p=location.pathname.replace(/\/+$/,"");$(".responsive-nav .sub-nav a").each(function(){if(this.pathname.replace(/\/+$/,"")===p&&p!=="")$(this).addClass("cur")})});