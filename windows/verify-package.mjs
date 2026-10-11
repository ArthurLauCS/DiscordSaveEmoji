import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseEnv } from 'node:util';

const root = process.argv[2] ?? 'build/app';
const token = existsSync('.env') ? parseEnv(readFileSync('.env', 'utf8')).DISCORD_TOKEN : null;
const binding = existsSync('.dse.json') ? JSON.parse(readFileSync('.dse.json', 'utf8')) : {};
const privateValues = [token, binding.ownerId, binding.guildId].filter(Boolean);
let files = 0;
function check(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) { check(path); continue; }
    const name = relative(root, path);
    assert.ok(!/^\.env$|^\.dse\.json|\.log$|success\.png$|portal-configured\.png$/.test(entry.name), `Private file in package: ${name}`);
    const bytes = readFileSync(path);
    for (const secret of privateValues) assert.ok(!bytes.includes(Buffer.from(secret)), `Private value found in ${name}`);
    files++;
  }
}
check(root);
assert.equal(readFileSync(join(root, '.env.example'), 'utf8').match(/^DISCORD_TOKEN=(.*)$/m)[1], '');
for (const lang of ['zh-CN', 'zh-TW', 'en']) {
  const html = readFileSync(join(root, 'docs', `help-${lang}.html`), 'utf8');
  for (const [, source] of html.matchAll(/<img src="([^"]+)"/g)) assert.ok(existsSync(join(root, 'docs', source)), `Missing help image: ${source}`);
}
for (const path of ['DSE.exe', 'runtime/node.exe', 'runtime/LICENSE.txt', 'assets/icon.ico']) assert.ok(existsSync(join(root, path)), `Missing ${path}`);
console.log(`Package verified: ${files} files; no local credentials or binding identifiers; help images present.`);
