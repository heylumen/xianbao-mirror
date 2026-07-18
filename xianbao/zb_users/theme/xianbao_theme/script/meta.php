$(function () {initGM("2.3");        window.shuaswitch="on";        window.addhtmlarr=[];        window.worker = new Worker("/plus/worker.js?v=24011");        var postjson={};        postjson.url= "/plus/json/push_16.json";        postjson.jiangeshijian=5;        worker.postMessage(postjson);        worker.onmessage = function (event) {        var xindata = event.data;                                    if(xindata.msg == "设定倒计时"){                $(".shuatime").html("将在&nbsp;<span class=\"cache_time\">"+xindata.content+"</span>&nbsp;秒后刷新");            }else if (xindata.msg == "获取到json数据") {                            var olddata = $(".listbox .new-post").html();                var mydataCars=[];                if(xindata.cateid=="18"){xindata.url=xindata.yuanurl;}                var rega = new RegExp(xindata.url, "i");                                if (olddata && !olddata.match(rega)) {                    if(xindata.cateid!="18"){xindata.url=window.location.protocol+"//"+window.location.host+ xindata.url;}                    if (listfilter(xindata, "", "", "", "","(.*)", "赚客吧###(.*)", "", "", "", "", "")==false) {                    return;                    }if (listfilter(xindata, "", "","","","","","","","","","") == false) {                logUniqueMessage("不符合全局规则category：" +  xindata.title + "  " + xindata.url + "\r\n","log");                return;                }                    /*console.log("添加：" + xindata.title + "-----------\r\n");*/                                        window.addhtmlarr.push(xindata);                                                    }            }else if (xindata.msg == "获取json数据结束") {                if (window.addhtmlarr[0]) {                    addhtml=listtimechuli(window.addhtmlarr);                    addhtml=addhtml.replace(/class="article-list"/g,'class="article-list newer newest"');                    $(".shuatime").html("成功获取新文章");                    $(".listbox .article-list").removeClass("newest");                    if ($(".listbox .new-post .top:last").length > 0) {                        $(".listbox .new-post .top:last").after(addhtml);                    } else {                        $(".listbox .new-post").prepend(addhtml);                    }                    $(".listbox .new-post .article-list:not(.top):gt(99)").remove();                    window.addhtmlarr=[];                    huanyuanurl();}else{                    $(".shuatime").html("未检测到新文章");                }                                                                                       }                                }                ;huanyuanurl();SidebarModule.init("on","十二小时榜###二十四小时榜###四十八小时榜","on",20,"","0", "","","","","","","","","","","");});$(function() {

setTimeout(function() {

if($(".pc-nav").attr("data-type")=="search"){
$("#mainbox .new-post").eq(0).prepend('<li class="article-list top"> <span class="figure cg2"></span><h2 class="title"><span class="istop">置顶</span><a href="/docs/9s9o0.html" title="线报酷搜索V3升级使用说明" target="_blank" data-cate="线报酷" data-content="线报酷" data-louzhu="线报酷">线报酷搜索V3升级使用说明</a></h2></li>');
}

const topArticles = [
  {
    html: '<li class="article-list top"><span class="figure cg2"></span><h2 class="title"><span class="istop">置顶</span><a href="/gonggao/6763.html" title="微信家校 & wxpusher 线报酷推送" target="_blank" data-catename="线报酷-公告" data-content="QQ微信交流群" data-comments="0" data-louzhu="">微信家校 & wxpusher 线报酷推送</a></h2></li>'
  },
{
    html: '<li class="article-list top"><span class="figure cg2"></span><h2 class="title"><span class="istop">置顶</span><a href="/gonggao/6763.html" title="微信家校 & wxpusher 线报酷推送" target="_blank" data-catename="线报酷-公告" data-content="QQ微信交流群" data-comments="0" data-louzhu="">微信家校 & wxpusher 线报酷推送</a></h2></li>'
  },
  {
    html: '<li class="article-list top"><span class="figure cg2"></span><h2 class="title"><span class="istop">置顶</span><a href="/gonggao/5535689.html" title="注册用户可筛选首页分类" target="_blank" data-catename="线报酷-公告" data-content="注册用户可筛选首页分类" data-comments="0" data-louzhu="">注册用户可筛选首页分类</a></h2></li>'
  },
  {
    html: '<li class="article-list top"><span class="figure cg2"></span><h2 class="title"><span class="istop">置顶</span><a href="/gonggao/5515115.html" title="新好单线报 首页分类数据库级筛选 上线" target="_blank" data-catename="线报酷-公告" data-content="新好单线报 首页分类数据库级筛选 上线" data-comments="0" data-louzhu="">新好单线报 首页分类数据库级筛选 上线</a></h2></li>'
  },
  {
    html: '<li class="article-list top"><span class="figure cg2"></span><h2 class="title"><span class="istop">置顶</span><a href="/jiaocheng/5320529.html" title="WxPusher APP 获取线报酷实时推送" target="_blank" data-catename="线报酷-公告" data-content="WxPusher APP 获取线报酷实时推送" data-comments="0" data-louzhu="">WxPusher APP 获取线报酷实时推送</a></h2></li>'
  }
];

const randomIndex = Math.floor(Math.random() * topArticles.length);
const selectedArticle = topArticles[randomIndex];

$("#mainbox .new-post").eq(0).prepend(selectedArticle.html);


}, 100);

});