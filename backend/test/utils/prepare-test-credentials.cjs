// Called only by disposable E2E container startup scripts. Values are generated
// at runtime and written privately so env-cmd can load them in Docker exec too.
const fs = require('node:fs');
const { randomBytes, randomUUID } = require('node:crypto');

if (process.env.NODE_ENV === 'production') {
  throw new Error('E2E credential generation is not allowed in production.');
}
const path = '.env';
let content = fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
const values = {};
for (const kind of ['ADMIN', 'USER']) {
  for (const field of ['EMAIL', 'PASSWORD']) {
    const name = `SEED_${kind}_${field}`;
    const existing = content.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1]?.trim();
    values[name] = process.env[name] || existing ||
      (field === 'EMAIL' ? `${randomUUID()}@test.invalid` : randomBytes(24).toString('base64url'));
    content = content.replace(new RegExp(`^${name}=.*(?:\\r?\\n|$)`, 'gm'), '');
  }
}
content = `${content.trimEnd()}\n${Object.entries(values).map(([name, value]) => `${name}=${value}`).join('\n')}\n`;
fs.writeFileSync(path, content, { mode: 0o600 });
fs.chmodSync(path, 0o600);
console.log('E2E credentials configured privately for this disposable environment.');
