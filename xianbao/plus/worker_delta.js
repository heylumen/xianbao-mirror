addEventListener('message', function(e) {
    var msgjson = {};
    var postdata = e.data;
    var jiangeshijian = postdata.jiangeshijian;
    var jiankongurl = postdata.url;

    // 20261016 带宽优化：轮询优先走增量端点 push_delta.php（无新行响应 ~40B，有新行只回增量），
    // 失败/异常自动回退整量 push*.json（老行为）。since = 本会话已见最大条目 id。
    var __xbSeenMaxId = 0;
    var __xbDeltaMode = true; // 首轮 since=0 时端点会 302 到整量文件，等价老行为
    var __xbName = (jiankongurl.match(/\/plus\/json\/(push[_0-9]*)\.json/) || [])[1] || 'push';

    function __xbFetchJson(url, ok, fail) {
        fetch(url).then(function(res) {
            if (!res.ok) { throw new Error('HTTP ' + res.status); }
            return res.text();
        }).then(function(txt) {
            var j = JSON.parse(txt);
            ok(j);
        }).catch(function(err) { if (fail) { fail(err); } });
    }

    function __xbPollOnce() {
        if (__xbDeltaMode) {
            __xbFetchJson('/plus/json/push_delta.php?name=' + __xbName + '&since=' + (__xbSeenMaxId || 0), function(j) {
                if (j && typeof j.c !== 'undefined' && Array.isArray(j.a)) {
                    // 增量形状：首轮 since=0 时端点直接回整量包（c=N,a=全部），seen 建立后即为真增量
                    handleList(j.a);
                } else if (Array.isArray(j)) {
                    // 302 跟随到了整量文件：本轮按整量处理，seen 已建立，下轮继续 delta
                    handleList(j);
                } else {
                    __xbDeltaMode = false; // 未知形状：彻底回退整量老行为
                }
            }, function() { __xbDeltaMode = false; __xbFetchJson(jiankongurl, function(j) { handleList(j); }, function() {}); });
        } else {
            __xbFetchJson(jiankongurl, function(j) { handleList(j); }, function() {});
        }
    }

    function handleList(res) {
        var resjson = res;
        var zuidaresjson = resjson.length;
        for (j = 0; j < zuidaresjson; j++) {
            if (j == 150) {
                break;
            }
            msgjson = resjson[j]
            if (msgjson && msgjson.id && msgjson.id > __xbSeenMaxId) { __xbSeenMaxId = msgjson.id; }
            msgjson.msg = "获取到json数据";
            postMessage(msgjson);
            continue;
        } //发现新项目结束
        msgjson.msg = "获取json数据结束";
        postMessage(msgjson);
    }

    setInterval(function() {
        jiangeshijian--;
        if (jiangeshijian == 0) {
            __xbPollOnce();
        } else if (jiangeshijian < 0) {
            jiangeshijian = postdata.jiangeshijian;
            msgjson.msg = "设定倒计时";
            msgjson.content = postdata.jiangeshijian;
            postMessage(msgjson);

        } else {
            msgjson.msg = "设定倒计时";
            msgjson.content = jiangeshijian;
            postMessage(msgjson);
        }

    }, 1000);
}, false);
//close(); 这里结束任务进程
