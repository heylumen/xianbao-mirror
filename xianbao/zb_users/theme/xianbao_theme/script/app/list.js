/*! app/list.js | 列表模块：下拉刷新/无限加载/屏蔽筛选/关键词标红/时间渲染/猜你喜欢 | 依赖: PullToRefresh, InfiniteAjaxScroll, lscache, Swiper, core.listfilter */
function xialashuaxin(type,redsign,pingbifenlei,pingbilouzhu,zhanxianlouzhu,pingbilouzhuplus,pingbibiaoti,zhanxianbiaoti,pingbibiaotiplus,pingbineirong,zhanxianneirong,pingbineirongplus,pingbitime){if(type=="普通"){PullToRefresh.init({mainElement:"#mainbox",triggerElement:"#mainbox",distThreshold:80,distMax:90,distIgnore:50,instructionsPullToRefresh:"下拉获取内容刷新",instructionsReleaseToRefresh:"释放后进行内容刷新",instructionsRefreshing:"正在请求中",refreshTimeout:300,onRefresh:function(){location.reload()}})}else{PullToRefresh.init({mainElement:"#mainbox",triggerElement:"#mainbox",distThreshold:80,distMax:90,distIgnore:50,instructionsPullToRefresh:"下拉获取内容刷新",instructionsReleaseToRefresh:"释放后进行内容刷新",instructionsRefreshing:"正在请求中",refreshTimeout:300,onRefresh:function(){$.ajax({url:window.location.href,success:function(result){var olddata=$("#mainbox .new-post").html();result = result.replace(/[\r\n]+/g, '');var newdataarr=result.match(new RegExp('<li class="article-list">(.*?)</li>',"g"));var shuliang=0;var tianjiahtml="";if(!newdataarr){return}for(var i=0;i<newdataarr.length;i++){var art=[];art.url=newdataarr[i].match(new RegExp('href="(.*?)"',"i"))[1];art.catename=newdataarr[i].match(new RegExp('data-catename="(.*?)"',"i"))[1];art.louzhu=newdataarr[i].match(new RegExp('data-louzhu="(.*?)"',"i"))[1];art.title=newdataarr[i].match(new RegExp('html" title="(.*?)" target',"i"))[1];art.content=newdataarr[i].match(new RegExp('data-content="(.*?)"',"i"));var panduanreg=art.url;if(olddata&&!olddata.match(new RegExp(panduanreg,"i"))){if(listfilter(art,pingbifenlei,pingbilouzhu,zhanxianlouzhu,pingbilouzhuplus,pingbibiaoti,zhanxianbiaoti,pingbibiaotiplus,pingbineirong,zhanxianneirong,pingbineirongplus,pingbitime)!=false){shuliang++;newdataarr[i]=newdataarr[i].replace('class="article-list"','class="article-list newest"');tianjiahtml=tianjiahtml+newdataarr[i];$("#mainbox .article-list").removeClass("newest")}}}if(tianjiahtml){if($("#mainbox .new-post .top:last").length>0){$("#mainbox .new-post .top:last").after(tianjiahtml)}else{$("#mainbox .new-post").prepend(tianjiahtml)}if(redsign){list_red(redsign,"list")}layer.msg("获取到"+shuliang+"个新数据")}else{layer.msg("未获取到新数据")}}})}})}}



