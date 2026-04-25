/* ОСКІ — реаніматологія: SPA */
(function () {
  'use strict';

  var DATA = window.OSCE_DATA;
  var app = document.getElementById('app');
  var STORAGE_PREFIX = 'osce-checklist:';
  var THEME_KEY = 'osce-theme';

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
        if (typeof c === 'string') node.appendChild(document.createTextNode(c));
        else node.appendChild(c);
      });
    }
    return node;
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function findScenario(id) {
    return DATA.scenarios.find(function (s) { return s.id === id; });
  }

  function rhythmLabel(r) {
    if (r === 'shockable') return 'Дефібриляційний';
    if (r === 'non-shockable') return 'Недефібриляційний';
    if (r === 'mixed') return 'Залежить від ритму';
    return r;
  }

  // ---------- Checklist (with localStorage) ----------
  function makeChecklist(items, storageKey) {
    var ul = el('ul', { class: 'checklist' });
    var saved = {};
    try { saved = JSON.parse(localStorage.getItem(STORAGE_PREFIX + storageKey) || '{}'); } catch (e) {}

    items.forEach(function (text, i) {
      var id = storageKey + ':' + i;
      var checked = !!saved[i];
      var input = el('input', { type: 'checkbox', id: id });
      if (checked) input.checked = true;
      input.addEventListener('change', function () {
        var s = {};
        try { s = JSON.parse(localStorage.getItem(STORAGE_PREFIX + storageKey) || '{}'); } catch (e) {}
        s[i] = input.checked;
        localStorage.setItem(STORAGE_PREFIX + storageKey, JSON.stringify(s));
      });
      var label = el('label', { for: id }, text);
      var li = el('li', null, [input, label]);
      ul.appendChild(li);
    });

    return ul;
  }

  function makeChecklistBlock(title, items, storageKey) {
    var header = el('div', { class: 'section-title' }, [
      el('h3', null, title),
      el('button', {
        class: 'reset-btn',
        type: 'button',
        title: 'Скинути позначки',
        onclick: function () {
          localStorage.removeItem(STORAGE_PREFIX + storageKey);
          render();
        }
      }, 'Скинути')
    ]);
    return el('div', { class: 'card' }, [
      header,
      makeChecklist(items, storageKey)
    ]);
  }

  // ---------- Views ----------
  function viewHome() {
    var hero = el('div', { class: 'home-hero' }, [
      el('div', { class: 'home-hero-text' }, [
        el('h1', null, 'ОСКІ — анестезіологія та реаніматологія'),
        el('p', { class: 'subtitle', style: 'margin: 0;' },
          '10 сценаріїв ALS, карта оборотних причин 4Г+4Т, антидоти та режим тренування. Зроблено для Насті.')
      ]),
      el('div', { class: 'home-hero-frog', html:
        '<svg viewBox="0 0 90 76" width="90" height="76">' +
        '<ellipse cx="45" cy="55" rx="38" ry="20" fill="currentColor"/>' +
        '<ellipse cx="45" cy="60" rx="22" ry="6" fill="rgba(255,255,255,0.20)"/>' +
        '<circle cx="25" cy="22" r="14" fill="currentColor"/>' +
        '<circle cx="65" cy="22" r="14" fill="currentColor"/>' +
        '<circle cx="25" cy="22" r="7" fill="#fff"/>' +
        '<circle cx="65" cy="22" r="7" fill="#fff"/>' +
        '<circle cx="25" cy="24" r="3.4" fill="#1a1a1a"/>' +
        '<circle cx="65" cy="24" r="3.4" fill="#1a1a1a"/>' +
        '<path d="M30 58 Q45 68 60 58" stroke="#1a1a1a" stroke-width="2" fill="none" stroke-linecap="round"/>' +
        '<ellipse cx="32" cy="48" rx="3" ry="2" fill="rgba(255,255,255,0.4)"/>' +
        '</svg>'
      })
    ]);

    var grid = el('div', { class: 'scenario-grid' });
    DATA.scenarios.forEach(function (s) {
      var card = el('a', {
        class: 'scenario-card rhythm-' + s.rhythm,
        href: '#' + s.id
      }, [
        el('div', { class: 'num' }, 'Сценарій ' + s.number),
        el('div', { class: 'title' }, s.title),
        el('div', { class: 'hint' }, s.shortHint || s.cause4g4t)
      ]);
      grid.appendChild(card);
    });

    var quick = el('div', { class: 'quick-grid' }, [
      el('a', { class: 'quick-link', href: '#general' }, [
        el('div', { class: 'ql-title' }, 'Загальне для всіх сценаріїв'),
        el('div', { class: 'ql-desc' }, 'Послідовність дій до пошуку оборотної причини')
      ]),
      el('a', { class: 'quick-link', href: '#4g4t' }, [
        el('div', { class: 'ql-title' }, 'Карта 4Г+4Т'),
        el('div', { class: 'ql-desc' }, 'Оборотні причини → сценарії → ключове втручання')
      ]),
      el('a', { class: 'quick-link', href: '#antidotes' }, [
        el('div', { class: 'ql-title' }, 'Антидоти'),
        el('div', { class: 'ql-desc' }, 'Довідник антидотів за класами токсинів')
      ]),
      el('a', { class: 'quick-link', href: '#training' }, [
        el('div', { class: 'ql-title' }, 'Режим тренування'),
        el('div', { class: 'ql-desc' }, 'Випадковий сценарій — назвати оборотну причину')
      ])
    ]);

    return el('div', null, [
      hero,
      el('div', { class: 'section-title' }, [
        el('h2', null, 'Сценарії'),
        el('span', { class: 'meta' }, DATA.scenarios.length + ' сценаріїв')
      ]),
      grid,
      el('h2', null, 'Швидкі переходи'),
      quick
    ]);
  }

  function viewGeneral() {
    var g = DATA.general;

    var children = [
      el('a', { class: 'back-link', href: '#' }, 'На головну'),
      el('h1', null, g.title),
      el('p', { class: 'subtitle' }, 'Послідовність дій до моменту пошуку оборотної причини. Чек-лист — позначки зберігаються локально.'),
      makeChecklistBlock('Початок', g.intro, 'general:intro'),
      makeChecklistBlock('Оцінка стану', g.assessment, 'general:assessment'),
      makeChecklistBlock('Виклик допомоги', g.callForHelp, 'general:callForHelp'),
      makeChecklistBlock('Компресії', g.compressions, 'general:compressions'),
      makeChecklistBlock('Штучна вентиляція', g.ventilation, 'general:ventilation'),
      makeChecklistBlock('АЗД (дефібрилятор)', g.aed, 'general:aed'),
    ];

    // Розгалуження: shockable / non-shockable
    children.push(el('div', { class: 'card', style: 'border-left: 3px solid var(--shockable-stroke);' }, [
      el('h3', null, [g.shockable.title, ' ',
        el('span', { class: 'badge badge-shockable' }, 'ФШ / ШТ')]),
      makeChecklist(g.shockable.items, 'general:shockable')
    ]));
    children.push(el('div', { class: 'card', style: 'border-left: 3px solid var(--nonshockable-stroke);' }, [
      el('h3', null, [g.nonShockable.title, ' ',
        el('span', { class: 'badge badge-non-shockable' }, 'Асистолія / БЕА')]),
      makeChecklist(g.nonShockable.items, 'general:nonShockable')
    ]));

    children.push(el('div', { class: 'block block-cause' }, [
      el('div', { class: 'label' }, 'Далі'),
      el('strong', null, g.finalNote),
      ' ',
      el('a', { href: '#4g4t' }, 'Перейти до карти 4Г+4Т →')
    ]));

    return el('div', null, children);
  }

  function viewScenario(id) {
    var s = findScenario(id);
    if (!s) return view404();

    var children = [
      el('a', { class: 'back-link', href: '#' }, 'На головну'),
      el('h1', null, 'Сценарій ' + s.number + '. ' + s.title),
    ];

    // Meta: ритм
    var meta = el('div', { class: 'scenario-meta' }, [
      el('span', { class: 'badge badge-' + s.rhythm }, rhythmLabel(s.rhythm) + ' ритм'),
      s.cause4g4t ? el('span', { class: 'meta-item' }, [
        el('strong', null, '4Г/4Т: '), s.cause4g4t
      ]) : null
    ]);
    children.push(meta);

    // Patient
    children.push(el('div', { class: 'patient-block' }, s.patient));

    // Cause
    children.push(el('div', { class: 'block block-cause' }, [
      el('div', { class: 'label' }, 'Оборотна причина'),
      el('div', null, s.cause)
    ]));

    // Questions (if any)
    if (s.questions && s.questions.length) {
      children.push(el('div', { class: 'card' }, [
        el('h3', null, 'Питання, які озвучуємо'),
        (function () {
          var ul = el('ul', { class: 'plain-list' });
          s.questions.forEach(function (q) { ul.appendChild(el('li', null, q)); });
          return ul;
        })()
      ]));
    }

    // Treatment (checklist)
    var treatTitle = s.treatmentTitle || 'Усунення оборотної причини';
    children.push(makeChecklistBlock(treatTitle, s.treatment, 'scenario:' + s.id + ':treatment'));

    // Mechanism (9.2)
    if (s.mechanism) {
      children.push(el('div', { class: 'block block-special' }, [
        el('h3', null, 'Механізм кардіотоксичності'),
        el('div', null, s.mechanism)
      ]));
    }

    // Special (3)
    if (s.special) {
      children.push(el('div', { class: 'card' }, [
        el('h3', null, s.special.title),
        (function () {
          var ul = el('ul', { class: 'plain-list' });
          s.special.items.forEach(function (it) { ul.appendChild(el('li', null, it)); });
          return ul;
        })()
      ]));
    }

    // Notes
    if (s.notes && s.notes.length) {
      var notesUl = el('ul', { class: 'plain-list' });
      s.notes.forEach(function (n) { notesUl.appendChild(el('li', null, n)); });
      children.push(el('div', { class: 'block' }, [
        el('h3', null, 'Примітки'),
        notesUl
      ]));
    }

    // Warnings
    if (s.warnings && s.warnings.length) {
      s.warnings.forEach(function (w) {
        children.push(el('div', { class: 'block block-warning' }, [
          el('div', { class: 'label' }, 'Увага'),
          el('div', null, w)
        ]));
      });
    }

    // Navigation: prev/next
    var idx = DATA.scenarios.findIndex(function (x) { return x.id === s.id; });
    var nav = el('div', { class: 'training-actions', style: 'margin-top: 24px;' });
    if (idx > 0) {
      nav.appendChild(el('a', { class: 'btn btn-secondary', href: '#' + DATA.scenarios[idx - 1].id },
        '← Сценарій ' + DATA.scenarios[idx - 1].number));
    }
    if (idx < DATA.scenarios.length - 1) {
      nav.appendChild(el('a', { class: 'btn btn-secondary', href: '#' + DATA.scenarios[idx + 1].id },
        'Сценарій ' + DATA.scenarios[idx + 1].number + ' →'));
    }
    children.push(nav);

    return el('div', null, children);
  }

  function view4g4t() {
    var c = DATA.causes4g4t;
    var children = [
      el('a', { class: 'back-link', href: '#' }, 'На головну'),
      el('h1', null, 'Карта 4Г+4Т'),
      el('p', { class: 'subtitle' }, 'Оборотна причина → сценарій → ключове втручання. Клік по картці — перехід до сценарію.')
    ];

    function makeRow(section, rhythmClass) {
      var grid = el('div', { class: 'causes-grid' });
      section.items.forEach(function (it) {
        var scenLabels = it.scenarios.map(function (sid) {
          var sc = findScenario(sid);
          return sc ? 'Сц. ' + sc.number : sid;
        }).join(', ');
        var firstId = it.scenarios[0];
        var card = el('a', {
          class: 'cause-card',
          href: '#' + firstId
        }, [
          el('div', { class: 'name' }, it.name),
          el('div', { class: 'scenarios' }, scenLabels),
          el('div', { class: 'treat' }, it.treatment)
        ]);
        grid.appendChild(card);
      });
      return el('div', { class: 'causes-row ' + rhythmClass }, [
        el('div', { class: 'causes-row-title' }, section.title),
        grid
      ]);
    }

    children.push(makeRow(c.metabolic, 'non-shockable'));
    children.push(makeRow(c.mechanical, 'shockable'));

    return el('div', null, children);
  }

  function viewAntidotes() {
    var children = [
      el('a', { class: 'back-link', href: '#' }, 'На головну'),
      el('h1', null, 'Антидоти'),
      el('p', { class: 'subtitle' }, 'Довідник антидотів за класами токсинів. Фокус — сценарії 9.1 та 9.2 і додаткові питання.')
    ];

    var table = el('table', { class: 'antidotes-table' });
    var thead = el('thead', null, el('tr', null, [
      el('th', null, 'Токсин'),
      el('th', null, 'Антидот'),
      el('th', null, 'Доза / примітка')
    ]));
    var tbody = el('tbody');
    DATA.antidotes.forEach(function (group) {
      tbody.appendChild(el('tr', { class: 'group-row' }, [
        el('td', { colspan: '3' }, group.group)
      ]));
      group.rows.forEach(function (r) {
        tbody.appendChild(el('tr', null, [
          el('td', { class: 'toxin' }, r.toxin),
          el('td', { class: 'antidote' }, r.antidote),
          el('td', { class: 'dose' }, r.dose)
        ]));
      });
    });
    table.appendChild(thead);
    table.appendChild(tbody);
    children.push(el('div', { class: 'card' }, table));
    return el('div', null, children);
  }

  // Training mode
  var trainingState = {
    currentId: null,
    revealed: false
  };

  function pickRandomScenario(excludeId) {
    var pool = DATA.scenarios.filter(function (s) { return s.id !== excludeId; });
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function viewTraining() {
    if (!trainingState.currentId) {
      trainingState.currentId = pickRandomScenario().id;
      trainingState.revealed = false;
    }
    var s = findScenario(trainingState.currentId);

    var children = [
      el('a', { class: 'back-link', href: '#' }, 'На головну'),
      el('h1', null, [
        'Тренування',
        el('span', { class: 'training-frog', html:
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
        'Прочитай умову. Озвуч (вголос або подумки) оборотну причину та ключове лікування. Натисни «Перевірити» для звірки.')
    ];

    var stage = el('div', { class: 'training-stage' });
    stage.appendChild(el('div', { class: 'training-meta' }, 'Випадковий сценарій'));
    stage.appendChild(el('div', { class: 'training-patient' }, s.patient));

    if (s.questions && s.questions.length) {
      var qBlock = el('div', { style: 'margin-top: 12px;' });
      qBlock.appendChild(el('div', { class: 'training-meta' }, 'Питання, які можна озвучити:'));
      var ul = el('ul', { class: 'plain-list' });
      s.questions.forEach(function (q) { ul.appendChild(el('li', null, q)); });
      qBlock.appendChild(ul);
      stage.appendChild(qBlock);
    }

    var actions = el('div', { class: 'training-actions' });
    actions.appendChild(el('button', {
      class: 'btn',
      type: 'button',
      onclick: function () {
        trainingState.revealed = true;
        render();
      }
    }, 'Перевірити'));
    actions.appendChild(el('button', {
      class: 'btn btn-secondary',
      type: 'button',
      onclick: function () {
        trainingState.currentId = pickRandomScenario(trainingState.currentId).id;
        trainingState.revealed = false;
        render();
      }
    }, 'Інший сценарій'));
    actions.appendChild(el('a', {
      class: 'btn btn-secondary',
      href: '#' + s.id
    }, 'Відкрити повний сценарій'));
    stage.appendChild(actions);

    var reveal = el('div', { class: 'training-reveal' + (trainingState.revealed ? ' is-shown' : '') });
    reveal.appendChild(el('h3', null, 'Сценарій ' + s.number + '. ' + s.title));
    reveal.appendChild(el('p', null, [
      el('strong', null, 'Оборотна причина: '), s.cause
    ]));
    var trUl = el('ul', { class: 'plain-list' });
    s.treatment.slice(0, 4).forEach(function (t) { trUl.appendChild(el('li', null, t)); });
    reveal.appendChild(trUl);
    if (s.treatment.length > 4) {
      reveal.appendChild(el('p', { class: 'training-meta' },
        '… ще ' + (s.treatment.length - 4) + ' пунктів — у повному сценарії.'));
    }
    stage.appendChild(reveal);

    children.push(stage);
    return el('div', null, children);
  }

  function view404() {
    return el('div', null, [
      el('a', { class: 'back-link', href: '#' }, 'На головну'),
      el('h1', null, 'Не знайдено'),
      el('p', null, 'Такого маршруту не існує.')
    ]);
  }

  // ---------- Router ----------
  function parseRoute() {
    var hash = (location.hash || '').replace(/^#/, '');
    if (!hash || hash === 'home') return { name: 'home' };
    if (hash === 'general') return { name: 'general' };
    if (hash === '4g4t') return { name: '4g4t' };
    if (hash === 'antidotes') return { name: 'antidotes' };
    if (hash === 'training') return { name: 'training' };
    if (hash.indexOf('scenario-') === 0) return { name: 'scenario', id: hash };
    return { name: '404' };
  }

  function render() {
    var route = parseRoute();
    clear(app);

    var view;
    switch (route.name) {
      case 'home': view = viewHome(); break;
      case 'general': view = viewGeneral(); break;
      case '4g4t': view = view4g4t(); break;
      case 'antidotes': view = viewAntidotes(); break;
      case 'training':
        if (!route.training_init) { /* keep state across re-renders */ }
        view = viewTraining(); break;
      case 'scenario': view = viewScenario(route.id); break;
      default: view = view404();
    }
    app.appendChild(view);
    window.scrollTo(0, 0);

    // Update active nav state
    var navLinks = document.querySelectorAll('.topnav a');
    navLinks.forEach(function (a) {
      var r = a.getAttribute('data-route');
      var match = (
        (route.name === 'home' && r === '') ||
        (route.name === 'general' && r === 'general') ||
        (route.name === '4g4t' && r === '4g4t') ||
        (route.name === 'antidotes' && r === 'antidotes') ||
        (route.name === 'training' && r === 'training')
      );
      a.classList.toggle('is-active', match);
    });

    // Reset training state if leaving training
    if (route.name !== 'training') {
      trainingState.currentId = null;
      trainingState.revealed = false;
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
      var next = current === 'auto' ? 'світла' : current === 'light' ? 'темна' : 'авто';
      btn.querySelector('.theme-toggle-label').textContent = 'Тема: ' + (current === 'auto' ? 'авто' : current === 'light' ? 'світла' : 'темна');
      btn.title = 'Перемкнути на ' + next;
    }
  }

  function initTheme() {
    var saved = localStorage.getItem(THEME_KEY) || 'auto';
    applyTheme(saved);
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

  // ---------- Init ----------
  window.addEventListener('hashchange', render);
  document.addEventListener('DOMContentLoaded', function () {
    initTheme();
    render();
  });

  if (document.readyState === 'loading') {
    // wait
  } else {
    initTheme();
    render();
  }
})();
