/*! app/zhuanlian.js | 商品转链（淘宝/拼多多：大淘客；京东：折京客）
 * 依赖: jQuery（仅 DOM 读写：$(el).find/attr/text）, js-md5（0.8.x 仅提供全局 md5，无 $.md5，签名处已做双形态兼容）
 * 20261016 重写：取数从 $.Deferred + $.ajax 换成 async/await + fetch——全站唯一的 $.Deferred/$.when 依赖点，
 *   去掉后轻量兼容层（xb-jq）无需实现 Deferred。事件语义保持不变：
 *   · 旧实现请求失败时 defer 永不 resolve → .done 回调不执行、该链接静默跳过；现为 R.ok=false 直接 return（同效且不抛错）。
 *   · 京东接口（zhetaoke）旧实现拿的是原始文本（调用方自己 JSON.parse）→ 这里同样回 text，不预解析。
 *   · 旧实现成功回调里 JSON.parse/字段访问抛错会中断该链接后续逻辑；现统一 try/catch 兜底跳过该链接。
 */
/* 占位符填充（20261019）：旧实现直接 String.replace 套用户模板，两处会坏——
   ①接口字段缺失时把字符串 "undefined"/NaN 当文案写进链接文本（如 {月销量}、{优惠券面额}）；
   ②商品标题里含 $& / $1 会被 replace 当成替换模式，输出被吃掉。
   这里统一：缺值→空串；用 split/join 拼接，不做 pattern 解释。 */
function zl_v(v) {
    if (v === undefined || v === null) { return ''; }
    if (typeof v === 'number' && isNaN(v)) { return ''; }
    return v;
}
function zl_fill(tpl, map) {
    var out = String(tpl === undefined || tpl === null ? '' : tpl);
    for (var k in map) {
        if (!Object.prototype.hasOwnProperty.call(map, k)) { continue; }
        out = out.split('{' + k + '}').join(zl_v(map[k]));
    }
    return out;
}

function ksort(o){let sorted={},keys=Object.keys(o);keys.sort();keys.forEach((key)=>{sorted[key]=o[key]});return sorted}
function dataoke_Sign(data,appSecret){data=ksort(data);var str="";for(var Key in data){str=str+'&'+Key+'='+data[Key]}str=str.trim();if(str.substr(0,1)=="&"){str=str.slice(1)}str=(typeof md5==="function"?md5:$.md5)(str+"&key="+appSecret);str=str.toUpperCase();return str}
function http_build_query(data){var houzhui="";for(var Key in data){houzhui=houzhui+'&'+Key+'='+data[Key];if(houzhui.substr(0,1)=="&"){houzhui=houzhui.slice(1)}}return houzhui}

/* 取数原语：GET（无 body）/ POST（body 为 urlencoded 串）→ 原始文本 */
function xb_zl_text(url, postBody) {
    return new Promise(function (resolve) {
        var opt = { method: postBody === undefined ? 'GET' : 'POST' };
        if (postBody !== undefined) {
            opt.headers = {'Content-Type': 'application/x-www-form-urlencoded'};
            opt.body = postBody;
        }
        fetch(url, opt).then(function (res) {
            return res.text();
        }).then(function (text) {
            resolve({ok: true, text: text});
        }).catch(function () {
            resolve({ok: false});
        });
    });
}
/* 取数原语：同上但按 JSON 解析（等价旧 $.ajax 默认按 Content-Type 猜成 json 的那批接口） */
function xb_zl_json(url, postBody) {
    return xb_zl_text(url, postBody).then(function (r) {
        if (!r.ok) { return {ok: false}; }
        try { return {ok: true, data: JSON.parse(r.text)}; } catch (e) { return {ok: false}; }
    });
}

async function dtaobaoshangpin(neirong, zhuanlian_config) {
    var tzhuanlianhost = "https://openapi.dataoke.com/api/tb-service/get-privilege-link";
    var tzhuanliandata = [];
    tzhuanliandata['appKey'] = zhuanlian_config["taobao_appkey"];
    tzhuanliandata['version'] = "1.3.1";
    tzhuanliandata['goodsId'] = neirong;
    tzhuanliandata['pid'] = zhuanlian_config["taobao_pid"];
    tzhuanliandata['channelId'] = zhuanlian_config["taobao_channelid"];
    tzhuanliandata['authId'] = zhuanlian_config["taobao_authid"];
    tzhuanliandata['sign'] = dataoke_Sign(tzhuanliandata, zhuanlian_config["taobao_appSecret"]);
    return xb_zl_json(tzhuanlianhost + "?" + http_build_query(tzhuanliandata));
}

