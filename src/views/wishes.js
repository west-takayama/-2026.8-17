/* ===========================================================================
   views/wishes.js — 願いの一覧
   ---------------------------------------------------------------------------
   状態は3つ。育てている／叶った／手放した。
   「手放した」は失敗箱ではない。執着を外したという、ひとつの達成として並べる。
   =========================================================================== */
(function (W) {
  'use strict';
  var ui = W.ui, esc = ui.esc;

  function form() {
    var now = new Date();
    var p = W.moon.phase(now);
    return '' +
      '<section class="card card--form" id="wishForm">' +
        '<h2 class="card__title">願いを書く</h2>' +
        '<p class="form__moon">' + W.moon.svg(now, 18) +
          '今日は<strong>' + esc(p.name) + '</strong>。この願いには、この月が刻まれます。</p>' +
        '<label class="lb">願い<small>ひとつの文で、言い切りの形で</small></label>' +
        '<input id="wTitle" class="in" type="text" placeholder="例：自分の言葉で書いた文章で、誰かの一日を変える" maxlength="120">' +
        '<label class="lb">なぜ、それを願うのか<small>強く思うための芯。ここが弱いと願いは続かない</small></label>' +
        '<textarea id="wEssence" class="ta" rows="3" placeholder="表面の望みの、その下にあるもの"></textarea>' +
        '<label class="lb">叶ったときの情景<small>見えている絵があるほど、兆しに気づきやすくなる</small></label>' +
        '<textarea id="wScene" class="ta" rows="3" placeholder="そのとき、何が見えて、何が聞こえて、どんな気持ちでいるか"></textarea>' +
        '<div class="row row--end">' +
          '<a class="btn btn--ghost" href="#/wishes">やめる</a>' +
          '<button class="btn btn--primary" data-act="wish-create">立てる</button>' +
        '</div>' +
      '</section>';
  }

  function card(w) {
    var quiet = W.store.isQuiet(w);
    var lp = W.store.lastPulse(w);
    var signs = W.store.state.notices.filter(function (n) { return n.wishId === w.id; }).length;
    var qs = W.store.state.questions.filter(function (q) { return q.wishId === w.id && !q.archived; }).length;

    var stamp = w.status === 'fulfilled' ? w.moonAtFulfill : w.moonAtCreate;
    var stampDate = w.status === 'fulfilled' ? w.fulfilledAt : w.createdAt;

    return '' +
      '<a class="wcard' + (quiet ? ' is-quiet' : '') + ' is-' + esc(w.status) + '" href="#/wish/' + esc(w.id) + '">' +
        '<div class="wcard__moon">' + W.moon.svg(new Date(stampDate), 26) + '</div>' +
        '<div class="wcard__body">' +
          '<div class="wcard__title">' +
            (w.status === 'fulfilled' ? '<span class="tick">✓</span>' : '') +
            (w.status === 'released' ? '<span class="tick tick--rel">○</span>' : '') +
            esc(w.title) + '</div>' +
          '<div class="wcard__meta">' +
            esc(stamp ? stamp.name : '') + '・' + esc(ui.ago(stampDate)) +
            (qs ? '　問い ' + qs : '') + (signs ? '　兆し ' + signs : '') +
            (lp && w.status === 'living' ? '　強さ ' + lp.intensity + ' / 握り ' + lp.grip : '') +
          '</div>' +
          (quiet ? '<div class="wcard__quiet">そっと置いています（' +
            esc(ui.fmtDate(w.quietUntil)) + 'まで）</div>' : '') +
        '</div>' +
      '</a>';
  }

  function section(title, list, emptyMsg) {
    if (!list.length) return emptyMsg ? '<h2 class="sec">' + esc(title) + '</h2>' + ui.empty(emptyMsg) : '';
    return '<h2 class="sec">' + esc(title) + '<span class="count">' + list.length + '</span></h2>' +
           '<div class="wcards">' + list.map(card).join('') + '</div>';
  }

  function render(params) {
    var s = W.store.state;
    var living    = s.wishes.filter(function (w) { return w.status === 'living'; });
    var fulfilled = s.wishes.filter(function (w) { return w.status === 'fulfilled'; })
                            .sort(function (a, b) { return new Date(b.fulfilledAt) - new Date(a.fulfilledAt); });
    var released  = s.wishes.filter(function (w) { return w.status === 'released'; });

    var head = params.new ? form() :
      '<div class="row row--end pagehead"><button class="btn btn--primary" data-act="wish-new">＋ 願いを書く</button></div>';

    return head +
      section('育てている', living, s.wishes.length ? null : 'まだ願いがありません。') +
      section('叶った', fulfilled) +
      section('手放した', released) +
      (fulfilled.length ? '<p class="footnote">叶ったものは消しません。' +
        '「叶う」という出来事が自分に起きたという記録が、次の願いの土台になります。</p>' : '');
  }

  function mount(root, params) {
    if (params.new) {
      var t = root.querySelector('#wTitle'); if (t) t.focus();
      root.querySelectorAll('.ta').forEach(ui.autogrow);
    }
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      if (b.dataset.act === 'wish-new') { location.hash = '#/wishes?new=1'; }
      if (b.dataset.act === 'wish-create') {
        var title = root.querySelector('#wTitle').value.trim();
        if (!title) { root.querySelector('#wTitle').focus(); return; }
        var w = W.store.addWish({
          title: title,
          essence: root.querySelector('#wEssence').value,
          scene: root.querySelector('#wScene').value
        });
        location.hash = '#/wish/' + w.id;
      }
    });
  }

  W.views = W.views || {};
  W.views.wishes = { render: render, mount: mount, tab: 'wishes' };
})(window.W = window.W || {});
