/* ===========================================================================
   ai.js — Claude API への接続（任意機能）
   ---------------------------------------------------------------------------
   このアプリの根っこは「記録はどこにも送らない」です。ここだけが例外になります。
   だから、次の約束で作ってあります。

     ・既定では動かない。あなたが〈設定〉で鍵を入れたときだけ動く
     ・送るのは、そのとき深めている願いの文章と、あなたが書いた答えだけ。
       気づき・夢・体重・睡眠・ほかの願いは、一切送らない
     ・送り先は Anthropic であって、私（このアプリの作者）ではない。
       中継するサーバーは存在しない

   AI の役割は「問いを立てること」だけに絞ってあります。
   願いを代わりに書かせない。それをやると、このアプリがいちばん大事にしている
   「自分で問いを立てる練習」が丸ごと消えるからです。
   =========================================================================== */
(function (W) {
  'use strict';

  var ENDPOINT = 'https://api.anthropic.com/v1/messages';
  var VERSION  = '2023-06-01';
  var MODEL    = 'claude-opus-5';
  var KEY_NAME = 'tsukuyomi:apikey';

  /* 鍵は記録本体とは別の場所に置く。書き出した JSON に鍵が混ざらないように。 */
  function getKey() {
    try { return localStorage.getItem(KEY_NAME) || ''; } catch (e) { return ''; }
  }
  function setKey(k) {
    try {
      if (k) localStorage.setItem(KEY_NAME, k.trim());
      else localStorage.removeItem(KEY_NAME);
      return true;
    } catch (e) { return false; }
  }
  function enabled() { return !!getKey(); }

  /* ------------------------------------------------------------- 問いの型 */

  var SYSTEM = [
    'あなたは、日本語で書かれた個人の「願い」を、本人がより解像度高く言い表せるように、',
    '問いを立てて手伝う役です。',
    '',
    '守ること:',
    '1. 答えや助言を書かない。問いだけを返す。願いを代わりに書き直さない。',
    '2. 「はい／いいえ」で終わる問いを出さない。「何が」「どんな」「どうすれば」を使う。',
    '3. 矢印は必ず本人に向ける。他人や環境を変える問いは出さない。',
    '4. 願いの中身を評価しない。世俗的でも、精神的でも、他人から見て小さくても、',
    '   そのまま受け取る。もっと大きな願いを持てとも、現実的になれとも言わない。',
    '5. 励まさない。前向きにさせようとしない。静かに、正確に訊く。',
    '6. 目標管理の言葉（KPI・達成・逆算・行動計画）を使わない。',
    '',
    '解像度を上げるとは、次のどれかがはっきりすることです。',
    '  ・誰に向かっているのか／誰といるのか',
    '  ・どんな場面で起きるのか（見えるもの、聞こえるもの）',
    '  ・何が起きたら「叶った」と言えるのか',
    '  ・その願いの下にある、本当に欲しいもの',
    '  ・いちばん小さい形にすると何になるのか',
    '  ・それが叶うとき、何を手放すことになるのか',
    '  ・本当に自分の願いか、誰かの声が混じっていないか',
    '',
    '出す問いは、いま空白になっている部分を優先する。',
    'すでに本人が書いていることを訊き返さない。',
    '各問いには、なぜそれを訊くのかを一文だけ添える（説教にしない）。'
  ].join('\n');

  var Q_SCHEMA = {
    type: 'object',
    properties: {
      questions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            q:   { type: 'string', description: '本人に向けた問い。日本語。40字前後。' },
            why: { type: 'string', description: 'なぜこれを訊くのか。一文。日本語。' }
          },
          required: ['q', 'why'],
          additionalProperties: false
        }
      }
    },
    required: ['questions'],
    additionalProperties: false
  };

  var R_SCHEMA = {
    type: 'object',
    properties: {
      observation: { type: 'string', description: '答えを読んで気づいた、輪郭の変化を一文で。日本語。' },
      candidates: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string', description: '言い直した願い。本人の言葉を使う。一文。' },
            note: { type: 'string', description: 'どこを具体にしたか。一文。' }
          },
          required: ['text', 'note'],
          additionalProperties: false
        }
      }
    },
    required: ['observation', 'candidates'],
    additionalProperties: false
  };

  /* ------------------------------------------------------------- 通信 */

  function call(body) {
    var key = getKey();
    if (!key) return Promise.reject(new Error('NO_KEY'));

    return fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': VERSION,
        // ブラウザから直接呼ぶことを明示する（中継サーバーを置かないため）
        'anthropic-dangerous-direct-browser-access': 'true',
        'anthropic-beta': 'server-side-fallback-2026-07-01'
      },
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.text().then(function (t) {
        var data = null;
        try { data = JSON.parse(t); } catch (e) { /* 本文が JSON でない場合もある */ }
        if (!res.ok) {
          var msg = (data && data.error && data.error.message) || t || ('HTTP ' + res.status);
          var err = new Error(msg);
          err.status = res.status;
          throw err;
        }
        return data;
      });
    }, function () {
      // fetch そのものが失敗＝ネットワーク不通か、ブラウザから直接呼べない状態
      throw new Error('NETWORK');
    });
  }

  /* 応答から本文のテキストだけを取り出す。fallback ブロックなどは読み飛ばす。 */
  function textOf(data) {
    if (!data || !Array.isArray(data.content)) return '';
    return data.content.filter(function (b) { return b.type === 'text'; })
      .map(function (b) { return b.text; }).join('');
  }

  function parsed(data) {
    if (data && data.stop_reason === 'refusal') throw new Error('REFUSED');
    var t = textOf(data).trim();
    if (!t) throw new Error('EMPTY');
    try { return JSON.parse(t); }
    catch (e) { throw new Error('BADJSON'); }
  }

  function base(extra) {
    return Object.assign({
      model: MODEL,
      max_tokens: 8000,          // 思考ぶんも含むので余裕をとる
      system: SYSTEM,
      // 問いの質がこの機能の value そのものなので、effort は落とさない
      output_config: { effort: 'high' },
      fallbacks: 'default'
    }, extra);
  }

  /* 願いの現状を、モデルに渡せる形にまとめる（送るのはここに入るものだけ） */
  function wishBrief(wish, questions) {
    var lines = ['【いまの願い】', wish.title];
    if (wish.essence) lines.push('', '【なぜ、それを願うのか】', wish.essence);
    if (wish.scene)   lines.push('', '【叶ったときの情景】', wish.scene);
    if (questions && questions.length) {
      lines.push('', '【本人がすでに立てている問い】');
      questions.slice(0, 8).forEach(function (q) {
        lines.push('・' + q.text + (q.answeredNote ? '（今のところ：' + q.answeredNote + '）' : ''));
      });
    }
    return lines.join('\n');
  }

  /* 深めるための問いを4つもらう */
  function askQuestions(wish, questions) {
    var brief = wishBrief(wish, questions);
    return call(base({
      messages: [{ role: 'user', content:
        brief + '\n\n---\n\nこの願いの解像度を上げるための問いを、4つ立ててください。' +
        '空白になっている部分を優先してください。' }],
      output_config: { effort: 'high', format: { type: 'json_schema', schema: Q_SCHEMA } }
    })).then(function (d) {
      var o = parsed(d);
      return { questions: (o.questions || []).slice(0, 4), usage: d.usage || null };
    });
  }

  /* 答えを踏まえて、言い直しの候補をもらう（決めるのは本人） */
  function reword(wish, qa) {
    var lines = [wishBrief(wish, null), '', '【問いと、本人の答え】'];
    qa.forEach(function (x) {
      lines.push('問：' + x.q);
      lines.push('答：' + (x.a || '（答えていない）'));
      lines.push('');
    });
    return call(base({
      messages: [{ role: 'user', content:
        lines.join('\n') +
        '\n---\n\n答えに現れた本人の言葉を使って、願いの言い直しの候補を3つ書いてください。' +
        'あなたの言葉で飾らず、本人が書いた語をできるだけそのまま拾ってください。' +
        '一文にしてください。決めるのは本人なので、候補として並べるだけにしてください。' }],
      output_config: { effort: 'high', format: { type: 'json_schema', schema: R_SCHEMA } }
    })).then(function (d) {
      var o = parsed(d);
      return { observation: o.observation || '', candidates: (o.candidates || []).slice(0, 3), usage: d.usage || null };
    });
  }

  /* 鍵の確認。いちばん軽い呼び出しで疎通だけ見る。 */
  function test() {
    return call({
      model: MODEL, max_tokens: 16,
      messages: [{ role: 'user', content: 'ok とだけ返してください。' }]
    }).then(function () { return true; });
  }

  /* 鍵を使わない人のための、貼り付け用プロンプト */
  function promptFor(wish, questions) {
    return SYSTEM + '\n\n---\n\n' + wishBrief(wish, questions) +
      '\n\n---\n\nこの願いの解像度を上げるための問いを、4つ立ててください。';
  }

  function errorText(e) {
    var m = e && e.message;
    if (m === 'NO_KEY')   return '〈設定〉でAPIキーを入れてください。';
    if (m === 'NETWORK')  return 'つながりませんでした。通信状態を確かめてください。' +
                                 'ブラウザから直接つなげない場合もあります（その場合は「プロンプトをコピー」をお使いください）。';
    if (m === 'REFUSED')  return 'この内容には答えられないと返ってきました。表現を変えて試してください。';
    if (m === 'BADJSON' || m === 'EMPTY') return '返答をうまく読み取れませんでした。もう一度試してください。';
    if (e && e.status === 401) return 'APIキーが違うようです。〈設定〉で確かめてください。';
    if (e && e.status === 429) return '呼び出しが多すぎます。少し待ってから試してください。';
    if (e && e.status === 400) return '要求の形が受け付けられませんでした。' + (m || '');
    return m || '不明なエラーです。';
  }

  /* おおよその費用（Opus 5：入力 $5 / 出力 $25 per 1M） */
  function costYen(usage, rate) {
    if (!usage) return null;
    var usd = (usage.input_tokens || 0) / 1e6 * 5 + (usage.output_tokens || 0) / 1e6 * 25;
    return Math.round(usd * (rate || 155) * 100) / 100;
  }

  W.ai = {
    MODEL: MODEL,
    getKey: getKey, setKey: setKey, enabled: enabled,
    askQuestions: askQuestions, reword: reword, test: test,
    promptFor: promptFor, errorText: errorText, costYen: costYen
  };
})(window.W = window.W || {});
