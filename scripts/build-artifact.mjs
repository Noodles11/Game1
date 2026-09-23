// Inline the Vite build into one self-contained HTML body for a claude.ai artifact.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const assets = readdirSync(join(dist, 'assets'));
const css = assets.filter((f) => f.endsWith('.css')).map((f) => readFileSync(join(dist, 'assets', f), 'utf8')).join('\n');
const js = assets.filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(dist, 'assets', f), 'utf8')).join('\n');

const title = html.match(/<title>[\s\S]*?<\/title>/)[0];
const fonts = [...html.matchAll(/<link[^>]+fonts\.googleapis\.com\/css2[^>]*>/g)].map((m) => m[0]).join('\n');
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1].replace(/<script[\s\S]*?<\/script>/g, '').trim();

const out = `${title}
${fonts}
<style>
${css}
html,body{height:100%}
</style>
${body}
<script type="module">
${js.replace(/<\/script/gi, '<\\/script')}
</script>
`;
mkdirSync('dist-artifact', { recursive: true });
writeFileSync('dist-artifact/reprint.html', out);
console.log(`dist-artifact/reprint.html ${(out.length / 1024).toFixed(1)} KB`);
