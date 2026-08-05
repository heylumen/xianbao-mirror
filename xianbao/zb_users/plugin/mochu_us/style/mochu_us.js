/**
 * @author Mochu
 * @copyright (C) http://www.73so.com
 * @Buyurl https://app.zblogcn.com/?id=1712
 */

(function(){
    if($('#mochu_us_post_article').length > 0 || $("#mochu_us_post_shoucang").length > 0){
        var artid = 0;
        if($('#mochu_us_post_article').length > 0){
            artid = $('#mochu_us_post_article').attr('data-id');
        }else if($("#mochu_us_post_shoucang").length > 0){
            artid = $('#mochu_us_post_shoucang').attr('data-id');
        }
        $.ajax({
            type: "POST",
            url: bloghost + "zb_users/plugin/mochu_us/function_user.php?act=article_cache",
            data: {
                'id':artid,
                'hide': ($('#mochu_us_post_article').length > 0),
                'buts': ($('#mochu_us_post_shoucang').length > 0),
            },
            dataType: "json",
            success: function (res) {
                if(res.hide != ''){
                    $('#mochu_us_post_article').css("display","block").html(res.hide);
                }
                if(res.buts != ''){
                    $("#mochu_us_post_shoucang").html(res.buts);
                }
            }
        });
    }
}());

/* ################################ */
window.mochu_us_arthides = function(aid)
{
    var inde = layer.load(2);
    $.ajax({
        type: 'POST',
        url: bloghost + "zb_users/plugin/mochu_us/function_user.php?act=arthidebuys",
        data: {'aid':aid},
        dataType: 'json',
        success: function (res) {
            layer.close(inde);
            if(res.code == '0'){
                layer.msg(res.msg);
                $('.mochu_us_artziyuan').addClass('mochu_us_artziyuan_res').html('').html(res.html);
            } else if(res.code == 'url'){
                layer.open({
                    type: 0,
                    shadeClose: true,
                    title:['提示:'],
                    content: res.msg,
                    btn: [res.butname, '关闭'],
                    yes: function () {
                        window.open(res.url, "_blank");
                        layer.closeAll();
                    }
                });
            } else if(res.code == 'payrmb'){
                layer.open({
                    skin:'layui-layer-mochu',
                    title: '购买资源：',
                    type: 1,
                    area: ['300px', 'auto'],
                    closeBtn: 0,
                    content: res.html,  
                });

            } else {
                layer.alert(res.msg, { icon: 0 });
            }
        },error:function(){layer.close(inde);layer.alert('Error!', { icon: 0 });}
    });
};

window.mochu_us_arthidevipfree = function(aid)
{
    var inde = layer.load(2);
    $.ajax({
        type: 'POST',
        url: bloghost + "zb_users/plugin/mochu_us/function_user.php?act=arthidebuys_free",
        data: {'aid':aid},
        dataType: 'json',
        success: function (res) {
            layer.close(inde);
            if(res.code == '0'){
                layer.msg(res.msg);
                $('.mochu_us_artziyuan').addClass('mochu_us_artziyuan_res').html('').html(res.html);
            } else if(res.code == 'url'){
                layer.open({
                    type: 0,
                    shadeClose: true,
                    title:['提示:'],
                    content: res.msg,
                    btn: [res.butname, '关闭'],
                    yes: function () {
                        window.open(res.url, "_blank");
                        layer.closeAll();
                    }
                });
            } else {
                layer.alert(res.msg, { icon: 0 });
            }
        },error:function(){layer.close(inde);layer.alert('Error!', { icon: 0 });}
    });
}


/* ################################ */

//no data sta
$("body").on("click", "#mochu-us-xubuy", function () { var inde = layer.load(2); var id = $(this).attr("data-type"); $.post(bloghost + "zb_users/plugin/mochu_us/function_user.php?act=buyxuweizhang", { "id": id }, function (res) { layer.closeAll(); if (res.code == 1) { layer.alert(res.msg, { icon: 0 }) } else { layer.msg(res.msg, { icon: 1 }); $('.mochu_us_article_buy_content').html(res.centent);} }, "json") });
//no data end