function zdm_xialashuaxin(type, redsign, zdm_config) {
    if (type == "普通") {
        PullToRefresh.init({
            mainElement: "#mainbox",
            triggerElement: "#mainbox",
            distThreshold: 80,
            distMax: 90,
            distIgnore: 50,
            instructionsPullToRefresh: "下拉获取内容刷新",
            instructionsReleaseToRefresh: "释放后进行内容刷新",
            instructionsRefreshing: "正在请求中",
            refreshTimeout: 300,
            onRefresh: function () {
                location.reload()
            }
        })
    } else {
        PullToRefresh.init({
            mainElement: "#mainbox",
            triggerElement: "#mainbox",
            distThreshold: 80,
            distMax: 90,
            distIgnore: 50,
            instructionsPullToRefresh: "下拉获取内容刷新",
            instructionsReleaseToRefresh: "释放后进行内容刷新",
            instructionsRefreshing: "正在请求中",
            refreshTimeout: 300,
            onRefresh: function () {
                $.ajax({
                    url: window.location.href,
                    success: function (result) {
                        var olddata = $("#mainbox .new-post").html();
                        result = result.replace(/[\r\n]+/g, '');
                        var newdataarr = result.match(new RegExp('<li class="article-list">(.*?)</li>', "g"));
                        var shuliang = 0;
                        var tianjiahtml = "";
                        if (!newdataarr) {
                            return
                        }
                        
                        for (var i = 0; i < newdataarr.length; i++) {
                            var art = [];
                            art.title = newdataarr[i].match(new RegExp('title="(.*?)"', "i"))[1];
                            art.price = newdataarr[i].match(new RegExp('data-price="(.*?)"', "i"))[1];
                            art.type = newdataarr[i].match(new RegExp('data-type="(.*?)"', "i"))[1];
                            art.brand = newdataarr[i].match(new RegExp('data-brand="(.*?)"', "i"))[1];
                            art.mall_name = newdataarr[i].match(new RegExp('data-mall_name="(.*?)"', "i"))[1];
                            art.category_name = newdataarr[i].match(new RegExp('data-category_name="(.*?)"', "i"))[1];
                            art.url = newdataarr[i].match(new RegExp('href="(.*?)"', "i"))[1];
                            var panduanreg = art.url;
                            if (olddata && !olddata.match(new RegExp(panduanreg, "i"))) {
                                if (zdm_listfilter(art, zdm_config) != false) {
                                    shuliang++;
                                    newdataarr[i] = newdataarr[i].replace(
                                        'class="article-list"',
                                        'class="article-list newest"');
                                    tianjiahtml = tianjiahtml + newdataarr[i];
                                    $("#mainbox .article-list").removeClass("newest")
                                }
                            }
                        }
                        if (tianjiahtml) {
                            if ($("#mainbox .new-post .top:last").length > 0) {
                                $("#mainbox .new-post .top:last").after(tianjiahtml)
                            } else {
                                $("#mainbox .new-post").prepend(tianjiahtml)
                            }
                            if (redsign) {
                                list_red(redsign, "list")
                            }
                            layer.msg("获取到" + shuliang + "个新数据")
                        } else {
                            layer.msg("未获取到新数据")
                        }
                    }
                })
            }
        })
    }
}

function ajaxpaging(type,redsign,pingbifenlei,pingbilouzhu,zhanxianlouzhu,pingbilouzhuplus,pingbibiaoti,zhanxianbiaoti,pingbibiaotiplus,pingbineirong,zhanxianneirong,pingbineirongplus,pingbitime){if($("#mainbox .listbox").length>0&&$("#mainbox .pagebar .nav-links .next a").length>0){if(type=="点击加载"){$("#mainbox .listbox").after('<div class="pagination load-more"><i class="iconfont icon-refresh"></i>加载更多</div>')}Scrolldata=[];Scrolldata.item=".listbox .new-post li";Scrolldata.next=".pagebar .nav-links .next a";Scrolldata.pagination=".pagebar";Scrolldata.negativeMargin=400;Scrolldata.logger=false;Scrolldata.prefill=true;if(type=="点击加载"){Scrolldata.trigger=".load-more"}let ias=new InfiniteAjaxScroll(".listbox .new-post",Scrolldata);ias.on("append",function(event){var newitems=[];for(var i=0;i<event.items.length;i++){if(event.items[i].classList[1]=="top"){continue}var field=[];field.catename=event.items[i].querySelector('a').dataset.catename;field.title=event.items[i].querySelector('a').getAttribute('title');field.content=event.items[i].querySelector('a').dataset.content;field.louzhu=event.items[i].querySelector('a').dataset.louzhu;if(listfilter(field,pingbifenlei,pingbilouzhu,zhanxianlouzhu,pingbilouzhuplus,pingbibiaoti,zhanxianbiaoti,pingbibiaotiplus,pingbineirong,zhanxianneirong,pingbineirongplus,pingbitime)==true){newitems.push(event.items[i])}}event.items=[];event.items=newitems});ias.on("appended",function(){$("#mainbox .load-more").show();$("#mainbox .loading").remove();if(redsign){list_red(redsign,"list")}});ias.on("last",function(){$("#mainbox .loading").remove();$("#mainbox .load-more").remove();$("#mainbox .listbox").after('<div class="pagination end">已经是最后一页了</div>')});ias.on("page",function(event){document.title=event.title;let state=history.state;history.replaceState(state,event.title,event.url)});ias.on("next",function(event){$("#mainbox .load-more").hide();$("#mainbox .listbox").after('<div class="pagination loading"><img src="/zb_users/theme/xianbao_theme/image/loading.gif"/></div>')});ias.on("load",function(event){event.nocache=true})}}

