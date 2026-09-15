#!/usr/bin/env node
/**
 * D:\Website(Jekyll "Academic Pages") → D:\Website-hugo(Hugo Blox)批量内容迁移
 *
 * 设计原则:
 *  1. 用真的 YAML 解析器(gray-matter + js-yaml),不用正则改文本 ——
 *     源数据里 venue 引号写法不一致(`规划师` vs `'现代城市研究'`)、
 *     标题含全角冒号和破折号、有的 title 没加引号,正则一定会破坏它们。
 *  2. 任何不确定的东西都**报出来**,不静默 fallback。摘要与 excerpt 不一致 = 硬错误。
 *  3. 幂等:每次跑先清空目标集合下的条目目录(保留 `_index*`),再重建。
 *
 * 输出:
 *  - content/{publications,events,teaching,blog,projects}/<slug>/index.md
 *  - MIGRATION-REPORT.md   逐条的转换结果 + 所有告警
 *  - url-map.tsv           旧 URL → 新 URL,供 nginx 层核对
 *
 * 用法:  node migrate.mjs            # 只检查,不写盘
 *        node migrate.mjs --write    # 落盘
 */
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
// js-yaml 5.x 是纯 CJS 具名导出,没有 default —— 必须具名 import
import { dump as yamlDump } from 'js-yaml'
import { pinyin } from 'pinyin-pro'

const SRC = 'D:/Website'
const DST = 'D:/Website-hugo'
const OUT_DIR = 'D:/Website/migration'

/**
 * 转写部分的目标长度(不含 `YYYY-MM-DD-` 前缀)。
 *
 * 截断规则:超过它就往后找**第一个** `-` 并停在那里 —— 也就是宁可多含一个整词,
 * 也不把词切成半个。实测 `机非分流：历史城区自行车交通改善的必然选择——以镇江市老城区为例`
 * 的转写长 117,按此规则得到 61 字符的 `...jiao-tong-gai-shan`,正好是方案里给的那个例子
 * (方案正文写「截断到 60」但例子是 61 字符,自相矛盾;按词边界截才同时满足两者)。
 * 若目标长度之后没有任何 `-`(超长的英文标题可能如此),则整串保留不截。
 */
const SLUG_TARGET = 60

/** 署名段里哪些写法代表站主本人,统一替换成 Hugo Blox 的 `me` 作者 slug。 */
const ME_NAMES = ['邓一凌', 'Yiling Deng']

/**
 * 源数据里已确认的 bug,逐条给出**处置**(而不是让脚本猜)。
 * 每一项都必须有依据,依据写在 note 里。
 */
const ALIAS_OVERRIDE = {
  // 线上 `/teaching/2017-spring-teaching-1` 实际服务的是「对外交通规划」。
  // 两个文件声明了同一个 permalink,-2 覆盖了 -1。
  // 实测:curl 该地址 → <title>对外交通规划</title>。
  // 所以别名归 -2;-1(城市道路设计)在线上从来没被 serve 过,不设别名。
  '_teaching/2017-spring-teaching-2.md': {
    alias: '/teaching/2017-spring-teaching-1',
    note: '线上该 permalink 实际指向本文件(-2 覆盖了 -1)',
  },
  '_teaching/2017-spring-teaching-1.md': {
    alias: null,
    note: 'permalink 与 -2 冲突,线上被覆盖,无对外 URL;不设别名',
  },
  // permalink 里的日期是 2014-09-01,但文件名和 frontmatter date 都是 2015-01-01。
  // 三处里两处一致 → frontmatter date 为准(它才是线上显示的日期),
  // 别名保留线上那个错的 URL。另有一篇真实的 2014-09-01 换乘系统论文,可排除笔误。
  '_publications/2015-01-01-历史文化街区步行性分析方法研究.md': {
    note: 'permalink 日期 2014-09-01 与 frontmatter date 2015-01-01 不符;取 frontmatter date',
  },
  // permalink 是从「步行性评价的研究与规划应用综述」复制来的;title 也比文件名多了「大」字。
  // 以 frontmatter title 为准(文件名不可靠)。
  '_publications/2019-01-01-城市常规公交线网规划体系的反思与构建——以苏州为例.md': {
    note: 'permalink 复制自另一篇;title 比文件名多「大」字;以 title 为准',
  },
  '_publications/2019-06-01-站点位置缺失的公交客流OD估计方法.md': {
    note: 'title 比文件名多「及应用」;以 title 为准',
  },
  // 源文件既没有 date 也没有 permalink。
  // date:正文写明「2015年7月份初赛开始」,以此为准(线上该页不显示日期,只影响排序)。
  // alias:Jekyll 对 collection 条目用默认 permalink `/portfolio/portfolio-1/`,
  //       已核对 old-urls-decoded.txt 里确有这条。
  '_portfolio/portfolio-1.md': {
    date: new Date('2015-07-01T00:00:00Z'),
    alias: '/portfolio/portfolio-1/',
    note: '源文件无 date / permalink;date 取正文载明的 2015-07-01,permalink 取 Jekyll 默认值',
  },
}