$("body").on('click', '.Sign', function () { Sign(); }); function Sign() { var index = layer.load(2); $.getJSON(bloghost +"zb_users/plugin/mochu_us/cmd.php?act=qiandao", {}, function (res) { layer.closeAll(); if (res.code == 1) { layer.alert(res.msg, { icon: 0 }) } else { layer.alert(res.msg, { icon: 1 }) } }) };
$("body").on("click", ".mochu-us-coll", function () { var id = $(this).attr("date-acid");  $.post(bloghost +"zb_users/plugin/mochu_us/function_user.php?act=addshoucang",  { "id": id },  function (res) {  if (res.code == 1) { layer.alert(res.msg, { icon: 0 }); } else if (res.code == 0){  layer.msg(res.msg, { icon: 1 });  $(".mochu-us-coll").text("已收藏 | " + res.size); $('.mochu-us-coll').addClass('mochu-us-buttonhover'); }else{layer.msg(res.msg, { icon: 1 }); $(".mochu-us-coll").text("收藏 | " + res.size); $('.mochu-us-coll').removeClass('mochu-us-buttonhover'); } }, "json")});   
$('body').on('click','.mochu-us-zan',function(){ var id = $(this).attr('date-acid'); $.ajax({ type: "POST", url: bloghost +"zb_users/plugin/mochu_us/function_user.php?act=zan", data: {'id':id}, dataType: "json", success: function (res) { if(res.code == 1){ layer.alert(res.msg, { icon: 0 }); } else if (res.code == 0){ $('.mochu-us-zan').text('已赞 | '+res.size); $('.mochu-us-zan').addClass('mochu-us-buttonhover'); }else{ $('.mochu-us-zan').text('点赞 | '+res.size);  $('.mochu-us-zan').removeClass('mochu-us-buttonhover');} }, error: function () {layer.alert('数据获取失败', { icon: 0 }); }});});
$('body').on('click','.mochu-us-shangbutton',function(){ $('.mochu-us-shangbutton').removeClass('mochu-us-shangbuttons'); $(this).addClass('mochu-us-shangbuttons');});
$('body').on('click', '.mochu-us-shang', function () { var index = layer.load(2); var id = $(this).attr('date-acid'); $.ajax({ type: "POST", url: bloghost +"zb_users/plugin/mochu_us/function_user.php?act=shanghtml", data: { 'id': id }, dataType: "json", success: function (res) {layer.closeAll(); if(res.code == 1){ layer.alert(res.msg, { icon: 0 }); }else{ layer.open({ title:['打赏作者：'], type: 1, area: ['350px', 'auto'], content: res.html  }); } }, error: function () { layer.closeAll(); layer.alert('数据获取失败', { icon: 0 }); } }); });
$('body').on('click','.mochu-us-shang-div-span',function(){ var index = layer.load(2); var id = $('.mochu-us-shang').attr('date-acid'); var giod = $('.mochu-us-shangbuttons').attr('data-d'); $.ajax({ type: "POST", url: bloghost+"zb_users/plugin/mochu_us/function_user.php?act=shang", data: { 'id': id,'giod':giod }, dataType: "json", success: function (res) { layer.closeAll(); if (res.code == 1) { layer.msg(res.msg, { icon: 5 });} else { layer.msg(res.msg, { icon: 6}); } },error: function () {layer.closeAll();layer.alert('数据获取失败', { icon: 0 });}});});

//no data sta
$('body').on('click','.mochu_us_article_buy_cha',function(){ var index = layer.load(2); var id = $(this).attr('data-type'); $.ajax({ type: "POST", url: bloghost + "zb_users/plugin/mochu_us/function_user.php?act=article_vip_cha", data: { 'id': id}, dataType: "json", success: function (res) { layer.closeAll(); if (res.code == 1) { layer.alert(res.msg, { icon: 0 }); } else { layer.alert(res.msg, { icon: 1 }); $('.mochu_us_article_buy_content').html(res.html); }}, error: function () {layer.closeAll(); layer.alert('数据获取失败', { icon: 0 });}});});
$('body').on('click','#mochu-us-xubuy_rmb',function(){ var pay_type = $(this).attr('data-pay'); var articleid = $(this).attr('data-type'); if(pay_type == 1){article_paytype();}else{ pay_article(pay_type);}});
function article_paytype() { var jine = $('#mochu-us-xubuy_rmb').attr('data-jine'); var jine = '需要支付<span style="color: #FF5722; margin: 0 5px;">' + jine + '元</span>购买此内容'; var paytype = '<div data-type="2" class="mochu_upvippaytype mochu_upvippay"><img class="mochu_zhifuing" src="/zb_users/plugin/mochu_us/src/style/img/zhifubaopay.png">支付宝</div> <div data-type="3" class="mochu_upvippaytype"><img class="mochu_zhifuing" src="/zb_users/plugin/mochu_us/src/style/img/weixinpay.png">微信支付</div>'; var html = '<div class="mochu_upvippaycentent"><div style="height: 40px; line-height: 40px; font-size: 16px; margin-bottom: 0px; margin-top: 5px;">' + jine + '</div>' + paytype + '</div>'; layer.open({ title: ['支付选择：', 'font-size:14px;'], type: 1, area: ['300px', '200px'], content: html, id: 'mochu_us_article_buys_alert', btn: ['立即支付','取消支付'], btnAlign: 'c', skin: 'layer-zidong', yes: function (index, layero) { var type = $('.mochu_upvippay').attr('data-type');pay_article(type);}});}
function pay_article(type){ var id = $('#mochu-us-xubuy_rmb').attr('data-type'); var url = bloghost + 'zb_users/plugin/mochu_us/page/pay.php?type=BuyArticle&buytype=' + id + '&paytype=' + type ; window.open(url, "_blank"); layer.alert('你已发起支付请求<br/>支付成功后,请刷新此页面!', { icon: 3 }, function () {window.location.reload()}); }
$('body').on('click', '.mochu_upvippaytype', function () {$('.mochu_upvippaytype').removeClass('mochu_upvippay');$(this).addClass('mochu_upvippay');});
//no data end

