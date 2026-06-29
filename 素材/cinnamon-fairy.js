/* ============================================================
   Cinnamon Fairy — 角落小精灵
   随机出现在屏幕角落，点击后飞走，过一会儿再回来

   用法：在 HTML 中引入
     <script src="素材/cinnamon-fairy.js"></script>
   然后配置下面的 EMOJIS 数组即可
   ============================================================ */

;(function () {
  'use strict'

  // --- 配置：想出现哪些小东西（emoji / 文字 / 图片都行）---
  const EMOJIS = ['🍞', '🥐', '🍪', '🌰', '🧁', '✨', '🍩', '🫧']

  // 出现间隔（毫秒）范围
  const APPEAR_MIN = 5000   // 消失后最少等 5 秒
  const APPEAR_MAX = 15000  // 最多等 15 秒

  // 动画时长（毫秒）
  const FLY_DURATION = 600

  // --- 创建小精灵元素 ---
  const sprite = document.createElement('div')
  sprite.id = 'cinnamon-fairy'
  sprite.textContent = randomPick(EMOJIS)
  sprite.title = '点我！'

  // 内联样式 + CSS 动画
  const style = document.createElement('style')
  style.textContent = `
    #cinnamon-fairy {
      position: fixed;
      font-size: 2rem;
      cursor: pointer;
      z-index: 9999;
      user-select: none;
      opacity: 0;
      transform: scale(0) rotate(-30deg);
      transition: none;
      pointer-events: none;
    }
    #cinnamon-fairy.show {
      opacity: 1;
      transform: scale(1) rotate(0deg);
      transition: transform .4s cubic-bezier(.34,1.56,.64,1),
                  opacity .3s ease;
      pointer-events: auto;
    }
    #cinnamon-fairy.fly-away {
      opacity: 0;
      transform: scale(0.3) rotate(40deg) translateY(-60px) translateX(40px);
      transition: all ${FLY_DURATION}ms ease-in;
      pointer-events: none;
    }
  `
  document.head.appendChild(style)
  document.body.appendChild(sprite)

  // --- 随机位置 ---
  function randomPos () {
    const margin = 60  // 离边缘的最小距离
    const x = margin + Math.random() * (window.innerWidth - margin * 2)
    const y = margin + Math.random() * (window.innerHeight - margin * 2)
    return { x, y }
  }

  function randomPick (arr) {
    return arr[Math.floor(Math.random() * arr.length)]
  }

  // --- 出现 ---
  function appear () {
    const { x, y } = randomPos()
    sprite.style.left = x + 'px'
    sprite.style.top  = y + 'px'
    sprite.textContent = randomPick(EMOJIS)
    sprite.classList.remove('fly-away')
    // 强制重排
    void sprite.offsetWidth
    sprite.classList.add('show')
  }

  // --- 飞走 ---
  function flyAway () {
    sprite.classList.remove('show')
    sprite.classList.add('fly-away')
    // 等飞走动画结束再安排下次出现
    setTimeout(scheduleAppear, FLY_DURATION + 200)
  }

  // --- 安排下次出现 ---
  function scheduleAppear () {
    const delay = APPEAR_MIN + Math.random() * (APPEAR_MAX - APPEAR_MIN)
    setTimeout(appear, delay)
  }

  // --- 事件 ---
  sprite.addEventListener('click', flyAway)

  // 窗口大小改变时，如果正在显示则重新定位
  window.addEventListener('resize', () => {
    if (sprite.classList.contains('show') && !sprite.classList.contains('fly-away')) {
      const { x, y } = randomPos()
      sprite.style.left = x + 'px'
      sprite.style.top  = y + 'px'
    }
  })

  // --- 启动 ---
  scheduleAppear()

})()
