/*! app/zhuanlian.js | 商品转链（大淘客：淘宝/京东/拼多多/抖音） | 依赖: jQuery, js-md5 */
function ksort(o){let sorted={},keys=Object.keys(o);keys.sort();keys.forEach((key)=>{sorted[key]=o[key]});return sorted}
function dataoke_Sign(data,appSecret){data=ksort(data);var str="";for(var Key in data){str=str+'&'+Key+'='+data[Key]}str=str.trim();if(str.substr(0,1)=="&"){str=str.slice(1)}str=$.md5(str+"&key="+appSecret);str=str.toUpperCase();return str}
function http_build_query(data){var houzhui="";for(var Key in data){houzhui=houzhui+'&'+Key+'='+data[Key];if(houzhui.substr(0,1)=="&"){houzhui=houzhui.slice(1)}}return houzhui}
function dtaobaoshangpin(neirong,zhuanlian_config){tzhuanlianhost="https://openapi.dataoke.com/api/tb-service/get-privilege-link";var tzhuanliandata=[];tzhuanliandata['appKey']=zhuanlian_config["taobao_appkey"];tzhuanliandata['version']="1.3.1";tzhuanliandata['goodsId']=neirong;tzhuanliandata['pid']=zhuanlian_config["taobao_pid"];tzhuanliandata['channelId']=zhuanlian_config["taobao_channelid"];tzhuanliandata['authId']=zhuanlian_config["taobao_authid"];tzhuanliandata['sign']=dataoke_Sign(tzhuanliandata,zhuanlian_config["taobao_appSecret"]);tzhuanlianurl=tzhuanlianhost+"?"+http_build_query(tzhuanliandata);var defer=$.Deferred();$.ajax({url:tzhuanlianurl,success:function(data){defer.resolve(data)}});return defer.promise()}
function dtaobaofuchi(neirong,jaw_uid){var defer=$.Deferred();$.ajax({type:"POST",data:"content="+encodeURIComponent(neirong)+"&link_type=18&referer=https%253A%252F%252Fwww.dataoke.com%252Ftools%253Ftype%253D18&new_refer=https%253A%252F%252Fwww.dataoke.com%252Ftools%253Ftype%253D18%2526event_type%253Dclick%2526event_id%253Dtools%2526path%253Dtrans%252Fmultiple%2526project%253Ddtk&jaw_uid="+jaw_uid,url:"https://dtkapi.ffquan.cn/taobaoapi/parse-tb-multiple-new?app_token="+jaw_uid,success:function(data){defer.resolve(data)}});return defer.promise()}
function djingdongshangpin(neirong,zhuanlian_config){jzhuanlianhost="https://openapi.dataoke.com/api/dels/jd/kit/promotion-union-convert";var jzhuanliandata=[];jzhuanliandata['appKey']=zhuanlian_config["jingdong_appkey"];jzhuanliandata['version']="1.0.0";jzhuanliandata['materialId']=neirong;jzhuanliandata['unionId']=zhuanlian_config["jingdong_unionId"];jzhuanliandata['positionId']=zhuanlian_config["jingdong_positionId"];jzhuanliandata['pid']=zhuanlian_config["jingdong_pid"];jzhuanliandata['jdauthid']=zhuanlian_config["jingdong_authid"];jzhuanliandata['sign']=dataoke_Sign(jzhuanliandata,zhuanlian_config["jingdong_appSecret"]);jzhuanlianurl=jzhuanlianhost+"?"+http_build_query(jzhuanliandata);var defer=$.Deferred();$.ajax({url:jzhuanlianurl,success:function(data){defer.resolve(data)}});return defer.promise()}
function dpinpddshangpin(goodsSign,zhuanlian_config){pzhuanlianhost="https://openapi.dataoke.com/api/dels/pdd/kit/goods-prom-generate";var pzhuanliandata=[];pzhuanliandata['appKey']=zhuanlian_config["pingduoduo_appkey"];pzhuanliandata['version']="2.0.0";pzhuanliandata['pid']=zhuanlian_config["pingduoduo_pid"];pzhuanliandata['goodsSign']=goodsSign;pzhuanliandata['pddauthid']=zhuanlian_config["pingduoduo_authid"];pzhuanliandata['sign']=dataoke_Sign(pzhuanliandata,zhuanlian_config["pingduoduo_appSecret"]);pzhuanlianurl=pzhuanlianhost+"?"+http_build_query(pzhuanliandata);var defer=$.Deferred();$.ajax({url:pzhuanlianurl,success:function(data){defer.resolve(data)}});return defer.promise()}
function jianqieban(neirong,appKey,appSecret,zhuanlian_config){shibiehost="https://openapi.dataoke.com/api/dels/kit/contentParse";shibieappKey=appKey;shibieappSecret=appSecret;var shibiedata=[];shibiedata['appKey']=shibieappKey;shibiedata['version']="1.0.0";shibiedata['content']=neirong;shibiedata['TbPid']=zhuanlian_config["taobao_pid"];shibiedata['TbChannelId']=zhuanlian_config["taobao_channelid"];shibiedata['tbAuthId']=zhuanlian_config["taobao_authid"];shibiedata['JdUnionId']=zhuanlian_config["jingdong_unionId"];shibiedata['jdPositionId']=zhuanlian_config["jingdong_positionId"];shibiedata['JdPid']=zhuanlian_config["jingdong_pid"];shibiedata['jdAuthId']=zhuanlian_config["jingdong_authid"];shibiedata['PddPid']=zhuanlian_config["pingduoduo_pid"];shibiedata['pddAuthId']=zhuanlian_config["pingduoduo_authid"];shibiedata['sign']=dataoke_Sign(shibiedata,shibieappSecret);shibieurl=shibiehost+"?"+http_build_query(shibiedata);var defer=$.Deferred();$.ajax({url:shibieurl,success:function(data){defer.resolve(data)}});return defer.promise()}
function ddouyinshangpin(neirong,zhuanlian_config){dzhuanlianhost="https://openapiv2.dataoke.com/open-api/tiktok-kol-product-share";let dzhuanliandata=[];dzhuanliandata['appKey']=zhuanlian_config["douyin_appkey"];dzhuanliandata['appSecret']=zhuanlian_config["douyin_appSecret"];dzhuanliandata['version']="v1.0.0";dzhuanliandata['productUrl']=neirong;dzhuanliandata['externalInfo']="0";dzhuanlianurl=dzhuanlianhost+"?"+http_build_query(dzhuanliandata);var defer=$.Deferred();$.ajax({url:dzhuanlianurl,success:function(data){defer.resolve(data)}});return defer.promise()}
function ddouyinshibie(neirong,zhuanlian_config){dzhuanlianhost="https://openapiv2.dataoke.com/tiktok/tiktok-materials-products-details";let dzhuanliandata=[];dzhuanliandata['appkey']=zhuanlian_config["douyin_appkey"];dzhuanliandata['appSecret']=zhuanlian_config["douyin_appSecret"];dzhuanliandata['version']="v1.0.0";dzhuanliandata['productIds']=neirong;dzhuanlianurl=dzhuanlianhost+"?"+http_build_query(dzhuanliandata);var defer=$.Deferred();$.ajax({url:dzhuanlianurl,success:function(data){defer.resolve(data)}});return defer.promise()}
function rdouyinshangpin(neirong,zhuanlian_config){dzhuanlianhost="https://open.redu.com/service/openapi/product/productShareUrl";let dzhuanliandata=[];dzhuanliandata['appkey']=zhuanlian_config["douyin_appkey"];dzhuanliandata['appSecret']=zhuanlian_config["douyin_appSecret"];dzhuanliandata['version']="V1.0.0";dzhuanliandata['productId']=neirong;dzhuanliandata['needShareLink']=true;dzhuanliandata['externalInfo']="0";dzhuanlianurl=dzhuanlianhost+"?"+http_build_query(dzhuanliandata);var defer=$.Deferred();$.ajax({url:dzhuanlianurl,success:function(data){defer.resolve(data)}});return defer.promise()}
function rdouyinshibie(neirong,zhuanlian_config){dzhuanlianhost="https://open.redu.com/service/openapi/product/queryProductDetail";let dzhuanliandata=[];dzhuanliandata['appkey']=zhuanlian_config["douyin_appkey"];dzhuanliandata['appSecret']=zhuanlian_config["douyin_appSecret"];dzhuanliandata['version']="V1.0.0";dzhuanliandata['productId']=neirong;dzhuanlianurl=dzhuanlianhost+"?"+http_build_query(dzhuanliandata);var defer=$.Deferred();$.ajax({url:dzhuanlianurl,success:function(data){defer.resolve(data)}});return defer.promise()}

