/* ===========================================================================
   views/questions.js — 問いと、問いを磨くこと
   ---------------------------------------------------------------------------
   問いは消さずに「磨く」。前の問いを親として残し、新しい問いを子にする。
   あとから系譜をたどると、自分の考えがどこで曲がったかが見える。
   これが「問いの質を高める」ということの、いちばん具体的な形だと思う。
   =========================================================================== */
(function (W) {
  'use strict';
  var ui = W.ui, esc = ui.esc;

  /* 0〜3 の自己採点。ui.bindScales がそのまま使える形にしておく。
     未採点（null）と「0 と採点した」は別物なので、null のときは何も光らせない。 */
  function axis3(name, value) {
    var set = value != null && value !== '';
    var out = '<div class="scale scale--4" data-scale="' + esc(name) + '" data-value="' + (set ? value : '') + '">';
    for (var i = 0; i <= 3; i++) {
      out += '<button type="button" class="scale__b' + (set && Number(value) === i ? ' is-on' : '') +
             '" data-v="' + i + '">' + i + '</button>';
    }
    return out + '</div>';
  }

  function coachBlock(text) {
    var notes = W.coach.review(text);
    if (!notes.length) return '';
    return '<div class="coach">' + notes.map(function (n) {
      return '<div class="coach__i coach__i--' + esc(n.tone) + '">' +
             '<strong>' + esc(n.title) + '</strong><p>' + esc(n.body) + '</p></div>';
    }).join('') + '</div>';
  }

  /* ---------------------------- 一覧 ---------------------------- */

  function qItem(q) {
    var g = W.coach.grade(W.store.scoreOf(q));
    var w = q.wishId ? W.store.getWish(q.wishId) : null;
    var kids = W.store.state.questions.filter(function (x) { return x.parentId === q.id; }).length;
    return '' +
      '<a class="qcard' + (q.archived ? ' is-archived' : '') + '" href="#/question/' + esc(q.id) + '">' +
        '<div class="qcard__t">' + esc(q.text) + '</div>' +
        '<div class="qcard__meta">' +
          '<span class="pill pill--' + g.cls + '">' + esc(g.label) + '</span>' +
          (w ? '<span class="qcard__w">' + esc(w.title) + '</span>' : '') +
          (kids ? '<span>磨いた回数 ' + kids + '</span>' : '') +
          '<span>' + esc(ui.ago(q.createdAt)) + '</span>' +
        '</div>' +
      '</a>';
  }

  function seedShelf() {
    var now = new Date();
    var p = W.moon.phase(now);
    var list = W.seeds.forPhase(p.key);
    return '' +
      '<section class="card card--soft">' +
        '<h2 class="card__title">' + W.moon.svg(now, 16) + esc(p.name) + 'の問いの種</h2>' +
        '<p class="hint">' + esc(p.theme) + '。思いつかない日は、ここから借りて自分の言葉に直してください。</p>' +
        '<ul class="seeds">' + list.map(function (t) {
          return '<li><span>' + esc(t) + '</span>' +
                 '<button class="btn btn--tiny" data-act="seed-add" data-text="' + esc(t) + '">立てる</button></li>';
        }).join('') + '</ul>' +
      '</section>';
  }

  function listRender(params) {
    var s = W.store.state;
    var live = s.questions.filter(function (q) { return !q.archived; });
    var done = s.questions.filter(function (q) { return q.archived; });

    var form = params.new ? '' +
      '<section class="card card--form">' +
        '<h2 class="card__title">問いを立てる</h2>' +
        '<textarea id="qText" class="ta" rows="2" placeholder="例：この願いのために、私が今日やめられることは何だろう？"></textarea>' +
        '<div id="qLive"></div>' +
        '<label class="lb">どの願いへの問いか</label>' +
        '<select id="qWish" class="sel">' + ui.wishOptions(params.wish) + '</select>' +
        '<div class="row row--end">' +
          '<a class="btn btn--ghost" href="#/questions">やめる</a>' +
          '<button class="btn btn--primary" data-act="q-create">立てる</button>' +
        '</div>' +
      '</section>'
      : '<div class="row row--end pagehead"><button class="btn btn--primary" data-act="q-new">＋ 問いを立てる</button></div>';

    return form + seedShelf() +
      (live.length ? '<h2 class="sec">持ち歩いている問い<span class="count">' + live.length + '</span></h2>' +
        '<div class="qcards">' + live.map(qItem).join('') + '</div>'
        : ui.empty('まだ問いがありません。', '願いを叶えるのは答えではなく、良い問いを持ち歩いた日数です。')) +
      (done.length ? '<h2 class="sec">置いた問い<span class="count">' + done.length + '</span></h2>' +
        '<div class="qcards">' + done.map(qItem).join('') + '</div>' : '');
  }

  function listMount(root, params) {
    if (params.new) {
      var ta = root.querySelector('#qText');
      ui.autogrow(ta); ta.focus();
      var live = root.querySelector('#qLive');
      var t;
      ta.addEventListener('input', function () {
        clearTimeout(t);
        t = setTimeout(function () { live.innerHTML = coachBlock(ta.value); }, 350);
      });
    }

    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      if (b.dataset.act === 'q-new') location.hash = '#/questions?new=1';
      if (b.dataset.act === 'seed-add') {
        var q = W.store.addQuestion(b.dataset.text, null, null);
        location.hash = '#/question/' + q.id;
      }
      if (b.dataset.act === 'q-create') {
        var text = root.querySelector('#qText').value.trim();
        if (!text) { root.querySelector('#qText').focus(); return; }
        var nq = W.store.addQuestion(text, root.querySelector('#qWish').value || null, null);
        location.hash = '#/question/' + nq.id;
      }
    });
  }

  /* ---------------------------- 詳細 ---------------------------- */

  function lineage(q) {
    var s = W.store.state;
    var chain = [], cur = q, guard = 0;
    while (cur && guard++ < 20) { chain.unshift(cur); cur = cur.parentId ? W.store.getQuestion(cur.parentId) : null; }
    var kids = s.questions.filter(function (x) { return x.parentId === q.id; });
    if (chain.length < 2 && !kids.length) return '';

    var items = chain.map(function (c, i) {
      return '<li class="lin__i' + (c.id === q.id ? ' is-now' : '') + '">' +
             '<span class="lin__n">' + (i + 1) + '</span>' +
             (c.id === q.id ? '<span>' + esc(c.text) + '</span>'
                            : '<a href="#/question/' + esc(c.id) + '">' + esc(c.text) + '</a>') +
             '</li>';
    }).join('');
    var kidItems = kids.map(function (k) {
      return '<li class="lin__i lin__i--kid"><span class="lin__n">→</span>' +
             '<a href="#/question/' + esc(k.id) + '">' + esc(k.text) + '</a></li>';
    }).join('');

    return '<section class="card card--soft">' +
      '<h3 class="card__sub">この問いの来歴</h3>' +
      '<ol class="lin">' + items + kidItems + '</ol>' +
      '<p class="hint">最初の問いと今の問いを見比べてみてください。変わった部分に、あなたが進んだ距離があります。</p>' +
      '</section>';
  }

  function detailRender(params) {
    var q = W.store.getQuestion(params.id);
    if (!q) return ui.empty('その問いは見つかりませんでした。');
    var total = W.store.scoreOf(q);
    var g = W.coach.grade(total);
    var w = q.wishId ? W.store.getWish(q.wishId) : null;

    var axes = W.coach.AXES.map(function (a) {
      return '<div class="axis">' +
        '<div class="axis__lb">' + esc(a.label) + '<small>' + esc(a.hint) + '</small></div>' +
        axis3(a.key, q.scores[a.key]) +
      '</div>';
    }).join('');

    return '' +
      '<section class="qhead">' +
        '<div class="qhead__meta">' + W.moon.svg(new Date(q.createdAt), 14) +
          esc(q.moon ? q.moon.name : '') + '・' + esc(ui.fmtFull(q.createdAt)) +
          (w ? '　<a href="#/wish/' + esc(w.id) + '">' + esc(w.title) + '</a>' : '') + '</div>' +
        '<h1 class="qhead__t" id="qHeadText">' + esc(q.text) + '</h1>' +
        '<span class="pill pill--' + g.cls + '">' + esc(g.label) + '　' + total + '/9</span>' +
      '</section>' +

      coachBlock(q.text) +

      '<section class="card">' +
        '<h2 class="card__title">問いの質を見る</h2>' +
        '<p class="hint">0＝あてはまらない、3＝よくあてはまる。自分で見立てること自体が練習になります。</p>' +
        axes +
      '</section>' +

      '<section class="card">' +
        '<h2 class="card__title">問いを磨く</h2>' +
        '<p class="hint">今の問いは残したまま、より良い形を子として立てます。捨てずに重ねるほど、質は上がります。</p>' +
        '<textarea id="refineText" class="ta" rows="2" placeholder="' + esc(q.text) + '">' + '</textarea>' +
        '<div id="refineLive"></div>' +
        '<div class="row row--end"><button class="btn btn--primary" data-act="refine">この形で磨く</button></div>' +
      '</section>' +

      lineage(q) +

      '<section class="card">' +
        '<h2 class="card__title">この問いに、今のところ</h2>' +
        '<textarea id="ansNote" class="ta" rows="3" placeholder="答えでなくてよい。今わかっていることだけ書く。">' + esc(q.answeredNote) + '</textarea>' +
        '<div class="row row--between">' +
          '<select id="qWishSel" class="sel">' + ui.wishOptions(q.wishId) + '</select>' +
          '<button class="btn btn--primary" data-act="save-note">残す</button>' +
        '</div>' +
      '</section>' +

      '<section class="card card--actions">' +
        '<button class="btn btn--ghost" data-act="edit-text">問いを書き直す</button>' +
        '<button class="btn btn--ghost" data-act="archive">' + (q.archived ? '持ち歩きに戻す' : 'この問いを置く') + '</button>' +
        '<button class="btn btn--danger" data-act="delete">消す</button>' +
      '</section>';
  }

  function detailMount(root, params) {
    var q = W.store.getQuestion(params.id);
    if (!q) return;
    ui.bindScales(root);
    root.querySelectorAll('.ta').forEach(ui.autogrow);

    // 採点はボタンを押した瞬間に保存する（保存ボタンを増やさない）
    root.addEventListener('scale:change', function (e) {
      var name = e.target.dataset.scale;
      if (!name || ['open', 'self', 'act'].indexOf(name) < 0) return;
      var scores = Object.assign({}, q.scores);
      scores[name] = e.detail.value;
      W.store.editQuestion(q.id, { scores: scores });
    });

    var rt = root.querySelector('#refineText'), live = root.querySelector('#refineLive'), t;
    if (rt) rt.addEventListener('input', function () {
      clearTimeout(t);
      t = setTimeout(function () { live.innerHTML = coachBlock(rt.value); }, 350);
    });

    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      var act = b.dataset.act;

      if (act === 'refine') {
        var text = rt.value.trim();
        if (!text) { rt.focus(); return; }
        var nq = W.store.addQuestion(text, q.wishId, q.id);
        ui.toast('磨きました');
        location.hash = '#/question/' + nq.id;
      }
      if (act === 'save-note') {
        W.store.editQuestion(q.id, {
          answeredNote: root.querySelector('#ansNote').value,
          wishId: root.querySelector('#qWishSel').value || null
        });
        ui.toast('残しました');
      }
      if (act === 'edit-text') {
        var v = prompt('問いを書き直します。\n（前の形を残したいときは「磨く」を使ってください）', q.text);
        if (v && v.trim()) W.store.editQuestion(q.id, { text: v.trim() });
      }
      if (act === 'archive') W.store.editQuestion(q.id, { archived: !q.archived });
      if (act === 'delete') {
        if (confirm('この問いを消します。よろしいですか？')) {
          W.store.removeQuestion(q.id);
          location.hash = '#/questions';
        }
      }
    });
  }

  W.views = W.views || {};
  W.views.questions = { render: listRender,   mount: listMount,   tab: 'questions' };
  W.views.question  = { render: detailRender, mount: detailMount, tab: 'questions' };
})(window.W = window.W || {});
