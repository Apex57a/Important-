// KrayStakes Discord Bot - Set Panel Command
const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const logger = require('../utils/logger');
const { checkAdmin } = require('../utils/permissions');
const { createPanel } = require('../modules/adminPanel');
const { safeReply, safeDefer, handleInteractionError } = require('../utils/interactions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setpanel')
    .setDescription('Create an admin control panel in a channel')
    .addChannelOption(option => 
      option.setName('channel')
        .setDescription('The channel to create the panel in')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  async execute(interaction, client) {
    try {
      // Check if user has permission
      if (!checkAdmin(interaction.member)) {
        return safeReply(interaction, {
          content: 'You do not have permission to use this command.'
        }, true);
      }

      logger.info(`${interaction.user.tag} used /setpanel command`);
      
      // Defer reply to give us time to process
      await safeDefer(interaction, true);
      
      // Get the channel or use the current channel
      const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
      
      // Create the panel in the specified channel
      await createPanel(interaction, client, targetChannel);
      
      // Log successful panel creation
      logger.db.info(`Admin panel created by ${interaction.user.tag} in ${targetChannel.name}`, {
        userId: interaction.user.id,
        channelId: targetChannel.id,
        type: 'adminPanel'
      });
      
    } catch (error) {
      await handleInteractionError(error, interaction, 'setpanel command');
    }
  }
};