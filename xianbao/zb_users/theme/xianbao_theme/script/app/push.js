/*! app/push.js | 实时线报推送辅助 | 依赖: jQuery, layer */
function tuisongswitch(){if(typeof(Worker)=="undefined"){layer.msg("当前浏览器不支持Worker：请更换/升级浏览器或者使用扩展插件，解决方案打开用户中心--推送设置--疑难解答");return}if(window.shuaswitch!="on"&&window.shenhe!="off"){layer.msg("用户中心未开启实时线报请求开关！");return}if(window.tuisongkaiguan!="on"){window.tuisongkaiguan="on";document.title="【监控推送中】"+document.title;layer.msg("线报推送开启成功");$(".tuisongswitch").text("监控推送中")}}

function htmlToMarkdown(shuju) {
  let html = shuju.content_html?shuju.content_html:'';

  // 1. 替换标题
  html = html.replace(/<h([1-6])>(.*?)<\/h\1>/gi, function(match, level, content){
    return '#'.repeat(level) + ' ' + content + '\\n\\n';
  });

  // 2. 替换链接
  html = html.replace(/<a\s+href="(.*?)".*?>(.*?)<\/a>/gi, '[$2]($1)');

  // 3. 替换图片（并在图片前后加换行）
  html = html.replace(/<img[^>]+src="([^"]+)"[^>]*alt="([^"]*)"[^>]*>/gi, '\\n\\n![$2]($1)\\n\\n');
  html = html.replace(/<img[^>]+src="([^"]+)"[^>]*>/gi, '\n\n![]($1)\\n\\n');

  // 4. 处理换行（<br> 替换为 \n\n）
  html = html.replace(/<br\s*\/?>/gi, '\\n\\n');

  // 5. 替换 <p> 为两个换行（Markdown 段落）
  html = html.replace(/<p[^>]*>/gi, '\\n\\n');
  html = html.replace(/<\/p>/gi, '\\n\\n');

  // 6. 移除其他 HTML 标签但保留内容
  html = html.replace(/<[^>]+>/g, '');

  // 7. 整理多余的空行（3个以上换行 → 2个换行）
  html = html.replace(/\n{3,}/g, '\\n\\n');

  // 8. 添加原文链接（前后加空行）
  html = `${html}\\n\\n原文链接：[${shuju.url}](${shuju.url})`;

  return html.trim();
}

function tuisong_replace(text, shuju) {
    if(shuju.category_name){
    shuju.catename = shuju.category_name;
    }
    if (shuju.posttime) {
        let posttime = new Date(shuju.posttime * 1000);
        shuju.datetime = `${posttime.getFullYear()}-${add0(posttime.getMonth() + 1)}-${add0(posttime.getDate())}`;
        shuju.shorttime = `${posttime.getHours()}:${add0(posttime.getMinutes())}`;
    }
    
    content_html=`${shuju.content_html}<br>&nbsp;<br>&nbsp;<br>原文链接：<a href="${shuju.url}" target="_blank">${shuju.url}</a><br>&nbsp;<br>&nbsp;<br>&`;
    content_html=content_html.split('"').join('\\"');
    
    const replacements = {
        '{标题}': shuju.title,
        '{正文}': shuju.content,
        '{内容}': shuju.content,
        '{Html内容}': content_html,
        '{Markdown内容}': htmlToMarkdown(shuju),
        '{分类名}': shuju.catename,
        '{分类ID}': shuju.cateid,
        '{链接}': shuju.url,
        '{日期}': shuju.datetime,
        '{时间}': shuju.shorttime,
        '{楼主}': shuju.louzhu,
        '{类目}': shuju.category_name,
        '{价格}': shuju.price,
        '{商城}': shuju.mall_name,
        '{品牌}': shuju.brand,
        '{图片}': shuju.pic
    };
    
    for (const [key, value] of Object.entries(replacements)) {
        if (value !== undefined) {
            text = text.replace(new RegExp(key, 'g'), value);
        } else {
            text = text.replace(new RegExp(key, 'g'), '');
        }
    }

    return text;
}

function tuisong_tihuan(text,config){if(config.includes("###")){var configarr=config.split("<br>");for(var j=0;j<configarr.length;j++){var xiaoconfigarr=configarr[j].split("###");var regex=new RegExp(xiaoconfigarr[0],"g");text=text.replace(regex,xiaoconfigarr[1])}}return text}
