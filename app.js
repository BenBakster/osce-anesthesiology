/* ОСКІ — реаніматологія: SPA */
(function () {
  'use strict';

  var DATA = window.OSCE_DATA;
  var app = document.getElementById('app');
  var STORAGE_PREFIX = 'osce-checklist:';
  var SCORE_PREFIX = 'osce-score:';
  var THEME_KEY = 'osce-theme';
  var MODE_KEY = 'osce-mode';
  var ANIM_KEY = 'osce-animations';

  // ---------- Util ----------
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k.indexOf('on') === 0 && typeof attrs[k] === 'function') {
          node.addEventListener(k.slice(2), attrs[k]);
        } else if (attrs[k] != null) {
          node.setAttribute(k, attrs[k]);
        }
      }
    }
    if (children) {
      if (!Array.isArray(children)) children = [children];
      children.forEach(function (c) {
        if (c == null) return;
        if (typeof c === 'string' || typeof c === 'number') node.appendChild(document.createTextNode(String(c)));
        else node.appendChild(c);
      });
    }
    return node;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function svgEl(html) {
    var w = document.createElement('div');
    w.innerHTML = html;
    return w.firstElementChild;
  }
  function getMode() { return localStorage.getItem(MODE_KEY) || 'basic'; }
  function setMode(m) { localStorage.setItem(MODE_KEY, m); render(); }
  function findExtScenario(id) { return DATA.extended.scenarios.find(function (s) { return s.id === id; }); }
  function findBasicScenario(id) { return DATA.basic.scenarios.find(function (s) { return s.id === id; }); }
  function rhythmLabel(r) {
    if (r === 'shockable') return 'Дефібриляційний';
    if (r === 'non-shockable') return 'Недефібриляційний';
    if (r === 'mixed') return 'Залежить від ритму';
    return r;
  }

  // ---------- Stagger CSS application ----------
  function applyStagger(parent, selector, baseDelay) {
    var items = parent.querySelectorAll(selector);
    items.forEach(function (it, i) {
      it.style.animationDelay = (i * (baseDelay || 30)) + 'ms';
      it.classList.add('stagger-in');
    });
  }

  // ---------- Checklist ----------
  function makeChecklist(items, storageKey, opts) {
    opts = opts || {};
    var ul = el('ul', { class: 'checklist' + (opts.weighted ? ' checklist-weighted' : '') });
    var saved = {};
    try { saved = JSON.parse(localStorage.getItem(STORAGE_PREFIX + storageKey) || '{}'); } catch (e) {}

    items.forEach(function (item, i) {
      var text = typeof item === 'string' ? item : item.text;
      var weight = item.weight;
      var n = item.n;
      var id = storageKey + ':' + i;
      var state = saved[i] || 0; // 0=none, 1=full, 2=partial (only if weighted)

      var li = el('li', { 'data-state': state });
      if (opts.weighted) li.setAttribute('data-weight', weight);

      var box = el('div', { class: 'check-box', tabindex: '0', role: 'checkbox',
        'aria-checked': state === 1 ? 'true' : state === 2 ? 'mixed' : 'false' });
      function setState(newState) {
        state = newState;
        li.setAttribute('data-state', state);
        box.setAttribute('aria-checked', state === 1 ? 'true' : state === 2 ? 'mixed' : 'false');
        var s = {};
        try { s = JSON.parse(localStorage.getItem(STORAGE_PREFIX + storageKey) || '{}'); } catch (e) {}
        s[i] = state;
        localStorage.setItem(STORAGE_PREFIX + storageKey, JSON.stringify(s));
        if (opts.onChange) opts.onChange();
      }
      box.addEventListener('click', function () {
        var next = opts.weighted ? (state === 0 ? 1 : state === 1 ? 2 : 0) : (state ? 0 : 1);
        setState(next);
      });
      box.addEventListener('keydown', function (e) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          var next = opts.weighted ? (state === 0 ? 1 : state === 1 ? 2 : 0) : (state ? 0 : 1);
          setState(next);
        }
      });

      var labelChildren = [];
      if (n) labelChildren.push(el('span', { class: 'check-num' }, '#' + n));
      labelChildren.push(el('span', { class: 'check-text' }, text));
      if (opts.weighted) {
        var word = weight === 1 ? 'бал' : (weight >= 2 && weight <= 4 ? 'бали' : 'балів');
        labelChildren.push(el('span', { class: 'check-weight' }, weight + ' ' + word));
      }
      var label = el('label', null, labelChildren);
      label.addEventListener('click', function (e) { e.preventDefault(); box.click(); });

      li.appendChild(box);
      li.appendChild(label);
      ul.appendChild(li);
    });

    return ul;
  }

  function calculateScore(items, storageKey) {
    var saved = {};
    try { saved = JSON.parse(localStorage.getItem(STORAGE_PREFIX + storageKey) || '{}'); } catch (e) {}
    var score = 0;
    items.forEach(function (item, i) {
      var state = saved[i] || 0;
      var w = item.weight;
      if (state === 1) score += w;
      else if (state === 2) score += w / 2;
    });
    return score;
  }

  // ---------- Metronome (CPR 100-120/min) ----------
  function Metronome() {
    this.bpm = 110;
    this.running = false;
    this.audioCtx = null;
    this.intervalId = null;
    this.tickEnabled = false;
    this.dot = null;
    this.bpmLabel = null;
    this.toggleBtn = null;
    this.tickBtn = null;
  }
  Metronome.prototype.render = function () {
    var self = this;
    var wrap = el('div', { class: 'metronome' });

    var dot = el('div', { class: 'metro-dot', 'aria-hidden': 'true' });
    self.dot = dot;
    wrap.appendChild(dot);

    var info = el('div', { class: 'metro-info' });
    var title = el('div', { class: 'metro-title' }, 'Метроном CPR');
    var bpmLabel = el('div', { class: 'metro-bpm' }, self.bpm + ' /хв');
    self.bpmLabel = bpmLabel;
    info.appendChild(title);
    info.appendChild(bpmLabel);
    wrap.appendChild(info);

    var controls = el('div', { class: 'metro-controls' });
    var toggleBtn = el('button', {
      class: 'btn btn-sm',
      type: 'button',
      onclick: function () { self.toggle(); }
    }, 'Старт');
    self.toggleBtn = toggleBtn;
    controls.appendChild(toggleBtn);

    [100, 110, 120].forEach(function (b) {
      var btn = el('button', {
        class: 'btn btn-sm btn-secondary' + (b === self.bpm ? ' is-active' : ''),
        type: 'button',
        onclick: function () { self.setBpm(b); }
      }, b);
      btn.dataset.bpm = b;
      controls.appendChild(btn);
    });

    var tickBtn = el('button', {
      class: 'btn btn-sm btn-secondary',
      type: 'button',
      onclick: function () { self.toggleTick(); }
    }, 'Звук: викл');
    self.tickBtn = tickBtn;
    controls.appendChild(tickBtn);

    wrap.appendChild(controls);

    self.applyBpmStyle();
    return wrap;
  };
  Metronome.prototype.applyBpmStyle = function () {
    if (this.dot) {
      var period = 60 / this.bpm;
      this.dot.style.animationDuration = period + 's';
    }
    if (this.bpmLabel) this.bpmLabel.textContent = this.bpm + ' /хв';
    var siblings = this.toggleBtn ? this.toggleBtn.parentElement.querySelectorAll('[data-bpm]') : [];
    var self = this;
    siblings.forEach(function (b) {
      b.classList.toggle('is-active', parseInt(b.dataset.bpm) === self.bpm);
    });
  };
  Metronome.prototype.setBpm = function (b) {
    this.bpm = b;
    this.applyBpmStyle();
    if (this.running) {
      this.stop();
      this.start();
    }
  };
  Metronome.prototype.toggle = function () {
    if (this.running) this.stop(); else this.start();
  };
  Metronome.prototype.start = function () {
    var self = this;
    self.running = true;
    if (self.dot) self.dot.classList.add('is-running');
    if (self.toggleBtn) self.toggleBtn.textContent = 'Стоп';
    if (self.tickEnabled) {
      var interval = 60000 / self.bpm;
      self.tick();
      self.intervalId = setInterval(function () { self.tick(); }, interval);
    }
  };
  Metronome.prototype.stop = function () {
    this.running = false;
    if (this.dot) this.dot.classList.remove('is-running');
    if (this.toggleBtn) this.toggleBtn.textContent = 'Старт';
    if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null; }
  };
  Metronome.prototype.toggleTick = function () {
    this.tickEnabled = !this.tickEnabled;
    if (this.tickBtn) this.tickBtn.textContent = 'Звук: ' + (this.tickEnabled ? 'вкл' : 'викл');
    if (this.running) {
      this.stop();
      this.start();
    }
  };
  Metronome.prototype.tick = function () {
    try {
      if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      var ctx = this.audioCtx;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.start();
      osc.stop(ctx.currentTime + 0.06);
    } catch (e) { /* audio not available */ }
  };

  // ---------- 5-min Timer ----------
  function CPRTimer() {
    this.duration = DATA.basic.meta.duration; // 300
    this.elapsed = 0;
    this.running = false;
    this.tickId = null;
    this.startedAt = 0;
    this.svg = null;
    this.label = null;
    this.phaseLabel = null;
    this.toggleBtn = null;
    this.phases = DATA.basic.tactics.timing;
  }
  CPRTimer.prototype.render = function () {
    var self = this;
    var wrap = el('div', { class: 'cpr-timer' });

    var ringWrap = el('div', { class: 'timer-ring-wrap' });
    var size = 160, r = 70, cx = size / 2, cy = size / 2;
    var circ = 2 * Math.PI * r;

    var svgWrapper = el('div', { class: 'timer-ring' });
    var svg = svgEl(
      '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '">' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" class="timer-track"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" class="timer-progress" ' +
      'stroke-dasharray="' + circ + '" stroke-dashoffset="' + circ + '" ' +
      'transform="rotate(-90 ' + cx + ' ' + cy + ')"/>' +
      '</svg>'
    );
    svgWrapper.appendChild(svg);
    self.svg = svg.querySelector('.timer-progress');
    self.circ = circ;

    var label = el('div', { class: 'timer-label' }, '5:00');
    var phaseLabel = el('div', { class: 'timer-phase' }, self.phases[0].text);
    self.label = label;
    self.phaseLabel = phaseLabel;
    svgWrapper.appendChild(label);
    ringWrap.appendChild(svgWrapper);
    ringWrap.appendChild(phaseLabel);
    wrap.appendChild(ringWrap);

    var controls = el('div', { class: 'timer-controls' });
    var toggleBtn = el('button', {
      class: 'btn btn-sm',
      type: 'button',
      onclick: function () { self.toggle(); }
    }, 'Старт');
    self.toggleBtn = toggleBtn;
    var resetBtn = el('button', {
      class: 'btn btn-sm btn-secondary',
      type: 'button',
      onclick: function () { self.reset(); }
    }, 'Скинути');
    controls.appendChild(toggleBtn);
    controls.appendChild(resetBtn);
    wrap.appendChild(controls);

    self.update();
    return wrap;
  };
  CPRTimer.prototype.toggle = function () {
    if (this.running) this.pause(); else this.start();
  };
  CPRTimer.prototype.start = function () {
    var self = this;
    if (self.elapsed >= self.duration) self.elapsed = 0;
    self.running = true;
    self.startedAt = Date.now() - self.elapsed * 1000;
    self.toggleBtn.textContent = 'Пауза';
    self.tickId = setInterval(function () {
      self.elapsed = (Date.now() - self.startedAt) / 1000;
      if (self.elapsed >= self.duration) {
        self.elapsed = self.duration;
        self.pause();
      }
      self.update();
    }, 100);
  };
  CPRTimer.prototype.pause = function () {
    this.running = false;
    if (this.toggleBtn) this.toggleBtn.textContent = this.elapsed >= this.duration ? 'Готово' : 'Старт';
    if (this.tickId) { clearInterval(this.tickId); this.tickId = null; }
  };
  CPRTimer.prototype.reset = function () {
    this.pause();
    this.elapsed = 0;
    if (this.toggleBtn) this.toggleBtn.textContent = 'Старт';
    this.update();
  };
  CPRTimer.prototype.currentPhase = function () {
    var t = this.elapsed;
    if (t < 30) return 0;
    if (t < 120) return 1;
    if (t < 150) return 2;
    if (t < 270) return 3;
    return 4;
  };
  CPRTimer.prototype.update = function () {
    var remaining = Math.max(0, this.duration - this.elapsed);
    var mm = Math.floor(remaining / 60);
    var ss = Math.floor(remaining % 60);
    if (this.label) this.label.textContent = mm + ':' + (ss < 10 ? '0' : '') + ss;
    if (this.svg) {
      var progress = this.elapsed / this.duration;
      this.svg.style.strokeDashoffset = (this.circ * (1 - progress));
    }
    if (this.phaseLabel) {
      var p = this.phases[this.currentPhase()];
      this.phaseLabel.textContent = p.range + ' — ' + p.text;
    }
  };

  // ---------- Views: shared ----------
  function backLink() { return el('a', { class: 'back-link', href: '#' }, 'На головну'); }

  // ---------- View: Home (mode-aware) ----------
  function viewHome() {
    return getMode() === 'basic' ? viewHomeBasic() : viewHomeExtended();
  }

  function modeBanner() {
    var mode = getMode();
    return el('div', { class: 'mode-banner mode-' + mode }, [
      el('div', { class: 'mode-banner-text' }, [
        el('div', { class: 'mode-banner-label' }, mode === 'basic' ? 'БАЗОВИЙ РЕЖИМ' : 'РОЗШИРЕНИЙ РЕЖИМ'),
        el('div', { class: 'mode-banner-sub' }, mode === 'basic' ? DATA.basic.meta.subtitle : DATA.extended.meta.subtitle)
      ]),
      el('button', {
        class: 'btn btn-sm btn-secondary',
        type: 'button',
        onclick: function () { setMode(mode === 'basic' ? 'extended' : 'basic'); }
      }, 'Перемкнути на ' + (mode === 'basic' ? 'розширений' : 'базовий'))
    ]);
  }

  function heroFrog() {
    return svgEl(
      '<div class="home-hero-frog frog-blink frog-large">' +
      '<svg viewBox="0 0 90 76" width="90" height="76">' +
      '<ellipse cx="45" cy="55" rx="38" ry="20" fill="currentColor"/>' +
      '<ellipse cx="45" cy="60" rx="22" ry="6" fill="rgba(255,255,255,0.20)"/>' +
      '<circle class="eye-l" cx="25" cy="22" r="14" fill="currentColor"/>' +
      '<circle class="eye-r" cx="65" cy="22" r="14" fill="currentColor"/>' +
      '<circle cx="25" cy="22" r="7" fill="#fff"/>' +
      '<circle cx="65" cy="22" r="7" fill="#fff"/>' +
      '<circle cx="25" cy="24" r="3.4" fill="#1a1a1a"/>' +
      '<circle cx="65" cy="24" r="3.4" fill="#1a1a1a"/>' +
      '<path d="M30 58 Q45 68 60 58" stroke="#1a1a1a" stroke-width="2" fill="none" stroke-linecap="round"/>' +
      '<ellipse cx="32" cy="48" rx="3" ry="2" fill="rgba(255,255,255,0.4)"/>' +
      '</svg></div>'
    );
  }

  function viewHomeBasic() {
    var b = DATA.basic;
    var hero = el('div', { class: 'home-hero' }, [
      el('div', { class: 'home-hero-text' }, [
        el('h1', null, b.meta.title),
        el('p', { class: 'subtitle', style: 'margin: 0;' }, b.meta.subtitle),
        el('div', { class: 'meta-line' }, b.meta.passport)
      ]),
      heroFrog()
    ]);

    var grid = el('div', { class: 'scenario-grid' });
    b.scenarios.forEach(function (s) {
      var card = el('a', {
        class: 'scenario-card scenario-card-basic stagger-in' + (s.special ? ' has-special' : ''),
        href: '#' + s.id
      }, [
        el('div', { class: 'num' }, 'Сценарій ' + s.number),
        el('div', { class: 'title' }, s.title),
        el('div', { class: 'hint' }, s.context),
        s.special ? el('div', { class: 'card-flag' }, 'З особливістю') : null
      ]);
      grid.appendChild(card);
    });

    var quick = el('div', { class: 'quick-grid' }, [
      el('a', { class: 'quick-link stagger-in', href: '#basic-checklist' }, [
        el('div', { class: 'ql-title' }, 'Чек-лист на 20 балів'),
        el('div', { class: 'ql-desc' }, 'Офіційний чек-лист з вагами; підрахунок суми')
      ]),
      el('a', { class: 'quick-link stagger-in', href: '#basic-script' }, [
        el('div', { class: 'ql-title' }, 'Офіційний скрипт реплік'),
        el('div', { class: 'ql-desc' }, 'Дослівні формулювання з паспорта')
      ]),
      el('a', { class: 'quick-link stagger-in', href: '#basic-training' }, [
        el('div', { class: 'ql-title' }, 'Тренування з таймером'),
        el('div', { class: 'ql-desc' }, '5 хвилин, метроном CPR, чек-лист')
      ]),
      el('a', { class: 'quick-link stagger-in', href: '#basic-tactics' }, [
        el('div', { class: 'ql-title' }, 'Тактика та помилки'),
        el('div', { class: 'ql-desc' }, 'Розподіл часу, що НЕ робити')
      ])
    ]);

    var view = el('div', null, [
      modeBanner(),
      hero,
      el('div', { class: 'section-title' }, [
        el('h2', null, 'Сценарії'),
        el('span', { class: 'meta' }, b.scenarios.length + ' побутових сценаріїв')
      ]),
      grid,
      el('h2', null, 'Швидкі переходи'),
      quick
    ]);
    return view;
  }

  function viewHomeExtended() {
    var ext = DATA.extended;
    var hero = el('div', { class: 'home-hero' }, [
      el('div', { class: 'home-hero-text' }, [
        el('h1', null, ext.meta.title),
        el('p', { class: 'subtitle', style: 'margin: 0;' }, ext.meta.subtitle)
      ]),
      heroFrog()
    ]);

    var flowchart = renderALSFlowchart();

    var grid = el('div', { class: 'scenario-grid' });
    ext.scenarios.forEach(function (s) {
      var card = el('a', {
        class: 'scenario-card stagger-in rhythm-' + s.rhythm,
        href: '#' + s.id
      }, [
        el('div', { class: 'num' }, 'Сценарій ' + s.number),
        el('div', { class: 'title' }, s.title),
        el('div', { class: 'hint' }, s.shortHint || s.cause4g4t)
      ]);
      grid.appendChild(card);
    });

    var quick = el('div', { class: 'quick-grid' }, [
      el('a', { class: 'quick-link stagger-in', href: '#general' }, [
        el('div', { class: 'ql-title' }, 'Загальне для всіх сценаріїв'),
        el('div', { class: 'ql-desc' }, 'Послідовність дій до пошуку оборотної причини')
      ]),
      el('a', { class: 'quick-link stagger-in', href: '#4g4t' }, [
        el('div', { class: 'ql-title' }, 'Карта 4Г+4Т'),
        el('div', { class: 'ql-desc' }, 'Оборотні причини → сценарії → ключове втручання')
      ]),
      el('a', { class: 'quick-link stagger-in', href: '#antidotes' }, [
        el('div', { class: 'ql-title' }, 'Антидоти'),
        el('div', { class: 'ql-desc' }, 'Довідник антидотів за класами токсинів')
      ]),
      el('a', { class: 'quick-link stagger-in', href: '#training' }, [
        el('div', { class: 'ql-title' }, 'Режим тренування'),
        el('div', { class: 'ql-desc' }, 'Випадковий сценарій — назвати оборотну причину')
      ])
    ]);

    return el('div', null, [
      modeBanner(),
      hero,
      el('h2', null, 'Алгоритм ALS'),
      flowchart,
      el('div', { class: 'section-title' }, [
        el('h2', null, 'Сценарії'),
        el('span', { class: 'meta' }, ext.scenarios.length + ' сценаріїв')
      ]),
      grid,
      el('h2', null, 'Швидкі переходи'),
      quick
    ]);
  }

  // ---------- ALS Flowchart (animated SVG) ----------
  function renderALSFlowchart() {
    var W = 680, H = 720;
    var svg =
      '<div class="als-flowchart">' +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Алгоритм ALS">' +
      '<defs>' +
      '<marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">' +
      '<path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor"/>' +
      '</marker>' +
      '</defs>';

    function box(x, y, w, h, text, cls, sub) {
      var lines = '';
      if (sub) {
        lines = '<text x="' + (x + w/2) + '" y="' + (y + 22) + '" class="flow-text">' + text + '</text>' +
                '<text x="' + (x + w/2) + '" y="' + (y + 40) + '" class="flow-sub">' + sub + '</text>';
      } else {
        lines = '<text x="' + (x + w/2) + '" y="' + (y + h/2 + 5) + '" class="flow-text">' + text + '</text>';
      }
      return '<g class="flow-node ' + cls + '">' +
        '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="8" ry="8" class="flow-rect"/>' +
        lines + '</g>';
    }
    function arrow(x1, y1, x2, y2) {
      return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" class="flow-arrow" marker-end="url(#arrow)"/>';
    }

    // Common top
    svg += box(180, 20, 320, 44, 'Зупинка серця', 'flow-neutral');
    svg += arrow(340, 64, 340, 80);
    svg += box(180, 80, 320, 44, 'СЛР 30:2 + ЗІЗ + дефібрилятор', 'flow-neutral');
    svg += arrow(340, 124, 340, 140);
    svg += box(180, 140, 320, 44, 'Оцінка ритму', 'flow-neutral');

    // Branch
    svg += '<line x1="200" y1="184" x2="120" y2="220" class="flow-arrow" marker-end="url(#arrow)"/>';
    svg += '<line x1="480" y1="184" x2="560" y2="220" class="flow-arrow" marker-end="url(#arrow)"/>';

    // Left (shockable)
    svg += box(40, 220, 260, 44, 'ФШ / ШТ без пульсу', 'flow-shockable');
    svg += arrow(170, 264, 170, 280);
    svg += box(40, 280, 260, 44, 'Розряд 150 Дж', 'flow-shockable');
    svg += arrow(170, 324, 170, 340);
    svg += box(40, 340, 260, 44, 'СЛР 2 хв', 'flow-shockable');
    svg += arrow(170, 384, 170, 400);
    svg += box(40, 400, 260, 56, 'Після 3-го розряду', 'flow-shockable', 'аміодарон 300 + адреналін 1 мг');
    svg += arrow(170, 456, 170, 472);
    svg += box(40, 472, 260, 56, 'Після 5-го розряду', 'flow-shockable', 'аміодарон 150 мг повторно');

    // Right (non-shockable)
    svg += box(380, 220, 260, 44, 'Асистолія / БЕА', 'flow-nonshockable');
    svg += arrow(510, 264, 510, 280);
    svg += box(380, 280, 260, 44, 'Адреналін 1 мг негайно', 'flow-nonshockable');
    svg += arrow(510, 324, 510, 340);
    svg += box(380, 340, 260, 44, 'СЛР 2 хв', 'flow-nonshockable');
    svg += arrow(510, 384, 510, 400);
    svg += box(380, 400, 260, 56, 'Повторно адреналін', 'flow-nonshockable', '1 мг кожні 3–5 хв');
    svg += arrow(510, 456, 510, 472);
    svg += box(380, 472, 260, 56, 'Переоцінка ритму', 'flow-nonshockable', 'кожні 2 хв');

    // Merge
    svg += '<line x1="170" y1="528" x2="320" y2="568" class="flow-arrow" marker-end="url(#arrow)"/>';
    svg += '<line x1="510" y1="528" x2="360" y2="568" class="flow-arrow" marker-end="url(#arrow)"/>';

    svg += box(100, 568, 480, 56, '4Г 4Т: паралельно шукаємо оборотну причину', 'flow-reversible');
    svg += arrow(340, 624, 340, 640);
    svg += box(150, 640, 380, 56, 'ROSC → післяреанімаційна допомога', 'flow-rosc');

    svg += '</svg></div>';
    return svgEl(svg);
  }

  // ---------- View: Basic Scenario ----------
  function viewBasicScenario(id) {
    var s = findBasicScenario(id);
    if (!s) return view404();

    var children = [
      backLink(),
      el('h1', null, 'Сценарій ' + s.number + '. ' + s.title),
      el('div', { class: 'patient-block stagger-in' }, [
        el('div', { class: 'meta-line' }, 'Контекст станції'),
        s.context
      ])
    ];

    if (s.special) {
      children.push(el('div', { class: 'block block-cause stagger-in' }, [
        el('div', { class: 'label' }, s.special.title),
        el('div', { class: 'special-highlight' }, s.special.highlight),
        el('div', { class: 'special-text' }, s.special.text)
      ]));
    } else {
      children.push(el('div', { class: 'block stagger-in' }, [
        el('div', null, 'Стандартний BLS-алгоритм без особливостей. Виконуємо за чек-листом 20 балів.')
      ]));
    }

    var actions = el('div', { class: 'training-actions stagger-in' });
    actions.appendChild(el('a', { class: 'btn btn-sm', href: '#basic-checklist' }, 'Відкрити чек-лист 20 балів'));
    actions.appendChild(el('a', { class: 'btn btn-sm btn-secondary', href: '#basic-script' }, 'Скрипт реплік'));
    if (s.relatedExtended) {
      actions.appendChild(el('a', {
        class: 'btn btn-sm btn-secondary',
        href: '#' + s.relatedExtended,
        onclick: function () { setMode('extended'); }
      }, 'Розширений варіант →'));
    }
    children.push(actions);

    // Prev / Next
    var idx = DATA.basic.scenarios.findIndex(function (x) { return x.id === s.id; });
    var nav = el('div', { class: 'training-actions', style: 'margin-top: 24px;' });
    if (idx > 0) {
      nav.appendChild(el('a', { class: 'btn btn-secondary btn-sm', href: '#' + DATA.basic.scenarios[idx - 1].id },
        '← Сц. ' + DATA.basic.scenarios[idx - 1].number));
    }
    if (idx < DATA.basic.scenarios.length - 1) {
      nav.appendChild(el('a', { class: 'btn btn-secondary btn-sm', href: '#' + DATA.basic.scenarios[idx + 1].id },
        'Сц. ' + DATA.basic.scenarios[idx + 1].number + ' →'));
    }
    children.push(nav);

    return el('div', null, children);
  }

  // ---------- View: Basic Checklist 20 ----------
  function viewBasicChecklist() {
    var b = DATA.basic;
    var children = [
      backLink(),
      el('h1', null, 'Чек-лист на 20 балів'),
      el('p', { class: 'subtitle' },
        'Офіційний чек-лист станції 222 СЛР. Клік по чекбоксу циклічно перемикає: ' +
        '«не виконав» → «виконав повністю» → «частково» (½ ваги) → «не виконав».')
    ];

    var scoreBadge = el('div', { class: 'score-badge' });
    var scoreLabel = el('div', { class: 'score-label' }, 'Сума балів');
    var scoreValue = el('div', { class: 'score-value' });
    var scoreBar = el('div', { class: 'score-bar' });
    var scoreBarFill = el('div', { class: 'score-bar-fill' });
    scoreBar.appendChild(scoreBarFill);
    scoreBadge.appendChild(scoreLabel);
    scoreBadge.appendChild(scoreValue);
    scoreBadge.appendChild(scoreBar);

    function updateScore() {
      var s = calculateScore(b.checklist20, 'basic:checklist20');
      var pct = (s / b.meta.maxScore) * 100;
      scoreValue.textContent = s.toFixed(1) + ' / ' + b.meta.maxScore;
      scoreBarFill.style.width = pct + '%';
      scoreBadge.classList.remove('pass', 'fail', 'partial');
      if (s >= b.meta.passScore) scoreBadge.classList.add('pass');
      else if (s > 0) scoreBadge.classList.add('partial');
      else scoreBadge.classList.add('fail');
      scoreBadge.setAttribute('data-state', s >= b.meta.passScore ? 'pass' : s > 0 ? 'partial' : 'fail');
    }

    var checklistBlock = el('div', { class: 'card' }, [
      el('div', { class: 'section-title' }, [
        el('h3', null, '15 пунктів оцінювання'),
        el('button', {
          class: 'reset-btn',
          type: 'button',
          onclick: function () {
            localStorage.removeItem(STORAGE_PREFIX + 'basic:checklist20');
            render();
          }
        }, 'Скинути')
      ]),
      makeChecklist(b.checklist20, 'basic:checklist20', { weighted: true, onChange: updateScore })
    ]);

    children.push(scoreBadge);
    children.push(checklistBlock);

    // Metronome
    var metro = new Metronome();
    children.push(el('div', { class: 'card' }, [
      el('h3', null, 'Метроном CPR'),
      el('p', { class: 'meta-line', style: 'margin: 0 0 8px;' }, 'Тренує ритм компресій 100–120/хв.'),
      metro.render()
    ]));

    setTimeout(updateScore, 0);
    return el('div', null, children);
  }

  // ---------- View: Basic Script ----------
  function viewBasicScript() {
    var sc = DATA.basic.script;
    var children = [
      backLink(),
      el('h1', null, 'Офіційний скрипт реплік'),
      el('p', { class: 'subtitle' }, 'Дослівні формулювання з паспорта станції. Відхилення — мінус бали.')
    ];

    Object.keys(sc).forEach(function (k) {
      var sec = sc[k];
      var ul = el('ul', { class: 'plain-list' });
      sec.items.forEach(function (it) { ul.appendChild(el('li', { class: 'stagger-in' }, it)); });
      children.push(el('div', { class: 'card' }, [
        el('h3', null, sec.title),
        ul
      ]));
    });

    return el('div', null, children);
  }

  // ---------- View: Basic Training ----------
  var basicTrainingState = { scenarioId: null };
  function viewBasicTraining() {
    var b = DATA.basic;
    if (!basicTrainingState.scenarioId) {
      basicTrainingState.scenarioId = b.scenarios[Math.floor(Math.random() * b.scenarios.length)].id;
    }
    var s = findBasicScenario(basicTrainingState.scenarioId);

    var children = [
      backLink(),
      el('h1', null, [
        'Тренування ',
        el('span', { class: 'training-frog frog-jump-trigger', html:
          '<svg viewBox="0 0 32 26" width="28" height="22">' +
          '<ellipse cx="16" cy="18" rx="13" ry="7" fill="currentColor"/>' +
          '<circle cx="9" cy="9" r="5" fill="currentColor"/>' +
          '<circle cx="23" cy="9" r="5" fill="currentColor"/>' +
          '<circle cx="9" cy="9" r="2.5" fill="#fff"/>' +
          '<circle cx="23" cy="9" r="2.5" fill="#fff"/>' +
          '<circle cx="9" cy="10" r="1.2" fill="#1a1a1a"/>' +
          '<circle cx="23" cy="10" r="1.2" fill="#1a1a1a"/>' +
          '<path d="M11 19 Q16 22 21 19" stroke="#1a1a1a" stroke-width="1" fill="none" stroke-linecap="round"/>' +
          '</svg>'
        })
      ]),
      el('p', { class: 'subtitle' },
        '5 хвилин на станції. Запусти таймер і метроном, проходь чек-лист — слідкуй за фазами.')
    ];

    // Scenario card
    var scenarioCard = el('div', { class: 'training-stage' }, [
      el('div', { class: 'training-meta' }, 'Випадковий побутовий сценарій'),
      el('h3', { style: 'margin: 0 0 6px;' }, 'Сценарій ' + s.number + '. ' + s.title),
      el('div', { class: 'training-patient' }, s.context),
      s.special ? el('div', { class: 'block block-cause', style: 'margin: 12px 0 0;' }, [
        el('div', { class: 'label' }, 'Особливість'),
        el('div', null, s.special.highlight)
      ]) : null,
      el('div', { class: 'training-actions' }, [
        el('button', {
          class: 'btn btn-sm btn-secondary',
          type: 'button',
          onclick: function () {
            var pool = b.scenarios.filter(function (x) { return x.id !== basicTrainingState.scenarioId; });
            basicTrainingState.scenarioId = pool[Math.floor(Math.random() * pool.length)].id;
            render();
          }
        }, 'Інший сценарій'),
        el('a', { class: 'btn btn-sm btn-secondary', href: '#' + s.id }, 'Відкрити сценарій')
      ])
    ]);
    children.push(scenarioCard);

    // Two-column: timer + metronome
    var timer = new CPRTimer();
    var metro = new Metronome();
    children.push(el('div', { class: 'training-grid' }, [
      el('div', { class: 'card' }, [
        el('h3', null, 'Таймер 5 хвилин'),
        timer.render()
      ]),
      el('div', { class: 'card' }, [
        el('h3', null, 'Метроном CPR'),
        metro.render()
      ])
    ]));

    // Checklist 20
    var b2 = DATA.basic;
    var scoreBadge = el('div', { class: 'score-badge' });
    var scoreLabel = el('div', { class: 'score-label' }, 'Сума балів');
    var scoreValue = el('div', { class: 'score-value' });
    var scoreBar = el('div', { class: 'score-bar' });
    var scoreBarFill = el('div', { class: 'score-bar-fill' });
    scoreBar.appendChild(scoreBarFill);
    scoreBadge.appendChild(scoreLabel);
    scoreBadge.appendChild(scoreValue);
    scoreBadge.appendChild(scoreBar);
    function updateScore() {
      var sc2 = calculateScore(b2.checklist20, 'basic:checklist20');
      var pct = (sc2 / b2.meta.maxScore) * 100;
      scoreValue.textContent = sc2.toFixed(1) + ' / ' + b2.meta.maxScore;
      scoreBarFill.style.width = pct + '%';
      scoreBadge.setAttribute('data-state', sc2 >= b2.meta.passScore ? 'pass' : sc2 > 0 ? 'partial' : 'fail');
      if (sc2 >= b2.meta.passScore) {
        var frog = document.querySelector('.frog-jump-trigger');
        if (frog) {
          frog.classList.remove('frog-jumping');
          void frog.offsetWidth;
          frog.classList.add('frog-jumping');
        }
      }
    }
    children.push(scoreBadge);
    children.push(el('div', { class: 'card' }, [
      el('div', { class: 'section-title' }, [
        el('h3', null, 'Чек-лист 20 балів'),
        el('button', {
          class: 'reset-btn',
          type: 'button',
          onclick: function () {
            localStorage.removeItem(STORAGE_PREFIX + 'basic:checklist20');
            render();
          }
        }, 'Скинути')
      ]),
      makeChecklist(b2.checklist20, 'basic:checklist20', { weighted: true, onChange: updateScore })
    ]));

    setTimeout(updateScore, 0);
    return el('div', null, children);
  }

  // ---------- View: Basic Tactics ----------
  function viewBasicTactics() {
    var t = DATA.basic.tactics;
    var children = [
      backLink(),
      el('h1', null, 'Тактика проходження за 5 хвилин'),
      el('p', { class: 'subtitle' }, 'Розподіл часу і типові помилки. 5 хвилин — це 2 повні цикли по 2 хв + АЗД.')
    ];

    var phaseList = el('ul', { class: 'phase-list' });
    t.timing.forEach(function (p) {
      phaseList.appendChild(el('li', { class: 'phase-item stagger-in' }, [
        el('div', { class: 'phase-range' }, p.range),
        el('div', { class: 'phase-text' }, p.text)
      ]));
    });
    children.push(el('div', { class: 'card' }, [
      el('h3', null, 'Розподіл часу'),
      phaseList
    ]));

    var mistakesUl = el('ul', { class: 'plain-list' });
    t.common_mistakes.forEach(function (m) { mistakesUl.appendChild(el('li', { class: 'stagger-in' }, m)); });
    children.push(el('div', { class: 'block block-warning' }, [
      el('div', { class: 'label' }, 'Найчастіші втрати балів'),
      mistakesUl
    ]));

    var dontsUl = el('ul', { class: 'plain-list' });
    t.donts.forEach(function (d) { dontsUl.appendChild(el('li', { class: 'stagger-in' }, d)); });
    children.push(el('div', { class: 'card' }, [
      el('h3', null, 'Що НЕ робити'),
      dontsUl
    ]));

    return el('div', null, children);
  }

  // ---------- View: Extended (general/scenario/4g4t/antidotes/training) ----------
  function viewExtGeneral() {
    var g = DATA.extended.general;

    var children = [
      backLink(),
      el('h1', null, g.title),
      el('p', { class: 'subtitle' }, 'Послідовність дій до моменту пошуку оборотної причини. Чек-лист — позначки зберігаються локально.')
    ];

    function block(title, items, key) {
      return el('div', { class: 'card' }, [
        el('div', { class: 'section-title' }, [
          el('h3', null, title),
          el('button', {
            class: 'reset-btn',
            type: 'button',
            onclick: function () {
              localStorage.removeItem(STORAGE_PREFIX + key);
              render();
            }
          }, 'Скинути')
        ]),
        makeChecklist(items, key)
      ]);
    }

    children.push(block('Початок', g.intro, 'ext:general:intro'));
    children.push(block('Оцінка стану', g.assessment, 'ext:general:assessment'));
    children.push(block('Виклик допомоги', g.callForHelp, 'ext:general:callForHelp'));
    children.push(block('Компресії', g.compressions, 'ext:general:compressions'));
    children.push(block('Штучна вентиляція', g.ventilation, 'ext:general:ventilation'));
    children.push(block('АЗД (дефібрилятор)', g.aed, 'ext:general:aed'));

    children.push(el('div', { class: 'card', style: 'border-left: 3px solid var(--shockable-stroke);' }, [
      el('h3', null, [g.shockable.title, ' ', el('span', { class: 'badge badge-shockable' }, 'ФШ / ШТ')]),
      makeChecklist(g.shockable.items, 'ext:general:shockable')
    ]));
    children.push(el('div', { class: 'card', style: 'border-left: 3px solid var(--nonshockable-stroke);' }, [
      el('h3', null, [g.nonShockable.title, ' ', el('span', { class: 'badge badge-non-shockable' }, 'Асистолія / БЕА')]),
      makeChecklist(g.nonShockable.items, 'ext:general:nonShockable')
    ]));

    children.push(el('div', { class: 'block block-cause' }, [
      el('div', { class: 'label' }, 'Далі'),
      el('strong', null, g.finalNote),
      ' ',
      el('a', { href: '#4g4t' }, 'Перейти до карти 4Г+4Т →')
    ]));

    return el('div', null, children);
  }

  function viewExtScenario(id) {
    var s = findExtScenario(id);
    if (!s) return view404();

    var children = [
      backLink(),
      el('h1', null, 'Сценарій ' + s.number + '. ' + s.title)
    ];

    children.push(el('div', { class: 'scenario-meta' }, [
      el('span', { class: 'badge badge-' + s.rhythm }, rhythmLabel(s.rhythm) + ' ритм'),
      s.cause4g4t ? el('span', { class: 'meta-item' }, [el('strong', null, '4Г/4Т: '), s.cause4g4t]) : null
    ]));

    children.push(el('div', { class: 'patient-block stagger-in' }, s.patient));
    children.push(el('div', { class: 'block block-cause stagger-in' }, [
      el('div', { class: 'label' }, 'Оборотна причина'),
      el('div', null, s.cause)
    ]));

    if (s.questions && s.questions.length) {
      var qul = el('ul', { class: 'plain-list' });
      s.questions.forEach(function (q) { qul.appendChild(el('li', { class: 'stagger-in' }, q)); });
      children.push(el('div', { class: 'card' }, [el('h3', null, 'Питання, які озвучуємо'), qul]));
    }

    var treatTitle = s.treatmentTitle || 'Усунення оборотної причини';
    children.push(el('div', { class: 'card' }, [
      el('div', { class: 'section-title' }, [
        el('h3', null, treatTitle),
        el('button', {
          class: 'reset-btn',
          type: 'button',
          onclick: function () {
            localStorage.removeItem(STORAGE_PREFIX + 'ext:scenario:' + s.id + ':treatment');
            render();
          }
        }, 'Скинути')
      ]),
      makeChecklist(s.treatment, 'ext:scenario:' + s.id + ':treatment')
    ]));

    if (s.mechanism) {
      children.push(el('div', { class: 'block block-special stagger-in' }, [
        el('h3', null, 'Механізм кардіотоксичності'),
        el('div', null, s.mechanism)
      ]));
    }

    if (s.special) {
      var sul = el('ul', { class: 'plain-list' });
      s.special.items.forEach(function (it) { sul.appendChild(el('li', { class: 'stagger-in' }, it)); });
      children.push(el('div', { class: 'card' }, [el('h3', null, s.special.title), sul]));
    }

    if (s.notes && s.notes.length) {
      var nul = el('ul', { class: 'plain-list' });
      s.notes.forEach(function (n) { nul.appendChild(el('li', { class: 'stagger-in' }, n)); });
      children.push(el('div', { class: 'block stagger-in' }, [el('h3', null, 'Примітки'), nul]));
    }

    if (s.warnings && s.warnings.length) {
      s.warnings.forEach(function (w) {
        children.push(el('div', { class: 'block block-warning stagger-in' }, [
          el('div', { class: 'label' }, 'Увага'),
          el('div', null, w)
        ]));
      });
    }

    var idx = DATA.extended.scenarios.findIndex(function (x) { return x.id === s.id; });
    var nav = el('div', { class: 'training-actions', style: 'margin-top: 24px;' });
    if (idx > 0) {
      nav.appendChild(el('a', { class: 'btn btn-secondary btn-sm', href: '#' + DATA.extended.scenarios[idx - 1].id },
        '← Сц. ' + DATA.extended.scenarios[idx - 1].number));
    }
    if (idx < DATA.extended.scenarios.length - 1) {
      nav.appendChild(el('a', { class: 'btn btn-secondary btn-sm', href: '#' + DATA.extended.scenarios[idx + 1].id },
        'Сц. ' + DATA.extended.scenarios[idx + 1].number + ' →'));
    }
    children.push(nav);

    return el('div', null, children);
  }

  function viewExt4g4t() {
    var c = DATA.extended.causes4g4t;
    var children = [
      backLink(),
      el('h1', null, 'Карта 4Г+4Т'),
      el('p', { class: 'subtitle' }, 'Оборотна причина → сценарій → ключове втручання. Клік по картці — перехід.')
    ];
    function row(section, rhythmClass) {
      var grid = el('div', { class: 'causes-grid' });
      section.items.forEach(function (it) {
        var labels = it.scenarios.map(function (sid) {
          var sc = findExtScenario(sid);
          return sc ? 'Сц. ' + sc.number : sid;
        }).join(', ');
        var firstId = it.scenarios[0];
        grid.appendChild(el('a', { class: 'cause-card stagger-in', href: '#' + firstId }, [
          el('div', { class: 'name' }, it.name),
          el('div', { class: 'scenarios' }, labels),
          el('div', { class: 'treat' }, it.treatment)
        ]));
      });
      return el('div', { class: 'causes-row ' + rhythmClass }, [
        el('div', { class: 'causes-row-title' }, section.title),
        grid
      ]);
    }
    children.push(row(c.metabolic, 'non-shockable'));
    children.push(row(c.mechanical, 'shockable'));
    return el('div', null, children);
  }

  function viewExtAntidotes() {
    var children = [
      backLink(),
      el('h1', null, 'Антидоти'),
      el('p', { class: 'subtitle' }, 'Довідник за класами токсинів.')
    ];
    var table = el('table', { class: 'antidotes-table' });
    table.appendChild(el('thead', null, el('tr', null, [
      el('th', null, 'Токсин'), el('th', null, 'Антидот'), el('th', null, 'Доза / примітка')
    ])));
    var tbody = el('tbody');
    DATA.extended.antidotes.forEach(function (g) {
      tbody.appendChild(el('tr', { class: 'group-row' }, [
        el('td', { colspan: '3' }, g.group)
      ]));
      g.rows.forEach(function (r) {
        tbody.appendChild(el('tr', { class: 'stagger-in' }, [
          el('td', { class: 'toxin' }, r.toxin),
          el('td', { class: 'antidote' }, r.antidote),
          el('td', { class: 'dose' }, r.dose)
        ]));
      });
    });
    table.appendChild(tbody);
    children.push(el('div', { class: 'card' }, table));
    return el('div', null, children);
  }

  var extTrainingState = { currentId: null, revealed: false };
  function viewExtTraining() {
    if (!extTrainingState.currentId) {
      var pool = DATA.extended.scenarios;
      extTrainingState.currentId = pool[Math.floor(Math.random() * pool.length)].id;
      extTrainingState.revealed = false;
    }
    var s = findExtScenario(extTrainingState.currentId);

    var children = [
      backLink(),
      el('h1', null, [
        'Тренування ',
        el('span', { class: 'training-frog frog-jump-trigger', html:
          '<svg viewBox="0 0 32 26" width="28" height="22">' +
          '<ellipse cx="16" cy="18" rx="13" ry="7" fill="currentColor"/>' +
          '<circle cx="9" cy="9" r="5" fill="currentColor"/>' +
          '<circle cx="23" cy="9" r="5" fill="currentColor"/>' +
          '<circle cx="9" cy="9" r="2.5" fill="#fff"/>' +
          '<circle cx="23" cy="9" r="2.5" fill="#fff"/>' +
          '<circle cx="9" cy="10" r="1.2" fill="#1a1a1a"/>' +
          '<circle cx="23" cy="10" r="1.2" fill="#1a1a1a"/>' +
          '<path d="M11 19 Q16 22 21 19" stroke="#1a1a1a" stroke-width="1" fill="none" stroke-linecap="round"/>' +
          '</svg>'
        })
      ]),
      el('p', { class: 'subtitle' }, 'Прочитай умову, озвуч оборотну причину та лікування. Натисни «Перевірити».')
    ];

    var stage = el('div', { class: 'training-stage' });
    stage.appendChild(el('div', { class: 'training-meta' }, 'Випадковий розширений сценарій'));
    stage.appendChild(el('div', { class: 'training-patient' }, s.patient));

    if (s.questions && s.questions.length) {
      var qb = el('div', { style: 'margin-top: 12px;' });
      qb.appendChild(el('div', { class: 'training-meta' }, 'Питання, які можна озвучити:'));
      var ul = el('ul', { class: 'plain-list' });
      s.questions.forEach(function (q) { ul.appendChild(el('li', null, q)); });
      qb.appendChild(ul);
      stage.appendChild(qb);
    }

    var actions = el('div', { class: 'training-actions' });
    actions.appendChild(el('button', {
      class: 'btn',
      type: 'button',
      onclick: function () {
        extTrainingState.revealed = true;
        render();
        setTimeout(function () {
          var frog = document.querySelector('.frog-jump-trigger');
          if (frog) frog.classList.add('frog-jumping');
        }, 50);
      }
    }, 'Перевірити'));
    actions.appendChild(el('button', {
      class: 'btn btn-secondary',
      type: 'button',
      onclick: function () {
        var pool = DATA.extended.scenarios.filter(function (x) { return x.id !== extTrainingState.currentId; });
        extTrainingState.currentId = pool[Math.floor(Math.random() * pool.length)].id;
        extTrainingState.revealed = false;
        render();
      }
    }, 'Інший сценарій'));
    actions.appendChild(el('a', { class: 'btn btn-secondary', href: '#' + s.id }, 'Відкрити сценарій'));
    stage.appendChild(actions);

    var reveal = el('div', { class: 'training-reveal' + (extTrainingState.revealed ? ' is-shown' : '') });
    reveal.appendChild(el('h3', null, 'Сценарій ' + s.number + '. ' + s.title));
    reveal.appendChild(el('p', null, [el('strong', null, 'Оборотна причина: '), s.cause]));
    var trUl = el('ul', { class: 'plain-list' });
    s.treatment.slice(0, 4).forEach(function (t) { trUl.appendChild(el('li', null, t)); });
    reveal.appendChild(trUl);
    if (s.treatment.length > 4) {
      reveal.appendChild(el('p', { class: 'training-meta' }, '… ще ' + (s.treatment.length - 4) + ' пунктів — у повному сценарії.'));
    }
    stage.appendChild(reveal);

    children.push(stage);
    return el('div', null, children);
  }

  function view404() {
    return el('div', null, [
      backLink(),
      el('h1', null, 'Не знайдено'),
      el('p', null, 'Такого маршруту не існує.')
    ]);
  }

  // ---------- Router ----------
  function parseRoute() {
    var hash = (location.hash || '').replace(/^#/, '');
    if (!hash || hash === 'home') return { name: 'home' };
    // Basic
    if (hash === 'basic-checklist') return { name: 'basic-checklist' };
    if (hash === 'basic-script') return { name: 'basic-script' };
    if (hash === 'basic-training') return { name: 'basic-training' };
    if (hash === 'basic-tactics') return { name: 'basic-tactics' };
    if (hash.indexOf('basic-') === 0) return { name: 'basic-scenario', id: hash };
    // Extended
    if (hash === 'general') return { name: 'ext-general' };
    if (hash === '4g4t') return { name: 'ext-4g4t' };
    if (hash === 'antidotes') return { name: 'ext-antidotes' };
    if (hash === 'training') return { name: 'ext-training' };
    if (hash.indexOf('scenario-') === 0) return { name: 'ext-scenario', id: hash };
    return { name: '404' };
  }

  function renderTopnav(route) {
    var nav = document.getElementById('topnav');
    if (!nav) return;
    clear(nav);
    var mode = getMode();
    var links;
    if (mode === 'basic') {
      links = [
        { href: '#', text: 'Головна', match: route.name === 'home' },
        { href: '#basic-checklist', text: 'Чек-лист 20', match: route.name === 'basic-checklist' },
        { href: '#basic-script', text: 'Скрипт', match: route.name === 'basic-script' },
        { href: '#basic-training', text: 'Тренування', match: route.name === 'basic-training' },
        { href: '#basic-tactics', text: 'Тактика', match: route.name === 'basic-tactics' }
      ];
    } else {
      links = [
        { href: '#', text: 'Головна', match: route.name === 'home' },
        { href: '#general', text: 'Загальне', match: route.name === 'ext-general' },
        { href: '#4g4t', text: '4Г+4Т', match: route.name === 'ext-4g4t' },
        { href: '#antidotes', text: 'Антидоти', match: route.name === 'ext-antidotes' },
        { href: '#training', text: 'Тренування', match: route.name === 'ext-training' }
      ];
    }
    links.forEach(function (l) {
      var a = el('a', { href: l.href, class: l.match ? 'is-active' : '' }, l.text);
      nav.appendChild(a);
    });
  }

  function render() {
    var route = parseRoute();
    var mode = getMode();

    // Auto-redirect mode based on hash
    if (route.name === 'basic-scenario' || route.name === 'basic-checklist' ||
        route.name === 'basic-script' || route.name === 'basic-training' ||
        route.name === 'basic-tactics') {
      if (mode !== 'basic') { localStorage.setItem(MODE_KEY, 'basic'); }
    }
    if (route.name === 'ext-general' || route.name === 'ext-4g4t' || route.name === 'ext-antidotes' ||
        route.name === 'ext-training' || route.name === 'ext-scenario') {
      if (mode !== 'extended') { localStorage.setItem(MODE_KEY, 'extended'); }
    }

    clear(app);
    var view;
    switch (route.name) {
      case 'home': view = viewHome(); break;
      case 'basic-scenario': view = viewBasicScenario(route.id); break;
      case 'basic-checklist': view = viewBasicChecklist(); break;
      case 'basic-script': view = viewBasicScript(); break;
      case 'basic-training': view = viewBasicTraining(); break;
      case 'basic-tactics': view = viewBasicTactics(); break;
      case 'ext-general': view = viewExtGeneral(); break;
      case 'ext-scenario': view = viewExtScenario(route.id); break;
      case 'ext-4g4t': view = viewExt4g4t(); break;
      case 'ext-antidotes': view = viewExtAntidotes(); break;
      case 'ext-training': view = viewExtTraining(); break;
      default: view = view404();
    }
    app.appendChild(view);
    window.scrollTo(0, 0);

    renderTopnav(route);
    updateModeButton();

    // Apply stagger delays per page
    applyStagger(app, '.stagger-in', 35);

    // Reset training state when leaving
    if (route.name !== 'ext-training') {
      extTrainingState.currentId = null;
      extTrainingState.revealed = false;
    }
    if (route.name !== 'basic-training') {
      basicTrainingState.scenarioId = null;
    }
  }

  // ---------- Theme ----------
  function applyTheme(theme) {
    if (theme === 'light' || theme === 'dark') {
      document.documentElement.setAttribute('data-theme', theme);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    var btn = document.getElementById('theme-toggle');
    if (btn) {
      var current = theme || 'auto';
      btn.querySelector('.toolbar-btn-label').textContent =
        'Тема: ' + (current === 'auto' ? 'авто' : current === 'light' ? 'світла' : 'темна');
    }
  }
  function initTheme() {
    var saved = localStorage.getItem(THEME_KEY) || 'auto';
    applyTheme(saved === 'auto' ? null : saved);
    var btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.addEventListener('click', function () {
        var current = localStorage.getItem(THEME_KEY) || 'auto';
        var next = current === 'auto' ? 'light' : current === 'light' ? 'dark' : 'auto';
        if (next === 'auto') localStorage.removeItem(THEME_KEY);
        else localStorage.setItem(THEME_KEY, next);
        applyTheme(next === 'auto' ? null : next);
      });
    }
  }

  // ---------- Animations toggle ----------
  function applyAnimations(state) {
    document.documentElement.setAttribute('data-animations', state);
    var btn = document.getElementById('anim-toggle');
    if (btn) {
      btn.querySelector('.toolbar-btn-label').textContent =
        'Анімації: ' + (state === 'auto' ? 'авто' : state === 'on' ? 'вкл' : 'викл');
    }
  }
  function initAnimations() {
    var saved = localStorage.getItem(ANIM_KEY) || 'auto';
    applyAnimations(saved);
    var btn = document.getElementById('anim-toggle');
    if (btn) {
      btn.addEventListener('click', function () {
        var current = localStorage.getItem(ANIM_KEY) || 'auto';
        var next = current === 'auto' ? 'on' : current === 'on' ? 'off' : 'auto';
        localStorage.setItem(ANIM_KEY, next);
        applyAnimations(next);
      });
    }
  }

  // ---------- Mode toggle ----------
  function updateModeButton() {
    var btn = document.getElementById('mode-toggle');
    if (!btn) return;
    var mode = getMode();
    btn.querySelector('.toolbar-btn-label').textContent =
      'Режим: ' + (mode === 'basic' ? 'базовий' : 'розширений');
    btn.classList.toggle('mode-basic', mode === 'basic');
    btn.classList.toggle('mode-extended', mode === 'extended');
  }
  function initMode() {
    if (!localStorage.getItem(MODE_KEY)) localStorage.setItem(MODE_KEY, 'basic');
    var btn = document.getElementById('mode-toggle');
    if (btn) {
      btn.addEventListener('click', function () {
        var m = getMode();
        setMode(m === 'basic' ? 'extended' : 'basic');
        location.hash = '';
      });
    }
  }

  // ---------- Init ----------
  window.addEventListener('hashchange', render);
  function init() {
    initTheme();
    initAnimations();
    initMode();
    render();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
