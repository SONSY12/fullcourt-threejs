import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDirectory = dirname(dirname(fileURLToPath(import.meta.url)));
const distDirectory = join(projectDirectory, 'dist');
const indexPath = join(distDirectory, 'index.html');
let html = readFileSync(indexPath, 'utf8');

const scriptMatch = html.match(/<script type="module" crossorigin src="\.\/assets\/([^"]+)"><\/script>/);
const styleMatch = html.match(/<link rel="stylesheet" crossorigin href="\.\/assets\/([^"]+)">/);

if (!scriptMatch || !styleMatch) {
  throw new Error('Native build assets were not found in dist/index.html');
}

const script = readFileSync(join(distDirectory, 'assets', scriptMatch[1]), 'utf8').replaceAll('</script', '<\\/script');
const style = readFileSync(join(distDirectory, 'assets', styleMatch[1]), 'utf8').replaceAll('</style', '<\\/style');

html = html
  .replace(scriptMatch[0], () => `<script type="module">${script}</script>`)
  .replace(styleMatch[0], () => `<style>${style}</style>`);

writeFileSync(indexPath, html);
rmSync(join(distDirectory, 'assets'), { recursive: true, force: true });
