/**
 * 侧栏轻量初始化（20261004 服务端直出改造版）
 * 侧栏全部卡片（我的关注/排行榜/我的收藏/相关标签/同分类热帖）与文章页「猜你喜欢」
 * 已由主题 function/service_sidebar.php 服务端直出，本文件不再发任何首屏 AJAX，只负责：
 * ① 卡片内 Swiper 初始化与 tab 联动（我的关注 g-tabs / 排行榜 r-tabs）；
 *    （20261015 Swiper 官方 bundle 已换自写 app/xb-swiper.js，API 同名兼容，本文件调用面未动）
 * ② 分类热帖页主列表三窗轮播（.xb-hots-swiper，tab 点击/hover 切换）；
 * ③ 猜你喜欢 swiper 初始化（autoHeight，筛选后重测高度）；
 * ④ 服务端渲染行的后处理：全局筛选（xb_global_filter/fe）+ 标题标红（list_red）；
 * ⑥ 我的关注底部「查看更多内容」链接跟随激活分组（/category-guanzhuN/）；
 * ⑦ 公告·新人指引卡关闭记忆（localStorage 按版本，新公告自动重现）。
 */
const SidebarModule = (function ($) {

    function isTouchDevice() {
        return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    }

    function updateTabs($root, tabClass, activeIndex) {
        const $tabs = $root.find(`.${tabClass} span`);
        $tabs.removeClass('active');
        $tabs.eq(activeIndex).addClass('active');
        const $t = $tabs.eq(activeIndex);
        // 排行榜卡：查看完整榜单跟随激活 tab（tab 带 data-ft=/xx-hot.html）
        const ft = $t.data('ft');
        if (ft) {
            $root.find('.xb-rk-ftlink').attr('href', ft);
        }
        // 我的关注卡：底链跟随 data-gzid（/category-guanzhuN/），且激活板块行数满 10 才显示
        const gzid = parseInt($t.data('gzid'), 10);
        if (gzid > 0) {
            $root.find('.xb-gz-ftlink').attr('href', '/category-guanzhu' + gzid + '/');
        }
        const $gzFt = $root.find('.xb-gz-ftlink');
        if ($gzFt.length) {
            const rows = $root.find('.swiper .swiper-slide').eq(activeIndex).find('li.article-list').length;
            $gzFt.closest('.side-ft').toggleClass('xb-fthide', rows < 10);
        }
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
        // tab 事件委托：点击（触屏）/点击+悬停（PC）切换到对应窗格
        const $tabs = $root.find(`.${tabClass} span`);
        const eventType = isTouchDevice() ? 'click' : 'click mouseenter';
        $tabs.off(eventType);
        $tabs.on(eventType, function (e) {
            if (e.type === 'mouseenter' && $(this).hasClass('active')) return;
            e.preventDefault();
            const index = $(this).data('index');
            updateTabs($root, tabClass, index);
            mySwiper.slideTo(index);
        });
        // 初始同步一次（底链指向/显隐与首窗格对齐）
        updateTabs($root, tabClass, 0);
        return mySwiper;
    }

    // 侧栏卡片 swiper 初始化（服务端已直出 DOM，这里只建实例）
    function initSwiperCard(rootSel, tabClass) {
        $(rootSel).each(function () {
            const $root = $(this);
            const el = $root.find('.swiper')[0];
            if (!el || typeof Swiper === 'undefined') return;
            try {
                createSwiperInstance(el, $root, tabClass);
            } catch (e) {
                console.error('侧栏 swiper 初始化失败:', e);
            }
        });
    }

    // 服务端渲染行的全局筛选（window.xb_global_filter / 用户端 fe filter；未启用时内部直通）
    function applyGlobalFilters() {
        if (typeof xb_global_listfilter === 'function') {
            xb_global_listfilter($('.theiaStickySidebar .guanzhu .article-list'), ['侧栏我的关注', '我的关注']);
            xb_global_listfilter($('.theiaStickySidebar .rank-list .article-list'), '排行榜');
            xb_global_listfilter($('#mainbox .xiangguan .article-list'), '猜你喜欢');
        }
        if (typeof xb_global_fe_listfilter === 'function') {
            xb_global_fe_listfilter($('.theiaStickySidebar .guanzhu .article-list'), ['侧栏我的关注', '我的关注']);
            xb_global_fe_listfilter($('.theiaStickySidebar .rank-list .article-list'), '排行榜');
            xb_global_fe_listfilter($('#mainbox .xiangguan .article-list'), '猜你喜欢');
        }
    }

    // 标题标红（侧栏 bangdan 板块 + 猜你喜欢 xiangguan 板块；主列表由 meta.php 现有 list_red 覆盖）
    function applyListRed(redstr) {
        if (!redstr || typeof list_red !== 'function') return;
        try { list_red(redstr, 'bangdan'); } catch (e) { console.error('list_red error:', e); }
        try { list_red(redstr, 'xiangguan'); } catch (e) { /* 板块缺失时静默 */ }
    }

    // 分类热帖页主列表三窗轮播（cate-hot.php：.rt-tabs span[data-index] ↔ .xb-hots-swiper）
    function syncHotTabs(activeIndex) {
        $('.mianbaoxie .rt-tabs span[data-index]').removeClass('active');
        $('.mianbaoxie .rt-tabs span[data-index]').eq(activeIndex).addClass('active');
    }

    function initHotSwiper() {
        if (typeof Swiper === 'undefined') return;
        document.querySelectorAll('.xb-hots-swiper').forEach(function (el) {
            if (el.swiperInstance) return;
            try {
                const mySwiper = new Swiper(el, {
                    autoHeight: true,
                    speed: 300,
                    on: {
                        slideChange: function () {
                            syncHotTabs(this.activeIndex);
                        },
                    },
                });
                el.swiperInstance = mySwiper;
                const $tabs = $('.mianbaoxie .rt-tabs span[data-index]');
                const eventType = isTouchDevice() ? 'click' : 'click mouseenter';
                $tabs.off(eventType).on(eventType, function (e) {
                    if (e.type === 'mouseenter' && $(this).hasClass('active')) return;
                    e.preventDefault();
                    const index = parseInt($(this).data('index'), 10) || 0;
                    syncHotTabs(index);
                    mySwiper.slideTo(index);
                });
            } catch (e) {
                console.error('热帖窗格 swiper 初始化失败:', e);
            }
        });
    }

    // 猜你喜欢 swiper（autoHeight；筛选/标红可能隐藏行，延后重测一次高度避免"空尾巴"）
    function initGuesslike() {
        const el = document.querySelector('#mainbox .xiangguan .swiper');
        if (!el || el.swiperInstance || typeof Swiper === 'undefined') return;
        try {
            const mySwiper = new Swiper(el, { autoHeight: true });
            el.swiperInstance = mySwiper;
            setTimeout(function () {
                try {
                    if (typeof mySwiper.update === 'function') {
                        mySwiper.update();
                        if (typeof mySwiper.updateAutoHeight === 'function') mySwiper.updateAutoHeight(0);
                    }
                } catch (e) { /* 旧版 Swiper 无这些 API 时静默 */ }
            }, 400);
        } catch (e) {
            console.error('猜你喜欢 swiper 初始化失败:', e);
        }
    }

    // ================= 全站标签热度 =================
    // 服务端直出多窗格（Scope=全部+各 own 标签 × 窗口=48小时/30天），这里只做切换与 tooltip
    function bindTagHeat() {
        $(document).off('click.xbthtab').on('click.xbthtab', '.xb-tagheat-tabs span', function () {
            const $span = $(this);
            const $box = $span.closest('.xb-tagheat');
            if ($span.parent().hasClass('xb-th-win')) {
                $box.find('.xb-th-win span').removeClass('on');
            } else {
                $box.find('.xb-th-scope span').removeClass('on');
            }
            $span.addClass('on');
            const scope = String($box.find('.xb-th-scope span.on').data('scope') === undefined ? '0' : $box.find('.xb-th-scope span.on').data('scope'));
            const win = String($box.find('.xb-th-win span.on').data('win') === undefined ? '48' : $box.find('.xb-th-win span.on').data('win'));
            $box.find('.xb-tagheat-pane').removeClass('on');
            $box.find('.xb-tagheat-pane[data-scope="' + scope + '"][data-win="' + win + '"]').addClass('on');
        });
        // 曲线 tooltip：SVG 带 data-v/data-base/data-step/data-unit，按鼠标 X 换算槽位
        // （preserveAspectRatio=none 会拉伸图形，tooltip 坐标一律按 client 尺寸比例计算）
        $(document).off('mousemove.xbthtip mouseleave.xbthtip')
            .on('mousemove.xbthtip', '.xb-trend-svg[data-v]', function (e) {
                const svg = this;
                const vals = String(svg.dataset.v || '').split(',');
                if (!vals.length) { return; }
                const rect = svg.getBoundingClientRect();
                const n = vals.length;
                const idx = Math.max(0, Math.min(n - 1, Math.round((e.clientX - rect.left) / rect.width * (n - 1))));
                const base = Number(svg.dataset.base) || 0;
                const step = Number(svg.dataset.step) || 3600;
                const unit = svg.dataset.unit || '';
                const ts = new Date((base + idx * step) * 1000);
                const label = (ts.getMonth() + 1) + '-' + ts.getDate() + (step === 3600 ? ' ' + ts.getHours() + '时' : '');
                const v = Number(vals[idx]) || 0;
                const $trend = $(svg).closest('.xb-trend');
                let $tip = $trend.data('xbtip');
                if (!$tip || !$tip.length) {
                    $tip = $('<div class="xb-tagheat-tip"></div>');
                    $trend.append($tip);
                    $trend.data('xbtip', $tip);
                }
                // 纵向跟点：viewBox 高 40，归一化 y=36-v/max*36，按 client 高等比还原
                const max = Math.max.apply(null, vals.map(Number)) || 1;
                const yPx = (36 - v / max * 36) / 40 * rect.height + (rect.top - $trend[0].getBoundingClientRect().top);
                const xPx = e.clientX - $trend[0].getBoundingClientRect().left;
                $tip.text(label + ' · ' + v + ' ' + unit)
                    .css({ left: Math.max(30, Math.min(xPx, $trend[0].clientWidth - 30)), top: yPx - 4 })
                    .show();
            })
            .on('mouseleave.xbthtip', '.xb-trend-svg[data-v]', function () {
                const $trend = $(this).closest('.xb-trend');
                const $tip = $trend.data('xbtip');
                if ($tip) { $tip.hide(); }
            });
    }

    // ================= 公告·新人指引卡 + 订阅推送卡关闭记忆 =================
    // 关闭后 localStorage 记「卡片版本」（最新公告文章指纹）；发布新公告 → 版本变化 → 自动重现。
    // 20261021：两张卡共用同一键 xb_notice_x 同一版本值——点任一 × 两张卡同时隐藏、同时重现。
    function initNoticeCard() {
        const n = document.getElementById('xb-notice');
        const d = document.getElementById('xb-dycard');
        // 共享版本值：优先公告卡 data-ver（版本计算单点在公告卡），缺席时兜底 '1'
        const ver = (n && n.dataset.ver) ? n.dataset.ver : '1';
        if (!n && !d) return;
        let closed = null;
        try { closed = localStorage.getItem('xb_notice_x'); } catch (e) { /* 隐私模式静默 */ }
        if (closed && closed === ver) {
            if (n) n.style.display = 'none';
            if (d) d.style.display = 'none';
            return;
        }
        const onClose = function (card) {
            card.style.display = 'none';
            try { localStorage.setItem('xb_notice_x', ver); } catch (e) { /* 静默 */ }
            // 两卡联动：关任一张，另一张同步隐藏（另一张的 × 事件无需触发）
            if (n && card !== n) n.style.display = 'none';
            if (d && card !== d) d.style.display = 'none';
        };
        const x = n && n.querySelector('.xb-notice-x');
        if (x) {
            x.addEventListener('click', function (e) {
                e.preventDefault();
                onClose(n);
            });
        }
        const dx = d && d.querySelector('.xb-dycard-x');
        if (dx) {
            dx.addEventListener('click', function (e) {
                e.preventDefault();
                onClose(d);
            });
        }
    }

    // ================= 主入口 =================
    // opts：{ redstr: '标红关键词串' }（meta.php 注入；侧栏排行榜与猜你喜欢板块标红用）
    function init(opts) {
        opts = opts || {};
        bindTagHeat();
        initNoticeCard();
        // 先筛选/标红再建 swiper：autoHeight 按筛选后高度定格（与原 JS 渲染时序一致）
        applyGlobalFilters();
        applyListRed(String(opts.redstr || ''));
        initSwiperCard('.theiaStickySidebar .guanzhu', 'g-tabs');
        initSwiperCard('.theiaStickySidebar .rank-list', 'r-tabs');
        initHotSwiper();
        initGuesslike();
    }

    return { init: init };

})(jQuery);


