import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Collection, PermissionFlagsBits, PermissionsBitField } from 'discord.js';
import { commands, createHandler } from './app.js';
import { loadConfig } from './config.js';
import { checkTarget, downloadEmoji, saveEmojis, errorMessage } from './save.js';

const ownerId = '123456789012345678';
const guildId = '223456789012345678';
const emoji = { id: '323456789012345678', name: 'smile', animated: false };

function fixture() {
  const guild = {
    id: guildId, name: 'My emoji server', ownerId,
    members: {
      fetch: async () => ({ permissions: new PermissionsBitField() }),
      fetchMe: async () => ({ permissions: new PermissionsBitField(PermissionFlagsBits.CreateGuildExpressions) }),
    },
    emojis: { create: async ({ name }) => ({ name, toString: () => `<:${name}:423456789012345678>` }) },
  };
  const client = { guilds: { fetch: async (options) => { assert.equal(options.force, true); return guild; } } };
  const config = { ownerId, guildId, async bind(id) { this.guildId = id; } };
  return { client, guild, config };
}

function interaction(kind, overrides = {}) {
  const calls = [];
  return {
    calls, user: { id: ownerId }, guildId,
    commandName: kind === 'setup' ? 'setup' : 'Save Emoji',
    customId: `save-emoji-pick:${guildId}`, values: [`:${emoji.name}:${emoji.id}`],
    targetMessage: { content: '', reactions: { cache: new Collection() } },
    isChatInputCommand: () => kind === 'setup',
    isMessageContextMenuCommand: () => kind === 'context',
    isStringSelectMenu: () => kind === 'select',
    async reply(body) { this.replied = true; calls.push(['reply', body]); },
    async deferReply(body) { this.deferred = true; calls.push(['deferReply', body]); },
    async deferUpdate() { this.deferred = true; calls.push(['deferUpdate']); },
    async editReply(body) { calls.push(['editReply', body]); },
    ...overrides,
  };
}

test('commands: user-installed message command works in guilds and DMs; setup stays in guilds', () => {
  const [save, setup] = commands.map((c) => c.toJSON());
  assert.deepEqual(save.integration_types, [1]);
  assert.deepEqual(save.contexts, [0, 1, 2]);
  assert.equal(save.type, 3);
  assert.deepEqual(setup.integration_types, [0]);
  assert.deepEqual(setup.contexts, [0]);
});

test('config: auto owner/team owner, durable setup, separate owner, corrupted file fails closed', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'dse-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, '.dse.json');
  const app = { owner: { id: ownerId } };
  const config = await loadConfig(app, {}, path);
  assert.equal(config.ownerId, ownerId);
  assert.equal(config.guildId, null);
  await config.bind(guildId);
  assert.equal(JSON.parse(await readFile(path, 'utf8')).guildId, guildId);
  assert.equal((await loadConfig(app, {}, path)).guildId, guildId);
  assert.equal((await loadConfig({ owner: { id: guildId, ownerId } }, {}, path)).ownerId, ownerId);
  assert.equal((await loadConfig(app, { OWNER_ID: emoji.id }, path)).guildId, null);
  await writeFile(path, 'broken');
  await assert.rejects(loadConfig(app, {}, path), /无法读取/);
});

test('permissions: owner allowed, other member needs expressions permission, bot must have create', async () => {
  const { client, guild } = fixture();
  assert.equal(await checkTarget(client, guildId, ownerId), guild);
  guild.ownerId = 'another-owner';
  await assert.rejects(checkTarget(client, guildId, ownerId), /你在目标服务器没有/);
  guild.members.fetch = async () => ({ permissions: new PermissionsBitField(PermissionFlagsBits.ManageGuildExpressions) });
  assert.equal(await checkTarget(client, guildId, ownerId), guild);
  guild.members.fetchMe = async () => ({ permissions: new PermissionsBitField() });
  await assert.rejects(checkTarget(client, guildId, ownerId), /机器人缺少/);
  await assert.rejects(checkTarget(client, null, ownerId), /setup/);
});

test('download: fixed Discord CDN, animated format, timeout, 256 KiB limit and HTTP errors', async () => {
  const image = await downloadEmoji({ ...emoji, animated: true }, async (url, options) => {
    assert.equal(url, `https://cdn.discordapp.com/emojis/${emoji.id}.gif?size=128`);
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    return new Response(Buffer.from('GIF89a'));
  });
  assert.equal(image.toString(), 'GIF89a');
  await assert.rejects(downloadEmoji(emoji, async () => new Response(Buffer.alloc(256 * 1024 + 1))), /256 KiB/);
  await assert.rejects(downloadEmoji(emoji, async () => new Response(null, { status: 404 })), /404/);
  await assert.rejects(downloadEmoji(emoji, async () => new Response('')), /为空/);
});

