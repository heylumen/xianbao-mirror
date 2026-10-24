/*! app/core.js | 全局工具与核心过滤器 | 依赖: jQuery, layer, lscache, js-md5 */
/* 20261015 页面缓存联动：重新抓取发起后 90 秒内 xb_nocache=1 cookie 使 nginx bypass
   页面缓存（conf.d/xb_pagecache.conf $xb_login_cookie map），发起人刷新立即见新内容；
   fastcgi_no_cache 同源不回写，避免采集未完成时旧内容再续 60 秒。 */
function xb_nocache_window(){try{document.cookie='xb_nocache=1;max-age=90;path=/'}catch(e){}}
function update(Article_ID){xb_nocache_window();var index=layer.load();$.get("/plus/api/update.php?act=shoudong&wzid="+Article_ID,function(data,status){xb_nocache_window();layer.close(index);layer.msg(data)});}
function zkb_password_tijiao(Article_ID){var index=layer.load();var zkbinput=$("#zkb_password_input").val();$(".zkb_password_box").remove();$.get("/plus/api/update.php?act=zkbmima&state=post&zkb_password="+zkbinput+"&wzid="+Article_ID,function(data,status){layer.close(index);layer.msg(data)});update(Article_ID)};
function add0(m) {return m < 10 ? '0' + m : m};


