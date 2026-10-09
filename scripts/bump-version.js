// usage: node scripts/bump-version.js patch|minor|major   (npm run release:patch)
// Rewrites SITE.version in js/00-site-config.js and package.json. The footer badge, About page and everything else read from there.
const fs = require('fs'), kind = process.argv[2] || 'patch';
const cfgPath = 'js/00-site-config.js', cfg = fs.readFileSync(cfgPath, 'utf8');
const m = cfg.match(/version:\s*'(\d+)\.(\d+)\.(\d+)'/); if (!m) { console.error('version not found'); process.exit(1); }
let [a, b, c] = [+m[1], +m[2], +m[3]]; if (kind === 'major') { a++; b = 0; c = 0; } else if (kind === 'minor') { b++; c = 0; } else c++;
const v = `${a}.${b}.${c}`; fs.writeFileSync(cfgPath, cfg.replace(m[0], `version: '${v}'`));
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')); pkg.version = v; fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log('Hero is now v' + v);
