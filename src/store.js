/* ===========================================================================
   store.js — データの保存と読み出し
   ---------------------------------------------------------------------------
   保存先は localStorage ひとつだけ。サーバーもアカウントもない。
   願いというもっとも私的なものを、他人の管理下に置かないための選択。
   バックアップは設定画面から JSON で書き出す（＝それがこのアプリの「クラウド」）。
   =========================================================================== */
(function (W) {
  'use strict';

  var KEY    = 'tsukuyomi:v1';
  var BACKUP = 'tsukuyomi:v1:prev';   // 直前の状態。壊れたときの保険。
  var VERSION = 1;

  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
  }

  function empty() {
    return {
      version:  VERSION,
      createdAt: new Date().toISOString(),
      settings: { name: '', lastSeenDay: null },
      wishes:   [],
      questions:[],
      notices:  [],
      rituals:  [],     // 新月と満月に行った儀式の記録
      days:     []      // 一日ひとつのコンディション（睡眠・調子・余白）
    };
  }

  /* 将来フィールドを足しても古いデータが壊れないよう、読み込み時に必ず補う */
  function migrate(data) {
    var base = empty();
    if (!data || typeof data !== 'object') return base;

    data.version   = VERSION;
    data.createdAt = data.createdAt || base.createdAt;
    data.settings  = Object.assign({}, base.settings, data.settings || {});
    data.wishes    = Array.isArray(data.wishes)    ? data.wishes    : [];
    data.questions = Array.isArray(data.questions) ? data.questions : [];
    data.notices   = Array.isArray(data.notices)   ? data.notices   : [];
    data.rituals   = Array.isArray(data.rituals)   ? data.rituals   : [];
    data.days      = Array.isArray(data.days)      ? data.days      : [];

    data.wishes.forEach(function (w) {
      w.id       = w.id || uid();
      w.status   = w.status || 'living';           // living | fulfilled | released
      w.pulses   = Array.isArray(w.pulses) ? w.pulses : [];
      w.tags     = Array.isArray(w.tags) ? w.tags : [];
      w.quietUntil = w.quietUntil || null;
      w.essence  = w.essence || '';
      w.scene    = w.scene || '';
    });
    data.questions.forEach(function (q) {
      q.id     = q.id || uid();
      q.scores = Object.assign({ open: null, self: null, act: null }, q.scores || {});
      q.parentId = q.parentId || null;
      q.wishId   = q.wishId || null;
      q.archived = !!q.archived;
    });
    data.notices.forEach(function (n) {
      n.id   = n.id || uid();
      n.kind = n.kind || 'sign';                   // sign | insight | thanks
      n.wishId = n.wishId || null;
      n.starred = !!n.starred;
    });
    return data;
  }

  var state = empty();
  var listeners = [];

  /* プライベートブラウズや、埋め込まれた枠の中では localStorage が使えないことがある。
     そこで黙って書けないままにすると、書いた願いが毎回消える。
     使えないことは最初にはっきり伝える。 */
  var writable = (function () {
    try {
      var k = 'tsukuyomi:test';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch (e) { return false; }
  })();

  function load() {
    if (!writable) { state = empty(); return state; }
    try {
      var raw = localStorage.getItem(KEY);
      state = migrate(raw ? JSON.parse(raw) : null);
    } catch (e) {
      console.warn('読み込みに失敗したため、バックアップを試します', e);
      try { state = migrate(JSON.parse(localStorage.getItem(BACKUP))); }
      catch (e2) { state = empty(); }
    }
    return state;
  }

  var warned = false;
  function persist() {
    if (!writable) {
      if (!warned) {
        warned = true;
        alert('このブラウザでは記録を保存できません。\n' +
              'プライベートブラウズを解除するか、別のブラウザで開いてください。\n' +
              'このまま書いたものは、画面を閉じると消えます。');
      }
      return;
    }
    try {
      var prev = localStorage.getItem(KEY);
      if (prev) localStorage.setItem(BACKUP, prev);
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      if (!warned) {
        warned = true;
        alert('保存できませんでした。ブラウザの保存容量を確認してください。\n' +
              '〈設定〉から書き出して、記録を守ってください。');
      }
      console.error(e);
    }
  }

  /* 変更は必ずここを通す。保存と再描画をひとつにまとめるため。 */
  function update(fn) {
    var r = fn(state);
    persist();
    listeners.forEach(function (l) { try { l(state); } catch (e) { console.error(e); } });
    return r;
  }

  function subscribe(fn) { listeners.push(fn); }

  /* ---------------- 願い ---------------- */

  function addWish(fields) {
    var now = new Date();
    var w = {
      id: uid(),
      title:   (fields.title || '').trim(),
      essence: (fields.essence || '').trim(),   // なぜ、それを願うのか
      scene:   (fields.scene || '').trim(),     // 叶ったときの情景
      status: 'living',
      createdAt: now.toISOString(),
      moonAtCreate: W.moon.stamp(now),
      fulfilledAt: null, fulfilledNote: '', moonAtFulfill: null,
      releasedAt: null,  releaseNote: '',
      quietUntil: null,
      pulses: [],
      tags: []
    };
    update(function (s) { s.wishes.unshift(w); });
    return w;
  }

  function getWish(id) {
    for (var i = 0; i < state.wishes.length; i++) if (state.wishes[i].id === id) return state.wishes[i];
    return null;
  }

  function editWish(id, patch) {
    update(function () { Object.assign(getWish(id) || {}, patch); });
  }

  /* 叶ったことにする（月相も一緒に刻む） */
  function fulfillWish(id, note) {
    var now = new Date();
    update(function () {
      var w = getWish(id); if (!w) return;
      w.status = 'fulfilled';
      w.fulfilledAt = now.toISOString();
      w.moonAtFulfill = W.moon.stamp(now);
      if (note != null) w.fulfilledNote = note;
      w.quietUntil = null;
    });
  }

  /* 手放す。失敗ではなく、ひとつの完了として扱う。 */
  function releaseWish(id, note) {
    var now = new Date();
    update(function () {
      var w = getWish(id); if (!w) return;
      w.status = 'released';
      w.releasedAt = now.toISOString();
      if (note != null) w.releaseNote = note;
      w.quietUntil = null;
    });
  }

  function reviveWish(id) {
    update(function () {
      var w = getWish(id); if (!w) return;
      w.status = 'living';
      w.fulfilledAt = null; w.moonAtFulfill = null;
      w.releasedAt = null;
    });
  }

  function removeWish(id) {
    update(function (s) {
      s.wishes = s.wishes.filter(function (w) { return w.id !== id; });
      s.questions.forEach(function (q) { if (q.wishId === id) q.wishId = null; });
      s.notices.forEach(function (n) { if (n.wishId === id) n.wishId = null; });
    });
  }

  /* 「今日の温度」。強さ（高いほどよい）と握りしめ（低いほどよい）は別物として持つ。 */
  function addPulse(wishId, intensity, grip, note) {
    var now = new Date();
    update(function () {
      var w = getWish(wishId); if (!w) return;
      w.pulses.push({
        id: uid(), at: now.toISOString(),
        intensity: Number(intensity), grip: Number(grip),
        note: (note || '').trim(), moon: W.moon.stamp(now)
      });
    });
  }

  function lastPulse(w) { return w.pulses.length ? w.pulses[w.pulses.length - 1] : null; }

  /* そっと置く。次の満月まで一覧から隠して、意識の手を離す。 */
  function quiet(wishId, days) {
    var until = W.moon.addDays(new Date(), days);
    update(function () { var w = getWish(wishId); if (w) w.quietUntil = until.toISOString(); });
  }
  function unquiet(wishId) {
    update(function () { var w = getWish(wishId); if (w) w.quietUntil = null; });
  }
  function isQuiet(w) {
    return !!(w.quietUntil && new Date(w.quietUntil).getTime() > Date.now());
  }

  /* ---------------- 問い ---------------- */

  function addQuestion(text, wishId, parentId) {
    var now = new Date();
    var q = {
      id: uid(),
      text: (text || '').trim(),
      wishId: wishId || null,
      parentId: parentId || null,
      createdAt: now.toISOString(),
      moon: W.moon.stamp(now),
      scores: { open: null, self: null, act: null },   // null は「まだ採点していない」
      answeredNote: '',
      archived: false
    };
    update(function (s) { s.questions.unshift(q); });
    return q;
  }

  function getQuestion(id) {
    for (var i = 0; i < state.questions.length; i++) if (state.questions[i].id === id) return state.questions[i];
    return null;
  }
  function editQuestion(id, patch) {
    update(function () { Object.assign(getQuestion(id) || {}, patch); });
  }
  function removeQuestion(id) {
    update(function (s) {
      s.questions = s.questions.filter(function (q) { return q.id !== id; });
      s.questions.forEach(function (q) { if (q.parentId === id) q.parentId = null; });
    });
  }
  function scoreOf(q) { return (q.scores.open || 0) + (q.scores.self || 0) + (q.scores.act || 0); }

  /* ---------------- 気づき ---------------- */

  function addNotice(text, kind, wishId) {
    var now = new Date();
    var n = {
      id: uid(),
      text: (text || '').trim(),
      kind: kind || 'sign',
      wishId: wishId || null,
      createdAt: now.toISOString(),
      moon: W.moon.stamp(now),
      starred: false
    };
    update(function (s) { s.notices.unshift(n); });
    return n;
  }
  function editNotice(id, patch) {
    update(function (s) {
      for (var i = 0; i < s.notices.length; i++) if (s.notices[i].id === id) Object.assign(s.notices[i], patch);
    });
  }
  function removeNotice(id) {
    update(function (s) { s.notices = s.notices.filter(function (n) { return n.id !== id; }); });
  }

  /* ---------------- 一日のコンディション ---------------- */

  /* 一日ひとつだけ。何度書いても上書きする（朝と夜で気が変わってもよい）。
     睡眠は「昨夜の睡眠」として扱う。その日の調子を説明する変数だから。 */
  function upsertDay(dayKey, fields) {
    var now = new Date();
    var found = null;
    for (var i = 0; i < state.days.length; i++) if (state.days[i].day === dayKey) found = state.days[i];

    if (found) {
      update(function () { Object.assign(found, fields, { at: now.toISOString() }); });
      return found;
    }
    var d = Object.assign({
      id: uid(),
      day: dayKey,
      at: now.toISOString(),
      moon: W.moon.stamp(now),
      sleep: null,        // 昨夜の睡眠（時間）
      condition: null,    // からだと心の調子 1〜5
      space: null,        // 余白・ゆとり 1〜5
      note: ''
    }, fields);
    update(function (s) { s.days.unshift(d); });
    return d;
  }

  function getDay(dayKey) {
    for (var i = 0; i < state.days.length; i++) if (state.days[i].day === dayKey) return state.days[i];
    return null;
  }

  function removeDay(dayKey) {
    update(function (s) { s.days = s.days.filter(function (d) { return d.day !== dayKey; }); });
  }

  /* ---------------- 儀式 ---------------- */

  /* 新月と満月に一度ずつ。その周期のあいだに何を受け取り、何を手放したかを残す。
     cycleStart（その周期の始まりの新月）を鍵にして、
     「この周期はもう済んだか」を判断できるようにしてある。 */
  function saveRitual(kind, cycleStart, fields) {
    var now = new Date();
    var key = ui_dayKeyless(cycleStart);
    var found = null;
    state.rituals.forEach(function (r) {
      if (r.kind === kind && ui_dayKeyless(r.cycleStart) === key) found = r;
    });

    if (found) {
      update(function () { Object.assign(found, fields, { at: now.toISOString() }); });
      return found;
    }
    var r = Object.assign({
      id: uid(),
      kind: kind,                       // 'new' | 'full'
      at: now.toISOString(),
      moon: W.moon.stamp(now),
      cycleStart: new Date(cycleStart).toISOString(),
      gratitude: [],                    // 満月：感謝
      letGo: '',                        // 満月：手放したもの
      intention: '',                    // 新月：この一巡りの意図
      focusQuestionId: null,            // 新月：持ち歩く問い
      note: ''
    }, fields);
    update(function (s) { s.rituals.unshift(r); });
    return r;
  }

  function getRitual(kind, cycleStart) {
    var key = ui_dayKeyless(cycleStart);
    for (var i = 0; i < state.rituals.length; i++) {
      var r = state.rituals[i];
      if (r.kind === kind && ui_dayKeyless(r.cycleStart) === key) return r;
    }
    return null;
  }

  /* ui.js に依存したくないので、日付キーだけここで作る */
  function ui_dayKeyless(d) {
    var x = (d instanceof Date) ? d : new Date(d);
    return x.getFullYear() + '-' + (x.getMonth() + 1) + '-' + x.getDate();
  }

  /* ---------------- 書き出し・読み込み ---------------- */

  function exportJSON() { return JSON.stringify(state, null, 2); }

  function importJSON(text, mode) {
    var incoming = migrate(JSON.parse(text));
    update(function (s) {
      if (mode === 'replace') {
        s.settings  = incoming.settings;
        s.wishes    = incoming.wishes;
        s.questions = incoming.questions;
        s.notices   = incoming.notices;
        s.rituals   = incoming.rituals;
        s.days      = incoming.days;
        return;
      }
      // 追加読み込み：同じ id のものは重複させない
      ['wishes', 'questions', 'notices', 'rituals', 'days'].forEach(function (k) {
        var seen = {};
        s[k].forEach(function (o) { seen[o.id] = true; });
        incoming[k].forEach(function (o) { if (!seen[o.id]) s[k].push(o); });
      });
    });
  }

  function reset() {
    update(function (s) {
      var fresh = empty();
      s.settings = fresh.settings;
      s.wishes = []; s.questions = []; s.notices = []; s.rituals = []; s.days = [];
    });
  }

  W.store = {
    uid: uid,
    writable: writable,
    load: load,
    get state() { return state; },
    update: update,
    subscribe: subscribe,

    addWish: addWish, getWish: getWish, editWish: editWish,
    fulfillWish: fulfillWish, releaseWish: releaseWish, reviveWish: reviveWish, removeWish: removeWish,
    addPulse: addPulse, lastPulse: lastPulse,
    quiet: quiet, unquiet: unquiet, isQuiet: isQuiet,

    addQuestion: addQuestion, getQuestion: getQuestion, editQuestion: editQuestion,
    removeQuestion: removeQuestion, scoreOf: scoreOf,

    addNotice: addNotice, editNotice: editNotice, removeNotice: removeNotice,

    saveRitual: saveRitual, getRitual: getRitual,
    upsertDay: upsertDay, getDay: getDay, removeDay: removeDay,

    exportJSON: exportJSON, importJSON: importJSON, reset: reset
  };
})(window.W = window.W || {});