function zdm_ajaxpaging(type, redsign, zdm_config) {
    if ($("#mainbox .listbox").length > 0 && $("#mainbox .pagebar .nav-links .next a").length > 0) {
        if (type == "点击加载") {
            $("#mainbox .listbox").after(
                '<div class="pagination load-more"><i class="iconfont icon-refresh"></i>加载更多</div>')
        }
        Scrolldata = [];
        Scrolldata.item = ".listbox .new-post li";
        Scrolldata.next = ".pagebar .nav-links .next a";
        Scrolldata.pagination = ".pagebar";
        Scrolldata.negativeMargin = 400;
        Scrolldata.logger = false;
        Scrolldata.prefill = true;
        if (type == "点击加载") {
            Scrolldata.trigger = ".load-more"
        }
        let ias = new InfiniteAjaxScroll(".listbox .new-post", Scrolldata);
        ias.on("append", function (event) {
            var newitems = [];
            for (var i = 0; i < event.items.length; i++) {
                if (event.items[i].classList[1] == "top") {
                    continue
                }
                var field = [];
                field.title = event.items[i].querySelector('a').getAttribute('title');
                field.price = event.items[i].querySelector('a').dataset.price;
                field.type = event.items[i].querySelector('a').dataset.type;
                field.brand = event.items[i].querySelector('a').dataset.brand;
                field.mall_name = event.items[i].querySelector('a').dataset.mall_name;
                field.category_name = event.items[i].querySelector('a').dataset.category_name;
                
                if (zdm_listfilter(field, zdm_config) == true) {
                    newitems.push(event.items[i]);
                }
            }
            event.items = [];
            event.items = newitems;
        });
        ias.on("appended", function () {
            $("#mainbox .load-more").show();
            $("#mainbox .loading").remove();
            if (redsign) {
                list_red(redsign, "list")
            }
        });
        ias.on("last", function () {
            $("#mainbox .loading").remove();
            $("#mainbox .load-more").remove();
            $("#mainbox .listbox").after('<div class="pagination end">已经是最后一页了</div>')
        });
        ias.on("page", function (event) {
            document.title = event.title;
            let state = history.state;
            history.replaceState(state, event.title, event.url)
        });
        ias.on("next", function (event) {
            $("#mainbox .load-more").hide();
            $("#mainbox .listbox").after(
                '<div class="pagination loading"><img src="/zb_users/theme/xianbao_theme/image/loading.gif"/></div>'
                )
        });
        ias.on("load", function (event) {
            event.nocache = true
        })
    }
}
function haodan_ajaxpaging(type,redsign,pingbifenlei,pingbi,zhanxian,pingbiplus,zhuanlian_config){if($(".tip-main .tipoff-list").length>0&&$(".pagebar .nav-links .next a").length>0){if(type=="点击加载"){$(".tip-main").append('<div class="pagination load-more"><i class="iconfont icon-refresh"></i>加载更多</div>')}Scrolldata=[];Scrolldata.item=".tipoff-list .haodan-list";Scrolldata.next=".pagebar .nav-links .next a";Scrolldata.pagination=".pagebar";Scrolldata.negativeMargin=400;Scrolldata.logger=false;Scrolldata.prefill=true;if(type=="点击加载"){Scrolldata.trigger=".load-more"}let ias=new InfiniteAjaxScroll(".tip-main .tipoff-list",Scrolldata);ias.on("append",function(event){let a="";event.items.forEach(function(item){let field=[];field.title=$(item).find('.right').text();field.catename=$(item).find('.right').data('catename');if(listfilter(field,pingbifenlei,"","","",pingbi,zhanxian,pingbiplus,"","","","")==true){console.log($(item).find('.right').text());a+=item.outerHTML}});var $container=$('.tipoff-list');var $newComAnimationPlace=$(a);$container.append($newComAnimationPlace);$container.masonry({itemSelector:'.haodan-list',gutter:1,isAnimated:true,isFitWidth:true,isResizable:true,columnWidth:0});$container.masonry('appended',$newComAnimationPlace);event.items=[]});ias.on("appended",function(){if(zhuanlian_config){haodanzhuanlian(zhuanlian_config)}if(redsign){haodan_red(redsign)}$(".tip-main .load-more").show();$(".tip-main .loading").remove()});ias.on("last",function(){$(".tip-main .loading").remove();$(".tip-main .load-more").remove();$(".tip-main").append('<div class="pagination end">已经是最后一页了</div>')});ias.on("page",function(event){document.title=event.title;let state=history.state;history.replaceState(state,event.title,event.url)});ias.on("next",function(event){$(".tip-main .load-more").hide();$(".tip-main").append('<div class="pagination loading"><img src="/zb_users/theme/xianbao_theme/image/loading.gif"/></div>')});ias.on("load",function(event){event.nocache=true})}}
// function guesslikechuli(result,shuliang,biaoqian,artid,redstr,pingbifenlei,pingbilouzhu,zhanxianlouzhu,pingbilouzhuplus,pingbibiaoti,zhanxianbiaoti,pingbibiaotiplus,pingbineirong,zhanxianneirong,pingbineirongplus,pingbitime){var myCars=[];var dangqianshu=0;$.each(result,function(i,field){if(biaoqian){var biaoqianreg=new RegExp(biaoqian,"i");var hebing=field.title+field.content;if(!hebing.match(biaoqianreg)){return true}}if(artid){var artidreg=new RegExp("/"+artid+".html","i");if(field.url.match(artidreg)){return true}}if(listfilter(field,pingbifenlei,pingbilouzhu,zhanxianlouzhu,pingbilouzhuplus,pingbibiaoti,zhanxianbiaoti,pingbibiaotiplus,pingbineirong,zhanxianneirong,pingbineirongplus,pingbitime)===false){return true}dangqianshu++;if(dangqianshu>shuliang){return false}myCars.push(field)});if(myCars.length<3){biaoqian="";var myCars=[];var dangqianshu=0;$.each(result,function(i,field){if(artid){var artidreg=new RegExp("/"+artid+".html","i");if(field.url.match(artidreg)){return true}}if(listfilter(field,pingbifenlei,pingbilouzhu,zhanxianlouzhu,pingbilouzhuplus,pingbibiaoti,zhanxianbiaoti,pingbibiaotiplus,pingbineirong,zhanxianneirong,pingbineirongplus,pingbitime)===false){return true}dangqianshu++;if(dangqianshu>shuliang){return false}myCars.push(field)})}myCars=sortByKey(myCars,"shijianchuo","desc");var newhtml1="";var newhtml2="";var newhtml3="";var newCars1=myCars.slice(0,15);var newCars2=myCars.slice(15,30);var newCars3=myCars.slice(30,45);if(newCars1.length>0){newhtml1='<div class="swiper-slide"><ul class="new-post">'+listtimechuli(newCars1)+'</ul></div>'}if(newCars2.length>0){newhtml2='<div class="swiper-slide"><ul class="new-post">'+listtimechuli(newCars2)+'</ul></div>'}if(newCars3.length>0){newhtml3='<div class="swiper-slide"><ul class="new-post">'+listtimechuli(newCars3)+'</ul></div>'}if(biaoqian){addbiaoqian="（"+biaoqian+"）"}else{addbiaoqian=""}if(newhtml1){var jieguo='<div class="xiangguan sb mt"><div class="clearfix"><div class="mianbaoxie">猜你还会喜欢'+addbiaoqian+'</div><div class="swiper"><div class="swiper-wrapper">'+newhtml1+newhtml2+newhtml3+'</div></div></div></div>';$("#mainbox").append(jieguo)}var mySwiper=new Swiper('.xiangguan .swiper',{autoHeight:true});list_red(redstr,"xiangguan")}
// function guesslike(netkaiguan,shuliang,redstr,pingbifenlei,pingbilouzhu,zhanxianlouzhu,pingbilouzhuplus,pingbibiaoti,zhanxianbiaoti,pingbibiaotiplus,pingbineirong,zhanxianneirong,pingbineirongplus,pingbitime){var biaoqian=$("#article-button").data("biaoqian");var artid=$("#article-button").data("id");if(lscache.supported()){if(lscache.get("guesslike")){result=lscache.get("guesslike");guesslikechuli(result,shuliang,biaoqian,artid,redstr,pingbifenlei,pingbilouzhu,zhanxianlouzhu,pingbilouzhuplus,pingbibiaoti,zhanxianbiaoti,pingbibiaotiplus,pingbineirong,zhanxianneirong,pingbineirongplus,pingbitime);return}if(netkaiguan=="on"){$.getJSON("/plus/json/rank/guesslike.json",function(result,status){if(status=="success"){lscache.set("guesslike",result,60*30);guesslikechuli(result,shuliang,biaoqian,artid,redstr,pingbifenlei,pingbilouzhu,zhanxianlouzhu,pingbilouzhuplus,pingbibiaoti,zhanxianbiaoti,pingbibiaotiplus,pingbineirong,zhanxianneirong,pingbineirongplus,pingbitime)}})}else{const gaofeng='<div class="xiangguan sb mt"><div class="clearfix"><div class="mianbaoxie">高峰时间猜你喜欢暂停输出</div></div></div>';$("#mainbox").append(gaofeng)}}}



