/* ==========================================================================
   Luau Academy — client app
   Progress, XP, quizzes, challenges, search, playground runner, certificate.
   Everything is stored locally in the browser (localStorage).
   ========================================================================== */
(function () {
  'use strict';

  var doc = document;
  var body = doc.body;
  var ROOT = body.getAttribute('data-root') || './';
  var COURSE = window.COURSE || {
    modules: [],
    parts: [],
    ranks: [{ name: 'Newcomer', min: 0 }],
    xp: { quiz: 10, predict: 15, module: 50 },
    maxXp: 1,
  };
  var KEY = 'luau-academy:progress:v1';
  var THEME_KEY = 'la-theme';

  var SVG = function (paths) {
    return (
      '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      paths +
      '</svg>'
    );
  };
  var ICONS = {
    zap: SVG('<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>'),
    award: SVG('<circle cx="12" cy="8" r="6"/><path d="M15.5 13 17 22l-5-3-5 3 1.5-9"/>'),
    check: SVG('<path d="M20 6 9 17l-5-5"/>'),
    copy: SVG('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
    play: SVG('<path d="m6 3 14 9-14 9z"/>'),
    close: SVG('<path d="M18 6 6 18M6 6l12 12"/>'),
    trophy: SVG('<path d="M8 21h8M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>'),
    lock: SVG('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'),
    external: SVG('<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>'),
    printer: SVG('<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>'),
    download: SVG('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>'),
    upload: SVG('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>'),
    trash: SVG('<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>'),
  };
  var LOGO =
    '<svg class="cert-logo" viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="clg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5b7cff"/><stop offset=".55" stop-color="#8b5cf6"/><stop offset="1" stop-color="#d16bff"/></linearGradient><mask id="clm"><rect width="32" height="32" fill="#fff"/><circle cx="19.5" cy="12.5" r="7" fill="#000"/></mask></defs><rect x="1" y="1" width="30" height="30" rx="9" fill="url(#clg)"/><circle cx="15" cy="17" r="8.5" fill="#fff" mask="url(#clm)"/><circle cx="23.5" cy="8.5" r="2.3" fill="#fff"/></svg>';

  /* ------------------------------------------------------------------ */
  /* State                                                              */
  /* ------------------------------------------------------------------ */

  function blank() {
    return { modules: {}, quiz: {}, predict: {}, challenges: {}, last: null, name: '' };
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return blank();
      var parsed = JSON.parse(raw);
      var s = blank();
      for (var k in s) if (parsed && parsed[k] !== undefined) s[k] = parsed[k];
      return s;
    } catch (e) {
      return blank();
    }
  }

  var state = load();

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      /* storage unavailable (private mode) — progress lasts for this page only */
    }
  }

  var modById = {};
  var chXp = {};
  var validQuiz = {};
  var validPredict = {};
  COURSE.modules.forEach(function (m) {
    modById[m.id] = m;
    m.challenges.forEach(function (c) {
      chXp[c.id] = c.xp;
    });
    m.quiz.forEach(function (q) {
      validQuiz[q] = true;
    });
    m.predict.forEach(function (p) {
      validPredict[p] = true;
    });
  });

  function computeXp() {
    var xp = 0;
    var id;
    for (id in state.modules) if (state.modules[id] && modById[id]) xp += COURSE.xp.module;
    for (id in state.quiz) if (state.quiz[id] === 'first' && validQuiz[id]) xp += COURSE.xp.quiz;
    for (id in state.predict) if (state.predict[id] === 'solved' && validPredict[id]) xp += COURSE.xp.predict;
    for (id in state.challenges) if (state.challenges[id] && chXp[id]) xp += chXp[id];
    return xp;
  }

  function rankFor(xp) {
    var ranks = COURSE.ranks;
    var idx = 0;
    for (var i = 0; i < ranks.length; i++) if (xp >= ranks[i].min) idx = i;
    return { rank: ranks[idx], next: ranks[idx + 1] || null, index: idx };
  }

  function modProgress(m) {
    var total = m.quiz.length + m.predict.length + m.challenges.length + 1;
    var done = 0;
    m.quiz.forEach(function (q) {
      if (state.quiz[q]) done++;
    });
    m.predict.forEach(function (p) {
      if (state.predict[p]) done++;
    });
    m.challenges.forEach(function (c) {
      if (state.challenges[c.id]) done++;
    });
    var complete = !!state.modules[m.id];
    if (complete) done++;
    return { done: done, total: total, pct: Math.round((done / total) * 100), complete: complete };
  }

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function fmt(n) {
    return Number(n).toLocaleString();
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* Apply a change, persist it, refresh the UI and celebrate XP gains. */
  function commit(change, gain) {
    var beforeXp = computeXp();
    var beforeRank = rankFor(beforeXp).rank.name;
    change();
    save();
    var afterXp = computeXp();
    var after = rankFor(afterXp);
    updateUI();
    if (afterXp > beforeXp && gain) toast('+' + (afterXp - beforeXp) + ' XP', gain, 'zap');
    if (after.rank.name !== beforeRank && afterXp > beforeXp) {
      setTimeout(function () {
        toast('Rank up!', "You're now a " + after.rank.name, 'rank');
        confetti();
      }, 500);
    }
  }

  /* ------------------------------------------------------------------ */
  /* UI refresh                                                         */
  /* ------------------------------------------------------------------ */

  function setAll(sel, fn) {
    var list = doc.querySelectorAll(sel);
    for (var i = 0; i < list.length; i++) fn(list[i]);
  }

  function updateUI() {
    var xp = computeXp();
    var r = rankFor(xp);
    var toNext = r.next ? Math.min(100, ((xp - r.rank.min) / Math.max(1, r.next.min - r.rank.min)) * 100) : 100;

    setAll('[data-xp-total]', function (el) {
      el.textContent = fmt(xp);
    });
    setAll('[data-xp-rank]', function (el) {
      el.textContent = r.rank.name;
    });
    setAll('[data-xp-bar]', function (el) {
      el.style.width = toNext + '%';
    });

    var completed = COURSE.modules.filter(function (m) {
      return state.modules[m.id];
    }).length;
    var coursePct = COURSE.modules.length ? Math.round((completed / COURSE.modules.length) * 100) : 0;
    setAll('[data-course-pct]', function (el) {
      el.textContent = coursePct + '% · ' + completed + '/' + COURSE.modules.length + ' modules';
    });
    setAll('[data-course-bar]', function (el) {
      el.style.width = coursePct + '%';
    });

    // Sidebar
    setAll('.sb-link[data-mod]', function (a) {
      var m = modById[a.getAttribute('data-mod')];
      if (!m) return;
      var p = modProgress(m);
      a.classList.toggle('is-done', p.complete);
      a.classList.toggle('is-started', !p.complete && p.done > 0);
      a.style.setProperty('--p', p.pct + '%');
      a.title = p.complete ? 'Completed' : p.done ? p.pct + '% complete' : 'Not started';
    });

    // Module cards (home)
    setAll('[data-mod-card]', function (card) {
      var m = modById[card.getAttribute('data-mod-card')];
      if (!m) return;
      var p = modProgress(m);
      card.classList.toggle('is-done', p.complete);
      card.classList.toggle('is-started', !p.complete && p.done > 0);
      var st = card.querySelector('[data-mod-status]');
      if (st) st.innerHTML = p.complete ? ICONS.check + 'Completed' : p.done ? p.pct + '% done' : '';
      var bar = card.querySelector('[data-mod-card-bar]');
      if (bar) bar.style.width = (p.complete ? 100 : p.pct) + '%';
    });

    // Part progress (home)
    setAll('[data-part-progress]', function (el) {
      var n = +el.getAttribute('data-part-progress');
      var mods = COURSE.modules.filter(function (m) {
        return m.part === n;
      });
      var done = mods.filter(function (m) {
        return state.modules[m.id];
      }).length;
      el.textContent = done + ' / ' + mods.length + ' complete';
    });

    // Current module page
    var lesson = doc.querySelector('[data-module]');
    if (lesson) {
      var m = modById[lesson.getAttribute('data-module')];
      if (m) {
        var p = modProgress(m);
        setAll('[data-mod-bar]', function (el) {
          el.style.width = (p.complete ? 100 : p.pct) + '%';
        });
        setAll('[data-mod-pct]', function (el) {
          el.textContent = p.complete ? 'Module complete' : p.pct + '% complete · ' + p.done + '/' + p.total + ' activities';
        });
        var finish = doc.querySelector('[data-finish]');
        if (finish) {
          finish.classList.toggle('is-done', p.complete);
          var t = finish.querySelector('[data-finish-title]');
          var sub = finish.querySelector('[data-finish-sub]');
          var btn = finish.querySelector('[data-complete]');
          var idx = COURSE.modules.indexOf(m);
          var next = COURSE.modules[idx + 1];
          if (p.complete) {
            t.textContent = 'Module complete — nice work!';
            sub.innerHTML = next
              ? 'Up next: <a href="' + ROOT + 'learn/' + next.id + '/">' + pad2(next.num) + ' · ' + escapeHtml(next.title) + '</a>'
              : 'That was the final module. <a href="' + ROOT + 'progress/#certificate">Claim your certificate →</a>';
            btn.querySelector('span').textContent = 'Completed · undo';
          } else {
            t.textContent = 'Finished this module?';
            sub.innerHTML = 'Mark it complete to earn <strong>+' + COURSE.xp.module + ' XP</strong> and move closer to your certificate.';
            btn.querySelector('span').textContent = 'Mark module complete';
          }
        }
      }
    }

    updateContinue();
    renderProgressPage();
  }

  function updateContinue() {
    var any =
      Object.keys(state.modules).length ||
      Object.keys(state.quiz).length ||
      Object.keys(state.challenges).length ||
      Object.keys(state.predict).length;
    if (!any && !state.last) return;
    var last = state.last && modById[state.last];
    var target =
      last && !state.modules[last.id]
        ? last
        : COURSE.modules.filter(function (m) {
            return !state.modules[m.id];
          })[0];
    setAll('[data-continue]', function (a) {
      var label = a.querySelector('[data-continue-label]');
      if (!target) {
        a.href = ROOT + 'progress/#certificate';
        if (label) label.textContent = 'Claim your certificate';
      } else {
        a.href = ROOT + 'learn/' + target.id + '/';
        if (label) label.textContent = 'Continue: ' + pad2(target.num) + ' · ' + target.title;
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Toasts & confetti                                                  */
  /* ------------------------------------------------------------------ */

  function toast(title, sub, kind) {
    var stack = doc.querySelector('[data-toasts]');
    if (!stack) return;
    var el = doc.createElement('div');
    el.className = 'toast';
    el.innerHTML =
      '<span class="toast-icon' + (kind === 'rank' ? ' rank' : '') + '">' + (kind === 'rank' ? ICONS.award : kind === 'check' ? ICONS.check : ICONS.zap) + '</span><div><b></b><small></small></div>';
    el.querySelector('b').textContent = title;
    el.querySelector('small').textContent = sub || '';
    stack.appendChild(el);
    setTimeout(function () {
      el.classList.add('out');
      setTimeout(function () {
        el.remove();
      }, 320);
    }, 3400);
  }

  function confetti() {
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var c = doc.createElement('canvas');
    c.className = 'confetti';
    body.appendChild(c);
    var ctx = c.getContext('2d');
    var dpr = window.devicePixelRatio || 1;
    var W = window.innerWidth;
    var H = window.innerHeight;
    c.width = W * dpr;
    c.height = H * dpr;
    ctx.scale(dpr, dpr);
    var colors = ['#5b7cff', '#8b5cf6', '#d16bff', '#34d399', '#fbbf24', '#38bdf8', '#f472b6'];
    var parts = [];
    for (var i = 0; i < 150; i++) {
      parts.push({
        x: W / 2 + (Math.random() - 0.5) * W * 0.35,
        y: H * 0.38,
        vx: (Math.random() - 0.5) * 15,
        vy: -Math.random() * 15 - 4,
        s: 5 + Math.random() * 5,
        r: Math.random() * 6.28,
        vr: (Math.random() - 0.5) * 0.35,
        c: colors[(Math.random() * colors.length) | 0],
      });
    }
    var start = performance.now();
    function frame(t) {
      var el = t - start;
      ctx.clearRect(0, 0, W, H);
      for (var k = 0; k < parts.length; k++) {
        var p = parts[k];
        p.vy += 0.38;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.globalAlpha = Math.max(0, 1 - el / 2800);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * 0.66);
        ctx.restore();
      }
      if (el < 2800) requestAnimationFrame(frame);
      else c.remove();
    }
    requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------------ */
  /* Theme & navigation                                                 */
  /* ------------------------------------------------------------------ */

  function currentTheme() {
    var a = doc.documentElement.getAttribute('data-theme');
    if (a) return a;
    return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  setAll('[data-theme-toggle]', function (btn) {
    btn.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      doc.documentElement.setAttribute('data-theme', next);
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch (e) {}
    });
  });

  setAll('[data-nav-toggle]', function (btn) {
    btn.addEventListener('click', function () {
      body.classList.add('nav-open');
    });
  });
  setAll('[data-nav-close]', function (btn) {
    btn.addEventListener('click', function () {
      body.classList.remove('nav-open');
    });
  });

  // Keep the current module visible in the sidebar
  (function () {
    var sb = doc.querySelector('.sb-scroll');
    var active = sb && sb.querySelector('.sb-link.active');
    if (sb && active) {
      sb.scrollTop += active.getBoundingClientRect().top - sb.getBoundingClientRect().top - sb.clientHeight / 2 + 20;
    }
  })();

  /* ------------------------------------------------------------------ */
  /* Code blocks: copy & run                                            */
  /* ------------------------------------------------------------------ */

  function codeText(fig) {
    var lines = fig.querySelectorAll('.ln');
    var out = [];
    for (var i = 0; i < lines.length; i++) out.push(lines[i].textContent);
    return out.join('\n');
  }

  function playUrl(code) {
    if (!window.LZString) return 'https://play.luau.org/';
    return 'https://play.luau.org/#' + LZString.compressToEncodedURIComponent(JSON.stringify({ v: 2, c: code }));
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = doc.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      body.appendChild(ta);
      ta.select();
      try {
        doc.execCommand('copy') ? resolve() : reject();
      } catch (e) {
        reject(e);
      }
      ta.remove();
    });
  }

  doc.addEventListener('click', function (e) {
    var copyBtn = e.target.closest('[data-copy]');
    if (copyBtn) {
      var fig = copyBtn.closest('.code');
      copyText(codeText(fig)).then(function () {
        copyBtn.classList.add('copied');
        copyBtn.querySelector('span').textContent = 'Copied';
        setTimeout(function () {
          copyBtn.classList.remove('copied');
          copyBtn.querySelector('span').textContent = 'Copy';
        }, 1600);
      });
      return;
    }

    var runBtn = e.target.closest('[data-run]');
    if (runBtn) {
      var f = runBtn.closest('.code');
      var existing = f.nextElementSibling;
      if (existing && existing.classList.contains('runner')) {
        existing.remove();
        f.classList.remove('has-runner');
        runBtn.querySelector('span').textContent = 'Run';
        return;
      }
      var url = playUrl(codeText(f));
      var runner = doc.createElement('div');
      runner.className = 'runner';
      runner.innerHTML =
        '<iframe title="Luau Playground" allow="clipboard-write"></iframe><div class="runner-foot"><span>Click <b>Run</b> in the playground to execute. Edit freely — experiments are encouraged.</span><a target="_blank" rel="noopener">Open in new tab ' +
        ICONS.external +
        '</a></div>';
      runner.querySelector('iframe').src = url;
      runner.querySelector('a').href = url;
      f.parentNode.insertBefore(runner, f.nextSibling);
      f.classList.add('has-runner');
      runBtn.querySelector('span').textContent = 'Close';
      return;
    }

    var searchOpen = e.target.closest('[data-search-open]');
    if (searchOpen) {
      e.preventDefault();
      openSearch();
    }
  });

  /* ------------------------------------------------------------------ */
  /* Quizzes                                                            */
  /* ------------------------------------------------------------------ */

  function updateQuizScore(quiz) {
    var qs = quiz.querySelectorAll('.quiz-q');
    var answered = 0;
    var first = 0;
    for (var i = 0; i < qs.length; i++) {
      var s = state.quiz[qs[i].getAttribute('data-qid')];
      if (s) answered++;
      if (s === 'first') first++;
    }
    var el = quiz.querySelector('[data-quiz-score]');
    if (!el) return;
    if (!answered) el.textContent = qs.length + ' questions';
    else if (answered < qs.length) el.textContent = answered + ' / ' + qs.length + ' answered';
    else el.textContent = first + ' / ' + qs.length + ' first try';
    el.classList.toggle('perfect', answered === qs.length && first === qs.length);
  }

  setAll('.quiz', function (quiz) {
    var qs = quiz.querySelectorAll('.quiz-q');
    Array.prototype.forEach.call(qs, function (q) {
      var id = q.getAttribute('data-qid');
      var ans = +q.getAttribute('data-answer');
      var opts = q.querySelectorAll('.quiz-opt');
      var fb = q.querySelector('.quiz-feedback');
      var verdict = q.querySelector('.quiz-verdict');
      var wrong = 0;

      function finish(kind) {
        q.classList.add('answered');
        Array.prototype.forEach.call(opts, function (o, i) {
          o.disabled = true;
          if (i === ans) o.classList.add('correct');
        });
        fb.hidden = false;
        if (kind === 'first') {
          verdict.textContent = 'Correct!';
          verdict.className = 'quiz-verdict ok';
        } else if (kind === 'retry') {
          verdict.textContent = 'Got there — here is why:';
          verdict.className = 'quiz-verdict meh';
        } else {
          verdict.textContent = 'The answer is ' + 'ABCDEF'[ans] + ':';
          verdict.className = 'quiz-verdict meh';
        }
      }

      if (state.quiz[id]) finish(state.quiz[id] === 'first' ? 'first' : 'retry');

      Array.prototype.forEach.call(opts, function (o, i) {
        o.addEventListener('click', function () {
          if (q.classList.contains('answered')) return;
          if (i === ans) {
            var first = wrong === 0;
            commit(function () {
              state.quiz[id] = first ? 'first' : 'retry';
            }, first ? 'Correct on the first try' : null);
            finish(first ? 'first' : 'retry');
          } else {
            wrong++;
            o.classList.add('wrong', 'shake');
            o.disabled = true;
            if (wrong >= 2) {
              commit(function () {
                state.quiz[id] = 'retry';
              });
              finish('reveal');
            }
          }
          updateQuizScore(quiz);
        });
      });
    });
    updateQuizScore(quiz);
  });

  /* ------------------------------------------------------------------ */
  /* Predict the output                                                 */
  /* ------------------------------------------------------------------ */

  function normOut(s) {
    return String(s)
      .replace(/\r/g, '')
      .split('\n')
      .map(function (l) {
        return l.trim().replace(/["'`]/g, '').replace(/\s+/g, ' ').toLowerCase();
      })
      .filter(Boolean)
      .join('\n');
  }

  setAll('.predict', function (el) {
    var id = el.getAttribute('data-pid');
    var answer = [];
    try {
      answer = JSON.parse(el.getAttribute('data-answer'));
    } catch (e) {}
    var expected = normOut(answer.join('\n'));
    var input = el.querySelector('.pr-input');
    var result = el.querySelector('.pr-result');
    var explain = el.querySelector('.pr-explain');
    var tries = 0;

    function show(kind) {
      explain.hidden = false;
      if (kind === 'solved') {
        el.classList.add('is-solved');
        result.hidden = false;
        result.className = 'pr-result ok';
        result.textContent = 'Spot on — that is exactly what Luau prints.';
        input.value = answer.join('\n');
        input.disabled = true;
      } else {
        input.disabled = true;
        result.hidden = true;
      }
      el.querySelector('[data-check]').disabled = true;
      el.querySelector('[data-reveal]').disabled = true;
    }

    if (state.predict[id]) show(state.predict[id]);

    function check() {
      if (input.disabled) return;
      if (!input.value.trim()) {
        input.focus();
        return;
      }
      if (normOut(input.value) === expected) {
        commit(function () {
          state.predict[id] = 'solved';
        }, 'Output predicted correctly');
        show('solved');
      } else {
        tries++;
        result.hidden = false;
        result.className = 'pr-result bad';
        result.textContent =
          tries < 2
            ? 'Not quite. Trace the code line by line and try again.'
            : 'Still not it. Check each printed line carefully — or reveal the answer to learn why.';
        input.classList.remove('shake');
        void input.offsetWidth;
        input.classList.add('shake');
      }
    }

    el.querySelector('[data-check]').addEventListener('click', check);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (input.tagName === 'INPUT' || e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        check();
      }
    });
    el.querySelector('[data-reveal]').addEventListener('click', function () {
      commit(function () {
        if (state.predict[id] !== 'solved') state.predict[id] = 'revealed';
      });
      show('revealed');
    });
  });

  /* ------------------------------------------------------------------ */
  /* Challenges                                                         */
  /* ------------------------------------------------------------------ */

  setAll('.challenge', function (ch) {
    var id = ch.getAttribute('data-cid');
    var hints = ch.querySelectorAll('.ch-hint');
    Array.prototype.forEach.call(hints, function (h, i) {
      h.addEventListener('toggle', function () {
        if (h.open && hints[i + 1]) hints[i + 1].removeAttribute('data-locked');
      });
    });

    var btn = ch.querySelector('[data-solve]');
    function render() {
      var solved = !!state.challenges[id];
      ch.classList.toggle('is-solved', solved);
      btn.classList.toggle('solved', solved);
      btn.querySelector('span').textContent = solved ? 'Solved' : 'Mark as solved';
      btn.setAttribute('aria-pressed', solved ? 'true' : 'false');
    }
    render();
    btn.addEventListener('click', function () {
      var solved = !!state.challenges[id];
      commit(function () {
        if (solved) delete state.challenges[id];
        else state.challenges[id] = true;
      }, solved ? null : 'Challenge solved');
      render();
    });
  });

  /* ------------------------------------------------------------------ */
  /* Module completion                                                  */
  /* ------------------------------------------------------------------ */

  setAll('[data-complete]', function (btn) {
    var id = btn.getAttribute('data-complete');
    btn.addEventListener('click', function () {
      var done = !!state.modules[id];
      commit(function () {
        if (done) delete state.modules[id];
        else state.modules[id] = Date.now();
      }, done ? null : 'Module complete');
      if (!done) confetti();
    });
  });

  (function rememberLastModule() {
    var lesson = doc.querySelector('[data-module]');
    if (lesson) {
      state.last = lesson.getAttribute('data-module');
      save();
    }
  })();

  /* ------------------------------------------------------------------ */
  /* Table of contents scrollspy                                        */
  /* ------------------------------------------------------------------ */

  (function () {
    var links = doc.querySelectorAll('[data-toc-link]');
    if (!links.length) return;
    var heads = [];
    var map = {};
    Array.prototype.forEach.call(links, function (a) {
      var id = decodeURIComponent(a.getAttribute('href').slice(1));
      var h = doc.getElementById(id);
      if (h) {
        heads.push(h);
        map[id] = a;
      }
    });
    var ticking = false;
    function spy() {
      ticking = false;
      var current = null;
      for (var i = 0; i < heads.length; i++) {
        if (heads[i].getBoundingClientRect().top < 140) current = heads[i];
        else break;
      }
      Array.prototype.forEach.call(links, function (a) {
        a.classList.remove('active');
      });
      if (current && map[current.id]) {
        var link = map[current.id];
        link.classList.add('active');
        var toc = doc.querySelector('[data-toc]');
        if (toc) {
          var lr = link.getBoundingClientRect();
          var tr = toc.getBoundingClientRect();
          if (lr.top < tr.top + 40 || lr.bottom > tr.bottom - 40) toc.scrollTop += lr.top - tr.top - tr.height / 2;
        }
      }
    }
    window.addEventListener(
      'scroll',
      function () {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(spy);
        }
      },
      { passive: true }
    );
    spy();
  })();

  /* ------------------------------------------------------------------ */
  /* Search                                                             */
  /* ------------------------------------------------------------------ */

  var modal = doc.querySelector('[data-search-modal]');
  var sInput = modal && modal.querySelector('[data-search-input]');
  var sResults = modal && modal.querySelector('[data-search-results]');
  var index = null;
  var hits = [];
  var activeHit = 0;

  function loadIndex(cb) {
    if (window.SEARCH_INDEX) return cb();
    var s = doc.createElement('script');
    s.src = ROOT + 'assets/js/search-index.js?v=' + (COURSE.v || '');
    s.onload = cb;
    s.onerror = function () {
      sResults.innerHTML = '<div class="search-empty">The search index could not be loaded.</div>';
    };
    doc.head.appendChild(s);
  }

  function prepIndex() {
    if (index || !window.SEARCH_INDEX) return;
    index = window.SEARCH_INDEX.map(function (e) {
      return { e: e, H: e.h.toLowerCase(), M: e.m.toLowerCase(), X: e.x.toLowerCase() };
    });
  }

  function reEscape(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function mark(text, terms) {
    var safe = escapeHtml(text);
    if (!terms.length) return safe;
    var re = new RegExp('(' + terms.map(function (t) { return reEscape(escapeHtml(t)); }).join('|') + ')', 'gi');
    return safe.replace(re, '<mark>$1</mark>');
  }

  function snippet(text, terms) {
    var lower = text.toLowerCase();
    var at = -1;
    for (var i = 0; i < terms.length && at === -1; i++) at = lower.indexOf(terms[i]);
    if (at === -1) return text.slice(0, 170);
    var start = Math.max(0, at - 60);
    return (start > 0 ? '…' : '') + text.slice(start, start + 180) + '…';
  }

  function runSearch(q) {
    q = q.trim().toLowerCase();
    if (!q || !index) return [];
    var terms = q.split(/\s+/).filter(Boolean);
    var out = [];
    for (var i = 0; i < index.length; i++) {
      var it = index[i];
      var score = 0;
      var ok = true;
      for (var k = 0; k < terms.length; k++) {
        var t = terms[k];
        var s = 0;
        if (it.H.indexOf(t) !== -1) s += it.H.indexOf(t) === 0 ? 14 : 10;
        if (it.M.indexOf(t) !== -1) s += 3;
        if (it.X.indexOf(t) !== -1) s += 1 + Math.min(3, it.X.split(t).length - 1) * 0.5;
        if (!s) {
          ok = false;
          break;
        }
        score += s;
      }
      if (!ok) continue;
      if (it.H.indexOf(q) !== -1) score += 12;
      if (it.H === q) score += 20;
      if (it.e.k === 'module') score += 4;
      out.push({ e: it.e, score: score });
    }
    out.sort(function (a, b) {
      return b.score - a.score;
    });
    return out.slice(0, 40);
  }

  function renderSearch() {
    var q = sInput.value;
    var terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!q.trim()) {
      hits = COURSE.modules.map(function (m) {
        return { e: { h: m.title, m: 'Module ' + pad2(m.num), u: 'learn/' + m.id + '/', k: 'module', x: '' } };
      });
    } else {
      hits = runSearch(q);
    }
    activeHit = 0;
    if (!hits.length) {
      sResults.innerHTML = '<div class="search-empty">No results for “' + escapeHtml(q) + '”. Try a different word, like <b>tables</b> or <b>RemoteEvent</b>.</div>';
      return;
    }
    var kinds = { module: 'Module', section: 'Lesson', page: 'Reference' };
    sResults.innerHTML = hits
      .map(function (h, i) {
        return (
          '<a class="search-hit' + (i === 0 ? ' active' : '') + '" href="' + ROOT + h.e.u + '" data-hit="' + i + '">' +
          '<div class="search-hit-top"><span class="search-hit-kind">' + kinds[h.e.k] + '</span><span class="search-hit-title">' + mark(h.e.h, terms) + '</span><span class="search-hit-mod">' + escapeHtml(h.e.m) + '</span></div>' +
          (h.e.x ? '<div class="search-hit-text">' + mark(snippet(h.e.x, terms), terms) + '</div>' : '') +
          '</a>'
        );
      })
      .join('');
  }

  function setActive(i) {
    var els = sResults.querySelectorAll('.search-hit');
    if (!els.length) return;
    activeHit = (i + els.length) % els.length;
    Array.prototype.forEach.call(els, function (el, k) {
      el.classList.toggle('active', k === activeHit);
    });
    els[activeHit].scrollIntoView({ block: 'nearest' });
  }

  function openSearch() {
    if (!modal) return;
    modal.hidden = false;
    body.style.overflow = 'hidden';
    sInput.value = '';
    loadIndex(function () {
      prepIndex();
      renderSearch();
    });
    renderSearch();
    setTimeout(function () {
      sInput.focus();
    }, 20);
  }

  function closeSearch() {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    body.style.overflow = '';
  }

  if (modal) {
    sInput.addEventListener('input', renderSearch);
    sInput.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive(activeHit + 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive(activeHit - 1);
      } else if (e.key === 'Enter') {
        var el = sResults.querySelector('.search-hit.active');
        if (el) {
          e.preventDefault();
          closeSearch();
          window.location.href = el.href;
        }
      }
    });
    setAll('[data-search-close]', function (el) {
      el.addEventListener('click', closeSearch);
    });
    sResults.addEventListener('click', function (e) {
      if (e.target.closest('.search-hit')) closeSearch();
    });
  }

  doc.addEventListener('keydown', function (e) {
    var tag = (e.target.tagName || '').toLowerCase();
    var typing = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      modal && modal.hidden ? openSearch() : closeSearch();
    } else if (e.key === '/' && !typing) {
      e.preventDefault();
      openSearch();
    } else if (e.key === 'Escape') {
      closeSearch();
      body.classList.remove('nav-open');
    }
  });

  /* ------------------------------------------------------------------ */
  /* Playground page                                                    */
  /* ------------------------------------------------------------------ */

  (function () {
    var frame = doc.querySelector('[data-pg-frame]');
    var data = doc.getElementById('pg-snippets');
    if (!frame || !data) return;
    var snippets = JSON.parse(data.textContent);
    var openLink = doc.querySelector('[data-pg-open]');
    setAll('[data-snippet]', function (btn) {
      btn.addEventListener('click', function () {
        var url = playUrl(snippets[+btn.getAttribute('data-snippet')]);
        frame.src = url;
        if (openLink) openLink.href = url;
        setAll('[data-snippet]', function (b) {
          b.classList.toggle('active', b === btn);
        });
      });
    });
  })();

  /* ------------------------------------------------------------------ */
  /* Progress page                                                      */
  /* ------------------------------------------------------------------ */

  var progressBound = false;

  function renderProgressPage() {
    var app = doc.getElementById('progress-app');
    if (!app) return;
    var focused = doc.activeElement && doc.activeElement.id === 'cert-name';
    var xp = computeXp();
    var r = rankFor(xp);
    var toNext = r.next ? Math.min(100, ((xp - r.rank.min) / Math.max(1, r.next.min - r.rank.min)) * 100) : 100;
    var mods = COURSE.modules;
    var doneMods = mods.filter(function (m) {
      return state.modules[m.id];
    });
    var totalCh = 0;
    var solvedCh = 0;
    var totalQ = 0;
    var answeredQ = 0;
    var firstQ = 0;
    var totalP = 0;
    var solvedP = 0;
    mods.forEach(function (m) {
      totalCh += m.challenges.length;
      m.challenges.forEach(function (c) {
        if (state.challenges[c.id]) solvedCh++;
      });
      totalQ += m.quiz.length;
      m.quiz.forEach(function (q) {
        if (state.quiz[q]) answeredQ++;
        if (state.quiz[q] === 'first') firstQ++;
      });
      totalP += m.predict.length;
      m.predict.forEach(function (p) {
        if (state.predict[p] === 'solved') solvedP++;
      });
    });
    var pct = function (a, b) {
      return b ? Math.round((a / b) * 100) : 0;
    };
    var allDone = doneMods.length === mods.length && mods.length > 0;
    var lastDone = 0;
    doneMods.forEach(function (m) {
      var t = +state.modules[m.id];
      if (t > lastDone) lastDone = t;
    });
    var dateStr = new Date(allDone && lastDone > 1 ? lastDone : Date.now()).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    var html = '';
    html +=
      '<section class="card rank-card"><div class="rank-badge">' + ICONS.award + '</div><div>' +
      '<div class="eyebrow">Current rank</div><div class="rank-name">' + escapeHtml(r.rank.name) + '</div>' +
      '<p class="rank-sub">' + fmt(xp) + ' XP earned' + (r.next ? ' · ' + fmt(r.next.min - xp) + ' XP to <b>' + escapeHtml(r.next.name) + '</b>' : ' · Maximum rank reached!') + '</p>' +
      '<div class="bar bar-lg"><i style="width:' + toNext + '%"></i></div>' +
      '<div class="rank-ladder">' +
      COURSE.ranks
        .map(function (rk, i) {
          return '<span class="rank-step' + (i === r.index ? ' current' : xp >= rk.min ? ' reached' : '') + '">' + escapeHtml(rk.name) + ' · ' + fmt(rk.min) + '</span>';
        })
        .join('') +
      '</div></div></section>';

    html +=
      '<div class="stat-grid">' +
      stat(doneMods.length + ' / ' + mods.length, 'Modules complete', pct(doneMods.length, mods.length)) +
      stat(solvedCh + ' / ' + totalCh, 'Challenges solved', pct(solvedCh, totalCh)) +
      stat(answeredQ ? pct(firstQ, answeredQ) + '%' : '—', 'Quiz first-try accuracy · ' + answeredQ + '/' + totalQ + ' answered', pct(answeredQ, totalQ)) +
      stat(solvedP + ' / ' + totalP, 'Outputs predicted', pct(solvedP, totalP)) +
      '</div>';

    html += '<section class="card"><h2>Modules by part</h2><div class="part-rows">';
    COURSE.parts.forEach(function (p) {
      var pm = mods.filter(function (m) {
        return m.part === p.n;
      });
      var pd = pm.filter(function (m) {
        return state.modules[m.id];
      }).length;
      html +=
        '<div><div class="part-row-head"><span>Part ' + p.roman + ' · ' + escapeHtml(p.title) + '</span><span>' + pd + ' / ' + pm.length + '</span></div>' +
        '<div class="bar"><i style="width:' + pct(pd, pm.length) + '%"></i></div><div class="mod-chips">' +
        pm
          .map(function (m) {
            var mp = modProgress(m);
            return '<a class="mod-chip' + (mp.complete ? ' done' : mp.done ? ' started' : '') + '" href="' + ROOT + 'learn/' + m.id + '/" title="' + escapeHtml(m.title) + '">' + pad2(m.num) + ' · ' + escapeHtml(m.title) + '</a>';
          })
          .join('') +
        '</div></div>';
    });
    html += '</div></section>';

    html += '<section class="card" id="certificate"><h2>Certificate of completion</h2><div class="cert-wrap">';
    if (!allDone) {
      html +=
        '<div class="cert-locked">' + ICONS.lock + '<div><b>Locked</b> — complete all ' + mods.length + ' modules to unlock your certificate. ' +
        (mods.length - doneMods.length) + ' to go! Here is a preview of what you will earn.</div></div>';
    }
    html +=
      '<div class="cert-controls"><input id="cert-name" type="text" maxlength="48" placeholder="Your name (as it should appear)" value="' + escapeHtml(state.name || '') + '">' +
      '<button type="button" class="btn btn-primary" data-cert-print' + (allDone ? '' : ' disabled') + '>' + ICONS.printer + '<span>Print / save as PDF</span></button></div>' +
      '<div class="certificate" id="certificate-sheet"' + (allDone ? '' : ' style="filter:grayscale(.85);opacity:.6"') + '>' + LOGO +
      '<div class="cert-kicker">Certificate of completion</div><div class="cert-title">Luau Academy</div>' +
      '<div class="cert-presented">This certifies that</div><div class="cert-name" data-cert-name>' + escapeHtml(state.name || 'Your Name') + '</div>' +
      '<div class="cert-desc">has completed all ' + mods.length + ' modules of the Luau Academy course — from Luau fundamentals to professional Roblox engine systems — earning ' + fmt(xp) + ' XP and the rank of <b>' + escapeHtml(r.rank.name) + '</b>.</div>' +
      '<div class="cert-foot"><div class="cert-sig"><b>' + escapeHtml(dateStr) + '</b>Date</div><div class="cert-seal">Luau<br>Academy<br>★</div><div class="cert-sig"><b>Koala</b>Course author</div></div>' +
      '<div class="cert-credit">' + escapeHtml(COURSE.credit || '') + '</div></div>';
    html += '</div></section>';

    html +=
      '<section class="card"><h2>Your data</h2><p style="margin:-6px 0 16px;color:var(--muted)">Progress lives in this browser only. Export it to back it up or move it to another device.</p>' +
      '<div class="data-tools"><button type="button" class="btn" data-export>' + ICONS.download + '<span>Export progress</span></button>' +
      '<button type="button" class="btn" data-import>' + ICONS.upload + '<span>Import progress</span></button>' +
      '<button type="button" class="btn btn-ghost btn-danger" data-reset>' + ICONS.trash + '<span>Reset everything</span></button>' +
      '<textarea data-transfer hidden spellcheck="false" placeholder="Paste an exported progress code here, then press Import again."></textarea></div></section>';

    app.innerHTML = html;

    if (focused) {
      var inp = doc.getElementById('cert-name');
      inp.focus();
      inp.setSelectionRange(inp.value.length, inp.value.length);
    }

    if (!progressBound) {
      progressBound = true;
      app.addEventListener('input', function (e) {
        if (e.target.id === 'cert-name') {
          state.name = e.target.value;
          save();
          var n = app.querySelector('[data-cert-name]');
          if (n) n.textContent = state.name || 'Your Name';
        }
      });
      app.addEventListener('click', function (e) {
        if (e.target.closest('[data-cert-print]')) {
          body.classList.add('printing-cert');
          window.print();
          setTimeout(function () {
            body.classList.remove('printing-cert');
          }, 500);
        } else if (e.target.closest('[data-export]')) {
          var ta = app.querySelector('[data-transfer]');
          ta.hidden = false;
          ta.value = btoa(unescape(encodeURIComponent(JSON.stringify(state))));
          ta.select();
          copyText(ta.value).then(
            function () {
              toast('Progress copied', 'Paste it into Import on another device', 'check');
            },
            function () {}
          );
        } else if (e.target.closest('[data-import]')) {
          var t = app.querySelector('[data-transfer]');
          if (t.hidden || !t.value.trim()) {
            t.hidden = false;
            t.value = '';
            t.focus();
            return;
          }
          try {
            var parsed = JSON.parse(decodeURIComponent(escape(atob(t.value.trim()))));
            if (!parsed || typeof parsed !== 'object' || !parsed.modules) throw new Error('bad');
            var s = blank();
            for (var k in s) if (parsed[k] !== undefined) s[k] = parsed[k];
            state = s;
            save();
            updateUI();
            toast('Progress imported', 'Welcome back!', 'check');
          } catch (err) {
            toast('Import failed', 'That code does not look like exported progress.', 'zap');
          }
        } else if (e.target.closest('[data-reset]')) {
          if (window.confirm('Reset ALL progress, XP and your certificate name? This cannot be undone.')) {
            state = blank();
            save();
            updateUI();
            toast('Progress reset', 'A fresh start.', 'check');
          }
        }
      });
    }
  }

  function stat(big, label, pct) {
    return '<div class="stat"><b>' + big + '</b><span>' + label + '</span><div class="bar"><i style="width:' + pct + '%"></i></div></div>';
  }

  /* ------------------------------------------------------------------ */
  /* Boot                                                               */
  /* ------------------------------------------------------------------ */

  updateUI();

  if (location.hash === '#certificate') {
    var c = doc.getElementById('certificate');
    if (c) setTimeout(function () { c.scrollIntoView(); }, 50);
  }
})();
