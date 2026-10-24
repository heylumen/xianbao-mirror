/* 文案兜底（后台「站点信息 → 前端 JS 文案」经 meta.php 下发 window.xb_texts） */
function xbT(k, d) { return (window.xb_texts && window.xb_texts[k]) || d; }
/*! app/rank.js | 排行榜模块：值得买热帖/榜单Tab/微博分类标签 | 依赖: lscache, Swiper(=app/xb-swiper.js 自写兼容层), core.listfilter, list.listtimechuli
 * 20261004 服务端直出改造：赚客吧/新赚吧/微博/豆瓣热帖页与全部分类热帖页（/{分类别名}-hot.html）
 * 已由主题 service_rank.php+cate-hot.php 模板服务端直出（窗格轮播由 sidebar.js initHotSwiper 接管），
 * 本文件仅保留：值得买热帖（zhidemai-hot，zdm 数据源静态 JSON）、通用榜单页 rank-tabs URL 跳转、
 * 微博/值得买/好单频道分类标签。 */
/* 热帖页频道标签：按 config（{channel}-hot）给出频道名、角标文案与 figure 分类号 */
function xb_rank_label(config) {
    if (String(config).indexOf("manmanmai") === 0) {
        return { name: xbT('rank_mmb', '慢慢买'), badgeCat: xbT('rank_mmb', '慢慢买'), figureCate: 32 };
    }
    return { name: xbT('rank_zdm', '值得买'), badgeCat: xbT('rank_zdm', '值得买'), figureCate: 19 };
}

function xb_retiechuli(cars, opts) {
    var zuanCars = [];
    var dangqian = 0;
    var bangdingshu = 40;
    $.each(cars, function (i, field) {
        zuanCars.push(field);
        dangqian++;
        if (dangqian == bangdingshu) {
            return false
        }
    });

    zuanCars = sortByKey(zuanCars, "posttime", "desc")

    var adddata = xb_listtimechuli(zuanCars, { figure: true, badgeCat: (opts && opts.badgeCat) || undefined, figureCate: opts && opts.figureCate });
    if (adddata) {
        adddata = '<div class="swiper-slide"><ul class="new-post">' + adddata + '</ul></div>';
        return adddata
    }
    return '<div class="swiper-slide"><div class="xb-empty"><b>' + xbT('rank_empty', '该时间窗暂无热帖') + '</b><span class="sub">' + xbT('rank_empty_sub', '稍后再来看看') + '</span></div></div>';
}

function xb_retielist(result, config) {
    var label = xb_rank_label(config);
    var zuandata1 = xb_retiechuli(result.remen1, label);
    var zuandata3 = xb_retiechuli(result.remen3, label);
    var zuandata6 = xb_retiechuli(result.remen6, label);

    var zuizhong =
        '<div class="mianbaoxie zuankebatabs"><div class="rt-hd"><b>' + label.name + '热帖</b><span class="sub">按窗口热度实时更新</span></div><div class="rt-tabs"><span class="active">' + label.name + '1小时热帖</span><span>' + label.name + '3小时热帖</span><span>' + label.name + '6小时热帖</span></div></div><div class="listbox"><div class="retie-post"><div class="swiper zuankebahot"><div class="swiper-wrapper">' +
        zuandata1 + zuandata3 + zuandata6 + '</div></div></div></div></div>';
    $("#mainbox").append(zuizhong);
    // 全局筛选（window.xb_global_filter）：热榜板块渲染后过滤（未启用时内部直通）
    if (typeof xb_global_listfilter === "function") {
        xb_global_listfilter($("#mainbox .retie-post .article-list"), "热榜");
    }
    // 全局列表筛选·用户端（window.xb_global_fe_filter）：同板块本地过滤补充（未启用直通）
    if (typeof xb_global_fe_listfilter === "function") {
        xb_global_fe_listfilter($("#mainbox .retie-post .article-list"), "热榜");
    }
    var mySwiper = new Swiper('#mainbox .zuankebahot', {
        autoHeight: true,
        on: {
            slideChange: function () {
                $("#mainbox .zuankebatabs .rt-tabs .active").removeClass('active');
                $("#mainbox .zuankebatabs .rt-tabs span").eq(this.activeIndex).addClass('active')
            },
        },
    });
    $("#mainbox .zuankebatabs .rt-tabs span").on('click', function (e) {
        e.preventDefault();
        $("#mainbox .zuankebatabs .rt-tabs .active").removeClass('active');
        $(this).addClass('active');
        mySwiper.slideTo($(this).index())
    });
    $("#mainbox .zuankebatabs .rt-tabs span").hover(function (e) {
        e.preventDefault();
        $("#mainbox .zuankebatabs .rt-tabs .active").removeClass('active');
        $(this).addClass('active');
        mySwiper.slideTo($(this).index())
    });
    /* 值得买热帖 tab 为 JSON 异步渲染，DOMContentLoaded 时点居中会落空，渲染完成后补一次 */
    if (typeof xbNavScrollActive === "function") {
        var $rtAct = $("#mainbox .zuankebatabs .rt-tabs span.active").first();
        if ($rtAct.length) xbNavScrollActive($rtAct[0]);
    }
}

