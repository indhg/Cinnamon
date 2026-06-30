/* ============================================================
   Cinnamon — 索引生成脚本
   递归扫描 notes/ 目录，生成 notes-index.json

   配对规则：
   - 同名 PDF + .one → 一份笔记（预览+下载都有）
   - 仅 .one → 主笔记，同目录下未配对的 PDF 自动挂为子笔记
   - 仅 PDF → 独立笔记

   用法：node scripts/build-index.js
   ============================================================ */

const fs   = require('fs')
const path = require('path')

const NOTES_DIR = path.join(__dirname, '..', 'notes')
const OUT_FILE  = path.join(__dirname, '..', 'notes-index.json')

const IGNORE = new Set(['.gitkeep', '.DS_Store', 'Thumbs.db', 'desktop.ini'])

function scanDir (dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })

  const folders = []
  const files   = []

  for (const e of entries) {
    if (IGNORE.has(e.name) || e.name.startsWith('.')) continue
    if (e.isDirectory()) {
      const children = scanDir(path.join(dirPath, e.name))
      folders.push({
        name: e.name,
        type: 'folder',
        path: path.relative(NOTES_DIR, path.join(dirPath, e.name)).replace(/\\/g, '/'),
        children
      })
    } else if (e.isFile()) {
      files.push(e.name)
    }
  }

  // --- 配对 PDF / .one / .pptx ---
  const pdfMap  = new Map()   // basename -> filename
  const oneMap  = new Map()
  const pptxMap = new Map()

  for (const f of files) {
    const ext  = path.extname(f).toLowerCase()
    const base = path.basename(f, ext)
    if (ext === '.pdf')  pdfMap.set(base, f)
    if (ext === '.one')  oneMap.set(base, f)
    if (ext === '.pptx') pptxMap.set(base, f)
  }

  const relDir = path.relative(NOTES_DIR, dirPath).replace(/\\/g, '/')
  const prefix = relDir ? 'notes/' + relDir + '/' : 'notes/'

  // 首先生成所有笔记节点
  const allBases = new Set([...pdfMap.keys(), ...oneMap.keys()])
  const notes = []

  for (const base of allBases) {
    notes.push({
      name: base,
      type: 'note',
      path: relDir,
      pdf:  pdfMap.has(base)  ? prefix + pdfMap.get(base)  : null,
      one:  oneMap.has(base)  ? prefix + oneMap.get(base)  : null,
      pptx: pptxMap.has(base) ? prefix + pptxMap.get(base) : null
    })
  }

  // --- 后处理：把未配对的 PDF 挂到 .one 主笔记下 ---
  // 找出作为主笔记的 .one（有 one 但没有同名 pdf，或者有 one 且同目录下存在孤儿 pdf）
  const orphans = notes.filter(n => n.one && !n.pdf)  // .one 主笔记候选
  const stray   = notes.filter(n => n.pdf && !n.one)  // 未配对的 PDF

  // 如果只有一个 .one 主笔记，把所有孤儿 PDF 挂到它下面
  if (orphans.length === 1 && stray.length > 0) {
    const parent = orphans[0]
    parent.children = stray.map(s => ({
      name: s.name,
      type: 'note',
      path: s.path,
      pdf:  s.pdf,
      one:  null,
      pptx: s.pptx || null
    }))
    // 从平级列表中移除孤儿 PDF（它们现在是子节点）
    for (const s of stray) {
      const idx = notes.indexOf(s)
      if (idx >= 0) notes.splice(idx, 1)
    }
  } else if (orphans.length > 1 && stray.length > 0) {
    // 多个 .one：按名字前缀模糊匹配
    for (const o of orphans) {
      o.children = []
    }
    for (const s of stray) {
      // 尝试找名字最相似的 .one
      let best = null, bestScore = 0
      for (const o of orphans) {
        const score = overlapLen(s.name, o.name)
        if (score > bestScore) { bestScore = score; best = o }
      }
      if (best && bestScore > 0) {
        best.children.push({ name: s.name, type: 'note', path: s.path, pdf: s.pdf, one: null, pptx: s.pptx || null })
      }
    }
    // 移除已被挂载的孤儿
    const attached = new Set()
    for (const o of orphans) {
      for (const c of (o.children || [])) attached.add(c.name)
    }
    for (let i = notes.length - 1; i >= 0; i--) {
      if (stray.includes(notes[i]) && attached.has(notes[i].name)) {
        notes.splice(i, 1)
      }
    }
    // 清理空的 children
    for (const o of orphans) {
      if (!o.children || o.children.length === 0) delete o.children
    }
  }

  // --- 读取本目录的 index.json（可选排序配置）---
  let orderList = []
  const indexFile = path.join(dirPath, 'index.json')
  if (fs.existsSync(indexFile)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(indexFile, 'utf-8'))
      if (Array.isArray(cfg.order)) orderList = cfg.order
    } catch (_) { /* 忽略解析错误 */ }
  }

  // 排序：orderList 中的按指定顺序排前面，其余按拼音
  function sortByOrder (arr) {
    const rank = new Map(orderList.map((name, i) => [name, i]))
    arr.sort((a, b) => {
      const ra = rank.has(a.name) ? rank.get(a.name) : 9999
      const rb = rank.has(b.name) ? rank.get(b.name) : 9999
      if (ra !== rb) return ra - rb
      return a.name.localeCompare(b.name, 'zh')
    })
  }

  sortByOrder(folders)
  sortByOrder(notes)

  // 对每个笔记的子节点也应用排序

  // 对每个笔记的子节点也应用排序
  for (const n of notes) {
    if (n.children) sortByOrder(n.children)
  }

  return [...folders, ...notes]
}

// 计算两个字符串的公共前缀长度（字符级别，忽略扩展名差异）
function overlapLen (a, b) {
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  return i
}

function main () {
  if (!fs.existsSync(NOTES_DIR)) {
    fs.mkdirSync(NOTES_DIR, { recursive: true })
  }
  const tree = scanDir(NOTES_DIR)
  const output = { updated: new Date().toISOString(), tree }
  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2), 'utf-8')
  console.log(`✅ notes-index.json 已生成 — ${tree.length} 个顶层节点`)
}

main()
