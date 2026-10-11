import test from 'node:test';
import assert from 'node:assert/strict';
import { languages, packs, translator } from './i18n.js';
import { commands, createHandler } from './app.js';
import { errorMessage, checkTarget } from './save.js';

test('language packs have matching keys and placeholders; unsupported locales fall back to English', () => {
  for (const language of languages) {
    assert.deepEqual(Object.keys(packs[language]).sort(), Object.keys(packs.en).sort());
    for (const [key, value] of Object.entries(packs.en)) {
      assert.ok(packs[language][key].trim());
      assert.deepEqual((packs[language][key].match(/\{\w+\}/g) ?? []).sort(), (value.match(/\{\w+\}/g) ?? []).sort());
    }
  }
  assert.equal(translator('fr')('ready'), packs.en.ready);
  assert.match(translator('en')('bound', {guild:'Test',id:'123',owner:'456'}), /Test \(123\)/);
  assert.equal(commands[0].toJSON().name_localizations['zh-TW'], '儲存表情');
});

test('interaction locale and permission/API errors use the selected language without mixing concurrent requests', async () => {
  const handle = createHandler({}, {ownerId:'owner'});
  await Promise.all(languages.map(async locale => {
    let reply;
    await handle({ locale, user:{id:'stranger'}, commandName:'setup',
      isChatInputCommand:()=>true,isMessageContextMenuCommand:()=>false,isStringSelectMenu:()=>false,
      reply:async data=>{reply=data;},
    });
    assert.equal(reply.content, packs[locale].private);
    assert.equal(errorMessage({code:30008}, translator(locale)), packs[locale]['30008']);
    await assert.rejects(checkTarget({}, null, 'owner', translator(locale)), error=>error.message === packs[locale].setupFirst);
  }));
});
