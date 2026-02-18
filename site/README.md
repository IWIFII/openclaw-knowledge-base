# 成员展示网站

这是创新π协会成员名单的静态展示页。

## 本地预览

在仓库根目录执行：

```bash
cd /root/.openclaw/workspace/assistant-kit-sanitized/site
python3 -m http.server 8080
```

然后打开 `http://127.0.0.1:8080`。

## 文件

- `index.html`：网站主页面

## 数据更新

当前成员数据内嵌在 `index.html` 的 `members` 数组中。
后续新增成员时，请同步更新该数组和 `knowledge-base/innovation-pi-members/members.csv`。