$("body").on("click",".mochu_us_baochi_login",function(){if ($(".mochu_us_baochi_login").is(":checked")) {logindata = $(".mochu_us_baochi_login").val();} else {logindata = 1;}});$('body').on('click', '.mochu_us_login_page_button', function () { var username = $('#mochu_us_Name').val(); var userpass = $('#mochu_us_password').val(); if (username.length < 1 || userpass.length < 1) { layer.alert('账号或密码不能为空', { icon: 0 }); return false; } var index = layer.msg('正在登录中，请稍候', { icon: 16, time: false, shade: 0.01 }); $.ajax({ type: "POST", url: bloghost + "zb_users/plugin/mochu_us/cmd.php?act=themelogins", data: {'savedate':logindata,'username': username, 'password': MD5(userpass), }, dataType: "json", success: function (res) { layer.closeAll(); if (res.code == 1) { layer.alert(res.msg, { icon: 0 }); } else { layer.msg('登录成功!', { icon: 1 }, function () { window.location.reload()});}}, error: function () {  layer.closeAll();  layer.alert('数据获取失败', { icon: 0 }); } }); });

$('body').on('click','.mochu_us_foot_login span',function(){ var wd = $(document).width(); $(".mochu_us_foot_login").animate({ left: "-"+wd+"px"}); setTimeout(function () { $(".mochu_us_foot_open").animate({ left: "-5px" });}, 400); mochu_us_setCookie("Mochu_us_nav", "1", 120);});
$('body').on('click', '.mochu_us_foot_open', function () { setTimeout(function () { $(".mochu_us_foot_login").animate({left: "0px"}); }, 400); $(".mochu_us_foot_open").animate({ left: "-55px" });mochu_us_setCookie("Mochu_us_nav", "2", 120); });$('body').on('click','.mochu_us_logpage',function(){try { if (typeof (eval(MD5)) == "function") { } } catch (e) { $.getScript(bloghost + "zb_system/script/md5.js");}$('.mochu_us_bei').css('display','block');$('.mochu_us_login_page').css('display', 'block');$('.mochu_us_login_page').addClass('mochu_ani');});$('body').on('click','.mochu_us_login_page_title i',function(){$('.mochu_us_bei').css('display', 'none');$('.mochu_us_login_page').css('display', 'none');});
$('body').on('click','.mochu_us_eye',function(){ if($(this).hasClass('m-ey')){ $(this).removeClass('m-ey'); $('#mochu_us_password').attr('type','password'); }else{$(this).addClass('m-ey'); $('#mochu_us_password').attr('type', 'text');}});



function mochu_us_setCookie(name, value, time) { var strsec = time * 1000; var exp = new Date(); exp.setTime(exp.getTime() + strsec * 1); document.cookie = name + "=" + escape(value) + ";expires=" + exp.toGMTString() + ";path=/"; }
function mochu_us_getCookie(name) { var arr, reg = new RegExp("(^| )" + name + "=([^;]*)(;|$)"); if (arr = document.cookie.match(reg)) { return unescape(arr[2]); } else { return null; } }
$(function(){ if (mochu_us_getCookie("mochu_us_notice_alert") != 1){ $.getJSON(bloghost +'zb_users/plugin/mochu_us/function_user.php?act=notice',{}, function (res) {  if(res.code == 0){  layer.open({skin:'layui-layer-mochu',title: ['网站公告：'], type: 1,  closeBtn:0,  anim: 2,  area: '360px',  content: '<div class="mochu_us_notice_alert">'+res.cont+'</div>',  btn: ['我已阅读并关闭窗口'], btnAlign: 'c', yes: function () {  mochu_us_setCookie('mochu_us_notice_alert', '1', 43200); layer.closeAll();  layer.alert('请进入用户中心，点击左上角"网站公告"！<br/>即可再次查看！', {skin:'layui-layer-mochu',closeBtn:0,icon:6,title: ['小提示']}); } }); }else{ mochu_us_setCookie('mochu_us_notice_alert', '1', 60); } }); } });