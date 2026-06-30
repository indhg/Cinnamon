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
  const btnPptx     = document.getElementById('btnPptx')
  const prefaceNav  = document.getElementById('prefaceNav')

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
      <div class="welcome-inner">
        <div class="welcome-brand">
          欢迎来到红云irch的肉桂卷~
        </div>
        <div class="welcome-divider"></div>
        <div class="welcome-preface">
          <p><strong>温馨提示：</strong>Cinnamon 支持以下两种笔记格式，请按需选择——</p>

          <p class="format-compare">
            <span class="format-tag pdf">.pdf</span>
            支持<strong>在线预览</strong>，但由 .one 导出，清晰度和排版略逊于原文件
          </p>
          <p class="format-compare">
            <span class="format-tag one">.one</span>
            需要 <strong>OneNote</strong> 打开，不支持在线预览，但<strong>更清晰、可自由编辑删改</strong>
          </p>

          <p>请读者自行取舍喵~</p>

          <p>仓库名字灵感来自 <span class="inline-accent">「索琳肉桂卷」</span>——索琳肉桂卷（Cinnamon Rollyn）是 Terraria 众神之怒 MOD 中的一种食物，食用后，会给予玩家饱如巨星增益，可看作酒足饭饱增益的更强版本。</p>

          <p>做笔记分享的初衷很简单：督促自己抓紧复习，给散漫的日子挂一个无形的 ddl。没人催你，但你知道这里还有东西没整理完。</p>

          <p>我把笔记放在这里，是想给后来的同学铺一段不那么崎岖的路，也给自己挂一个温柔的催促：该复习了。更是对匆忙的大学生活的一个记录——日子过得太快，有些东西不趁热记下来，转眼就忘了。</p>

          <p>帮你期末补天的，也许是我的一份笔记，也许是其他前辈的资料——但说到底，是那个认真坐下来复习的你自己。</p>

          <p class="preface-quote">「在这众神之怒中，总有人要成为你的超级巨星。」——索琳</p>
        </div>
        <p class="welcome-hint">左侧选择笔记即可预览 · 试试点两次序言</p>
      </div>
    </div>`

  // --- 恢复欢迎区 ---
  // 序言面板是否可见
  let prefaceVisible = false

  function resetToWelcome () {
    activePath = null
    meowCount = 1
    meowDone  = false
    noteTitle.textContent = '欢迎喵'
    btnDownload.style.display = 'none'
    if (btnPptx) btnPptx.style.display = 'none'
    pdfViewer.innerHTML = WELCOME_HTML
    // 回退时默认隐藏文字面板，只显示背景
    setPrefaceVisible(false)
    renderTree(searchEl.value)
  }

  // 切换序言文字面板的显示/隐藏
  function togglePreface () {
    setPrefaceVisible(!prefaceVisible)
  }

  function setPrefaceVisible (show) {
    prefaceVisible = show
    const inner = document.getElementById('welcomeArea')
    if (!inner) return
    const panel = inner.querySelector('.welcome-inner')
    if (panel) {
      panel.style.display = show ? '' : 'none'
    }
  }

  // --- 选中笔记 ---
  function selectNote (node) {
    activePath = node.pdf || null
    noteTitle.textContent = node.name

    // 下载按钮 (.one)
    if (node.one) {
      btnDownload.style.display = 'inline-flex'
      btnDownload.href = node.one
      btnDownload.download = node.name + '.one'
    } else {
      btnDownload.style.display = 'none'
    }

    // PPTX 下载按钮
    if (node.pptx && btnPptx) {
      btnPptx.style.display = 'inline-flex'
      btnPptx.href = node.pptx
      btnPptx.download = node.name + '.pptx'
    } else if (btnPptx) {
      btnPptx.style.display = 'none'
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
  // 侧边栏「序言」→ 切换文字面板
  prefaceNav.addEventListener('click', function () {
    // 如果正在看笔记，先回到欢迎页
    if (activePath) {
      resetToWelcome()
      setPrefaceVisible(true)  // 从笔记点序言 → 显示文字
    } else {
      togglePreface()           // 已经在欢迎页 → 切换
    }
    if (window.innerWidth <= 768) closeSidebar()
  })

  // 点击侧边栏品牌名 → 回到欢迎页
  document.querySelector('.sidebar-header .brand-sm').addEventListener('click', resetToWelcome)

  // 点击内容区标题：每次多加一个喵，最多 10 个
  let meowCount = 1
  let meowDone  = false  // 是否已经变成「小猫哈气」
  noteTitle.addEventListener('click', function () {
    if (activePath) return
    if (meowDone) return  // 已结束，不再变化
    if (meowCount < 30) {
      meowCount++
      noteTitle.textContent = '欢迎' + '喵'.repeat(meowCount)
    } else {
      noteTitle.textContent = '小猫哈气！'
      meowDone = true
    }
  })
  noteTitle.style.cursor = 'pointer'

  loadData()

})()
