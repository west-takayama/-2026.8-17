/* ===========================================================================
   analysis.js — たまった記録から、自分の傾向を読む
   ---------------------------------------------------------------------------
   ここでいちばん気をつけているのは「言いすぎないこと」です。

   記録が10日ぶんもあれば、何かしらの相関はいくらでも出ます。でもそれは
   たいてい偶然で、それを「あなたはこうです」と言い切ると、当たっていない
   ことを信じ込ませてしまう。願いや執着を扱う道具でそれをやるのは危ない。

   だから、
     ・日数が足りないうちは何も言わない（最低14日ぶん）
     ・必要な相関の強さを日数で変える（14日なら 0.59、40日なら 0.35 が下限）
       —— 少ない記録で出た数字ほど、厳しく見ないと偶然を拾う
     ・言い方は必ず「〜のようです」にとどめ、根拠の日数を併記する
     ・「〜だから〜になる」とは言わない。順序は分からないので
   =========================================================================== */
(function (W) {
  'use strict';

  var MIN_DAYS = 14;      // これ未満なら、つながりの話はしない
  var MIN_R    = 0.35;    // 日数がいくら増えても、これ未満は取り上げない

  /* 「どれくらいの相関なら偶然でないと言えるか」は日数で変わる。
     14日ぶんしかないときの r=0.4 は、ただの偶然でふつうに出る値で、
     40日ぶんの r=0.4 とはまったく重みが違う。固定のしきい値では、
     記録が少ない時期にいい加減なことを言ってしまう。

     そこで n に応じて厳しさを変える。2.2/√n は 5% 水準の臨界値のおおよその形で、
     係数を 1.96 より大きめに取っているのは、9通りの組を一度に調べているぶん
     偶然の当たりが増えるのを見込んでいるため。 */
  function threshold(n) {
    return Math.max(MIN_R, 2.2 / Math.sqrt(n));
  }

  /* ------------------------------------------------------- 日ごとに束ねる */

  /* コンディションと、その日の行動をひとつの行にまとめる。
     分析はぜんぶこの表の上でやる。 */
  function dailyTable() {
    var s = W.store.state, ui = W.ui;
    var rows = {};

    function row(key, at) {
      if (!rows[key]) {
        rows[key] = {
          day: key, at: at,
          sleep: null, condition: null, space: null,
          notices: 0, dreams: 0, questions: 0,
          gripSum: 0, gripN: 0, intSum: 0, intN: 0
        };
      }
      return rows[key];
    }

    s.days.forEach(function (d) {
      var r = row(d.day, d.at);
      r.sleep = d.sleep; r.condition = d.condition; r.space = d.space;
    });
    s.notices.forEach(function (n) {
      var r = row(ui.dayKey(n.createdAt), n.createdAt);
      r.notices++;
      if (n.kind === 'dream') r.dreams++;
    });
    s.questions.forEach(function (q) {
      row(ui.dayKey(q.createdAt), q.createdAt).questions++;
    });
    s.wishes.forEach(function (w) {
      w.pulses.forEach(function (p) {
        var r = row(ui.dayKey(p.at), p.at);
        r.gripSum += p.grip; r.gripN++;
        r.intSum += p.intensity; r.intN++;
      });
    });

    return Object.keys(rows).map(function (k) {
      var r = rows[k];
      r.grip = r.gripN ? r.gripSum / r.gripN : null;
      r.intensity = r.intN ? r.intSum / r.intN : null;
      r.dream = r.dreams > 0 ? 1 : 0;
      r.date = new Date(r.at);
      return r;
    }).sort(function (a, b) { return a.day < b.day ? -1 : 1; });
  }

  /* ------------------------------------------------------------ 統計の道具 */

  function mean(xs) {
    if (!xs.length) return null;
    return xs.reduce(function (a, b) { return a + b; }, 0) / xs.length;
  }

  /* ピアソンの相関係数。分散がゼロ（ずっと同じ値）のときは何も言えない。 */
  function pearson(pairs) {
    var n = pairs.length;
    if (n < 3) return null;
    var mx = mean(pairs.map(function (p) { return p[0]; }));
    var my = mean(pairs.map(function (p) { return p[1]; }));
    var num = 0, dx = 0, dy = 0;
    pairs.forEach(function (p) {
      var a = p[0] - mx, b = p[1] - my;
      num += a * b; dx += a * a; dy += b * b;
    });
    if (dx === 0 || dy === 0) return null;
    return num / Math.sqrt(dx * dy);
  }

  function pairsOf(table, xKey, yKey) {
    var out = [];
    table.forEach(function (r) {
      if (r[xKey] == null || r[yKey] == null) return;
      out.push([Number(r[xKey]), Number(r[yKey])]);
    });
    return out;
  }

  /* --------------------------------------------------------- つながりを探す */

  /* 見に行く組み合わせ。やみくもに全部を掛け合わせると、
     数が多いぶんだけ偶然の当たりが増えるので、
     「意味を説明できる組」だけをあらかじめ決めておく。 */
  var LINKS = [
    { x: 'sleep', y: 'grip',
      up: 'よく眠れた日ほど、握りしめが強い',
      down: 'よく眠れた日ほど、握りしめがゆるい',
      note: '眠れていないだけなのに「この願いは無理かも」と思えてくることがあります。' },
    { x: 'sleep', y: 'notices',
      up: 'よく眠れた日ほど、書きとめることが多い',
      down: '眠りが短い日ほど、書きとめることが多い' },
    { x: 'sleep', y: 'dream',
      up: '長く眠れた日ほど、夢を思い出せている',
      down: '短く眠った日ほど、夢を思い出せている' },
    { x: 'space', y: 'notices',
      up: '余白のある日ほど、気づくことが多い',
      down: '余白がない日ほど、書きとめることが多い',
      note: '気づく力は、たいてい時間のゆとりについてきます。' },
    { x: 'space', y: 'grip',
      up: '余白のある日ほど、握りしめが強い',
      down: '余白のある日ほど、握りしめがゆるい' },
    { x: 'condition', y: 'intensity',
      up: '調子がよい日ほど、願いを強く思えている',
      down: '調子が落ちている日ほど、願いを強く思っている' },
    { x: 'condition', y: 'grip',
      up: '調子がよい日ほど、握りしめが強い',
      down: '調子が落ちている日ほど、握りしめが強い' },
    { x: 'condition', y: 'notices',
      up: '調子がよい日ほど、書きとめることが多い',
      down: '調子が落ちている日ほど、書きとめることが多い' },
    { x: 'sleep', y: 'condition',
      up: 'よく眠れた日は、調子がよい',
      down: 'よく眠れた日ほど、調子が落ちている' }
  ];

  var LABEL = {
    sleep: '睡眠', condition: '調子', space: '余白',
    grip: '握り', intensity: '強さ', notices: '書きとめた数', dream: '夢の想起'
  };

  function findLinks(table) {
    var out = [];
    LINKS.forEach(function (link) {
      var pairs = pairsOf(table, link.x, link.y);
      if (pairs.length < MIN_DAYS) return;
      var r = pearson(pairs);
      if (r == null || Math.abs(r) < threshold(pairs.length)) return;
      out.push({
        text: r > 0 ? link.up : link.down,
        note: link.note || '',
        r: r, n: pairs.length, need: threshold(pairs.length),
        x: link.x, y: link.y,
        strength: Math.abs(r) >= 0.6 ? 'strong' : Math.abs(r) >= 0.45 ? 'mid' : 'weak'
      });
    });
    out.sort(function (a, b) { return Math.abs(b.r) - Math.abs(a.r); });
    return out;
  }

  /* あと何日ぶん記録すれば、つながりの話ができるようになるか */
  function daysUntilLinks(table) {
    var have = table.filter(function (r) {
      return r.sleep != null || r.condition != null || r.space != null;
    }).length;
    return Math.max(0, MIN_DAYS - have);
  }

  /* --------------------------------------------------------------- まとめ */

  function windowOf(table, days) {
    var from = Date.now() - days * 86400000;
    return table.filter(function (r) { return r.date.getTime() >= from; });
  }

  function summary(table, days) {
    var win = windowOf(table, days);
    function avg(key) {
      var xs = win.filter(function (r) { return r[key] != null; }).map(function (r) { return Number(r[key]); });
      return xs.length ? { v: mean(xs), n: xs.length } : null;
    }
    return {
      days: days,
      sleep: avg('sleep'), condition: avg('condition'), space: avg('space'),
      grip: avg('grip'), intensity: avg('intensity'),
      notices: win.reduce(function (a, r) { return a + r.notices; }, 0),
      questions: win.reduce(function (a, r) { return a + r.questions; }, 0),
      recorded: win.filter(function (r) { return r.sleep != null || r.condition != null; }).length
    };
  }

  /* 曜日ごとの傾向。「月曜は握りが強い」のような、生活の形が出る。 */
  var WDAY = ['日', '月', '火', '水', '木', '金', '土'];

  function byWeekday(table, key) {
    var buckets = WDAY.map(function (w) { return { w: w, xs: [] }; });
    table.forEach(function (r) {
      if (r[key] == null) return;
      buckets[r.date.getDay()].xs.push(Number(r[key]));
    });
    return buckets.map(function (b) {
      return { w: b.w, n: b.xs.length, v: b.xs.length ? mean(b.xs) : null };
    });
  }

  /* 月相ごとの傾向。〈月〉にあった集計を、ここで数値も見られるようにする。 */
  function byPhase(table, key) {
    var out = {};
    W.moon.PHASES.forEach(function (p) { out[p.key] = { name: p.name, xs: [] }; });
    table.forEach(function (r) {
      if (r[key] == null) return;
      var k = W.moon.phase(r.date).key;
      if (out[k]) out[k].xs.push(Number(r[key]));
    });
    return W.moon.PHASES.map(function (p) {
      var b = out[p.key];
      return { key: p.key, name: p.name, n: b.xs.length, v: b.xs.length ? mean(b.xs) : null };
    });
  }

  /* 何時ごろ書いているか */
  function byHour() {
    var h = new Array(24).fill(0);
    W.store.state.notices.forEach(function (n) { h[new Date(n.createdAt).getHours()]++; });
    return h;
  }

  /* 積み上がり。続いていること自体が、この道具の成果でもある。 */
  function totals(table) {
    var s = W.store.state, ui = W.ui;
    var wrote = {};
    s.notices.forEach(function (n) { wrote[ui.dayKey(n.createdAt)] = true; });
    s.days.forEach(function (d) { wrote[d.day] = true; });

    var keys = Object.keys(wrote).sort();
    var longest = 0, run = 0, prev = null;
    keys.forEach(function (k) {
      var d = new Date(k + 'T00:00:00');
      run = (prev && Math.round((d - prev) / 86400000) === 1) ? run + 1 : 1;
      if (run > longest) longest = run;
      prev = d;
    });

    var d = new Date();
    if (!wrote[ui.dayKey(d)]) d.setDate(d.getDate() - 1);
    var now = 0;
    while (wrote[ui.dayKey(d)]) { now++; d.setDate(d.getDate() - 1); }

    return {
      firstDay: keys[0] || null,
      activeDays: keys.length,
      streak: now,
      longest: longest,
      notices: s.notices.length,
      questions: s.questions.length,
      wishes: s.wishes.length,
      fulfilled: s.wishes.filter(function (w) { return w.status === 'fulfilled'; }).length,
      released: s.wishes.filter(function (w) { return w.status === 'released'; }).length,
      rituals: s.rituals.length,
      conditionDays: s.days.length
    };
  }

  /* 月ごとの記録数（積み上がりを目で見るため） */
  function byMonth() {
    var s = W.store.state, ui = W.ui, m = {};
    s.notices.forEach(function (n) {
      var d = new Date(n.createdAt);
      var k = d.getFullYear() + '-' + (d.getMonth() + 1);
      m[k] = (m[k] || 0) + 1;
    });
    return Object.keys(m).sort().slice(-12).map(function (k) {
      return { key: k, label: k.split('-')[1] + '月', n: m[k] };
    });
  }

  W.analysis = {
    MIN_DAYS: MIN_DAYS, MIN_R: MIN_R, threshold: threshold, LABEL: LABEL, WDAY: WDAY,
    dailyTable: dailyTable, mean: mean, pearson: pearson, pairsOf: pairsOf,
    findLinks: findLinks, daysUntilLinks: daysUntilLinks,
    summary: summary, windowOf: windowOf,
    byWeekday: byWeekday, byPhase: byPhase, byHour: byHour,
    totals: totals, byMonth: byMonth
  };
})(window.W = window.W || {});
