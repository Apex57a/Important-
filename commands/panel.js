// KrayStakes Discord Bot - Panel Command
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const logger = require('../utils/logger');
const { checkAdmin } = require('../utils/permissions');
const { createPanelEmbed, createPanelButtons } = require('../modules/adminPanel');
const { safeReply, safeDefer, handleInteractionError } = require('../utils/interactions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Create a temporary admin control panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  async execute(interaction, client) {
    try {
      // Check if user has permission
      if (!checkAdmin(interaction.member)) {
        return safeReply(interaction, {
          content: 'You do not have permission to use this command.'
        }, true);
      }

      logger.info(`${interaction.user.tag} used /panel command`);
      
      // Defer reply
      await safeDefer(interaction, true);
      
      // Create the embed and buttons
      const embed = createPanelEmbed();
      const buttons = createPanelButtons();
      
      // Send an ephemeral panel in the reply
      await interaction.editReply({
        embeds: [embed],
        components: buttons,
        ephemeral: true
      });
      
      // Log successful panel creation
      logger.db.info(`Temporary admin panel created by ${interaction.user.tag}`, {
        userId: interaction.user.id,
        channelId: interaction.channelId,
        type: 'adminPanel'
      });
      
    } catch (error) {
      await handleInteractionError(error, interaction, 'panel command');
    }
  }
};