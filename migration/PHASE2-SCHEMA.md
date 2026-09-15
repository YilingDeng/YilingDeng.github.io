# Phase 2 schema 侦察结果(以脚手架自带样例为准)

> 工作产物。来源:`D:\Website-hugo` 里 `academic-cv` 模板自带的样例文件 ——
> 方案说"答案就在磁盘上",这是那批答案。**文档与模板不一致时以本文件为准。**

---

## 1. 出版物 `content/publications/<slug>/index.md`

`schema: hugoblox/publication/v1`(隐含)

```yaml
title: "..."
authors: [me, ...]          # ← 作者 SLUG,不是显示名!见下方"署名"一节
author_notes: []            # 可选,与 authors 一一对应
date: "2015-09-01T00:00:00Z"     # 带 Z,ISO8601
publishDate: "2017-01-01T00:00:00Z"
publication_types: ["article-journal"]   # CSL 标准类型,必须是 YAML 列表
publication:                     # ← 对象,不是字符串
  name: "Journal of Source Themes"
  short_name: "ICW"              # 可选
  volume: 1
  issue: 1
peer_reviewed: true
open_access: true
license: CC-BY-4.0
abstract: "..."                  # ← 我们源数据的 excerpt 映射到这里
summary: "..."                   # 可选,缩短版摘要
tags: []
featured: false
hugoblox:
  ids:
    doi: 10.5555/123456          # 或 arxiv
links:                           # ← 注意是 type,不是 name!
  - type: pdf
    url: "..."
  - type: code
    url: "..."
image:
  caption: "..."
  focal_point: ""
  preview_only: false
projects: []
slides: ""
```

**`projects:` 里的值是项目 slug**(对应 `content/projects/<slug>/`),不是路径。

## 2. 事件 `content/events/<slug>/index.md`

```yaml
title: "..."
date: "2017-01-01T00:00:00Z"
event_name: "..."            # ← 是 event_name,不是 event
event_url: "https://..."
location: "Online & In-Person"   # 自由文本
address:                     # ← 对象
  street: "..."
  city: "..."
  region: "..."
  postcode: "..."            # 引号!否则 YAML 当数字
  country: "..."
summary: "..."
abstract: |
  多行
event_start: "2030-06-01T13:00:00Z"   # ← 不是 event_start 之外的名字
event_end:   "2030-06-01T15:00:00Z"
event_all_day: false
authors: [me]
tags: []
featured: true
image:
  caption: "..."
  focal_point: Right
links:                       # ← 注意是 icon + name,跟出版物不一样!
  - icon: brands/github
    name: Star on GitHub
    url: "https://..."
slides: "example"            # 引用 content/slides/<slug>/
projects: []
```

> **最容易踩的坑**:出版物的 `links` 用 `type`,`事件的 links` 用 `icon` + `name`。
> 两套 schema 不一样,迁移脚本要分开处理。

## 3. 作者数据 `data/authors/me.yaml`

```yaml
schema: hugoblox/author/v1
slug: me
is_owner: true
name:
  display: "邓一凌"
  given: "一凌"
  family: "邓"
  alternate: "Yiling Deng"    # ← 英文名放这里
  pronunciation: ""
  pronouns: ""
postnominals: [PhD]           # 可选,博士头衔
status:
  icon: ""                    # 可选,emoji
role: "博士，副教授"            # 职称/职位
bio: |                        # 多行简介
  ...
affiliations:                 # ← 雇主放这里(不是单数 employer)
  - name: "浙江工业大学"
    url: "https://www.zjut.edu.cn/"
links:                        # ← icon + url + 可选 label
  - icon: at-symbol
    url: "mailto:coralseu@163.com"
    label: "E-mail Me"
interests: []                 # 研究兴趣,会渲染成标签
education:                    # 教育经历
  - degree: "..."
    institution: "..."
    start: 2015-09-01         # 不加引号也可以
    end: 2019-06-30
    summary: |
      ...
    button:                   # 可选
      text: "..."
      url: "..."
      icon: hero/arrow-down-tray
experience:                   # 工作经历
  - role: "..."
    org: "..."
    start: 2020-01-01
    end: ...                  # 省略 = 至今
    summary: |
      ...
    button: {text, url, icon}
skills:
  - name: "Technical Skills"
    items:
      - {label: Python, level: 5}    # level 是 1-5 整数
languages:
  - {name: English, level: 5, label: Native}
awards:
  - title: "..."
    awarder: "..."
    date: "2022-12-01"
    summary: "..."
    icon: hero/trophy
```

**⚠️ `me.yaml` 里没有 `avatar` 键。** 头像是**约定式**的:
文件名必须匹配 slug → `assets/media/authors/me.png`(模板自带的就是这个)。
我们源仓库的 `images/profile.png` 拷到这里即可。