async function dtaobaofuchi(neirong, jaw_uid) {
    var body = "content=" + encodeURIComponent(neirong) + "&link_type=18&referer=https%253A%252F%252Fwww.dataoke.com%252Ftools%253Ftype%253D18&new_refer=https%253A%252F%252Fwww.dataoke.com%252Ftools%253Ftype%253D18%2526event_type%253Dclick%2526event_id%253Dtools%2526path%253Dtrans%252Fmultiple%2526project%253Ddtk&jaw_uid=" + jaw_uid;
    return xb_zl_json("https://dtkapi.ffquan.cn/taobaoapi/parse-tb-multiple-new?app_token=" + jaw_uid, body);
}

/* 淘宝活动/会场转链（20261019）：大淘客 tb-service/activity-link。
   参数用 contentParse 返回的待转链 ID（此处统称 promotionSceneId，优先 activityId）；
   接口业务成功才返回 data.click_url + data.longTpwd，失败返回 code!=0 / data=null。 */
async function dtaobaohuichang(promotionSceneId, zhuanlian_config) {
    var d = [];
    d['appKey'] = zhuanlian_config["taobao_appkey"];
    d['version'] = "1.0.0";
    d['promotionSceneId'] = promotionSceneId;
    d['pid'] = zhuanlian_config["taobao_pid"];
    d['sign'] = dataoke_Sign(d, zhuanlian_config["taobao_appSecret"]);
    return xb_zl_json("https://openapi.dataoke.com/api/tb-service/activity-link?" + http_build_query(d));
}

async function dpinpddshangpin(goodsSign, zhuanlian_config) {
    var pzhuanlianhost = "https://openapi.dataoke.com/api/dels/pdd/kit/goods-prom-generate";
    var pzhuanliandata = [];
    pzhuanliandata['appKey'] = zhuanlian_config["pingduoduo_appkey"];
    pzhuanliandata['version'] = "2.0.0";
    pzhuanliandata['pid'] = zhuanlian_config["pingduoduo_pid"];
    pzhuanliandata['goodsSign'] = goodsSign;
    pzhuanliandata['pddauthid'] = zhuanlian_config["pingduoduo_authid"];
    pzhuanliandata['sign'] = dataoke_Sign(pzhuanliandata, zhuanlian_config["pingduoduo_appSecret"]);
    return xb_zl_json(pzhuanlianhost + "?" + http_build_query(pzhuanliandata));
}

async function jianqieban(neirong, appKey, appSecret, zhuanlian_config) {
    var shibiehost = "https://openapi.dataoke.com/api/dels/kit/contentParse";
    var shibiedata = [];
    shibiedata['appKey'] = appKey;
    shibiedata['version'] = "1.0.0";
    shibiedata['content'] = neirong;
    shibiedata['TbPid'] = zhuanlian_config["taobao_pid"];
    shibiedata['TbChannelId'] = zhuanlian_config["taobao_channelid"];
    shibiedata['tbAuthId'] = zhuanlian_config["taobao_authid"];
    shibiedata['PddPid'] = zhuanlian_config["pingduoduo_pid"];
    shibiedata['pddAuthId'] = zhuanlian_config["pingduoduo_authid"];
    shibiedata['sign'] = dataoke_Sign(shibiedata, appSecret);
    return xb_zl_json(shibiehost + "?" + http_build_query(shibiedata));
}

async function zjingdongshangpin(neirong, zhuanlian_config) {
    var jzhuanlianhost = "https://api.zhetaoke.com:10001/api/open_gaoyongzhuanlian_tkl_piliang.ashx";
    var jzhuanliandata = [];
    jzhuanliandata['appkey'] = zhuanlian_config["jingdong_appkey"];
    jzhuanliandata['sid'] = zhuanlian_config["jingdong_appSecret"];
    jzhuanliandata['unionId'] = zhuanlian_config["jingdong_unionId"];
    if (zhuanlian_config["jingdong_positionId"]) {
        jzhuanliandata['positionId'] = zhuanlian_config["jingdong_positionId"];
    }
    jzhuanliandata['pid'] = zhuanlian_config["jingdong_pid"] || "mm";
    jzhuanliandata['tkl'] = encodeURIComponent(neirong);
    // 京东接口返回 JSON 文本，由调用方自行 JSON.parse（与旧实现一致）
    return xb_zl_text(jzhuanlianhost + "?" + http_build_query(jzhuanliandata));
}