// —— 全局列表筛选（20260929 字面量化）——
// 词按 #/| 分割（# 为主分隔符，| 兼容历史数据），行内连续 2 个及以上 #（##/###，
// 兼容历史 ### 写法）为"分类限定"分隔——前段匹配分类名、后段匹配被测字段；
// <br>/换行 分隔多条（行间 OR）；词按原文包含匹配（忽略大小写，与旧 /i 正则一致），
// 词内 . ? + 等特殊符号按普通字符处理（不再解释为正则，消灭灾难性回溯）
// 例外：(.*) 是唯一保留的旧正则协议通配词（meta.php 只看它/分类守卫的"全部屏蔽"
// 腿仍在传它），须恒命中，否则"屏蔽全部、白名单豁免"的只看语义整体失效
function xbGWordsHit(words, subject) {
    var arr = String(words === undefined || words === null ? "" : words).split(/[#|]+/);
    var hay = String(subject === undefined || subject === null ? "" : subject).toLowerCase();
    for (var i = 0; i < arr.length; i++) {
        var w = arr[i].replace(/^\s+|\s+$/g, "").toLowerCase();
        if (w === "(.*)" || (w !== "" && hay.indexOf(w) !== -1)) { return true; }
    }
    return false;
}
function xbGFieldHit(field, subject, catename) {
    var lines = String(field === undefined || field === null ? "" : field).split(/<br>|\r\n|\r|\n/);
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].replace(/^\s+|\s+$/g, "");
        if (line === "") { continue; }
        var segs = line.split(/#{2,}/);
        if (segs.length > 1) {
            if (xbGWordsHit(segs[0], catename) && xbGWordsHit(segs.slice(1).join("##"), subject)) { return true; }
        } else if (xbGWordsHit(line, subject)) {
            return true;
        }
    }
    return false;
}
function listfilter(group,pingbifenlei,pingbilouzhu,zhanxianlouzhu,pingbilouzhuplus,pingbibiaoti,zhanxianbiaoti,pingbibiaotiplus,pingbineirong,zhanxianneirong,pingbineirongplus,pingbitime){
    var louzhubaoliu=0,biaotibaoliu=0,neirongbaoliu=0,louzhupingbi=0,louzhupingbiplus=0,biaotipingbi=0,biaotipingbiplus=0,neirongpingbi=0,neirongpingbiplus=0;
    var catename=String(group.catename===undefined||group.catename===null?"":group.catename);
    var louzhu=String(group.louzhu===undefined||group.louzhu===null?"":group.louzhu);
    var title=String(group.title===undefined||group.title===null?"":group.title);
    var content=String(group.content===undefined||group.content===null?"":group.content);
    // 楼主注册天数屏蔽（最先执行，无白名单豁免；数字比较，行内 ##/### 分类限定）
    if(pingbitime&&group.louzhuregtime){
        var gzDays=daysComputed(group.louzhuregtime);
        var tlines=String(pingbitime).split(/<br>|\r\n|\r|\n/);
        for(var t=0;t<tlines.length;t++){
            var tl=tlines[t].replace(/^\s+|\s+$/g,"");
            if(tl===""){continue}
            var tsegs=tl.split(/#{2,}/);
            if(tsegs.length>1){
                var tnum=tsegs[1].replace(/^\s+|\s+$/g,"");
                if(tnum!==""&&isFinite(Number(tnum))&&Number(tnum)>gzDays&&xbGWordsHit(tsegs[0],catename)){return false}
            }else if(isFinite(Number(tl))&&Number(tl)>gzDays){return false}
        }
    }
    if(pingbifenlei&&catename&&xbGFieldHit(pingbifenlei,catename,catename)){return false}
    if(zhanxianlouzhu&&louzhu&&xbGFieldHit(zhanxianlouzhu,louzhu,catename)){louzhubaoliu=1}
    if(pingbilouzhu&&louzhu&&louzhubaoliu!=1&&xbGFieldHit(pingbilouzhu,louzhu,catename)){louzhupingbi=1}
    if(pingbilouzhuplus&&louzhu&&louzhupingbi!=1&&xbGFieldHit(pingbilouzhuplus,louzhu,catename)){louzhupingbiplus=1;louzhubaoliu=0}
    if(louzhupingbi==1||louzhupingbiplus==1){return false}
    if(zhanxianbiaoti&&title&&xbGFieldHit(zhanxianbiaoti,title,catename)){biaotibaoliu=1}
    if(pingbibiaoti&&title&&louzhubaoliu!=1&&biaotibaoliu!=1&&xbGFieldHit(pingbibiaoti,title,catename)){biaotipingbi=1}
    if(pingbibiaotiplus&&title&&louzhubaoliu!=1&&biaotipingbi!=1&&xbGFieldHit(pingbibiaotiplus,title,catename)){biaotipingbiplus=1;biaotibaoliu=0}
    if(biaotipingbi==1||biaotipingbiplus==1){return false}
    if(zhanxianneirong&&content&&xbGFieldHit(zhanxianneirong,content,catename)){neirongbaoliu=1}
    if(pingbineirong&&content&&louzhubaoliu!=1&&biaotibaoliu!=1&&neirongbaoliu!=1&&xbGFieldHit(pingbineirong,content,catename)){neirongpingbi=1}
    if(pingbineirongplus&&content&&louzhubaoliu!=1&&biaotibaoliu!=1&&neirongpingbi!=1&&xbGFieldHit(pingbineirongplus,content,catename)){neirongpingbiplus=1;neirongbaoliu=0}
    if(neirongpingbi==1||neirongpingbiplus==1){return false}
    return true
}

function change_icon(url){var favicon=document.querySelector('link[rel="shortcut icon"]')||document.querySelector('link[rel="icon"]');if(!favicon){favicon=document.createElement('link');favicon.rel='shortcut icon';document.head.appendChild(favicon)}if(url){favicon.href=url}}
function change_title(data,interval,fallback){var arr=typeof data==='string'?data.split("###").filter(function(t){return t!==""}).map(function(t){return{t:t,i:''}}):(data||[]);if(!arr.length){return}function suiji(){var p=arr[Math.floor(Math.random()*arr.length)];document.title=p.t;var icon=p.i||fallback||'';if(icon){change_icon(icon)}}suiji();if(interval>0){setInterval(function(){if(!document.hidden){suiji()}},interval*1000)}}
function yuanditiaozhuan(){document.addEventListener('click',function(event){var noddy=event.target;while(noddy&&noddy.nodeName!=="A"&&noddy.nodeName!=="HTML"){noddy=noddy.parentNode}if(noddy&&noddy.nodeName==="A"&&'href'in noddy&&noddy.href.indexOf('http')!==-1){event.preventDefault();document.location.href=noddy.href}},false)}
function moyu_laoban(url){document.addEventListener('keydown',function(e){var t=e.target||{};if(/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)||t.isContentEditable){return}if(e.key==='`'||e.key==='~'||e.keyCode===192){e.preventDefault();window.location.href=url}},false)}
function checkAuditTime(beginTime,endTime){var nowDate=new Date();var beginDate=new Date(nowDate);var endDate=new Date(nowDate);var beginIndex=beginTime.lastIndexOf("\:");var beginHour=beginTime.substring(0,beginIndex);var beginMinue=beginTime.substring(beginIndex+1,beginTime.length);beginDate.setHours(beginHour,beginMinue,0,0);var endIndex=endTime.lastIndexOf("\:");var endHour=endTime.substring(0,endIndex);var endMinue=endTime.substring(endIndex+1,endTime.length);endDate.setHours(endHour,endMinue,0,0);return nowDate.getTime()-beginDate.getTime()>=0&&nowDate.getTime()<=endDate.getTime()}
function shenchatime(confing){var tongguo;if(confing.match(new RegExp(/<br>/),"g")){var confingarr=confing.split("<br>");for(j=0;j<confingarr.length;j++){if(confingarr[j].match(new RegExp(/-/),"g")){let conarr=confingarr[j].split("-");if(checkAuditTime(conarr[0],conarr[1])===true){tongguo=1;break}}}}else{if(confing.match(new RegExp(/-/),"g")){let conarr=confing.split("-");if(checkAuditTime(conarr[0],conarr[1])===true){tongguo=1}}}if(tongguo==1){return true}else{return false}}
function getQueryVariable(variable){var query=window.location.search.substring(1);var vars=query.split("&");for(var i=0;i<vars.length;i++){var pair=vars[i].split("=");if(pair[0]==variable){return decodeURIComponent(pair[1])}}return(false)}
;
function sortByKey(arr,key,order){for(i=0;i<arr.length;i++){for(j=i+1;j<arr.length;j++){if(order=="desc"){if(parseFloat(arr[i][key])<=parseFloat(arr[j][key])){var min=arr[i];arr[i]=arr[j];arr[j]=min}}else{if(parseFloat(arr[i][key])>=parseFloat(arr[j][key])){var max=arr[i];arr[i]=arr[j];arr[j]=max}}}}return arr};
function updateapp(newbanbenhao){if(isWebapp()){if(window.webapp.getcode()<newbanbenhao){layer.confirm("检测到线报酷APP有升级，<br><br>请点击立即升级后下载升级。",{btn:["立即更新","取消"],},function(index){window.open("/gonggao/1597146.html");layer.close(index)},function(){layer.msg("不升级无法享受新功能喔！")})}}}
function isMobile(){var userAgentInfo=navigator.userAgent;var mobileAgents=["Android","iPhone","SymbianOS","Windows Phone","iPad","iPod"];var mobile_flag=false;for(var v=0;v<mobileAgents.length;v++){if(userAgentInfo.indexOf(mobileAgents[v])>0){mobile_flag=true;break}}var screen_width=window.screen.width;var screen_height=window.screen.height;if(screen_width<500&&screen_height<800){mobile_flag=true}return mobile_flag}
function isWebapp(){var userAgentInfo=navigator.userAgent;var isapp=false;if(userAgentInfo.indexOf("xianbaoku webapp")>0){var isapp=true}return isapp}
function jiance_time(type,name,config,def){if(!config||!type)return def||5;if(config.includes("###")){const configArr=config.split("<br>");let g="";for(let j=0;j<configArr.length;j++){const xiaoConfigArr=configArr[j].split("###");if(xiaoConfigArr.length===1&&/^\d+$/.test(xiaoConfigArr[0])&&xiaoConfigArr[0]!=="0"){g=xiaoConfigArr[0];continue}if(type==="index"){name="首页"}if(new RegExp(xiaoConfigArr[0],"i").test(name)&&/^\d+$/.test(xiaoConfigArr[1])){return xiaoConfigArr[1]}}return g||def||5}else{return/^\d+$/.test(config)?config:(def||5)}return def||5}

function logUniqueMessage(message,type) {
    const hash = md5(message);
    if (!lscache.get(hash)) {
        if(type=="log"){
        console.log(message);
        }else if(type=="warn"){
            console.warn(message);
        }else if(type=="error"){
            console.error(message);
        }else {
            console.warn("Unsupported logUniqueMessage log type:"+ type);
        }
        lscache.set(hash, true, 300);
    }
}
