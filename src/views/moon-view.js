/* ===========================================================================
   views/moon-view.js — 月
   ---------------------------------------------------------------------------
   今の周期を一枚で見る。新月から次の新月までの一か月を、暦としてではなく
   「満ちて、欠ける」ひとつの波として見せたい。
   下のほうに、自分がどの月相でよく書いているかの集計を置いた。
   これも一種の問い（私はいつ、いちばんよく気づくのか）になる。
   =========================================================================== */
(function (W) {
  'use strict';
  var ui = W.ui, esc = ui.esc;

  function recordsByDay() {
    var m = {};
    function bump(iso) { var k = ui.dayKey(iso); m[k] = (m[k] || 0) + 1; }
    var s = W.store.state;
    s.notices.forEach(function (n) { bump(n.createdAt); });
    s.wishes.forEach(function (w) {
      bump(w.createdAt);
      if (w.fulfilledAt) bump(w.fulfilledAt);
      w.pulses.forEach(function (p) { bump(p.at); });
    });
    s.questions.forEach(function (q) { bump(q.createdAt); });
    return m;
  }

  function cycle() {
    var now = new Date();
    var start = W.moon.lastNew(now);     // いまの周期の始まり
    var end   = W.moon.nextNew(now);     // 次の周期の始まり
    var counts = recordsByDay();
    var todayKey = ui.dayKey(now);
    var cells = '';

    // 時刻を落として「日」の粒度で並べる（新月の日から次の新月の日まで）
    var d0 = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12);
    var d1 = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 12);
    var span = Math.round((d1 - d0) / 86400000) + 1;

    for (var i = 0; i < span; i++) {
      var d = W.moon.addDays(d0, i);
      var k = ui.dayKey(d);
      var n = counts[k] || 0;
      var isToday = k === todayKey;
      var ph = W.moon.phase(d);
      var mark = (ph.key === 'new' || ph.key === 'full') ? ' is-key' : '';
      cells += '<div class="cyc__c' + (isToday ? ' is-today' : '') + mark + '" title="' +
        esc(ui.fmtDate(d) + '　' + ph.name + (n ? '　記録 ' + n : '')) + '">' +
        W.moon.svg(d, 20) +
        '<span class="cyc__d">' + d.getDate() + '</span>' +
        (n ? '<span class="cyc__n" style="opacity:' + Math.min(1, 0.35 + n * 0.2) + '"></span>' : '<span class="cyc__n cyc__n--off"></span>') +
        '</div>';
    }
    return '<div class="cyc">' + cells + '</div>';
  }

  function upcoming() {
    var now = new Date();
    var nNew = W.moon.nextNew(now);
    var nFull = W.moon.nextFull(now);
    return '' +
      '<div class="next">' +
        '<a class="next__i" href="#/ritual?kind=new">' + W.moon.svg(nNew, 28) +
          '<div><strong>次の新月</strong><span>' + esc(ui.fmtFull(nNew)) + '</span>' +
          '<small>種をまく日 · 儀式をひらく</small></div></a>' +
        '<a class="next__i" href="#/ritual?kind=full">' + W.moon.svg(nFull, 28) +
          '<div><strong>次の満月</strong><span>' + esc(ui.fmtFull(nFull)) + '</span>' +
          '<small>感謝し、手をひらく日 · 儀式をひらく</small></div></a>' +
      '</div>';
  }

  /* これまでの儀式。読み返すと、一巡りごとの変化が見える。 */
  function pastRituals() {
    var rs = W.store.state.rituals.slice(0, 8);
    if (!rs.length) return '';
    return '' +
      '<section class="card">' +
        '<h2 class="card__title">これまでの儀式<span class="count">' + W.store.state.rituals.length + '</span></h2>' +
        '<ul class="rpast">' + rs.map(function (r) {
          var g = (r.gratitude || []).filter(Boolean);
          return '<li>' +
            '<div class="rpast__h">' + W.moon.svg(new Date(r.at), 14) +
              '<strong>' + (r.kind === 'full' ? '満月' : '新月') + '</strong>' +
              '<span>' + esc(ui.fmtFull(r.at)) + '</span></div>' +
            (g.length ? '<div class="rpast__b">' + g.map(esc).join(' / ') + '</div>' : '') +
            (r.letGo ? '<div class="rpast__b rpast__b--letgo">手放した … ' + esc(r.letGo) + '</div>' : '') +
            (r.intention ? '<div class="rpast__b">意図 … ' + esc(r.intention) + '</div>' : '') +
          '</li>';
        }).join('') + '</ul>' +
      '</section>';
  }

  function guide() {
    var nowKey = W.moon.phase(new Date()).key;
    var base = W.moon.lastNew(new Date());
    return '<div class="guide">' + W.moon.PHASES.map(function (p, i) {
      var sample = W.moon.addDays(base, i * W.moon.SYNODIC / 8);
      return '<div class="guide__i' + (p.key === nowKey ? ' is-now' : '') + '">' +
        '<div class="guide__m">' + W.moon.svg(sample, 30) + '</div>' +
        '<div class="guide__b">' +
          '<strong>' + esc(p.name) + '<small>' + esc(p.yomi) + '</small></strong>' +
          '<span class="guide__th">' + esc(p.theme) + '</span>' +
          '<p>' + esc(p.note) + '</p>' +
          '<em>' + esc(p.act) + '</em>' +
        '</div></div>';
    }).join('') + '</div>';
  }

  /* 自分はどの月相でよく書いているか。傾向が見えると、リズムが作れる。 */
  function stats() {
    var s = W.store.state;
    var tally = {};
    W.moon.PHASES.forEach(function (p) { tally[p.key] = { notices: 0, born: 0, done: 0 }; });

    s.notices.forEach(function (n) { if (n.moon && tally[n.moon.key]) tally[n.moon.key].notices++; });
    s.wishes.forEach(function (w) {
      if (w.moonAtCreate && tally[w.moonAtCreate.key]) tally[w.moonAtCreate.key].born++;
      if (w.moonAtFulfill && tally[w.moonAtFulfill.key]) tally[w.moonAtFulfill.key].done++;
    });

    var max = 1;
    W.moon.PHASES.forEach(function (p) { max = Math.max(max, tally[p.key].notices); });
    var total = s.notices.length;
    if (!total && !s.wishes.length) return '';

    var rows = W.moon.PHASES.map(function (p) {
      var t = tally[p.key];
      return '<div class="bar">' +
        '<span class="bar__l">' + esc(p.name) + '</span>' +
        '<span class="bar__t"><span class="bar__f" style="width:' + Math.round(t.notices / max * 100) + '%"></span></span>' +
        '<span class="bar__v">' + t.notices +
          (t.born ? '<i class="bar__b" title="立てた願い">＋' + t.born + '</i>' : '') +
          (t.done ? '<i class="bar__d" title="叶った願い">✓' + t.done + '</i>' : '') +
        '</span></div>';
    }).join('');

    var best = W.moon.PHASES.slice().sort(function (a, b) { return tally[b.key].notices - tally[a.key].notices; })[0];
    var lead = total >= 8
      ? '<p class="hint">あなたがいちばんよく気づきを書いているのは<strong>' + esc(best.name) + '</strong>の頃です。' +
        'その時期に、大事な決めごとを置いてみてもいいかもしれません。</p>'
      : '<p class="hint">記録が増えると、自分がどの月相でよく気づくのかが見えてきます。</p>';

    return '<section class="card"><h2 class="card__title">月相ごとの記録</h2>' + lead +
      '<div class="bars">' + rows + '</div></section>';
  }

  function render() {
    var now = new Date();
    var p = W.moon.phase(now);
    return '' +
      '<section class="card">' +
        '<h2 class="card__title">いまの周期</h2>' +
        '<p class="hint">新月から数えて ' + W.moon.age(now).toFixed(1) + '日目。' +
          '今日は<strong>' + esc(p.name) + '</strong>、テーマは「' + esc(p.theme) + '」。</p>' +
        cycle() +
        upcoming() +
      '</section>' +
      pastRituals() +
      stats() +
      '<section class="card">' +
        '<h2 class="card__title">八つの月と、すること</h2>' +
        guide() +
        '<p class="footnote">月齢と朔望の時刻は、位相角の主要項から計算しています' +
          '（実際とのずれはおおむね一時間以内）。表示はこの端末の時間帯です。</p>' +
      '</section>';
  }

  W.views = W.views || {};
  W.views.moon = { render: render, mount: function () {}, tab: 'moon' };
})(window.W = window.W || {});