function guesslikechuli(result, shuliang, biaoqian, artid, redstr, pingbifenlei, pingbilouzhu, zhanxianlouzhu,
    pingbilouzhuplus, pingbibiaoti, zhanxianbiaoti, pingbibiaotiplus, pingbineirong, zhanxianneirong, pingbineirongplus,
    pingbitime) {
    
    if (!result || !Array.isArray(result)) return;
    
    var filterOptions = {
        pingbifenlei: pingbifenlei,
        pingbilouzhu: pingbilouzhu,
        zhanxianlouzhu: zhanxianlouzhu,
        pingbilouzhuplus: pingbilouzhuplus,
        pingbibiaoti: pingbibiaoti,
        zhanxianbiaoti: zhanxianbiaoti,
        pingbibiaotiplus: pingbibiaotiplus,
        pingbineirong: pingbineirong,
        zhanxianneirong: zhanxianneirong,
        pingbineirongplus: pingbineirongplus,
        pingbitime: pingbitime
    };

    // 过滤并获取符合条件的文章
    function filterArticles(data, useTagFilter) {
        var filtered = [];
        var count = 0;
        
        $.each(data, function(i, field) {
            // 标签过滤
            if (useTagFilter && biaoqian) {
                var biaoqianreg = new RegExp(biaoqian, "i");
                var hebing = field.title + (field.content || '');
                if (field.cateid === "10" && field.catename) {
                    hebing += field.catename.replace("微博线报-", "");
                }
                if (field.cateid === "30" && field.catename) {
                    hebing += field.catename.replace("好单线报-", "");
                }
                if (!biaoqianreg.test(hebing)) {
                    return true; // continue
                }
            }
            
            // ID过滤
            if (!useTagFilter && artid) {
                var artidreg = new RegExp("/" + artid + ".html", "i");
                if (field.url && artidreg.test(field.url)) {
                    return true; // continue
                }
            }
            
            // 列表过滤
            if (listfilter(field, pingbifenlei, pingbilouzhu, zhanxianlouzhu, pingbilouzhuplus, pingbibiaoti,
    zhanxianbiaoti, pingbibiaotiplus, pingbineirong, zhanxianneirong, pingbineirongplus, pingbitime) === false) {
                return true; // continue
            }
            
            count++;
            if (count > shuliang) {
                return false; // break
            }
            
            filtered.push(field);
        });
        
        return filtered;
    }
    
    // 第一次尝试用标签过滤
    var myCars = filterArticles(result, true);
    
    // 如果结果不足，则不用标签再过滤一次
    if (myCars.length < 3) {
        myCars = filterArticles(result, false);
    }
    
    // 按时间戳排序
    myCars = sortByKey(myCars, "shijianchuo", "desc");
    
    // 分割数组并生成HTML
    var slides = [];
    for (var i = 0; i < 3; i++) {
        var start = i * 15;
        var end = start + 15;
        var slideData = myCars.slice(start, end);
        
        if (slideData.length > 0) {
            slides.push(
                '<div class="swiper-slide"><ul class="new-post">' + 
                listtimechuli(slideData) + 
                '</ul></div>'
            );
        }
    }
    
    // 如果有结果则显示
    if (slides.length > 0) {
        var addbiaoqian = biaoqian ? "（" + biaoqian + "）" : "";
        var jieguo = [
            '<div class="xiangguan sb mt">',
            '<div class="clearfix">',
            '<div class="mianbaoxie">猜你还会喜欢' + addbiaoqian + '</div>',
            '<div class="swiper"><div class="swiper-wrapper">',
            slides.join(''),
            '</div></div>',
            '</div></div>'
        ].join('');
        
        $("#mainbox").append(jieguo);
        
        // 初始化Swiper
        try {
            var mySwiper = new Swiper('.xiangguan .swiper', {
                autoHeight: true
            });
        } catch (e) {
            console.error('Swiper初始化失败:', e);
        }
        
        list_red(redstr, "xiangguan");
    }
}


