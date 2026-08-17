/* ===========================================================================
   resonance.js — 記録どうしの響き合いを見つける
   ---------------------------------------------------------------------------
   「これは3週間前の◯◯と似ていますね」を、通信もAIも使わずに出すための仕組み。
   形態素解析器も積まない（10年後も動くこと優先）。かわりに2つの channel を使う。

     語  … 漢字・カタカナ・英数字のかたまりを語とみなす。意味の芯を拾う。
     2文字 … 文字の2連（バイグラム）。ひらがなだけの言い回しの近さを拾う。

   どちらも IDF で重みづけする。「今日」「思う」のようにどの記録にも出る語は
   自動的に軽くなり、「鳥」「青」のように滅多に出ない語が強く効く。
   ——シンクロを感じるのは、まさにその「滅多に出ないものが重なったとき」だから。

   さらに、言葉以外の符合も見る。
     ・同じ月相の日に起きている
     ・ちょうど月ひと巡りぶんの間隔が空いている
     ・同じ願いに紐づいている
   =========================================================================== */
(function (W) {
  'use strict';

  var DAY = 86400000;

  /* 日本語は「知らない人」のように、動詞や形容詞の語幹が漢字一字で取り出されてしまう。
     それを共通語として数えると「知」「人」が重なっただけの組が上位に来て、
     肝心の「青」「鳥」を追い越す。だから語幹と汎用名詞だけを落としておく。
     猫・川・虹・青のような、それ自体が像を結ぶ字は残す。 */
  var STOP = {};
  ( // 動詞・形容詞の語幹
    '知 書 見 来 行 出 入 思 感 言 聞 話 持 取 作 使 会 立 待 動 続 始 終 変 教 覚 忘 決 考 ' +
    '開 閉 着 帰 通 過 残 落 起 寝 食 飲 買 売 送 受 返 呼 押 引 置 探 走 歩 座 生 死 ' +
    '多 少 大 小 高 低 長 短 新 古 早 遅 良 悪 強 弱 深 浅 近 遠 ' +
    // 位置・時間・数量の一般語
    '上 下 中 前 後 間 内 外 先 次 今 昔 頃 時 日 回 度 分 目 番 ' +
    // 形式名詞・接辞・一人称
    '事 物 方 所 者 為 的 化 性 気 人 私 僕 俺 自分 本当 今日 昨日 明日 一 二 三 何 様 同 別'
  ).split(' ').forEach(function (w) { if (w) STOP[w] = 1; });

  function normalize(s) {
    return String(s == null ? '' : s)
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[、。，．！？!?…「」『』（）()【】\[\]\-—–~〜:：;；,'"`·・\/\\]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* 漢字・カタカナ・英数字のかたまりを語として拾う */
  var TERM_RE = /[一-龥々〆ヶ]+|[ァ-ヴー]{2,}|[a-z0-9]{2,}/g;

  function terms(text) {
    var t = normalize(text), out = [], m;
    TERM_RE.lastIndex = 0;
    while ((m = TERM_RE.exec(t))) {
      var w = m[0].slice(0, 14);
      if (!STOP[w]) out.push(w);
      // 長い漢字の連なりは、中の2文字も拾っておく（「意味深長」と「意味」がつながるように）
      if (/^[一-龥]{3,}$/.test(w)) {
        for (var i = 0; i + 1 < w.length; i++) {
          var sub = w.slice(i, i + 2);
          if (!STOP[sub]) out.push(sub);
        }
      }
    }
    return out;
  }

  function bigrams(text) {
    var t = normalize(text).replace(/ /g, ''), out = [];
    for (var i = 0; i + 1 < t.length; i++) out.push(t.slice(i, i + 2));
    return out;
  }

  function countMap(list) {
    var m = {};
    list.forEach(function (x) { m[x] = (m[x] || 0) + 1; });
    return m;
  }

  /* -------------------------------------------------------------------------
     索引をつくる。記録が増えても毎回まるごと作り直すが、
     個人の記録は多くても数千件なので、それで十分間に合う。
     ------------------------------------------------------------------------- */
  var MAX_DOCS = 600;   // これより古いものは照合の対象から外す

  function buildIndex(notices) {
    var items = notices.slice(0, MAX_DOCS);
    var N = Math.max(1, items.length);
    var tDf = {}, bDf = {}, docs = [];

    items.forEach(function (n) {
      var t = countMap(terms(n.text));
      var b = countMap(bigrams(n.text));
      docs.push({ id: n.id, n: n, t: t, b: b, at: new Date(n.createdAt).getTime() });
      Object.keys(t).forEach(function (k) { tDf[k] = (tDf[k] || 0) + 1; });
      Object.keys(b).forEach(function (k) { bDf[k] = (bDf[k] || 0) + 1; });
    });

    function idfOf(df) {
      var idf = {};
      Object.keys(df).forEach(function (k) { idf[k] = Math.log(1 + N / df[k]); });
      return idf;
    }

    return { N: N, docs: docs, tDf: tDf, bDf: bDf, tIdf: idfOf(tDf), bIdf: idfOf(bDf),
             byId: docs.reduce(function (m, d) { m[d.id] = d; return m; }, {}) };
  }

  function cosine(a, b, idf) {
    var dot = 0, na = 0, nb = 0, k, w, v;
    for (k in a) { w = idf[k] || 1; v = a[k] * w; na += v * v; if (b[k]) dot += v * (b[k] * w); }
    for (k in b) { w = idf[k] || 1; v = b[k] * w; nb += v * v; }
    return (na && nb) ? dot / Math.sqrt(na * nb) : 0;
  }

  /* 2つの記録に共通する、めずらしい語だけを取り出す（説明に使う） */
  function sharedTerms(d1, d2, idx, limit) {
    var out = [];
    Object.keys(d1.t).forEach(function (k) {
      if (!d2.t[k]) return;
      if ((idx.tDf[k] || 0) / idx.N > 0.4) return;   // どこにでも出る語は「共通」と呼ばない
      out.push({ w: k, idf: idx.tIdf[k] || 0 });
    });
    out.sort(function (a, b) { return b.idf - a.idf || b.w.length - a.w.length; });

    // 「青」と「青い」のように片方が片方を含むときは、長いほうだけ残す
    var kept = [];
    out.forEach(function (o) {
      for (var i = 0; i < kept.length; i++) if (kept[i].w.indexOf(o.w) >= 0) return;
      kept.push(o);
    });
    return kept.slice(0, limit || 3).map(function (o) { return o.w; });
  }

  /* -------------------------------------------------------------------------
     2つの記録の響き合いの強さ。0〜1 くらいに収まる。
     ------------------------------------------------------------------------- */
  var SYN = 29.530588853;

  function score(d1, d2, idx) {
    var words = sharedTerms(d1, d2, idx, 3);
    var st = cosine(d1.t, d2.t, idx.tIdf);
    var sb = cosine(d1.b, d2.b, idx.bIdf);
    // 語のほうが意味を持つので重くする。2文字の連なりは言い回しの近さを補うだけ。
    var s = 0.70 * st + 0.30 * sb;

    var reasons = [];
    if (words.length) {
      reasons.push('「' + words.join('」「') + '」が重なっています');
      // 重なった語が「めずらしい語」であるほど加点する。数ではなく希少さで見る。
      var unit = Math.log(1 + idx.N / 2), bonus = 0;
      words.forEach(function (w) {
        var rare = Math.min(1, (idx.tIdf[w] || 0) / unit);
        bonus += 0.055 * rare * (w.length >= 2 ? 1 : 0.75);
      });
      s += Math.min(0.14, bonus);
    }

    var m1 = d1.n.moon, m2 = d2.n.moon;
    if (m1 && m2 && m1.key === m2.key) {
      s += 0.05;
      reasons.push('どちらも' + m1.name + 'の日です');
    }

    var gap = Math.abs(d1.at - d2.at) / DAY;
    if (gap >= SYN - 2) {
      var cycles = Math.round(gap / SYN);
      if (cycles >= 1 && Math.abs(gap - cycles * SYN) <= 1.6) {
        s += 0.07;
        reasons.push('ちょうど月' + (cycles === 1 ? 'ひと' : cycles) + '巡りぶん（' +
                     Math.round(gap) + '日）の間隔です');
      }
    }

    if (d1.n.wishId && d1.n.wishId === d2.n.wishId) {
      s += 0.05;
      var w = W.store.getWish(d1.n.wishId);
      if (w) reasons.push('同じ願い「' + w.title + '」に紐づいています');
    }

    return { score: s, reasons: reasons, words: words, gapDays: gap };
  }

  /* しきい値。低すぎると何もかもが「符合」になり、体験そのものが安っぽくなる。
     ここは緩めるより、厳しくして取りこぼすほうがいい。
     2文字以上の語が重なっているときだけ緩め、あとは厳しく見る。 */
  function passes(r) {
    if (!r.words.length) return r.score >= 0.34;
    var strong = r.words.some(function (w) { return w.length >= 2; });
    return r.score >= (strong ? 0.17 : 0.24);
  }

  /* ある記録に響き合う、ほかの記録 */
  function echoesFor(noticeId, idx, limit) {
    var d = idx.byId[noticeId];
    if (!d) return [];
    var out = [];
    idx.docs.forEach(function (o) {
      if (o.id === d.id) return;
      var r = score(d, o, idx);
      if (passes(r)) out.push({ notice: o.n, score: r.score, reasons: r.reasons, words: r.words });
    });
    out.sort(function (a, b) { return b.score - a.score; });
    return out.slice(0, limit || 3);
  }

  /* 響き合っている組をすべて（星座の線を引くのに使う） */
  function allPairs(idx, limit) {
    var out = [];
    for (var i = 0; i < idx.docs.length; i++) {
      for (var j = i + 1; j < idx.docs.length; j++) {
        var r = score(idx.docs[i], idx.docs[j], idx);
        if (passes(r)) out.push({ a: idx.docs[i], b: idx.docs[j], score: r.score, reasons: r.reasons, words: r.words });
      }
    }
    out.sort(function (x, y) { return y.score - x.score; });
    return limit ? out.slice(0, limit) : out;
  }

  /* くり返し現れている語。「パターン」のいちばん素直な形。 */
  function recurring(idx, minCount) {
    var min = minCount || 2;
    var byTerm = {};
    idx.docs.forEach(function (d) {
      Object.keys(d.t).forEach(function (k) {
        if ((idx.tDf[k] || 0) / idx.N > 0.4) return;
        if (k.length < 1) return;
        (byTerm[k] = byTerm[k] || []).push(d);
      });
    });
    var out = [];
    Object.keys(byTerm).forEach(function (k) {
      var ds = byTerm[k];
      if (ds.length < min) return;
      out.push({ word: k, docs: ds, count: ds.length, weight: ds.length * (idx.tIdf[k] || 1) });
    });

    // 「青」と「青い鳥」の両方は出さない。強いほうだけ残す。
    out.sort(function (a, b) { return b.weight - a.weight; });
    var kept = [];
    out.forEach(function (o) {
      for (var i = 0; i < kept.length; i++) {
        if (kept[i].word.indexOf(o.word) >= 0 || o.word.indexOf(kept[i].word) >= 0) return;
      }
      kept.push(o);
    });
    return kept;
  }

  /* -------------------------------------------------------------------------
     星図の座標。
       角度 … その日の月相（真上が新月、右回りに満ちて、真下が満月）
       半径 … 何巡り前か（古いほど内側、新しいほど外側）
     こうすると「同じ月相に起きたこと」が同じ方角にそろう。
     ------------------------------------------------------------------------- */
  function starPos(date, now, maxCycles, rMin, rMax) {
    var d = (date instanceof Date) ? date : new Date(date);
    var cyclesAgo = Math.max(0, (now.getTime() - d.getTime()) / (SYN * DAY));
    var k = Math.min(1, cyclesAgo / maxCycles);
    var r = rMax - k * (rMax - rMin);
    var th = W.moon.fraction(d) * 2 * Math.PI - Math.PI / 2;   // 新月を真上に
    return { x: Math.cos(th) * r, y: Math.sin(th) * r, r: r, theta: th, cyclesAgo: cyclesAgo };
  }

  /* 索引づくりも総当たりも、記録が増えると効いてくる。
     画面を描くたびに作り直さないよう、内容が変わったときだけ組み直す。 */
  var cache = { sig: null, idx: null, pairs: null };

  function signature(notices) {
    var head = notices[0];
    return notices.length + ':' + (head ? head.id + ':' + head.text.length : '-');
  }

  function index(notices) {
    var sig = signature(notices);
    if (cache.sig !== sig) { cache = { sig: sig, idx: buildIndex(notices), pairs: null }; }
    return cache.idx;
  }

  function pairs(notices) {
    var idx = index(notices);
    if (!cache.pairs) cache.pairs = allPairs(idx);
    return cache.pairs;
  }

  W.resonance = {
    normalize: normalize, terms: terms, bigrams: bigrams,
    buildIndex: buildIndex, score: score, passes: passes, sharedTerms: sharedTerms,
    echoesFor: echoesFor, allPairs: allPairs, recurring: recurring, starPos: starPos,
    index: index, pairs: pairs
  };
})(window.W = window.W || {});
