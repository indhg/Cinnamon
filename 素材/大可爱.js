/* ============================================================
   大可爱 — 角落里的逐帧动画小人
   随机出现，点击飞走，过一会儿再回来
   ============================================================ */

;(function () {
  'use strict'

  // --- 配置 ---
  const SPRITE_URL = '素材/BabyPlumSprite.png'
  const COLS = 8
  const ROWS = 7
  const FPS  = 12

  const APPEAR_MIN = 5000
  const APPEAR_MAX = 15000
  const FLY_DURATION = 500

  // --- 加载图片获取尺寸 ---
  const img = new Image()
  img.src = SPRITE_URL

  img.onload = function () {
    const frameW = img.naturalWidth  / COLS
    const frameH = img.naturalHeight / ROWS
    const totalFrames = COLS * ROWS

    createCutie(frameW, frameH, totalFrames)
  }

  // --- 创建 CSS ---
  const style = document.createElement('style')
  style.textContent = `
    #big-cutie {
      position: fixed;
      z-index: 9999;
      cursor: pointer;
      user-select: none;
      opacity: 0;
      transform: scale(0);
      pointer-events: none;
      background-repeat: no-repeat;
    }
    #big-cutie.show {
      opacity: 1;
      transform: scale(1);
      transition: transform .4s cubic-bezier(.34,1.56,.64,1),
                  opacity .3s ease;
      pointer-events: auto;
    }
    #big-cutie.fly-away {
      opacity: 0;
      transform: scale(0.5) rotate(30deg) translateY(-80px) translateX(50px);
      transition: all ${FLY_DURATION}ms ease-in;
      pointer-events: none;
    }
    @keyframes cutie-walk {
      from { background-position: 0 0; }
    }
    @keyframes cutie-fly {
      from { background-position: 0 0; }
    }
  `
  document.head.appendChild(style)

  // --- 工具 ---
  function randomPos (margin) {
    return {
      x: margin + Math.random() * (window.innerWidth  - margin * 2),
      y: margin + Math.random() * (window.innerHeight - margin * 2)
    }
  }

  // --- 创建大可爱 ---
  function createCutie (frameW, frameH, totalFrames) {
    const cutie = document.createElement('div')
    cutie.id = 'big-cutie'
    cutie.style.width  = frameW + 'px'
    cutie.style.height = frameH + 'px'
    cutie.style.backgroundImage = `url(${SPRITE_URL})`
    cutie.style.backgroundSize  = (frameW * COLS) + 'px ' + (frameH * ROWS) + 'px'
    cutie.title = '大可爱！点我飞走~'
    document.body.appendChild(cutie)

    // --- 生成逐帧 keyframes ---
    let walkFrames = '@keyframes cutie-walk {'
    let flyFrames  = '@keyframes cutie-fly {'
    const totalPct = 100
    for (let i = 0; i < totalFrames; i++) {
      const pct = (i / (totalFrames - 1)) * totalPct
      const col = i % COLS
      const row = Math.floor(i / COLS)
      const line = `${pct}% { background-position: -${col * frameW}px -${row * frameH}px; }`
      walkFrames += line
      flyFrames  += line
    }
    walkFrames += '}'
    flyFrames  += '}'

    const walkSheet = document.createElement('style')
    walkSheet.textContent = walkFrames
    document.head.appendChild(walkSheet)

    const flySheet = document.createElement('style')
    flySheet.textContent = flyFrames
    document.head.appendChild(flySheet)

    // --- 状态 ---
    let animTimer = null

    function startWalk () {
      cutie.style.animation = `cutie-walk ${totalFrames / FPS}s steps(1) infinite`
    }

    function stopAnimation () {
      cutie.style.animation = ''
      clearInterval(animTimer)
    }

    // --- 出现 ---
    function appear () {
      const { x, y } = randomPos(80)
      cutie.style.left = x + 'px'
      cutie.style.top  = y + 'px'
      cutie.classList.remove('fly-away')
      void cutie.offsetWidth
      cutie.classList.add('show')
      startWalk()
    }

    // --- 飞走 ---
    function flyAway () {
      stopAnimation()
      cutie.style.animation = `cutie-fly ${FLY_DURATION / 1000}s steps(1) forwards`
      cutie.classList.remove('show')
      cutie.classList.add('fly-away')
      setTimeout(() => {
        cutie.classList.remove('fly-away')
        stopAnimation()
        scheduleAppear()
      }, FLY_DURATION + 200)
    }

    function scheduleAppear () {
      const delay = APPEAR_MIN + Math.random() * (APPEAR_MAX - APPEAR_MIN)
      animTimer = setTimeout(appear, delay)
    }

    // --- 事件 ---
    cutie.addEventListener('click', flyAway)

    window.addEventListener('resize', () => {
      if (cutie.classList.contains('show') && !cutie.classList.contains('fly-away')) {
        const { x, y } = randomPos(80)
        cutie.style.left = x + 'px'
        cutie.style.top  = y + 'px'
      }
    })

    // --- 启动 ---
    scheduleAppear()
  }

})()