function guesslike(netkaiguan, shuliang, redstr, pingbifenlei, pingbilouzhu, zhanxianlouzhu, pingbilouzhuplus,
    pingbibiaoti, zhanxianbiaoti, pingbibiaotiplus, pingbineirong, zhanxianneirong, pingbineirongplus, pingbitime) {
    
    var $articleButton = $("#article-button");
    if ($articleButton.length === 0) return;
    
    var biaoqian = $articleButton.data("biaoqian");
    var artid = $articleButton.data("id");
    
    // 检查本地缓存支持
    if (typeof lscache !== 'undefined' && lscache.supported()) {
        // 尝试从缓存获取
        var cachedResult = lscache.get("guesslike");
        if (cachedResult) {
            guesslikechuli(cachedResult, shuliang, biaoqian, artid, redstr, pingbifenlei, pingbilouzhu, zhanxianlouzhu,
                pingbilouzhuplus, pingbibiaoti, zhanxianbiaoti, pingbibiaotiplus, pingbineirong, zhanxianneirong,
                pingbineirongplus, pingbitime);
            return;
        }
        
        // 网络请求
        if (netkaiguan === "on") {
            $.ajax({
                url: "/plus/json/rank/guesslike.json",
                dataType: "json",
                success: function(result) {
                    lscache.set("guesslike", result, 60 * 30);
                    guesslikechuli(result, shuliang, biaoqian, artid, redstr, pingbifenlei, pingbilouzhu,
                        zhanxianlouzhu, pingbilouzhuplus, pingbibiaoti, zhanxianbiaoti, pingbibiaotiplus,
                        pingbineirong, zhanxianneirong, pingbineirongplus, pingbitime);
                },
                error: function(xhr, status, error) {
                    console.error("猜你喜欢数据请求失败:", status, error);
                }
            });
        } else {
            // 高峰时间提示
            var gaofeng = [
                '<div class="xiangguan sb mt">',
                '<div class="clearfix">',
                '<div class="mianbaoxie">高峰时间非会员猜你喜欢暂停输出</div>',
                '</div></div>'
            ].join('');
            $("#mainbox").append(gaofeng);
        }
    } else {
        console.warn("浏览器不支持本地存储，猜你喜欢功能受限");
    }
}


