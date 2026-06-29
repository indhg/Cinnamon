/* ============================================================
   Cinnamon — 笔记浏览前端逻辑
   ============================================================ */

;(function () {
  'use strict'

  // --- DOM 引用 ---
  const treeEl   = document.getElementById('tree')
  const searchEl = document.getElementById('searchInput')
  const sidebar  = document.getElementById('sidebar')
  const overlay  = document.getElementById('overlay')
  const menuBtn  = document.getElementById('menuBtn')
  const pdfViewer  = document.getElementById('pdfViewer')
  const noteTitle  = document.getElementById('noteTitle')
  const btnDownload = document.getElementById('btnDownload')

  // --- 状态 ---
  let noteTree   = []        // 完整的笔记树
  let aliases    = {}        // subjects.json: { 文件夹名: [别名1, 别名2] }
  let activePath = null      // 当前选中笔记的 PDF 路径
  let expandedPaths = new Set() // 已展开的文件夹路径

  // --- 加载数据 ---
  async function loadData () {
    try {
      const [idxRes, subRes] = await Promise.all([
        fetch('notes-index.json?v=' + Date.now()),
        fetch('subjects.json?v=' + Date.now())
      ])
      if (!idxRes.ok) throw new Error('notes-index.json 加载失败')
      const idx = await idxRes.json()
      noteTree = idx.tree || []

      if (subRes.ok) {
        const sub = await subRes.json()
        aliases = sub.subjects || sub || {}
      }
    } catch (err) {
      console.warn('数据加载失败:', err.message)
      noteTree = []
      aliases = {}
    }
    renderTree()
  }

  // --- 搜索匹配 ---
  function matchesSearch (name, query) {
    if (!query) return true
    const q = query.toLowerCase().trim()
    if (!q) return true

    // 直接匹配文件名/文件夹名
    if (name.toLowerCase().includes(q)) return true

    // 匹配别名
    const aliasList = aliases[name] || []
    return aliasList.some(a => a.toLowerCase().includes(q))
  }

  // 检查节点或其子节点中是否有匹配搜索的
  function nodeHasMatch (node, query) {
    if (!query) return true
    // 自身匹配
    if (matchesSearch(node.name, query)) return true
    // 递归检查子节点
    if (node.children) {
      return node.children.some(c => nodeHasMatch(c, query))
    }
    return false
  }

  // --- 渲染树 ---
  function renderTree (query) {
    query = (query || searchEl.value || '').trim()
    treeEl.innerHTML = ''

    if (!noteTree.length) {
      treeEl.innerHTML = '<div class="tree-empty">暂无笔记<br><small>在 notes/ 目录下添加笔记后自动出现</small></div>'
      return
    }

    let hasVisible = false
    noteTree.forEach(node => {
      const el = renderNode(node, 0, query)
      if (el) {
        treeEl.appendChild(el)
        hasVisible = true
      }
    })

    if (!hasVisible) {
      treeEl.innerHTML = '<div class="tree-empty">没有匹配的结果</div>'
    }
  }

  function renderNode (node, depth, query) {
    if (!nodeHasMatch(node, query)) return null

    const isFolder = node.type === 'folder'
    const hasKids = !!(node.children && node.children.length)  // .one 主笔记有子节点
    const isExpandable = isFolder || hasKids
    const path = node.path || node.name

    const wrapper = document.createElement('div')
    wrapper.className = 'tree-node'

    const row = document.createElement('div')
    row.className = 'tree-row'
    row.style.paddingLeft = (12 + depth * 18) + 'px'
    row.dataset.path = path

    // 纯叶子节点额外缩进（补偿没有箭头）
    if (!isExpandable) {
      row.style.paddingLeft = (12 + depth * 18 + 10) + 'px'
    }

    // 箭头（可展开节点）
    if (isExpandable) {
      const arrow = document.createElement('span')
      arrow.className = 'arrow'
      if (expandedPaths.has(path)) arrow.classList.add('expanded')
      row.appendChild(arrow)
    }

    // 标签
    const label = document.createElement('span')
    label.className = 'label'
    label.textContent = node.name
    if (hasKids && node.one) {
      const tag = document.createElement('span')
      tag.className = 'tag-main'
      tag.textContent = '· 主笔记'
      label.appendChild(tag)
    }
    row.appendChild(label)

    // 点击
    row.addEventListener('click', (e) => {
      e.stopPropagation()
      if (isExpandable) {
        toggleFolder(path)
      }
      // 如果笔记有可预览/下载的内容，同时选中
      if (node.pdf || node.one) {
        selectNote(node)
        if (window.innerWidth <= 768) closeSidebar()
      }
    })

    // 高亮激活行
    if (!isExpandable && activePath === node.pdf) {
      row.classList.add('active')
    }
    if (hasKids && activePath === (node.one || node.pdf)) {
      row.classList.add('active')
    }

    wrapper.appendChild(row)

    // 子节点
    if (isExpandable && expandedPaths.has(path)) {
      const kids = isFolder ? node.children : node.children
      kids.forEach(child => {
        const childEl = renderNode(child, depth + 1, query)
        if (childEl) wrapper.appendChild(childEl)
      })
    }

    return wrapper
  }

  // --- 展开/折叠 ---
  function toggleFolder (path) {
    if (expandedPaths.has(path)) {
      expandedPaths.delete(path)
    } else {
      expandedPaths.add(path)
    }
    renderTree(searchEl.value)
  }

  // --- 欢迎区 HTML（用于恢复初始状态）---
  const WELCOME_HTML = `
    <div class="welcome-placeholder" id="welcomeArea">
      <div class="welcome-brand">
        红云irch的肉桂卷
      </div>
      <div class="welcome-divider"></div>
      <div class="welcome-preface">
        索琳肉桂卷（Cinnamon Rollyn）是Terraria 众神之怒MOD 中的一种食物，能提供非常强力的buff。
      </div>
      <p class="welcome-hint">左侧选择笔记即可预览</p>
    </div>`

  // --- 恢复欢迎区 ---
  function resetToWelcome () {
    activePath = null
    noteTitle.textContent = '欢迎喵'
    btnDownload.style.display = 'none'
    pdfViewer.innerHTML = WELCOME_HTML
    renderTree(searchEl.value)
  }

  // --- 选中笔记 ---
  function selectNote (node) {
    activePath = node.pdf || null
    noteTitle.textContent = node.name

    // 下载按钮
    if (node.one) {
      btnDownload.style.display = 'inline-flex'
      btnDownload.href = node.one
      btnDownload.download = node.name + '.one'
    } else {
      btnDownload.style.display = 'none'
    }

    // PDF 预览
    if (node.pdf) {
      pdfViewer.innerHTML = `<iframe src="${node.pdf}#toolbar=1&navpanes=0"
        title="${node.name}" allowfullscreen></iframe>`
    } else {
      pdfViewer.innerHTML = `
        <div class="welcome-placeholder">
          <div class="icon-big">📄</div>
          <p>该笔记没有 PDF 文件<br><small style="color:#D0C0C0;">仅有 .one 下载</small></p>
        </div>`
    }

    renderTree(searchEl.value)
  }

  // --- 搜索 ---
  let searchTimer = null
  searchEl.addEventListener('input', function () {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      const q = this.value.trim()
      // 搜索时自动展开所有匹配路径的父节点
      if (q) autoExpandMatching(q)
      renderTree(q)
    }, 200)
  })

  function autoExpandMatching (query) {
    if (!query) return
    function walk (node, parentPath) {
      const path = node.path || node.name
      if (node.type === 'folder' && node.children) {
        if (nodeHasMatch(node, query)) {
          expandedPaths.add(path)
          node.children.forEach(c => walk(c, path))
        }
      }
    }
    noteTree.forEach(n => walk(n, ''))
  }

  // --- 移动端侧边栏 ---
  function openSidebar () {
    sidebar.classList.add('open')
    overlay.classList.add('show')
  }

  function closeSidebar () {
    sidebar.classList.remove('open')
    overlay.classList.remove('show')
  }

  menuBtn.addEventListener('click', () => {
    sidebar.classList.contains('open') ? closeSidebar() : openSidebar()
  })

  overlay.addEventListener('click', closeSidebar)

  // --- 键盘快捷键 ---
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault()
      searchEl.focus()
    }
    if (e.key === 'Escape') {
      closeSidebar()
      searchEl.blur()
    }
  })

  // --- 启动 ---
  // 点击侧边栏品牌名 → 回到欢迎页
  document.querySelector('.sidebar-header .brand-sm').addEventListener('click', resetToWelcome)

  // 点击内容区标题"👋 欢迎"也可回到欢迎页
  noteTitle.addEventListener('click', function () {
    if (!activePath) resetToWelcome()
  })
  noteTitle.style.cursor = 'pointer'

  loadData()

})()
