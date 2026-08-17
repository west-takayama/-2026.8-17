/* ===========================================================================
   moon.js — 月の満ち欠けの計算と描画
   ---------------------------------------------------------------------------
   外部ライブラリなし。
   単純に「基準の新月からの日数を 29.53 で割る」平均朔望では、月の軌道が
   楕円であるぶん最大で半日ずれる。半日ずれると「次の満月」の日付が
   一日まちがう。月がこのアプリの背骨である以上そこは譲れないので、
   Meeus『Astronomical Algorithms』の位相角の式（主要項のみ）を使っている。
   これで誤差はおおむね一時間以内におさまる。
   =========================================================================== */
(function (W) {
  'use strict';

  var SYNODIC = 29.530588853;   // 朔望月（日）。表示と初期推定にだけ使う。
  var DAY     = 86400000;

  function jd(date)  { return date.getTime() / DAY + 2440587.5; }
  function rad(deg)  { return deg * Math.PI / 180; }
  function mod360(x) { x = x % 360; return x < 0 ? x + 360 : x; }

  /* 太陽と月の平均軌道要素（度） */
  function elements(date) {
    var T = (jd(date) - 2451545.0) / 36525, T2 = T * T, T3 = T2 * T, T4 = T3 * T;
    return {
      D:  297.8501921 + 445267.1114034 * T - 0.0018819 * T2 + T3 / 545868 - T4 / 113065000, // 月の平均離角
      M:  357.5291092 +  35999.0502909 * T - 0.0001536 * T2 + T3 / 24490000,                // 太陽の平均近点離角
      Mp: 134.9633964 + 477198.8675055 * T + 0.0087414 * T2 + T3 / 69699 - T4 / 14712000    // 月の平均近点離角
    };
  }

  /* 位相角 i（度）。0°＝満月、180°＝新月。時間とともに単調に減っていく。 */
  function phaseAngle(date) {
    var e = elements(date);
    var D = rad(e.D), M = rad(e.M), Mp = rad(e.Mp);
    return mod360(
      180 - e.D
      - 6.289 * Math.sin(Mp)
      + 2.100 * Math.sin(M)
      - 1.274 * Math.sin(2 * D - Mp)
      - 0.658 * Math.sin(2 * D)
      - 0.214 * Math.sin(2 * Mp)
      - 0.110 * Math.sin(D)
    );
  }

  /* 月相ごとの名前とテーマ。このアプリのリズムはここから生まれる。 */
  var PHASES = [
    { key:'new',      name:'新月',     yomi:'しんげつ',   theme:'種をまく',
      note:'いちばん暗い夜。ここで言葉にしたものが、これからの一か月の芯になる。',
      act:'願いを書く／言葉にし直す' },
    { key:'crescent', name:'三日月',   yomi:'みかづき',   theme:'小さく動く',
      note:'細い光。大きく動かなくていい。今日ひとつだけ、手を触れる。',
      act:'5分でできる一歩' },
    { key:'first',    name:'上弦の月', yomi:'じょうげん', theme:'壁と向き合う',
      note:'半分の光と半分の影。止めているものの正体を見にいく頃。',
      act:'ひとつ決める' },
    { key:'gibbous1', name:'十三夜月', yomi:'じゅうさんや', theme:'問いを研ぐ',
      note:'満ちる直前。答えを急がず、問いのほうを磨く。',
      act:'問いを磨く' },
    { key:'full',     name:'満月',     yomi:'まんげつ',   theme:'感謝と手放し',
      note:'いちばん明るい夜。すでに叶っている部分を数え、握った手をひらく。',
      act:'感謝を書く／握りしめを確かめる' },
    { key:'gibbous2', name:'十六夜月', yomi:'いざよい',   theme:'分かち合う',
      note:'ためらうように昇る月。受け取ったものを、誰かに手渡す。',
      act:'気づきを言葉にする' },
    { key:'last',     name:'下弦の月', yomi:'かげん',     theme:'手放す',
      note:'欠けていく半月。いらないものを置いていく。減らすことが進むこと。',
      act:'ひとつ手放す' },
    { key:'balsamic', name:'有明月',   yomi:'ありあけ',   theme:'ゆだねる',
      note:'夜明けに残る月。何もしない時間。次の種のために空けておく。',
      act:'休む／ゆだねる' }
  ];

  function asDate(d) { return (d instanceof Date) ? d : new Date(d); }

  /* 周期内の位置 0..1（0＝新月、0.25＝上弦、0.5＝満月、0.75＝下弦）
     位相角が 0〜180° なら満ちる側、180〜360° なら欠ける側。 */
  function fraction(date) {
    var i = phaseAngle(asDate(date));
    return i <= 180 ? (180 - i) / 360 : 0.5 + (360 - i) / 360;
  }

  /* 月齢（日） */
  function age(date) { return fraction(date) * SYNODIC; }

  /* 輝面比 0..1（見えている面積の割合） */
  function illumination(date) {
    return (1 + Math.cos(rad(phaseAngle(asDate(date))))) / 2;
  }

  /* 満ちていく途中か */
  function isWaxing(date) { return fraction(date) < 0.5; }

  /* 8つの相のどれか。境目は半区間ずらして、新月の前後が「新月」になるようにする */
  function phase(date) {
    var i = Math.floor(fraction(date) * 8 + 0.5) % 8;
    return PHASES[i];
  }

  /* 記録に焼き付けるためのスナップショット。あとから月相で振り返れる。 */
  function stamp(date) {
    var d = (date instanceof Date) ? date : new Date(date);
    var p = phase(d);
    return {
      age:   Math.round(age(d) * 100) / 100,
      illum: Math.round(illumination(d) * 1000) / 1000,
      key:   p.key,
      name:  p.name,
      waxing: isWaxing(d)
    };
  }

  function addDays(date, n) { return new Date(asDate(date).getTime() + n * DAY); }

  /* -------------------------------------------------------------------------
     次に「その相」になる瞬間を求める。
     fraction は時間に対してほぼ一次なので、平均朔望で当たりをつけてから
     前後1.5日を二分探索する。式を解かずに済むぶん、間違えようがない。
     ------------------------------------------------------------------------- */
  function wrapDiff(x) {
    x = x % 1;
    if (x >  0.5) x -= 1;
    if (x < -0.5) x += 1;
    return x;
  }

  function nextTime(date, targetF) {
    var d0 = asDate(date), t0 = d0.getTime();
    var ahead = (((targetF - fraction(d0)) % 1) + 1) % 1;
    if (ahead < 0.002) ahead += 1;                       // ちょうど今なら次の周期を返す
    var est = t0 + ahead * SYNODIC * DAY;
    var lo = est - 1.5 * DAY, hi = est + 1.5 * DAY;
    for (var k = 0; k < 44; k++) {
      var mid = (lo + hi) / 2;
      if (wrapDiff(fraction(new Date(mid)) - targetF) < 0) lo = mid; else hi = mid;
    }
    return new Date((lo + hi) / 2);
  }

  function nextNew(date)  { return nextTime(date, 0); }
  function nextFull(date) { return nextTime(date, 0.5); }

  /* 直近の新月（＝いまの周期の始まり） */
  function lastNew(date) {
    var d = asDate(date);
    return nextTime(addDays(d, -SYNODIC * 1.02), 0);
  }

  /* 次に新月／満月が来るまでの日数 */
  function daysToNew(date)  { return (nextNew(date)  - asDate(date)) / DAY; }
  function daysToFull(date) { return (nextFull(date) - asDate(date)) / DAY; }

  /* -------------------------------------------------------------------------
     描画：輝いている部分の SVG パスを作る。
     右半円（または左半円）＋ 終端線の楕円弧、という古典的な組み立て。
     rx は cos(2πf) の絶対値。符号で弧の膨らむ向きが反転する。
     ------------------------------------------------------------------------- */
  function litPath(date, r) {
    var f = fraction(date);
    var k = Math.cos(2 * Math.PI * f);     // +1=新月, 0=半月, -1=満月
    var rx = Math.abs(k) * r;
    var waxing = f < 0.5;

    if (waxing) {
      // 右半分が光る。上→下を時計回り（右側を通る）
      return 'M0,' + (-r) + ' A' + r + ',' + r + ' 0 0 1 0,' + r +
             ' A' + rx + ',' + r + ' 0 0 ' + (k > 0 ? 0 : 1) + ' 0,' + (-r) + ' Z';
    }
    // 左半分が光る。上→下を反時計回り（左側を通る）
    return 'M0,' + (-r) + ' A' + r + ',' + r + ' 0 0 0 0,' + r +
           ' A' + rx + ',' + r + ' 0 0 ' + (k > 0 ? 1 : 0) + ' 0,' + (-r) + ' Z';
  }

  /* 月そのものを描いた SVG 文字列を返す */
  function svg(date, size) {
    var r = 10, pad = 0.6;
    return '<svg class="moon" viewBox="' + (-r - pad) + ' ' + (-r - pad) + ' ' +
           (2 * (r + pad)) + ' ' + (2 * (r + pad)) + '" width="' + size + '" height="' + size +
           '" role="img" aria-label="' + phase(date).name + '">' +
           '<circle r="' + r + '" class="moon__dark"/>' +
           '<path d="' + litPath(date, r) + '" class="moon__lit"/>' +
           '<circle r="' + r + '" class="moon__rim"/>' +
           '</svg>';
  }

  W.moon = {
    SYNODIC: SYNODIC,
    PHASES: PHASES,
    age: age,
    fraction: fraction,
    illumination: illumination,
    isWaxing: isWaxing,
    phase: phase,
    stamp: stamp,
    daysToNew: daysToNew,
    daysToFull: daysToFull,
    addDays: addDays,
    nextNew: nextNew,
    nextFull: nextFull,
    lastNew: lastNew,
    litPath: litPath,
    svg: svg,
    byKey: function (key) {
      for (var i = 0; i < PHASES.length; i++) if (PHASES[i].key === key) return PHASES[i];
      return PHASES[0];
    }
  };
})(window.W = window.W || {});
