/* ===========================================================================
   views/settings.js — 設定と、記録の持ち出し
   ---------------------------------------------------------------------------
   データはこの端末のブラウザの中にしかない。だから書き出しがいちばん大事な機能。
   月に一度、満月の日に書き出す——くらいの習慣を想定している。
   =========================================================================== */
(function (W) {
  'use strict';
  var ui = W.ui, esc = ui.esc;

  function counts() {
    var s = W.store.state;
    var done = s.wishes.filter(function (w) { return w.status === 'fulfilled'; }).length;
    var rel  = s.wishes.filter(function (w) { return w.status === 'released'; }).length;
    return { wishes: s.wishes.length, done: done, rel: rel, q: s.questions.length, n: s.notices.length };
  }

  function render() {
    var c = counts();
    var s = W.store.state;
    var since = ui.daysBetween(s.createdAt, new Date()) + 1;   // 使いはじめた日を1日目と数える

    return '' +
      '<section class="card">' +
        '<h2 class="card__title">これまで</h2>' +
        '<div class="stats">' +
          '<div><b>' + since + '</b><span>日</span></div>' +
          '<div><b>' + c.wishes + '</b><span>願い</span></div>' +
          '<div><b>' + c.done + '</b><span>叶った</span></div>' +
          '<div><b>' + c.rel + '</b><span>手放した</span></div>' +
          '<div><b>' + c.q + '</b><span>問い</span></div>' +
          '<div><b>' + c.n + '</b><span>気づき</span></div>' +
        '</div>' +
      '</section>' +

      '<section class="card">' +
        '<h2 class="card__title">呼び名</h2>' +
        '<input id="setName" class="in" type="text" value="' + esc(s.settings.name) + '" placeholder="（任意）画面の上に出ます" maxlength="24">' +
        '<div class="row row--end"><button class="btn" data-act="save-name">保存</button></div>' +
      '</section>' +

      aiCard() +

      '<section class="card">' +
        '<h2 class="card__title">記録の持ち出し</h2>' +
        '<p class="hint">この記録は、いま使っているブラウザの中だけに保存されています。' +
          'サーバーには何も送られません。裏を返せば、履歴を消したり端末を替えたりすると失われます。' +
          '月に一度、書き出して保管しておくことをおすすめします。</p>' +
        '<div class="row">' +
          '<button class="btn btn--primary" data-act="export">書き出す（JSON）</button>' +
          '<button class="btn" data-act="export-md">読み物として書き出す（テキスト）</button>' +
        '</div>' +
        '<label class="lb">読み込む</label>' +
        '<input id="importFile" class="in" type="file" accept="application/json,.json">' +
        '<div class="row">' +
          '<button class="btn" data-act="import-merge">いまの記録に足す</button>' +
          '<button class="btn btn--danger" data-act="import-replace">まるごと入れ替える</button>' +
        '</div>' +
      '</section>' +

      '<section class="card">' +
        '<h2 class="card__title">このアプリについて</h2>' +
        '<p class="about">強く思うこと。問いを立てつづけること。その問いを磨くこと。' +
          '願ったことに執着しないこと。小さな気づきを拾うこと。日々書きとめること。月の満ち欠けを意識すること。' +
          'この七つを、ひとつの道具にまとめたものです。</p>' +
        '<p class="about">「強さ」と「握り」をわざと別々に測るのは、' +
          '強く願うことと執着することを、自分で見分けられるようにするためです。</p>' +
      '</section>' +

      '<section class="card card--actions">' +
        '<button class="btn btn--danger" data-act="reset">すべて消す</button>' +
      '</section>';
  }

  /* AIの設定。ここだけが「外に出る」機能なので、何が送られるかを最初に書く。 */
  function aiCard() {
    var on = W.ai.enabled();
    var key = W.ai.getKey();
    var masked = key ? key.slice(0, 7) + '…' + key.slice(-4) : '';
    return '' +
      '<section class="card card--ai">' +
        '<h2 class="card__title">AIに手伝ってもらう' +
          (on ? '<span class="count count--ok">つながっています</span>' : '') + '</h2>' +
        '<p class="hint">〈願いを深める〉で、AIがこの願いに合わせた問いを立てます。' +
          '既定では使いません。ここに鍵を入れたときだけ動きます。</p>' +

        '<div class="ainote">' +
          '<strong>使うと、次のものだけが Anthropic に送られます。</strong>' +
          '<ul>' +
            '<li>そのとき深めている願いの文（願い・なぜ・情景）</li>' +
            '<li>その願いに紐づく問いと、あなたがその場で書いた答え</li>' +
          '</ul>' +
          '<strong>送られないもの</strong>' +
          '<ul>' +
            '<li>気づき・夢・偶然の記録、睡眠・体重・調子、儀式、ほかの願い</li>' +
          '</ul>' +
          '<p>中継するサーバーはありません。端末から Anthropic へ直接つなぎます。' +
            'AIは問いを立てるだけで、願いを代わりに書くことはしません。</p>' +
        '</div>' +

        '<label class="lb">APIキー<small>console.anthropic.com で作れます</small></label>' +
        '<input id="aiKey" class="in" type="password" autocomplete="off" ' +
          'placeholder="' + (on ? esc(masked) : 'sk-ant-…') + '">' +
        '<div class="row">' +
          '<button class="btn btn--primary" data-act="ai-save">保存する</button>' +
          (on ? '<button class="btn" data-act="ai-test">つながるか試す</button>' +
                '<button class="btn btn--danger" data-act="ai-clear">鍵を消す</button>' : '') +
        '</div>' +
        '<p class="footnote">鍵はこの端末のブラウザに保存され、記録の書き出し（JSON）には含まれません。' +
          '端末を他人と共有している場合は入れないでください。' +
          '費用は使った分だけで、1回およそ3〜6円です（' + esc(W.ai.MODEL) + '）。</p>' +
      '</section>';
  }

  function download(name, text, type) {
    var blob = new Blob([text], { type: type || 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* 人が読むための書き出し。JSON は復元用、こちらは読み返す用。 */
  function toText() {
    var s = W.store.state, out = [];
    out.push('月詠 — ' + ui.fmtFull(new Date()) + ' 書き出し', '');
    out.push('■ 願い');
    s.wishes.forEach(function (w) {
      var mark = w.status === 'fulfilled' ? '[✓]' : w.status === 'released' ? '[○]' : '[ ]';
      out.push(mark + ' ' + w.title);
      out.push('    立てた日: ' + ui.fmtFull(w.createdAt) + '（' + (w.moonAtCreate ? w.moonAtCreate.name : '') + '）');
      if (w.essence) out.push('    なぜ: ' + w.essence.replace(/\n/g, ' '));
      if (w.fulfilledAt) out.push('    叶った日: ' + ui.fmtFull(w.fulfilledAt) +
        '（' + (w.moonAtFulfill ? w.moonAtFulfill.name : '') + '）' + (w.fulfilledNote ? ' — ' + w.fulfilledNote.replace(/\n/g, ' ') : ''));
      if (w.releasedAt) out.push('    手放した日: ' + ui.fmtFull(w.releasedAt) + (w.releaseNote ? ' — ' + w.releaseNote : ''));
      out.push('');
    });
    out.push('', '■ 問い');
    s.questions.forEach(function (q) {
      out.push((q.parentId ? '  → ' : '- ') + q.text + '　（' + W.coach.grade(W.store.scoreOf(q)).label + '）');
      if (q.answeredNote) out.push('    ' + q.answeredNote.replace(/\n/g, ' '));
    });
    out.push('', '■ 気づき');
    s.notices.slice().reverse().forEach(function (n) {
      out.push('[' + ui.fmtFull(n.createdAt) + '・' + (n.moon ? n.moon.name : '') + '] ' +
        (ui.KINDS[n.kind] ? ui.KINDS[n.kind].label : '') + '　' + n.text.replace(/\n/g, ' '));
    });
    return out.join('\n');
  }

  function mount(root) {
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      var act = b.dataset.act;
      var stamp = ui.dayKey(new Date());

      if (act === 'save-name') {
        W.store.update(function (s) { s.settings.name = root.querySelector('#setName').value.trim(); });
        ui.toast('保存しました');
      }
      if (act === 'ai-save') {
        var v = root.querySelector('#aiKey').value.trim();
        if (!v) { ui.toast('キーを入れてください'); return; }
        if (v.indexOf('sk-ant-') !== 0) {
          if (!confirm('sk-ant- で始まらないキーですが、このまま保存しますか？')) return;
        }
        W.ai.setKey(v);
        root.querySelector('#aiKey').value = '';
        ui.toast('保存しました');
      }
      if (act === 'ai-clear') {
        if (!confirm('APIキーを消します。AIの手伝いは使えなくなります。')) return;
        W.ai.setKey('');
        ui.toast('消しました');
      }
      if (act === 'ai-test') {
        b.disabled = true; b.textContent = '試しています…';
        W.ai.test().then(function () { alert('つながりました。'); })
          .catch(function (err) { alert('つながりませんでした。\n\n' + W.ai.errorText(err)); })
          .then(function () { b.disabled = false; b.textContent = 'つながるか試す'; });
      }

      if (act === 'export')    download('tsukuyomi-' + stamp + '.json', W.store.exportJSON());
      if (act === 'export-md') download('tsukuyomi-' + stamp + '.txt', toText(), 'text/plain;charset=utf-8');

      if (act === 'import-merge' || act === 'import-replace') {
        var f = root.querySelector('#importFile').files[0];
        if (!f) { ui.toast('ファイルを選んでください'); return; }
        if (act === 'import-replace' && !confirm('いまの記録をすべて捨てて、ファイルの内容に入れ替えます。よろしいですか？')) return;
        var r = new FileReader();
        r.onload = function () {
          try {
            W.store.importJSON(r.result, act === 'import-replace' ? 'replace' : 'merge');
            ui.toast('読み込みました');
          } catch (err) {
            alert('読み込めませんでした。書き出した JSON ファイルか確認してください。');
            console.error(err);
          }
        };
        r.readAsText(f);
      }

      if (act === 'reset') {
        if (!confirm('すべての願い・問い・気づきを消します。元に戻せません。')) return;
        if (!confirm('本当に消してよろしいですか？　先に書き出しておくことをおすすめします。')) return;
        W.store.reset();
        ui.toast('消しました');
      }
    });
  }

  W.views = W.views || {};
  W.views.settings = { render: render, mount: mount, tab: null };
})(window.W = window.W || {});
