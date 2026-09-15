# Phase 0 侦察结果

> 工作产物,不属于站点内容。可加入 `.gitignore`。
> 生成时间:2026-09-13

## 线上 URL 全集

来源:`https://yilingdeng.github.io/sitemap.xml`(jekyll-sitemap 生成)
原始(百分号编码):`old-urls.txt` — 59 条
解码后:`old-urls-decoded.txt`

### 分类统计

| 前缀 | 条数 | 说明 |
|---|---|---|
| `/publication/` | 25 | 出版物条目 |
| `/talks/` | 7 | 6 条 + 1 个列表页 `/talks/` |
| `/teaching/` | 6 | 5 条 + 1 个列表页,但**其中 1 条重复** |
| `/posts/` | 4 | 博客 |
| `/portfolio/` | 2 | 1 条 + 1 个列表页 |
| 其他 | 15 | 见下 |

### 非 ASCII URL:15 条(14 条唯一)

其中**含全角冒号 U+FF1A 的只有 1 条**:

```
/publication/2011-12-01-机非分流：历史城区自行车交通改善的必然选择——以镇江市老城区为例
```

### ⚠️ 重复项(线上确认)

```
2x  /teaching/2017-spring-teaching-1
```

`_teaching/2017-spring-teaching-1.md` 和 `2017-spring-teaching-2.md` 声明了**同一个 permalink**,
jekyll-sitemap 于是输出了两条,线上两页互相覆盖。→ 迁移时必须修,且不能污染别名表。

## `redirect_from` 目标(活链接,但不在 sitemap 里)

`sitemap.xml` 只收录真实页面,重定向目标不会出现。以下地址是活的,必须覆盖:

| 旧地址 | 当前指向 | 迁移后应指向 | 来源 |
|---|---|---|---|
| `/about/` | `/` | `/` | `_pages/about.md:7` |
| `/about.html` | `/` | `/` | `_pages/about.md:8` |
| `/resume` | `/cv/` | `/experience/` | `_pages/cv.md:7` |
| `/nmp/` | `/non-menu-page/` | *(页面已丢弃)* | `_pages/non-menu-page.md:6` |
| `/nmp.html` | `/non-menu-page/` | *(页面已丢弃)* | `_pages/non-menu-page.md:7` |
| `/wordpress/blog-posts/` | `/year-archive/` | `/blog/` | `_pages/year-archive.html:7` |

**方案里漏掉的两条:`/nmp/`、`/nmp.html`、`/wordpress/blog-posts/` 需要补进 nginx 重定向表。**
`/cv/` 本身也要 301 到 `/experience/`(它自己就是真实页面,在 sitemap 里)。

## 需要 301 的顶层 ASCII 地址汇总

```
/about/              →  /
/about.html          →  /
/cv/                 →  /experience/      (sitemap 里的真实页面)
/resume              →  /experience/      (redirect_from)
/year-archive/       →  /blog/            (sitemap 里的真实页面)
/wordpress/blog-posts/ → /blog/
/portfolio/          →  /projects/
/portfolio/portfolio-1/ → /projects/<新 slug>/
/talks/              →  /events/
```

被丢弃且**不需要**重定向的(零外部价值,且从未在导航里):
`/nmp/`、`/nmp.html`、`/non-menu-page/`、`/terms/`、`/sitemap/`、`/talkmap.html`、
`/talkmap/map.html`、`/page-archive/`、`/collection-archive/`、
`/archive-layout-with-content/`、`/categories/`、`/tags/`、`/markdown_generator/`

> 若要更保险,可先查这些地址有没有外链 —— 但它们是模板演示页,预期为零。

## 本地工具链(Phase 0 时点)

| 工具 | 状态 |
|---|---|
| node | v22.17.1 ✓ |
| npm | 11.8.0 ✓ |
| git | 2.47.0.windows.2 ✓ |
| curl | 8.10.1 ✓(支持 `--compressed`) |
| winget | 可用 ✓ |
| **hugo** | **未安装** |
| **go** | **未安装** |
