import {
  ActionRowBuilder, ApplicationCommandType, ApplicationIntegrationType,
  ContextMenuCommandBuilder, InteractionContextType, MessageFlags,
  SlashCommandBuilder, StringSelectMenuBuilder,
} from 'discord.js';
import { translator, packs } from './i18n.js';
import { parseEmojis } from './emoji.js';
import { checkTarget, errorMessage, saveEmojis, UserError } from './save.js';

export const commands = [
  new ContextMenuCommandBuilder()
    .setName('Save Emoji').setNameLocalizations({ 'zh-CN': packs['zh-CN'].command, 'zh-TW': packs['zh-TW'].command }).setType(ApplicationCommandType.Message)
    .setIntegrationTypes(ApplicationIntegrationType.UserInstall)
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel),
  new SlashCommandBuilder()
    .setName('setup').setDescription(packs.en.setupDescription)
    .setDescriptionLocalizations({ 'zh-CN': packs['zh-CN'].setupDescription, 'zh-TW': packs['zh-TW'].setupDescription })
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild),
];

const SELECT_PREFIX = 'save-emoji-pick:';
const privateReply = { flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } };

export function createHandler(client, config) {
  let busy = false;
  return async (interaction) => {
    const t = translator(interaction.locale ?? process.env.DSE_LANGUAGE ?? 'zh-CN');
    const setup = interaction.isChatInputCommand() && interaction.commandName === 'setup';
    const context = interaction.isMessageContextMenuCommand() && interaction.commandName === 'Save Emoji';
    const select = interaction.isStringSelectMenu() && interaction.customId.startsWith(SELECT_PREFIX);
    if (!setup && !context && !select) return;
    if (interaction.user.id !== config.ownerId) {
      await interaction.reply({ ...privateReply, content: t('private') });
      return;
    }
    if (busy) {
      await interaction.reply({ ...privateReply, content: t('busy') });
      return;
    }
    busy = true;
    try {
      if (setup) {
        await interaction.deferReply(privateReply);
        const guild = await checkTarget(client, interaction.guildId, config.ownerId, t);
        await config.bind(guild.id);
        await interaction.editReply({
          content: t('bound', { guild: guild.name, id: guild.id, owner: config.ownerId }),
          allowedMentions: { parse: [] },
        });
        return;
      }
      let emojis;
      if (context) {
        const msg = interaction.targetMessage;
        const reacted = msg.reactions.cache.filter((r) => r.emoji.id).map((r) => ({
          id: r.emoji.id, name: r.emoji.name, animated: !!r.emoji.animated,
        }));
        emojis = parseEmojis(msg.content, reacted);
        if (!emojis.length) {
          await interaction.reply({ ...privateReply, content: t('empty') });
          return;
        }
        if (!config.guildId) throw new UserError(t('setupFirst'));
        if (emojis.length > 1) {
          // shortcut: Discord 菜单最多 25 项，超出时提示；需要大批量保存时再加分页。
          const options = emojis.slice(0, 25).map((e) => ({
            label: e.name, description: `${t(e.animated ? 'animated' : 'static')} · ${e.id}`,
            value: `${e.animated ? 'a' : ''}:${e.name}:${e.id}`,
          }));
          const menu = new StringSelectMenuBuilder()
            .setCustomId(`${SELECT_PREFIX}${config.guildId}`).setPlaceholder(t('choose'))
            .setMinValues(1).setMaxValues(options.length).addOptions(options);
          await interaction.reply({ ...privateReply,
            content: t('destination', { id: config.guildId, limit: emojis.length > 25 ? t('limit') : '' }),
            components: [new ActionRowBuilder().addComponents(menu)],
          });
          return;
        }
        await interaction.deferReply(privateReply);
      } else {
        if (interaction.customId !== `${SELECT_PREFIX}${config.guildId}`) throw new UserError(t('stale'));
        if (!interaction.values.length || interaction.values.length > 25 ||
          !interaction.values.every((v) => /^(a?):\w{2,32}:\d{17,20}$/.test(v))) {
          throw new UserError(t('invalid'));
        }
        await interaction.deferUpdate();
        await interaction.editReply({ content: t('saving'), components: [] });
        emojis = parseEmojis(interaction.values.map((v) => `<${v}>`).join(''));
      }
      const guild = await checkTarget(client, config.guildId, config.ownerId, t);
      const result = await saveEmojis(guild, emojis, fetch, t);
      const content = t('result', { guild: guild.name, result, nitro: t('nitro') });
      await interaction.editReply({
        content: content.length <= 2000 ? content : `${t('attachment')} ${t('nitro')}`,
        files: content.length <= 2000 ? [] : [{ attachment: Buffer.from(content), name: 'save-results.txt' }],
        components: [], allowedMentions: { parse: [] },
      });
    } catch (error) {
      const reply = { content: errorMessage(error, t), components: [], allowedMentions: { parse: [] } };
      if (interaction.deferred || interaction.replied) await interaction.editReply(reply);
      else await interaction.reply({ ...reply, flags: MessageFlags.Ephemeral });
    } finally {
      busy = false;
    }
  };
}
