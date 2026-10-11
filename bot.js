import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { Client, Events, PermissionFlagsBits } from 'discord.js';
import { commands, createHandler } from './app.js';
import { loadConfig } from './config.js';

const client = new Client({
  intents: [],
  rest: { rejectOnRateLimit: (data) => data.route.includes('/emojis'), retries: 0 },
});
const desktop = process.env.DSE_DESKTOP === '1';
let registered = false;
function report(state) {
  if (desktop) console.log(JSON.stringify({ state, appId: registered ? client.application.id : null }));
}
const heartbeat = desktop ? setInterval(() => report(registered && client.isReady() ? 'ready' : 'reconnecting'), 5000) : null;
async function shutdown() {
  clearInterval(heartbeat);
  await client.destroy();
  process.exit();
}
if (desktop) {
  // Parent stdin closes if the desktop exits or crashes, so no orphan bot remains.
  const input = createInterface({ input: process.stdin });
  input.on('line', (line) => { if (line === 'stop') shutdown(); });
  input.on('close', shutdown);
}

client.once(Events.ClientReady, async () => {
  try {
    await client.application.fetch();
    const config = await loadConfig(client.application, process.env, process.env.DSE_DATA_DIR
      ? resolve(process.env.DSE_DATA_DIR, '.dse.json') : fileURLToPath(new URL('.dse.json', import.meta.url)));
    // 按名称更新本应用的命令，不删除同一应用里的其他命令。
    for (const command of commands) await client.application.commands.create(command);
    const handle = createHandler(client, config);
    client.on(Events.InteractionCreate, (interaction) => {
      handle(interaction).catch((error) => console.error(`交互回复失败：${error.name}（${error.code ?? 'network'}）`));
    });
    registered = true;
    report('ready');
    console.log(`ready: ${client.user.tag}; owner: ${config.ownerId}; target: ${config.guildId || '请执行 /setup'}`);
    console.log(`添加到我的应用：https://discord.com/oauth2/authorize?client_id=${client.application.id}&scope=applications.commands&integration_type=1`);
    console.log(`添加到目标服务器：https://discord.com/oauth2/authorize?client_id=${client.application.id}&scope=bot%20applications.commands&permissions=${PermissionFlagsBits.CreateGuildExpressions}&integration_type=0`);
  } catch (error) {
    report('failed');
    clearInterval(heartbeat);
    console.error(`启动配置失败：${error.code ?? error.name}。检查安装类型、权限以及 .env / .dse.json 配置。`);
    await client.destroy();
    process.exitCode = 1;
    if (desktop) process.exit(1);
  }
});

client.on(Events.Error, (error) => console.error(`Discord 连接错误：${error.code ?? error.name}`));
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, shutdown);
}

if (!process.env.DISCORD_TOKEN?.trim()) {
  report('failed');
  clearInterval(heartbeat);
  console.error('缺少 DISCORD_TOKEN：复制 .env.example 为 .env，再填写 Developer Portal 的 Bot Token。');
  process.exitCode = 1;
  if (desktop) process.exit(1);
} else {
  client.login(process.env.DISCORD_TOKEN).catch((error) => {
    report('failed');
    clearInterval(heartbeat);
    console.error(`Discord 登录失败：${error.code ?? error.name}。请检查 Bot Token 和网络。`);
    client.destroy();
    process.exitCode = 1;
    if (desktop) process.exit(1);
  });
}
