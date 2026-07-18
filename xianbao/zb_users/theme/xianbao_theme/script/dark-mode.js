/*<script>
    // 读取cookie
    function getCookie(name) {
        var prefix = name + "=";
        var cookieStartIndex = document.cookie.indexOf(prefix);
        if (cookieStartIndex == -1) {
            return null;
        }
        var cookieEndIndex = document.cookie.indexOf(";", cookieStartIndex + prefix.length);
        if (cookieEndIndex == -1) {
            cookieEndIndex = document.cookie.length;
        }
        return decodeURIComponent(document.cookie.substring(cookieStartIndex + prefix.length, cookieEndIndex));
    }
    
    // 如果cookie中night为1，设置黑色背景
    if (getCookie("night") === "1") {
        document.documentElement.className += " night";
    }
</script>*/

//夜间模式
$(document).ready(function() {

    if (zbp.cookie.get("night") !== null) {
        var night = zbp.cookie.get("night");
    } else {
        var night = '0';
    }
    if (night == '1') {
        if (isWebapp()) {
            window.webapp.night(true);
            window.webapp.color();
        } else {
            document.body.classList.add('night');
        }
    }

});


//夜间模式切换

function switchNightMode() {
    if (zbp.cookie.get("night") !== null) {
        var night = zbp.cookie.get("night");
    } else {
        var night = "0";
    }
    
    if (night == "0") {
        /*alert("夜间模式开启");*/
        if (isWebapp()) {
            window.webapp.night(true);
            window.webapp.color();
        } else {
            document.body.classList.add("night");
        }
        zbp.cookie.set("night", "1", 7);

    } else {
        /*alert("夜间模式关闭");*/
        if (isWebapp()) {
            window.webapp.night(false);
            window.webapp.color();
        } else {
        document.body.classList.remove("night");
        }
        zbp.cookie.set("night", "0", 7);

    }

}