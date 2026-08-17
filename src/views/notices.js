/* ===========================================================================
   views/notices.js — 気づきの記録
   ---------------------------------------------------------------------------
   日ごとにまとめて、その日の月と一緒に並べる。
   あとから読み返したときに「あの満月の頃に書いたな」と思い出せる形にしたい。
   =========================================================================== */
(function (W) {
  'use strict';
  var ui = W.ui, esc = ui.esc;

  /* 選んだ種類は覚えておく（描き直しで既定値に戻らないように） */
  var lastKind = 'sign';

  function filters(params) {
    var kinds = ['all'].concat(Object.keys(ui.KINDS));
    var chips = kinds.map(function (k) {
      var label = k === 'all' ? 'すべて' : ui.KINDS[k].label;
      var on = (params.kind || 'all') === k;
      return '<a class="chip' + (on ? ' is-on' : '') + '" href="' + esc(hrefWith(params, { kind: k })) + '">' + esc(label) + '</a>';
    }).join('');

    chips += '<a class="chip' + (params.star ? ' is-on' : '') + '" href="' +
      esc(hrefWith(params, { star: params.star ? null : 1 })) + '">★ しるし</a>';

    var search = '<input id="filterQ" class="in in--sm" type="search" placeholder="言葉でさがす" value="' +
      esc(params.q || '') + '">';

    var wishSel = search + '<select id="filterWish" class="sel sel--sm">' +
      '<option value="">すべての願い</option>' +
      W.store.state.wishes.map(function (w) {
        return '<option value="' + esc(w.id) + '"' + (params.wish === w.id ? ' selected' : '') + '>' + esc(w.title) + '</option>';
      }).join('') +
      '<option value="__none"' + (params.wish === '__none' ? ' selected' : '') + '>願いに紐づかないもの</option>' +
      '</select>';

    return '<div class="filters"><div class="chips">' + chips + '</div>' + wishSel + '</div>';
  }

  function hrefWith(params, patch) {
    var p = Object.assign({}, params, patch);
    var qs = [];
    if (p.kind && p.kind !== 'all') qs.push('kind=' + encodeURIComponent(p.kind));
    if (p.wish) qs.push('wish=' + encodeURIComponent(p.wish));
    if (p.star) qs.push('star=1');
    if (p.q) qs.push('q=' + encodeURIComponent(p.q));
    return '#/notices' + (qs.length ? '?' + qs.join('&') : '');
  }

  function composer(params) {
    var kinds = Object.keys(ui.KINDS).map(function (k) {
      return '<button type="button" class="chip chip--k chip--' + k + (k === lastKind ? ' is-on' : '') +
             '" data-kind="' + k + '"><span>' + esc(ui.KINDS[k].label) + '</span>' +
             '<small>' + esc(ui.KINDS[k].hint) + '</small></button>';
    }).join('');
    return '' +
      '<section class="card card--form">' +
        '<div class="chips chips--wide" id="kindChips">' + kinds + '</div>' +
        '<textarea id="nText" class="ta" rows="2" placeholder="今日、目にとまったこと"></textarea>' +
        '<div class="row row--between">' +
          '<select id="nWish" class="sel">' + ui.wishOptions(params.wish && params.wish !== '__none' ? params.wish : null) + '</select>' +
          '<button class="btn btn--primary" data-act="n-save">書きとめる</button>' +
        '</div>' +
      '</section>' + W.echoView.justWritten();
  }

  function item(n) {
    var w = n.wishId ? W.store.getWish(n.wishId) : null;
    return '' +
      '<li class="note' + (n.starred ? ' is-star' : '') + '">' +
        '<div class="note__head">' +
          '<span class="nlist__k nlist__k--' + esc(n.kind) + '">' + esc(ui.KINDS[n.kind].label) + '</span>' +
          '<span class="note__time">' + esc(ui.fmtTime(n.createdAt)) + '</span>' +
          (w ? '<a class="note__w" href="#/wish/' + esc(w.id) + '">' + esc(w.title) + '</a>' : '') +
          '<span class="note__sp"></span>' +
          '<button class="iconb" data-act="star" data-id="' + esc(n.id) + '" aria-label="しるしをつける">' + (n.starred ? '★' : '☆') + '</button>' +
          '<button class="iconb" data-act="del" data-id="' + esc(n.id) + '" aria-label="消す">×</button>' +
        '</div>' +
        '<p class="note__t">' + ui.nl2br(n.text) + '</p>' +
      '</li>';
  }

  function render(params) {
    var list = W.store.state.notices.slice();
    if (params.kind && params.kind !== 'all') list = list.filter(function (n) { return n.kind === params.kind; });
    if (params.wish === '__none') list = list.filter(function (n) { return !n.wishId; });
    else if (params.wish) list = list.filter(function (n) { return n.wishId === params.wish; });
    if (params.star) list = list.filter(function (n) { return n.starred; });
    if (params.q) {
      var q = W.resonance.normalize(params.q);
      list = list.filter(function (n) { return W.resonance.normalize(n.text).indexOf(q) >= 0; });
    }

    var groups = [], byDay = {};
    list.forEach(function (n) {
      var k = ui.dayKey(n.createdAt);
      if (!byDay[k]) { byDay[k] = []; groups.push({ key: k, at: n.createdAt, items: byDay[k] }); }
      byDay[k].push(n);
    });

    var body = groups.length ? groups.map(function (g) {
      var d = new Date(g.at);
      return '<section class="day">' +
        '<h2 class="day__h">' + W.moon.svg(d, 16) +
          '<span>' + esc(ui.fmtFull(d)) + '</span>' +
          '<small>' + esc(W.moon.phase(d).name) + '</small></h2>' +
        '<ul class="notes">' + g.items.map(item).join('') + '</ul>' +
      '</section>';
    }).join('') : ui.empty('まだ何も書かれていません。',
        '「これは関係あるかも」と思った瞬間に書くのが、いちばん残ります。');

    return composer(params) + filters(params) +
      '<p class="count-line">' + list.length + ' 件</p>' + body;
  }

  function mount(root, params) {
    var kind = lastKind;
    var chips = root.querySelector('#kindChips');
    if (chips) chips.addEventListener('click', function (e) {
      var c = e.target.closest('.chip'); if (!c) return;
      kind = lastKind = c.dataset.kind;
      chips.querySelectorAll('.chip').forEach(function (x) { x.classList.toggle('is-on', x === c); });
    });
    var ta = root.querySelector('#nText');
    if (ta) ui.autogrow(ta);

    var fw = root.querySelector('#filterWish');
    if (fw) fw.addEventListener('change', function () {
      location.hash = hrefWith(params, { wish: fw.value || null });
    });

    var fq = root.querySelector('#filterQ');
    if (fq) {
      var timer;
      fq.addEventListener('input', function () {
        clearTimeout(timer);
        timer = setTimeout(function () {
          location.hash = hrefWith(params, { q: fq.value.trim() || null });
        }, 450);
      });
    }

    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      if (b.dataset.act === 'n-save') {
        var t = ta.value.trim(); if (!t) { ta.focus(); return; }
        var n = W.store.addNotice(t, kind, root.querySelector('#nWish').value || null);
        ta.value = ''; ta.dispatchEvent(new Event('input'));
        ui.setEcho(n.id);
        ui.toast('書きとめました');
      }
      if (b.dataset.act === 'star') {
        var id = b.dataset.id;
        var n = W.store.state.notices.filter(function (x) { return x.id === id; })[0];
        if (n) W.store.editNotice(id, { starred: !n.starred });
      }
      if (b.dataset.act === 'del') {
        if (confirm('この記録を消しますか？')) W.store.removeNotice(b.dataset.id);
      }
    });
  }

  W.views = W.views || {};
  W.views.notices = { render: render, mount: mount, tab: 'notices' };
})(window.W = window.W || {});