// function liebiaoshaixuan(pingbifenlei,pingbilouzhu,zhanxianlouzhu,pingbilouzhuplus,pingbibiaoti,zhanxianbiaoti,pingbibiaotiplus,pingbineirong,zhanxianneirong,pingbineirongplus,pingbitime){$("#mainbox .new-post .article-list:not(.top) .title a").each(function(){var shuzhu=[];shuzhu.catename=$(this).data("catename").toString();shuzhu.louzhu=$(this).data("louzhu").toString();shuzhu.louzhuregtime=$(this).data("louzhuregtime");shuzhu.title=$(this).text().toString();shuzhu.content=$(this).data("content").toString();if(listfilter(shuzhu,pingbifenlei,pingbilouzhu,zhanxianlouzhu,pingbilouzhuplus,pingbibiaoti,zhanxianbiaoti,pingbibiaotiplus,pingbineirong,zhanxianneirong,pingbineirongplus,pingbitime)==false){$(this).parent().parent().remove()}})}


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

function haodan_shaixuan(pingbifenlei,pingbi,zhanxian,pingbiplus){$(".tipoff-box .haodan-list").each(function(){var shuzhu=[];shuzhu.catename=$(this).find('.right').data('catename');shuzhu.title=$(this).find('.right').text();if(listfilter(shuzhu,pingbifenlei,"","","",pingbi,zhanxian,pingbiplus,"","","","")==false){$(this).remove()}});$container=$('.tipoff-list');$container.masonry('reloadItems');$container.masonry({itemSelector:'.haodan-list',isAnimated:true,isFitWidth:true,isResizable:true,columnWidth:0}).masonry('layout')}
function huanyuanurl(){$(".new-post .article-list:has(.cg18)").each(function(){var yuanurl=$(this).find("a").data("yuanurl");if(yuanurl){$(this).find("a").attr("href",yuanurl)}})};
function list_red(a,quyu){if(quyu=="list"){yuansu="#mainbox .listbox .new-post a"}else if(quyu=="bangdan"){yuansu=".celan .bangdan .new-post a"}else if(quyu=="xiangguan"){yuansu=".xiangguan .new-post a"}else if(quyu=="smartart"){yuansu=".smartart .new-post a"}else{return}var seach_redarr=a.split("|");$(yuansu).each(function(){var text=$(this).text();for(j=0;j<seach_redarr.length;j++){if(seach_redarr[j]){text=text.replace(new RegExp(seach_redarr[j],"g"),'<span style="color: red;font-weight:bold;">'+seach_redarr[j]+"</span>")}}$(this).html(text)})}
function haodan_red(a){var seach_redarr=a.split("|");$(".haodan-list .detail-block li").each(function(){if($(this).html().match(new RegExp(/button/),"g")){}else{var text=$(this).text();for(j=0;j<seach_redarr.length;j++){if(seach_redarr[j]){text=text.replace(new RegExp(seach_redarr[j],"g"),'<span style="color: red;font-weight:bold;">'+seach_redarr[j]+"</span>")}}$(this).html(text)}})}
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
    var seach_redarr = a.split("|").filter(Boolean); // 过滤掉空字符串

    // 处理标题
    var titleElement = $(".art-title");
    var titleText = titleElement.html(); // 使用 html() 以保留 HTML 标签

    // 标红标题中的关键词，避免重复处理
    seach_redarr.forEach(function (keyword) {
        // 使用正则表达式，确保不对已经被标红的文本进行处理
        var regex = new RegExp(`(?<!<span[^>]*?>)(?<!<[^>]*)(${keyword})(?!<\/span>)(?![^<]*?>)`, "g");
        titleText = titleText.replace(regex, '<span style="color: red;font-weight:bold;">\$1</span>');
    });
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

    // 标红内容中的关键词，避免重复处理
    seach_redarr.forEach(function (keyword) {
        var regex = new RegExp(`(?<!<span[^>]*?>)(?<!<[^>]*)(${keyword})(?!<\/span>)(?![^<]*?>)`, "g");
        html = html.replace(regex, '<span style="color: red;font-weight:bold;">\$1</span>');
    });

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
function listtimechuli(myCars) {
    const newjinday = new Date(); // 获取当前日期
    const newzuoday = new Date(newjinday - 1000 * 60 * 60 * 24); // 获取昨天的日期
    const jintianday = `${newjinday.getFullYear()}-${add0(newjinday.getMonth() + 1)}-${add0(newjinday.getDate())}`; // 格式化今天的日期
    const zuotianday = `${newzuoday.getFullYear()}-${add0(newzuoday.getMonth() + 1)}-${add0(newzuoday.getDate())}`; // 格式化昨天的日期
    const zuoriday = `${add0(newzuoday.getMonth() + 1)}-${add0(newzuoday.getDate())}`; // 格式化昨天的短日期
    const jinnianyear = jintianday.substring(0, 4); // 获取当前年份

    let myCars_data = ""; // 初始化最终的 HTML 字符串

    $.each(myCars, function (i, field) {
        const yuanurl = field.cateid === 18 && field.yuanurl ? ` data-yuanurl="${field.yuanurl}"` : ''; // 判断是否有原网址

        // 生成时间标签
        let timebiaoqian;
        if (field.datetime === jintianday) {
            timebiaoqian = `<time class="badge red" datetime="${field.datetime}" title="${field.datetime} ${field.shorttime}">${field.shorttime}</time>`;
        } else if (field.datetime === zuotianday) {
            timebiaoqian = `<time class="badge" datetime="${field.datetime}" title="${field.datetime} ${field.shorttime}">${zuoriday} ${field.shorttime}</time>`;
        } else if (typeof field.datetime === 'string' && field.datetime.startsWith(jinnianyear)) {
            timebiaoqian = `<time class="badge" datetime="${field.datetime}" title="${field.datetime} ${field.shorttime}">${field.datetime.substring(5, 12)}</time>`;
        } else {
            timebiaoqian = `<time class="badge" datetime="${field.datetime}" title="${field.datetime} ${field.shorttime}">${field.datetime}</time>`;
        }

        
        
        if (field.title) {
            var cleanTitle = field.title.replace(/<\/?em>/gi, ''); 
            
            myCars_data += '<li class="article-list">' +
                '<span class="figure cg' + field.cateid + '"></span>' +
                '<p class="title">' +
                    timebiaoqian +
                    '<span class="badge com">' +
                        '<i class="iconfont icon-comment"></i>' + field.comments +
                    '</span>' +
                    '<a href="' + field.url + '" title="' + cleanTitle + '" target="_blank" ' +
                      'data-catename="' + field.catename + '" data-content="' + field.content + '" ' +
                      'data-comments="' + field.comments + '" data-louzhu="' + field.louzhu + '" ' +
                      'data-louzhuregtime="' + field.louzhuregtime + '"' + yuanurl + '>' +
                        field.title +
                    '</a>' +
                '</p>' +
            '</li>';
        }
    });

    return myCars_data;
}


