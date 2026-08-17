/* ===========================================================================
   views/sync.js — 符合（シンクロニシティ）
   ---------------------------------------------------------------------------
   点と点が線になるところを、そのまま図にした画面。

   星の置き方に意味を持たせてある。
     角度 … その日の月相（真上が新月、右へ満ちて、真下が満月）
     半径 … 何巡り前か（古いものが内側、新しいものが外側）

   こうすると「同じ月相のときに起きたこと」が同じ方角にそろい、
   螺旋の外へ向かって放射状の並びが見えてくる。
   何ヶ月も経ってから「自分は毎回この頃に同じことを書いている」と気づく——
   それがこの画面のいちばん見せたいものです。
   =========================================================================== */
(function (W) {
  'use strict';
  var ui = W.ui, esc = ui.esc;

  var R_MIN = 42, R_MAX = 140, PAD = 22;
  var CHART_LIMIT = 250;      // 星図に載せる記録の上限（総当たりの計算量を抑える）
  var LINE_LIMIT = 160;       // 引く線の上限（多すぎると図が読めなくなる）

  function corpus() {
    return W.store.state.notices.slice(0, CHART_LIMIT);
  }

  /* 選んだ種類は覚えておく。書くたびに「偶然」へ戻ると、
     夢を2つ続けて書いたときに2つめが黙って別の種類で保存されてしまう。 */
  var lastKind = 'chance';

  /* ------------------------------------------------------------ 書きこみ欄 */

  function composer(kind) {
    var chips = Object.keys(ui.KINDS).map(function (k) {
      return '<button type="button" class="chip chip--k chip--' + k + (k === kind ? ' is-on' : '') +
             '" data-kind="' + k + '">' + esc(ui.KINDS[k].label) + '</button>';
    }).join('');
    return '' +
      '<section class="card card--form">' +
        '<h2 class="card__title">今日、起きたこと</h2>' +
        '<div class="chips" id="kindChips">' + chips + '</div>' +
        '<textarea id="sText" class="ta" rows="2" placeholder="偶然すれちがったこと、ふと浮かんだこと、見た夢。&#10;判断せずに、そのまま書く。"></textarea>' +
        '<div class="row row--between">' +
          '<select id="sWish" class="sel">' + ui.wishOptions(null) + '</select>' +
          '<button class="btn btn--primary" data-act="s-save">書きとめる</button>' +
        '</div>' +
      '</section>';
  }

  /* -------------------------------------------------------------- 星図 */

  function chart(idx, pairs, selectedId) {
    var now = new Date();
    var docs = idx.docs;
    if (!docs.length) return '';

    var oldest = 0;
    docs.forEach(function (d) {
      var c = (now.getTime() - d.at) / (W.moon.SYNODIC * 86400000);
      if (c > oldest) oldest = c;
    });
    var maxCycles = Math.max(1, Math.min(14, Math.ceil(oldest)));

    var pos = {};
    docs.forEach(function (d) {
      pos[d.id] = W.resonance.starPos(new Date(d.at), now, maxCycles, R_MIN, R_MAX);
    });

    // 背景：月相の目盛りと、周期のリング
    var deco = '';
    for (var c = 1; c <= maxCycles; c++) {
      var rr = R_MAX - (c / maxCycles) * (R_MAX - R_MIN);
      deco += '<circle class="sky__ring" r="' + rr.toFixed(1) + '"/>';
    }
    W.moon.PHASES.forEach(function (p, i) {
      var th = (i / 8) * 2 * Math.PI - Math.PI / 2;
      var x1 = Math.cos(th) * (R_MIN - 8), y1 = Math.sin(th) * (R_MIN - 8);
      var x2 = Math.cos(th) * (R_MAX + 8), y2 = Math.sin(th) * (R_MAX + 8);
      deco += '<line class="sky__spoke" x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) +
              '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '"/>';
      if (i % 2 === 0) {
        var lx = Math.cos(th) * (R_MAX + 20), ly = Math.sin(th) * (R_MAX + 20);
        deco += '<text class="sky__lb" x="' + lx.toFixed(1) + '" y="' + (ly + 3).toFixed(1) +
                '" text-anchor="middle">' + esc(p.name) + '</text>';
      }
    });

    // 線：響き合っている組をつなぐ。
    // 記録がたまると組は二乗で増える。全部引くと星が線に埋もれて何も読めなくなるので、
    // 強いものから順に上限まで。ただし選んでいる星につながる線は必ず残す。
    var strong = pairs.slice(0, LINE_LIMIT);
    if (selectedId) {
      var have = {};
      strong.forEach(function (p) { have[p.a.id + '|' + p.b.id] = 1; });
      pairs.forEach(function (p) {
        if (p.a.id !== selectedId && p.b.id !== selectedId) return;
        if (!have[p.a.id + '|' + p.b.id]) strong.push(p);
      });
    }

    var lines = strong.map(function (p) {
      var a = pos[p.a.id], b = pos[p.b.id];
      if (!a || !b) return '';
      var on = selectedId && (p.a.id === selectedId || p.b.id === selectedId);
      var o = Math.min(0.75, 0.18 + p.score * 0.8);
      return '<line class="sky__link' + (on ? ' is-on' : '') + '" x1="' + a.x.toFixed(1) + '" y1="' + a.y.toFixed(1) +
             '" x2="' + b.x.toFixed(1) + '" y2="' + b.y.toFixed(1) +
             '" stroke-opacity="' + (on ? 0.95 : o).toFixed(2) + '"/>';
    }).join('');

    // 星：記録そのもの
    var linked = {};
    strong.forEach(function (p) { linked[p.a.id] = 1; linked[p.b.id] = 1; });

    var stars = docs.map(function (d) {
      var p = pos[d.id];
      var on = d.id === selectedId;
      var r = linked[d.id] ? 3.1 : 2.1;
      return '<g class="sky__star sky__star--' + esc(d.n.kind) + (on ? ' is-on' : '') + '" data-id="' + esc(d.id) + '">' +
             (on ? '<circle class="sky__halo" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="8"/>' : '') +
             '<circle class="sky__hit" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="11"/>' +
             '<circle class="sky__dot" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + r + '"/>' +
             '</g>';
    }).join('');

    var box = R_MAX + PAD + 14;
    var legend = Object.keys(ui.KINDS).map(function (k) {
      return '<span class="lg lg--' + k + '">' + esc(ui.KINDS[k].label) + '</span>';
    }).join('');

    return '' +
      '<section class="card">' +
        '<h2 class="card__title">星図<span class="count">' + docs.length + '</span></h2>' +
        '<p class="hint">真上が新月、右へ満ちて真下が満月。外側ほど新しい記録です。' +
          '同じ方角に並んだ星は、同じ月相のときに起きたこと。</p>' +
        '<svg class="sky" viewBox="' + (-box) + ' ' + (-box) + ' ' + (box * 2) + ' ' + (box * 2) + '" ' +
          'role="img" aria-label="記録の星図">' +
          deco + lines + stars +
        '</svg>' +
        '<div class="legend">' + legend + '</div>' +
        (W.store.state.notices.length > CHART_LIMIT
          ? '<p class="footnote">星図には新しい ' + CHART_LIMIT + ' 件を載せています。</p>' : '') +
        (pairs.length > LINE_LIMIT
          ? '<p class="footnote">線は響きの強い ' + LINE_LIMIT + ' 本だけ引いています。' +
            '星をつつくと、その星につながる線がすべて出ます。</p>' : '') +
      '</section>';
  }

  /* ------------------------------------------------- くり返し現れているもの */

  function patterns(idx) {
    var rec = W.resonance.recurring(idx, 2).slice(0, 14);
    if (!rec.length) return '';
    var max = rec[0].count;
    return '' +
      '<section class="card">' +
        '<h2 class="card__title">くり返し現れているもの</h2>' +
        '<p class="hint">記録の中に何度も出てくる言葉です。自分でも気づかずに、同じものを見ていることがあります。</p>' +
        '<div class="terms">' + rec.map(function (r) {
          var span = ui.daysBetween(r.docs[r.docs.length - 1].at, r.docs[0].at);
          return '<a class="term" href="#/notices?q=' + encodeURIComponent(r.word) + '" ' +
                 'style="--w:' + (0.45 + 0.55 * r.count / max).toFixed(2) + '">' +
                 '<span class="term__w"><b>' + esc(r.word) + '</b><i>×' + r.count + '</i></span>' +
                 '<small>' + (span > 0 ? span + '日にわたって' : '同じ日に') + '</small></a>';
        }).join('') + '</div>' +
      '</section>';
  }

  /* ------------------------------------------------------ 響き合いの一覧 */

  function pairList(pairs) {
    if (!pairs.length) return '';
    return '' +
      '<section class="card">' +
        '<h2 class="card__title">つながった点<span class="count">' + pairs.length + '</span></h2>' +
        '<ul class="plist">' + pairs.slice(0, 12).map(function (p) {
          var older = p.a.at < p.b.at ? p.a : p.b;
          var newer = p.a.at < p.b.at ? p.b : p.a;
          return '<li class="plist__i">' +
            '<a class="plist__n" href="#/sync?s=' + esc(newer.id) + '">' +
              W.moon.svg(new Date(newer.at), 12) + esc(newer.n.text) +
              '<em>' + esc(ui.ago(newer.n.createdAt)) + '</em></a>' +
            '<div class="plist__why">' + esc(p.reasons.join('・')) + '</div>' +
            '<a class="plist__n" href="#/sync?s=' + esc(older.id) + '">' +
              W.moon.svg(new Date(older.at), 12) + esc(older.n.text) +
              '<em>' + esc(ui.ago(older.n.createdAt)) + '</em></a>' +
          '</li>';
        }).join('') + '</ul>' +
      '</section>';
  }

  /* -------------------------------------------------------------- 画面 */

  function render(params) {
    var list = corpus();
    var kind = lastKind;

    if (!list.length) {
      return composer(kind) +
        '<section class="card card--soft">' +
          '<h2 class="card__title">符合とは</h2>' +
          '<p class="hint">偶然の一致、ふとした直感、見た夢。' +
            'その場では意味のわからないものを、判断せずに書きとめておく画面です。</p>' +
          '<p class="hint">3つ4つとたまってくると、過去の記録と照らし合わせて' +
            '「これは3週間前のあれと似ています」と知らせます。' +
            '記録は月の周期の上に星として置かれ、響き合ったものどうしが線でつながります。</p>' +
          '<p class="hint">点が線になるのは、たいてい後からです。だから、今は意味を考えずに置いておく。</p>' +
        '</section>';
    }

    var idx = W.resonance.index(list);
    var pairs = W.resonance.pairs(list);

    // 書いた直後なら、その記録を選んだ状態で開く
    var sel = params.s || ui.getEcho();
    var selDoc = sel ? idx.byId[sel] : null;

    var detail = selDoc
      ? W.echoView.card(selDoc.n, W.resonance.echoesFor(selDoc.id, idx, 4),
                        params.s ? '響き合っています' : 'いま書いたことは')
      : '';

    return composer(kind) + detail + chart(idx, pairs, sel) + patterns(idx) + pairList(pairs);
  }

  function mount(root, params) {
    var kind = lastKind;
    var chips = root.querySelector('#kindChips');
    if (chips) chips.addEventListener('click', function (e) {
      var c = e.target.closest('.chip'); if (!c) return;
      kind = lastKind = c.dataset.kind;
      chips.querySelectorAll('.chip').forEach(function (x) { x.classList.toggle('is-on', x === c); });
    });

    var ta = root.querySelector('#sText');
    if (ta) ui.autogrow(ta);

    // 星をつつくと、その記録と響きが出る
    var sky = root.querySelector('.sky');
    if (sky) sky.addEventListener('click', function (e) {
      var g = e.target.closest('.sky__star'); if (!g) return;
      var id = g.dataset.id;
      ui.clearEcho();
      location.hash = (params.s === id) ? '#/sync' : '#/sync?s=' + encodeURIComponent(id);
    });

    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      if (b.dataset.act === 's-save') {
        var t = ta.value.trim(); if (!t) { ta.focus(); return; }
        var n = W.store.addNotice(t, kind, root.querySelector('#sWish').value || null);
        ta.value = ''; ta.dispatchEvent(new Event('input'));
        ui.setEcho(n.id);
        if (params.s) location.hash = '#/sync';    // 選択を外して、新しい記録を見せる
      }
    });
  }

  W.views = W.views || {};
  W.views.sync = { render: render, mount: mount, tab: 'sync' };
})(window.W = window.W || {});