**⚠️ `me.yaml` 里没有 `projects` / `grants` 键。** CV 的"科研项目"小节没有现成字段,
只能用 `experience`(role/org)近似,或者等 Phase 4 看 `content/experience.md` 怎么渲染再定。

## 4. 站点配置

| 方案里写的 | **实际键名** | 备注 |
|---|---|---|
| `params.yaml` → `hugoblox.branding.name` | **`hugoblox.identity.name`** | ⚠️ 方案写错了。`hugo.yaml` 的 `title:` 留空,注释说"set in branding"是模板自己的过时注释 |
| — | `hugoblox.identity.organization` | 版权署名用 |
| — | `hugoblox.identity.type` | `person` |
| — | `hugoblox.identity.tagline` | 标语 |
| — | `hugoblox.identity.description` | meta description |
| — | `hugoblox.identity.social.twitter` | 模板留了 `GoOwnable`,**必须清掉**(否则转推卡片指向模板作者) |

`hugoblox.layout.avatar_shape: circle` 控制头像形状。

## 5. 导航 `config/_default/menus.yaml`

模板默认(需按我们的结构重写):

```yaml
main:
  - {name: Bio,        url: /,          weight: 10}
  - {name: Papers,     url: /#papers,   weight: 11}
  - {name: Talks,      url: /#talks,    weight: 12}
  - {name: News,       url: /#news,     weight: 13}
  - {name: Experience, url: experience/, weight: 20}
  - {name: Projects,   url: projects/,  weight: 30}
  - {name: Courses,    url: courses/,   weight: 40}
```

**注意模板用的是 `courses/`,方案定的是 `teaching/`。** 保留 `teaching/` 的理由
(零重定向、5 个页面 URL 不变)依然成立,只是要多改一处菜单。另 `experience/` 已存在
(`content/experience.md`),跟方案的 CV 落点一致。

## 6. 语言 `config/_default/languages.yaml`

模板只有 `en:` 一块,`zh:` 整块被注释掉。对应关系:

```yaml
# 现在
en:
  locale: en-us

# 要改成
zh:
  locale: zh-Hans
```

同时在 `hugo.yaml` 设 `defaultContentLanguage: zh`。**`defaultContentLanguageInSubdir`
已经是 `false`,不用动** —— 否则会多出一层 `/zh/` 路径,所有 URL 全变。

---

## 对方案的修正汇总

1. **`hugoblox.branding.name` → `hugoblox.identity.name`**(方案第 4 章配置映射表)
2. **出版物的 `links` 用 `type`,事件用 `icon`+`name`** —— 方案把两者当同一套处理了
3. **`me.yaml` 无 `projects`/`grants` 键** —— 方案假设有,CV 科研项目小节需要另想
4. **头像无 YAML 键,是 `assets/media/authors/<slug>.png` 的文件名约定**
5. **菜单是 `courses/` 不是 `teaching/`** —— 方案定 `teaching/` 要连菜单一起改
6. **`identity.social.twitter` 默认是 `GoOwnable`** —— 必须清掉,否则社交卡片署名模板作者

---

## 步骤 5 实测结果(已验,不再是"尚未验证")

手工转了 3 条真实记录后 `hugo --gc` 构建 + 逐页检查产物 HTML。用的样例:
`2011-12-01-机非分流：…以镇江市老城区为例`(全角冒号 + 破折号 + 中文署名)、
`2012-01-01-talk-1`(单日 talk)、`2015-06-30-blog-post-1`(中文 tag)。

### 1. ✅ 中文显示名写进 `authors:` **能渲染,且顺序保留**

这是方案里那个"唯一的开放决策",现在有答案了:**写完整有序署名名单可行**。

渲染规则(从产物 HTML 反推):

| `authors:` 里的值 | 渲染成 |
|---|---|
| 中文显示名(如 `过秀成`),没有对应 author 数据文件 | 纯文本 `<span>过秀成</span>`,无头像、无链接 |
| `me`(有 `data/authors/me.yaml`) | 头像图 + `name.display`,详情页无链接、列表页包一层 `<a>` |

实测 `authors: [叶茂, 过秀成, me, 殷凤军]` →
列表页渲染 `叶茂, 过秀成, [头像] Dr. Alex Johnson, 殷凤军`(2011),
**顺序与数组完全一致,没有被丢弃、没有被重排**。

> 详情页里 `me` 那一项是 `<img src="/media/authors/me_hu_*.webp" alt="…"> <div>显示名</div>`
> —— 头像和名字都在。当前显示名是模板占位符 `Dr. Alex Johnson`,
> Phase 4 填了 `me.yaml` 就会变成 `邓一凌`。

**所以 Phase 4 的出版署名策略定为**:照抄引用串的原始顺序,
`authors:` 写完整名单,`me` 放在正确位置(如上述那篇在第三位)。
**不要**用"全部写 `[me]`"的偷懒方案 —— 会错置署名顺序。

