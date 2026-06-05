(function () {
  'use strict';

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };

  /* ---- 数据映射 ---- */
  var TYPE_LABELS = {
    Lightning: '电', Water: '水', Fairy: '妖精',
    Fire: '火', Grass: '草', Psychic: '超能力',
    Fighting: '格斗', Darkness: '恶', Metal: '钢', Dragon: '龙',
  };

  var RARITY_LABELS = {
    '': '普通',
    'Rare Holo': '稀有·全息', 'Rare Holo V': '稀有·V 全息',
    'Rare Ultra': '稀有·终极', 'Rare Holo Cosmos': '稀有·银河全息',
  };

  /* ---- 卡片 DOM 构建 ---- */
  function buildCardEl(card) {
    var rarity = (card.rarity || '').toLowerCase();
    var supertype = (card.supertype || '').toLowerCase();
    var types = (card.types || []).join(' ').toLowerCase();
    var subtypes = (card.subtypes || []).join(' ').toLowerCase();

    var wrapper = document.createElement('div');
    wrapper.className = 'card-wrapper';

    // 基础 class: card interactive
    var cardClass = 'card interactive';
    // 添加属性对应的 glow 色 class（base.css 预定义）
    if (card.types && card.types.length > 0) {
      cardClass += ' ' + card.types[0].toLowerCase();
    }

    var cardEl = document.createElement('div');
    cardEl.className = cardClass;
    cardEl.setAttribute('data-rarity', rarity);
    cardEl.setAttribute('data-supertype', supertype);
    if (types) cardEl.setAttribute('data-types', types);
    if (subtypes) cardEl.setAttribute('data-subtypes', subtypes);

    cardEl.innerHTML =
      '<div class="card__translater">' +
        '<button class="card__rotator" type="button">' +
          '<div class="card__back"></div>' +
          '<div class="card__front"><img src="' + card.images.large + '" alt="' + card.name + '" /></div>' +
          '<div class="card__shine"></div>' +
          '<div class="card__glare"></div>' +
        '</button>' +
      '</div>';

    wrapper.appendChild(cardEl);
    wrapper._card = cardEl;
    return wrapper;
  }

  /* ---- 缓动函数 ---- */
  function easeOutBack(t) {
    var c1 = 1.70158;
    var c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  /* ---- 3D 交互 ---- */
  function bind3D(wrapper) {
    var cardEl = wrapper._card;
    var rotator = $('.card__rotator', cardEl);
    var translater = $('.card__translater', cardEl);
    var style = translater.style;
    var active = false;
    var scaleAnim = null;
    var pendingAnimCallback = null; // 追踪 deactivate 挂起的异步回调

    function map(val, inMin, inMax, outMin, outMax) {
      return (val - inMin) / (inMax - inMin) * (outMax - outMin) + outMin;
    }

    function update(clientX, clientY) {
      var rect = rotator.getBoundingClientRect();
      var xPct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      var yPct = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      var fromCenter = 1 - Math.max(Math.abs(xPct - 0.5), Math.abs(yPct - 0.5)) * 2;

      var rx = map(xPct, 0, 1, 15, -15);
      var ry = map(yPct, 0, 1, -20, 20);
      var tx = map(xPct, 0, 1, -8, 8);
      var ty = map(yPct, 0, 1, -8, 8);

      style.setProperty('--pointer-x', (xPct * 100).toFixed(1) + '%');
      style.setProperty('--pointer-y', (yPct * 100).toFixed(1) + '%');
      style.setProperty('--background-x', (xPct * 100).toFixed(1) + '%');
      style.setProperty('--background-y', (yPct * 100).toFixed(1) + '%');
      style.setProperty('--rotate-x', rx.toFixed(3) + 'deg');
      style.setProperty('--rotate-y', ry.toFixed(3) + 'deg');
      style.setProperty('--translate-x', tx.toFixed(2) + 'px');
      style.setProperty('--translate-y', ty.toFixed(2) + 'px');
      style.setProperty('--pointer-from-center', fromCenter.toFixed(3));
      style.setProperty('--pointer-from-top', yPct.toFixed(3));
      style.setProperty('--pointer-from-left', xPct.toFixed(3));
      style.setProperty('--card-opacity', '1');
    }

    function reset() {
      style.setProperty('--card-opacity', '0');
      style.setProperty('--rotate-x', '0deg');
      style.setProperty('--rotate-y', '0deg');
      style.setProperty('--translate-x', '0px');
      style.setProperty('--translate-y', '0px');
    }

    function cancelPending() {
      if (scaleAnim) {
        cancelAnimationFrame(scaleAnim);
        scaleAnim = null;
      }
      pendingAnimCallback = null;
    }

    function animateScale(from, to, duration, onDone) {
      cancelPending();
      var start = performance.now();
      function tick(now) {
        var t = Math.min((now - start) / duration, 1);
        var v = from + (to - from) * easeOutBack(t);
        style.setProperty('--card-scale', v.toFixed(4));
        if (t < 1) {
          scaleAnim = requestAnimationFrame(tick);
        } else {
          style.setProperty('--card-scale', to.toFixed(4));
          scaleAnim = null;
          pendingAnimCallback = null;
          if (onDone) onDone();
        }
      }
      pendingAnimCallback = onDone;
      scaleAnim = requestAnimationFrame(tick);
    }

    function activate() {
      active = true;
      cardEl.classList.remove('interactive');
      animateScale(1, 1.15, 550, function () {
        cardEl.classList.add('interactive');
      });
      cardEl.classList.add('active');
    }

    function deactivate() {
      active = false;
      cardEl.classList.remove('interactive');
      var cur = parseFloat(style.getPropertyValue('--card-scale')) || 1;
      animateScale(cur, 1, 350, function () {
        cardEl.classList.add('interactive');
      });
      cardEl.classList.remove('active');
      reset();
    }

    // 检查鼠标是否在卡片范围内，若是则立即开启追踪
    function resync() {
      // 取消挂起的 deactivate 动画（关键修复 #2）
      cancelPending();
      // 强制恢复 interactive（关键修复 #1, #2, #5）
      cardEl.classList.add('interactive');
      // 重置缩放（避免残留放大状态）
      style.setProperty('--card-scale', '1');
      // 根据全局鼠标位置判断是否在卡片上（关键修复 #4）
      var rect = rotator.getBoundingClientRect();
      if (
        gMouseX >= rect.left && gMouseX <= rect.right &&
        gMouseY >= rect.top  && gMouseY <= rect.bottom
      ) {
        update(gMouseX, gMouseY);
      } else {
        reset();
      }
    }

    // 鼠标进入 → 开启实时追踪
    rotator.addEventListener('mouseenter', function () {
      cardEl.classList.add('interactive');
      style.setProperty('--card-opacity', '1');
    });

    rotator.addEventListener('mousemove', function (e) {
      if (cardEl.classList.contains('interactive')) {
        update(e.clientX, e.clientY);
      }
    });

    // 鼠标离开 → 若未激活则关闭追踪，让 CSS transition 平滑复位
    rotator.addEventListener('mouseleave', function () {
      if (!active) {
        cardEl.classList.remove('interactive');
        reset();
      }
    });

    rotator.addEventListener('click', function (e) {
      e.stopPropagation();
      if (active) {
        deactivate();
      } else {
        cardEl.classList.remove('interactive');
        activate();
      }
    });

    rotator.addEventListener('touchmove', function (e) {
      e.preventDefault();
      var t = e.touches[0];
      cardEl.classList.add('interactive');
      update(t.clientX, t.clientY);
    }, { passive: false });

    rotator.addEventListener('touchend', function () {
      if (!active) {
        cardEl.classList.remove('interactive');
        reset();
      }
    });

    return { deactivate: deactivate, resync: resync };
  }

  /* ---- 全局鼠标位置 ---- */
  var gMouseX = 0, gMouseY = 0;
  document.addEventListener('mousemove', function (e) {
    gMouseX = e.clientX;
    gMouseY = e.clientY;
  });

  /* ---- 主流程 ---- */
  var viewer, infoPanel, cardStage, navPrev, navNext, cardIndexEl;
  var cards = [];
  var wrappers = [];
  var interactives = [];
  var current = 0;
  var switching = false;

  function updateInfo(idx) {
    var card = cards[idx];
    var d = card.details || {};

    // 卡牌名称
    $('.card-name', infoPanel).textContent = card.name;

    // 类型 / 稀有度标签
    var typeEl = $('.meta-tag.type', infoPanel);
    if (card.types && card.types.length > 0) {
      typeEl.style.display = '';
      typeEl.textContent = card.types.map(function (t) { return TYPE_LABELS[t] || t; }).join(' / ') + '系';
    } else if (card.supertype === 'Trainer') {
      typeEl.style.display = '';
      typeEl.textContent = '训练家';
    } else {
      typeEl.style.display = 'none';
    }
    var rarityText = RARITY_LABELS[card.rarity] || card.rarity || '普通';
    $('.meta-tag.rarity', infoPanel).textContent = rarityText;

    // 详细信息 label（支援者卡 / 宝可梦·属性）
    var labelEl = $('.card-detail-label', infoPanel);
    labelEl.textContent = d.label || '';

    // 详细内容区
    var contentEl = $('.card-detail-content', infoPanel);
    contentEl.innerHTML = '';

    if (d.effect) {
      // 训练家卡：效果文字
      var p = document.createElement('p');
      p.className = 'detail-effect';
      p.textContent = d.effect;
      contentEl.appendChild(p);
    }

    if (d.moves && d.moves.length > 0) {
      // 宝可梦卡：招式列表
      d.moves.forEach(function (move) {
        var div = document.createElement('div');
        div.className = 'detail-move';

        var nameEl2 = document.createElement('span');
        nameEl2.className = 'move-name';
        nameEl2.textContent = move.name;

        var textEl = document.createElement('span');
        textEl.className = 'move-text';
        textEl.textContent = move.text;

        div.appendChild(nameEl2);
        div.appendChild(textEl);
        contentEl.appendChild(div);
      });
    }

    if (d.rules && d.rules.length > 0) {
      d.rules.forEach(function (rule) {
        var p = document.createElement('p');
        p.className = 'detail-rule';
        p.textContent = rule;
        contentEl.appendChild(p);
      });
    }

    // 绘师 / 收录商品
    var metaEl = $('.card-detail-meta', infoPanel);
    metaEl.innerHTML = '';
    if (d.illustrator) {
      var row1 = document.createElement('div');
      row1.className = 'detail-row';
      row1.innerHTML = '<span>绘师</span> ' + d.illustrator;
      metaEl.appendChild(row1);
    }
    if (d.product) {
      var row2 = document.createElement('div');
      row2.className = 'detail-row';
      row2.innerHTML = '<span>收录商品</span> ' + d.product;
      metaEl.appendChild(row2);
    }

    cardIndexEl.textContent = (idx + 1) + ' / ' + cards.length;
  }

  function switchTo(idx) {
    if (switching || idx === current) return;
    switching = true;

    var direction = idx > current ? 'right' : 'left';
    var outClass = direction === 'right' ? 'slide-out-left' : 'slide-out-right';
    var inClass  = direction === 'right' ? 'slide-in-from-right' : 'slide-in-from-left';

    var oldWrapper = wrappers[current];
    var newWrapper = wrappers[idx];

    // 取消旧卡片激活状态
    interactives[current].deactivate();

    // 1. 旧卡片滑出
    oldWrapper.classList.remove('is-current');
    oldWrapper.classList.add(outClass);

    // 2. 新卡片准备初始位置
    newWrapper.classList.add(inClass);
    newWrapper.style.visibility = 'visible';

    // 强制回流以锁定初始状态
    void newWrapper.offsetHeight;

    // 3. 新卡片滑入
    newWrapper.classList.remove(inClass);
    newWrapper.classList.add('is-current');

    current = idx;
    updateInfo(current);

    // 4. 同步新卡片状态：取消残留动画、强制恢复 interactive、检测鼠标位置
    interactives[current].resync();

    // 5. 动画结束后清理
    setTimeout(function () {
      oldWrapper.classList.remove(outClass);
      switching = false;
    }, 400);
  }

  function next() { switchTo((current + 1) % cards.length); }
  function prev() { switchTo((current - 1 + cards.length) % cards.length); }

  function buildLayout() {
    viewer = document.createElement('div');
    viewer.className = 'viewer';

    /* 左侧信息面板 */
    infoPanel = document.createElement('div');
    infoPanel.className = 'info-panel';
    infoPanel.innerHTML =
      '<h2 class="card-name"></h2>' +
      '<div class="card-meta">' +
        '<span class="meta-tag type"></span>' +
        '<span class="meta-tag rarity"></span>' +
      '</div>' +
      '<div class="card-detail-label"></div>' +
      '<div class="card-detail-content"></div>' +
      '<div class="card-detail-meta"></div>';
    viewer.appendChild(infoPanel);

    /* 右侧卡片展示区 */
    cardStage = document.createElement('div');
    cardStage.className = 'card-stage';

    // 占位元素，保持 card-stage 高度
    var placeholder = document.createElement('div');
    placeholder.className = 'card card-placeholder';
    placeholder.setAttribute('aria-hidden', 'true');
    placeholder.innerHTML =
      '<div class="card__translater" style="transform:none">' +
        '<div class="card__rotator" style="transform:none">' +
          '<div class="card__front" style="transform:none">' +
            '<img src="media/tw00012625.png" alt="" style="opacity:0" />' +
          '</div>' +
        '</div>' +
      '</div>';
    cardStage.appendChild(placeholder);

    navPrev = document.createElement('button');
    navPrev.className = 'nav-btn nav-prev';
    navPrev.setAttribute('aria-label', '上一张');
    navPrev.innerHTML = '&#10094;';
    cardStage.appendChild(navPrev);

    wrappers = cards.map(function (card) {
      var w = buildCardEl(card);
      cardStage.appendChild(w);
      return w;
    });

    navNext = document.createElement('button');
    navNext.className = 'nav-btn nav-next';
    navNext.setAttribute('aria-label', '下一张');
    navNext.innerHTML = '&#10095;';
    cardStage.appendChild(navNext);

    cardIndexEl = document.createElement('div');
    cardIndexEl.className = 'card-index';
    cardStage.appendChild(cardIndexEl);

    viewer.appendChild(cardStage);

    /* 绑定事件 */
    interactives = wrappers.map(function (w) { return bind3D(w); });

    navPrev.addEventListener('click', prev);
    navNext.addEventListener('click', next);

    /* 键盘导航 */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft')  { e.preventDefault(); prev(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      if (e.key === 'Escape')     { interactives[current].deactivate(); }
    });

    /* 点击卡片外部取消激活 */
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.card__rotator')) {
        interactives[current].deactivate();
      }
    });

    /* 显示第一张 */
    wrappers[0].classList.add('is-current');
    updateInfo(0);
  }

  /* ---- 启动 ---- */
  fetch('data/cards.json')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      cards = data;
      buildLayout();
      document.getElementById('app').appendChild(viewer);
    })
    .catch(function (err) {
      document.getElementById('app').innerHTML =
        '<p style="color:#fff;text-align:center;padding:50px;">加载卡片数据失败：' + err.message + '</p>';
    });
})();
