/* ═══════════════════════════════════════════════════════════════
 * 「只看楼主」空结果修正（2026-11-22）
 *
 * 背景：chakanlouzhu() 在 xb-extra.min.js（页面真加载的压缩包）里，
 *   逻辑是「把没有 .level-louzu 的 .ul 全加 hide」。当帖子楼主从不参与
 *   评论时（豆瓣买组很常见），65 条评论会全部被 hide，只剩空白卡。
 *
 * 为什么不改压缩包：xb-extra.min.js 是构建产物，直接改会在下次重新
 *   压缩时被覆盖；而且压缩代码改错难发现。这里用「监听点击 + 事后修正」
 *   的旁路方案，与压缩包完全解耦。
 *
 * 行为：
 *   1. 点「只看楼主」后，若列表里一条可见楼层都没有 → 自动回退
 *      （恢复所有楼层 + 按钮态复位），并显示提示条。
 *   2. 提示条文案：说明楼主未参与评论，所以无法只看楼主。
 *   3. 再次点击仍可尝试（比如数据后续更新有楼主楼层了）。
 *
 * 与 CSS 的关系：comment-lz-empty.css 用纯 :has() 也能显示提示，
 *   但无法复位按钮态（窗口变量 window.showlouzhu 仍是 off）。
 *   本脚本补上这一步，两者叠加不冲突（都用 .xb-lz-empty 节点/伪元素）。
 * ═══════════════════════════════════════════════════════════════ */
(function () {
    'use strict';
    if (window.__xbLzFixBound) { return; }
    window.__xbLzFixBound = true;

    var TIP = '本条线报的楼主还没有参与评论，暂无可筛选的楼层。';

    function $list() { return document.querySelector('.art-fujia-content .comment-list'); }

    function fix() {
        var list = $list();
        if (!list) { return; }
        var uls = list.querySelectorAll('.ul');
        if (!uls.length) { return; }

        var visible = 0;
        for (var i = 0; i < uls.length; i++) {
            if (!uls[i].classList.contains('hide')) { visible++; }
        }

        // 还有可见楼层 → 正常筛选状态
        if (visible > 0) {
            // ⚠ 只清「上一次回退遗留」的提示；本次刚插入的提示要留着
            var old = list.querySelector('.xb-lz-empty[data-stale="1"]');
            if (old) { old.parentNode.removeChild(old); }
            // 已存在的提示升级为 stale，供下次正常筛选时清掉
            var cur = list.querySelector('.xb-lz-empty');
            if (cur) { cur.setAttribute('data-stale', '1'); }
            return;
        }

        // 全被隐藏（楼主未参与）→ 回退：恢复所有楼层
        for (var j = 0; j < uls.length; j++) {
            uls[j].classList.remove('hide');
        }
        // 复位按钮态（chakanlouzhu 用的全局窗口变量）
        window.showlouzhu = 'on';
        var btns = document.querySelectorAll('.art-fujia-content .comment-list .showlouzhu');
        for (var k = 0; k < btns.length; k++) {
            btns[k].classList.remove('showlouzhu-hover');
        }
        // 显示提示（新插的标 stale=0，确保不会被紧接着的第二轮 fix 删掉）
        var tip = list.querySelector('.xb-lz-empty');
        if (!tip) {
            tip = document.createElement('div');
            tip.className = 'xb-lz-empty';
            tip.textContent = TIP;
            list.appendChild(tip);
        }
        tip.setAttribute('data-stale', '0');
    }

    // 事件委托：捕获阶段监听，保证在 chakanlouzhu 执行之后再修正
    document.addEventListener('click', function (e) {
        var t = e.target;
        while (t && t !== document) {
            if (t.classList && t.classList.contains('showlouzhu')) {
                // 延到下一个宏任务，等 chakanlouzhu 的 each() 跑完
                setTimeout(fix, 0);
                return;
            }
            t = t.parentNode;
        }
    }, true);

    // 首次进入也检查一次（防止缓存页深链进来就是隐藏态）
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { setTimeout(fix, 60); });
    } else {
        setTimeout(fix, 60);
    }
})();
