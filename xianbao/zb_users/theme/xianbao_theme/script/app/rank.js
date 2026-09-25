/*! app/rank.js | 排行榜模块：榜单渲染/热帖/榜单Tab/微博分类标签 | 依赖: lscache, Swiper, core.listfilter, list.listtimechuli */
function retiechuli(cars,shuliang,sortkey,pingbifenlei,pingbilouzhu,zhanxianlouzhu,pingbibiaoti,zhanxianbiaoti,pingbineirong,zhanxianneirong,pingbitime){zuanCars=[];var dangqian=0;var bangdingshu=shuliang;$.each(cars,function(i,field){if(listfilter(field,pingbifenlei,pingbilouzhu,zhanxianlouzhu,pingbibiaoti,zhanxianbiaoti,pingbineirong,zhanxianneirong)==false){return true}zuanCars.push(field);dangqian++;if(dangqian==bangdingshu){return false}});if(sortkey!="1"){zuanCars=sortByKey(zuanCars,"shijianchuo","desc")}var adddata=listtimechuli(zuanCars);if(adddata){adddata='<div class="swiper-slide"><ul class="new-post">'+adddata+'</ul></div>';return adddata}}
function retielist(result,config,sortkey,pingbifenlei,pingbilouzhu,zhanxianlouzhu,pingbibiaoti,zhanxianbiaoti,pingbineirong,zhanxianneirong,pingbitime){var zuandata6=retiechuli(result.remen6,30,sortkey,pingbifenlei,pingbilouzhu,zhanxianlouzhu,pingbibiaoti,zhanxianbiaoti,pingbineirong,zhanxianneirong,pingbitime);var zuandata24=retiechuli(result.remen24,30,sortkey,pingbifenlei,pingbilouzhu,zhanxianlouzhu,pingbibiaoti,zhanxianbiaoti,pingbineirong,zhanxianneirong,pingbitime);var zuandata48=retiechuli(result.remen48,30,sortkey,pingbifenlei,pingbilouzhu,zhanxianlouzhu,pingbibiaoti,zhanxianbiaoti,pingbineirong,zhanxianneirong,pingbitime);if(config=="zuankeba-hot"||config=="xinzuanba-hot"){var name="赚吧"}else if(config=="weibo-hot"){name="微博"}else if(config=="douban-hot"){name="豆瓣"}var zuizhong='<div class="mianbaoxie zuankebatabs"><span class="active">'+name+'6小时热帖</span><span>'+name+'24小时热帖</span><span>'+name+'48小时热帖</span></div><div class="listbox"><ul class="retie-post"><div class="swiper zuankebahot"><div class="swiper-wrapper">'+zuandata6+zuandata24+zuandata48+'</div></div></ul></div></div>';$("#mainbox").append(zuizhong);var mySwiper=new Swiper('#mainbox .zuankebahot',{autoHeight:true,on:{slideChange:function(){$("#mainbox .zuankebatabs .active").removeClass('active');$("#mainbox .zuankebatabs span").eq(this.activeIndex).addClass('active')},},});$("#mainbox .zuankebatabs span").on('click',function(e){e.preventDefault();$("#mainbox .zuankebatabs .active").removeClass('active');$(this).addClass('active');mySwiper.slideTo($(this).index())});$("#mainbox .zuankebatabs span").hover(function(e){e.preventDefault();$("#mainbox .zuankebatabs .active").removeClass('active');$(this).addClass('active');mySwiper.slideTo($(this).index())})}
function zdm_retiechuli(cars) {
    zuanCars = [];
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

    var adddata = zdm_listtimechuli(zuanCars);
    if (adddata) {
        adddata = '<div class="swiper-slide"><ul class="new-post">' + adddata + '</ul></div>';
        return adddata
    }
}

