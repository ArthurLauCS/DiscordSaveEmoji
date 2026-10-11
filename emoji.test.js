import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEmojis } from './emoji.js';

test('parseEmojis', () => {
  const a = { id: '123456789012345678', name: 'pepe', animated: false };
  const b = { id: '223456789012345678', name: 'dance_2', animated: true };
  const c = { id: '323456789012345678', name: 'react', animated: false };

  assert.deepEqual(parseEmojis('hi <:pepe:123456789012345678> <a:dance_2:223456789012345678> <:pepe:123456789012345678>'), [a, b]);
  assert.deepEqual(parseEmojis('<:pepe:123456789012345678>', [c, a]), [a, c]);
  assert.deepEqual(parseEmojis('plain :smile: <@123456789012345678> <#123456789012345678> 😀'), []);
});

test('skip deleted / malformed reactions without hiding valid text emojis', () => {
  assert.deepEqual(parseEmojis('<a:dance:123456789012345678>', [
    { id: '123456789012345678', name: null, animated: false },
    { id: 'not-an-id', name: 'broken', animated: false },
  ]), [{ id: '123456789012345678', name: 'dance', animated: true }]);
});
