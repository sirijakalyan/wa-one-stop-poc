// Builds the in-page preview and inlines it into ONE html file:
//   npm run build:preview -w client   ->   client/dist-preview/preview.html
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
execSync('npx vite build --config vite.artifact.config.js', { cwd: root, stdio: 'inherit' });

const js = readFileSync(path.join(root, 'dist-preview', 'preview.js'), 'utf8').replace(/<\/script/gi, '<\\/script');
const css = readFileSync(path.join(root, 'dist-preview', 'style.css'), 'utf8');

const html = `<meta charset="utf-8">
<title>WA One-Stop Checklist Preview</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
${css}
</style>
<div id="root"></div>
<script>
${js}
</script>
`;
const out = path.join(root, 'dist-preview', 'preview.html');
writeFileSync(out, html);
console.log(`Wrote ${out} (${Math.round(html.length / 1024)} KB)`);
