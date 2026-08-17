/* ===========================================================================
   views/ritual.js — 満月と新月の儀式
   ---------------------------------------------------------------------------
   これまでこのアプリは「満月は感謝と手放しの日です」と声をかけるだけで、
   実際に何をするかは本人の意志任せだった。設計として約束したリズムを、
   ここで実際に回るようにする。

   段階を分けたウィザードにはしていない。スマホで「次へ」を押させると、
   途中でやめたときに何も残らないから。1枚の紙のように上から下へ並べて、
   書けたところだけ残る形にしてある。

   満月 … 一巡りを振り返る → すでに叶っている部分を数える → 握りを確かめる → ひとつ手放す
   新月 … 前の一巡りを見る → 願いを言い直す → 種をまく → 持ち歩く問いを決める
   =========================================================================== */
(function (W) {
  'use strict';
  var ui = W.ui, esc = ui.esc;

  /* -------------------------------------------------------------------------
     どの期間を振り返るか。
     満月のときは「いまの周期のはじまり（直近の新月）から今日まで」。
     新月のときは周期が終わったところなので、「ひとつ前の新月から今日まで」。
     ------------------------------------------------------------------------- */
  function cycleStartFor(kind, now) {
    var thisNew = W.moon.lastNew(now);
    if (kind === 'full') return thisNew;
    // 新月当日は thisNew がほぼ今日なので、さらに一巡り前へさかのぼる
    return W.moon.lastNew(W.moon.addDays(thisNew, -2));
  }

  /* いま「その日」かどうか。前後1日は許す（一日くらい遅れても迎えたい）。 */
  function isNear(kind, now) {
    var d = kind === 'full' ? W.moon.daysToFull(now) : W.moon.daysToNew(now);
    var back = W.moon.SYNODIC - d;                 // 直前に過ぎていた場合
    return d <= 1.2 || back <= 1.2;
  }

  function defaultKind(now) {
    if (isNear('full', now)) return 'full';
    if (isNear('new', now)) return 'new';
    // その日でなくても開けるように、近いほうを出す
    return W.moon.daysToFull(now) <= W.moon.daysToNew(now) ? 'full' : 'new';
  }

  /* ------------------------------------------------------- 一巡りを数える */

  function summarize(startMs, endMs) {
    var s = W.store.state;
    var within = function (iso) {
      if (!iso) return false;
      var t = new Date(iso).getTime();
      return t >= startMs && t <= endMs;
    };

    var notices = s.notices.filter(function (n) { return within(n.createdAt); });
    var byKind = {};
    Object.keys(ui.KINDS).forEach(function (k) { byKind[k] = 0; });
    notices.forEach(function (n) { if (byKind[n.kind] != null) byKind[n.kind]++; });

    return {
      notices: notices,
      byKind: byKind,
      starred: notices.filter(function (n) { return n.starred; }),
      born:     s.wishes.filter(function (w) { return within(w.createdAt); }),
      done:     s.wishes.filter(function (w) { return within(w.fulfilledAt); }),
      released: s.wishes.filter(function (w) { return within(w.releasedAt); }),
      questions: s.questions.filter(function (q) { return within(q.createdAt); }),
      living: s.wishes.filter(function (w) { return w.status === 'living'; })
    };
  }

  /* その周期のあいだに握りがどう動いたか */
  function gripMove(w, startMs, endMs) {
    var ps = w.pulses.filter(function (p) {
      var t = new Date(p.at).getTime();
      return t >= startMs && t <= endMs;
    });
    if (!ps.length) return null;
    return { first: ps[0], last: ps[ps.length - 1], n: ps.length };
  }

  function moveWord(m) {
    if (!m || m.n < 2) return '';
    var d = m.last.grip - m.first.grip;
    if (d <= -2) return 'ずいぶん手がひらきました';
    if (d === -1) return 'すこし手がひらきました';
    if (d === 0)  return '変わっていません';
    if (d === 1)  return 'すこし握りが強くなりました';
    return '握りがかなり強くなりました';
  }

  /* ----------------------------------------------------------- 振り返り */

  function summaryCard(sum, startMs, kind) {
    var days = Math.max(1, ui.daysBetween(new Date(startMs), new Date()) );
    var total = sum.notices.length;

    var kinds = Object.keys(ui.KINDS).filter(function (k) { return sum.byKind[k] > 0; })
      .map(function (k) {
        return '<span class="rk"><i class="nlist__k nlist__k--' + k + '">' +
               esc(ui.KINDS[k].label) + '</i>' + sum.byKind[k] + '</span>';
      }).join('');

    var wishLines = sum.living.map(function (w) {
      var m = gripMove(w, startMs, Date.now());
      var word = moveWord(m);
      return '<li>' +
        '<a href="#/wish/' + esc(w.id) + '">' + esc(w.title) + '</a>' +
        (!m ? '<span class="rg rg--none">この一巡りでは記録していません</span>'
            : m.n < 2
              ? '<span class="rg">握り ' + m.last.grip + '（記録は1回）</span>'
              : '<span class="rg">握り ' + m.first.grip + ' → ' + m.last.grip +
                (word ? '　' + esc(word) : '') + '</span>') +
      '</li>';
    }).join('');

    return '' +
      '<section class="card">' +
        '<h2 class="card__title">この一巡りにあったこと</h2>' +
        '<p class="hint">' + esc(ui.fmtFull(new Date(startMs))) + 'の新月から、' + days + '日。</p>' +
        (total || sum.born.length || sum.done.length
          ? '<div class="rcounts">' +
              (total ? '<div class="rc"><b>' + total + '</b><span>書きとめたこと</span></div>' : '') +
              (sum.questions.length ? '<div class="rc"><b>' + sum.questions.length + '</b><span>立てた問い</span></div>' : '') +
              (sum.born.length ? '<div class="rc"><b>' + sum.born.length + '</b><span>立てた願い</span></div>' : '') +
              (sum.done.length ? '<div class="rc rc--gold"><b>' + sum.done.length + '</b><span>叶った願い</span></div>' : '') +
              (sum.released.length ? '<div class="rc"><b>' + sum.released.length + '</b><span>手放した願い</span></div>' : '') +
            '</div>'
          : '<p class="hint">この一巡りには、まだ記録がありません。' +
            (kind === 'full' ? '数えられなくても、月は満ちています。' : '') + '</p>') +
        (kinds ? '<div class="rkinds">' + kinds + '</div>' : '') +

        (sum.done.length
          ? '<h3 class="card__sub">叶ったもの</h3><ul class="rlist rlist--gold">' +
            sum.done.map(function (w) {
              return '<li>✓ <a href="#/wish/' + esc(w.id) + '">' + esc(w.title) + '</a>' +
                     '<span class="rg">' + esc(w.moonAtFulfill ? w.moonAtFulfill.name : '') + 'の日に</span></li>';
            }).join('') + '</ul>' : '') +

        (sum.starred.length
          ? '<h3 class="card__sub">しるしをつけたもの</h3><ul class="rlist">' +
            sum.starred.slice(0, 6).map(function (n) {
              return '<li>' + W.moon.svg(new Date(n.createdAt), 12) +
                     '<i class="nlist__k nlist__k--' + esc(n.kind) + '">' + esc(ui.KINDS[n.kind].label) + '</i>' +
                     esc(n.text) + '</li>';
            }).join('') + '</ul>' : '') +

        (sum.living.length
          ? '<h3 class="card__sub">育てている願いの、この一巡り</h3><ul class="rlist rlist--wish">' + wishLines + '</ul>'
          : '') +
        conditionOfCycle(startMs) +
      '</section>';
  }

  /* この一巡りの、からだの側。握りしめの正体が眠りだった、ということはよくある。 */
  function conditionOfCycle(startMs) {
    var A = W.analysis;
    var rows = A.dailyTable().filter(function (r) {
      return r.date.getTime() >= startMs && (r.sleep != null || r.condition != null || r.space != null);
    });
    if (rows.length < 3) return '';

    function avg(key) {
      var xs = rows.filter(function (r) { return r[key] != null; }).map(function (r) { return Number(r[key]); });
      return xs.length ? Math.round(A.mean(xs) * 10) / 10 : null;
    }
    var sleep = avg('sleep'), cond = avg('condition'), space = avg('space');

    // この一巡りのなかで、睡眠と握りが動きをともにしていたか
    var pairs = A.pairsOf(rows, 'sleep', 'grip');
    var r = pairs.length >= 8 ? A.pearson(pairs) : null;
    var line = '';
    if (r != null && Math.abs(r) >= 0.4) {
      line = r < 0
        ? '<p class="hint">この一巡りでは、よく眠れた日ほど握りがゆるんでいました。' +
          '手放せないと感じた日は、眠りが足りていなかっただけかもしれません。</p>'
        : '<p class="hint">この一巡りでは、よく眠れた日ほど握りが強くなっていました。' +
          '元気なときほど力が入るのかもしれません。</p>';
    }

    return '<h3 class="card__sub">この一巡りの、からだ</h3>' +
      '<div class="rcounts">' +
        (sleep != null ? '<div class="rc"><b>' + sleep + '</b><span>平均睡眠</span></div>' : '') +
        (cond != null ? '<div class="rc"><b>' + cond + '</b><span>調子</span></div>' : '') +
        (space != null ? '<div class="rc"><b>' + space + '</b><span>余白</span></div>' : '') +
        '<div class="rc"><b>' + rows.length + '</b><span>記録した日</span></div>' +
      '</div>' + line;
  }

  /* --------------------------------------------------------- 満月の儀式 */

  function fullMoon(sum, startMs, saved) {
    var g = (saved && saved.gratitude) || [];

    // 前回の値をあらかじめ選んでおくと、それを追認するだけになりやすい。
    // 儀式なので、毎回あらためて選び直してもらう。前回の値は横に小さく出すだけ。
    var grips = sum.living.map(function (w) {
      var lp = W.store.lastPulse(w);
      return '<div class="rgrip">' +
        '<div class="rgrip__t">' + esc(w.title) +
          (lp ? '<em class="rgrip__prev">前回 ' + lp.grip + '</em>' : '') + '</div>' +
        ui.scale('grip-' + w.id, null, ['ゆだねている', '握りしめている']) +
      '</div>';
    }).join('');

    return '' +
      summaryCard(sum, startMs, 'full') +

      '<section class="card">' +
        '<h2 class="card__title">すでに叶っている部分を、三つ</h2>' +
        '<p class="hint">これから欲しいものではなく、もう手の中にあるものを書きます。' +
          '小さいほどよいです。書いたものは〈感謝〉として記録に残ります。</p>' +
        '<input id="g0" class="in" type="text" value="' + esc(g[0] || '') + '" placeholder="ひとつめ">' +
        '<input id="g1" class="in" type="text" value="' + esc(g[1] || '') + '" placeholder="ふたつめ">' +
        '<input id="g2" class="in" type="text" value="' + esc(g[2] || '') + '" placeholder="みっつめ">' +
      '</section>' +

      (sum.living.length
        ? '<section class="card">' +
            '<h2 class="card__title">握りしめを、確かめる</h2>' +
            '<p class="hint">満ちた月の下で、いちどだけ正直に。' +
              '強く思うことと、握りしめることは別物です。' +
              '（強さは前回の記録を引き継ぎます）</p>' +
            grips +
          '</section>'
        : '') +

      '<section class="card">' +
        '<h2 class="card__title">ひとつ、手放す</h2>' +
        '<p class="hint">願いそのものでなくて構いません。' +
          '「こうでなければ」と決めていたことを、ひとつだけ外します。</p>' +
        '<textarea id="letGo" class="ta" rows="2" placeholder="例：この人に認められなければ意味がない、と思っていた">' +
          esc((saved && saved.letGo) || '') + '</textarea>' +
        (sum.living.length
          ? '<label class="lb">願いごと手放すなら<small>選ばなくて構いません</small></label>' +
            '<select id="releaseWish" class="sel"><option value="">（手放さない）</option>' +
            sum.living.map(function (w) {
              return '<option value="' + esc(w.id) + '">' + esc(w.title) + '</option>';
            }).join('') + '</select>'
          : '') +
      '</section>';
  }

  /* --------------------------------------------------------- 新月の儀式 */

  function newMoon(sum, startMs, saved, prevFull) {
    var rewrites = sum.living.map(function (w) {
      return '<div class="rword">' +
        '<div class="rword__t">' + esc(w.title) + '</div>' +
        '<textarea class="ta rword__in" data-wish="' + esc(w.id) + '" rows="2" ' +
          'placeholder="いまの言葉で言い直すなら（そのままでよければ空のまま）"></textarea>' +
      '</div>';
    }).join('');

    var qs = W.store.state.questions.filter(function (q) { return !q.archived; });

    return '' +
      summaryCard(sum, startMs, 'new') +

      (prevFull && (prevFull.letGo || (prevFull.gratitude || []).length)
        ? '<section class="card card--soft">' +
            '<h3 class="card__sub">前の満月に、あなたが書いたこと</h3>' +
            ((prevFull.gratitude || []).filter(Boolean).length
              ? '<ul class="rlist">' + prevFull.gratitude.filter(Boolean).map(function (t) {
                  return '<li>・' + esc(t) + '</li>';
                }).join('') + '</ul>' : '') +
            (prevFull.letGo ? '<p class="rletgo">手放したもの … ' + esc(prevFull.letGo) + '</p>' : '') +
          '</section>'
        : '') +

      (sum.living.length
        ? '<section class="card">' +
            '<h2 class="card__title">願いを、言い直す</h2>' +
            '<p class="hint">一巡りのあいだに、輪郭が変わっているかもしれません。' +
              '言い直すことはぶれることではありません。空のままなら、そのままにします。</p>' +
            rewrites +
          '</section>'
        : '') +

      '<section class="card">' +
        '<h2 class="card__title">この一巡りの、意図</h2>' +
        '<p class="hint">願いとは別に、次の29日をどんな時間にしたいか。一文で。</p>' +
        '<textarea id="intention" class="ta" rows="2" placeholder="例：急がない。ひとつのことを、深くやる。">' +
          esc((saved && saved.intention) || '') + '</textarea>' +
      '</section>' +

      '<section class="card">' +
        '<h2 class="card__title">持ち歩く問いを、ひとつ</h2>' +
        '<p class="hint">この一巡りのあいだ、答えを出さずに持ち歩く問いを決めます。</p>' +
        (qs.length
          ? '<select id="focusQ" class="sel sel--wide"><option value="">（決めない）</option>' +
            qs.map(function (q) {
              var on = saved && saved.focusQuestionId === q.id;
              return '<option value="' + esc(q.id) + '"' + (on ? ' selected' : '') + '>' + esc(q.text) + '</option>';
            }).join('') + '</select>'
          : '') +
        '<label class="lb">あたらしく立てるなら</label>' +
        '<input id="newQ" class="in" type="text" placeholder="この一巡りのあいだ、持ち歩きたい問い">' +
        '<div class="row"><a class="btn btn--ghost" href="#/wishes?new=1">あたらしい願いを立てる</a></div>' +
      '</section>';
  }

  /* -------------------------------------------------------------- 画面 */

  function render(params) {
    var now = new Date();
    var kind = (params.kind === 'full' || params.kind === 'new') ? params.kind : defaultKind(now);
    var other = kind === 'full' ? 'new' : 'full';
    var start = cycleStartFor(kind, now);
    var startMs = start.getTime();
    var sum = summarize(startMs, Date.now());
    var saved = W.store.getRitual(kind, start);

    // 新月の儀式では、直前の満月に書いたものを見せて流れをつなぐ
    var prevFull = kind === 'new' ? W.store.getRitual('full', start) : null;

    var head = '' +
      '<section class="rhead rhead--' + kind + '">' +
        '<div class="rhead__moon">' +
          W.moon.svg(kind === 'full' ? W.moon.addDays(W.moon.lastNew(now), W.moon.SYNODIC / 2) : W.moon.lastNew(now), 64) +
        '</div>' +
        '<div>' +
          '<div class="rhead__k">' + (kind === 'full' ? '満月の儀式' : '新月の儀式') + '</div>' +
          '<h1 class="rhead__t">' + (kind === 'full' ? '感謝して、手をひらく' : '種をまく') + '</h1>' +
          '<p class="rhead__n">' + (kind === 'full'
            ? 'いちばん明るい夜です。受け取ったものを数えて、握った手をひらきます。'
            : 'いちばん暗い夜です。前の一巡りを閉じて、あたらしい種をまきます。') + '</p>' +
          (isNear(kind, now) ? '<span class="rhead__today">今日がその日です</span>' : '') +
        '</div>' +
      '</section>' +
      (saved ? '<p class="rsaved">この周期の儀式は ' + esc(ui.fmtFull(saved.at)) +
        ' に記録しました。書き足すと上書きされます。</p>' : '');

    var body = kind === 'full' ? fullMoon(sum, startMs, saved) : newMoon(sum, startMs, saved, prevFull);

    return head + body +
      '<section class="card card--actions rfoot">' +
        '<button class="btn btn--done" data-act="save">' +
          (kind === 'full' ? 'この満月を記録する' : 'この新月を記録する') + '</button>' +
        '<a class="btn btn--ghost" href="#/ritual?kind=' + other + '">' +
          (other === 'full' ? '満月の儀式を見る' : '新月の儀式を見る') + '</a>' +
      '</section>' +
      '<p class="footnote">その日でなくても開けます。一日遅れても、月は待っていてくれます。</p>';
  }

  function mount(root, params) {
    var now = new Date();
    var kind = (params.kind === 'full' || params.kind === 'new') ? params.kind : defaultKind(now);
    var start = cycleStartFor(kind, now);

    ui.bindScales(root);
    root.querySelectorAll('.ta').forEach(ui.autogrow);

    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      if (b.dataset.act !== 'save') return;

      if (kind === 'full') saveFull(root, start);
      else saveNew(root, start);
    });
  }

  function saveFull(root, start) {
    var gratitude = ['g0', 'g1', 'g2'].map(function (id) {
      return (root.querySelector('#' + id).value || '').trim();
    });
    var letGo = (root.querySelector('#letGo').value || '').trim();

    // 感謝は儀式の記録に残しつつ、〈気づき〉にも流す。あとで読み返せるように。
    var prev = W.store.getRitual('full', start);
    var already = (prev && prev.gratitude) || [];
    gratitude.forEach(function (t) {
      if (t && already.indexOf(t) < 0) W.store.addNotice(t, 'thanks', null);
    });

    // 握りの記録。強さは前回の値を引き継ぐ（満月に見たいのは握りのほうなので）
    W.store.state.wishes.filter(function (w) { return w.status === 'living'; })
      .forEach(function (w) {
        var v = ui.scaleValue(root, 'grip-' + w.id);
        if (!v) return;
        var lp = W.store.lastPulse(w);
        W.store.addPulse(w.id, lp ? lp.intensity : 3, v, '満月の儀式にて');
      });

    var rel = root.querySelector('#releaseWish');
    if (rel && rel.value) {
      var w = W.store.getWish(rel.value);
      if (w && confirm('「' + w.title + '」を手放します。よろしいですか？')) {
        W.store.releaseWish(w.id, letGo);
      }
    }

    W.store.saveRitual('full', start, { gratitude: gratitude, letGo: letGo });
    ui.toast('満月を記録しました');
  }

  function saveNew(root, start) {
    // 願いの言い直し（空欄はそのまま）
    root.querySelectorAll('.rword__in').forEach(function (ta) {
      var t = (ta.value || '').trim();
      if (!t) return;
      var w = W.store.getWish(ta.dataset.wish);
      if (!w || t === w.title) return;
      W.store.editWish(w.id, { title: t });
    });

    var focus = root.querySelector('#focusQ');
    var focusId = focus ? focus.value : null;

    var nq = root.querySelector('#newQ');
    if (nq && nq.value.trim()) {
      focusId = W.store.addQuestion(nq.value.trim(), null, null).id;
      nq.value = '';
    }

    W.store.saveRitual('new', start, {
      intention: (root.querySelector('#intention').value || '').trim(),
      focusQuestionId: focusId || null
    });
    ui.toast('新月を記録しました');
  }

  W.views = W.views || {};
  W.views.ritual = { render: render, mount: mount, tab: 'moon' };
  W.ritual = { cycleStartFor: cycleStartFor, isNear: isNear, defaultKind: defaultKind };
})(window.W = window.W || {});
