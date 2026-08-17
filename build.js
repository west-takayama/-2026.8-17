#!/usr/bin/env node
/* ===========================================================================
   build.js — 全部を1枚の HTML にまとめる
   ---------------------------------------------------------------------------
   このアプリはビルドしなくても動きます（index.html を開くだけ）。
   これは「配るため」だけの道具です。

   CSS も JS もアイコンも1つのファイルに入れてしまうと、
   メールや AirDrop で自分のスマホに送って、そのまま開けるようになります。
   サーバーもインターネットもいりません。

     node build.js        →  dist/tsukuyomi.html

   =========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const html = read('index.html');

/* <script src="..."> と <link rel="stylesheet"> を、中身そのものに置き換える。
   </script> という文字列が JS の中にあると途中で閉じてしまうので、そこだけ逃がす。 */
const guard = (js) => js.replace(/<\/script>/gi, '<\\/script>');

let out = html
  .replace(/[ \t]*<link rel="stylesheet" href="([^"]+)">/g, (m, href) =>
    '<style>\n' + read(href) + '\n</style>')
  .replace(/[ \t]*<script src="([^"]+)"><\/script>\n?/g, (m, src) =>
    '<script>\n' + guard(read(src)) + '\n</script>\n');

/* アイコンは data URI にして埋める。manifest と service worker は
   1枚ファイルでは使えない（別ファイルが必要）ので、参照ごと落とす。 */
const icon = 'data:image/svg+xml;base64,' + Buffer.from(read('assets/icon.svg')).toString('base64');
out = out
  .replace(/href="assets\/icon\.svg"/g, `href="${icon}"`)
  .replace(/[ \t]*<link rel="manifest"[^>]*>\n?/g, '');

/* 1枚ファイルには sw.js を同梱できない（別ファイルでないと動かない）ので、
   登録しようとする部分ごと取り除く。ファイル自体が手元にあるため、
   これがなくても圏外で開けます。 */
const swBlock = /\n[ \t]*if \('serviceWorker' in navigator[\s\S]*?\n[ \t]*\}\n/;
if (!swBlock.test(out)) {
  console.error('service worker の登録部分が見つかりませんでした。app.js の書き方を確認してください。');
  process.exit(1);
}
out = out.replace(swBlock, '\n');

const leftover = /<script src=|<link rel="stylesheet"/.test(out);
if (leftover) {
  console.error('取り込めなかった参照が残っています。index.html の書き方を確認してください。');
  process.exit(1);
}

fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
const dest = path.join(ROOT, 'dist', 'tsukuyomi.html');
fs.writeFileSync(dest, out);

console.log('できました:', path.relative(ROOT, dest),
            '（' + (Buffer.byteLength(out) / 1024).toFixed(0) + ' KB）');