const COLLECTIONS = [
  { key: 'publications', src: '_publications', dst: 'content/publications', kind: 'publication' },
  { key: 'events', src: '_talks', dst: 'content/events', kind: 'event' },
  { key: 'teaching', src: '_teaching', dst: 'content/teaching', kind: 'teaching' },
  { key: 'blog', src: '_posts', dst: 'content/blog', kind: 'post' },
  { key: 'projects', src: '_portfolio', dst: 'content/projects', kind: 'project' },
]

const errors = []
const warnings = []
const infos = []
const rows = []     // 报告行
const urlMap = []   // { old, new, src }

// ───────────────────────────── 工具 ─────────────────────────────

function isoZ(d) {
  const dt = d instanceof Date ? d : new Date(String(d))
  if (Number.isNaN(dt.getTime())) throw new Error(`无法解析的日期: ${String(d)}`)
  return dt.toISOString().replace(/\.\d{3}Z$/, 'Z')
}
function ymd(d) {
  const dt = d instanceof Date ? d : new Date(String(d))
  if (Number.isNaN(dt.getTime())) throw new Error(`无法解析的日期: ${String(d)}`)
  return dt.toISOString().slice(0, 10)
}

/**
 * title → 拼音转写 → ASCII slug。
 * 必须用 nonZh:'consecutive' —— 否则 pinyin-pro 会把英文逐字母拆开
 * (`Quantifying` → `Q u a n t i f y i n g`)。
 * 截断取「索引 <= SLUG_MAX 的最后一个 `-`」,保证不切碎一个词。
 */
function slugify(title, dateStr) {
  let py = pinyin(title, { toneType: 'none', type: 'string', nonZh: 'consecutive' })
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!py) throw new Error(`title 转写后为空: ${title}`)
  if (py.length > SLUG_TARGET) {
    const at = py.indexOf('-', SLUG_TARGET)   // 目标长度之后的第一个词边界
    if (at > 0) py = py.slice(0, at)
  }
  return `${dateStr}-${py}`
}

/** 把引用的署名段切成有序名单,并把站主本人换成 `me`。 */
function parseAuthors(citation) {
  // 署名段 = 第一个「句点 + 空白」之前的内容(中英文引用串格式一致)
  const m = citation.match(/^([^.]+?)\.\s/)
  if (!m) return { ok: false, why: '找不到「署名段. 」的分隔' }
  const names = m[1].split(/[,，]\s*/).map((s) => s.trim()).filter(Boolean)
  if (!names.length) return { ok: false, why: '署名段切不出名字' }
  if (names.length > 12) return { ok: false, why: `名字过多(${names.length}),疑似解析错` }
  for (const n of names) {
    if (n.length > 24) return { ok: false, why: `名字过长(${n.length} 字符): ${n}` }
    if (/[0-9]/.test(n)) return { ok: false, why: `名字里含数字: ${n}` }
  }
  let hit = 0
  const mapped = names.map((n) => {
    if (ME_NAMES.includes(n)) { hit++; return 'me' }
    return n
  })
  if (hit === 0) return { ok: false, why: '署名段里没找到站主本人', names }
  if (hit > 1) return { ok: false, why: `站主本人出现 ${hit} 次`, names }
  return { ok: true, names: mapped }
}

/** 拆正文:抽出 `引用：` 与 `摘要：` 两行,其余保留。 */
function splitBody(body, rel) {
  const lines = body.split(/\r?\n/)
  const absRe = /^摘要\s*[：:]\s*/
  const citeRe = /^引用\s*[：:]\s*/
  const absIdx = lines.findIndex((l) => absRe.test(l))
  const citeIdx = lines.findIndex((l) => citeRe.test(l))
  const rest = lines.filter((_, i) => i !== absIdx && i !== citeIdx).join('\n').trim()
  return {
    abstract: absIdx >= 0 ? lines[absIdx].replace(absRe, '').trim() : null,
    citation: citeIdx >= 0 ? lines[citeIdx].replace(citeRe, '').trim() : null,
    rest,
  }
}