function zjingdongshangpin(neirong, zhuanlian_config) {
    jzhuanlianhost = "https://api.zhetaoke.com:10001/api/open_gaoyongzhuanlian_tkl_piliang.ashx";
    var jzhuanliandata = [];
    jzhuanliandata['appkey'] = zhuanlian_config["jingdong_appkey"];
    jzhuanliandata['sid'] = zhuanlian_config["jingdong_appSecret"];
    jzhuanliandata['unionId'] = zhuanlian_config["jingdong_unionId"];
    jzhuanliandata['positionId'] = zhuanlian_config["jingdong_positionId"];
    jzhuanliandata['pid'] = zhuanlian_config["jingdong_pid"] || "mm";
    jzhuanliandata['tkl'] = encodeURIComponent(neirong);
    jzhuanlianurl = jzhuanlianhost + "?" + http_build_query(jzhuanliandata);
    var defer = $.Deferred();
    $.ajax({
        url: jzhuanlianurl,
        success: function (data) {
            defer.resolve(data)
        }
    });
    return defer.promise()
}

function shangpinzhuanlian(yuansu, zhuanlian_config) {
    $(yuansu).find("a").each(function () {
        var bianli = this;
        var zhuanhref = $(bianli).attr("href");
        if (zhuanlian_config["taobao_kaiguan"] == "1") {
            if (zhuanhref.match(RegExp(/taobao.com|tb.cn|taobao.hk|tmall.com|tmall.hk/ig))) {
                if (zhuanlian_config["taobao_method"]) {
                    $.when(dtaobaofuchi(zhuanhref, zhuanlian_config["taobao_method"])).done(function (shibie) {
                        if (shibie.code == 1) {
                            shibie.data = shibie.data[0];
                            shibie.goods_info = shibie.data.goods_info;
                            var fanhuiyangshi = zhuanlian_config["taobao_shangpingeshi"];
                            if (shibie.goods_info.rate) {
                                if (shibie.goods_info.coupon_amount) {
                                    yongjin = shibie.goods_info.price * Number(shibie.goods_info.rate) /
                                        100;
                                    yongjin = yongjin.toFixed(2);
                                    daoshoujia = shibie.goods_info.price - yongjin;
                                    daoshoujia = daoshoujia.toFixed(2)
                                } else {
                                    yongjin = shibie.goods_info.original_price * Number(shibie
                                        .goods_info.rate) / 100;
                                    yongjin = yongjin.toFixed(2);
                                    daoshoujia = shibie.goods_info.original_price - yongjin;
                                    daoshoujia = daoshoujia.toFixed(2)
                                }
                                fanhuiyangshi = fanhuiyangshi.replace(/{所属平台}/g, "淘宝");
                                fanhuiyangshi = fanhuiyangshi.replace(/{商品名称}/g, shibie.goods_info
                                    .title);
                                fanhuiyangshi = fanhuiyangshi.replace(/{商品ID}/g, shibie.goods_info
                                    .item_id);
                                fanhuiyangshi = fanhuiyangshi.replace(/{月销量}/g, shibie.goods_info
                                    .sales);
                                fanhuiyangshi = fanhuiyangshi.replace(/{商品原价}/g, shibie.goods_info
                                    .original_price);
                                fanhuiyangshi = fanhuiyangshi.replace(/{商品券后价}/g, shibie.goods_info
                                    .price);
                                fanhuiyangshi = fanhuiyangshi.replace(/{优惠券面额}/g, shibie.goods_info
                                    .coupon_amount);
                                fanhuiyangshi = fanhuiyangshi.replace(/{佣金比例}/g, Number(shibie
                                    .goods_info
                                    .rate).toFixed(2));
                                fanhuiyangshi = fanhuiyangshi.replace(/{预估佣金}/g, yongjin);
                                fanhuiyangshi = fanhuiyangshi.replace(/{最终到手价}/g, daoshoujia);
                                $(bianli).attr("href", shibie.data.short_url);
                                $(bianli).attr("data-tkl", shibie.data.longTpwd);
                                $(bianli).text(shibie.data.short_url + fanhuiyangshi)
                            }
                        } else {
                            layer.msg("大淘客新手扶持计划转链失败(Token失效)：" + shibie.msg)
                        }
                    })
                } else {
                    $.when(jianqieban(zhuanhref, zhuanlian_config["taobao_appkey"], zhuanlian_config[
                        "taobao_appSecret"], zhuanlian_config)).done(function (shibie) {
                        if (shibie.msg == "成功v2") {
                            if (shibie.data.parseStatus == "3" && shibie.data.dataType == "goods" &&
                                shibie.data.itemId) {
                                $.when(dtaobaoshangpin(shibie.data.itemId, zhuanlian_config)).done(
                                    function (shangpin) {
                                        var fanhuiyangshi = zhuanlian_config[
                                            "taobao_shangpingeshi"];
                                        if (shibie.data.commissionRate) {
                                            if (zhuanlian_config["taobao_bili"] > 0) {
                                                shibie.data.commissionRate = (shibie.data
                                                    .commissionRate * zhuanlian_config[
                                                        "taobao_bili"] / 100).toFixed(2)
                                            }
                                            if (shibie.data.actualPrice) {
                                                yongjin = shibie.data.actualPrice * shibie.data
                                                    .commissionRate / 100;
                                                yongjin = yongjin.toFixed(2);
                                                daoshoujia = shibie.data.actualPrice - yongjin;
                                                daoshoujia = daoshoujia.toFixed(2)
                                            } else {
                                                yongjin = shibie.data.originalPrice * shibie.data
                                                    .commissionRate / 100;
                                                yongjin = yongjin.toFixed(2);
                                                daoshoujia = shibie.data.originalPrice - yongjin;
                                                daoshoujia = daoshoujia.toFixed(2)
                                            }
                                            fanhuiyangshi = fanhuiyangshi.replace(/{所属平台}/g, "淘宝");
                                            fanhuiyangshi = fanhuiyangshi.replace(/{商品名称}/g, shibie
                                                .data.itemName);
                                            fanhuiyangshi = fanhuiyangshi.replace(/{商品ID}/g, shibie
                                                .data.itemId);
                                            fanhuiyangshi = fanhuiyangshi.replace(/{月销量}/g, shibie
                                                .data.monthSales);
                                            fanhuiyangshi = fanhuiyangshi.replace(/{商品原价}/g, shibie
                                                .data.originalPrice);
                                            fanhuiyangshi = fanhuiyangshi.replace(/{商品券后价}/g, shibie
                                                .data.actualPrice);
                                            fanhuiyangshi = fanhuiyangshi.replace(/{优惠券面额}/g, shibie
                                                .data.couponPrice);
                                            fanhuiyangshi = fanhuiyangshi.replace(/{佣金比例}/g, shibie
                                                .data.commissionRate);
                                            fanhuiyangshi = fanhuiyangshi.replace(/{预估佣金}/g,
                                                yongjin);
                                            fanhuiyangshi = fanhuiyangshi.replace(/{最终到手价}/g,
                                                daoshoujia);
                                            $(bianli).attr("href", shangpin.data.shortUrl);
                                            $(bianli).attr("data-tkl", shangpin.data.longTpwd);
                                            $(bianli).text(shangpin.data.shortUrl + fanhuiyangshi)
                                        }
                                    })
                            } else if ((shibie.data.parseStatus == "4" || shibie.data.parseStatus ==
                                    "5") && shibie.data.dataType == "activity" && shibie.data.itemId) {
                                console.log("是活动，并且解析出了内容")
                            } else if (shibie.data.parseStatus == "2") {
                                console.log("有口令或链接，未解析出商品/活动ID，或解析出商品/活动ID但联盟无信息")
                            }
                        } else {
                            console.log("识别没成功")
                        }
                    })
                }
            }
        }
        if (zhuanlian_config["jingdong_kaiguan"] == "1") {
            if (zhuanhref.match(RegExp(/jd.com/ig))) {
                if (zhuanlian_config["jingdong_method"] == "" || zhuanlian_config["jingdong_method"] == "大淘客") {
                    layer.confirm('京东大淘客转链接口暂时无法使用<br>请进入用户中心按教程更换折京客转链。', {
                        icon: 3,
                        title: '提示',
                        btn: ['查看教程', '取消']
                    }, function (index) {
                        window.location.href = '/jiaocheng/718063.html';
                        layer.close(index);
                    }, function (index) {
                        layer.close(index);
                    });
                    $.when(jianqieban(zhuanhref, zhuanlian_config["jingdong_appkey"], zhuanlian_config[
                        "jingdong_appSecret"], zhuanlian_config)).done(function (shibie) {
                        if (shibie.msg == "成功v2") {
                            var fanhuiyangshi = zhuanlian_config["jingdong_shangpingeshi"];
                            if (shibie.data.itemName) {
                                if (shibie.data.commissionRate) {
                                    if (shibie.data.actualPrice) {
                                        yongjin = shibie.data.actualPrice * shibie.data.commissionRate /
                                            100;
                                        yongjin = yongjin.toFixed(2);
                                        daoshoujia = shibie.data.actualPrice - yongjin;
                                        daoshoujia = daoshoujia.toFixed(2);
                                        plusyongjin = shibie.data.actualPrice * shibie.data
                                            .plusCommissionRate / 100;
                                        plusyongjin = plusyongjin.toFixed(2);
                                        plusdaoshoujia = shibie.data.actualPrice - plusyongjin;
                                        plusdaoshoujia = plusdaoshoujia.toFixed(2)
                                    } else {
                                        yongjin = shibie.data.originalPrice * shibie.data
                                            .commissionRate /
                                            100;
                                        yongjin = yongjin.toFixed(2);
                                        daoshoujia = shibie.data.originalPrice - yongjin;
                                        daoshoujia = daoshoujia.toFixed(2);
                                        plusyongjin = shibie.data.originalPrice * shibie.data
                                            .plusCommissionRate / 100;
                                        plusyongjin = plusyongjin.toFixed(2);
                                        plusdaoshoujia = shibie.data.originalPrice - plusyongjin;
                                        plusdaoshoujia = plusdaoshoujia.toFixed(2)
                                    }
                                    fanhuiyangshi = fanhuiyangshi.replace(/{所属平台}/g, "京东");
                                    fanhuiyangshi = fanhuiyangshi.replace(/{商品名称}/g, shibie.data
                                        .itemName);
                                    fanhuiyangshi = fanhuiyangshi.replace(/{商品ID}/g, shibie.data
                                        .itemId);
                                    fanhuiyangshi = fanhuiyangshi.replace(/{月销量}/g, shibie.data
                                        .monthSales);
                                    fanhuiyangshi = fanhuiyangshi.replace(/{商品原价}/g, shibie.data
                                        .originalPrice);
                                    fanhuiyangshi = fanhuiyangshi.replace(/{商品券后价}/g, shibie.data
                                        .actualPrice);
                                    fanhuiyangshi = fanhuiyangshi.replace(/{优惠券面额}/g, shibie.data
                                        .couponPrice);
                                    fanhuiyangshi = fanhuiyangshi.replace(/{佣金比例}/g, shibie.data
                                        .commissionRate);
                                    fanhuiyangshi = fanhuiyangshi.replace(/{PLUS佣金比例}/g, shibie.data
                                        .plusCommissionRate);
                                    fanhuiyangshi = fanhuiyangshi.replace(/{预估佣金}/g, yongjin);
                                    fanhuiyangshi = fanhuiyangshi.replace(/{PLUS预估佣金}/g, plusyongjin);
                                    fanhuiyangshi = fanhuiyangshi.replace(/{最终到手价}/g, daoshoujia);
                                    fanhuiyangshi = fanhuiyangshi.replace(/{PLUS最终到手价}/g,
                                        plusdaoshoujia);
                                    if (shibie.data.promotionShortUrl) {
                                        $(bianli).attr("href", shibie.data.promotionShortUrl);

                                        $(bianli).text(shibie.data.promotionShortUrl + fanhuiyangshi)
                                    } else {
                                        $.when(djingdongshangpin(zhuanhref, zhuanlian_config)).done(
                                            function (shangpin) {
                                                if (shangpin.msg == "成功") {
                                                    $(bianli).attr("href", shangpin.data.shortUrl);

                                                    $(bianli).text(shangpin.data.shortUrl +
                                                        fanhuiyangshi)
                                                }
                                            })
                                    }
                                }
                            } else {
                                if (shibie.data.url != shibie.data.promotionShortUrl && shibie.data
                                    .promotionShortUrl) {
                                    fanhuiyangshi = "（转链成功）";
                                    $(bianli).attr("href", shibie.data.promotionShortUrl);

                                    $(bianli).text(shibie.data.promotionShortUrl + fanhuiyangshi)
                                }
                            }
                        }
                    })
                } else if (zhuanlian_config["jingdong_method"] == "折京客") {
                    $.when(zjingdongshangpin(zhuanhref, zhuanlian_config)).done(function (shibie) {
                        shibie = JSON.parse(shibie);
                        if (shibie.status === 200) {
                            var fanhuiyangshi = zhuanlian_config["jingdong_shangpingeshi"];
                            if (shibie.title) {
                                if (shibie.tkrate3) {
                                    if (shibie.quanhou_jiage) {
                                        yongjin = shibie.quanhou_jiage * shibie.tkrate3 / 100;
                                        yongjin = yongjin.toFixed(2);
                                        daoshoujia = shibie.quanhou_jiage - yongjin;
                                        daoshoujia = daoshoujia.toFixed(2);
                                        plusyongjin = yongjin;
                                        plusdaoshoujia = daoshoujia;
                                    } else {
                                        yongjin = shibie.size * shibie.tkrate3 /
                                            100;
                                        yongjin = yongjin.toFixed(2);
                                        daoshoujia = shibie.size - yongjin;
                                        daoshoujia = daoshoujia.toFixed(2);
                                        plusyongjin = yongjin;
                                        plusdaoshoujia = daoshoujia;
                                    }
                                    fanhuiyangshi = fanhuiyangshi.replace(/{所属平台}/g, "京东");
                                    fanhuiyangshi = fanhuiyangshi.replace(/{商品名称}/g, shibie.title);
                                    fanhuiyangshi = fanhuiyangshi.replace(/{商品ID}/g, shibie.tao_id);
                                    fanhuiyangshi = fanhuiyangshi.replace(/{月销量}/g, shibie.volume);
                                    fanhuiyangshi = fanhuiyangshi.replace(/{商品原价}/g, shibie.size);
                                    fanhuiyangshi = fanhuiyangshi.replace(/{商品券后价}/g, shibie
                                        .quanhou_jiage);
                                    fanhuiyangshi = fanhuiyangshi.replace(/{优惠券面额}/g, shibie.size -
                                        shibie.quanhou_jiage);
                                    fanhuiyangshi = fanhuiyangshi.replace(/{佣金比例}/g, shibie.tkrate3);
                                    fanhuiyangshi = fanhuiyangshi.replace(/{PLUS佣金比例}/g, shibie
                                        .tkrate3);
                                    fanhuiyangshi = fanhuiyangshi.replace(/{预估佣金}/g, yongjin);
                                    fanhuiyangshi = fanhuiyangshi.replace(/{PLUS预估佣金}/g, plusyongjin);
                                    fanhuiyangshi = fanhuiyangshi.replace(/{最终到手价}/g, daoshoujia);
                                    fanhuiyangshi = fanhuiyangshi.replace(/{PLUS最终到手价}/g,
                                        plusdaoshoujia);
                                    if (shibie.content && shibie.content != zhuanhref) {
                                        $(bianli).attr("href", shibie.content);
                                        $(bianli).text(shibie.content + fanhuiyangshi)
                                    }
                                }
                            } else {
                                if (shibie.content && shibie.content != zhuanhref) {
                                    fanhuiyangshi = "（转链成功）";
                                    $(bianli).attr("href", shibie.content);
                                    $(bianli).text(shibie.content + fanhuiyangshi)
                                }
                            }
                        } else {
                            if (!zhuanlian_config["jingdong_appSecret"] || shibie.content.includes("有问题，可联系15611448080")) {
                        layer.confirm('折京客京东转链升级<br>不升级无法完成京东转链', {
                            icon: 3,
                            title: '提示',
                            btn: ['查看教程', '取消']
                        }, function (index) {
                            window.location.href = '/jiaocheng/718063.html';
                            layer.close(index);
                        }, function (index) {
                            layer.close(index);
                        });
                    }else{
                        layer.msg(shibie.content)
                    }
                    
                            console.log(shibie);
                        }
                    })
                }
            }
        }
        if (zhuanlian_config["pingduoduo_kaiguan"] == "1") {
            if (zhuanhref.match(RegExp(/yangkeduo.com|pinduoduo.com/ig))) {
                $.when(jianqieban(zhuanhref, zhuanlian_config["pingduoduo_appkey"], zhuanlian_config[
                    "pingduoduo_appSecret"], zhuanlian_config)).done(function (shibie) {
                    if (shibie.msg == "成功v2") {
                        if (shibie.data.parseStatus == "3" && shibie.data.dataType == "goods" && shibie
                            .data.itemId) {
                            var fanhuiyangshi = zhuanlian_config["pingduoduo_shangpingeshi"];
                            $.when(dpinpddshangpin(shibie.data.itemId, zhuanlian_config)).done(
                                function (shangpin) {
                                    if (shibie.data.commissionRate) {
                                        if (shibie.data.actualPrice) {
                                            yongjin = shibie.data.actualPrice * shibie.data
                                                .commissionRate / 100;
                                            yongjin = yongjin.toFixed(2);
                                            daoshoujia = shibie.data.actualPrice - yongjin;
                                            daoshoujia = daoshoujia.toFixed(2)
                                        } else {
                                            yongjin = shibie.data.originalPrice * shibie.data
                                                .commissionRate / 100;
                                            yongjin = yongjin.toFixed(2);
                                            daoshoujia = shibie.data.originalPrice - yongjin;
                                            daoshoujia = daoshoujia.toFixed(2)
                                        }
                                        fanhuiyangshi = fanhuiyangshi.replace(/{所属平台}/g, "拼多多");
                                        fanhuiyangshi = fanhuiyangshi.replace(/{商品名称}/g, shibie.data
                                            .itemName);
                                        fanhuiyangshi = fanhuiyangshi.replace(/{商品ID}/g, shibie.data
                                            .itemId);
                                        fanhuiyangshi = fanhuiyangshi.replace(/{月销量}/g, shibie.data
                                            .monthSales);
                                        fanhuiyangshi = fanhuiyangshi.replace(/{商品原价}/g, shibie.data
                                            .originalPrice);
                                        fanhuiyangshi = fanhuiyangshi.replace(/{商品券后价}/g, shibie
                                            .data.actualPrice);
                                        fanhuiyangshi = fanhuiyangshi.replace(/{优惠券面额}/g, shibie
                                            .data.couponPrice);
                                        fanhuiyangshi = fanhuiyangshi.replace(/{佣金比例}/g, shibie.data
                                            .commissionRate);
                                        fanhuiyangshi = fanhuiyangshi.replace(/{预估佣金}/g, yongjin);
                                        fanhuiyangshi = fanhuiyangshi.replace(/{最终到手价}/g,
                                            daoshoujia);
                                        $(bianli).attr("href", shangpin.data.mobileShortUrl);


                                        $(bianli).text(shangpin.data.mobileShortUrl + fanhuiyangshi)
                                    }
                                })
                        } else if ((shibie.data.parseStatus == "4" || shibie.data.parseStatus == "5") &&
                            shibie.data.dataType == "activity" && shibie.data.itemId) {
                            console.log("是活动，并且解析出了内容")
                        } else if (shibie.data.parseStatus == "2") {
                            console.log("有口令或链接，未解析出商品/活动ID，或解析出商品/活动ID但联盟无信息")
                        }
                    } else {
                        console.log("识别没成功")
                    }
                })
            }
        }
    });
}