/* 淘宝：走「新手扶持计划」口令解析（taobao_method 已配）*/
async function xb_zl_taobao_fuchi(bianli, zhuanhref, zhuanlian_config) {
    var R = await dtaobaofuchi(zhuanhref, zhuanlian_config["taobao_method"]);
    if (!R.ok) { return; }
    var shibie = R.data;
    if (shibie.code != 1) {
        layer.msg("大淘客新手扶持计划转链失败(Token失效)：" + shibie.msg);
        return;
    }
    shibie.data = shibie.data[0];
    shibie.goods_info = shibie.data.goods_info;
    var fanhuiyangshi = zhuanlian_config["taobao_shangpingeshi"];
    if (!shibie.goods_info.rate) { return; }
    if (shibie.goods_info.coupon_amount) {
        var yongjin = shibie.goods_info.price * Number(shibie.goods_info.rate) / 100;
        yongjin = yongjin.toFixed(2);
        var daoshoujia = (shibie.goods_info.price - yongjin).toFixed(2);
    } else {
        yongjin = shibie.goods_info.original_price * Number(shibie.goods_info.rate) / 100;
        yongjin = yongjin.toFixed(2);
        daoshoujia = (shibie.goods_info.original_price - yongjin).toFixed(2);
    }
    fanhuiyangshi = zl_fill(fanhuiyangshi, {
        '所属平台': '淘宝',
        '商品名称': shibie.goods_info.title,
        '商品ID': shibie.goods_info.item_id,
        '月销量': shibie.goods_info.sales,
        '商品原价': shibie.goods_info.original_price,
        '商品券后价': shibie.goods_info.price,
        '优惠券面额': shibie.goods_info.coupon_amount,
        '佣金比例': Number(shibie.goods_info.rate).toFixed(2),
        '预估佣金': yongjin,
        '最终到手价': daoshoujia
    });
    $(bianli).attr("href", shibie.data.short_url);
    $(bianli).attr("data-tkl", shibie.data.longTpwd);
    $(bianli).text(shibie.data.short_url + fanhuiyangshi);
}

/* 淘宝活动/会场（20261019 新增）：活动格式优先 taobao_huodonggeshi，留空则回落商品格式；
   占位符只认 {所属平台} 与 {活动ID}——活动没有商品维度字段，写别的会原样留在文案里。
   转链失败一律不改动原链接（与商品分支的失败语义一致，避免把可用链接替换成空）。 */
async function xb_zl_taobao_huodong(bianli, shibie_data, zhuanlian_config) {
    var sceneId = shibie_data.activityId || shibie_data.itemId;
    var tpl = zhuanlian_config["taobao_huodonggeshi"] || zhuanlian_config["taobao_shangpingeshi"] || "";
    var txt = zl_fill(tpl, {'所属平台': '淘宝', '活动ID': sceneId});
    // 优先级：contentParse 已给的推广短链 > activity-link 现场转链
    if (shibie_data.promotionShortUrl) {
        $(bianli).attr("href", shibie_data.promotionShortUrl);
        $(bianli).attr("data-tkl", shibie_data.longTpwd);
        $(bianli).text(shibie_data.promotionShortUrl + txt);
        return;
    }
    var R = await dtaobaohuichang(sceneId, zhuanlian_config);
    if (!R.ok || !R.data || !R.data.data || !R.data.data.click_url) { return; }
    $(bianli).attr("href", R.data.data.click_url);
    $(bianli).attr("data-tkl", R.data.data.longTpwd);
    $(bianli).text(R.data.data.click_url + txt);
}

