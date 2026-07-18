addEventListener('message', function(e) {
    var msgjson = {};
    var postdata = e.data;
    var jiangeshijian = postdata.jiangeshijian;
    var jiankongurl = postdata.url;

    setInterval(function() {
        jiangeshijian--;
        if (jiangeshijian == 0) {
           // fetch("/plus/json/push.txt?v=20230406") // 返回一个Promise对象
            fetch(jiankongurl)
            .then((res) => {
                return res.text() // res.text()是一个Promise对象
            })
            .then((res) => {
                // res是最终的结果
        
                var resjson = JSON.parse(res); //请求的json
                var zuidaresjson = resjson.length;
                //cache = resjson[zuidaresjson - 1].url;
                for (j = 0; j < zuidaresjson; j++) {
                    if (j==150) {
                    break;
                    }
                    msgjson = resjson[j]
                    msgjson.msg = "获取到json数据";
                    postMessage(msgjson);
                    continue;
                } //发现新项目结束
                msgjson.msg = "获取json数据结束";
                postMessage(msgjson);


            })
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