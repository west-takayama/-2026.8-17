/* ===========================================================================
   coach.js — 問いの質を見る
   ---------------------------------------------------------------------------
   AI も通信も使わない。日本語の言い回しから「問いの癖」を拾うだけの規則集。
   採点そのものは本人がやる（自分で見立てることが練習になるから）。
   ここが返すのは点数ではなく、視点をずらすためのひとことだけ。
   =========================================================================== */
(function (W) {
  'use strict';

  var RULES = [
    {
      id: 'why-not',
      test: /(なぜ|どうして|なんで|何故)[^。]{0,24}(ない|ないの|できない|くれない|しない)/,
      tone: 'warn',
      title: '犯人さがしになりかけているかも',
      body: '「なぜ〜ないのか」は過去のほうを向いた問いです。' +
            '「どうすれば〜できるだろう？」に置き換えると、同じ状況のまま出口が見えてきます。'
    },
    {
      id: 'should',
      test: /(べき|ねばならない|しなければ|しなきゃ|当然|ふつうは|普通は)/,
      tone: 'warn',
      title: '誰かの声が混ざっているかも',
      body: '「べき」が入る問いは、たいてい自分以外の誰かの基準です。' +
            '「本当は、私はどうしたいだろう？」と言い直してみてください。'
    },
    {
      id: 'blame',
      test: /(あの人|あいつ|上司|会社|世間|世の中|社会|みんな|親|周り|相手)(は|が|のせい|だから)/,
      tone: 'warn',
      title: '矢印が外を向いています',
      body: '相手を変える問いは、自分では動かせません。' +
            '「その状況の中で、私にできることは何だろう？」と、矢印を自分に向け直してみましょう。'
    },
    {
      id: 'someday',
      test: /(いつか|そのうち|いずれ|将来的に|そのうちに)/,
      tone: 'hint',
      title: '時期がぼやけています',
      body: '「いつか」は永遠に来ない日です。「今週のうちに」「次の満月までに」と区切ると、体が動きはじめます。'
    },
    {
      id: 'wish-not-question',
      test: function (t) { return /(たい|ほしい|欲しい|なりたい)。?$/.test(t) && !/[？?か]$/.test(t); },
      tone: 'hint',
      title: 'まだ願望文かもしれません',
      body: 'これは「願い」であって「問い」ではないかもしれません。' +
            '願いは〈願い〉に、ここには「そのために、私は何から始める？」のような問いを置いてみてください。'
    },
    {
      id: 'closed',
      test: function (t) {
        var open = /(何|なに|なぜ|どう|どこ|いつ|誰|だれ|どちら|いくつ|どんな|どれ)/.test(t);
        var isQ  = /[？?]|か$|かな|だろうか/.test(t);
        return isQ && !open;
      },
      tone: 'hint',
      title: 'はい／いいえで終わる問いかも',
      body: '「〜だろうか？」は答えが2つしかありません。' +
            '「何が」「どうすれば」「どんな」を入れると、考える余地が一気に広がります。'
    },
    {
      id: 'short',
      test: function (t) { return t.replace(/\s/g, '').length < 10; },
      tone: 'hint',
      title: '短すぎて手がかりが少ないかも',
      body: '状況をひとつ足すだけで、問いは具体になります。「いつ」「誰と」「どんなとき」のどれかを入れてみてください。'
    },
    {
      id: 'not-a-question',
      test: function (t) { return t.length > 0 && !/[？?]|か$|かな|だろう|でしょう/.test(t); },
      tone: 'hint',
      title: '問いの形になっていないかも',
      body: '言い切りの文は、そこで考えが止まります。語尾を「〜だろう？」にするだけで、続きが出てきます。'
    }
  ];

  var PRAISE = [
    {
      id: 'good-open',
      test: function (t) {
        return /(何|なに|どう|どんな|どこ)/.test(t) && /[？?]|だろう/.test(t) && t.length >= 12;
      },
      tone: 'good',
      title: '開かれた問いになっています',
      body: '答えがひとつに決まらない問いです。この形は、しばらく持ち歩くほど効いてきます。'
    },
    {
      id: 'good-self',
      test: function (t) { return /(私|自分|僕|俺|わたし)/.test(t) && /[？?]|だろう/.test(t); },
      tone: 'good',
      title: '矢印が自分に向いています',
      body: '自分に向いた問いだけが、自分を動かします。'
    }
  ];

  function match(rule, text) {
    return typeof rule.test === 'function' ? rule.test(text) : rule.test.test(text);
  }

  /* 気づきは多すぎると読まれないので、注意は最大2つ・褒めは1つに絞る */
  function review(text) {
    var t = (text || '').trim();
    if (!t) return [];
    var warns = [], hints = [], goods = [];
    RULES.forEach(function (r) {
      if (!match(r, t)) return;
      (r.tone === 'warn' ? warns : hints).push(r);
    });
    PRAISE.forEach(function (r) { if (match(r, t)) goods.push(r); });

    var out = warns.slice(0, 2);
    if (out.length < 2) out = out.concat(hints.slice(0, 2 - out.length));
    if (!warns.length && goods.length) out = goods.slice(0, 1).concat(out);
    return out;
  }

  /* 自己採点の3軸。合計 0〜9。 */
  var AXES = [
    { key: 'open', label: '開かれているか', hint: 'はい／いいえで終わらない' },
    { key: 'self', label: '自分に向いているか', hint: '自分で動かせる範囲にある' },
    { key: 'act',  label: '動きにつながるか', hint: '今日の一歩が見えている' }
  ];

  function grade(total) {
    if (total >= 7) return { label: 'よく研がれている', cls: 'g3' };
    if (total >= 4) return { label: '育っている',       cls: 'g2' };
    if (total >= 1) return { label: 'まだ荒い',         cls: 'g1' };
    return                 { label: '未採点',           cls: 'g0' };
  }

  W.coach = { review: review, AXES: AXES, grade: grade };
})(window.W = window.W || {});