test('save: reports partial failure, preserves GIF bytes, stops on rate limit without leaking API details', async () => {
  const { guild } = fixture();
  let count = 0;
  guild.emojis.create = async ({ attachment, name }) => {
    assert.equal(attachment, 'data:image/gif;base64,R0lGODlh');
    if (++count === 2) throw Object.assign(new Error('secret request body'), { code: 30008 });
    return { name, toString: () => `<:${name}:423456789012345678>` };
  };
  const result = await saveEmojis(guild, [{ ...emoji, animated: true }, { ...emoji, animated: true }], async () => new Response('GIF89a'));
  assert.match(result, /✅/);
  assert.match(result, /槽位已满/);
  assert.doesNotMatch(result, /secret/);
  count = 0;
  guild.emojis.create = async () => { count++; throw Object.assign(new Error(), { name: 'RateLimitError' }); };
  assert.match(await saveEmojis(guild, [emoji, emoji], async () => new Response('GIF89a')), /剩余表情未处理/);
  assert.equal(count, 1);
  assert.doesNotMatch(errorMessage(new Error('token secret')), /secret/);
});

test('interactions: unauthorized commands do not fetch guild or change settings', async () => {
  const { config } = fixture();
  const handle = createHandler({}, config);
  for (const kind of ['setup', 'context', 'select']) {
    const i = interaction(kind, { user: { id: 'someone-else' } });
    await handle(i);
    assert.match(i.calls[0][1].content, /无权/);
    assert.equal(i.calls[0][1].flags, 64);
  }
});

test('setup: automatically binds the invocation guild after permission check', async () => {
  const { client, config } = fixture();
  config.guildId = null;
  const i = interaction('setup');
  await createHandler(client, config)(i);
  assert.equal(config.guildId, guildId);
  assert.match(i.calls.at(-1)[1].content, /已绑定/);
  assert.equal(i.calls[0][1].flags, 64);
});

test('menu: reports 25-item limit and pins destination; rejects stale or invalid selections', async () => {
  const { client, config } = fixture();
  const handle = createHandler(client, config);
  const i = interaction('context');
  i.targetMessage.content = Array.from({ length: 26 }, (_, n) => `<:emoji_${n}:${323456789012345678n + BigInt(n)}>`).join(' ');
  await handle(i);
  const reply = i.calls[0][1];
  assert.match(reply.content, /前 25/);
  assert.equal(reply.components[0].toJSON().components[0].options.length, 25);
  for (const overrides of [{ customId: 'save-emoji-pick:old' }, { values: ['../../bad'] }]) {
    const pick = interaction('select', overrides);
    await handle(pick);
    assert.match(pick.calls[0][1].content, /重新右键/);
  }
});

test('interaction failures are reported privately and busy state recovers', async () => {
  const { client, config } = fixture();
  config.bind = async () => { throw new Error('disk full'); };
  const handle = createHandler(client, config);
  const failed = interaction('setup');
  await handle(failed);
  assert.match(failed.calls.at(-1)[1].content, /操作失败/);
  const empty = interaction('context');
  await handle(empty);
  assert.match(empty.calls[0][1].content, /没有可保存/);
});

test('single save and multi-select upload to the bound target, defer first and clear controls', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('PNG'));
  const { client, guild, config } = fixture();
  let uploads = 0;
  guild.emojis.create = async ({ attachment, name }) => {
    uploads++;
    assert.equal(attachment, 'data:image/png;base64,UE5H');
    return { name, toString: () => `<:${name}:423456789012345678>` };
  };
  const handle = createHandler(client, config);
  const single = interaction('context');
  single.targetMessage.content = `<:${emoji.name}:${emoji.id}>`;
  await handle(single);
  assert.equal(single.calls[0][0], 'deferReply');
  assert.match(single.calls.at(-1)[1].content, /✅.*smile/);
  const multi = interaction('select');
  await handle(multi);
  assert.equal(multi.calls[0][0], 'deferUpdate');
  assert.deepEqual(multi.calls.at(-1)[1].components, []);
  assert.equal(uploads, 2);
});

test('concurrent actions cannot change target while an upload/setup is running', async () => {
  const { client, config } = fixture();
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const setup = interaction('setup', { async deferReply() { this.deferred = true; await gate; } });
  const handle = createHandler(client, config);
  const pending = handle(setup);
  const second = interaction('setup');
  await handle(second);
  assert.match(second.calls[0][1].content, /还在处理中/);
  release();
  await pending;
  assert.match(setup.calls.at(-1)[1].content, /已绑定/);
});

test('25 long success results become an attachment within Discord message limits', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('PNG'));
  const { client, config } = fixture();
  const pick = interaction('select', {
    values: Array.from({ length: 25 }, (_, n) => `:${'e'.repeat(30)}${String(n).padStart(2, '0')}:${323456789012345678n + BigInt(n)}`),
  });
  await createHandler(client, config)(pick);
  const reply = pick.calls.at(-1)[1];
  assert.ok(reply.content.length <= 2000);
  assert.equal(reply.files[0].name, 'save-results.txt');
  assert.equal(reply.files[0].attachment.toString().match(/✅/g).length, 25);
});
