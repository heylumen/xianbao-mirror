/*! app/comment.js | 评论与内容交互：链接化/表情面板/评论工具/Fancybox绑定 | 依赖: jQuery, ClipboardJS, Fancybox */
/*text to link*/
$(function(){$(".art-comment-content .clbody .p").each(function(index,element){$(this).html($(this).html().replace(/\[s-(.*?)\]/ig,'<img class="expression" src="/zb_users/theme/xianbao_theme/image/expression/$1.png"/>'));$(this).html($(this).html().replace(/\[img\]*(.*?)\[\/img\]/ig,'<img src="$1" data-fancybox="commnet-img" title="查看大图"/>'))});const linkRegex=/(http|ftp|https):\/\/[\w\-_]+(\.[\w\-_]+)+([\w\-\.,@?^=%&:/~\+#;{}"']*[\w\-\@?^=%&/~\+#])?/g;const excludeTags=['head','script','style','iframe','input','textarea','select','button','option','label','nav','noscript','code','pre','svg','image','audio','video'];function shouldExcludeNode(node){if(node&&node.parentNode){return excludeTags.includes(node.parentNode.tagName.toLowerCase())}return false}function linkifyNode(node){if(node.nodeType===Node.TEXT_NODE){const text=node.textContent;let newText='';let lastIndex=0;let match=linkRegex.exec(text);while(match!==null){const prefix=text.slice(lastIndex,match.index);lastIndex=match.index+match[0].length;const link=match[0];newText+=`${prefix}<a href='${link}'target='_blank'>${link}</a>`;match=linkRegex.exec(text)}newText+=text.slice(lastIndex);if(newText!==text){const newNode=document.createElement('span');newNode.innerHTML=newText;node.parentNode.replaceChild(newNode,node)}}else if(node.nodeType===Node.ELEMENT_NODE&&!shouldExcludeNode(node)&&!$(node).is('a')){node.childNodes.forEach(linkifyNode)}}const containers=$('.post-comment, .article-content');containers.each(function(){linkifyNode(this)});const observer=new MutationObserver(mutations=>{mutations.forEach(mutation=>{const addedNodes=Array.from(mutation.addedNodes);addedNodes.forEach(node=>{if(node.nodeType===Node.ELEMENT_NODE&&($(node).is('.post-comment, .article-content')||$(node).closest('.post-comment, .article-content').length)){linkifyNode(node)}})})});observer.observe(document.body,{childList:true,subtree:true})});
zbp.plugin.unbind("comment.reply.start","system-default");zbp.plugin.on("comment.reply.start","suiran_air",function(i){$("#inpRevID").val(i);var replydata=$("#AjaxComment"+i).parent().parent().html();var newdata=replydata.match(/<a class="author"([^>]*)>([^<]*)<([\s\S]*?)<div class="p">(.*?)<label/);var name=newdata[2];var connect=newdata[4].replace(/(\s*)<a([^>]*)class="comment-at"([^>]*)>([^<]*)<\/a>(\s*)/ig,"");$("#com-tishi").html("正在回复："+name+" ( "+connect+" )");$("#cancel-reply").show().bind("click",function(){$("#com-tishi").html("欢迎您发表评论：");$("#inpRevID").val(0);$("#cancel-reply").hide();window.location.hash="#commentbox";return false})});zbp.plugin.on("comment.post.success","suiran_air",function(t,e,n,o){$("#com-tishi").html("欢迎您发表评论：");var inprevid=$("#inpRevID").val();if(inprevid>0){var adddata=$("#AjaxComment"+inprevid).next().prop("outerHTML")+$("#AjaxComment"+inprevid).next().next().prop("outerHTML");$("#AjaxComment"+inprevid).next().next().remove();$("#AjaxComment"+inprevid).next().remove();$("#AjaxComment"+inprevid).parent().parent().parent().after(adddata);window.location.hash="#cmt"+inprevid}else{window.location.hash="#commentbox"}$("#inpRevID").val(0);$("#cancel-reply").hide();$(".comment-list").show();$(".art-comment-content .clbody").each(function(index,element){$(this).html($(this).html().replace(/\[s-(.*?)\]/ig,"<img  class=\"expression\" src=\"/zb_users/theme/xianbao_theme/image/expression/$1.png\" />"));$(this).html($(this).html().replace(/\[img\]*(.*?)\[\/img\]/ig,'<a href="$1" data-fancybox="images" target="_blank" title="查看大图"><img src="$1"/></a>'))})});
$(function () {
    // 表情面板显示控制
    $(".smilebg").on('mouseleave', function () {
        $(this).slideUp(200);
    });

    // 表情数据
    const emojis = [
        {alt: "[微笑]", name: "weixiao"}, {alt: "[害羞]", name: "haixiu"}, 
        {alt: "[眨眼睛]", name: "zhayanjing"}, {alt: "[晕]", name: "yun"},
        {alt: "[衰]", name: "shuai"}, {alt: "[闭嘴]", name: "bizhui"},
        {alt: "[机智]", name: "jizhi"}, {alt: "[求关注]", name: "qiuguanzhu"},
        {alt: "[指你]", name: "zhini"}, {alt: "[耶]", name: "ye"},
        {alt: "[捂脸]", name: "wulian"}, {alt: "[色]", name: "se"},
        {alt: "[打脸]", name: "dalian"}, {alt: "[憨笑]", name: "hanxiao"},
        {alt: "[哈欠]", name: "haqian"}, {alt: "[惊恐]", name: "jingkong"},
        {alt: "[爱心]", name: "aixin"}, {alt: "[盯着]", name: "dingzhe"},
        {alt: "[想哭]", name: "xiangku"}, {alt: "[鼓掌]", name: "guzhang"},
        {alt: "[发呆]", name: "fadai"}, {alt: "[偷笑]", name: "touxiao"},
        {alt: "[石化]", name: "shihua"}, {alt: "[坏笑]", name: "huaixiao"},
        {alt: "[抓狂]", name: "zhuakuang"}, {alt: "[流泪]", name: "liulei"},
        {alt: "[想钱]", name: "xiangqian"}, {alt: "[亲亲]", name: "qinqin"},
        {alt: "[笑哭]", name: "xiaoku"}, {alt: "[哭笑不得]", name: "kuxiaobude"},
        {alt: "[张嘴色]", name: "zhangzhuise"}, {alt: "[大哭]", name: "daku"},
        {alt: "[恐惧]", name: "kongju"}, {alt: "[笑眯眯]", name: "xiaomimi"},
        {alt: "[哭兮兮]", name: "kuxixi"}, {alt: "[抠鼻]", name: "koubi"},
        {alt: "[白眼]", name: "baiyan"}, {alt: "[互粉]", name: "hufen"},
        {alt: "[自责]", name: "zhize"}, {alt: "[鄙视]", name: "bishi"},
        {alt: "[大亲]", name: "daqin"}, {alt: "[露牙笑]", name: "louyaxiao"},
        {alt: "[呲牙]", name: "ciya"}, {alt: "[思考]", name: "shikao"},
        {alt: "[滑稽]", name: "huaji"}, {alt: "[吐血]", name: "tuxue"},
        {alt: "[虚]", name: "xu"}, {alt: "[墨镜笑]", name: "mojingxiao"},
        {alt: "[吓]", name: "xia"}, {alt: "[可怜]", name: "kelian"},
        {alt: "[口罩]", name: "kouzhao"}, {alt: "[睡]", name: "shui"},
        {alt: "[再见]", name: "zaijian"}, {alt: "[鸭嘴]", name: "yazhui"},
        {alt: "[发怒]", name: "fanu"}, {alt: "[黑脸]", name: "heilian"},
        {alt: "[狗头]", name: "goutou"}, {alt: "[黄狗头]", name: "huangtougou"},
        {alt: "[灰狗头]", name: "huigoutou"}, {alt: "[呆狗头]", name: "daigoutou"},
        {alt: "[炸弹]", name: "zadan"}, {alt: "[玫瑰花]", name: "meiguihua"},
        {alt: "[唇]", name: "chen"}, {alt: "[去污粉]", name: "quwufen"},
        {alt: "[黄瓜]", name: "huanggua"}, {alt: "[666]", name: "666"},
        {alt: "[啤酒]", name: "pijiu"}, {alt: "[赞]", name: "zan"},
        {alt: "[握手]", name: "woshou"}, {alt: "[祈祷]", name: "qidao"},
        {alt: "[吐彩虹]", name: "tucaihong"}, {alt: "[吃瓜]", name: "chigua"},
        {alt: "[亲嘴]", name: "qinzhui"}, {alt: "[调皮]", name: "tiaopi"},
        {alt: "[吐]", name: "tu"}, {alt: "[心]", name: "xin"},
        {alt: "[心碎]", name: "xinshui"}, {alt: "[屎]", name: "shi"},
        {alt: "[礼盒]", name: "lihe"}, {alt: "[蛋糕]", name: "dangao"},
        {alt: "[礼炮]", name: "lipao"}, {alt: "[刀]", name: "dao"},
        {alt: "[18禁]", name: "18jin"}, {alt: "[给力]", name: "geili"},
        {alt: "[亮眼]", name: "liangyan"}, {alt: "[小笑]", name: "xiaoxiao"},
        {alt: "[大汗]", name: "dahan"}, {alt: "[小眼]", name: "xiaoyan"},
        {alt: "[大赞]", name: "dazan"}, {alt: "[擦汗]", name: "chahan"},
        {alt: "[墨镜]", name: "mojin"}, {alt: "[吸烟]", name: "xiyan"},
        {alt: "[卖萌]", name: "maimeng"}, {alt: "[摸头]", name: "motou"},
        {alt: "[敲头]", name: "qiaotou"}, {alt: "[嗅大了]", name: "xiudale"},
        {alt: "[奋斗]", name: "fendou"}, {alt: "[绿帽]", name: "lvmao"}
    ];

    // 生成表情HTML - 使用传统for循环和字符串拼接
    var emojisHTML = '';
    for (var i = 0; i < emojis.length; i++) {
        var emoji = emojis[i];
        emojisHTML += '<a href="javascript:grin(\'[s-' + emoji.name + ']\')" title="' +
                     emoji.alt + '"><img src="/zb_users/theme/xianbao_theme/image/expression/' + 
                     emoji.name + '.png" alt="' + emoji.alt + '"/></a>';
    }

    // 插入表情HTML
    $(".compost .arrow").after(emojisHTML);
});

function tool_img(){layer.prompt({formType:0,title:'请输入网络图片链接',value:'',area:['300px','70px'],btn:['确认','打开图床','取消'],btn2:function(index,elem){var value=$('#layui-layer'+index+" .layui-layer-input").val();layer.msg("正在打开图床，上传图片获取直链后粘贴进输入框");window.open("https://www.hualigs.cn/");return false},btnAlign:'c',},function(value,index,elem){if((value.indexOf("http")!=-1)&&(value.indexOf(".jpg")!=-1||value.indexOf(".jpeg")!=-1||value.indexOf(".gif")!=-1||value.indexOf(".png")!=-1)){document.getElementById('txaArticle').value=document.getElementById('txaArticle').value+'[img]'+value+'[/img]';layer.close(index)}else{layer.msg("请输入正确的图片链接")}})}
function tool_bq(){if($('.smilebg').css('display')=='none'){$('.smilebg').slideDown(200)}else{$('.smilebg').slideUp(200)}}
function grin(tag){var myField;tag=''+tag+'';if(document.getElementById('txaArticle')&&document.getElementById('txaArticle').type=='textarea'){myField=document.getElementById('txaArticle')}else{return false}if(document.selection){myField.focus();sel=document.selection.createRange();sel.text=tag;myField.focus()}else if(myField.selectionStart||myField.selectionStart=='0'){var startPos=myField.selectionStart;var endPos=myField.selectionEnd;var cursorPos=endPos;myField.value=myField.value.substring(0,startPos)+tag+myField.value.substring(endPos,myField.value.length);cursorPos+=tag.length;myField.focus();myField.selectionStart=cursorPos;myField.selectionEnd=cursorPos}else{myField.value+=tag;myField.focus()}$(".smilebg").slideUp(200)}
$(function(){$(".art-comment-content .clbody .p").each(function(index,element){$(this).html($(this).html().replace(/\[S(([1-4]?[0-9])|50)\]/ig,"<img  class=\"expression\" src=\"/zb_users/theme/xianbao_theme/image/face/$1.gif\" />"));$(this).html($(this).html().replace(/\[img\]*(.*?)\[\/img\]/ig,"<a href=\"$1\" data-fancybox=\"images\" target=\"_blank\" title=\"查看大图\"><img src=\"$1\"/></a>"))})});
function daysComputed(time){var oldTimeFormat=new Date(time.replace(/-/g,'/'));var nowDate=new Date();if(nowDate.getTime()-oldTimeFormat.getTime()>0){var times=nowDate.getTime()-oldTimeFormat.getTime();var days=parseInt(times/(60*60*24*1000));return days}else{return 0}}
function getTime(timestamp){var date=new Date(timestamp*1000);let Y=date.getFullYear(),M=(date.getMonth()+1<10?'0'+(date.getMonth()+1):date.getMonth()+1),D=(date.getDate()<10?'0'+(date.getDate()):date.getDate()),h=(date.getHours()<10?'0'+(date.getHours()):date.getHours()),m=(date.getMinutes()<10?'0'+(date.getMinutes()):date.getMinutes()),s=(date.getSeconds()<10?'0'+(date.getSeconds()):date.getSeconds());return Y+'-'+M+'-'+D+' '+h+':'+m+':'+s}
$(function(){if($("#dianping").length){$("#dianping .comment-list .title").append('<span class="fr pinglunshunxu noselect" onclick="javascript:pinglunshunxu();">↹&nbsp;顺序</span>')}else{$("#comment .comment-list .title").append('<span class="fr pinglunshunxu noselect" onclick="javascript:pinglunshunxu();">↹&nbsp;顺序</span>')}})
function pinglunshunxu(){if(window.shunxuping&&window.shunxuping!="on"){window.shunxuping="on";$(".art-fujia-content .comment-list .pinglunshunxu").removeClass("pinglunshunxu-hover")}else{window.shunxuping="off";$(".art-fujia-content .comment-list .pinglunshunxu").addClass("pinglunshunxu-hover")}if($("#dianping").length){var newdianping="";$("#dianping .comment-list .ul").each(function(){newdianping='<div class="'+$(this).attr('class')+'">'+$(this).html()+'</div>'+newdianping;$(this).remove()});$("#dianping .comment-list").append(newdianping)}if($("#comment").length){var newcomment="";$("#comment .comment-list .ul").each(function(){newcomment='<div class="'+$(this).attr('class')+'">'+$(this).html()+'</div>'+newcomment;$(this).remove()});$("#comment .comment-list").append(newcomment)}}
function chakanlouzhu(){if(window.showlouzhu&&window.showlouzhu!="on"){window.showlouzhu="on";$(".art-fujia-content .comment-list .showlouzhu").removeClass("showlouzhu-hover")}else{window.showlouzhu="off";$(".art-fujia-content .comment-list .showlouzhu").addClass("showlouzhu-hover")}$(".art-fujia-content .comment-list .ul").each(function(){var jqObj=$(this);if(window.showlouzhu=="off"){if(!jqObj.has('.level-louzu').length){$(jqObj).addClass("hide")}}else{$(jqObj).removeClass("hide")}})}

function chulilouzhu(mode){if(mode=="自动"){if($("#dianping").length){$("#dianping .comment-list .title").append('<span class="fr showlouzhu noselect showlouzhu-hover">只看楼主</span>')}else{$("#comment .comment-list .title").append('<span class="fr showlouzhu noselect showlouzhu-hover">只看楼主</span>')}chakanlouzhu();setTimeout(function(){$(".art-fujia-content .comment-list .showlouzhu").click(function(){chakanlouzhu()})},50)}else if(mode=="手动"){if($("#dianping").length){$("#dianping .comment-list .title").append('<span class="fr showlouzhu noselect">只看楼主</span>');setTimeout(function(){$(".art-fujia-content .comment-list .showlouzhu").click(function(){chakanlouzhu()})},50)}else{$("#comment .comment-list .title").append('<span class="fr showlouzhu noselect">只看楼主</span>');setTimeout(function(){$(".art-fujia-content .comment-list .showlouzhu").click(function(){chakanlouzhu()})},50)}}}
function pinglunshuchuli(shezhi){pinglunshuarr=shezhi.split("<br>");for(j=0;j<pinglunshuarr.length;j++){xiaopinglunshuarr=pinglunshuarr[j].split("###");if(xiaopinglunshuarr[0]=="列表页"){list_comment("list",xiaopinglunshuarr[1])}else if(xiaopinglunshuarr[0]=="排行榜"){list_comment("bangdan",xiaopinglunshuarr[1])}}}
function list_comment(quyu,yangshi){if(quyu=="list"){yuansu="#mainbox .new-post .article-list:not(.top) .title a"}else if(quyu=="bangdan"){yuansu=".theiaStickySidebar .new-post a"}else if(quyu=="guesslike"){yuansu=".xiangguan .new-post a"}else{return}$(yuansu).each(function(){var jqObj=$(this).parent();if(!jqObj.has('.com').length){var comshu=$(this).data("comments").toString();$(this).before('<span class="badge com"><i class="iconfont icon-comment"></i>'+comshu+'</span>')}})}
$(function(){Fancybox.bind("[data-fancybox]",{Toolbar:{display:{left:["infobar"],middle:["zoomIn","zoomOut","toggle1to1","rotateCCW","rotateCW"],right:["thumbs","close"],},},Thumbs:{type:"classic",}})});