function zdm_listtimechuli(myCars) {
    const newjinday = new Date(); // 获取当前日期
    const newzuoday = new Date(newjinday - 1000 * 60 * 60 * 24); // 获取昨天的日期
    const jintianday = `${newjinday.getFullYear()}-${add0(newjinday.getMonth() + 1)}-${add0(newjinday.getDate())}`; // 格式化今天的日期
    const zuotianday =`${newzuoday.getFullYear()}-${add0(newzuoday.getMonth() + 1)}-${add0(newzuoday.getDate())}`; // 格式化昨天的日期
    const zuoriday = `${add0(newzuoday.getMonth() + 1)}-${add0(newzuoday.getDate())}`; // 格式化昨天的短日期
    const jinnianyear = jintianday.substring(0, 4); // 获取当前年份

    let myCars_data = ""; // 初始化最终的 HTML 字符串

    $.each(myCars, function (i, field) {
        // 生成时间标签
        let timebiaoqian;
        let posttime =new Date(field.posttime * 1000);
        field.datetime = `${posttime.getFullYear()}-${add0(posttime.getMonth() + 1)}-${add0(posttime.getDate())}`;
        field.shorttime = `${posttime.getHours()}:${add0(posttime.getMinutes())}`;
        
        if (field.datetime === jintianday) {
            timebiaoqian =
                `<time class="badge red" datetime="${field.datetime}" title="${field.datetime} ${field.shorttime}">${field.shorttime}</time>`;
        } else if (field.datetime === zuotianday) {
            timebiaoqian =
                `<time class="badge" datetime="${field.datetime}" title="${field.datetime} ${field.shorttime}">${zuoriday} ${field.shorttime}</time>`;
        } else if (typeof field.datetime === 'string' && field.datetime.startsWith(jinnianyear)) {
            timebiaoqian =
                `<time class="badge" datetime="${field.datetime}" title="${field.datetime} ${field.shorttime}">${field.datetime.substring(5, 12)}</time>`;
        } else {
            timebiaoqian =
                `<time class="badge" datetime="${field.datetime}" title="${field.datetime} ${field.shorttime}">${field.datetime}</time>`;
        }



        if (field.title) {
            myCars_data += '<li class="article-list">' +
                '<span class="figure cg19"></span>' +
                '<p class="title">' + timebiaoqian +
                '<span class="badge com">' +
                '<i class="iconfont icon-RMB"></i>' + field.price +
                '</span>' +
                '<a href="' + field.url + '" title="' + field.title + '" target="_blank" ' +
                'data-type="' + field.type + '" ' +
                'data-brand="' + field.brand + '" ' +
                'data-mall_name="' + field.mall_name + '" ' +
                'data-category_name="' + field.category_name + '" ' +
                'data-price="' + field.price + '">' + field.title +
                '</a>' +
                '</p>' +
                '</li>';
        }

    });

    return myCars_data;
}