function zdm_retielist(result) {
    var zuandata1 = zdm_retiechuli(result.remen1);
    var zuandata3 = zdm_retiechuli(result.remen3);
    var zuandata6 = zdm_retiechuli(result.remen6);

    var zuizhong =
        '<div class="mianbaoxie zuankebatabs"><span class="active">值得买1小时热帖</span><span>值得买3小时热帖</span><span>值得买6小时热帖</span></div><div class="listbox"><ul class="retie-post"><div class="swiper zuankebahot"><div class="swiper-wrapper">' +
        zuandata1 + zuandata3 + zuandata6 + '</div></div></ul></div></div>';
    $("#mainbox").append(zuizhong);
    var mySwiper = new Swiper('#mainbox .zuankebahot', {
        autoHeight: true,
        on: {
            slideChange: function () {
                $("#mainbox .zuankebatabs .active").removeClass('active');
                $("#mainbox .zuankebatabs span").eq(this.activeIndex).addClass('active')
            },
        },
    });
    $("#mainbox .zuankebatabs span").on('click', function (e) {
        e.preventDefault();
        $("#mainbox .zuankebatabs .active").removeClass('active');
        $(this).addClass('active');
        mySwiper.slideTo($(this).index())
    });
    $("#mainbox .zuankebatabs span").hover(function (e) {
        e.preventDefault();
        $("#mainbox .zuankebatabs .active").removeClass('active');
        $(this).addClass('active');
        mySwiper.slideTo($(this).index())
    })
}

function rementie(config, sortkey, pingbifenlei, pingbilouzhu, zhanxianlouzhu, pingbibiaoti, zhanxianbiaoti,
    pingbineirong, zhanxianneirong, pingbitime) {
    if (lscache.supported()) {
        if (lscache.get(config)) {
            result = lscache.get(config);
            if (pingbifenlei == "zhidemai-hot") {
                zdm_retielist(result);
            } else {
                retielist(result, config, sortkey, pingbifenlei, pingbilouzhu, zhanxianlouzhu, pingbibiaoti, zhanxianbiaoti, pingbineirong, zhanxianneirong, pingbitime);
            }
            return
        }
    }
    $.getJSON("/plus/json/rank/" + config + ".json", function (result, status) {
        if (status == "success") {
            lscache.set(config, result, 30 * 60);
            if (pingbifenlei == "zhidemai-hot") {
                zdm_retielist(result);
            } else {
                retielist(result, config, sortkey, pingbifenlei, pingbilouzhu, zhanxianlouzhu, pingbibiaoti, zhanxianbiaoti, pingbineirong, zhanxianneirong, pingbitime);
            }
        }
    })
}
function addrank(config,netkaiguan,shuliang,redstr,sortkey,pingbifenlei,pingbilouzhu,zhanxianlouzhu,pingbilouzhuplus,pingbibiaoti,zhanxianbiaoti,pingbibiaotiplus,pingbineirong,zhanxianneirong,pingbineirongplus,pingbitime){if(lscache.supported()&&lscache.get(config)){var data=lscache.get(config);var rankdata=rankchuli(data,shuliang,sortkey,pingbifenlei,pingbilouzhu,zhanxianlouzhu,pingbilouzhuplus,pingbibiaoti,zhanxianbiaoti,pingbibiaotiplus,pingbineirong,zhanxianneirong,pingbineirongplus,pingbitime);$(".rank").append(rankdata);list_red(redstr,"list")}else{if(netkaiguan=="on" || netkaiguan == "off"){$.getJSON("/plus/json/rank/"+config+".json",function(result,status){if(status=="success"){if(lscache.supported()){if(config=="yixiaoshi-hot"){lscache.set(config,result,60*5)}else if(config=="sanxiaoshi-hot"){lscache.set(config,result,60*10)}else if(config=="liuxiaoshi-hot"||config=="shierxiaoshi-hot"){lscache.set(config,result,60*60)}else{lscache.set(config,result,60*60)}}var rankdata=rankchuli(result,shuliang,sortkey,pingbifenlei,pingbilouzhu,zhanxianlouzhu,pingbilouzhuplus,pingbibiaoti,zhanxianbiaoti,pingbibiaotiplus,pingbineirong,zhanxianneirong,pingbineirongplus,pingbitime);$(".rank").append(rankdata);list_red(redstr,"list")}})}else{const gaofeng='<div class="bangdan"><div class="clearfix"><div class="mianbaoxie">高峰时间排行榜暂停输出</div></div></div>';$(".listbox.rank").append(gaofeng)}}}
function rankchuli(res,shuliang,sortkey,pingbifenlei,pingbilouzhu,zhanxianlouzhu,pingbilouzhuplus,pingbibiaoti,zhanxianbiaoti,pingbibiaotiplus,pingbineirong,zhanxianneirong,pingbineirongplus,pingbitime){dangqian=0;bangdingshu=shuliang;Cars=[];$.each(res,function(i,field){if(listfilter(field,pingbifenlei,pingbilouzhu,zhanxianlouzhu,pingbilouzhuplus,pingbibiaoti,zhanxianbiaoti,pingbibiaotiplus,pingbineirong,zhanxianneirong,pingbineirongplus,pingbitime)==false){return true}Cars.push(field);dangqian++;if(dangqian==bangdingshu){return false}});if(sortkey!="1"){Cars=sortByKey(Cars,"shijianchuo","desc")}if(Cars.length%2===1){Cars.pop()}data=listtimechuli(Cars);if(data){data='<ul class="new-post">'+data+'</ul>';return data}}
$(function(){var pagealias=$(".pc-nav").attr("data-pagealias");if(pagealias&&pagealias.includes("-hot")){$('.rank-tabs span[data-tabs="'+pagealias+'"]').addClass("active");$('.rank-tabs span[data-tabs]').on('click',function(){var dataTabsValue=$(this).data('tabs');window.open("/"+dataTabsValue+".html","_self")});var w=0;$(".active").prevAll().each(function(){w=w+$(".active").innerWidth()});w=w+($(".active").innerWidth()/2);w=w-($(".rank-tabs").innerWidth()/2);$(".rank-tabs").scrollLeft(w-250)}});
function getWeiboCategories(pageName) {
    const FIRST_LEVEL_CATEGORIES = [
    'xianbao', 
    'shipin', 
    'yinliao', 
    'danrou', 
    'liangyou', 
    'guoshu', 
    'riyong', 
    'fushi', 
    'meizhuang', 
    'muying', 
    'jiankang', 
    'yundong', 
    'yule', 
    'shuma', 
    'jiayong', 
    'chongwu', 
    'qita'
];

    const SECOND_LEVEL_CATEGORIES = ['tb', 'jd', 'pdd', 'tuan', 'other', 'zhengdian', 'maochao'];
    const categories = pageName.split('-').slice(1);
    const isInArray = (item, array) => array.includes(item);
    const firstLevel = isInArray(categories[0], FIRST_LEVEL_CATEGORIES) ? categories[0] : null;
    let secondLevel = categories.length > 1 && isInArray(categories[1], SECOND_LEVEL_CATEGORIES) ? categories[1] : null;
    if (!secondLevel) {
        secondLevel = isInArray(categories[0], SECOND_LEVEL_CATEGORIES) ? categories[0] : null
    }
    return {
        firstLevel,
        secondLevel
    }
}

