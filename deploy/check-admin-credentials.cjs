// Prints paths and rule names only. Never print matching credentials.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const files = [...new Set(execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean))];
const failures = [];
const rules = [
  ['literal administrator email', /\badmin[\w.+-]*@[\w.-]+\.[a-z]{2,}/i],
  ['literal administrator constant', /\bADMIN_(?:EMAIL|PASSWORD)\s*=\s*['"][^'"\r\n]+['"]/],
  ['administrator credential fallback', /SEED_ADMIN_(?:EMAIL|PASSWORD)\s*(?:\|\||\?\?)\s*['"][^'"\r\n]+['"]/],
];
for (const file of files) {
  const absolute = path.join(root, file);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) continue;
  const basename = path.basename(file);
  if (basename === '.env' || basename === 'cloudflare.env' || /\.(sqlite3?|db|dump|bundle)$/.test(basename)) {
    failures.push(`${file}: private configuration/database is tracked by Git`);
    continue;
  }
  if (fs.statSync(absolute).size > 2_000_000) continue;
  const source = fs.readFileSync(absolute, 'utf8');
  for (const [name, pattern] of rules) if (pattern.test(source)) failures.push(`${file}: ${name}`);
  const assignments = source.matchAll(/^SEED_ADMIN_(?:EMAIL|PASSWORD)[ \t]*=[ \t]*(\S.*)$/gm);
  for (const match of assignments) {
    if (match[1].trim() !== 'GENERATE_ME') failures.push(`${file}: configured administrator credential in a shared file`);
  }
  if (/(?:^|\/)create-admin\.[cm]?ts$/.test(file) &&
      (/\b(?:email|password|plainPassword)\s*=\s*['"][^'"\r\n]+['"]/.test(source) || /\b(?:hash|hashSync)\(\s*['"][^'"\r\n]+['"]/.test(source))) {
    failures.push(`${file}: literal account configuration in administrator creation script`);
  }
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`ADMIN_CREDENTIAL_SOURCE_CHECK_OK: ${files.length} shareable paths checked.`);
}
