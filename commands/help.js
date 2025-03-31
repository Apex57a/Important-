// KrayStakes Discord Bot - Help Command
const { SlashCommandBuilder } = require('discord.js');
const logger = require('../utils/logger');
const { showHelpMenu } = require('../modules/guideHelp');
const { safeReply, handleInteractionError } = require('../utils/interactions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show help information about the bot'),
  
  async execute(interaction, client) {
    try {
      logger.info(`${interaction.user.tag} used /help command`);
      
      // Respond to help command
      await showHelpMenu(interaction, client);
      
      // Log success
      logger.db.info(`Help command executed successfully by ${interaction.user.tag}`, {
        userId: interaction.user.id,
        type: 'command'
      });
      
    } catch (error) {
      await handleInteractionError(error, interaction, 'help command');
    }
  }
};