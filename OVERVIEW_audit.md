# 线报酷镜像 · 全量核查与修复概览（2026-07-19）

## 用户反馈（重新部署后）
1. 点击链接仍跳转到源站
2. 「小道」应为「小刀」
3. 赚客吧 / 新赚客吧 一个帖子都没有

## 核查方法
- 解析用户提供的 Actions 日志 `logs_80312726450.zip`（仅含 `mirror-backup` 作业，不含爬虫质量数据）
- 对**已提交 / 已部署的 `xianbao/`** 全量扫描（1158 个 HTML）：
  - 源站绝对/协议相对链接计数（6 个 DOMAIN_POOL 域名）
  - `discover_article_links` 对真实列表页的识别能力（无需联网）
  - 各分类文章详情页文件数
  - 标签「小刀 / 小道」出现次数

## 核查结论
| 项目 | 结论 |
|------|------|
| 小刀标签 | ✅ 已修复（`小道`=0，`小刀`=2），`build_hub` 与 README 均已同步 |
| 文章页跳转源站 | ✅ 3 大分类（xiaodigu/huluxia/xiaodao）详情页**已无跳转源站链接** |
| 赚客吧/新赚客吧 0 帖 | ❌ 根因：zuankeba / xinzuanba **文章详情页从未被爬取（各 0 个文件）**；列表页有链接但点进去 404 |

### 关键发现：残留源站引用的真相
- 整改前全量扫描发现 **94 处**源站引用，全部是**分享二维码组件**：
  `<img src="//x.com/api/qr.php?d=https://news.xianbao.fun/...">` 的 `d=` 参数。
  该 `<img>` 的 netloc 是二维码 API 而非源站，`fix_url` 不会改写其内部的源站地址
  → 这类引用**不会导致点击跳转**（img 不导航），但属于源站痕迹。
- 远程爬虫在核查期间持续运行（检查点从累计1085→1155+），新增页面又带入 **100 处**同类引用。

## 本次修复（已推送 `697e200`）
1. `render.rewrite_html` 增加**全局兜底**：抹除任何残留的源站绝对/协议相对域名
   （`(?:https:)?//(?:new|news)\.(?:xianbao\.fun|ixbk\.(?:net|fun))` → 空，保留本地路径）。
   仅匹配 `ALL_NETLOCS`，外部链接（京东/阿里 CDN）不受影响。幂等可重入。
2. 对**全部已提交 HTML** 执行该改写，使 `xianbao/` 整体源站引用**归零（0 处）**。
3. 新增 2 个回归测试（二维码组件去源站域名、协议相对源站链接改写），`pytest` **45 passed**。
4. 与远程爬虫长跑的 push 冲突经 pull-rebase + 重清洗解决，最终状态 0 残留。

## 待办 / 未决
- **赚客吧 / 新赚客吧 文章详情页仍为空**：增量爬虫当前仍在抓 `xiaodigu`（累计1155），
  尚未轮到 zuankeba/xinzuanba（cursor 均为 1）。已验证修复后的 `discover_article_links`
  **能正确识别 100 条赚客吧、23 条新赚客吧链接**，故爬虫一旦轮到这两类即会自动补全。
- 加速手段（任选）：
  - 在 GitHub Actions → `backup.yml`（已开启 `workflow_dispatch`）手动 **Run workflow** 多次，
    每次约抓 200 页，可较快轮到 zuankeba/xinzuanba；
  - 或调整爬虫为「每轮跨全部分类 round-robin」，使 5 类同步推进（需改动 `render.py` 爬取循环）。

## 验证命令（可复现）
```bash
# 源站引用全量计数
python - <<'PY'
import pathlib, re
ROOT=pathlib.Path("xianbao")
SRC=re.compile(r'(?:https:)?//(?:new|news)\.(?:xianbao\.fun|ixbk\.(?:net|fun))')
print(sum(len(SRC.findall(p.read_text(encoding="utf-8",errors="replace")))
        for p in ROOT.rglob("*.html")))
PY
# 文章详情页计数
for c in zuankeba xinzuanba xiaodigu huluxia xiaodao; do
  echo "$c: $(find xianbao/$c -name '*.html'|wc -l)"; done
```