function zdm_checkMatches(item_gjc, item_pbc, groupValue) {
    const gjcMatches = item_gjc && new RegExp(item_gjc).test(groupValue);
    const pbcMatches = item_pbc && new RegExp(item_pbc).test(groupValue);
    if (gjcMatches && pbcMatches) {
        return true;
    }
    if (item_gjc && !gjcMatches) {
        return true;
    }
    if (item_pbc && pbcMatches) {
        return true;
    }
}


function zdm_listfilter(group, zdm_config) {
    const zdm_arr = Object.values(zdm_config);

    for (const item of zdm_arr) {
        if (item.Status !== 1) {
            continue;
        }
        
        if (group.type !== "smzdm") {
            // console.log("smzdm不符合")
            continue;
        }
        
        if (group.mall_name && item.mall_name && !new RegExp(item.mall_name).test(group.mall_name)) {
            // console.log("商城不符合")
            continue;
        }
        
        
        if ((item.Miprice !== "" && group.price!== "" && Number(group.price) < Number(item.Miprice)) || (item.Mxprice !== "" && group.price!== "" && Number(group.price) > Number(item.Mxprice))) {
                // console.log("价格不符合"+group.title+group.price)
            continue;
        }

        if (group.title && zdm_checkMatches(item.title_gjc, item.title_pbc, group.title)) {
            // console.log("标题不符合")
            continue;
        }

        if (group.brand && zdm_checkMatches(item.brand_gjc, item.brand_pbc, group.brand)) {
            // console.log("品牌不符合")
            continue;
        }

        if (group.category_name && zdm_checkMatches(item.category_gjc, item.category_pbc, group.category_name)) {
            // console.log("分类不符合")
            continue;
        }
        return true;
    }
    return false;
}




function zdm_liebiaoshaixuan(zdm_config) {
    $("#mainbox .new-post .article-list:not(.top) .title a").each(function () {
        var shuzhu = {
            title: $(this).text().toString(),
            price: $(this).data("price"),
            type: $(this).attr('data-type') ? $(this).attr('data-type').toString() : '',
            brand: $(this).attr('data-brand') ? $(this).attr('data-brand').toString() : '',
            mall_name: $(this).attr('data-mall_name') ? $(this).attr('data-mall_name').toString() : '',
            category_name: $(this).attr('data-category_name') ? $(this).attr('data-category_name').toString() : ''
        };
        
        if (zdm_listfilter(shuzhu, zdm_config) == false) {
            $(this).parent().parent().remove();
        }
    });
}
