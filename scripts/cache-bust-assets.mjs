import {createHash, randomUUID} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';

const htmlPath = new URL('../index.html', import.meta.url);
let html = await readFile(htmlPath, 'utf8');
const assetPattern = /((?:src|href)=["'])(\/?(?:js|css)\/[^"'?#]+)(?:\?[^"']*)?(["'])/g;
const assets = [...html.matchAll(assetPattern)];
const hashedAssets = new Map();

for (const [, , assetPath] of assets) {
  if (hashedAssets.has(assetPath)) continue;
  const filePath = new URL(`../${assetPath.replace(/^\//, '')}`, import.meta.url);
  const contents = await readFile(filePath);
  const hash = createHash('sha256').update(contents).digest('hex').slice(0, 16);
  hashedAssets.set(assetPath, hash);
}

html = html.replace(assetPattern, (_match, attribute, assetPath, quote) =>
  `${attribute}${assetPath}?v=${hashedAssets.get(assetPath)}${quote}`,
);

const buildMeta = /(<meta\s+name=["']hero-build-id["']\s+content=["'])[^"']*(["']\s*\/?\s*>)/i;
const normalizedHtml = html
  .replace(assetPattern, (_match, attribute, assetPath, quote) => `${attribute}${assetPath}${quote}`)
  .replace(buildMeta, (_match, prefix, suffix) => `${prefix}local${suffix}`);
const assetManifest = [...hashedAssets].map(([path, hash]) => `${path}:${hash}`).join('\n');
const contentHash = createHash('sha256').update(`${normalizedHtml}\n${assetManifest}`).digest('hex').slice(0, 12);
const buildId = `${contentHash}-${randomUUID()}`;
if (buildMeta.test(html)) {
  html = html.replace(buildMeta, (_match, prefix, suffix) => `${prefix}${buildId}${suffix}`);
} else {
  html = html.replace('</head>', `    <meta name="hero-build-id" content="${buildId}">\n</head>`);
}

await writeFile(htmlPath, html);
console.log(`Stamped ${hashedAssets.size} local assets for build ${buildId}.`);
