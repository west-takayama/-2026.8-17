/* ===========================================================================
   views/insight.js — 調べ
   ---------------------------------------------------------------------------
   たまった記録を、自分についての知識に変える画面。

   ここで守っているのは「言いすぎないこと」です。
   14日ぶんたまるまで、つながりの話は一切しません。そのあいだは
   「あと何日で読めるようになるか」だけを出します。
   数字が少ないうちに断定すると、当たっていないことを信じ込ませてしまう。
   願いと執着を扱う道具でそれをやるのは、いちばんやってはいけないことだと思います。
   =========================================================================== */
(function (W) {
  'use strict';
  var ui = W.ui, esc = ui.esc, A;

  var RANGES = [
    { d: 7,   label: '7日' },
    { d: 28,  label: '28日' },
    { d: 90,  label: '90日' },
    { d: 3650, label: 'すべて' }
  ];

  function fmt(x, digits) {
    return x == null ? '—' : (Math.round(x * Math.pow(10, digits || 1)) / Math.pow(10, digits || 1));
  }

  /* ------------------------------------------------------------- 見わたす */

  function overview(table, days) {
    var s = A.summary(table, days);
    var cell = function (label, val, unit, sub) {
      return '<div class="ov"><b>' + (val == null ? '—' : val) + (val != null && unit ? '<i>' + unit + '</i>' : '') + '</b>' +
             '<span>' + esc(label) + '</span>' +
             (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div>';
    };
    return '<div class="ovs">' +
      cell('平均睡眠', s.sleep ? fmt(s.sleep.v) : null, '時間', s.sleep ? s.sleep.n + '日ぶん' : '記録なし') +
      cell('調子',    s.condition ? fmt(s.condition.v) : null, '', s.condition ? s.condition.n + '日ぶん' : '記録なし') +
      cell('余白',    s.space ? fmt(s.space.v) : null, '', s.space ? s.space.n + '日ぶん' : '記録なし') +
      cell('握り',    s.grip ? fmt(s.grip.v) : null, '', s.grip ? s.grip.n + '日ぶん' : '記録なし') +
      cell('強さ',    s.intensity ? fmt(s.intensity.v) : null, '', s.intensity ? s.intensity.n + '日ぶん' : '記録なし') +
      cell('書きとめた', s.notices, '', s.questions ? '問い ' + s.questions : '') +
      '</div>';
  }

  /* 折れ線。日付の欠けた日は線をつながない（無いものを補わない）。 */
  function line(table, key, color) {
    var pts = table.filter(function (r) { return r[key] != null; });
    if (pts.length < 2) return '';
    var xs = pts.map(function (r) { return r.date.getTime(); });
    var ys = pts.map(function (r) { return Number(r[key]); });
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
    var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
    if (maxX === minX) return '';
    if (maxY === minY) { minY -= 1; maxY += 1; }
    var W_ = 300, H = 46;
    var d = pts.map(function (r, i) {
      var x = (xs[i] - minX) / (maxX - minX) * W_;
      var y = H - ((ys[i] - minY) / (maxY - minY)) * (H - 6) - 3;
      return (i ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
    return '<svg class="ln" viewBox="0 0 ' + W_ + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true">' +
      '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="1.6" ' +
      'vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/></svg>';
  }

  function trends(table) {
    var rows = [
      { key: 'sleep', label: '睡眠', color: 'var(--k-dream)' },
      { key: 'condition', label: '調子', color: 'var(--k-thanks)' },
      { key: 'space', label: '余白', color: 'var(--k-hunch)' },
      { key: 'grip', label: '握り', color: 'var(--gold)' },
      { key: 'intensity', label: '強さ', color: 'var(--moon)' }
    ].filter(function (r) {
      return table.filter(function (x) { return x[r.key] != null; }).length >= 2;
    });
    if (!rows.length) return '';
    return '<div class="lns">' + rows.map(function (r) {
      return '<div class="lnrow"><span class="lnrow__l">' + esc(r.label) + '</span>' +
             line(table, r.key, r.color) + '</div>';
    }).join('') + '</div>';
  }

  /* --------------------------------------------------------- つながり */

  function links(table) {
    var found = A.findLinks(table);
    var short = A.daysUntilLinks(table);

    if (short > 0) {
      var have = A.MIN_DAYS - short;
      return '' +
        '<section class="card">' +
          '<h2 class="card__title">つながり</h2>' +
          '<p class="hint">コンディションを書いた日が <strong>' + have + ' 日</strong>たまりました。' +
            'あと <strong>' + short + ' 日</strong>で、傾向を読みはじめます。</p>' +
          '<div class="gauge"><span style="width:' + Math.round(have / A.MIN_DAYS * 100) + '%"></span></div>' +
          '<p class="hint">少ない日数で「あなたはこうです」と言うと、たいてい偶然を法則だと思い込ませてしまいます。' +
            'だからここは、たまるまで黙っています。</p>' +
        '</section>';
    }

    if (!found.length) {
      return '' +
        '<section class="card">' +
          '<h2 class="card__title">つながり</h2>' +
          '<p class="hint">いまのところ、はっきりした傾向は見つかりませんでした。' +
            '弱い関係を無理に取り上げると外れるので、出していません。</p>' +
          '<p class="hint">日数が増えると見えてくることがあります。そのまま続けてください。</p>' +
        '</section>';
    }

    return '' +
      '<section class="card">' +
        '<h2 class="card__title">つながり<span class="count">' + found.length + '</span></h2>' +
        '<p class="hint">記録どうしの関係です。どちらが原因かは分かりません。' +
          '「そういえば」と思い当たるものだけ拾ってください。</p>' +
        found.map(function (f) {
          return '<div class="link link--' + f.strength + '">' +
            '<div class="link__t">' + esc(f.text) + '<span class="link__tag">' +
              esc(A.LABEL[f.x]) + ' × ' + esc(A.LABEL[f.y]) + '</span></div>' +
            (f.note ? '<p class="link__n">' + esc(f.note) + '</p>' : '') +
            '<div class="link__m">' + f.n + '日ぶんの記録から　強さ ' +
              (Math.abs(f.r) >= 0.6 ? 'はっきり' : Math.abs(f.r) >= 0.45 ? 'ややはっきり' : 'ゆるやか') +
              '（r = ' + f.r.toFixed(2) + '）</div>' +
          '</div>';
        }).join('') +
        '<p class="footnote">r は −1 〜 +1 の値で、0 に近いほど関係がないことを意味します。' +
          '取り上げる目安は日数によって変えていて、記録が少ないうちほど厳しく見ます' +
          '（14日なら ±0.59、40日なら ±0.35 以上）。' +
          '少ない記録で出た数字は、偶然でもそれくらい動くからです。</p>' +
      '</section>';
  }

  /* ------------------------------------------------------- 曜日と月相 */

  function bars(list, unit) {
    var vals = list.filter(function (b) { return b.v != null; }).map(function (b) { return b.v; });
    if (!vals.length) return '';
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    if (hi === lo) { lo -= 0.5; hi += 0.5; }
    return '<div class="bars">' + list.map(function (b) {
      var w = b.v == null ? 0 : Math.max(4, Math.round((b.v - lo) / (hi - lo) * 100));
      return '<div class="bar">' +
        '<span class="bar__l">' + esc(b.w || b.name) + '</span>' +
        '<span class="bar__t"><span class="bar__f" style="width:' + w + '%"></span></span>' +
        '<span class="bar__v">' + (b.v == null ? '—' : fmt(b.v)) + (unit || '') + '</span>' +
      '</div>';
    }).join('') + '</div>';
  }

  function rhythms(table, metric) {
    var opts = [
      { k: 'condition', label: '調子' },
      { k: 'sleep', label: '睡眠' },
      { k: 'space', label: '余白' },
      { k: 'grip', label: '握り' },
      { k: 'notices', label: '書いた数' }
    ];
    var m = metric || 'condition';
    var picker = opts.map(function (o) {
      return '<a class="chip' + (o.k === m ? ' is-on' : '') + '" href="#/insight?m=' + o.k + '">' +
             esc(o.label) + '</a>';
    }).join('');

    var wd = A.byWeekday(table, m);
    var ph = A.byPhase(table, m);
    var haveWd = wd.some(function (b) { return b.v != null; });
    var havePh = ph.some(function (b) { return b.v != null; });
    if (!haveWd && !havePh) return '';

    // いちばん高い曜日・月相を言葉にする
    var topWd = wd.filter(function (b) { return b.n >= 2; }).sort(function (a, b) { return b.v - a.v; })[0];
    var topPh = ph.filter(function (b) { return b.n >= 2; }).sort(function (a, b) { return b.v - a.v; })[0];

    return '' +
      '<section class="card">' +
        '<h2 class="card__title">くり返しているリズム</h2>' +
        '<div class="chips">' + picker + '</div>' +
        (haveWd ? '<h3 class="card__sub">曜日ごと</h3>' + bars(wd) +
          (topWd ? '<p class="hint">いちばん高いのは<strong>' + esc(topWd.w) + '曜日</strong>です。</p>' : '') : '') +
        (havePh ? '<h3 class="card__sub">月相ごと</h3>' + bars(ph) +
          (topPh ? '<p class="hint">いちばん高いのは<strong>' + esc(topPh.name) + '</strong>の頃です。</p>' : '') : '') +
        '<p class="footnote">記録の少ない曜日・月相は数字が揺れます。何巡りか続けてから読んでください。</p>' +
      '</section>';
  }

  /* ------------------------------------------------------------ 書く時間 */

  function hours() {
    var h = A.byHour();
    var max = Math.max.apply(null, h);
    if (!max) return '';
    var peak = h.indexOf(max);
    return '' +
      '<section class="card">' +
        '<h2 class="card__title">書いている時間</h2>' +
        '<div class="hrs">' + h.map(function (n, i) {
          return '<span class="hr' + (i === peak ? ' is-peak' : '') + '" title="' + i + '時 ' + n + '件">' +
                 '<i style="height:' + Math.max(2, Math.round(n / max * 100)) + '%"></i>' +
                 (i % 6 === 0 ? '<b>' + i + '</b>' : '') + '</span>';
        }).join('') + '</div>' +
        '<p class="hint">いちばん多いのは <strong>' + peak + '時台</strong>です。' +
          'その時間を空けておくと、書く習慣は続きやすくなります。</p>' +
      '</section>';
  }

  /* ------------------------------------------------------------ 積み上がり */

  function stack(table) {
    var t = A.totals(table);
    var months = A.byMonth();
    var max = months.reduce(function (a, m) { return Math.max(a, m.n); }, 1);

    return '' +
      '<section class="card">' +
        '<h2 class="card__title">積み上がったもの</h2>' +
        '<div class="stats">' +
          '<div><b>' + t.activeDays + '</b><span>記録した日</span></div>' +
          '<div><b>' + t.streak + '</b><span>いま連続</span></div>' +
          '<div><b>' + t.longest + '</b><span>最長連続</span></div>' +
          '<div><b>' + t.notices + '</b><span>気づき</span></div>' +
          '<div><b>' + t.questions + '</b><span>問い</span></div>' +
          '<div><b>' + t.conditionDays + '</b><span>調子の記録</span></div>' +
          '<div><b>' + t.wishes + '</b><span>願い</span></div>' +
          '<div><b>' + t.fulfilled + '</b><span>叶った</span></div>' +
          '<div><b>' + t.rituals + '</b><span>儀式</span></div>' +
        '</div>' +
        (months.length > 1
          ? '<h3 class="card__sub">月ごとに書いた数</h3>' +
            '<div class="mbars">' + months.map(function (m) {
              return '<span class="mbar" title="' + esc(m.key) + '：' + m.n + '件">' +
                     '<i style="height:' + Math.max(3, Math.round(m.n / max * 100)) + '%"></i>' +
                     '<b>' + esc(m.label) + '</b></span>';
            }).join('') + '</div>'
          : '') +
        (t.firstDay ? '<p class="footnote">最初の記録は ' + esc(ui.fmtFull(t.firstDay + 'T12:00:00')) + '。' +
          'ここから積み上がっています。</p>' : '') +
      '</section>';
  }

  /* ---------------------------------------------------------------- 画面 */

  function render(params) {
    A = W.analysis;
    var table = A.dailyTable();
    var range = Number(params.r) || 28;
    var win = range >= 3650 ? table : A.windowOf(table, range);

    if (!table.length) {
      return ui.empty('まだ記録がありません。',
        '〈今日〉でコンディションと気づきを書きはじめると、ここに傾向が出ます。');
    }

    var picker = RANGES.map(function (o) {
      return '<a class="chip' + (o.d === range ? ' is-on' : '') + '" href="#/insight?r=' + o.d +
             (params.m ? '&m=' + esc(params.m) : '') + '">' + esc(o.label) + '</a>';
    }).join('');

    return '' +
      '<section class="card">' +
        '<h2 class="card__title">見わたす</h2>' +
        '<div class="chips">' + picker + '</div>' +
        overview(win, range) +
        trends(win) +
      '</section>' +
      links(table) +          // つながりは全期間で見る（多いほど確かになるので）
      rhythms(table, params.m) +
      hours() +
      stack(table) +
      '<p class="footnote">ここに出る数字は、すべてこの端末の中だけで計算しています。' +
        'どこにも送られていません。</p>';
  }

  W.views = W.views || {};
  W.views.insight = { render: render, mount: function () {}, tab: 'insight' };
})(window.W = window.W || {});
