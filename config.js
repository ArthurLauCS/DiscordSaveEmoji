import { readFile, writeFile, rename } from 'node:fs/promises';

const snowflake = /^\d{17,20}$/;

export async function loadConfig(application, env, path) {
  const ownerId = env.OWNER_ID || application.owner?.ownerId || application.owner?.id;
  if (!snowflake.test(ownerId ?? '')) throw new Error('无法识别应用所有者，请设置 OWNER_ID。');
  let guildId = env.TARGET_GUILD_ID || null;
  try {
    const saved = JSON.parse(await readFile(path, 'utf8'));
    if (!snowflake.test(saved.ownerId) || !snowflake.test(saved.guildId)) throw new Error('绑定文件格式无效。');
    if (saved.ownerId === ownerId) guildId = saved.guildId;
  } catch (error) {
    if (error.code !== 'ENOENT') throw new Error('无法读取 .dse.json，请检查文件内容及权限。');
  }
  if (guildId && !snowflake.test(guildId)) throw new Error('TARGET_GUILD_ID 必须是服务器 ID。');
  return {
    ownerId,
    guildId,
    async bind(nextGuildId) {
      const temp = `${path}.tmp`;
      await writeFile(temp, JSON.stringify({ ownerId, guildId: nextGuildId }, null, 2) + '\n', { mode: 0o600 });
      await rename(temp, path);
      this.guildId = nextGuildId;
    },
  };
}
