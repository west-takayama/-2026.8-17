/* ===========================================================================
   echo-view.js — 「いま書いたことが、前の記録と響いています」の表示
   ---------------------------------------------------------------------------
   〈今日〉〈気づき〉〈符合〉のどこで書いても、保存した直後にその場で出したい。
   同じ見た目を3か所に書くことになるので、ここにまとめてある。
   =========================================================================== */
(function (W) {
  'use strict';

  function card(notice, echoes, title) {
    var ui = W.ui, esc = ui.esc;
    var head = '<div class="echo__src">' +
      '<span class="nlist__k nlist__k--' + esc(notice.kind) + '">' + esc(ui.KINDS[notice.kind].label) + '</span>' +
      '<span>' + esc(notice.text) + '</span></div>';

    // 響きがないときに「響き合っています」と出しては嘘になる。見出しを分ける。
    if (!echoes.length) {
      return '<section class="card card--echo is-alone">' +
        '<h2 class="card__title">この記録</h2>' + head +
        '<p class="hint">いまのところ、これと響き合う記録はありません。' +
        '意味は後から追いついてきます。そのまま置いておきましょう。</p></section>';
    }

    return '<section class="card card--echo">' +
      '<h2 class="card__title">' + esc(title || '響き合っています') + '</h2>' + head +
      echoes.map(function (e) {
        return '<div class="echo__i">' +
          '<div class="echo__arrow">' + esc(ui.ago(e.notice.createdAt)) + 'の記録と</div>' +
          '<div class="echo__t">' +
            W.moon.svg(new Date(e.notice.createdAt), 13) +
            '<span class="nlist__k nlist__k--' + esc(e.notice.kind) + '">' + esc(ui.KINDS[e.notice.kind].label) + '</span>' +
            '<span>' + esc(e.notice.text) + '</span>' +
          '</div>' +
          '<ul class="echo__why">' + e.reasons.map(function (r) {
            return '<li>' + esc(r) + '</li>';
          }).join('') + '</ul>' +
        '</div>';
      }).join('') +
      '<div class="row row--end"><a class="btn btn--ghost" href="#/sync?s=' + esc(notice.id) + '">星図で見る</a></div>' +
      '</section>';
  }

  /* 書いた直後だけ出る。時間が経つか、画面を離れて戻れば消える。 */
  function justWritten() {
    var id = W.ui.getEcho();
    if (!id) return '';
    var list = W.store.state.notices;
    var idx = W.resonance.index(list);
    var d = idx.byId[id];
    if (!d) return '';
    return card(d.n, W.resonance.echoesFor(id, idx, 3), 'いま書いたことは');
  }

  W.echoView = { card: card, justWritten: justWritten };
})(window.W = window.W || {});
