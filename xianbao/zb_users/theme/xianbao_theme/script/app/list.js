/* 文案兜底（后台「站点信息 → 前端 JS 文案」经 meta.php 下发 window.xb_texts） */
function xbT(k, d) { return (window.xb_texts && window.xb_texts[k]) || d; }

/* 20261016 带宽优化：翻页片段 URL 工具。
 * add=true  给 IAS 的请求地址追加 xb_rows=1（服务端只回「列表行+分页条」片段）；
 * add=false 从历史 URL 里剥掉该参数——对外（地址栏/复制/前进后退）始终是干净的翻页地址。 */
function xb_rows_url(url, add) {
    var u = String(url == null ? '' : url);
    if (!u) { return u; }
    var hash = '';
    var hi = u.indexOf('#');
    if (hi >= 0) { hash = u.slice(hi); u = u.slice(0, hi); }
    if (add) {
        if (/([?&])xb_rows=/.test(u)) { return u + hash; }
        return u + (u.indexOf('?') === -1 ? '?' : '&') + 'xb_rows=1' + hash;
    }
    return u.replace(/([?&])xb_rows=[^&#]*/g, '$1').replace(/([?&])&+/g, '$1').replace(/[?&]+$/, '') + hash;
}
/*! app/list.js | 列表模块：无限加载(双按钮分页)/屏蔽筛选/关键词标红/时间渲染 | 依赖: InfiniteAjaxScroll, lscache, Swiper, core.listfilter */


/* IAS 分页公共骨架（ajaxpaging / xb_ajaxpaging 共用）：双按钮分页条 + InfiniteAjaxScroll 装配。
 * filterItems(el)->false 剔除该行；btns 为分页条 HTML（两调用方文案/样式不同，保持各自原样）；
 * 各事件行为两版完全一致：手动/自动加载、末页提示、翻页写 URL 历史、loading 条、nocache。
 * fanyeMode（20261006 Ucenter 自动翻页设置，meta.php 按设备端传入）：2=第二页起全部自动加载、
 * 3=第一页起自动加载（轮询已由 meta.php 停用）——两种模式都不渲染按钮、装配后立即开启滚动
 * 自动加载；1/未传=默认按钮行为不变。 */
function xb_ias_setup(btns, filterItems, redsign, fanyeMode) {
    var xb_auto = false, xb_busy = false;
    if (fanyeMode == 2 || fanyeMode == 3) {
        xb_auto = true;
    } else {
        $("#mainbox .pagebar").after(btns);
    }
    Scrolldata = [];
    Scrolldata.item = ".listbox .new-post li";
    Scrolldata.next = ".pagebar .nav-links .next a";
    Scrolldata.pagination = ".pagebar";
    Scrolldata.negativeMargin = 400;
    Scrolldata.logger = false;
    Scrolldata.prefill = true;
    let ias = new InfiniteAjaxScroll(".listbox .new-post", Scrolldata);
    ias.disableLoadOnScroll();
    if (xb_auto) { ias.enableLoadOnScroll(); }
    ias.on("append", function (event) {
        var newitems = [];
        for (var i = 0; i < event.items.length; i++) {
            if (event.items[i].classList[1] == "top") { continue; }
            if (filterItems(event.items[i]) !== false) { newitems.push(event.items[i]); }
        }
        event.items = newitems;
    });
    ias.on("appended", function () {
        xb_busy = false;
        $("#mainbox .loading").remove();
        if (!xb_auto) { $("#mainbox .xb-loadbtns").show(); }
        if (redsign) { list_red(redsign, "list"); }
    });
    ias.on("last", function () {
        xb_busy = false;
        $("#mainbox .loading").remove();
        $("#mainbox .xb-loadbtns").remove();
        $("#mainbox .listbox").after('<div class="pagination end">' + xbT('last_page', '已经是最后一页了') + '</div>');
    });
    ias.on("page", function (event) {
        if (event.title) { document.title = event.title; }
        // 历史 URL 必须回到干净的翻页地址：请求地址上附加的 xb_rows=1 只服务于传输优化
        history.replaceState(history.state, event.title, xb_rows_url(event.url, false));
    });
    ias.on("next", function () {
        $("#mainbox .xb-loadbtns").hide();
        $("#mainbox .listbox").after('<div class="pagination loading"><img src="/zb_users/theme/xianbao_theme/image/loading.gif"/></div>');
    });
    ias.on("load", function (event) {
        event.nocache = true;
        // 20261016 带宽优化：翻页只取列表片段（服务端 function/service_rows_fragment.php）。
        // 实测每次滚动整页 gzip 42.5KB → 片段 14.7KB（-65%）：报头/侧栏/页脚/内联脚本本就被
        // IAS 丢弃，白下。参数只加在请求地址上，不出现在可见链接与浏览器历史里。
        event.url = xb_rows_url(event.url, !!window.xb_rows_frag);
    });
    $("#mainbox .xb-loadbtns .xb-btn-manual").on("click", function () {
        if (xb_busy || xb_auto) { return; }
        xb_busy = true;
        ias.next();
    });
    $("#mainbox .xb-loadbtns .xb-btn-auto").on("click", function () {
        if (xb_auto) { return; }
        xb_auto = true;
        ias.enableLoadOnScroll();
        $("#mainbox .xb-loadbtns").hide();
        layer.msg(xbT('switched_auto', '已切换为滚动自动加载'));
    });
}

/* 普通线报列表下拉分页：行过滤走 core.listfilter（屏蔽分类/楼主/标题/内容/注册天数，
 * 实参由 meta.php 按 Ucenter 规则拼出），叠加全局筛选（window.xb_global_filter）追加剔除 */
function ajaxpaging(type,redsign,pingbifenlei,pingbilouzhu,zhanxianlouzhu,pingbilouzhuplus,pingbibiaoti,zhanxianbiaoti,pingbibiaotiplus,pingbineirong,zhanxianneirong,pingbineirongplus,pingbitime,fanyeMode){
    if($("#mainbox .listbox").length>0&&$("#mainbox .pagebar .nav-links .next a").length>0){
        xb_ias_setup('<div class="pagination xb-loadbtns" style="text-align:center;margin:15px 0;"><a href="javascript:;" class="xb-btn-manual">'+xbT('load_more','手动加载更多')+'</a><a href="javascript:;" class="xb-btn-auto">'+xbT('auto_off','自动加载：关')+'</a></div>',function(item){
            // 平台来源行（20261016 值得买；20261024 泛化到慢慢买）：外链条目无
            // data-catename/data-content/data-louzhu，站内语义的行过滤会把它们误杀 →
            // 直接放行（服务端已按同一套规则筛过，翻页追加无需再筛）
            var xbSrc0=(item&&item.getAttribute)?String(item.getAttribute('data-src')||''):'';
            if(xbSrc0==='zdm'||xbSrc0==='manmanmai'){return true}
            var field=[];
            field.catename=item.querySelector('a').dataset.catename;
            field.title=item.querySelector('a').getAttribute('title');
            field.content=item.querySelector('a').dataset.content;
            field.louzhu=item.querySelector('a').dataset.louzhu;
            if(listfilter(field,pingbifenlei,pingbilouzhu,zhanxianlouzhu,pingbilouzhuplus,pingbibiaoti,zhanxianbiaoti,pingbibiaotiplus,pingbineirong,zhanxianneirong,pingbineirongplus,pingbitime)==false){return false}
            var glbcfg=null;
            if(!(typeof xb_search_mode==="function"&&xb_search_mode())){
                glbcfg=(typeof xb_global_gate==="function")?xb_global_gate((typeof xb_global_main_scopes==="function")?xb_global_main_scopes():"主列表"):null;
            }
            if(glbcfg&&xb_global_shouldRemove(jQuery(item).find("p.title > a").first(),glbcfg)){return false}
            return true;
        },redsign,fanyeMode);
    }
}

/* ES 下推路径下拉分页（频道/值得买 DOM 带 data-price/type/brand 等字段）：行过滤走
 * list.xb_listfilter（xb_config 规则），redsign 标红与普通版同语义 */
function xb_ajaxpaging(type, redsign, xb_config, fanyeMode) {
    if ($("#mainbox .listbox").length > 0 && $("#mainbox .pagebar .nav-links .next a").length > 0) {
        xb_ias_setup('<div class="pagination xb-loadbtns" style="text-align:center;margin:15px 0;"><a href="javascript:;" class="xb-btn-manual">'+xbT('load_more','手动加载更多')+'</a><a href="javascript:;" class="xb-btn-auto">'+xbT('auto_off','自动加载：关')+'</a></div>', function (item) {
            var field = [];
            field.title = item.querySelector('a').getAttribute('title');
            field.price = item.querySelector('a').dataset.price;
            field.catename = item.querySelector('a').dataset.catename;
            field.type = item.querySelector('a').dataset.type;
            field.brand = item.querySelector('a').dataset.brand;
            field.mall_name = item.querySelector('a').dataset.mall_name;
            field.category_name = item.querySelector('a').dataset.category_name;
            field.louzhu = item.querySelector('a').dataset.louzhu || "";
            return xb_listfilter(field, xb_config) == true;
        }, redsign, fanyeMode);
    }
}




/* 猜你喜欢已由服务端直出（主题 function/service_sidebar.php xb_guesslike_block + plus/json/guesslike_lib.php），原 guesslikechuli/guesslike 前端拉取渲染于 20261004 移除；swiper 初始化与板块筛选/标红由 sidebar.js 接管 */




function liebiaoshaixuan(
    pingbifenlei, 
    pingbilouzhu, 
    zhanxianlouzhu, 
    pingbilouzhuplus, 
    pingbibiaoti, 
    zhanxianbiaoti, 
    pingbibiaotiplus, 
    pingbineirong, 
    zhanxianneirong, 
    pingbineirongplus, 
    pingbitime
) {
    $("#mainbox .new-post .article-list:not(.top) .title a").each(function() {
        var $thisElement = $(this); // 缓存 jQuery 对象，提高性能

        // 安全地获取 data 属性和文本，并提供默认值
        var shuzhu = {
            catename: ($thisElement.data("catename") || '').toString(),
            louzhu: ($thisElement.data("louzhu") || '').toString(),
            louzhuregtime: $thisElement.data("louzhuregtime"), // 这个不转字符串，保留原始类型
            title: ($thisElement.text() || '').toString(), // 虽然 text() 很少返回 undefined，但保险起见
            content: ($thisElement.data("content") || '').toString()
        };

        // 假设 listfilter 函数需要这些参数
        if (listfilter(
            shuzhu, 
            pingbifenlei, 
            pingbilouzhu, 
            zhanxianlouzhu, 
            pingbilouzhuplus, 
            pingbibiaoti, 
            zhanxianbiaoti, 
            pingbibiaotiplus, 
            pingbineirong, 
            zhanxianneirong, 
            pingbineirongplus, 
            pingbitime
        ) === false) {
            // 移除包含此链接的整个项目
            $thisElement.closest('.title').closest('li').remove(); // 或者根据实际HTML结构调整
        }
    });
}

function huanyuanurl(){$(".new-post .article-list:has(.cg18)").each(function(){var yuanurl=$(this).find("a").data("yuanurl");if(yuanurl){$(this).find("a").attr("href",yuanurl)}})};
// 标红词字面量转义（20260929 起标红词按原文高亮，不再解释为正则）
function xbRedEsc(s){return String(s).replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}
/* 关键词标红（作用于标题/正文的 HTML 字符串）。
 * 原实现用 lookbehind (?<!<span…>)(?<!<[^>]*) 排除「已标红段」与「标签内部」，
 * 但 lookbehind 需 Safari 16.4+：iOS 16.3 及以下执行到此抛 SyntaxError（标红失效）。
 * 改在 replace 回调里手工判上下文，语义等价且全版本可用。 */
function xbRedMark(html, keys) {
    var s = String(html == null ? '' : html);
    for (var i = 0; i < keys.length; i++) {
        var kw = keys[i];
        if (!kw) { continue; }
        var re = new RegExp('(' + xbRedEsc(kw) + ')(?!<\\/span>)(?![^<]*?>)', 'g');
        s = s.replace(re, function (match, p1, offset, str) {
            var before = str.slice(0, offset);
            var lt = before.lastIndexOf('<'), gt = before.lastIndexOf('>');
            if (lt > gt) { return match; }                                   // 位于未闭合标签内部
            if (/^span[^>]*>$/.test(before.slice(lt + 1))) { return match; }  // 紧跟完整 <span…> 开标签
            return '<span style="color: red;font-weight:bold;">' + p1 + '</span>';
        });
    }
    return s;
}
function list_red(a,quyu){if(quyu=="list"){yuansu="#mainbox .listbox .new-post a"}else if(quyu=="bangdan"){yuansu=".celan .bangdan .new-post a"}else if(quyu=="xiangguan"){yuansu=".xiangguan .new-post a"}else{return}var seach_redarr=a.split(/[|#]+/);$(yuansu).each(function(){var text=$(this).text();for(j=0;j<seach_redarr.length;j++){if(seach_redarr[j]){text=text.replace(new RegExp(xbRedEsc(seach_redarr[j]),"g"),'<span style="color: red;font-weight:bold;">'+seach_redarr[j]+"</span>")}}$(this).html(text)})}
function haodan_red(a){var seach_redarr=a.split(/[|#]+/);$(".haodan-list .detail-block li").each(function(){if($(this).html().match(new RegExp(/button/),"g")){}else{var text=$(this).text();for(j=0;j<seach_redarr.length;j++){if(seach_redarr[j]){text=text.replace(new RegExp(xbRedEsc(seach_redarr[j]),"g"),'<span style="color: red;font-weight:bold;">'+seach_redarr[j]+"</span>")}}$(this).html(text)}})}
$(function () {
    if (window.location.href.indexOf("search.php") > 0) {
        if (getQueryVariable("cate") == "haodan") {
            haodan_red(getQueryVariable("q"))
        } else {
            let keywords = new Set();
            $('.article-list a em').each(function () {
                    keywords.add($(this).text());
            });
            
            let uniqueKeywords = Array.from(keywords).join('|');
            if (uniqueKeywords) {
                $(".listbox .new-post a").each(function () {
                    $(this).attr("href", $(this).attr("href") + "?key_red=" + uniqueKeywords)
                })
            }
        }
    }
})

function art_red(a) {
    var seach_redarr = a.split(/[|#]+/).filter(Boolean); // 过滤掉空字符串

    // 处理标题
    var titleElement = $(".art-title");
    var titleText = titleElement.html(); // 使用 html() 以保留 HTML 标签

    // 标红标题中的关键词，避免重复处理（词按原文转义后拼接，特殊符号按普通字符高亮）
    titleText = xbRedMark(titleText, seach_redarr);
    titleElement.html(titleText);

    // 处理文章内容
    var contentElement = $(".article-content");
    var html = contentElement.html();

    // 保存链接、alt 和 title
    var link_list = [];
    var link_list2 = [];
    var alt_list = [];
    var title_list = [];

    // 替换链接、alt 和 title
    html = html.replace(/<a[^>]*>(.*?)<\/a>/g, function (match) {
        link_list.push(match);
        return "<{link}>";
    });

    html = html.replace(/(http|ftp|https):\/\/[\w\-_]+(\.[\w\-_]+)+([\w\-\.,@?^=%&:/~\+#;]*[\w\-\@?^=%&/~\+#])?/g, function (match) {
        link_list2.push(match);
        return "<{link2}>";
    });

    html = html.replace(/alt="([^"]*)"/g, function (match) {
        alt_list.push(match);
        return "<{alt}>";
    });

    html = html.replace(/title="([^"]*)"/g, function (match) {
        title_list.push(match);
        return "<{title}>";
    });

    // 标红内容中的关键词，避免重复处理（词按原文转义后拼接）
    html = xbRedMark(html, seach_redarr);

    // 恢复链接、alt 和 title
    link_list.forEach(function (link) {
        html = html.replace(/<{link}>/, link);
    });
    
    link_list2.forEach(function (link2) {
        html = html.replace(/<{link2}>/, link2);
    });

    alt_list.forEach(function (alt) {
        html = html.replace(/<{alt}>/, alt);
    });

    title_list.forEach(function (title) {
        html = html.replace(/<{title}>/, title);
    });

    contentElement.html(html);
}


$(function(){var key_red=getQueryVariable("key_red");if(key_red){art_red(key_red)}})
/* 列表行时间徽章（今天=HH:MM 红 / 昨天=昨日短日期 / 今年内=M-D / 其余=全日期），
 * listtimechuli 与 xb_listtimechuli 共用 */
function xb_time_badge(datetime, shorttime) {
    const d = new Date(), dz = new Date(Date.now() - 1000 * 60 * 60 * 24);
    const today = `${d.getFullYear()}-${add0(d.getMonth() + 1)}-${add0(d.getDate())}`;
    const yest = `${dz.getFullYear()}-${add0(dz.getMonth() + 1)}-${add0(dz.getDate())}`;
    const title = `${datetime} ${shorttime}`;
    if (datetime === today) {
        return `<time class="badge red" datetime="${datetime}" title="${title}">${shorttime}</time>`;
    }
    if (datetime === yest) {
        return `<time class="badge" datetime="${datetime}" title="${title}">${add0(dz.getMonth() + 1)}-${add0(dz.getDate())} ${shorttime}</time>`;
    }
    if (typeof datetime === 'string' && datetime.startsWith(today.substring(0, 4))) {
        return `<time class="badge" datetime="${datetime}" title="${title}">${datetime.substring(5, 12)}</time>`;
    }
    return `<time class="badge" datetime="${datetime}" title="${title}">${datetime}</time>`;
}

/* 热门题材火焰徽章：48h 内发布且标题命中热标签集合（window.xbHotTags，meta.php 下发），
 * 两个行渲染函数共用 */
function xb_hot_badge(title, posttime) {
    if (!Array.isArray(window.xbHotTags) || !window.xbHotTags.length) { return ''; }
    const ts = Number(posttime) || 0;
    if (!ts || ts < Date.now() / 1000 - 3600 * 48) { return ''; }
    const plain = String(title || '').replace(/<\/?em>/gi, '');
    for (const h of window.xbHotTags) {
        if (plain.indexOf(h.t) !== -1) {
            return `<span class="badge xb-hot" title="该题材近48小时新发 ${h.c} 篇"><svg class="xb-hot-ic" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-flame"></use></svg></span>`;
        }
    }
    return '';
}

function listtimechuli(myCars, opts) {
    // opts（可选）：figure=true 行首注入分类小图标（cg{cateid}，对齐正式站）；
    // catBadge=false 不输出右侧分类文字标签（猜你喜欢用：有图标后文字标签冗余）；
    // hot=true 轮询行也做热门题材火焰匹配（数据源 window.xbHotTags，meta.php 下发）。
    // 默认都不变（不注图标、保留标签）：排行榜板块与热帖页调用方不传 opts，行为原样
    opts = opts || {};
    const showFigure = !!opts.figure;
    const showCatBadge = opts.catBadge !== false;

    let myCars_data = "";

    $.each(myCars, function (i, field) {
        const yuanurl = field.cateid === 18 && field.yuanurl ? ` data-yuanurl="${field.yuanurl}"` : ''; // 判断是否有原网址
        const timebiaoqian = xb_time_badge(field.datetime, field.shorttime);
        // 微博(10)/好单(30)：好单价格>0 时价格替代评论位（价格取 data-price，仅作筛选
        // 依据与评论位占位判定；20261013 起不再渲染右侧价格徽章——标题本身已含价格）
        const c10 = String(field.cateid) === '10', c30 = String(field.cateid) === '30';
        const rmbOk = (c10 || c30) && field.price !== undefined && field.price !== '' && Number(field.price) > 0;

        if (field.title) {
            var cleanTitle = field.title.replace(/<\/?em>/gi, '');
            var catShort = String(field.catename || '').split('-')[0] || '';
            myCars_data += '<li class="article-list' + (field._xb_istop ? ' top' : '') + '">' +
                (showFigure && field.cateid !== undefined && field.cateid !== null && String(field.cateid) !== '' ? '<span class="figure cg' + field.cateid + '"></span>' : '') +
                '<p class="title">' +
                    (opts.hot ? xb_hot_badge(field.title, field.posttime) : '') +
                    '<a href="' + field.url + '" title="' + cleanTitle + '" target="_blank" ' +
                      'data-catename="' + field.catename + '" data-content="' + field.content + '" ' +
                      'data-comments="' + field.comments + '" data-louzhu="' + field.louzhu + '" ' +
                      'data-louzhuregtime="' + field.louzhuregtime + '"' + yuanurl + '>' +
                        field.title +
                    '</a>' +
                    (showCatBadge && catShort ? '<span class="badge-cat">' + catShort + '</span>' : '') +
                    (!(c30 && rmbOk) ? '<span class="badge com">' +
                        '<svg class="xb-ic" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-comment"></use></svg>' + field.comments +
                    '</span>' : '') +
                    timebiaoqian +
                '</p>' +
            '</li>';
        }
    });

    return myCars_data;
}


// 值得买(cateid=19)专用渲染：与上方 listtimechuli（常规线报列表）分工不同——本函数输入
// posttime 时间戳、输出 data-price/type/brand 等商品字段结构，rank.js 热帖与值得买下拉刷新复用
// opts（可选）：figure=true 行首注入分类小图标（cg{cateid}；push_19.json 与热帖静态 JSON 的
// zdm 条目均无 cateid 字段，此时兜底 cg19——本函数仅服务值得买系页面）；hot=true 热门题材火焰；
// 不传行为不变（热帖页 rank.js 不注图标）。
// 20261013 起不再输出右侧价格徽章（.badge.rmb）——价格只保留 data-price 供筛选下推用；
// 值得买系标题的价格由 zhidemai-hot.php 生成 JSON 时补全（见该文件补价注释）
function xb_listtimechuli(myCars, opts) {
    opts = opts || {};
    const showFigure = !!opts.figure;
    // srcZdm：值得买轮询行打 data-src="zdm"（关注位值得买轮询用——与 post-multi.php
    // 直出的值得买行同标记，站内语义消费方〔全局筛选/已读〕按它跳过外链行；值得买
    // 频道页沿用老行为不打该属性）
    // srcMark（20261024 泛化）：任意平台来源行标记，值=注册前缀（如 manmanmai）——
    // 关注位纯慢慢买轮询下发 srcMark:"manmanmai"，输出 data-src="manmanmai"。
    // 两者同语义，srcMark 带值时优先。
    const srcZdmAttr = opts.srcMark ? ' data-src="' + String(opts.srcMark).replace(/"/g, '') + '"' : (opts.srcZdm ? ' data-src="zdm"' : '');
    // figureCate：figure 图标的兜底分类号（条目无 cateid 时用；值得买默认 19，慢慢买 32）
    const figureCate = (opts.figureCate !== undefined && opts.figureCate !== null && String(opts.figureCate) !== '') ? opts.figureCate : 19;
    // badgeCat：行内分类角标文案（值得买系默认「值得买」，慢慢买传「慢慢买」）
    const badgeCat = opts.badgeCat || '值得买';

    let myCars_data = "";

    $.each(myCars, function (i, field) {
        let posttime = new Date(field.posttime * 1000);
        field.datetime = `${posttime.getFullYear()}-${add0(posttime.getMonth() + 1)}-${add0(posttime.getDate())}`;
        field.shorttime = `${posttime.getHours()}:${add0(posttime.getMinutes())}`;
        const timebiaoqian = xb_time_badge(field.datetime, field.shorttime);

        if (field.title) {
            myCars_data += '<li class="article-list' + (field._xb_istop ? ' top' : '') + '"' + srcZdmAttr + '>' +
                (showFigure ? '<span class="figure cg' + (field.cateid !== undefined && field.cateid !== null && String(field.cateid) !== '' ? field.cateid : figureCate) + '"></span>' : '') +
                '<p class="title">' +
                (opts.hot ? xb_hot_badge(field.title, field.posttime) : '') +
                '<a href="' + field.url + '" title="' + field.title + '" target="_blank" ' +
                'data-type="' + field.type + '" ' +
                'data-brand="' + field.brand + '" ' +
                'data-mall_name="' + field.mall_name + '" ' +
                'data-category_name="' + field.category_name + '" ' +
                'data-price="' + field.price + '">' + field.title +
                '</a>' +
                '<span class="badge-cat">' + badgeCat + '</span>' +
                timebiaoqian +
                '</p>' +
                '</li>';
        }

    });

    return myCars_data;
}

function xbh_channel_split(catename, channel) {
    var xb_res = { category: "", mall: "" };
    // 前缀来源（20261024）：优先 meta.php 下发的 window.xb_channel_guard.catPrefix
    // （分类注册表 name 派生，新增频道自动生效）；旧静态映射保留为兜底。
    var xb_prefix = "";
    if (window.xb_channel_guard && window.xb_channel_guard.catPrefix) {
        xb_prefix = String(window.xb_channel_guard.catPrefix);
    } else if (channel === "weibo") {
        xb_prefix = "微博线报-";
    } else if (channel === "haodan") {
        xb_prefix = "好单线报-";
    }
    if (!catename || !xb_prefix || String(catename).indexOf(xb_prefix) !== 0) {
        return xb_res;
    }
    var xb_rest = String(catename).substring(xb_prefix.length);
    var xb_idx = xb_rest.lastIndexOf("-");
    if (xb_idx === -1) {
        xb_res.category = xb_rest;
    } else {
        xb_res.category = xb_rest.substring(0, xb_idx);
        xb_res.mall = xb_rest.substring(xb_idx + 1);
    }
    return xb_res;
}

// 我的关注页推送守卫：读 window.xb_guanzhu_recall（meta.php 注入），按用户召回条件
// 判定推送条目——keywords 逐词 contains 匹配 标题+分类+内容（与我的关注 ES 召回
// title+content 口径一致，内容换行拼接防跨边界误匹配）、authors 匹配 楼主、excludes
// 任一命中即丢弃；组合语义与 BuildQuery 一致：keywords+authors 并存时 AND=全部关键词
// 命中且作者命中、OR/NOT 默认=任一命中；仅 keywords 时 AND=全部、OR=任一。
// 无该对象（未注入）放行；非法正则 try/catch 跳过该词，不中断主流程
function guanzhu_push_guard(item) {
    var gz_cfg = window.xb_guanzhu_recall;
    if (!gz_cfg || typeof gz_cfg !== "object") {
        return true;
    }
    var gz_toArr = function (v) {
        return Object.prototype.toString.call(v) === "[object Array]" ? v : [];
    };
    var gz_kws = gz_toArr(gz_cfg.keywords);
    var gz_aus = gz_toArr(gz_cfg.authors);
    var gz_exs = gz_toArr(gz_cfg.excludes);
    var gz_text = String((item && item.title) || "") + String((item && item.catename) || "") + "\n" + String((item && item.content) || "");
    var gz_author = String((item && (item.louzhu || item.author)) || "");
    var gz_i, gz_hit, gz_valid, gz_all;
    // 排除词：任一命中即丢弃（20260929 起字面量匹配，词内特殊符号按普通字符处理）
    for (gz_i = 0; gz_i < gz_exs.length; gz_i++) {
        if (gz_exs[gz_i] && xb_kwHit(gz_exs[gz_i], gz_text)) {
            return false;
        }
    }
    // 关键词命中统计（空词跳过）
    gz_hit = false; gz_valid = 0; gz_all = true;
    for (gz_i = 0; gz_i < gz_kws.length; gz_i++) {
        if (!gz_kws[gz_i]) { continue; }
        gz_valid++;
        if (xb_kwHit(gz_kws[gz_i], gz_text)) { gz_hit = true; } else { gz_all = false; }
    }
    var gz_kwHit = gz_hit, gz_kwValid = gz_valid, gz_kwAll = gz_all;
    // 作者命中统计
    gz_hit = false; gz_valid = 0; gz_all = true;
    for (gz_i = 0; gz_i < gz_aus.length; gz_i++) {
        if (!gz_aus[gz_i]) { continue; }
        gz_valid++;
        if (xb_kwHit(gz_aus[gz_i], gz_author)) { gz_hit = true; } else { gz_all = false; }
    }
    var gz_auHit = gz_hit, gz_auValid = gz_valid;
    if (gz_kwValid === 0 && gz_auValid === 0) {
        return true; // 无有效召回条件 → 放行
    }
    if (gz_kwValid > 0 && gz_auValid > 0) {
        if (gz_cfg.operator === "AND") {
            return gz_kwAll && gz_auHit; // AND：全部关键词命中且作者命中
        }
        return gz_kwHit || gz_auHit; // OR/NOT 默认：任一组命中
    }
    if (gz_kwValid > 0) {
        return gz_cfg.operator === "AND" ? gz_kwAll : gz_kwHit;
    }
    return gz_auHit; // 仅作者：任一命中
}

// 字面量关键词命中（20260929 全站筛选正则下线）：
// 按 #/|/<br>/换行 分割为词（# 为主分隔符，| 兼容历史数据），逐词原文包含匹配
// （indexOf，区分大小写，与旧 RegExp contains 的大小写行为一致）；"#"/"|"仅作
// 分隔符，词内 . ? + 等特殊符号按普通字符处理（消灭灾难性回溯/配置歧义）；
// 空词跳过（防空串恒命中）。分割结果按原文缓存，避免列表/推送逐条重复 split
var xb_kwCache = {};
function xb_kwHit(pattern, text) {
    pattern = String(pattern === undefined || pattern === null ? "" : pattern);
    text = String(text === undefined || text === null ? "" : text);
    var words = xb_kwCache[pattern];
    if (!words) {
        words = [];
        var parts = pattern.split(/\||#|<br>|\r\n|\r|\n/);
        for (var p = 0; p < parts.length; p++) {
            var w = parts[p].replace(/^\s+|\s+$/g, "");
            if (w !== "") { words.push(w); }
        }
        xb_kwCache[pattern] = words;
    }
    for (var i = 0; i < words.length; i++) {
        if (text.indexOf(words[i]) !== -1) { return true; }
    }
    return false;
}

// 字面量「完全相等」命中（20261021，作者/楼主维度专用）：
// 分割口径与 xb_kwHit 完全一致，但每个词与 text 做整串相等比较（不再 indexOf 包含）。
// 用于「屏蔽某个作者」——屏蔽 ab 不应连带屏蔽 abc / xab（站长 20261021 反馈的误伤）。
// 与后端 xb_kw_hit_exact / 推送引擎 xbpush_word_match_exact 同一口径；不支持通配符。
var xb_kwExactCache = {};
function xb_kwHitExact(pattern, text) {
    pattern = String(pattern === undefined || pattern === null ? "" : pattern);
    text = String(text === undefined || text === null ? "" : text).replace(/^\s+|\s+$/g, "");
    if (pattern === "" || text === "") { return false; }
    var words = xb_kwExactCache[pattern];
    if (!words) {
        words = [];
        var parts = pattern.split(/\||#|<br>|\r\n|\r|\n/);
        for (var p = 0; p < parts.length; p++) {
            var w = parts[p].replace(/^\s+|\s+$/g, "");
            if (w !== "") { words.push(w); }
        }
        xb_kwExactCache[pattern] = words;
    }
    for (var i = 0; i < words.length; i++) {
        if (text === words[i]) { return true; }
    }
    return false;
}

// xb_checkMatches 的字面量版（20260929 起全站统一字面量匹配，正则版已删除）：
// 三段判定表与旧版一致。供微博/好单频道分支、值得买分支与我的关注分支共用
function xb_checkMatchesLit(item_gjc, item_pbc, groupValue) {
    var gjcStr = String(item_gjc === undefined || item_gjc === null ? "" : item_gjc).replace(/^\s+|\s+$/g, "");
    var pbcStr = String(item_pbc === undefined || item_pbc === null ? "" : item_pbc).replace(/^\s+|\s+$/g, "");
    var gjcMatches = gjcStr !== "" && xb_kwHit(gjcStr, groupValue);
    var pbcMatches = pbcStr !== "" && xb_kwHit(pbcStr, groupValue);
    if (gjcMatches && pbcMatches) {
        return true;
    }
    if (gjcStr !== "" && !gjcMatches) {
        return true;
    }
    if (pbcStr !== "" && pbcMatches) {
        return true;
    }
}

// 作者维度三段判定（完全匹配版，20261021）：
// 判定表与 xb_checkMatchesLit 完全一致，仅把匹配器换成 xb_kwHitExact——作者名按
// 「整串相等」比对。**只用于楼主字段（louzhu_gjc / louzhu_pbc）**，标题/分类/商城
// 仍走 xb_checkMatchesLit（子串语义）。与后端 xb_kw_matches_exact 同口径。
function xb_checkMatchesExact(item_gjc, item_pbc, groupValue) {
    var gjcStr = String(item_gjc === undefined || item_gjc === null ? "" : item_gjc).replace(/^\s+|\s+$/g, "");
    var pbcStr = String(item_pbc === undefined || item_pbc === null ? "" : item_pbc).replace(/^\s+|\s+$/g, "");
    var gjcMatches = gjcStr !== "" && xb_kwHitExact(gjcStr, groupValue);
    var pbcMatches = pbcStr !== "" && xb_kwHitExact(pbcStr, groupValue);
    if (gjcMatches && pbcMatches) {
        return true;
    }
    if (gjcStr !== "" && !gjcMatches) {
        return true;
    }
    if (pbcStr !== "" && pbcMatches) {
        return true;
    }
}


// （20260929 正则版 xb_checkMatches 已删除：全站统一走 xb_checkMatchesLit 字面量匹配）


/* 匹配范围（title_scope，20261013）：all = 关键词/屏蔽词一起比对标题+内容（默认，旧行为）；
   split = 分开筛，词可加 `标题:`/`内容:` 前缀指定只比对哪一边（无前缀词仍按标题+内容）。
   判定与后端 xb_scope_mode/xb_scope_words/xb_kw_matches_scoped（easysearch_common.php）
   1:1 同语义——改这里必须成对改 PHP，否则出现"服务端筛掉了前端还显示"。 */

// 规则行匹配范围：缺键/非法值一律 all（老规则零迁移）
function xb_scope_mode(row) {
    var m = (row && row.title_scope !== undefined && row.title_scope !== null) ? String(row.title_scope).replace(/^\s+|\s+$/g, "") : "";
    return m === "split" ? "split" : "all";
}

// 字段词分桶：#、|、换行（含 <br>）分词后按 标题:/内容: 前缀分到 title/content 两桶，
// 无前缀词进 both 桶；空前缀（单独一个"标题:"）不匹配正则、原样作为字面量词
function xb_scope_words(text) {
    var out = { title: [], content: [], both: [] };
    var arr = String(text === undefined || text === null ? "" : text).split(/\||#|<br>|\r\n|\r|\n/);
    for (var i = 0; i < arr.length; i++) {
        var w = arr[i].replace(/^\s+|\s+$/g, "");
        if (w === "") { continue; }
        var scope = "both", body = w;
        var m = w.match(/^(标题|内容)[:：]\s*(.+)$/);
        if (m) { scope = (m[1] === "标题") ? "title" : "content"; body = m[2].replace(/^\s+|\s+$/g, ""); }
        out[scope].push(body);
    }
    return out;
}

// 行级分桶词缓存（与 xb_global_row_words 同款：首次拆桶写回 row._sw 复用）
function xb_scope_row_words(row) {
    if (row && row._sw) { return row._sw; }
    var gt = function (v) { return String(v === undefined || v === null ? "" : v).replace(/^\s+|\s+$/g, ""); };
    var w = { tG: xb_scope_words(gt(row.title_gjc)), tP: xb_scope_words(gt(row.title_pbc)) };
    try { row._sw = w; } catch (e) {}
    return w;
}

// 分桶词表任一词在文本中字面命中
function xb_scope_hit(ws, text) {
    for (var i = 0; i < ws.length; i++) {
        if (String(text).indexOf(ws[i]) !== -1) { return true; }
    }
    return false;
}

// 关键词/屏蔽词三段判定（匹配范围版）：判定表与 xb_checkMatchesLit 完全一致
// （返回 true=淘汰），仅被测文本随模式变化——all：整串、split：按桶分测（任一侧命中即算命中）
function xb_kwScopedFail(G, P, title, content, mode) {
    title = String(title === undefined || title === null ? "" : title);
    content = String(content === undefined || content === null ? "" : content);
    var gh, ph;
    if (mode === "split") {
        var both = title + "\n" + content;
        var sg = G || { title: [], content: [], both: [] };
        var sp = P || { title: [], content: [], both: [] };
        gh = (xb_scope_hit(sg.title, title) || xb_scope_hit(sg.content, content) || xb_scope_hit(sg.both, both));
        ph = (xb_scope_hit(sp.title, title) || xb_scope_hit(sp.content, content) || xb_scope_hit(sp.both, both));
    } else {
        var text = title + "\n" + content;
        gh = (G && G.length > 0 && xb_kwHit(G, text));
        ph = (P && P.length > 0 && xb_kwHit(P, text));
    }
    if (gh && ph) { return true; }
    if (G && !gh && xb_scope_field_has_words(G)) { return true; }
    if (P && ph && xb_scope_field_has_words(P)) { return true; }
    return false;
}

// 字段是否有词：兼容"拆词数组"（all 模式）与"分桶对象"（split 模式）两种形态
function xb_scope_field_has_words(f) {
    if (!f) { return false; }
    if (f.title !== undefined || f.content !== undefined || f.both !== undefined) {
        return !!((f.title && f.title.length) || (f.content && f.content.length) || (f.both && f.both.length));
    }
    return !!(f.length);
}

// 规则行标题组是否淘汰（供各分支复用）：$mode==='split' 时按分桶判定，否则沿用旧整串口径
// 规则行标题组是否淘汰（供各分支复用）：split 时按 标题:/内容: 分桶判定，否则沿用
// 旧整串口径。返回 true=淘汰、false=保留（xb_checkMatchesLit 无命中时返回 undefined，
// 这里显式归一为 false，避免各调用点 continue 判定落空）
function xb_row_title_fail(row, gjcRaw, pbcRaw, title, content) {
    if (xb_scope_mode(row) === "split") {
        return xb_kwScopedFail(
            xb_scope_words(gjcRaw === undefined || gjcRaw === null ? "" : gjcRaw),
            xb_scope_words(pbcRaw === undefined || pbcRaw === null ? "" : pbcRaw),
            title, content, "split"
        );
    }
    return xb_checkMatchesLit(gjcRaw, pbcRaw, String(title) + "\n" + String(content)) === true;
}

// 值得买条目规则行判定（20261016b，镜像服务端 easysearch_zdm.php zdm_php_postfilter）：
// rule=source=zdm 的启用行（词表口径 title_gjc/title_pbc/category_gjc/category_pbc/
// mall_gjc/mall_pbc/Miprice/Mxprice），doc=值得买条目（push_19 feed 项 / DOM 外链行）。
// 字段对应：标题→doc.title（无正文，content 恒空）、类目→doc.category_name、
// 商城→doc.mall_name、价格→doc.price（缺价按 0，与服务端 (float)($doc['price'] ?? 0)
// 同口径）。返回 true=该行通过（展示），false=该行淘汰。行间 OR 由调用方循环。
// 楼主/正文维度不存在（值得买语料无此数据），与服务端一致不参与判定。
function xb_zdm_row_pass(rule, doc) {
    if (!rule || !doc) { return false; }
    if (String(doc.type === undefined || doc.type === null ? "" : doc.type) !== "smzdm") { return false; }
    // 价格：规则侧非数值视为无约束（isFinite 守卫）；条目缺价/非数值按 0
    var zMipRaw = (rule.Miprice === undefined || rule.Miprice === null) ? "" : String(rule.Miprice).replace(/^\s+|\s+$/g, "");
    var zMxpRaw = (rule.Mxprice === undefined || rule.Mxprice === null) ? "" : String(rule.Mxprice).replace(/^\s+|\s+$/g, "");
    var zPrice = Number(doc.price === undefined || doc.price === null || doc.price === "" ? 0 : doc.price);
    if (!isFinite(zPrice)) { zPrice = 0; }
    if (zMipRaw !== "" && isFinite(Number(zMipRaw)) && zPrice < Number(zMipRaw)) { return false; }
    if (zMxpRaw !== "" && isFinite(Number(zMxpRaw)) && zPrice > Number(zMxpRaw)) { return false; }
    // 标题组：doc 标题非空才校验（与服务端 $docTitle && 守卫同构；split 模式下
    // 「内容:」前缀词在值得买语料恒不命中，与后端同口径）
    var zTitle = (doc.title === undefined || doc.title === null) ? "" : String(doc.title);
    if (zTitle !== "") {
        if (xb_row_title_fail(rule, rule.title_gjc, rule.title_pbc, zTitle, "")) { return false; }
    }
    // 类目组（doc.category_name 原始路径 + doc.tags feed 中文标签，如
    // "电脑数码/手机通讯/手机|数码|运动"；旧文档/DOM 行无 tags 时退化为仅
    // category_name，与服务端 zdm_php_postfilter 同构）
    var zCat = (doc.category_name === undefined || doc.category_name === null) ? "" : String(doc.category_name);
    var zTags = (doc.tags === undefined || doc.tags === null) ? "" : String(doc.tags);
    var zCatSubject = zCat + (zTags !== "" ? (zCat !== "" ? "|" : "") + zTags : "");
    if (zCatSubject !== "" && xb_checkMatchesLit(rule.category_gjc, rule.category_pbc, zCatSubject)) { return false; }
    // 商城组（doc.mall_name，如 "天猫精选"）
    var zMall = (doc.mall_name === undefined || doc.mall_name === null) ? "" : String(doc.mall_name);
    if (zMall !== "" && xb_checkMatchesLit(rule.mall_gjc, rule.mall_pbc, zMall)) { return false; }
    return true;
}


function xb_listfilter(group, xb_config) {
    const xb_arr = Object.values(xb_config);

    // 无启用规则（空配置或全部行 Status!==1）→ 不筛选展示全部：
    // 循环内 Status!==1 只 continue，若无此兜底会走到 return false，把列表/拉新整体清空
    // （与"未设置规则走默认配置"语义一致；服务端 meta.php 亦只注入启用行，此为双保险）
    if (!xb_arr.some((item) => item.Status === 1)) {
        return true;
    }

    // 微博线报(10)/好单线报(30)频道分支：推送项带 cateid，DOM 项带 data-catename
    // （"微博线报-标签-平台"）。字段语义与服务端 xbh_php_postfilter 1:1 对齐：
    // 标题=文章标题、分类=catename 中段、商城=catename 尾段；价格区间约束存在时
    // 无价条目排除（DOM data-price=""），推送项无 price 字段（undefined）跳过价格约束
    // 频道判定（20261024）：优先 meta.php 下发的 window.xb_channel_guard.channel
    // （新增频道自动生效）；cateid/catename 静态映射保留为兜底（guard 未注入的场景）。
    var xb_channel = "";
    if (window.xb_channel_guard && window.xb_channel_guard.channel) {
        xb_channel = String(window.xb_channel_guard.channel);
    }
    if (!xb_channel && group.cateid !== undefined && group.cateid !== null && String(group.cateid) !== "") {
        if (String(group.cateid) === "10") {
            xb_channel = "weibo";
        } else if (String(group.cateid) === "30") {
            xb_channel = "haodan";
        }
    }
    if (!xb_channel && group.catename) {
        var xb_cn = String(group.catename);
        if (xb_cn.indexOf("微博线报") === 0) {
            xb_channel = "weibo";
        } else if (xb_cn.indexOf("好单线报") === 0) {
            xb_channel = "haodan";
        }
    }

    for (const item of xb_arr) {
        if (item.Status !== 1) {
            continue;
        }

        // 我的关注页分支（window.xb_page_flag==='guanzhu'，meta.php 注入）：语义与
        // 服务端 guanzhu_postfilter 1:1 对齐——价格（规则带区间时无价条目排除；DOM
        // data-price="" 与推送项无 price 字段均视为无价，与 0 区分）→ 标题 → 分类
        // （完整 catename contains，与服务器端一致）→ 商城（推送项 platforms 优先，
        // 回退 catename 尾段）→ 楼主；行间 OR（任一行通过即保留），全空行直通。
        // 须先于频道分支判定：关注页含微博/好单条目（catename 带频道前缀），若落入
        // 频道分支会按"中段/尾段"语义错配
        if (window.xb_page_flag === "guanzhu") {
            // 条目来源分流（20261016b）：值得买条目（push_19 值得买 feed / DOM 外链行，
            // type=smzdm）与本站条目各有各的判定规则，同一条规则行只判自己那一路来源
            // ——纯值得买位轮询值得买 feed 时，本站条目在此恒不通过（无本站行可判），
            // 彻底消除"值得买关注位混入本站文章"。
            if (String(group.type === undefined || group.type === null ? "" : group.type) === "smzdm") {
                // 值得买条目：只认 source=zdm 的启用行，走值得买语义（镜像服务端
                // easysearch_zdm.php zdm_php_postfilter：标题/类目/商城/价格）
                if (String(item.source === undefined || item.source === null ? "" : item.source) !== "zdm") {
                    continue;
                }
                if (xb_zdm_row_pass(item, group)) {
                    return true;
                }
                continue;
            }
            // 本站条目：值得买来源行不参与本站条目判定（混合位里两种来源各判各的，
            // 与服务端 guanzhu_slot_search 混合分支"本站侧只喂本站规则行"同口径）
            if (String(item.source === undefined || item.source === null ? "" : item.source) === "zdm") {
                continue;
            }
            // 轮询注入 gating（meta.php 注入 xb_guanzhu_poll_on）：仅登录且该关注位有
            // 自定义召回时开启；游客/未设置用户不注入默认召回内容（页面显示引导空态）
            if (window.xb_guanzhu_poll_on !== 1) {
                continue;
            }
            var gz_priceRaw = (group.price === undefined || group.price === null) ? "" : String(group.price);
            var gz_price = (gz_priceRaw !== "" && isFinite(Number(gz_priceRaw))) ? Number(gz_priceRaw) : null;
            var gz_title = (group.title === undefined || group.title === null) ? "" : String(group.title);
            var gz_catename = String(group.catename || group.category_name || "");
            var gz_mall = String(group.platforms || "");
            if (gz_mall === "") {
                var gz_dash = gz_catename.lastIndexOf("-");
                if (gz_dash !== -1) {
                    gz_mall = gz_catename.substring(gz_dash + 1);
                }
            }
            var gz_louzhu = String(group.louzhu || group.author || "");
            var gz_mipRaw = (item.Miprice === undefined || item.Miprice === null) ? "" : String(item.Miprice).trim();
            var gz_mxpRaw = (item.Mxprice === undefined || item.Mxprice === null) ? "" : String(item.Mxprice).trim();
            var gz_mip = (gz_mipRaw !== "" && isFinite(Number(gz_mipRaw))) ? Number(gz_mipRaw) : null;
            var gz_mxp = (gz_mxpRaw !== "" && isFinite(Number(gz_mxpRaw))) ? Number(gz_mxpRaw) : null;
            var gz_tGjc = (item.title_gjc === undefined || item.title_gjc === null) ? "" : String(item.title_gjc);
            var gz_tPbc = (item.title_pbc === undefined || item.title_pbc === null) ? "" : String(item.title_pbc);
            var gz_cGjc = (item.category_gjc === undefined || item.category_gjc === null) ? "" : String(item.category_gjc);
            var gz_cPbc = (item.category_pbc === undefined || item.category_pbc === null) ? "" : String(item.category_pbc);
            var gz_mGjc = (item.mall_gjc === undefined || item.mall_gjc === null) ? "" : String(item.mall_gjc);
            var gz_mPbc = (item.mall_pbc === undefined || item.mall_pbc === null) ? "" : String(item.mall_pbc);
            var gz_lGjc = (item.louzhu_gjc === undefined || item.louzhu_gjc === null) ? "" : String(item.louzhu_gjc);
            var gz_lPbc = (item.louzhu_pbc === undefined || item.louzhu_pbc === null) ? "" : String(item.louzhu_pbc);
            // 全约束字段皆空的行 → 空行直通（展示全部，与服务端语义一致）
            if (gz_mip === null && gz_mxp === null && gz_tGjc.trim() === "" && gz_tPbc.trim() === ""
                && gz_cGjc.trim() === "" && gz_cPbc.trim() === "" && gz_mGjc.trim() === "" && gz_mPbc.trim() === ""
                && gz_lGjc.trim() === "" && gz_lPbc.trim() === "") {
                return true;
            }
            // 价格：行带数值边界即有价格约束，无价条目该行不通过；有价须满足区间（空界不限制）
            if (gz_mip !== null || gz_mxp !== null) {
                if (gz_price === null) {
                    continue;
                }
                if (gz_mip !== null && gz_price < gz_mip) {
                    continue;
                }
                if (gz_mxp !== null && gz_price > gz_mxp) {
                    continue;
                }
            }
            if (gz_title !== "" && xb_row_title_fail(item, gz_tGjc, gz_tPbc, gz_title, "")) {
                continue;
            }
            if (gz_catename !== "" && xb_checkMatchesLit(gz_cGjc, gz_cPbc, gz_catename)) {
                continue;
            }
            // 商城/楼主空值语义：字段为空时——行带 gjc 该行不通过，仅 pbc 直接通过
            if (gz_mall === "") {
                if (gz_mGjc.trim() !== "") {
                    continue;
                }
            } else if (xb_checkMatchesLit(gz_mGjc, gz_mPbc, gz_mall)) {
                continue;
            }
            if (gz_louzhu === "") {
                if (gz_lGjc.trim() !== "") {
                    continue;
                }
            } else if (xb_checkMatchesExact(gz_lGjc, gz_lPbc, gz_louzhu)) {
                continue;
            }
            return true;
        }

        if (xb_channel) {
            var xb_segs = xbh_channel_split(group.catename, xb_channel);
            var xb_mip = (item.Miprice !== undefined && item.Miprice !== null && String(item.Miprice) !== "") ? Number(item.Miprice) : null;
            var xb_mxp = (item.Mxprice !== undefined && item.Mxprice !== null && String(item.Mxprice) !== "") ? Number(item.Mxprice) : null;
            if (xb_mip !== null || xb_mxp !== null) {
                // 价格语义（20260928 调整，与后端 xbh_php_postfilter 1:1）：仅对有价格的
                // 条目校验区间——频道线报大量无价格，原"无价排除"会把"价格≤30"类规则
                // 下的列表裁到接近空（用户投诉 /category-weibo/ 数据为空）；无价格视为
                // 不限放行。值得买 zdm 分支保持"无价排除"不变（商品价格为核心属性）
                var xb_p = (group.price === undefined || group.price === null) ? "" : String(group.price);
                var xb_pn = Number(xb_p);
                if (xb_p !== "" && isFinite(xb_pn)) {
                    if ((xb_mip !== null && xb_pn < xb_mip) || (xb_mxp !== null && xb_pn > xb_mxp)) {
                        continue;
                    }
                }
            }
            // 标题关键词匹配文本 = 标题 + 内容（换行拼接防关键词跨"标题/内容"边界
            // 误匹配，标题 OR 内容任一命中即命中），与后端 ES 下推/PHP 精筛口径 1:1；
            // 两者皆空时跳过标题检查（组直通语义不变）
            var xb_cTitle = String(group.title || "");
            var xb_cContent = String(group.content || "");
            if (xb_cTitle !== "" || xb_cContent !== "") {
                if (xb_row_title_fail(item, item.title_gjc, item.title_pbc, xb_cTitle, xb_cContent)) {
                    continue;
                }
            }
            if (xb_segs.category !== "" && xb_checkMatchesLit(item.category_gjc, item.category_pbc, xb_segs.category)) {
                continue;
            }
            if (xb_segs.mall !== "" && xb_checkMatchesLit(item.mall_gjc, item.mall_pbc, xb_segs.mall)) {
                continue;
            }
            // 楼主组：规则行带楼主词时空楼主排除（推送项自带 louzhu / DOM data-louzhu），
            // 与服务端 xbh_php_postfilter 的 reallink 水合精筛语义一致
            var xb_lz = (group.louzhu === undefined || group.louzhu === null) ? "" : String(group.louzhu);
            var xb_hasLzRule = (item.louzhu_gjc && String(item.louzhu_gjc) !== "") || (item.louzhu_pbc && String(item.louzhu_pbc) !== "");
            if (xb_hasLzRule) {
                if (xb_lz === "" || xb_checkMatchesExact(item.louzhu_gjc, item.louzhu_pbc, xb_lz)) {
                    continue;
                }
            }
            return true;
        }

        // 平台条目（值得买 type=smzdm / 慢慢买 type=manmanmai）：共用同一套平台语义
        // （标题/类目/商城/价格；两平台表字段同构），非平台条目（无类型）在此丢弃
        var xb_platType = String(group.type === undefined || group.type === null ? "" : group.type);
        if (xb_platType !== "smzdm" && xb_platType !== "manmanmai") {
            // console.log("非平台条目不符合")
            continue;
        }
        
        if (group.mall_name && item.mall_name && !xb_kwHit(item.mall_name, group.mall_name)) {
            // console.log("商城不符合")
            continue;
        }
        
        
        if ((item.Miprice !== "" && group.price!== "" && Number(group.price) < Number(item.Miprice)) || (item.Mxprice !== "" && group.price!== "" && Number(group.price) > Number(item.Mxprice))) {
                // console.log("价格不符合"+group.title+group.price)
            continue;
        }

        // 标题关键词匹配文本 = 标题 + 内容（换行拼接，与频道分支/后端 PHP 精筛口径
        // 一致）；zdm 数据源暂无内容字段（已知限制，DOM 亦无 data-content）→ 拼接为
        // 空串，行为与旧版"仅标题"完全一致
        var zdm_tTitle = String(group.title || "");
        var zdm_tContent = String(group.content || "");
        if (zdm_tTitle !== "" || zdm_tContent !== "") {
            // zdm 数据源无 content 字段（DOM 亦无 data-content）：split 模式下「内容:」
            // 前缀词在 zdm 频道永远无法命中（与后端 zdm_php_postfilter 同口径）
            if (xb_row_title_fail(item, item.title_gjc, item.title_pbc, zdm_tTitle, zdm_tContent)) {
                // console.log("标题不符合")
                continue;
            }
        }

        if (group.category_name && xb_checkMatchesLit(item.category_gjc, item.category_pbc, group.category_name)) {
            // console.log("分类不符合")
            continue;
        }
        return true;
    }
    return false;
}




function xb_liebiaoshaixuan(xb_config) {
    $("#mainbox .new-post .article-list:not(.top) .title a").each(function () {
        var shuzhu = {
            title: $(this).text().toString(),
            // 内容取 data-content（post-multi.php 输出的 HTML 转义文本）；zdm 条目无
            // 该属性 → 空串，配合 xb_listfilter"标题+内容"换行拼接判定，行为不变
            content: $(this).attr('data-content') ? $(this).attr('data-content').toString() : '',
            price: $(this).data("price"),
            catename: $(this).attr('data-catename') ? $(this).attr('data-catename').toString() : '',
            type: $(this).attr('data-type') ? $(this).attr('data-type').toString() : '',
            brand: $(this).attr('data-brand') ? $(this).attr('data-brand').toString() : '',
            mall_name: $(this).attr('data-mall_name') ? $(this).attr('data-mall_name').toString() : '',
            category_name: $(this).attr('data-category_name') ? $(this).attr('data-category_name').toString() : '',
            tags: $(this).attr('data-tags') ? $(this).attr('data-tags').toString() : '',
            louzhu: $(this).attr('data-louzhu') ? $(this).attr('data-louzhu').toString() : ''
        };
        
        if (xb_listfilter(shuzhu, xb_config) == false) {
            $(this).parent().parent().remove();
        }
    });
}


/* ==================== 全局筛选（Ucenter「网站筛选设置-全局筛选」前台兜底） ====================
 * 消费 window.xb_global_filter（meta.php 注入，结构定义）：
 *   {status: 0|1, bankuai: ['板块名',...], louzhuregtime: 'N',
 *    rows: [{fanwei,title_gjc,title_pbc,category_gjc,category_pbc,louzhu_gjc,louzhu_pbc}],
 *    legacy: {kw: 0|1, keywords: ['词',...], fanwei: ['分类名',...]}}
 *   - status!=1 或变量不存在 → 全局筛选未启用，直接返回
 *   - bankuai 空数组 = 不限制（旧 Meta 已随表单下线，恒为空，仅保留结构）
 *   - louzhuregtime 空串 = 不限
 *   - 范围枚举（20260929）：首页 / 分类页 / 分类页:分类名（指定分类页）/ 排行榜 /
 *     我的关注 / 猜你喜欢；旧值 主列表（=首页+分类页）/ 推送 / 侧栏我的关注（=我的
 *     关注）/ 热榜 仍兼容；scope 支持字符串或 token 数组
 *   - 规则行 fanwei = 该行生效范围（多词|分隔，任一词命中当前范围 token 即适用，留空=全部板块）
 * 语义：
 *   - bankuai 非空且不含当前 scope → 该板块不启用全局筛选（直接返回）
 *   - rows 先按板块预筛（见 xb_global_gate），预筛后非空 → 行间 OR 保留：条目被任一
 *     适用行通过才保留，全部不通过 → 移除（行判定见 xb_global_row_pass）；预筛后为空
 *     （没有任何行声明当前板块）→ 本板块直通，避免板块间规则互相清空
 *   - rows 空且 legacy.kw==1（旧键兜底）→ 屏蔽语义：keywords 任一词命中标题（a 的
 *     title/text）、内容（data-content）或楼主（data-louzhu）→ 移除（字面量 indexOf
 *     包含，不做正则；多词 OR）；legacy.fanwei 非空时仅对 data-catename 命中任一
 *     分类名（子串包含匹配，'豆瓣' 命中所有豆瓣子组、'买组' 命中'豆瓣线报-买组'）的条目生效
 *   - louzhuregtime 非空且条目 data-louzhuregtime 存在且注册天数 < 设置值 → 移除
 *     （语义与 listfilter 的 pingbitime 一致，daysComputed 定义于 comment.js）
 * 条目结构：li.article-list > p.title > a（主列表/猜你喜欢/排行榜/侧栏均同构），
 * 移除方式与现有代码一致：a.parent().parent()（即 li） */

// 拆词：#、|、换行（含 <br>）均作分隔，去空（字面量 indexOf 匹配，无正则）
function xb_global_words(text) {
    var out = [];
    var arr = String(text === undefined || text === null ? "" : text).split(/\||#|<br>|\r\n|\r|\n/);
    for (var i = 0; i < arr.length; i++) {
        var w = arr[i].replace(/^\s+|\s+$/g, "");
        if (w !== "") { out.push(w); }
    }
    return out;
}

// 行级拆词缓存（20260929 性能优化）：与 meta.php xb_row_words 同构，首条目拆词后
// 写回 row._w 复用，避免 15 行×100 词×60 条目场景下每条目重复 split（实测最坏 ≈113ms）
function xb_global_row_words(row) {
    if (row && row._w) { return row._w; }
    var gt = function (v) { return String(v === undefined || v === null ? "" : v).replace(/^\s+|\s+$/g, ""); };
    var w = {
        tG: xb_global_words(gt(row.title_gjc)), tP: xb_global_words(gt(row.title_pbc)),
        cG: xb_global_words(gt(row.category_gjc)), cP: xb_global_words(gt(row.category_pbc)),
        lG: xb_global_words(gt(row.louzhu_gjc)), lP: xb_global_words(gt(row.louzhu_pbc))
    };
    try { row._w = w; } catch (e) {}
    return w;
}

// 规则行通过判定（$a：条目 a 的 jQuery 对象，row：k_global/k_globallist 规则行）：true = 该行通过。
// 板块范围（row.fanwei）不在此判定：已由 xb_global_gate 按当前 scope 预筛（空=全板块，
// 非空须等值命中当前板块名），此处只做六个内容字段 + 价格区间。
// 行通过条件（全部满足）：title_gjc 空或命中（title+"\n"+data-content）、title_pbc 空或
// 不命中、category_gjc 空或命中分类名、category_pbc 空或不命中、louzhu_gjc 空或命中楼主、
// louzhu_pbc 空或不命中楼主、Miprice/Mxprice 区间命中（仅约束有 data-price 的条目，无价
// 放行，与 meta.php xb_row_pass/后端行精筛 20260928 调整同语义）；
// 七组字段全空直通（与 xb_row_pass/后端行精筛同语义）
// 平台外链行判定（20261016 值得买；20261024 泛化到慢慢买）：主列表模板把标记打在 li
// （post-multi.php 平台行分支 data-src="zdm"/"manmanmai"），侧栏卡片行打在 a
// （service_sidebar.php xb_side_render_rows）——两处都认，供行过滤/全局筛选统一跳过
// （外链条目没有 catename/louzhu/正文，站内语义判不了）
function xb_row_is_platform($a) {
    if (!$a || !$a.length) { return false; }
    var PLAT = { "zdm": 1, "manmanmai": 1 };
    if (PLAT[String($a.attr("data-src") || "")]) { return true; }
    var $li = $a.closest("li.article-list");
    return !!($li.length && PLAT[String($li.attr("data-src") || "")]);
}

function xb_global_row_pass($a, row) {
    var gt = function (v) { return String(v === undefined || v === null ? "" : v).replace(/^\s+|\s+$/g, ""); };
    // 平台来源行（20261016 值得买；20261024 泛化到慢慢买）：站内语义（catename/louzhu/正文）判不了外链条目 → 放行
    // （后端 xb_global_filter_docs 侧同口径，见 service_sidebar/plus/json/guanzhu.php）
    if (xb_row_is_platform($a)) { return true; }
    var tG = gt(row.title_gjc), tP = gt(row.title_pbc), cG = gt(row.category_gjc), cP = gt(row.category_pbc), lG = gt(row.louzhu_gjc), lP = gt(row.louzhu_pbc);
    // 价格区间（20261001 global/globallist 行新增维度）：空值/非数值视为无约束
    var mp = row.Miprice, mx = row.Mxprice;
    var mip = (mp === undefined || mp === null || gt(mp) === "" || !isFinite(Number(mp))) ? null : Number(mp);
    var mxp = (mx === undefined || mx === null || gt(mx) === "" || !isFinite(Number(mx))) ? null : Number(mx);
    var catename = String($a.attr("data-catename") || "");
    if (tG === "" && tP === "" && cG === "" && cP === "" && lG === "" && lP === "" && mip === null && mxp === null) { return true; }
    var W = xb_global_row_words(row); // 行级拆词缓存（首次拆词后写回 row._w）
    var kwHit = function (ws, text) {
        for (var i = 0; i < ws.length; i++) {
            if (String(text).indexOf(ws[i]) !== -1) { return true; }
        }
        return false;
    };
    var rowFail = function (G, P, text) {
        var gh = G.length > 0 && kwHit(G, text), ph = P.length > 0 && kwHit(P, text);
        if (gh && ph) { return true; }
        if (G.length > 0 && !gh) { return true; }
        if (P.length > 0 && ph) { return true; }
        return false;
    };
    // 作者维度完全匹配版（20261021）：判定表同 rowFail，仅把逐词 indexOf 换成整串相等。
    // 楼主词只比楼主名，屏蔽 ab 不应连带 abc / xab（与后端 xb_kw_matches_exact 同口径）。
    var exactHit = function (ws, text) {
        for (var i = 0; i < ws.length; i++) {
            if (String(text) === ws[i]) { return true; }
        }
        return false;
    };
    var rowFailExact = function (G, P, text) {
        var gh = G.length > 0 && exactHit(G, text), ph = P.length > 0 && exactHit(P, text);
        if (gh && ph) { return true; }
        if (G.length > 0 && !gh) { return true; }
        if (P.length > 0 && ph) { return true; }
        return false;
    };
    var title = String($a.attr("title") || $a.text() || "");
    var content = String($a.attr("data-content") || "");
    var louzhu = String($a.attr("data-louzhu") || "");
    // 标题组：匹配范围（title_scope）为 split 时按 标题:/内容: 前缀分桶判定，否则旧整串口径
    if ((tG !== "" || tP !== "") && xb_row_title_fail(row, tG, tP, title, content)) { return false; }
    if ((cG !== "" || cP !== "") && rowFail(W.cG, W.cP, catename)) { return false; }
    if (lG !== "" || lP !== "") { if (louzhu === "" || rowFailExact(W.lG, W.lP, louzhu)) { return false; } }
    // 价格区间：仅对有价格条目校验（无价放行，与频道分支/后端同语义）；价格取 data-price
    // （微博/好单由模板输出，首页条目由 meta.php 价格提取 IIFE 从标题补齐，其余板块无价为空放行）
    if (mip !== null || mxp !== null) {
        var pr = String($a.attr("data-price") || "");
        var pn = (pr !== "" && isFinite(Number(pr))) ? Number(pr) : null;
        if (pn !== null && ((mip !== null && pn < mip) || (mxp !== null && pn > mxp))) { return false; }
    }
    return true;
}

// 页面级排除（20261002）：站内搜索页（/search.php 与首页 quick 搜索 /?k=...）与楼主记录页
// （/record/模式/楼主.html）不应用全局列表筛选——服务端（ES 下推不含这两类页面，前台 DOM
// 过滤也不应干预搜索/楼主维度结果）与用户端（仅本地过滤、不占服务器，同样不参与）均排除。
// 由 xb_global_gate_cfg 单点判断，两个版本全部板块一次挡住（gate 返回 null 即直通）。
function xb_global_page_excluded() {
    try {
        var p = window.location.pathname || "";
        var s = window.location.search || "";
        if (p === "/search.php" || (p === "/" && s.indexOf("k=") !== -1)) { return true; }
        if (p.indexOf("/record/") === 0) { return true; }
        // 标签聚合页（viewtagcore，/tag-词/，20261012）：服务端已按标签词召回，聚合结果
        // 不受 Ucenter 筛选管控（k_global fanwei=首页 行曾经 xb_global_main_scopes
        // 兜底 token 命中 tag 页删行）——与搜索页同语义，全部板块一次挡住
        if (p.indexOf("/tag-") === 0) { return true; }
    } catch (e) { /* 异常时按不排除处理 */ }
    return false;
}
window.xb_global_page_excluded = xb_global_page_excluded;

// 板块门控（cfg 泛化版）：返回生效的 cfg；未启用/该板块不在 bankuai/无任何约束 → null（直通）
// cfg 结构兼容两种来源：服务端全局筛选 window.xb_global_filter（bankuai/legacy/louzhuregtime 键
// 全量）与用户端 window.xb_global_fe_filter（仅 status/rows——bankuai/legacy/louzhuregtime 为
// undefined 时对应分支自然休眠，与"仅前台本地过滤"语义一致）
// scope 支持字符串或 token 数组（如首页页 ["主列表","首页"]、分类页 ["主列表","分类页",
// "分类页:分类名"]）：row.fanwei 词任一等值命中任一 token 即适用（20260929 新增
// 首页/分类页/我的关注 token，旧 token 主列表/侧栏我的关注/热榜/推送仍兼容）
function xb_global_gate_cfg(cfg, scope) {
    if (xb_global_page_excluded()) { return null; } // 搜索页/楼主页页面级排除（两个版本全板块）
    if (!cfg || Number(cfg.status) !== 1) { return null; }
    var scopes = (typeof scope === "string") ? [scope] : (scope && scope.length ? scope : [String(scope || "")]);
    if (cfg.bankuai && cfg.bankuai.length) {
        var bkHit = false;
        for (var b = 0; b < cfg.bankuai.length && !bkHit; b++) {
            for (var si = 0; si < scopes.length; si++) {
                if (cfg.bankuai[b] === scopes[si]) { bkHit = true; break; }
            }
        }
        if (!bkHit) { return null; }
    }
    var rawRows = (cfg.rows && cfg.rows.length) ? cfg.rows : null;
    // 行级板块预筛：row.fanwei 空 = 该行全板块生效；非空须任一词等值命中当前范围 token。
    // 预筛后无任何适用行 → 行模式在本板块不生效（直通），避免不同板块的规则互相清空
    var rows = null;
    if (rawRows) {
        rows = [];
        for (var r = 0; r < rawRows.length; r++) {
            var fw = String(rawRows[r].fanwei === undefined || rawRows[r].fanwei === null ? "" : rawRows[r].fanwei).replace(/^\s+|\s+$/g, "");
            if (fw === "") { rows.push(rawRows[r]); continue; }
            var fwWords = xb_global_words(fw);
            var fwHit = false;
            for (var i = 0; i < fwWords.length && !fwHit; i++) {
                for (var sj = 0; sj < scopes.length; sj++) {
                    if (fwWords[i] === scopes[sj]) { fwHit = true; break; }
                    // 分类页 token 的宽松命中：词带"分类页:"前缀或裸词均可（子串包含）——
                    // "分类页:微博"/"微博" 命中 "分类页:微博线报"；"买组"命中"豆瓣线报-买组"（不用精准分类名）
                    var ftk = String(scopes[sj]);
                    if (ftk.indexOf("分类页:") === 0) {
                        var ftn = ftk.slice(4), fwv = String(fwWords[i]);
                        if (fwv.indexOf("分类页:") === 0) {
                            var fwn = fwv.slice(4);
                            if (fwn !== "" && ftn.indexOf(fwn) !== -1) { fwHit = true; break; }
                        } else if (fwv !== "" && ftn.indexOf(fwv) !== -1) { fwHit = true; break; }
                    }
                }
            }
            if (fwHit) { rows.push(rawRows[r]); }
        }
        if (rows.length === 0) { rows = null; }
    }
    var legacy = cfg.legacy || {};
    var legacyOn = !rawRows && Number(legacy.kw) === 1;
    var hasKw = legacyOn && !!(legacy.keywords && legacy.keywords.length);
    var hasFw = legacyOn && !!(legacy.fanwei && legacy.fanwei.length);
    var lzRaw = (cfg.louzhuregtime === undefined || cfg.louzhuregtime === null) ? "" : String(cfg.louzhuregtime);
    var hasLz = lzRaw !== "" && isFinite(Number(lzRaw));
    if (!rows && !hasKw && !hasFw && !hasLz) { return null; } // 无任何约束，直通
    return {
        rows: rows,
        keywords: hasKw ? legacy.keywords : null,
        fanwei: hasFw ? legacy.fanwei : null,
        louzhuregtime: hasLz ? Number(lzRaw) : null
    };
}

// 服务端全局筛选门控包装：cfg 固定取 window.xb_global_filter
function xb_global_gate(scope) {
    return xb_global_gate_cfg(window.xb_global_filter, scope);
}

// 单条目判定（$a：li.article-list > p.title > a 的 jQuery 对象）：true = 应移除。
// rows 非空 → 行间 OR 保留（无任一行通过即移除）；否则 legacy 屏蔽语义（fanwei 未
// 命中直通 return false，keywords OR 任一命中 → true）；louzhuregtime 两模式均追加
function xb_global_shouldRemove($a, cfg) {
    // 平台来源行（20261016 值得买；20261024 泛化到慢慢买）：不参与站内语义的全局筛选，返回 false=不剔除（后端同口径）
    if (xb_row_is_platform($a)) { return false; }
    if (cfg.rows && cfg.rows.length) {
        var keep = false;
        for (var r = 0; r < cfg.rows.length; r++) {
            if (xb_global_row_pass($a, cfg.rows[r])) { keep = true; break; }
        }
        if (!keep) { return true; }
    } else {
        var catename = String($a.attr("data-catename") || "");
        if (cfg.fanwei) {
            var fwHit = false;
            for (var f = 0; f < cfg.fanwei.length; f++) {
                if (catename.indexOf(String(cfg.fanwei[f])) !== -1) { fwHit = true; break; }
            }
            if (!fwHit) { return false; }
        }
        if (cfg.keywords) {
            var title = String($a.attr("title") || $a.text() || "");
            var content = String($a.attr("data-content") || "");
            var louzhu = String($a.attr("data-louzhu") || "");
            for (var k = 0; k < cfg.keywords.length; k++) {
                var kw = String(cfg.keywords[k]);
                if (kw === "") { continue; }
                if (title.indexOf(kw) !== -1 || content.indexOf(kw) !== -1 || louzhu.indexOf(kw) !== -1) {
                    return true;
                }
            }
        }
    }
    if (cfg.louzhuregtime !== null) {
        var regRaw = String($a.attr("data-louzhuregtime") || "");
        if (regRaw !== "") {
            var regDays = null;
            if (typeof daysComputed === "function") {
                regDays = daysComputed(regRaw); // 与 listfilter pingbitime 同源
            } else {
                var regTs = new Date(regRaw.replace(/-/g, "/")).getTime();
                regDays = isFinite(regTs) ? parseInt((Date.now() - regTs) / 86400000, 10) : null;
            }
            if (regDays !== null && regDays < cfg.louzhuregtime) { return true; }
        }
    }
    return false;
}

// 全局过滤主入口（cfg 泛化版）：group = jQuery 集合/元素数组经 jQuery 包装/选择器，cfg 由门控产出
function xb_global_listfilter_cfg(group, cfg) {
    if (!cfg) { return; }
    var $items = (group && group.jquery) ? group : jQuery(group);
    if (!$items || $items.length === 0) { return; }
    $items.each(function () {
        var $li = jQuery(this);
        if ($li.prop("tagName") !== "LI") {
            // 传入集合粒度应为 li.article-list：非 li（如误传 a/ul）时收敛到所属 li
            $li = $li.closest("li.article-list");
            if ($li.length === 0) { return; }
        }
        var $a = $li.find("p.title > a").first();
        if ($a.length === 0) { return; }
        // 置顶文章豁免（li.article-list.top：模板 post-istop 或榜单渲染 _xb_istop 输出）
        // —"ES 必定输出置顶"，全局筛选不移除置顶
        if ($li.hasClass("top")) { return; }
        if (xb_global_shouldRemove($a, cfg)) {
            $a.parent().parent().remove(); // 与现有 liebiaoshaixuan 移除模式一致（a→p.title→li）
        }
    });
    // 主列表作用域：筛选后可能全空 → 兜底提醒（非主列表作用域不触发）
    if ($items.closest("#mainbox .listbox").length > 0) {
        xb_global_blank_hint();
    }
}
window.xb_global_listfilter_cfg = xb_global_listfilter_cfg;

// 拦截全站兜底提醒（20261004 晚）：主列表行被全局筛选/用户端筛选全部移除且页面无
// 服务端空态卡时，提示返回用户中心检查设置（行恢复时自动移除；防抖 250ms）
var xb_blankHintTimer = null;
function xb_global_blank_hint() {
    if (xb_blankHintTimer) { clearTimeout(xb_blankHintTimer); }
    xb_blankHintTimer = setTimeout(function () {
        xb_blankHintTimer = null;
        var $box = jQuery("#mainbox .listbox").first();
        if (!$box.length) { return; }
        var $hint = $box.children(".xb-empty.xb-blankhint");
        if ($box.find("li.article-list").length > 0) { $hint.remove(); return; }
        if ($box.find(".xb-empty").length > 0) { return; } // 服务端已渲染空态（引导/暂无）
        if (!$hint.length) {
            jQuery('<div class="xb-empty xb-blankhint"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-inbox"></use></svg><b>内容可能已被您的筛选规则全部拦截</b><span class="sub">网站内容正常，请返回 <a href="/Ucenter#/Shezhi_guanzhu" target="_blank" rel="nofollow">用户中心</a> 检查筛选设置</span></div>').appendTo($box);
        }
    }, 250);
}

// 服务端全局筛选主入口：cfg 取 xb_global_gate(window.xb_global_filter)
function xb_global_listfilter(group, scope) {
    xb_global_listfilter_cfg(group, xb_global_gate(scope));
}
window.xb_global_listfilter = xb_global_listfilter;

// 全局列表筛选·用户端主入口（20261001 新增）：cfg 取 window.xb_global_fe_filter，
// 仅浏览器本地 DOM 过滤（服务端 ES/MySQL 零消费，词判定/置顶豁免/fanwei scope 预筛与
// 服务端全局筛选同语义）；未启用（变量不存在/status!=1/本板块无适用行）时内部直通
function xb_global_fe_listfilter(group, scope) {
    xb_global_listfilter_cfg(group, xb_global_gate_cfg(window.xb_global_fe_filter, scope));
}
window.xb_global_fe_listfilter = xb_global_fe_listfilter;

// 搜索模式判定（20261005）：URL 带搜索/筛选参数（q/k/kp/mip/mxp 任一非空）时主列表
// 不执行用户中心筛选（k_global 全局筛选 / k_globallist 全局列表筛选，初始点位与 IAS
// 追加行同门控）——搜索结果只由搜索词/价格决定；与服务端 xbh_search_docs_ex 搜索模式
// 不叠 k_global 行配套。非搜索场景（正常浏览/榜单/侧栏）不受影响
function xb_search_mode() {
    var q = new URLSearchParams(String(location.search || ""));
    return !!(q.get("k") || q.get("kp") || q.get("mip") || q.get("mxp") || q.get("q"));
}
window.xb_search_mode = xb_search_mode;

// 主列表初始点位（首页/普通页/文章页）：频道页（xb_page_flag + xb_config）主列表已由
// xb_config 规则过滤，跳过全局过滤避免双重 remove；下拉/其他板块点位不受影响照常执行
function xb_global_mainfilter() {
    if (xb_search_mode()) { return; }
    if (window.xb_page_flag && window.xb_config) { return; }
    xb_global_listfilter("#mainbox .listbox .new-post .article-list", xb_global_main_scopes());
}

// 用户端主列表初始点位（20261001）：用户端词不参与服务端下推（含频道页），故所有列表页
// （含频道页）都需本地过滤；与频道页 xb_config 的服务端词过滤（xb_listfilter）语义正交、
// 互不重复（前者剔用户端词，后者剔服务端词），与 xb_global_mainfilter 的防双杀逻辑独立
function xb_global_fe_mainfilter() {
    if (xb_search_mode()) { return; }
    if (!window.xb_global_fe_filter) { return; }
    xb_global_fe_listfilter("#mainbox .listbox .new-post .article-list", xb_global_main_scopes());
}
window.xb_global_fe_mainfilter = xb_global_fe_mainfilter;

// 主列表当前页范围 token（20260929：区分首页与分类页，支持"指定分类页"范围）
//   首页            → ["主列表","首页"]
//   分类页 /xxx/    → ["主列表","分类页","分类页:页面名"]（页面名取标题"-"前缀，如 赚客吧）
//   榜单页 /xx-hot.html → ["排行榜"]（总榜单/频道热帖/分类热贴：服务端 k_global 叠加口径即
//                     "排行榜"（rank_query_filter 尾部），主列表兜底点位同口径——否则
//                     fanwei=首页 的规则会被误应用到榜单页，行先渲染后 JS 删=闪一下）
//   文章页等无列表页 → 同首页（无条目，实际不产生过滤）
function xb_global_main_scopes() {
    var xbp = String(location.pathname || "");
    if (/^\/category-[a-z-]+(?:\/\d+)?\/?$/.test(xbp)) {
        var scopes = ["主列表", "分类页"];
        // 标题各段均生成"分类页:段"token：单级分类（赚客吧-线报酷→赚客吧）与
        // 频道-子分类（值得买-食品-线报酷→值得买、食品）都能被"分类页:分类名"命中
        var segs = String(document.title || "").split("-");
        for (var gi = 0; gi < segs.length; gi++) {
            var gseg = segs[gi].replace(/^\s+|\s+$/g, "");
            if (gseg !== "" && scopes.indexOf("分类页:" + gseg) < 0) { scopes.push("分类页:" + gseg); }
        }
        return scopes;
    }
    if (/-hot\.html$/.test(xbp)) { return ["排行榜"]; }
    return ["主列表", "首页"];
}
window.xb_global_mainfilter = xb_global_mainfilter;

// 自执行兜底：meta.php 的 $(function(){}) 在本文件 ready 回调之后执行（defer 顺序），
// window.xb_global_filter / xb_page_flag / xb_config 均在其内赋值，故推迟到所有
// ready 回调结束后（setTimeout 0）再跑主列表初始点位；该过滤幂等，与 meta.php
// 侧的显式调用（如有）重复执行无副作用
jQuery(function () { setTimeout(xb_global_mainfilter, 0); });
// 用户端主列表初始点位同款延迟执行（window.xb_global_fe_filter 在 meta.php ready 回调内赋值）
jQuery(function () { setTimeout(xb_global_fe_mainfilter, 0); });
