/* ===========================================================================
   ui.js — 描画のための小さな道具
   ---------------------------------------------------------------------------
   フレームワークは使わない。テンプレート文字列＋エスケープ関数で十分な規模。
   ユーザーが書いた文章をそのまま HTML に埋めないよう、esc() を必ず通すこと。
   =========================================================================== */
(function (W) {
  'use strict';

  var MAP = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return MAP[c]; });
  }
  function nl2br(s) { return esc(s).replace(/\n/g, '<br>'); }

  /* ---- 日付まわり（すべてローカル時間） ---- */

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function dayKey(d) {
    d = (d instanceof Date) ? d : new Date(d);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  var WDAY = ['日','月','火','水','木','金','土'];
  function fmtDate(d) {
    d = (d instanceof Date) ? d : new Date(d);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日(' + WDAY[d.getDay()] + ')';
  }
  function fmtFull(d) {
    d = (d instanceof Date) ? d : new Date(d);
    return d.getFullYear() + '年' + fmtDate(d);
  }
  function fmtTime(d) {
    d = (d instanceof Date) ? d : new Date(d);
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function daysBetween(a, b) {
    var x = new Date(a), y = new Date(b);
    x.setHours(0,0,0,0); y.setHours(0,0,0,0);
    return Math.round((y - x) / 86400000);
  }
  function ago(iso) {
    var n = daysBetween(iso, new Date());
    if (n === 0) return '今日';
    if (n === 1) return 'きのう';
    if (n < 7)   return n + '日前';
    if (n < 30)  return Math.floor(n / 7) + '週間前';
    if (n < 365) return Math.floor(n / 30) + 'か月前';
    return Math.floor(n / 365) + '年前';
  }

  /* ---- 部品 ---- */

  var KINDS = {
    sign:    { label: '兆し',  hint: '願いに関係ありそうな、小さな出来事' },
    insight: { label: '気づき', hint: 'ふと分かったこと、考えが変わったこと' },
    thanks:  { label: '感謝',  hint: 'すでに受け取っていたもの' }
  };

  /* 数値の推移を折れ線で。点が1つでも描けるようにしてある。 */
  function sparkline(values, opts) {
    opts = opts || {};
    var w = opts.width || 120, h = opts.height || 28, min = opts.min || 1, max = opts.max || 5;
    if (!values.length) return '';
    var span = Math.max(1, max - min);
    var step = values.length > 1 ? w / (values.length - 1) : 0;
    var pts = values.map(function (v, i) {
      var x = values.length > 1 ? i * step : w / 2;
      var y = h - ((v - min) / span) * (h - 4) - 2;
      return Math.round(x * 10) / 10 + ',' + Math.round(y * 10) / 10;
    });
    // 横は容器いっぱいに伸ばしたいので preserveAspectRatio は none。
    // そのままだと線まで横に潰れるので、太さは変形の影響を受けないようにする。
    var body = values.length > 1
      ? '<polyline points="' + pts.join(' ') + '" fill="none" stroke="currentColor" stroke-width="1.6"' +
        ' vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/>'
      : '<circle cx="' + (w / 2) + '" cy="' + pts[0].split(',')[1] + '" r="2.4" fill="currentColor"/>';
    return '<svg class="spark" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none"' +
           ' width="' + w + '" height="' + h + '" aria-hidden="true">' + body + '</svg>';
  }

  /* 1〜5 を選ぶボタン列。name でグループ化し、選択値は data-value に持つ。 */
  function scale(name, value, labels) {
    var out = '<div class="scale" data-scale="' + esc(name) + '" data-value="' + (value || '') + '">';
    for (var i = 1; i <= 5; i++) {
      out += '<button type="button" class="scale__b' + (Number(value) === i ? ' is-on' : '') +
             '" data-v="' + i + '" aria-label="' + i + '">' + i + '</button>';
    }
    out += '</div>';
    if (labels) out += '<div class="scale__legend"><span>' + esc(labels[0]) + '</span><span>' + esc(labels[1]) + '</span></div>';
    return out;
  }

  /* scale() で作った列を機能させる */
  function bindScales(root) {
    root.querySelectorAll('[data-scale]').forEach(function (box) {
      box.addEventListener('click', function (e) {
        var b = e.target.closest('.scale__b'); if (!b) return;
        box.dataset.value = b.dataset.v;
        box.querySelectorAll('.scale__b').forEach(function (x) { x.classList.toggle('is-on', x === b); });
        box.dispatchEvent(new CustomEvent('scale:change', { bubbles: true, detail: { value: Number(b.dataset.v) } }));
      });
    });
  }
  function scaleValue(root, name) {
    var box = root.querySelector('[data-scale="' + name + '"]');
    return box && box.dataset.value ? Number(box.dataset.value) : null;
  }

  /* textarea を中身に合わせて伸ばす */
  function autogrow(el) {
    function fit() { el.style.height = 'auto'; el.style.height = (el.scrollHeight + 2) + 'px'; }
    el.addEventListener('input', fit); fit();
  }

  function empty(msg, sub) {
    return '<div class="empty"><p>' + esc(msg) + '</p>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div>';
  }

  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'toast'; t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('is-in'); });
    setTimeout(function () {
      t.classList.remove('is-in');
      setTimeout(function () { t.remove(); }, 300);
    }, 1900);
  }

  /* 願いの選択肢（気づきや問いを紐づけるため） */
  function wishOptions(selectedId, includeNone) {
    var s = W.store.state;
    var out = includeNone === false ? '' : '<option value="">（願いに紐づけない）</option>';
    s.wishes.filter(function (w) { return w.status === 'living'; })
      .concat(s.wishes.filter(function (w) { return w.status !== 'living'; }))
      .forEach(function (w) {
        out += '<option value="' + esc(w.id) + '"' + (w.id === selectedId ? ' selected' : '') + '>' +
               (w.status === 'fulfilled' ? '✓ ' : w.status === 'released' ? '○ ' : '') + esc(w.title) + '</option>';
      });
    return out;
  }

  W.ui = {
    esc: esc, nl2br: nl2br,
    dayKey: dayKey, fmtDate: fmtDate, fmtFull: fmtFull, fmtTime: fmtTime,
    daysBetween: daysBetween, ago: ago,
    KINDS: KINDS,
    sparkline: sparkline, scale: scale, bindScales: bindScales, scaleValue: scaleValue,
    autogrow: autogrow, empty: empty, toast: toast, wishOptions: wishOptions
  };
})(window.W = window.W || {});
