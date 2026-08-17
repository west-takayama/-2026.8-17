/* ===========================================================================
   views/today.js — 今日
   ---------------------------------------------------------------------------
   毎日ひらく画面。ここに全部を詰め込まない。
   「今日の月」「今日の問い」「今日の気づき」「育てている願い」の4つだけ。
   =========================================================================== */
(function (W) {
  'use strict';
  var ui = W.ui, esc = ui.esc;

  /* 選んだ種類は覚えておく（描き直しで既定値に戻らないように） */
  var lastKind = 'sign';

  function streak() {
    // 気づきを書いた日が何日続いているか（今日または昨日を起点に数える）
    var days = {};
    W.store.state.notices.forEach(function (n) { days[ui.dayKey(n.createdAt)] = true; });
    var d = new Date();
    if (!days[ui.dayKey(d)]) d.setDate(d.getDate() - 1);
    var c = 0;
    while (days[ui.dayKey(d)]) { c++; d.setDate(d.getDate() - 1); }
    return c;
  }

  function moonHero() {
    var now = new Date();
    var p = W.moon.phase(now);
    var illum = Math.round(W.moon.illumination(now) * 100);
    var toNew = Math.round(W.moon.daysToNew(now));
    var toFull = Math.round(W.moon.daysToFull(now));
    var next = toFull <= toNew
      ? '次の満月まで あと' + toFull + '日'
      : '次の新月まで あと' + toNew + '日';

    return '' +
      '<section class="hero">' +
        '<div class="hero__moon">' + W.moon.svg(now, 92) + '</div>' +
        '<div class="hero__body">' +
          '<div class="hero__date">' + esc(ui.fmtFull(now)) + '</div>' +
          '<h1 class="hero__name">' + esc(p.name) + '<small>' + esc(p.yomi) + '</small></h1>' +
          '<div class="hero__meta">月齢 ' + W.moon.age(now).toFixed(1) + '　輝面 ' + illum + '%　' + esc(next) + '</div>' +
          '<div class="hero__theme">' + esc(p.theme) + '</div>' +
          '<p class="hero__note">' + esc(p.note) + '</p>' +
        '</div>' +
      '</section>';
  }

  /* 新月と満月は、このアプリのいちばん大事な二日。開いたら必ず目に入るようにする。
     声をかけるだけでは何も起きないので、そのまま儀式に入れるようにしてある。 */
  function ritual() {
    var now = new Date();
    var k = W.moon.phase(now).key;
    if (k !== 'new' && k !== 'full') return '';

    var kind = k === 'full' ? 'full' : 'new';
    var start = W.ritual.cycleStartFor(kind, now);
    var done = W.store.getRitual(kind, start);

    if (k === 'new') {
      return '<div class="ritual ritual--new">' +
        '<strong>新月の日です。</strong>' +
        '<p>' + (done
          ? '今日の儀式は記録ずみです。書き足したくなったら、いつでも開けます。'
          : '前の一巡りを閉じて、あたらしい種をまきます。10分だけ時間をとりませんか。') + '</p>' +
        '<a class="btn btn--primary" href="#/ritual?kind=new">' +
        (done ? '新月の記録を見る' : '新月の儀式をはじめる') + '</a></div>';
    }
    return '<div class="ritual ritual--full">' +
      '<strong>満月の日です。</strong>' +
      '<p>' + (done
        ? '今日の儀式は記録ずみです。書き足したくなったら、いつでも開けます。'
        : 'すでに受け取っているものを数えて、握っている手をひらきます。') + '</p>' +
      '<a class="btn btn--primary" href="#/ritual?kind=full">' +
      (done ? '満月の記録を見る' : '満月の儀式をはじめる') + '</a></div>';
  }

  function todayQuestion() {
    var q = W.seeds.daily();
    return '' +
      '<section class="card">' +
        '<h2 class="card__title">今日の問い</h2>' +
        '<blockquote class="seedq" id="seedQ">' + esc(q) + '</blockquote>' +
        '<div class="row">' +
          '<button class="btn" data-act="seed-keep">この問いを持ち歩く</button>' +
          '<a class="btn btn--ghost" href="#/questions?new=1">自分の問いを立てる</a>' +
        '</div>' +
      '</section>';
  }

  function quickNotice() {
    var kinds = Object.keys(ui.KINDS).map(function (k) {
      return '<button type="button" class="chip chip--k chip--' + k + (k === lastKind ? ' is-on' : '') +
             '" data-kind="' + k + '">' + esc(ui.KINDS[k].label) + '</button>';
    }).join('');
    return '' +
      '<section class="card">' +
        '<h2 class="card__title">今日の気づき</h2>' +
        '<div class="chips" id="kindChips">' + kinds + '</div>' +
        '<textarea id="noticeText" class="ta" rows="2" placeholder="小さなことほど書きとめる価値があります"></textarea>' +
        '<div class="row row--between">' +
          '<select id="noticeWish" class="sel">' + ui.wishOptions(null) + '</select>' +
          '<button class="btn btn--primary" data-act="notice-save">書きとめる</button>' +
        '</div>' +
      '</section>' + W.echoView.justWritten();
  }

  function wishRow(w) {
    var lp = W.store.lastPulse(w);
    var signs = W.store.state.notices.filter(function (n) { return n.wishId === w.id; }).length;
    var grip = lp ? lp.grip : null;
    return '' +
      '<li class="wrow">' +
        '<button class="check" data-act="fulfill" data-id="' + esc(w.id) + '" aria-label="叶ったことにする"></button>' +
        '<a class="wrow__body" href="#/wish/' + esc(w.id) + '">' +
          '<span class="wrow__title">' + esc(w.title) + '</span>' +
          '<span class="wrow__meta">' +
            W.moon.svg(new Date(w.createdAt), 12) +
            '<span>' + esc(w.moonAtCreate ? w.moonAtCreate.name : '') + 'に立てた</span>' +
            (signs ? '<span>・兆し ' + signs + '</span>' : '') +
            (grip ? '<span class="grip grip--' + grip + '">・握りしめ ' + grip + '</span>' : '') +
          '</span>' +
        '</a>' +
      '</li>';
  }

  function wishList() {
    var living = W.store.state.wishes.filter(function (w) { return w.status === 'living'; });
    var quiet  = living.filter(W.store.isQuiet);
    var active = living.filter(function (w) { return !W.store.isQuiet(w); });

    var body = active.length
      ? '<ul class="wlist">' + active.map(wishRow).join('') + '</ul>'
      : ui.empty(living.length ? 'いまは、すべての願いをそっと置いています。' : 'まだ願いがありません。',
                 living.length ? '手放している間に、育つものがあります。' : '新月を待たなくても、書きたくなった日が書く日です。');

    return '' +
      '<section class="card">' +
        '<h2 class="card__title">育てている願い' +
          (active.length ? '<span class="count">' + active.length + '</span>' : '') + '</h2>' +
        body +
        (quiet.length ? '<p class="quiet-note">そっと置いている願いが ' + quiet.length + ' つあります。' +
          '<a href="#/wishes">見る</a></p>' : '') +
        '<div class="row"><a class="btn btn--ghost" href="#/wishes?new=1">願いを書く</a></div>' +
      '</section>';
  }

  function render() {
    var st = streak();
    return moonHero() + ritual() + todayQuestion() + quickNotice() + wishList() +
      (st > 1 ? '<p class="streak">気づきを書きとめた日が ' + st + '日 続いています。</p>' : '');
  }

  function mount(root) {
    var kind = lastKind;
    var chips = root.querySelector('#kindChips');
    if (chips) chips.addEventListener('click', function (e) {
      var c = e.target.closest('.chip'); if (!c) return;
      kind = lastKind = c.dataset.kind;
      chips.querySelectorAll('.chip').forEach(function (x) { x.classList.toggle('is-on', x === c); });
    });

    var ta = root.querySelector('#noticeText');
    if (ta) ui.autogrow(ta);

    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      var act = b.dataset.act;

      if (act === 'notice-save') {
        var text = ta.value.trim();
        if (!text) { ta.focus(); return; }
        var n = W.store.addNotice(text, kind, root.querySelector('#noticeWish').value || null);
        ta.value = ''; ta.dispatchEvent(new Event('input'));
        ui.setEcho(n.id);              // 直後に「前の記録と響いています」を出す
        ui.toast('書きとめました');
      }

      if (act === 'seed-keep') {
        var q = root.querySelector('#seedQ').textContent;
        W.store.addQuestion(q, null, null);
        ui.toast('〈問い〉に加えました');
      }

      if (act === 'fulfill') {
        var w = W.store.getWish(b.dataset.id);
        if (!w) return;
        if (confirm('「' + w.title + '」は叶いましたか？\n叶った日と、その日の月の姿を記録します。')) {
          W.store.fulfillWish(w.id);
          location.hash = '#/wish/' + w.id;
        }
      }
    });
  }

  W.views = W.views || {};
  W.views.today = { render: render, mount: mount, tab: 'today' };
})(window.W = window.W || {});
