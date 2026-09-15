// 一次性探针:看看 static/uploads/resume.pdf 到底是模板演示简历还是作者本人的。
// 用法: node pdfprobe.mjs <pdf 路径>
import fs from 'node:fs'
import zlib from 'node:zlib'

const p = process.argv[2]
const s = fs.readFileSync(p).toString('latin1')

// 1) Info 字典 / XMP 里通常是明文
const meta = s.match(/\/(Author|Creator|Producer|Title|Subject|CreationDate|ModDate)\s*(\([^)]*\)|<[^>]*>)/g)
console.log('--- 元数据 ---')
console.log(meta ? meta.join('\n') : '(无明文元数据)')

// 2) 解压内容流,把 PDF 字符串操作数掏出来(近似 pdftotext)
const RE_STR = /\(((?:[^\\()]|\\.)*)\)/g
console.log('\n--- 解压出的可见文本 ---')
let printed = 0
for (const m of s.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
  let t
  try {
    t = zlib.inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1')
  } catch {
    continue
  }
  const txt = [...t.matchAll(RE_STR)].map((x) => x[1]).join(' ')
  if (txt.replace(/[^a-zA-Z一-鿿]/g, '').length < 20) continue
  console.log(txt.slice(0, 1200))
  if (++printed >= 3) break
}
if (!printed) console.log('(没有可解压的文本流)')

// 3) 页数
const pages = (s.match(/\/Type\s*\/Page[^s]/g) || []).length
console.log('\n--- 页数 ---')
console.log(pages)