function rementie(config) {
    // 仅值得买热帖（zhidemai-hot）与慢慢买热帖（manmanmai-hot）走本函数（平台静态 JSON 数据源）；
    // 其他热帖页已服务端直出，meta.php 不调用本函数（防御：非白名单配置直接忽略）
    if (config !== "zhidemai-hot" && config !== "manmanmai-hot") return;
    if (lscache.supported()) {
        var cached = lscache.get(config);
        if (cached) {
            xb_retielist(cached, config);
            return;
        }
    }
    $.getJSON("/plus/json/rank/" + config + ".json", function (result, status) {
        if (status == "success") {
            lscache.set(config, result, 30 * 60);
            xb_retielist(result, config);
        }
    }).fail(function () {
        if (!$("#mainbox .retie-post").length && !$("#mainbox .xb-empty").length) {
            $("#mainbox").append('<div class="listbox sb mb"><div class="xb-empty"><b>' + xbT('rank_err', '热帖数据加载失败') + '</b><span class="sub">' + xbT('rank_err_sub', '网络异常或数据未生成，请稍后刷新重试') + '</span></div></div>');
        }
    })
}
$(function(){var pagealias=$(".pc-nav").attr("data-pagealias");if(pagealias&&pagealias.includes("-hot")){/* 激活态已由 rank-hot.php 服务端标（20261004 晚），JS 仅保留跳转与居中 */$('.rank-tabs span[data-tabs]').on('click',function(){var dataTabsValue=$(this).data('tabs');window.open("/"+dataTabsValue+".html","_self")});var $act=$('.rank-tabs span.active').first();if($act.length&&typeof xbNavScrollActive==='function'){xbNavScrollActive($act[0])}}});
$(function () {
    const currentURL = window.location.href;
    const pageType = currentURL.includes("weibo") ? "weibo" : 
                     currentURL.includes("zhidemai") ? "zhidemai" : 
                     currentURL.includes("manmanmai") ? "manmanmai" :
                     currentURL.includes("haodan") ? "haodan" : null;
    
    if (!pageType) return;

    const pagetype = $(".pc-nav").data("type");
    const pagename = $(".pc-nav").data("catename");
    const pagebiaoqian = $(".pc-nav").data("biaoqian") === "线报活动" ? "线报" : $(".pc-nav").data("biaoqian");
    const pageplatforms = $(".pc-nav").data("platforms");

    // 通用函数：设置活动标签
    function setActiveTabs() {
        if (pagetype === "category") {
            /* 一二级 tab 激活态已由 diy-weibo.php 服务端标（20261004 晚），JS 不再加 class */
        } else if (pagetype === "article") {
            /* 激活态已由 diy-weibo.php 服务端按文章分类/标签标（20261006），
               此处仅在服务端未标时按 biaoqian 文本兜底，避免出现双激活 */
            if ($('.tip-nav span.active').length) {
                return;
            }
            const biaoqianArray = pagebiaoqian.split('|');
            let hasActive = false;
            
            $('.tip-nav span').each(function () {
                if (biaoqianArray.includes($(this).text())) {
                    $(this).addClass("active");
                    hasActive = true;
                }
            });
            
            if (!hasActive) {
                $('.tip-nav span[data-tabs="index"]').addClass("active");
            }
        }
    }

    // 通用函数：处理标签点击事件
    function setupTabClickHandlers() {
        if (pagetype === "category") {
            $('.tip-nav span[data-tabs]').on('click', function () {
                const firstTabsValue = $(this).data('tabs');
                const secondTabsValue = $(".sort-row span.active").data('tabs');
                handleCategoryTabClick(firstTabsValue, secondTabsValue);
            });
            
            $('.sort-row span[data-tabs]').on('click', function () {
                const firstTabsValue = $(".tip-nav span.active").data('tabs');
                const secondTabsValue = $(this).data('tabs');
                handleCategoryTabClick(firstTabsValue, secondTabsValue, true);
            });
        } else if (pagetype === "article") {
            $('.tip-nav span[data-tabs]').on('click', function () {
                const firstTabsValue = $(this).data('tabs');
                if (firstTabsValue === "index") {
                    window.open(`/category-${pageType}/`, "_self");
                } else {
                    window.open(`/category-${pageType}-${firstTabsValue}/`, "_self");
                }
            });
        }
    }

    // 处理分类标签点击
    function handleCategoryTabClick(firstTabsValue, secondTabsValue, isSecondTab = false) {
        if (isSecondTab) {
            if (secondTabsValue === "tehuigou") {
                return window.open("/haodan/tehuigou.html", "_self");
            }
            if (secondTabsValue === "bendi") {
                return window.open("/haodan/bendi.html#?code=i1C4W8HL", "_self");
            }
        }

        let target = "";
        if (firstTabsValue === "index" && secondTabsValue === "index") {
            target = `/category-${pageType}/`;
        } else {
            let url = `/category-${pageType}`;
            if (firstTabsValue && firstTabsValue !== "index") url += `-${firstTabsValue}`;
            if (secondTabsValue && secondTabsValue !== "index") url += `-${secondTabsValue}`;
            target = `${url}/`;
        }
        // 值得买/微博/好单页动态筛选保留：切换一二级分类时携带当前 quick 条件
        //（仅非空参数；mall/cate 为值得买专用参数，频道页会忽略），与服务端 quick
        // 优先语义一致（分类切换只换路由，不丢动态筛选）
        if (pageType !== null) {
            const q = new URLSearchParams(window.location.search);
            const carry = new URLSearchParams();
            ["k", "kp", "mall", "cate", "mip", "mxp"].forEach(function (key) {
                const v = q.get(key);
                if (v) carry.set(key, v);
            });
            // 浏览器入口常用 q= 传关键词（k 的服务端别名）；这里统一归一为 k，
            // 否则 ?q=耳机 页切一二级分类时关键词掉参（20261011）
            if (!carry.get('k')) {
                const qv = q.get('q');
                if (qv) carry.set('k', qv);
            }
            const cs = carry.toString();
            if (cs) target += "?" + cs;
        }
        window.open(target, "_self");
    }

    // 通用函数：滑动导航栏（20261006 重写：委托 xbNavScrollActive 自动定位真实滚动容器
    // 并对齐屏幕中线——旧实现把 scrollLeft 设在 .tip-nav 上，而 .xb-navd 体系里滚动容器
    // 是其父级 .d-tabs，导致激活项从未滚入视野）
    function scrollNavToActive(navClass) {
        const $active = $(`${navClass} .active`).eq(0);
        if ($active.length && typeof xbNavScrollActive === "function") {
            xbNavScrollActive($active[0]);
        }
    }


    // 初始化
    setActiveTabs();
    setupTabClickHandlers();
    scrollNavToActive(".tip-nav");
    scrollNavToActive(".sort-row");
});
