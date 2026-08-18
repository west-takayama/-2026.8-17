/* ===========================================================================
   views/deepen.js — 願いを深める
   ---------------------------------------------------------------------------
   ひとつの願いに対して4つの問いを立て、答えを書き、それを材料に願いを言い直す。

   ここでAIに任せているのは「問いを立てること」だけです。願いは書かせません。
   最後に出るのはあくまで候補で、選ぶのも直すのも捨てるのも本人です。
   代わりに書かせてしまうと、このアプリがいちばん大事にしている
   「自分で問いを立て、自分の言葉で願う」練習が丸ごと消えます。

   AIの鍵がなくても同じ流れが動きます（deepen.js の規則ベースの問いに切り替わる）。
   段階は3つ。問い → 答え → 言い直し。
   =========================================================================== */
(function (W) {
  'use strict';
  var ui = W.ui, esc = ui.esc;

  /* 画面をまたいで持ち回る作業中の状態。保存はしない（途中でやめたら消えてよい）。 */
  var work = null;   // { wishId, engine, items:[{q,why,a}], result, error, busy, stage }

  function reset(wishId, engine) {
    work = { wishId: wishId, engine: engine, items: [], result: null, error: '', busy: false, stage: 'start' };
  }

  function redraw() { if (W.app && W.app.draw) W.app.draw(); }

  /* ------------------------------------------------------------ 各段階 */

  function intro(wish) {
    var hasKey = W.ai.enabled();
    return '' +
      '<section class="card card--deep">' +
        '<h2 class="card__title">この願いを、深める</h2>' +
        '<p class="hint">4つの問いに答えていくと、願いの輪郭がはっきりしてきます。' +
          '答えたところだけで構いません。最後に言い直しの候補が出ますが、決めるのはあなたです。</p>' +
        '<div class="deep__now">' + esc(wish.title) + '</div>' +
        '<div class="row">' +
          (hasKey
            ? '<button class="btn btn--primary" data-act="start-ai">AIに問いを立ててもらう</button>' +
              '<button class="btn" data-act="start-off">AIを使わずに進める</button>'
            : '<button class="btn btn--primary" data-act="start-off">問いを立てる</button>' +
              '<a class="btn btn--ghost" href="#/settings">AIに手伝ってもらう設定</a>') +
        '</div>' +
        (hasKey
          ? '<p class="footnote">AIを使うと、この願いの文章と、あなたが書く答えだけが Anthropic に送られます。' +
            '気づき・夢・体重・ほかの願いは送られません。1回およそ3〜6円かかります。</p>'
          : '<p class="footnote">いまはAIを使わない設定です。願いのどこが空白かを見て、こちらで問いを選びます。' +
            '通信は一切しません。</p>') +
      '</section>';
  }

  function loading() {
    return '<section class="card card--deep">' +
      '<h2 class="card__title">問いを考えています</h2>' +
      '<div class="deep__wait"><span></span><span></span><span></span></div>' +
      '<p class="hint">十数秒かかることがあります。</p></section>';
  }

  function errorCard(msg, wish) {
    return '<section class="card card--deep">' +
      '<h2 class="card__title">うまくいきませんでした</h2>' +
      '<p class="hint">' + esc(msg) + '</p>' +
      '<div class="row">' +
        '<button class="btn" data-act="start-off">AIを使わずに進める</button>' +
        '<button class="btn btn--ghost" data-act="copy-prompt">プロンプトをコピー</button>' +
        '<a class="btn btn--ghost" href="#/wish/' + esc(wish.id) + '">やめる</a>' +
      '</div>' +
      '<p class="footnote">「プロンプトをコピー」を押すと、Claude などに貼り付けられる文章が' +
        'クリップボードに入ります。返ってきた問いは、下の欄に自分で書き写せます。</p>' +
      '</section>';
  }

  function answering(wish) {
    var items = work.items.map(function (it, i) {
      return '<div class="deep__q">' +
        '<div class="deep__qn">' + (i + 1) + '</div>' +
        '<div class="deep__qb">' +
          '<div class="deep__qt">' + esc(it.q) + '</div>' +
          (it.why ? '<div class="deep__qw">' + esc(it.why) + '</div>' : '') +
          '<textarea class="ta deep__a" id="a' + i + '" rows="2" ' +
            'placeholder="思いつくままで構いません">' + esc(it.a || '') + '</textarea>' +
        '</div>' +
      '</div>';
    }).join('');

    return '' +
      '<section class="card card--deep">' +
        '<h2 class="card__title">4つの問い' +
          '<span class="count">' + (work.engine === 'ai' ? 'AI' : '規則') + '</span></h2>' +
        '<div class="deep__now">' + esc(wish.title) + '</div>' +
        items +
        '<div class="row row--between">' +
          '<button class="btn btn--ghost" data-act="save-questions">問いだけ〈問い〉に残す</button>' +
          '<button class="btn btn--primary" data-act="to-reword">答えから、言い直す</button>' +
        '</div>' +
        '<p class="footnote">答えは〈問い〉にも保存されるので、あとから読み返せます。' +
          '全部埋めなくても進めます。</p>' +
      '</section>';
  }

  function rewording(wish) {
    var r = work.result;
    if (!r) return '';

    var cands = (r.candidates || []).map(function (c, i) {
      return '<label class="cand">' +
        '<input type="radio" name="cand" value="' + i + '"' + (i === 0 ? ' checked' : '') + '>' +
        '<span class="cand__b"><span class="cand__t">' + esc(c.text) + '</span>' +
        (c.note ? '<span class="cand__n">' + esc(c.note) + '</span>' : '') + '</span>' +
      '</label>';
    }).join('');

    return '' +
      '<section class="card card--deep">' +
        '<h2 class="card__title">言い直しの候補</h2>' +
        (r.observation ? '<p class="deep__obs">' + esc(r.observation) + '</p>' : '') +
        '<div class="deep__before"><small>いまの願い</small>' + esc(wish.title) + '</div>' +
        (cands ? '<div class="cands">' + cands + '</div>' : '') +
        '<label class="lb">自分の言葉で書く<small>候補をそのまま使わず、直しても構いません</small></label>' +
        '<textarea id="rewordText" class="ta" rows="2" placeholder="' + esc(wish.title) + '"></textarea>' +
        '<div class="row row--between">' +
          '<a class="btn btn--ghost" href="#/wish/' + esc(wish.id) + '">このままにする</a>' +
          '<button class="btn btn--primary" data-act="apply">この形にする</button>' +
        '</div>' +
        '<p class="footnote">言い直しても、前の形は願いの画面に残ります。' +
          '変わっていく過程そのものが、あとで読み返す値打ちになります。</p>' +
      '</section>';
  }

  /* 鍵なしのときの、材料だけを並べる画面 */
  function materials(wish) {
    var mats = W.deepen.materialsFor(work.items);
    return '' +
      '<section class="card card--deep">' +
        '<h2 class="card__title">あなたが書いた材料</h2>' +
        '<p class="hint">この言葉を使って、願いを書き直してみてください。' +
          'こちらで文章を作ってしまうと、あなたの言葉でない願いができあがるので、並べるだけにします。</p>' +
        '<div class="deep__before"><small>いまの願い</small>' + esc(wish.title) + '</div>' +
        (mats.length
          ? '<ul class="mats">' + mats.map(function (m) {
              return '<li><small>' + esc(m.q) + '</small>' + esc(m.a) + '</li>';
            }).join('') + '</ul>'
          : '<p class="hint">答えが書かれていません。ひとつでも書くと、材料になります。</p>') +
        '<label class="lb">言い直す</label>' +
        '<textarea id="rewordText" class="ta" rows="2" placeholder="' + esc(wish.title) + '"></textarea>' +
        '<div class="row row--between">' +
          '<a class="btn btn--ghost" href="#/wish/' + esc(wish.id) + '">このままにする</a>' +
          '<button class="btn btn--primary" data-act="apply">この形にする</button>' +
        '</div>' +
      '</section>';
  }

  /* ---------------------------------------------------------------- 画面 */

  function render(params) {
    var wish = W.store.getWish(params.id);
    if (!wish) return ui.empty('その願いは見つかりませんでした。');

    if (!work || work.wishId !== wish.id) reset(wish.id, null);

    var head = '<section class="dhead">' +
      '<a class="dhead__back" href="#/wish/' + esc(wish.id) + '">← 願いにもどる</a>' +
      '<h1 class="dhead__t">願いを深める</h1></section>';

    if (work.busy)   return head + loading();
    if (work.error)  return head + errorCard(work.error, wish);
    if (work.stage === 'start')  return head + intro(wish);
    if (work.stage === 'answer') return head + answering(wish);
    if (work.stage === 'reword') return head + (work.result ? rewording(wish) : materials(wish));
    return head + intro(wish);
  }

  function mount(root, params) {
    var wish = W.store.getWish(params.id);
    if (!wish) return;
    root.querySelectorAll('.ta').forEach(ui.autogrow);

    // 入力中の答えを work に写しておく（描き直しで消えないように）
    root.addEventListener('input', function (e) {
      if (!e.target.classList.contains('deep__a')) return;
      var i = Number(e.target.id.slice(1));
      if (work.items[i]) work.items[i].a = e.target.value;
    });

    function collect() {
      root.querySelectorAll('.deep__a').forEach(function (ta) {
        var i = Number(ta.id.slice(1));
        if (work.items[i]) work.items[i].a = ta.value;
      });
    }

    /* 問いを〈問い〉として保存する。答えは answeredNote に入れる。
       こうしておくと、AIが立てた問いも本人の問いと同じ棚に並び、
       採点も「磨く」もそのまま使える。 */
    function persistQuestions() {
      work.items.forEach(function (it) {
        if (it.saved) return;
        var q = W.store.addQuestion(it.q, wish.id, null);
        if (it.a && it.a.trim()) W.store.editQuestion(q.id, { answeredNote: it.a.trim() });
        it.saved = true;
      });
    }

    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      var act = b.dataset.act;

      if (act === 'start-off') {
        var existing = W.store.state.questions.filter(function (q) { return q.wishId === wish.id; });
        work.engine = 'offline';
        work.items = W.deepen.questionsFor(wish, existing).map(function (c) {
          return { q: c.q, why: c.why, a: '' };
        });
        work.error = ''; work.stage = 'answer';
        redraw();
      }

      if (act === 'start-ai') {
        var ex = W.store.state.questions.filter(function (q) { return q.wishId === wish.id; });
        work.engine = 'ai'; work.busy = true; work.error = '';
        redraw();
        W.ai.askQuestions(wish, ex).then(function (r) {
          work.items = r.questions.map(function (x) { return { q: x.q, why: x.why, a: '' }; });
          work.busy = false; work.stage = 'answer';
          redraw();
        }).catch(function (err) {
          work.busy = false; work.error = W.ai.errorText(err);
          redraw();
        });
      }

      if (act === 'copy-prompt') {
        var exq = W.store.state.questions.filter(function (q) { return q.wishId === wish.id; });
        var text = W.ai.promptFor(wish, exq);
        (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
          .then(function () { ui.toast('コピーしました'); })
          .catch(function () { window.prompt('この文章をコピーしてください', text); });
      }

      if (act === 'save-questions') {
        collect(); persistQuestions();
        ui.toast('〈問い〉に残しました');
      }

      if (act === 'to-reword') {
        collect(); persistQuestions();
        if (work.engine !== 'ai') { work.stage = 'reword'; work.result = null; redraw(); return; }
        work.busy = true; redraw();
        W.ai.reword(wish, work.items).then(function (r) {
          work.result = r; work.busy = false; work.stage = 'reword';
          redraw();
        }).catch(function (err) {
          // 言い直しに失敗しても、答えは保存ずみ。材料だけの画面へ落とす。
          work.busy = false; work.result = null; work.stage = 'reword';
          ui.toast(W.ai.errorText(err));
          redraw();
        });
      }

      if (act === 'apply') {
        var ta = root.querySelector('#rewordText');
        var text = (ta && ta.value.trim()) || '';
        if (!text && work.result) {
          var sel = root.querySelector('input[name="cand"]:checked');
          if (sel) text = (work.result.candidates[Number(sel.value)] || {}).text || '';
        }
        if (!text) { ui.toast('言い直す文を選ぶか、書いてください'); return; }
        W.store.rewordWish(wish.id, text, work.engine === 'ai' ? 'AIの問いを経て' : '問いを経て');
        work = null;
        location.hash = '#/wish/' + wish.id;
        ui.toast('言い直しました');
      }
    });
  }

  W.views = W.views || {};
  W.views.deepen = { render: render, mount: mount, tab: 'wishes' };
})(window.W = window.W || {});