$(function () {
    const currentURL = window.location.href;
    const pageType = currentURL.includes("weibo") ? "weibo" : 
                     currentURL.includes("zhidemai") ? "zhidemai" : 
                     currentURL.includes("haodan") ? "haodan" : null;
    
    if (!pageType) return;

    const pagetype = $(".pc-nav").data("type");
    const pagename = $(".pc-nav").data("catename");
    const pagebiaoqian = $(".pc-nav").data("biaoqian") === "线报活动" ? "线报" : $(".pc-nav").data("biaoqian");
    const pageplatforms = $(".pc-nav").data("platforms");

    // 通用函数：设置活动标签
    function setActiveTabs() {
        if (pagetype === "category") {
            const wbcategory = getWeiboCategories(pagename);
            const firstLevel = wbcategory.firstLevel || "index";
            const secondLevel = wbcategory.secondLevel || "index";
            
            $(`.tip-nav span[data-tabs="${firstLevel}"]`).addClass("active");
            $(`.sort-row span[data-tabs="${secondLevel}"]`).addClass("active");
        } else if (pagetype === "article") {
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
        
        if (firstTabsValue === "index" && secondTabsValue === "index") {
            window.open(`/category-${pageType}/`, "_self");
        } else {
            let url = `/category-${pageType}`;
            if (firstTabsValue && firstTabsValue !== "index") url += `-${firstTabsValue}`;
            if (secondTabsValue && secondTabsValue !== "index") url += `-${secondTabsValue}`;
            window.open(`${url}/`, "_self");
        }
    }

    // 通用函数：滑动导航栏
    function scrollNavToActive(navClass) {
    const $active = $(`${navClass} .active`).eq(0);
    const $nav = $(navClass);
    
    if (!$active.length || !$nav.length) return;
    
    // 获取元素实际位置和尺寸
    const activePosition = $active.position().left;
    const activeWidth = $active.outerWidth();
    const navWidth = $nav.outerWidth();
    
    // 计算居中滚动位置
    const scrollTo = activePosition + (activeWidth / 2) - (navWidth / 2);
    
    $nav.scrollLeft(scrollTo);
}


    // 初始化
    setActiveTabs();
    setupTabClickHandlers();
    scrollNavToActive(".tip-nav");
    scrollNavToActive(".sort-row");
});
