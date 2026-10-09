// Configure this checkout to use the repository's version-aware Git hooks.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const hooksPath = path.join(root, 'scripts', 'git-hooks');
const hook = path.join(hooksPath, 'prepare-commit-msg');

if (!fs.existsSync(hook)) {
  console.error(`Git hook is missing: ${hook}`);
  process.exit(1);
}

execFileSync('git', ['config', '--local', 'core.hooksPath', hooksPath.replace(/\\/g, '/')]);
console.log('Git commit hook enabled. New commit subjects will include SITE.version.');
