import { translator } from './i18n.js';
import { PermissionFlagsBits } from 'discord.js';

export class UserError extends Error {}

export function errorMessage(error, t = translator()) {
  if (error instanceof UserError) return error.message;
  if (error.name === 'RateLimitError' || error.status === 429) return t('rateLimit');
  return t([10004, 10007, 30008, 50001, 50013, 50035].includes(error.code) ? String(error.code) : 'failure');
}

export async function checkTarget(client, guildId, ownerId, t = translator()) {
  if (!guildId) throw new UserError(t('setupFirst'));
  const guild = await client.guilds.fetch({ guild: guildId, force: true });
  const [owner, bot] = await Promise.all([
    guild.members.fetch({ user: ownerId, force: true }),
    guild.members.fetchMe({ force: true }),
  ]);
  if (guild.ownerId !== ownerId && !owner.permissions.any([
    PermissionFlagsBits.CreateGuildExpressions, PermissionFlagsBits.ManageGuildExpressions,
  ])) throw new UserError(t('ownerPermission'));
  if (!bot.permissions.has(PermissionFlagsBits.CreateGuildExpressions)) {
    throw new UserError(t('botPermission'));
  }
  return guild;
}

export async function downloadEmoji(emoji, fetchImage = fetch, t = translator()) {
  const response = await fetchImage(`https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? 'gif' : 'png'}?size=128`, {
    signal: AbortSignal.timeout(15_000), redirect: 'error',
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new UserError(t('downloadError', { status: response.status }));
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > 256 * 1024) throw new UserError(t('tooLarge'));
    chunks.push(chunk);
  }
  if (!size) throw new UserError(t('emptyDownload'));
  return Buffer.concat(chunks);
}

export async function saveEmojis(guild, emojis, fetchImage = fetch, t = translator()) {
  const lines = [];
  for (const emoji of emojis) {
    try {
      const attachment = await downloadEmoji(emoji, fetchImage, t);
      const created = await guild.emojis.create({
        attachment: `data:image/${emoji.animated ? 'gif' : 'png'};base64,${attachment.toString('base64')}`,
        name: emoji.name, reason: 'DSE: 用户主动保存表情',
      });
      lines.push(`✅ ${created} \`:${created.name}:\``);
    } catch (error) {
      lines.push(`❌ \`:${emoji.name}:\` ${errorMessage(error, t)}`);
      if (error.name === 'RateLimitError' || error.status === 429) {
        lines.push(t('remaining'));
        break;
      }
    }
  }
  return lines.join('\n');
}