/* 淘宝：走内容解析（未配 taobao_method） */
async function xb_zl_taobao_jianqie(bianli, zhuanhref, zhuanlian_config) {
    var R = await jianqieban(zhuanhref, zhuanlian_config["taobao_appkey"], zhuanlian_config["taobao_appSecret"], zhuanlian_config);
    if (!R.ok) { return; }
    var shibie = R.data;
    if (shibie.msg != "成功v2") { return; }
    if (!(shibie.data.parseStatus == "3" && shibie.data.dataType == "goods" && shibie.data.itemId)) {
        if ((shibie.data.parseStatus == "4" || shibie.data.parseStatus == "5") && shibie.data.dataType == "activity") {
            if (shibie.data.activityId || shibie.data.itemId) { await xb_zl_taobao_huodong(bianli, shibie.data, zhuanlian_config); }
        }
        return;
    }
    var fanhuiyangshi = zhuanlian_config["taobao_shangpingeshi"];
    if (!shibie.data.commissionRate) { return; }
    if (zhuanlian_config["taobao_bili"] > 0) {
        shibie.data.commissionRate = (shibie.data.commissionRate * zhuanlian_config["taobao_bili"] / 100).toFixed(2);
    }
    var yongjin, daoshoujia;
    if (shibie.data.actualPrice) {
        yongjin = (shibie.data.actualPrice * shibie.data.commissionRate / 100).toFixed(2);
        daoshoujia = (shibie.data.actualPrice - yongjin).toFixed(2);
    } else {
        yongjin = (shibie.data.originalPrice * shibie.data.commissionRate / 100).toFixed(2);
        daoshoujia = (shibie.data.originalPrice - yongjin).toFixed(2);
    }
    fanhuiyangshi = zl_fill(fanhuiyangshi, {
        '所属平台': '淘宝',
        '商品名称': shibie.data.itemName,
        '商品ID': shibie.data.itemId,
        '月销量': shibie.data.monthSales,
        '商品原价': shibie.data.originalPrice,
        '商品券后价': shibie.data.actualPrice,
        '优惠券面额': shibie.data.couponPrice,
        '佣金比例': shibie.data.commissionRate,
        '预估佣金': yongjin,
        '最终到手价': daoshoujia
    });
    if (shibie.data.promotionShortUrl) {
        $(bianli).attr("href", shibie.data.promotionShortUrl);
        $(bianli).attr("data-tkl", shibie.data.longTpwd);
        $(bianli).text(shibie.data.promotionShortUrl + fanhuiyangshi);
        return;
    }
    var R2 = await dtaobaoshangpin(shibie.data.itemId, zhuanlian_config);
    if (!R2.ok) { return; }
    var shangpin = R2.data;
    $(bianli).attr("href", shangpin.data.shortUrl);
    $(bianli).attr("data-tkl", shangpin.data.longTpwd);
    $(bianli).text(shangpin.data.shortUrl + fanhuiyangshi);
}

/* 京东：折京客高佣转链 */
async function xb_zl_jingdong(bianli, zhuanhref, zhuanlian_config) {
    var R = await zjingdongshangpin(zhuanhref, zhuanlian_config);
    if (!R.ok) { return; }
    var shibie;
    try { shibie = JSON.parse(R.text); } catch (e) { return; }
    if (shibie.status !== 200) {
        if (!zhuanlian_config["jingdong_appSecret"] || String(shibie.content).includes("有问题，可联系15611448080")) {
            layer.confirm('折京客京东转链升级<br>不升级无法完成京东转链', {
                icon: 3,
                title: '提示',
                btn: ['查看教程', '取消']
            }, function (index) {
                /* 20261019：原跳 /jiaocheng/718063.html 两站均 404（该文已删），改跳转链总教程 */
                window.location.href = '/docs/x8r65.html';
                layer.close(index);
            }, function (index) {
                layer.close(index);
            });
        } else {
            layer.msg(shibie.content);
        }
        return;
    }
    if (!shibie.title) {
        /* 会场/活动类链接落到这里：格式优先取「活动转链返回格式」，留空回落商品格式（20261019） */
        var hdYangshi = zhuanlian_config["jingdong_huodonggeshi"] || zhuanlian_config["jingdong_shangpingeshi"] || "";
        var hdTxt = zl_fill(hdYangshi, {'所属平台': '京东', '活动ID': shibie.tao_id});
        if (shibie.content && shibie.content != zhuanhref) {
            $(bianli).attr("href", shibie.content);
            $(bianli).attr("data-tkl", shibie.content);
            $(bianli).text(shibie.content + hdTxt);
        }
        return;
    }
    if (!shibie.tkrate3) { return; }
    var fanhuiyangshi = zhuanlian_config["jingdong_shangpingeshi"] || "";
    var yongjin, daoshoujia;
    var plusyongjin, plusdaoshoujia;
    if (shibie.quanhou_jiage) {
        yongjin = (shibie.quanhou_jiage * shibie.tkrate3 / 100).toFixed(2);
        daoshoujia = (shibie.quanhou_jiage - yongjin).toFixed(2);
        plusyongjin = yongjin;
        plusdaoshoujia = daoshoujia;
    } else {
        yongjin = (shibie.size * shibie.tkrate3 / 100).toFixed(2);
        daoshoujia = (shibie.size - yongjin).toFixed(2);
        plusyongjin = yongjin;
        plusdaoshoujia = daoshoujia;
    }
    /* 优惠券面额：两个价有一个缺失时相减得 NaN，zl_v 会把它变成空串而不是写出 "NaN" */
    var quanmiane = (shibie.size !== undefined && shibie.quanhou_jiage !== undefined)
        ? (Number(shibie.size) - Number(shibie.quanhou_jiage)) : '';
    fanhuiyangshi = zl_fill(fanhuiyangshi, {
        '所属平台': '京东',
        '商品名称': shibie.title,
        '商品ID': shibie.tao_id,
        '月销量': shibie.volume,
        '商品原价': shibie.size,
        '商品券后价': shibie.quanhou_jiage,
        '优惠券面额': quanmiane,
        '佣金比例': shibie.tkrate3,
        'PLUS佣金比例': shibie.tkrate3,
        '预估佣金': yongjin,
        'PLUS预估佣金': plusyongjin,
        '最终到手价': daoshoujia,
        'PLUS最终到手价': plusdaoshoujia
    });
    if (shibie.content && shibie.content != zhuanhref) {
        $(bianli).attr("href", shibie.content);
        $(bianli).attr("data-tkl", shibie.content);
        $(bianli).text(shibie.content + fanhuiyangshi);
    }
}