/** "Washington D.C., US" / "东莞, 中国" → { city, country } */
function splitLocation(loc) {
  const s = String(loc || '').trim()
  const i = Math.max(s.lastIndexOf(','), s.lastIndexOf('，'))
  if (i < 0) return { city: s, country: '' }
  return { city: s.slice(0, i).trim(), country: s.slice(i + 1).trim() }
}

function stripHtml(s) {
  return String(s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

function dump(data, body) {
  // aliases 里可能有 null(源文件本来就该页无对外 URL 的情况)。
  // 直接交给 js-yaml 会写出 `aliases: [null]`,Hugo 会认真地去生成一个叫 "null" 的别名桩。
  // 整条去掉,不留空列表。
  const clean = { ...data }
  if ('aliases' in clean) {
    const a = (Array.isArray(clean.aliases) ? clean.aliases : [clean.aliases]).filter(Boolean)
    if (a.length) clean.aliases = a
    else delete clean.aliases
  }
  const fm = yamlDump(clean, { lineWidth: -1, noRefs: true, sortKeys: false })
  return `---\n${fm}---\n\n${body.trim()}\n`
}

// ─────────────────────── 每种集合的 frontmatter 构造 ───────────────────────

function buildPublication({ data, rel, body }) {
  const date = data.date
  const parts = splitBody(body, rel)
  if (!data.title) errors.push(`${rel}: 缺 title`)
  if (!data.venue) warnings.push(`${rel}: 缺 venue`)
  if (!parts.citation) errors.push(`${rel}: 正文里找不到「引用：」行 —— 署名和文献信息都在那行,丢了无法恢复`)
  // 两处「摘要」要一致。实测有 3 篇只差空白(Word/PDF 粘贴残留的半角空格,
  // 如「2011 年」vs「2011年」),这种不算信息损失 —— 取 excerpt(干净的那份)。
  // 去空白后仍不同才是真丢失,硬报错。
  const noWs = (s) => String(s).replace(/\s+/g, '')
  if (!parts.abstract) warnings.push(`${rel}: 正文里没有「摘要：」段落`)
  if (parts.abstract && data.excerpt) {
    const bodyAbs = parts.abstract
    const excAbs = String(data.excerpt).trim()
    if (noWs(bodyAbs) !== noWs(excAbs)) {
      errors.push(`${rel}: 正文「摘要」与 frontmatter excerpt 不一致(去空白后仍不同)\n    正文: ${bodyAbs.slice(0, 60)}…\n    摘要: ${excAbs.slice(0, 60)}…`)
    } else if (bodyAbs !== excAbs) {
      infos.push(`${rel}: 正文「摘要」与 excerpt 仅空白差异(正文 ${bodyAbs.length} 字 / excerpt ${excAbs.length} 字),已取 excerpt`)
    }
  }

  const au = parseAuthors(parts.citation || '')
  if (!au.ok) {
    errors.push(`${rel}: 署名解析失败(${au.why})→ 该篇 authors 会退化成 [me],需人工看`)
  }

  const authors = au.ok ? au.names : ['me']
  if (au.ok && au.names.length > 1) {
    rows.push(`  - 署名: ${au.names.join(' / ')}`)
  }

  return {
    frontmatter: {
      title: data.title,
      authors,
      date: isoZ(date),
      publication_types: ['article-journal'],
      publication: { name: data.venue },
      abstract: String(data.excerpt || '').trim(),
      featured: false,
      projects: [],
      slides: '',
      aliases: [aliasOf(rel, data)],
    },
    body: `## 引用\n\n${parts.citation || ''}`,
    slugTitle: data.title,
    date,
  }
}

function buildEvent({ data, rel, body }) {
  const date = data.date
  const parts = splitBody(body, rel)
  if (!data.title) errors.push(`${rel}: 缺 title`)
  if (!data.venue) errors.push(`${rel}: 缺 venue(→ event_name)`)
  const loc = splitLocation(data.location)

  // ⚠️ 单日事件**不能**写 event_end:模板 get_event_dates.html:11-19 只要 $end_date
  //    有值就无条件加 "&mdash;",而「同日 && all_day」时破折号后面什么都不输出
  //    → 渲染成悬空破折号。step 5 实测确认。
  const out = []
  if (parts.abstract) out.push(`## 摘要\n\n${parts.abstract}`)
  if (parts.citation) out.push(`## 引用\n\n${parts.citation}`)

  return {
    frontmatter: {
      title: data.title,
      event_name: data.venue,
      date: isoZ(date),
      location: String(data.location || '').trim(),
      address: { city: loc.city, country: loc.country },
      event_start: isoZ(date),
      event_all_day: true,
      authors: ['me'],
      featured: false,
      projects: [],
      slides: '',
      aliases: [aliasOf(rel, data)],
    },
    body: out.length ? out.join('\n\n') : (parts.rest || ''),
    slugTitle: data.title,
    date,
  }
}

function buildTeaching({ data, rel, body }) {
  const parts = splitBody(body, rel)
  return {
    frontmatter: {
      title: data.title,
      date: isoZ(data.date),
      // 源数据的 type 是课程性质(本科生专业课/研究生专业课/公共选修课),
      // Hugo Blox 没有对应字段,放进 tags 保留信息。
      tags: data.type ? [data.type] : [],
      featured: false,
      aliases: [aliasOf(rel, data)],
    },
    body: parts.rest || '(无正文)',
    slugTitle: data.title,
    date: data.date,
  }
}

function buildPost({ data, rel, body }) {
  const parts = splitBody(body, rel)
  return {
    frontmatter: {
      title: data.title,
      date: isoZ(data.date),
      authors: ['me'],
      tags: Array.isArray(data.tags) ? data.tags : [],
      aliases: [aliasOf(rel, data)],
    },
    body: parts.rest || '',
    slugTitle: data.title,
    date: data.date,
  }
}

function buildProject({ data, rel, body }) {
  const ov = ALIAS_OVERRIDE[rel] || {}
  const date = ov.date || data.date
  const parts = splitBody(body, rel)
  const body2 = (parts.rest || '').replace(/\]\(\/images\//g, '](/images/')
  return {
    frontmatter: {
      title: data.title,
      date: isoZ(date),
      // excerpt 里原本有 <img src='/images/500x300.png'>(模板演示占位图),去掉
      summary: stripHtml(data.excerpt),
      links: [
        { type: 'site', url: 'https://yiling.shinyapps.io/TransitAnalyst/' },
      ],
      featured: false,
      aliases: [aliasOf(rel, data)],
    },
    body: body2,
    slugTitle: data.title,
    date,
  }
}

const BUILDERS = {
  publication: buildPublication,
  event: buildEvent,
  teaching: buildTeaching,
  post: buildPost,
  project: buildProject,
}

function aliasOf(rel, data) {
  const ov = ALIAS_OVERRIDE[rel]
  if (ov && 'alias' in ov) return ov.alias
  const p = data.permalink != null ? String(data.permalink) : null
  if (!p) return null
  return p.startsWith('/') ? p : `/${p}`
}

// ───────────────────────────── 主流程 ─────────────────────────────

const WRITE = process.argv.includes('--write')
const seenOld = new Map()
const seenNew = new Map()

for (const col of COLLECTIONS) {
  const srcDir = path.join(SRC, col.src)
  const files = fs.readdirSync(srcDir).filter((f) => f.endsWith('.md')).sort()
  rows.push(`\n## ${col.src} → ${col.dst}  (${files.length} 个源文件)`)

  for (const f of files) {
    const rel = `${col.src}/${f}`
    const raw = fs.readFileSync(path.join(srcDir, f), 'utf8')
    const parsed = matter(raw)
    const data = parsed.data
    const built = BUILDERS[col.kind]({ data, rel, body: parsed.content })
    const ov = ALIAS_OVERRIDE[rel]

    const dateStr = ymd(built.date)
    const slug = slugify(built.slugTitle, dateStr)
    const target = path.join(DST, col.dst, slug)
    const newUrl = `/${col.dst.replace(/^content\//, '')}/${slug}/`

    // 别名唯一性
    const old = built.frontmatter.aliases[0]
    if (old) {
      if (seenOld.has(old)) {
        errors.push(`旧 URL 冲突: ${old}\n    ${seenOld.get(old)} 与 ${rel} 都声明了它`)
      } else {
        seenOld.set(old, rel)
      }
      urlMap.push({ old, new: newUrl, src: rel })
    }
    // 新路径唯一性
    if (seenNew.has(target)) {
      errors.push(`新 slug 冲突: ${target}\n    ${seenNew.get(target)} 与 ${rel} 撞了`)
    } else {
      seenNew.set(target, rel)
    }

    rows.push(`- \`${rel}\``)
    rows.push(`  - → \`${col.dst}/${slug}/\``)
    if (old) rows.push(`  - 别名 ← \`${old}\``)
    if (ov?.note) rows.push(`  - ⚠️ 源数据修正: ${ov.note}`)

    if (WRITE) {
      fs.mkdirSync(target, { recursive: true })
      fs.writeFileSync(path.join(target, 'index.md'), dump(built.frontmatter, built.body), 'utf8')
    }
  }
}

// ── 反向校验:线上 URL 全集里每个「条目页」都必须有别名,否则迁移后 404 ──
// old-urls-decoded.txt 来自线上 sitemap.xml,是**权威的线上 URL 清单**。
// 这一条能抓出 frontmatter permalink 写错的情况 —— 只校验正向(每个源文件都生成别名)
// 是不够的,得反过来问「线上每个 URL 都有人认领吗」。
{
  const liveFile = path.join(OUT_DIR, 'old-urls-decoded.txt')
  if (!fs.existsSync(liveFile)) {
    errors.push(`找不到线上 URL 清单 ${liveFile} —— 无法校验别名覆盖,不能只信正向检查`)
  } else {
    const norm = (u) => u.replace(/\/+$/, '')
    const isItem = /^\/(publication|talks|teaching|posts|portfolio)\/.+/
    const live = fs.readFileSync(liveFile, 'utf8').split(/\r?\n/)
      .map((s) => s.trim()).filter(Boolean)
      .map(norm).filter((u) => isItem.test(u))
    const liveSet = new Set(live)
    const aliasSet = new Set([...seenOld.keys()].map(norm))

    for (const u of [...liveSet].sort()) {
      if (!aliasSet.has(u)) errors.push(`线上 URL 无人认领,迁移后会 404: ${u}`)
    }
    for (const u of [...aliasSet].sort()) {
      if (!liveSet.has(u)) infos.push(`别名指向线上不存在的 URL(通常无害): ${u}`)
    }
    infos.push(`别名覆盖校验:线上条目 URL ${liveSet.size} 条,已全部覆盖 ${liveSet.size - [...liveSet].filter((u) => !aliasSet.has(u)).length}/${liveSet.size}`)
  }
}

// 目标集合里残留的旧条目(比如 step 5 手工建的探针目录)在 --write 时清掉
if (WRITE) {
  for (const col of COLLECTIONS) {
    const dir = path.join(DST, col.dst)
    if (!fs.existsSync(dir)) continue
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith('_')) continue
      if (!e.isDirectory()) continue
      const p = path.join(dir, e.name)
      if (![...seenNew.keys()].includes(p)) {
        fs.rmSync(p, { recursive: true, force: true })
        warnings.push(`清理残留目录: ${col.dst}/${e.name}`)
      }
    }
  }
}

// ───────────────────────────── 报告 ─────────────────────────────

const report = [
  '# 批量迁移报告',
  '',
  `模式: **${WRITE ? '已落盘' : '仅检查(未写盘)'}**`,
  '',
  `## 硬错误 (${errors.length})`,
  '',
  errors.length ? errors.map((e) => `- ❌ ${e}`).join('\n') : '_无_',
  '',
  `## 告警 (${warnings.length})`,
  '',
  warnings.length ? warnings.map((w) => `- ⚠️ ${w}`).join('\n') : '_无_',
  '',
  `## 信息 (${infos.length})`,
  '',
  infos.length ? infos.map((i) => `- ℹ️ ${i}`).join('\n') : '_无_',
  '',
  '## 逐条对照',
  '',
  rows.join('\n'),
  '',
  `## 旧 URL → 新 URL (${urlMap.length} 条)`,
  '',
  '```',
  ...urlMap.map((r) => `${r.old}\t${r.new}`),
  '```',
  '',
].join('\n')

fs.writeFileSync(path.join(OUT_DIR, 'MIGRATION-REPORT.md'), report, 'utf8')
fs.writeFileSync(
  path.join(OUT_DIR, 'url-map.tsv'),
  urlMap.map((r) => `${r.old}\t${r.new}\t${r.src}`).join('\n') + '\n',
  'utf8'
)

console.log(`源文件: ${seenNew.size} 条`)
console.log(`旧 URL 别名: ${urlMap.length} 条`)
console.log(`硬错误: ${errors.length}   告警: ${warnings.length}   信息: ${infos.length}`)
if (errors.length) {
  console.log('\n--- 硬错误 ---')
  for (const e of errors) console.log('❌ ' + e)
}
if (warnings.length) {
  console.log('\n--- 告警 ---')
  for (const w of warnings) console.log('⚠️  ' + w)
}
console.log(`\n报告: ${OUT_DIR}/MIGRATION-REPORT.md`)
process.exit(errors.length ? 1 : 0)
