import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

test('desktop protocol reports missing credentials as failure and exits without hanging on heartbeat or stdin', async () => {
  const child = spawn(process.execPath, ['bot.js'], {
    env: { ...process.env, DISCORD_TOKEN: '', DSE_DESKTOP: '1' },
    stdio: ['pipe', 'pipe', 'pipe'], timeout: 5000,
  });
  let stdout = '', stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  const [code, signal] = await new Promise((resolve, reject) => {
    child.once('error', reject); child.once('exit', (code, signal) => resolve([code, signal]));
  });
  assert.equal(code, 1);
  assert.equal(signal, null);
  assert.deepEqual(JSON.parse(stdout.trim()), {state:'failed',appId:null});
  assert.match(stderr, /DISCORD_TOKEN/);
});
