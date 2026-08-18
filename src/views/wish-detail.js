/* ===========================================================================
   views/wish-detail.js — ひとつの願い
   ---------------------------------------------------------------------------
   このアプリの中心。ここで2つの軸を別々に記録する。
     強さ … どれだけ強く思っているか（高いほどよい）
     握り … どれだけ握りしめているか（低いほどよい）
   ふつうの目標管理は「進捗」ひとつに潰してしまうが、
   それでは「強く思っているのに執着していない」状態を見ることができない。
   =========================================================================== */
(function (W) {
  'use strict';
  var ui = W.ui, esc = ui.esc;

  function editForm(w) {
    return '' +
      '<section class="card card--form">' +
        '<h2 class="card__title">願いを書き直す</h2>' +
        '<label class="lb">願い</label>' +
        '<input id="eTitle" class="in" type="text" value="' + esc(w.title) + '" maxlength="120">' +
        '<label class="lb">なぜ、それを願うのか</label>' +
        '<textarea id="eEssence" class="ta" rows="3">' + esc(w.essence) + '</textarea>' +
        '<label class="lb">叶ったときの情景</label>' +
        '<textarea id="eScene" class="ta" rows="3">' + esc(w.scene) + '</textarea>' +
        '<p class="hint">言い直すことは、ぶれることではありません。' +
          '問いを重ねた分だけ、願いの輪郭は変わります。</p>' +
        '<div class="row row--end">' +
          '<a class="btn btn--ghost" href="#/wish/' + esc(w.id) + '">やめる</a>' +
          '<button class="btn btn--primary" data-act="save-edit">保存する</button>' +
        '</div>' +
      '</section>';
  }

  function head(w) {
    var born = new Date(w.createdAt);
    var days = ui.daysBetween(w.createdAt, new Date());
    var badge = w.status === 'fulfilled'
      ? '<span class="badge badge--done">✓ 叶いました</span>'
      : w.status === 'released'
      ? '<span class="badge badge--rel">○ 手放しました</span>' : '';

    return '' +
      '<section class="whead">' +
        '<div class="whead__moon">' + W.moon.svg(born, 44) + '</div>' +
        '<div>' +
          '<div class="whead__meta">' + esc(w.moonAtCreate ? w.moonAtCreate.name : '') + 'に立てた願い' +
            '・' + days + '日目</div>' +
          '<h1 class="whead__title">' + esc(w.title) + '</h1>' +
          badge +
        '</div>' +
      '</section>' +
      (w.status === 'living'
        ? '<a class="deepcta" href="#/deepen/' + esc(w.id) + '">' +
            '<span class="deepcta__t">この願いを、深める</span>' +
            '<span class="deepcta__n">4つの問いに答えて、輪郭をはっきりさせる' +
              (W.ai.enabled() ? '（AIが問いを立てます）' : '') + '</span>' +
          '</a>'
        : '') +
      wordHistory(w) +
      (w.essence ? '<section class="card card--soft"><h3 class="card__sub">なぜ、それを願うのか</h3><p>' + ui.nl2br(w.essence) + '</p></section>' : '') +
      (w.scene ? '<section class="card card--soft"><h3 class="card__sub">叶ったときの情景</h3><p>' + ui.nl2br(w.scene) + '</p></section>' : '');
  }

  /* 言い直しの来歴。問いの系譜と同じ考えで、前の形を消さずに残す。
     最初の言葉と今の言葉を見比べると、輪郭が動いた距離が見える。 */
  function wordHistory(w) {
    if (!w.history || !w.history.length) return '';
    var rows = w.history.map(function (h, i) {
      return '<li class="wh__i"><span class="wh__n">' + (i + 1) + '</span>' +
        '<div><div class="wh__t">' + esc(h.title) + '</div>' +
        '<div class="wh__m">' + esc(ui.fmtFull(h.at)) +
          (h.moon ? '・' + esc(h.moon.name) : '') +
          (h.note ? '・' + esc(h.note) : '') + '</div></div></li>';
    }).join('');
    return '<section class="card card--soft">' +
      '<h3 class="card__sub">この願いの、言い直しの来歴</h3>' +
      '<ol class="wh">' + rows +
        '<li class="wh__i is-now"><span class="wh__n">' + (w.history.length + 1) + '</span>' +
        '<div><div class="wh__t">' + esc(w.title) + '</div>' +
        '<div class="wh__m">いま</div></div></li>' +
      '</ol>' +
      '<p class="hint">言い直すことは、ぶれることではありません。' +
        '輪郭が変わった分だけ、問いが効いたということです。</p></section>';
  }

  function fulfilledBlock(w) {
    if (w.status !== 'fulfilled') return '';
    return '' +
      '<section class="card card--done">' +
        '<div class="done__moon">' + W.moon.svg(new Date(w.fulfilledAt), 40) + '</div>' +
        '<div class="done__body">' +
          '<h2 class="card__title">叶いました</h2>' +
          '<p class="done__meta">' + esc(ui.fmtFull(w.fulfilledAt)) + '　' +
            esc(w.moonAtFulfill ? w.moonAtFulfill.name : '') + 'の日に。' +
            '　立ててから ' + ui.daysBetween(w.createdAt, w.fulfilledAt) + '日目。</p>' +
          '<label class="lb">振り返り<small>どんな形で叶ったか。想像と何がちがったか。</small></label>' +
          '<textarea id="doneNote" class="ta" rows="3" placeholder="叶い方は、たいてい想像とすこしちがう">' + esc(w.fulfilledNote) + '</textarea>' +
          '<div class="row row--end">' +
            '<button class="btn btn--ghost" data-act="revive">育てているに戻す</button>' +
            '<button class="btn btn--primary" data-act="save-done-note">残す</button>' +
          '</div>' +
        '</div>' +
      '</section>';
  }

  function releasedBlock(w) {
    if (w.status !== 'released') return '';
    return '' +
      '<section class="card card--rel">' +
        '<h2 class="card__title">手放しました</h2>' +
        '<p class="done__meta">' + esc(ui.fmtFull(w.releasedAt)) + '</p>' +
        (w.releaseNote ? '<p>' + ui.nl2br(w.releaseNote) + '</p>' : '') +
        '<p class="hint">手放すことは、あきらめとは違います。' +
          '本当に欲しかったものが別の形で見えたとき、願いは役目を終えます。</p>' +
        '<div class="row row--end"><button class="btn btn--ghost" data-act="revive">育てているに戻す</button></div>' +
      '</section>';
  }

  /* 今日の温度 ＋ 推移 */
  function pulseBlock(w) {
    if (w.status !== 'living') return '';
    var ps = w.pulses;
    var last = ps.length ? ps[ps.length - 1] : null;
    var recorded = last && ui.dayKey(last.at) === ui.dayKey(new Date());

    var trend = '';
    if (ps.length) {
      var ints = ps.slice(-14).map(function (p) { return p.intensity; });
      var grips = ps.slice(-14).map(function (p) { return p.grip; });
      var tightening = ps.length >= 2 && ps.slice(-2).every(function (p) { return p.grip >= 4; });

      trend = '' +
        '<div class="trend">' +
          '<div class="trend__row"><span class="trend__lb">強さ</span>' +
            '<span class="trend__spark trend__spark--int">' + ui.sparkline(ints) + '</span>' +
            '<span class="trend__now">' + last.intensity + '</span></div>' +
          '<div class="trend__row"><span class="trend__lb">握り</span>' +
            '<span class="trend__spark trend__spark--grip">' + ui.sparkline(grips) + '</span>' +
            '<span class="trend__now">' + last.grip + '</span></div>' +
          '<p class="trend__read">' + esc(reading(last.intensity, last.grip)) + '</p>' +
        '</div>' +
        (tightening ? '<div class="nudge">' +
          '<strong>握りしめているかもしれません。</strong>' +
          '<p>強く思うことと、握りしめることは別物です。手放すための問いを、ひとつ立ててみませんか。</p>' +
          '<button class="btn btn--ghost" data-act="letgo-question">「叶わなくても、私が本当に欲しかったものは何だろう？」を立てる</button>' +
          '</div>' : '');
    }

    return '' +
      '<section class="card">' +
        '<h2 class="card__title">今日の温度' + (recorded ? '<span class="count count--ok">記録ずみ</span>' : '') + '</h2>' +
        '<label class="lb">強さ<small>この願いを、どれだけ強く思っているか</small></label>' +
        ui.scale('intensity', last ? last.intensity : 3, ['ぼんやり', '芯から']) +
        '<label class="lb">握り<small>叶わないと困る、と感じている度合い</small></label>' +
        ui.scale('grip', last ? last.grip : 3, ['ゆだねている', '握りしめている']) +
        '<textarea id="pulseNote" class="ta" rows="1" placeholder="ひとこと（任意）"></textarea>' +
        '<div class="row row--end"><button class="btn btn--primary" data-act="pulse-save">記録する</button></div>' +
      '</section>' + trend;
  }

  /* 2軸の組み合わせを言葉にする。数字だけだと意味が立ち上がらないので。 */
  function reading(intensity, grip) {
    if (intensity >= 4 && grip <= 2) return 'いちばん良い状態です。強く思いながら、結果はゆだねられています。';
    if (intensity >= 4 && grip >= 4) return '強く思えています。ただ、握る力も強い。少しだけ手をひらいてみましょう。';
    if (intensity <= 2 && grip >= 4) return '思いは薄いのに、離せない状態です。この願いは、まだ本当に自分のものでしょうか。';
    if (intensity <= 2 && grip <= 2) return '熱が下がっています。手放すか、なぜ願ったのかをもう一度読み返す頃かもしれません。';
    return '穏やかな状態です。このまま日々の気づきを拾っていきましょう。';
  }

  function questionsBlock(w) {
    var qs = W.store.state.questions.filter(function (q) { return q.wishId === w.id; });
    var list = qs.length
      ? '<ul class="qlist">' + qs.map(function (q) {
          var g = W.coach.grade(W.store.scoreOf(q));
          return '<li><a href="#/question/' + esc(q.id) + '">' +
                 '<span class="qlist__t">' + esc(q.text) + '</span>' +
                 '<span class="pill pill--' + g.cls + '">' + esc(g.label) + '</span></a></li>';
        }).join('') + '</ul>'
      : '<p class="hint">この願いには、まだ問いがありません。願いは、問いの数だけ輪郭がはっきりします。</p>';

    return '' +
      '<section class="card">' +
        '<h2 class="card__title">この願いへの問い' + (qs.length ? '<span class="count">' + qs.length + '</span>' : '') + '</h2>' +
        list +
        '<div class="row"><input id="qQuick" class="in" type="text" placeholder="問いを立てる">' +
        '<button class="btn" data-act="q-add">加える</button></div>' +
      '</section>';
  }

  function noticesBlock(w) {
    var ns = W.store.state.notices.filter(function (n) { return n.wishId === w.id; });
    var body = ns.length
      ? '<ul class="nlist">' + ns.slice(0, 12).map(function (n) {
          return '<li><span class="nlist__moon">' + W.moon.svg(new Date(n.createdAt), 12) + '</span>' +
                 '<span class="nlist__k nlist__k--' + esc(n.kind) + '">' + esc(ui.KINDS[n.kind].label) + '</span>' +
                 '<span class="nlist__t">' + ui.nl2br(n.text) + '</span>' +
                 '<span class="nlist__d">' + esc(ui.ago(n.createdAt)) + '</span></li>';
        }).join('') + '</ul>' + (ns.length > 12 ? '<p class="hint"><a href="#/notices?wish=' + esc(w.id) + '">すべて見る（' + ns.length + '）</a></p>' : '')
      : '<p class="hint">まだ兆しは記録されていません。願いは、たいてい小さく先触れします。</p>';

    return '' +
      '<section class="card">' +
        '<h2 class="card__title">届いた小さなもの' + (ns.length ? '<span class="count">' + ns.length + '</span>' : '') + '</h2>' +
        body +
        '<div class="row"><input id="nQuick" class="in" type="text" placeholder="兆し・気づきを書きとめる">' +
        '<button class="btn" data-act="n-add">加える</button></div>' +
      '</section>';
  }

  function actionsBlock(w) {
    if (w.status !== 'living') {
      return '<section class="card card--actions">' +
        '<a class="btn btn--ghost" href="#/wish/' + esc(w.id) + '?edit=1">書き直す</a>' +
        '<button class="btn btn--danger" data-act="delete">消す</button></section>';
    }
    var quiet = W.store.isQuiet(w);
    var toFull = Math.max(1, Math.round(W.moon.daysToFull(new Date())));
    return '' +
      '<section class="card card--actions">' +
        '<button class="btn btn--done" data-act="fulfill">✓ 叶いました</button>' +
        (quiet
          ? '<button class="btn btn--ghost" data-act="unquiet">そっと置くのをやめる</button>'
          : '<button class="btn btn--ghost" data-act="quiet">次の満月まで、そっと置く（' + toFull + '日）</button>') +
        '<button class="btn btn--ghost" data-act="release">手放す</button>' +
        '<a class="btn btn--ghost" href="#/wish/' + esc(w.id) + '?edit=1">書き直す</a>' +
        '<button class="btn btn--danger" data-act="delete">消す</button>' +
      '</section>' +
      (quiet ? '<p class="footnote">そっと置いている間、この願いは〈今日〉に出てきません。' +
        '思い出さないでいられる日々が、いちばんよく効きます。</p>' : '');
  }

  function render(params) {
    var w = W.store.getWish(params.id);
    if (!w) return ui.empty('その願いは見つかりませんでした。', '消されたか、別の端末のデータかもしれません。');
    if (params.edit) return editForm(w);

    return head(w) + fulfilledBlock(w) + releasedBlock(w) +
           pulseBlock(w) + questionsBlock(w) + noticesBlock(w) + actionsBlock(w);
  }

  function mount(root, params) {
    var w = W.store.getWish(params.id);
    if (!w) return;
    ui.bindScales(root);
    root.querySelectorAll('.ta').forEach(ui.autogrow);

    root.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      if (e.target.id === 'qQuick') { e.preventDefault(); addQuestion(); }
      if (e.target.id === 'nQuick') { e.preventDefault(); addNotice(); }
    });

    function addQuestion() {
      var i = root.querySelector('#qQuick'), t = i.value.trim();
      if (!t) return;
      W.store.addQuestion(t, w.id, null);
      i.value = '';
      ui.toast('問いを立てました');
    }
    function addNotice() {
      var i = root.querySelector('#nQuick'), t = i.value.trim();
      if (!t) return;
      W.store.addNotice(t, 'sign', w.id);
      i.value = '';
      ui.toast('書きとめました');
    }

    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      var act = b.dataset.act;

      if (act === 'save-edit') {
        var newTitle = root.querySelector('#eTitle').value.trim();
        // 願いの文そのものが変わったときは、前の形を来歴に残してから差し替える
        if (newTitle && newTitle !== w.title) W.store.rewordWish(w.id, newTitle, '書き直し');
        W.store.editWish(w.id, {
          essence: root.querySelector('#eEssence').value,
          scene:   root.querySelector('#eScene').value
        });
        location.hash = '#/wish/' + w.id;
      }

      if (act === 'pulse-save') {
        var intensity = ui.scaleValue(root, 'intensity');
        var grip = ui.scaleValue(root, 'grip');
        if (!intensity || !grip) { ui.toast('強さと握りを選んでください'); return; }
        var pn = root.querySelector('#pulseNote');
        W.store.addPulse(w.id, intensity, grip, pn.value);
        pn.value = ''; pn.dispatchEvent(new Event('input'));
        ui.toast('記録しました');
      }

      if (act === 'q-add') addQuestion();
      if (act === 'n-add') addNotice();

      if (act === 'letgo-question') {
        W.store.addQuestion('叶わなくても、私が本当に欲しかったものは何だろう？', w.id, null);
        ui.toast('手放すための問いを立てました');
      }

      if (act === 'fulfill') {
        if (confirm('「' + w.title + '」は叶いましたか？')) W.store.fulfillWish(w.id);
      }

      if (act === 'save-done-note') {
        W.store.editWish(w.id, { fulfilledNote: root.querySelector('#doneNote').value });
        ui.toast('残しました');
      }

      if (act === 'release') {
        var note = prompt('手放します。ひとこと残しますか？（そのままでも構いません）\n' +
                          '例：本当に欲しかったのは、この形ではなかった。', '');
        if (note === null) return;
        W.store.releaseWish(w.id, note);
        ui.toast('手放しました');
      }

      if (act === 'revive')  W.store.reviveWish(w.id);
      if (act === 'quiet')   { W.store.quiet(w.id, Math.max(1, W.moon.daysToFull(new Date()))); ui.toast('そっと置きました'); }
      if (act === 'unquiet') W.store.unquiet(w.id);

      if (act === 'delete') {
        if (confirm('この願いを完全に消します。記録は戻せません。よろしいですか？')) {
          W.store.removeWish(w.id);
          location.hash = '#/wishes';
        }
      }
    });
  }

  W.views = W.views || {};
  W.views.wish = { render: render, mount: mount, tab: 'wishes' };
})(window.W = window.W || {});
