/**
 * 侧边栏综合模块 (我的关注 + 排行榜) - 最终版 (直接初始化，解决高度问题)
 * 核心思想：数据完全加载后，一次性渲染HTML并初始化Swiper，确保autoHeight准确。
 */
const SidebarModule = (function ($) {
    
    const CONFIG = {
        containerSelector: '.theiaStickySidebar',
        guanzhuApi: '/plus/json/guanzhu.php',
        rankApiPrefix: '/plus/json/rank/',
        cacheDuration: 5*60,          // 排行榜缓存时间 (分钟)
        guanzhuCacheDuration: 3*60,    // 我的关注缓存时间 (分钟)
        peakTimeMsg: {
            guanzhu: '高峰时间非会员我的关注列表暂停输出<br>请去顶部导航"我的关注"查看信息',
            rank: '高峰时间非会员侧栏排行榜暂停输出<br>请去顶部导航"排行榜"查看榜单'
        }
    };

    const RANK_NAME_TO_KEY_MAP = {
        "一小时排行榜": "yixiaoshi",
        "三小时排行榜": "sanxiaoshi",
        "六小时排行榜": "liuxiaoshi",
        "十二小时榜": "shierxiaoshi",
        "二十四小时榜": "ershisixiaoshi",
        "四十八小时榜": "sishibaxiaoshi",
        "今天排行榜": "jintian",
        "昨天排行榜": "zuotian",
        "前天排行榜": "qiantian",
    };

    function isTouchDevice() {
        return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    }

    function buildSlideHtml(listData) {
        if (!listData || listData.length === 0) {
            return '<div class="swiper-slide"><div class="empty-tip" style="padding:15px;text-align:center;color:#999;">暂无数据</div></div>';
        }
        let innerHtml = '';
        if (typeof listtimechuli === 'function') {
            try {
                innerHtml = listtimechuli(listData);
                if (typeof innerHtml !== 'string') innerHtml = '';
            } catch (e) {
                console.error('listtimechuli 执行错误:', e);
                innerHtml = '<li>列表渲染错误</li>';
            }
        } else {
            console.warn('缺少 listtimechuli 函数，使用默认占位');
            innerHtml = '<li>系统初始化中...</li>';
        }
        return `<div class="swiper-slide"><ul class="new-post">${innerHtml}</ul></div>`;
    }

    // 创建 Swiper 实例的辅助函数
    function createSwiperInstance(element, $root, tabClass) {
        if (element.swiperInstance) {
            element.swiperInstance.destroy(true, true); // 销毁旧实例
        }
        const mySwiper = new Swiper(element, {
            autoHeight: true,
            speed: 300,
            on: {
                slideChange: function () {
                    updateTabs($root, tabClass, this.activeIndex);
                },
            },
        });
        element.swiperInstance = mySwiper; // 将实例挂载到DOM元素上，便于管理
        bindTabEvents($root, tabClass, mySwiper);
        return mySwiper;
    }

    function updateTabs($root, tabClass, activeIndex) {
        const $tabs = $root.find(`.${tabClass} span`);
        $tabs.removeClass('active');
        $tabs.eq(activeIndex).addClass('active');
    }

    function bindTabEvents($root, tabClass, swiperInstance) {
        const $tabs = $root.find(`.${tabClass} span`);
        const eventType = isTouchDevice() ? 'click' : 'click mouseenter';
        $tabs.off(eventType);
        $tabs.on(eventType, function (e) {
            if (e.type === 'mouseenter' && $(this).hasClass('active')) return;
            e.preventDefault();
            const index = $(this).data('index');
            updateTabs($root, tabClass, index);
            swiperInstance.slideTo(index);
        });
    }

    // --- 我的关注 (已按新规则修改：仅 code: 200 时缓存) ---
    function fetchGuanzhuData() {
        const ids = [1, 2, 3];
        
        const promises = ids.map(id => {
            const cacheKey = `guanzhu_${id}`;
            
            if (typeof lscache !== 'undefined' && lscache.supported()) {
                const cached = lscache.get(cacheKey);
                if (cached !== null && cached !== undefined) {
                    console.log(`✅ [关注] 命中缓存: ${cacheKey}`);
                    return Promise.resolve(cached);
                }
            }

            console.log(`🔍 [关注] 缓存未命中，发起请求: ${cacheKey}`);
            return new Promise((resolve, reject) => {
                $.ajax({
                    url: `${CONFIG.guanzhuApi}?id=${id}`,
                    type: 'GET',
                    dataType: 'json',
                    timeout: 10000
                })
                .done(function(data) {
                    if (data && data.code === 200) {
                        if (typeof lscache !== 'undefined' && lscache.supported()) {
                            lscache.set(cacheKey, data, CONFIG.guanzhuCacheDuration);
                            console.log(`💾 [关注] 已缓存: ${cacheKey} (有效期 ${CONFIG.guanzhuCacheDuration}秒)`);
                        }
                    } else {
                        console.log(`⚠️ [关注] 请求成功但业务状态码非200 (code: ${data?.code}), 跳过缓存: ${cacheKey}`);
                    }
                    resolve(data);
                })
                .fail(function(xhr, status, error) {
                    console.warn(`❌ [关注] 请求失败: id=${id}, Status: ${status}, Error: ${error}`);
                    resolve({ code: 500, name: `分类${id}`, list: [] });
                });
            });
        });

        return Promise.all(promises);
    }

    // --- 重构后的 renderGuanzhu ---
    function renderGuanzhu(netkaiguan) {
        const $container = $(CONFIG.containerSelector);
        if (netkaiguan !== "on") {
            $container.append(`<div class="guanzhu sb mb"><div class="mianbaoxie" style="color:#ff6b6b">${CONFIG.peakTimeMsg.guanzhu}</div></div>`);
            return Promise.resolve();
        }

        // 关键：先获取所有数据
        return fetchGuanzhuData().then(dataList => {
            let tabsHtml = '';
            let slidesHtml = '';
            
            // 然后构建完整的HTML结构
            dataList.forEach((resp, index) => {
                const name = resp.name || `我的关注${index+1}`;
                const isActive = index === 0 ? 'active' : '';
                tabsHtml += `<span class="${isActive}" data-index="${index}">${name}</span>`;
                slidesHtml += buildSlideHtml(resp.list);
            });

            const html = `
                <div class="guanzhu sb mb">
                    <div class="clearfix">
                        <div class="mianbaoxie tabs g-tabs">${tabsHtml} <div class="guanzhu-prompt fr" onclick="showGuanzhuPrompt()" class="fr"><i class="iconfont icon-jubao"></i></div></div>
                        <div class="swiper g-swiper">
                            <div class="swiper-wrapper">${slidesHtml}</div>
                        </div>
                    </div>
                </div>`;

            // 将完整的HTML添加到DOM
            $container.append(html);
            
            // 查找到刚刚添加的根元素和Swiper容器
            const $newGuanzhuRoot = $container.find('.guanzhu').last();
            const swiperElement = $newGuanzhuRoot.find('.g-swiper')[0];

            // 此时，DOM中已经有了完整的、带内容的Swiper结构，可以直接初始化
            if (typeof Swiper !== 'undefined' && swiperElement) {
                createSwiperInstance(swiperElement, $newGuanzhuRoot, 'g-tabs');
            } else {
                console.error('❌ Swiper库或DOM元素未找到，无法初始化我的关注Swiper');
            }
        });
    }

    // --- 排行榜相关辅助函数 ---
    function parseRankName(peizhi) {
        if (!peizhi) return { 'name': 'jintian', 'ming': '未知榜单' };
        var name = RANK_NAME_TO_KEY_MAP[peizhi];
        var ming = peizhi;
        if (typeof name === 'undefined') {
            name = RANK_NAME_TO_KEY_MAP["今天排行榜"];
            ming = "设置错误:" + peizhi;
        }
        return { 'name': name, 'ming': ming };
    }

    function processRankItem(res, shuliang, sortkey, filterArgs) {
        if (!res || !Array.isArray(res)) return buildSlideHtml([]);
        
        var currentCount = 0;
        var filteredItems = [];
        var args = Array.isArray(filterArgs) ? filterArgs : [];
        var [pingbifenlei, pingbilouzhu, zhanxianlouzhu, pingbilouzhuplus,
             pingbibiaoti, zhanxianbiaoti, pingbibiaotiplus, pingbineirong,
             zhanxianneirong, pingbineirongplus, pingbitime] = args;

        for (var i = 0; i < res.length; i++) {
            if (currentCount >= shuliang) break;
            var field = res[i];
            if (typeof listfilter === 'function') {
                try {
                    if (!listfilter(field, pingbifenlei, pingbilouzhu, zhanxianlouzhu, pingbilouzhuplus, pingbibiaoti, zhanxianbiaoti, pingbibiaotiplus, pingbineirong, zhanxianneirong, pingbineirongplus, pingbitime)) {
                        continue;
                    }
                } catch(e) { console.warn('filter error', e); }
            }
            filteredItems.push(field);
            currentCount++;
        }

        if (sortkey !== "1") {
            filteredItems.sort(function(a, b) {
                return (b.shijianchuo || 0) - (a.shijianchuo || 0);
            });
        }
        return buildSlideHtml(filteredItems);
    }

    function fetchRankData(configStr, useCache) {
        if (!configStr || typeof configStr !== 'string') {
            console.error('❌ 排行榜配置错误：configStr 不是字符串!', configStr);
            configStr = "今天排行榜###昨天排行榜###前天排行榜"; 
        }

        const configArr = configStr.trim().split("###");
        const tasks = [];

        for (let i = 0; i < 3; i++) {
            const rawName = configArr[i] || configArr[0];
            const info = parseRankName(rawName);
            const cacheKey = info.name;
            const displayName = info.ming;

            if (useCache && typeof lscache !== 'undefined' && lscache.supported()) {
                const cached = lscache.get(cacheKey);
                if (cached !== null && cached !== undefined) {
                    console.log(`✅ [排行] 命中缓存: ${cacheKey}`);
                    tasks.push(Promise.resolve({ name: displayName, key: cacheKey, data: cached, fromCache: true }));
                    continue;
                }
            }

            tasks.push(new Promise((resolve) => {
                $.ajax({
                    url: `${CONFIG.rankApiPrefix}${cacheKey}.json`,
                    type: 'GET',
                    dataType: 'json',
                    timeout: 10000
                })
                .done(function(data) {
                    if (useCache && typeof lscache !== 'undefined' && lscache.supported()) {
                        lscache.set(cacheKey, data, CONFIG.cacheDuration);
                        console.log(`💾 [排行] 已缓存: ${cacheKey} (有效期 ${CONFIG.cacheDuration}秒)`);
                    }
                    resolve({ name: displayName, key: cacheKey, data: data, fromCache: false });
                })
                .fail(() => resolve({ name: displayName, key: cacheKey, data: [], fromCache: false }));
            }));
        }
        return Promise.all(tasks);
    }

    // --- 重构后的 renderRank ---
    function renderRank(netkaiguan, configStr, shuliang, redstr, sortkey, ...filterArgs) {
        const $container = $(CONFIG.containerSelector);

        if (netkaiguan !== "on") {
            $container.append(`<div class="bangdan sb mb"><div class="mianbaoxie" style="color:#ff6b6b">${CONFIG.peakTimeMsg.rank}</div></div>`);
            return Promise.resolve();
        }

        // 关键：先获取所有数据
        return fetchRankData(configStr, true).then(results => {
            let tabsHtml = '';
            let slidesHtml = '';

            results.forEach((item, index) => {
                const isActive = index === 0 ? 'active' : '';
                tabsHtml += `<span class="${isActive}" data-index="${index}">${item.name}</span>`;
                slidesHtml += processRankItem(item.data, shuliang, sortkey, filterArgs);
            });

            const weizhi = 'rank-list';
            const html = `
                <div class="${weizhi} bangdan sb mb">
                    <div class="clearfix">
                        <div class="mianbaoxie tabs r-tabs">${tabsHtml}</div>
                        <div class="swiper r-swiper">
                            <div class="swiper-wrapper">${slidesHtml}</div>
                        </div>
                    </div>
                </div>`;

            // 将完整的HTML添加到DOM
            $container.append(html);
            
            // 查找到刚刚添加的根元素和Swiper容器
            const $newRankRoot = $container.find(`.${weizhi}`).last();
            const swiperElement = $newRankRoot.find('.r-swiper')[0];

            // 执行可能存在的红色标记逻辑
            if (typeof list_red === 'function' && redstr) {
                try { list_red(redstr, "bangdan"); } catch(e){ console.error('list_red error:', e); }
            }

            // 此时，DOM中已经有了完整的、带内容的Swiper结构，可以直接初始化
            if (typeof Swiper !== 'undefined' && swiperElement) {
                createSwiperInstance(swiperElement, $newRankRoot, 'r-tabs');
            } else {
                console.error('❌ Swiper库或DOM元素未找到，无法初始化排行榜Swiper');
            }
        });
    }

    // ================= 主入口 =================
    function init(guanzhuStatus, rankConfig, rankNetkaiguan, rankShuliang, rankRedstr, rankSortkey, ...rankFilterArgs) {
        const $container = $(CONFIG.containerSelector);
        if ($container.length === 0) {
            console.error('未找到侧边栏容器 (.theiaStickySidebar)');
            return;
        }

        console.log('🚀 侧边栏初始化参数:', {
            guanzhuStatus,
            rankConfig,
            rankNetkaiguan,
            rankShuliang,
            guanzhuCacheMin: CONFIG.guanzhuCacheDuration
        });

        if (typeof rankConfig !== 'string') {
            console.error('❌ 严重错误：第2个参数 rankConfig 必须是字符串');
            rankConfig = "今天排行榜###今天排行榜###今天排行榜";
        }

        // 依次渲染我的关注和排行榜
        // renderGuanzhu(guanzhuStatus)
        //     .then(() => {
        //         return renderRank(rankNetkaiguan, rankConfig, rankShuliang, rankRedstr, rankSortkey, ...rankFilterArgs);
        //     })
        //     .catch(err => {
        //         console.error("💥 侧边栏初始化失败:", err);
        //         $container.append(`<div style="color:red;padding:10px;background:#ffe6e6;border:1px solid red;">JS错误: ${err.message}<br>请检查控制台详情</div>`);
        //     });
        
         renderRank(rankNetkaiguan, rankConfig, rankShuliang, rankRedstr, rankSortkey, ...rankFilterArgs)
            .then(() => {
                return renderGuanzhu(guanzhuStatus);
            })
            .catch(err => {
                console.error("💥 侧边栏初始化失败:", err);
                $container.append(`<div style="color:red;padding:10px;background:#ffe6e6;border:1px solid red;">JS错误: ${err.message}<br>请检查控制台详情</div>`);
            });
            
            
            
    }

    return { init: init };

})(jQuery);


function showGuanzhuPrompt() {
    layer.confirm(
        "本版块是“我的关注”列表，<br>没登录/没设置会显示系统预设内容。<br><br>登录后在用户中心可以自由命名板块名称，<br>并设定对应的分类/内容/关键词/楼主展示规则，<br>实现活动内容的精准过滤与聚合。",
        {
            title: false, // 不显示标题栏
            closeBtn: 0, // 不显示关闭按钮
            btn: ["查看教程", "设置入口", "取消"] // 按钮文本
        },
        function(index) { // 点击“查看教程”按钮的回调函数 (index=0)
            window.open("/docs/7lmvp.html", "_blank");
            layer.close(index);
        },
        function(index) { // 点击“设置入口”按钮的回调函数 (index=1)
            window.open("/Ucenter#/Shezhi_guanzhu", "_blank");
            layer.close(index);
        },
        function(index) { // 点击“取消”按钮的回调函数 (index=2)
            layer.close(index);
        }
    );
}

// // 初始化调用
// SidebarModule.init(
//         "on",  
//         "一小时排行榜###三小时排行榜###六小时排行榜", 
//         "on",  
//         20,    
//         "",    
//         "0",   
//         "", "", "", "", "", "", "", "", "", "", "" 
//     );