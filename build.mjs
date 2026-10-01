// 构建：用 esbuild 把 js/ 下的全部模块与 three.js 打包，内联进单个 dist/index.html（运行时不依赖 CDN）
import * as esbuild from 'esbuild';
import fs from 'fs';

const res = await esbuild.build({
  entryPoints: ['js/main.js'],
  bundle: true,
  minify: !process.argv.includes('--dev'),
  format: 'iife',
  target: ['es2020'],
  write: false,
  legalComments: 'none',
  logLevel: 'warning',
});
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

// index.html 是 claude.ai 在线版使用的页面片段（无 <html>/<head>/<body>，依赖 importmap 从 CDN 加载 three.js）。
// 这里把它包装成完整文档，并用打包后的脚本替换 importmap 与模块入口。
const src = fs.readFileSync('index.html', 'utf8');
const split = src.indexOf('<div id="app">');
if (split < 0) throw new Error('index.html 中找不到 <div id="app">');
const head = src.slice(0, split).trim();
const body = src.slice(split)
  .replace(/<script type="importmap">[\s\S]*?<\/script>\s*/, '')
  .replace(/<script type="module" src="js\/main\.js"><\/script>\s*/, '')
  .trim();
if (body.includes('importmap') || body.includes('js/main.js')) throw new Error('未能移除 importmap 或模块入口');

const description = '浏览器里的 3D《最终幻想XIV》同人致敬作品：八大种族捏脸、利姆萨·罗敏萨、拉诺西亚低地 FATE、天然要害沙斯塔夏溶洞与亲信战友。';
const html = `<!doctype html>
<html lang="zh-CN">
<head>
${head}
<meta name="description" content="${description}">
<meta property="og:title" content="艾欧泽亚冒险记">
<meta property="og:description" content="${description}">
</head>
<body>
${body}
<script>${js}</script>
</body>
</html>
`;
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/index.html', html);
console.log('dist/index.html', (html.length / 1024).toFixed(0) + ' KB');
