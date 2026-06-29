/* ============================================================
   Cinnamon — 索引生成脚本
   递归扫描 notes/ 目录，生成 notes-index.json

   用法：node scripts/build-index.js
   ============================================================ */

const fs   = require('fs')
const path = require('path')

const NOTES_DIR = path.join(__dirname, '..', 'notes')
const OUT_FILE  = path.join(__dirname, '..', 'notes-index.json')

// 忽略的文件/文件夹
const IGNORE = new Set(['.gitkeep', '.DS_Store', 'Thumbs.db', 'desktop.ini'])

/**
 * 递归读取目录，返回树节点
 */
function scanDir (dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })

  // 收集子文件夹和文件
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

  // 配对 PDF / .one：按 basename 分组
  const pdfMap  = new Map() // basename -> pdf 文件名
  const oneMap  = new Map() // basename -> one 文件名
  const baseSet = new Set()

  for (const f of files) {
    const ext  = path.extname(f).toLowerCase()
    const base = path.basename(f, ext)
    baseSet.add(base)
    if (ext === '.pdf') pdfMap.set(base, f)
    if (ext === '.one') oneMap.set(base, f)
  }

  // 生成笔记节点（叶子）
  const notes = []
  for (const base of baseSet) {
    const pdfFile = pdfMap.get(base)
    const oneFile = oneMap.get(base)
    const relDir  = path.relative(NOTES_DIR, dirPath).replace(/\\/g, '/')
    notes.push({
      name: base,
      type: 'note',
      path: relDir,
      pdf:  pdfFile ? 'notes/' + (relDir ? relDir + '/' : '') + pdfFile : null,
      one:  oneFile ? 'notes/' + (relDir ? relDir + '/' : '') + oneFile : null
    })
  }

  // 按名称排序：文件夹在前，笔记在后
  folders.sort((a, b) => a.name.localeCompare(b.name, 'zh'))
  notes.sort((a, b) => a.name.localeCompare(b.name, 'zh'))

  return [...folders, ...notes]
}

// --- 主流程 ---
function main () {
  if (!fs.existsSync(NOTES_DIR)) {
    fs.mkdirSync(NOTES_DIR, { recursive: true })
  }

  const tree = scanDir(NOTES_DIR)

  const output = {
    updated: new Date().toISOString(),
    tree
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2), 'utf-8')
  console.log(`✅ notes-index.json 已生成 — ${tree.length} 个顶层节点`)
}

main()