function haodanzhuanlian(zhuanlian_config) {
    $('.detail-block .right .btn.buy:not([data-fan]').each(function (index, element) {
        $(element).attr('data-fan', 'true');
        let arg2 = $(element).data("url");
        let item_id = $(element).data("itemid");
        let item_type = $(element).closest(".right").data("type");
        if (typeof (arg2) == "undefined") {
            return true
        }
        if (zhuanlian_config["taobao_kaiguan"] == "1") {
            if (arg2.match(RegExp(/taobao.com|tb.cn|taobao.hk|tmall.com|tmall.hk/ig))) {
                if (zhuanlian_config["taobao_method"]) {
                    $.when(dtaobaofuchi(arg2, zhuanlian_config["taobao_method"])).done(function (shibie) {
                        if (shibie.code == 1) {
                            shibie.data = shibie.data[0];
                            shibie.goods_info = shibie.data.goods_info;

                            if (shibie.goods_info.rate) {
                                $(element).attr("data-zhuanlianurl", shibie.data.short_url);
                                $(element).attr("data-zhuanliantkl", shibie.data.full_tpwd);
                                $(element).text("返利" + Number(shibie.goods_info.rate).toFixed(2) + "%")
                            }
                        }
                    })
                } else {
                    $.when(jianqieban(arg2, zhuanlian_config["taobao_appkey"], zhuanlian_config[
                        "taobao_appSecret"], zhuanlian_config)).done(function (shibie) {
                        if (shibie.msg == "成功v2") {
                            if (shibie.data.parseStatus == "3" && shibie.data.dataType == "goods" &&
                                shibie.data.itemId) {
                                $.when(dtaobaoshangpin(shibie.data.itemId, zhuanlian_config)).done(
                                    function (shangpin) {
                                        if (shibie.data.commissionRate) {
                                            if (zhuanlian_config["taobao_bili"] > 0) {
                                                shibie.data.commissionRate = shibie.data
                                                    .commissionRate * zhuanlian_config[
                                                        "taobao_bili"] / 100
                                            }
                                            $(element).attr("data-zhuanlianurl", shangpin.data
                                                .shortUrl);
                                            $(element).attr("data-zhuanliantkl", shangpin.data
                                                .longTpwd);
                                            $(element).text("返利" + Number(shibie.data
                                                .commissionRate).toFixed(2) + "%")
                                        }
                                    })
                            } else if ((shibie.data.parseStatus == "4" || shibie.data.parseStatus ==
                                    "5") && shibie.data.dataType == "activity" && shibie.data.itemId) {
                                console.log("是活动，并且解析出了内容")
                            } else if (shibie.data.parseStatus == "2") {
                                console.log("有口令或链接，未解析出商品/活动ID，或解析出商品/活动ID但联盟无信息")
                            }
                        } else {
                            console.log("识别没成功")
                        }
                    })
                }
            }
        }
        if (zhuanlian_config["jingdong_kaiguan"] == "1") {
            if (arg2.match(RegExp(/jd.com/ig))) {
                if (zhuanlian_config["jingdong_method"] == "" || zhuanlian_config["jingdong_method"] == "大淘客") {
                    layer.confirm('京东大淘客转链接口暂时无法使用<br>请进入用户中心按教程更换折京客转链。', {
                        icon: 3,
                        title: '提示',
                        btn: ['查看教程', '取消']
                    }, function (index) {
                        window.location.href = '/jiaocheng/718063.html';
                        layer.close(index);
                    }, function (index) {
                        layer.close(index);
                    });
                    $.when(jianqieban(arg2, zhuanlian_config["jingdong_appkey"], zhuanlian_config[
                        "jingdong_appSecret"], zhuanlian_config)).done(function (shibie) {
                        if (shibie.msg == "成功v2") {
                            if (shibie.data.itemName) {
                                if (shibie.data.commissionRate) {
                                    if (shibie.data.promotionShortUrl) {
                                        $(element).attr("data-zhuanlianurl", shibie.data
                                            .promotionShortUrl);
                                        $(element).text("返利" + Number(shibie.data.commissionRate)
                                            .toFixed(2) + "%")
                                    } else {
                                        $.when(djingdongshangpin(arg2, zhuanlian_config)).done(
                                            function (
                                                shangpin) {
                                                if (shangpin.msg == "成功") {
                                                    $(element).attr("data-zhuanlianurl", shangpin
                                                        .data
                                                        .shortUrl);
                                                    $(element).text("返利" + Number(shibie.data
                                                        .commissionRate).toFixed(2) + "%")
                                                }
                                            })
                                    }
                                }
                            } else {
                                if (shibie.data.url != shibie.data.promotionShortUrl && shibie.data
                                    .promotionShortUrl) {
                                    $(element).attr("data-zhuanlianurl", shibie.data.promotionShortUrl);
                                    $(element).text("转链成功")
                                }
                            }
                        }
                    })
                } else if (zhuanlian_config["jingdong_method"] == "折京客") {
                    $.when(zjingdongshangpin(arg2, zhuanlian_config)).done(function (shibie) {
                        shibie = JSON.parse(shibie);
                        if (shibie.status === 200) {
                            if (shibie.title) {
                                if (shibie.tkrate3 && shibie.content) {
                                    $(element).attr("data-zhuanlianurl", shibie.content);
                                    $(element).text("返利" + Number(shibie.tkrate3).toFixed(2) + "%");
                                }
                            } else {
                                if (shibie.content.shorturl != arg2) {
                                    $(element).attr("data-zhuanlianurl", shibie.content);
                                    $(element).text("转链成功");
                                }
                            }
                        } else {
                            if (!zhuanlian_config["jingdong_appSecret"] || shibie.content.includes("有问题，可联系15611448080")) {
                        layer.confirm('折京客京东转链升级<br>不升级无法完成京东转链', {
                            icon: 3,
                            title: '提示',
                            btn: ['查看教程', '取消']
                        }, function (index) {
                            window.location.href = '/jiaocheng/718063.html';
                            layer.close(index);
                        }, function (index) {
                            layer.close(index);
                        });
                    }else{
                        layer.msg(shibie.content)
                    }
                            console.log(shibie);
                        }
                    })

                }
            }
        }
        if (zhuanlian_config["pingduoduo_kaiguan"] == "1") {
            if (arg2.match(RegExp(/yangkeduo.com|pinduoduo.com/ig))) {
                $.when(jianqieban(arg2, zhuanlian_config["pingduoduo_appkey"], zhuanlian_config[
                    "pingduoduo_appSecret"], zhuanlian_config)).done(function (shibie) {
                    if (shibie.msg == "成功v2") {
                        if (shibie.data.parseStatus == "3" && shibie.data.dataType == "goods" && shibie
                            .data.itemId) {
                            $.when(dpinpddshangpin(shibie.data.itemId, zhuanlian_config)).done(
                                function (shangpin) {
                                    if (shibie.data.commissionRate) {
                                        $(element).attr("data-zhuanlianurl", shangpin.data
                                            .mobileShortUrl);
                                        $(element).text("返利" + Number(shibie.data.commissionRate)
                                            .toFixed(2) + "%")
                                    }
                                })
                        }
                    }
                })
            }
        }
        if (zhuanlian_config["douyin_kaiguan"] == "1") {
            if (zhuanlian_config["douyin_method"] == "大淘客抖音转链") {
                if (arg2.match(RegExp(/buydouke.com/ig))) {
                    setTimeout(function () {
                        $.when(ddouyinshangpin(arg2, zhuanlian_config)).done(function (shangpin) {
                            if (shangpin.msg == "ok") {
                                if (shangpin.data.shareLink) {
                                    $(element).attr("data-zhuanlianurl", shangpin.data
                                        .shareLink);
                                    $(element).attr("data-zhuanliantkl", shangpin.data
                                        .dyPassword);
                                    $.when(ddouyinshibie(item_id, zhuanlian_config)).done(
                                        function (shibie) {
                                            if (shibie.msg == "ok") {
                                                shibie.data = shibie.data.list[0];
                                                if (shibie.data.cosRatio) {
                                                    $(element).text("返利" + Number(shibie
                                                            .data.cosRatio).toFixed(2) +
                                                        "%")
                                                }
                                            } else {
                                                $(element).text("转链成功")
                                            }
                                        })
                                }
                            } else {
                                console.log("转链没成功");
                                console.log(shangpin)
                            }
                        })
                    }, 500 * index)
                }
            } else if (zhuanlian_config["douyin_method"] == "热度星推转巨量百应") {
                if (item_type == "douyin" && item_id) {
                    setTimeout(function () {
                        $.when(rdouyinshangpin(item_id, zhuanlian_config)).done(function (shangpin) {
                            if (shangpin.success == true) {
                                if (shangpin.data.shareLink) {
                                    $(element).attr("data-zhuanlianurl", shangpin.data
                                        .shareLink);
                                    $(element).attr("data-zhuanliantkl", shangpin.data
                                        .password);
                                    $.when(rdouyinshibie(item_id, zhuanlian_config)).done(
                                        function (shibie) {
                                            if (shibie.success == true) {
                                                if (shibie.data.cosRatio) {
                                                    $(element).text("返利" + Number(shibie
                                                            .data.cosRatio).toFixed(2) +
                                                        "%")
                                                }
                                            } else {
                                                $(element).text("转链成功")
                                            }
                                        })
                                }
                            } else {
                                console.log("转链没成功");
                                console.log(shangpin)
                            }
                        })
                    }, 500 * index)
                }
            }
        }
    })
}