/* 拼多多：内容解析 → 缺短链时再取一次商品推广链接 */
async function xb_zl_pinduoduo(bianli, zhuanhref, zhuanlian_config) {
    var R = await jianqieban(zhuanhref, zhuanlian_config["pingduoduo_appkey"], zhuanlian_config["pingduoduo_appSecret"], zhuanlian_config);
    if (!R.ok) { return; }
    var shibie = R.data;
    if (shibie.msg != "成功v2") { return; }
    if (!(shibie.data.parseStatus == "3" && shibie.data.dataType == "goods" && shibie.data.itemId)) {
        /* 拼多多活动类链接：上游无活动转链接口，保持原链接不动（与旧行为一致，仅去掉调试输出） */
        return;
    }
    var fanhuiyangshi = zhuanlian_config["pingduoduo_shangpingeshi"];
    if (!shibie.data.commissionRate) { return; }
    var yongjin, daoshoujia;
    if (shibie.data.actualPrice) {
        yongjin = (shibie.data.actualPrice * shibie.data.commissionRate / 100).toFixed(2);
        daoshoujia = (shibie.data.actualPrice - yongjin).toFixed(2);
    } else {
        yongjin = (shibie.data.originalPrice * shibie.data.commissionRate / 100).toFixed(2);
        daoshoujia = (shibie.data.originalPrice - yongjin).toFixed(2);
    }
    fanhuiyangshi = zl_fill(fanhuiyangshi, {
        '所属平台': '拼多多',
        '商品名称': shibie.data.itemName,
        '商品ID': shibie.data.itemId,
        '月销量': shibie.data.monthSales,
        '商品原价': shibie.data.originalPrice,
        '商品券后价': shibie.data.actualPrice,
        '优惠券面额': shibie.data.couponPrice,
        '佣金比例': shibie.data.commissionRate,
        '预估佣金': yongjin,
        '最终到手价': daoshoujia
    });
    if (shibie.data.promotionShortUrl) {
        $(bianli).attr("href", shibie.data.promotionShortUrl);
        $(bianli).text(shibie.data.promotionShortUrl + fanhuiyangshi);
        return;
    }
    var R2 = await dpinpddshangpin(shibie.data.itemId, zhuanlian_config);
    if (!R2.ok) { return; }
    var shangpin = R2.data;
    $(bianli).attr("href", shangpin.data.mobileShortUrl);
    $(bianli).text(shangpin.data.mobileShortUrl + fanhuiyangshi);
}

function shangpinzhuanlian(yuansu, zhuanlian_config) {
    var links = $(yuansu).find("a");
    Array.prototype.slice.call(links).forEach(function (bianli) {
        // 每条链接独立异步（旧实现同款：$.when(...).done() 之间互不阻塞）
        (async function () {
            var zhuanhref = $(bianli).attr("href");
            if (!zhuanhref) { return; }
            if (zhuanlian_config["taobao_kaiguan"] == "1" && zhuanhref.match(RegExp(/taobao.com|tb.cn|taobao.hk|tmall.com|tmall.hk/ig))) {
                if (zhuanlian_config["taobao_method"]) { await xb_zl_taobao_fuchi(bianli, zhuanhref, zhuanlian_config); }
                else { await xb_zl_taobao_jianqie(bianli, zhuanhref, zhuanlian_config); }
            }
            if (zhuanlian_config["jingdong_kaiguan"] == "1" && zhuanhref.match(RegExp(/jd.com/ig))) {
                await xb_zl_jingdong(bianli, zhuanhref, zhuanlian_config);
            }
            if (zhuanlian_config["pingduoduo_kaiguan"] == "1" && zhuanhref.match(RegExp(/yangkeduo.com|pinduoduo.com/ig))) {
                await xb_zl_pinduoduo(bianli, zhuanhref, zhuanlian_config);
            }
        }());
    });
}
