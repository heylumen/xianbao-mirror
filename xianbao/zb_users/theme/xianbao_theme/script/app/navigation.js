/*! app/navigation.js | 顶部导航、二级导航、移动端菜单、搜索开关、工具栏、面包屑 | 依赖: jQuery */
function daohangchuli(a) {
    if (a == "赚客吧") {
        return '<li><a href="/category-zuankeba/" title="赚客吧" rel="nofollow">赚客吧</a></li>'
    } else if (a == "赚客吧热帖") {
        return '<li><a href="/zuankeba-hot.html" title="赚客吧热帖" rel="nofollow">赚客吧热帖</a></li>'
    } else if (a == "新赚吧") {
        return '<li><a href="/category-xinzuanba/" title="新赚吧" rel="nofollow">新赚吧</a></li>'
    } else if (a == "新赚吧热帖") {
        return '<li><a href="/xinzuanba-hot.html" title="新赚吧热帖" rel="nofollow">新赚吧热帖</a></li>'
    } else if (a == "微博线报") {
        return '<li><a href="/category-weibo/" title="微博线报" rel="nofollow">微博线报</a></li>'
    } else if (a == "微博热帖") {
        return '<li><a href="/weibo-hot.html" title="微博热帖" rel="nofollow">微博热帖</a></li>'
    } else if (a == "微博超话") {
        return '<li><a href="/category-weibo-chaohua/" title="微博超话" rel="nofollow">微博超话</a></li>'
    } else if (a == "豆瓣线报") {
        return '<li><a href="/category-douban/" title="豆瓣线报" rel="nofollow">豆瓣线报</a></li>'
    } else if (a == "豆瓣热帖") {
        return '<li><a href="/douban-hot.html" title="豆瓣热帖" rel="nofollow">豆瓣热帖</a></li>'
    } else if (a == "豆瓣买组") {
        return '<li><a href="/category-douban-maizu/" title="豆瓣买组" rel="nofollow">豆瓣买组</a></li>'
    } else if (a == "豆瓣拼组") {
        return '<li><a href="/category-douban-pinzu/" title="豆瓣拼组" rel="nofollow">豆瓣拼组</a></li>'
    } else if (a == "豆瓣发组") {
        return '<li><a href="/category-douban-fazu/" title="豆瓣发组" rel="nofollow">豆瓣发组</a></li>'
    } else if (a == "爱猫生活") {
        return '<li><a href="/category-douban-maolife/" title="豆瓣爱猫生活" rel="nofollow">豆瓣爱猫生活</a></li>'
    } else if (a == "爱猫澡盆") {
        return '<li><a href="/category-douban-maobathtub/" title="豆瓣爱猫澡盆" rel="nofollow">豆瓣爱猫澡盆</a></li>'
    } else if (a == "豆瓣狗组") {
        return '<li><a href="/category-douban-gouzu/" title="豆瓣狗组" rel="nofollow">豆瓣狗组</a></li>'
    } else if (a == "好单线报") {
        return '<li><a href="/category-haodan/" title="好单线报" rel="nofollow">好单线报</a></li>'
    } else if (a == "小嘀咕") {
        return '<li><a href="/category-xiaodigu/" title="小嘀咕" rel="nofollow">小嘀咕</a></li>'
    } else if (a == "值得买") {
        return '<li><a href="/category-zhidemai/" title="值得买" rel="nofollow">值得买</a></li>'
    } else if (a == "值得买热帖") {
        return '<li><a href="/zhidemai-hot.html" title="值得买热帖" rel="nofollow">值得买热帖</a></li>'
    } else if (a == "酷安") {
        return '<li><a href="/category-kuan/" title="酷安" rel="nofollow">酷安</a></li>'
    } else if (a == "葫芦侠三楼") {
        return '<li><a href="/category-huluxia/" title="葫芦侠三楼" rel="nofollow">葫芦侠三楼</a></li>'
    } else if (a == "更新较慢活动") {
        return '<li><a href="/category-man/" title="更新较慢活动" rel="nofollow">更新较慢活动</a></li>'
    } else if (a == "小刀娱乐网") {
        return '<li><a href="/category-xiaodao/" title="小刀娱乐网" rel="nofollow">小刀娱乐网</a></li>'
    } else if (a == "爱Q生活网") {
        return '<li><a href="/category-iqnew/" title="爱Q生活网" rel="nofollow">爱Q生活网</a></li>'
    } else if (a == "技术QQ网") {
        return '<li><a href="/category-qqjishu/" title="技术QQ网" rel="nofollow">技术QQ网</a></li>'
    } else if (a == "YYOK大全") {
        return '<li><a href="/category-yyok/" title="YYOK大全" rel="nofollow">YYOK大全</a></li>'
    } else if (a == "活动资讯网") {
        return '<li><a href="/category-huodong/" title="活动资讯网" rel="nofollow">活动资讯网</a></li>'
    } else if (a == "免费赚钱中心") {
        return '<li><a href="/category-mianfei/" title="免费赚钱中心" rel="nofollow">免费赚钱中心</a></li>'
    } else {
        return ''
    }
}
function adddaohang(a){if(a=="默认"){return}var daohangarr=a.split("|");var xindaohang="";for(j=0;j<daohangarr.length;j++){xindaohang=xindaohang+daohangchuli(daohangarr[j])}$(".nav2-ul").html('<li><a href="/" title="线报酷" rel="nofollow">首页</a></li><li><a href="/category-guanzhu/" title="我的关注-线报酷" rel="nofollow">我的关注</a></li><li><a href="/yixiaoshi-hot.html" title="排行榜-线报酷" rel="nofollow">排行榜</a></li>'+xindaohang);zhenglidaohang()}
function zhenglidaohang() {
    $(".nav2-ul li a").each(function () {
        if ($(this).attr("href") == $(".mianbaoxie a").eq(1).attr("href") || $(this).attr("href") == window.location.pathname) {
            $(".nav2-ul li").removeClass("nav2-ul-li");
            $(this).parent("li").addClass("nav2-ul-li")
        } else if ($(this).attr("href") == "/category-douban/" && $(".nav2-ul li a").hasClass("nav2-ul-li") ==false && window.location.pathname.indexOf("douban") != -1) {
            $(".nav2-ul li").removeClass("nav2-ul-li");
            $(this).parent("li").addClass("nav2-ul-li")
        } else if ($(this).attr("href") == "/category-weibo/" && window.location.pathname.indexOf("weibo") != -1) {
            $(".nav2-ul li").removeClass("nav2-ul-li");
            $(this).parent("li").addClass("nav2-ul-li")
        } else if ($(this).attr("href") == "/category-haodan/" && window.location.pathname.indexOf("haodan") != -1) {
            $(".nav2-ul li").removeClass("nav2-ul-li");
            $(this).parent("li").addClass("nav2-ul-li")
        } else if ($(this).attr("href") == "/category-guanzhu1/" && window.location.pathname.indexOf("guanzhu") != -1) {
            $(".nav2-ul li").removeClass("nav2-ul-li");
            $(this).parent("li").addClass("nav2-ul-li")
        } else if ($(this).attr("href") == "/category-zhidemai/" && window.location.pathname.indexOf("zhidemai") != -1) {
            $(".nav2-ul li").removeClass("nav2-ul-li");
            $(this).parent("li").addClass("nav2-ul-li")
        } else if ($(this).attr("href").indexOf($(".tip-main").data("type")) != -1) {
            $(".nav2-ul li").removeClass("nav2-ul-li");
            $(this).parent("li").addClass("nav2-ul-li")
        } else if ($(this).attr("href") == "/yixiaoshi-hot.html" && $(".pc-nav").attr("data-pagealias")) {
            $(".nav2-ul li").removeClass("nav2-ul-li");
            $(this).parent("li").addClass("nav2-ul-li")
        }
    });
    if ($(".nav2-ul-li").length > 0) {
        var w = 0;
        $(".nav2-ul-li").prevAll().each(function () {
            w = w + $(this).innerWidth()
        });
        w = w + ($(".nav2-ul-li").innerWidth() / 2);
        w = w - ($(".nav2-ul").innerWidth() / 2);
        $(".nav2-ul").scrollLeft(w)
    } else {
        $(".nav2-ul").find("li").eq(0).addClass("nav2-ul-li")
    }
}
$(function() {zhenglidaohang();});
$(function () {
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
            if (expanded) {
                $panel.empty().append($list.children("li").clone(true, true));
                $panel.addClass("open");
            } else {
                $panel.removeClass("open");
            }
            $toggle.toggleClass("expanded", expanded);
            $toggle.attr("aria-expanded", expanded ? "true" : "false");
            $toggle.attr({"aria-label": expanded ? "收起分类" : "展开分类", "title": expanded ? "收起分类" : "展开分类"});
        });
        var lastY = $(window).scrollTop();
        $(window).on("scroll", function () {
            if ($panel.hasClass("open")) {
                var y = $(this).scrollTop();
                if (Math.abs(y - lastY) > 4) { closePanel(); }
            }
            lastY = $(this).scrollTop();
        });
    }
});
$(function(){$("#toolbar").each(function(){$(this).find("#qr").mouseenter(function(){$(this).find("#qr-img").fadeIn("fast")});$(this).find("#qr").mouseleave(function(){$(this).find("#qr-img").fadeOut("fast")});$(this).find("#totop").click(function(){$("html, body").animate({"scroll-top":0},"fast")})});var a=false;$(window).scroll(function(){var b=$(window).scrollTop();if(b>500){$("#toolbar").data("status",true)}else{$("#toolbar").data("status",false)}if($("#toolbar").data("status")!=a){a=$("#toolbar").data("status");if(a){$("#totop").show()}else{$("#totop").hide()}}})});$(function(){var a=$("#flink a");a.addClass("iconfont icon-link")});
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
$(function(){var f=$(".responsive-nav");$(".m-nav-btn i").click(function(){$(".sub-nav").toggleClass("m-sub-nav");if($('.responsive-nav .m-nav').hasClass('pc-nav')){$(".m-nav-btn i.iconfont").css("position","fixed");$(".responsive-nav").addClass("show");$(".responsive-nav .m-nav").removeClass("pc-nav")}else{$(".m-nav-btn i.iconfont").css("position","absolute");$(".responsive-nav .m-nav").addClass("pc-nav");$(".responsive-nav").removeClass("show")}})});
$(function(){jQuery(".m-nav .nav-ul > li,.m-nav .nav-ul > li ul li").each(function(){jQuery(this).children(".m-nav .m-sub-nav").not(".active").css("display","none");jQuery(this).children(".m-nav .toggle-btn").bind("click",function(){$(".m-nav .m-sub-nav").addClass("active");jQuery(this).children().addClass(function(){if(jQuery(this).hasClass("active")){jQuery(this).removeClass("active");return""}return"active"});jQuery(this).siblings(".m-nav .m-sub-nav").slideToggle()})})});
$(function(){var f=$(".pc-nav").attr("data-type");$(".m-nav-btn i").click(function(){$(".m-nav-btn i").toggleClass("active");})});
$(function(){$("#search-button").click(function(){$("#search-button i").toggleClass("icon-close"),$("#search-button i").toggleClass("icon-search"),$("#mask-hidden").toggleClass("mask-show"),$("#search-area").fadeToggle("fast")})});
$(function(){var f=$("#flink a");f.addClass("iconfont icon-link")});