### 2. ⚠️ 单日 event **必须省略 `event_end`**,否则悬空破折号

`event_end` 跟 `event_start` 写成同一个值 → 渲染成 `1月 1, 2012 —`(破折号后面空的)。

成因在 `_vendor/github.com/HugoBlox/kit/modules/blox/layouts/_partials/functions/get_event_dates.html:11-19`:

```go-html-template
{{ if $end_date }}
  {{ $str = $str | append "&mdash;" }}          {{/* 无条件加破折号 */}}
  {{ if not (同日) }}…结束日期…{{ end }}
  {{ if not $all_day }}…结束时间…{{ end }}       {{/* 同日 && all_day → 什么都不加 */}}
{{ end }}
```

只要 `$end_date` 有值就先加破折号,而"同日 + all_day"两个条件同时成立时后面啥也不输出。

**正确写法**:

```yaml
event_start: '2012-01-01T00:00:00Z'
event_all_day: true      # 必要:否则会把 12:00 AM 渲染出来
# event_end 整行省略
```

实测渲染 `1月 1, 2012`,干净。代价:JSON-LD 的 `Event` 少了 `endDate`,
单日 all-day 事件可以接受。**注意 `date_end` 是 `event_end` 的 fallback,同样会触发这个坑。**

### 3. ✅ CJK 别名桩能生成,且 URL 编码两侧一致(本地侧)

- 别名桩目录在磁盘上是 **raw UTF-8 字节名**:`publication/2011-12-01-机非分流：…——…/`
- 而 Hugo 自己生成的链接是 **percent-encoded**:blog 的中文 tag 渲染成
  `href="/tags/%E6%84%9F%E6%83%B3/"`,磁盘上对应 `tags/感想/`

两边一致 → nginx 解码后的 URI 能匹配到 raw UTF-8 文件名。**方案风险 #5 的本地侧排除**,
服务器侧仍需 Phase 3/5 实测(`curl` 打百分号编码的路径)。

### 4. ⚠️ 作者档案页被模板**故意关闭**,列表页里 `me` 是空链接

`content/authors/_index.md`:

```yaml
build:
  render: never
cascade:
  build:
    render: never
    list: always
```

文件里的注释写着要发布作者档案页就把这几行删掉。后果:产物里**没有 `public/authors/`**,
但列表页仍把匹配到 slug 的作者包进锚点 → `<a href="">Dr. Alex Johnson</a>`,**空 href**。

Phase 4 二选一:
- **保留关闭**(省事):接受 `<a href="">`。视觉上与纯文本无异,只是 SEO/语义上的小瑕疵。
  要彻底干净就得覆写视图模板,不划算。
- **删掉那几行**(推荐):`me` 变成 `<a href="/authors/me/">邓一凌</a>`,顺带得到
  `/authors/me/` 个人档案页。中文合作者没有数据文件,不受影响。

### 5. ✅ `hasCJKLanguage: true` 生效,界面文案已中文化

- 约 2000 字的中文 post → 渲染 `4 分钟阅读时长`(不开的话整句算一个词,数字会离谱)
- 日期渲染成中文格式:`1月 1, 2012`
- "最近更新于"、"日期"、"事件" 等文案走 `zh-Hans` i18n,只需在 `languages.yaml` 改 `locale`

### 6. 配置改动已落地(都是"跟域名无关"的那几项)

`config/_default/hugo.yaml`:`defaultContentLanguage: zh`、`hasCJKLanguage: true`、
`disableAliases: false`、删掉废弃的 `imaging.quality`/`imaging.hint`。
`config/_default/languages.yaml`:`en:` → `zh: {locale: zh-Hans}`(不设 `contentDir`,
单语言站,内容直接放 `content/`)。

构建产物:**98 页 / 24 别名**,`Aliases` 列头出现 `ZH`,无 error。

### 7. ❗ `baseURL` 还是 `https://example.com/`,且它被写进了产物

别名桩的 `<link rel="canonical">`、`meta refresh`、每页 JSON-LD、`sitemap.xml`
全是 `https://example.com/…`。**Phase 3 拿到域名后必须立刻改**,
这期间产物**不能**上传(会把 example.com 发出去)。

---

## 步骤 6 待办(删样例 + 批量脚本)

删:`content/courses/hugo-blox/*`、`content/blog/{data-visualization,get-started,notebook-onboarding,project-management,second-brain,teach-courses}`、
`content/publications/{conference-paper,journal-article,preprint}`、
`content/events/example`、`content/projects/{pandas,pytorch,scikit}`、`content/slides/example`。

批量脚本的映射规则**新增 3 条**(来自步骤 5):
1. 出版署名写完整有序名单,`me` 放引用串里的真实位置
2. 单日 talk:只给 `event_start` + `event_all_day: true`,**不写 `event_end`**
3. `content/authors/_index.md` 的 `build.render` 决策(见上第 4 点)
