/* ===========================================================================
   app.js — 画面の切り替え
   ---------------------------------------------------------------------------
   ルーターは location.hash だけ。ビルドもルーティングライブラリも使わない。
   描画は毎回まるごと作り直す（差分更新はしない）。そのかわり、
   入力途中の文字・スクロール位置・カーソル位置だけを引き継いで、
   作り直したことに気づかれないようにしている。
   =========================================================================== */
(function (W) {
  'use strict';

  var root = document.getElementById('app');
  var current = null;      // 直前のルート名（同じ画面かどうかの判定に使う）
  var queued = false;

  function parse() {
    var h = location.hash.replace(/^#\/?/, '');
    if (!h) h = 'today';
    var params = {};
    var qi = h.indexOf('?');
    if (qi >= 0) {
      h.slice(qi + 1).split('&').filter(Boolean).forEach(function (pair) {
        var kv = pair.split('=');
        params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
      });
      h = h.slice(0, qi);
    }
    var seg = h.split('/');
    if (seg[1]) params.id = seg[1];
    return { name: seg[0] || 'today', params: params, key: h };
  }

  /* 作り直す前に、失われると困るものを控えておく */
  function snapshot() {
    var fields = {};
    root.querySelectorAll('input[id], textarea[id], select[id]').forEach(function (el) {
      if (el.type === 'file') return;
      fields[el.id] = el.value;
    });
    var a = document.activeElement;
    return {
      fields: fields,
      scroll: window.scrollY,
      focusId: a && a.id ? a.id : null,
      selStart: a && a.selectionStart != null ? a.selectionStart : null
    };
  }

  function restore(snap, sameRoute) {
    // 引き継ぐのは「同じ画面を描き直したとき」だけ。別の画面へ移ったときに
    // 同じ id の入力欄へ前の文字を流し込んでしまわないようにする。
    if (sameRoute) {
      Object.keys(snap.fields).forEach(function (id) {
        var el = root.querySelector('#' + CSS.escape(id));
        if (!el || el.type === 'file') return;
        el.value = snap.fields[id];
        if (el.tagName === 'TEXTAREA') el.dispatchEvent(new Event('input'));
      });
      window.scrollTo(0, snap.scroll);
      if (snap.focusId) {
        var f = root.querySelector('#' + CSS.escape(snap.focusId));
        if (f && f.focus) {
          f.focus();
          if (snap.selStart != null && f.setSelectionRange) {
            try { f.setSelectionRange(snap.selStart, snap.selStart); } catch (e) { /* select 等は無視 */ }
          }
        }
      }
    } else {
      window.scrollTo(0, 0);
    }
  }

  function draw() {
    var r = parse();
    var view = W.views[r.name];
    var sameRoute = current === r.key;
    var snap = snapshot();

    if (!view) {
      root.innerHTML = '';
      var nf = document.createElement('div');
      nf.className = 'view';
      nf.innerHTML = W.ui.empty('その画面はありません。', '') +
        '<div class="row row--center"><a class="btn btn--primary" href="#/today">今日にもどる</a></div>';
      root.appendChild(nf);
      current = r.key;
      return;
    }

    // 画面ごとに新しい入れ物を作る。こうすると mount() が付けたイベントは
    // 古い入れ物と一緒に捨てられ、二重に発火しない。
    root.innerHTML = '';
    var box = document.createElement('div');
    box.className = 'view view--' + r.name;
    box.innerHTML = view.render(r.params);
    root.appendChild(box);

    if (view.mount) view.mount(box, r.params);
    restore(snap, sameRoute);

    document.querySelectorAll('#tabbar a').forEach(function (a) {
      a.classList.toggle('is-on', a.dataset.tab === view.tab);
    });

    current = r.key;
    paintAppbar();
  }

  /* 保存のたびに同期で描き直すと、押した直後の入力欄の操作が間に合わない。
     一拍おいてまとめて描く。 */
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; draw(); });
  }

  function paintAppbar() {
    var now = new Date();
    document.getElementById('appbarMoon').innerHTML = W.moon.svg(now, 22);
    var name = W.store.state.settings.name;
    document.getElementById('appbarSub').textContent =
      name ? name + 'の月暦' : W.moon.phase(now).name;
  }

  function boot() {
    W.store.load();
    W.store.subscribe(schedule);
    window.addEventListener('hashchange', draw);

    // 日付をまたいだまま開きっぱなしのときのために、月の表示だけ更新する
    setInterval(function () {
      var today = W.ui.dayKey(new Date());
      if (W.store.state.settings.lastSeenDay !== today) {
        W.store.update(function (s) { s.settings.lastSeenDay = today; });
      }
    }, 60000);

    W.store.update(function (s) { s.settings.lastSeenDay = W.ui.dayKey(new Date()); });
    draw();

    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      navigator.serviceWorker.register('sw.js').catch(function () { /* 使えなくても動く */ });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  W.app = { draw: draw, go: function (hash) { location.hash = hash; } };
})(window.W = window.W || {});
