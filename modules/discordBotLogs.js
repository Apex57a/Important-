// KrayStakes Discord Bot - Discord Bot Logs Module
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createSuccessEmbed, createErrorEmbed, createWarningEmbed } = require('../utils/embeds');
const { isAdmin } = require('../utils/permissions');
const { formatDate } = require('../utils/timeUtils');
const fs = require('fs').promises;
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * View logs panel
 * @param {Interaction} interaction - The interaction that triggered this
 * @param {Client} client - The Discord client instance
 */
async function viewLogs(interaction, client) {
  try {
    // Check permissions
    if (!interaction.member || !isAdmin(interaction.member)) {
      await interaction.reply({
        embeds: [createErrorEmbed('Permission Denied', 'You must be an Administrator to view logs.')],
        ephemeral: true
      });
      return;
    }
    
    // Defer reply
    await interaction.deferReply({ ephemeral: true });
    
    // Create embed
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('🔍 Discord Bot Logs')
      .setDescription('Select a log type to view:')
      .addFields(
        { name: 'System Logs', value: 'General bot operation logs', inline: true },
        { name: 'Error Logs', value: 'Error messages and stack traces', inline: true },
        { name: 'Database Logs', value: 'Database operations and queries', inline: true }
      )
      .setTimestamp()
      .setFooter({ text: 'KrayStakes Bot Logs' });
    
    // Create buttons
    const row1 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('discordBotLogs:viewSystemLogs')
          .setLabel('📋 System Logs')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('discordBotLogs:viewErrorLogs')
          .setLabel('❌ Error Logs')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('discordBotLogs:viewDatabaseLogs')
          .setLabel('🗄️ Database Logs')
          .setStyle(ButtonStyle.Secondary)
      );
    
    const row2 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('discordBotLogs:downloadLogs')
          .setLabel('📥 Download Logs')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('discordBotLogs:cleanupLogs')
          .setLabel('🧹 Cleanup Old Logs')
          .setStyle(ButtonStyle.Danger)
      );
    
    // Send response
    await interaction.editReply({
      embeds: [embed],
      components: [row1, row2]
    });
  } catch (error) {
    logger.error('Error viewing logs panel:', error);
    
    if (interaction.deferred) {
      await interaction.editReply({ 
        embeds: [createErrorEmbed('Error', 'An error occurred while accessing logs.')]
      });
    } else {
      await interaction.reply({
        embeds: [createErrorEmbed('Error', 'An error occurred while accessing logs.')],
        ephemeral: true
      });
    }
  }
}

/**
 * View system logs
 * @param {Interaction} interaction - The interaction that triggered this
 * @param {Client} client - The Discord client instance
 */
async function viewSystemLogs(interaction, client) {
  try {
    // Check permissions
    if (!interaction.member || !isAdmin(interaction.member)) {
      await interaction.reply({
        embeds: [createErrorEmbed('Permission Denied', 'You must be an Administrator to view system logs.')],
        ephemeral: true
      });
      return;
    }
    
    // Defer reply
    await interaction.deferReply({ ephemeral: true });
    
    // Read the last 20 lines from the system log file
    const logsDir = path.join(process.cwd(), 'logs');
    const logContent = await readLastLinesFromFile(path.join(logsDir, 'system.log'), 20);
    
    // Create embed
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('📋 System Logs')
      .setDescription('```' + logContent + '```')
      .setTimestamp()
      .setFooter({ text: 'KrayStakes Bot Logs' });
    
    // Create buttons
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('discordBotLogs:viewLogs')
          .setLabel('🔙 Back to Logs Menu')
          .setStyle(ButtonStyle.Secondary)
      );
    
    // Send response
    await interaction.editReply({
      embeds: [embed],
      components: [row]
    });
  } catch (error) {
    logger.error('Error viewing system logs:', error);
    
    if (interaction.deferred) {
      await interaction.editReply({ 
        embeds: [createErrorEmbed('Error', 'An error occurred while accessing system logs.')]
      });
    } else {
      await interaction.reply({
        embeds: [createErrorEmbed('Error', 'An error occurred while accessing system logs.')],
        ephemeral: true
      });
    }
  }
}

/**
 * View error logs
 * @param {Interaction} interaction - The interaction that triggered this
 * @param {Client} client - The Discord client instance
 */
async function viewErrorLogs(interaction, client) {
  try {
    // Check permissions
    if (!interaction.member || !isAdmin(interaction.member)) {
      await interaction.reply({
        embeds: [createErrorEmbed('Permission Denied', 'You must be an Administrator to view error logs.')],
        ephemeral: true
      });
      return;
    }
    
    // Defer reply
    await interaction.deferReply({ ephemeral: true });
    
    // Read the last 20 lines from the error log file
    const logsDir = path.join(process.cwd(), 'logs');
    const logContent = await readLastLinesFromFile(path.join(logsDir, 'error.log'), 20);
    
    // Create embed
    const embed = new EmbedBuilder()
      .setColor('#e74c3c')
      .setTitle('❌ Error Logs')
      .setDescription('```' + logContent + '```')
      .setTimestamp()
      .setFooter({ text: 'KrayStakes Bot Logs' });
    
    // Create buttons
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('discordBotLogs:viewLogs')
          .setLabel('🔙 Back to Logs Menu')
          .setStyle(ButtonStyle.Secondary)
      );
    
    // Send response
    await interaction.editReply({
      embeds: [embed],
      components: [row]
    });
  } catch (error) {
    logger.error('Error viewing error logs:', error);
    
    if (interaction.deferred) {
      await interaction.editReply({ 
        embeds: [createErrorEmbed('Error', 'An error occurred while accessing error logs.')]
      });
    } else {
      await interaction.reply({
        embeds: [createErrorEmbed('Error', 'An error occurred while accessing error logs.')],
        ephemeral: true
      });
    }
  }
}

/**
 * View database logs
 * @param {Interaction} interaction - The interaction that triggered this
 * @param {Client} client - The Discord client instance
 */
async function viewDatabaseLogs(interaction, client) {
  try {
    // Check permissions
    if (!interaction.member || !isAdmin(interaction.member)) {
      await interaction.reply({
        embeds: [createErrorEmbed('Permission Denied', 'You must be an Administrator to view database logs.')],
        ephemeral: true
      });
      return;
    }
    
    // Defer reply
    await interaction.deferReply({ ephemeral: true });
    
    // Read the last 20 lines from the database log file
    const logsDir = path.join(process.cwd(), 'logs');
    const logContent = await readLastLinesFromFile(path.join(logsDir, 'database.log'), 20);
    
    // Create embed
    const embed = new EmbedBuilder()
      .setColor('#3498db')
      .setTitle('🗄️ Database Logs')
      .setDescription('```' + logContent + '```')
      .setTimestamp()
      .setFooter({ text: 'KrayStakes Bot Logs' });
    
    // Create buttons
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('discordBotLogs:viewLogs')
          .setLabel('🔙 Back to Logs Menu')
          .setStyle(ButtonStyle.Secondary)
      );
    
    // Send response
    await interaction.editReply({
      embeds: [embed],
      components: [row]
    });
  } catch (error) {
    logger.error('Error viewing database logs:', error);
    
    if (interaction.deferred) {
      await interaction.editReply({ 
        embeds: [createErrorEmbed('Error', 'An error occurred while accessing database logs.')]
      });
    } else {
      await interaction.reply({
        embeds: [createErrorEmbed('Error', 'An error occurred while accessing database logs.')],
        ephemeral: true
      });
    }
  }
}

/**
 * Download logs
 * @param {Interaction} interaction - The interaction that triggered this
 * @param {Client} client - The Discord client instance
 */
async function downloadLogs(interaction, client) {
  try {
    // Check permissions
    if (!interaction.member || !isAdmin(interaction.member)) {
      await interaction.reply({
        embeds: [createErrorEmbed('Permission Denied', 'You must be an Administrator to download logs.')],
        ephemeral: true
      });
      return;
    }
    
    // Defer reply
    await interaction.deferReply({ ephemeral: true });
    
    // Read log files
    const logsDir = path.join(process.cwd(), 'logs');
    const systemLog = await fs.readFile(path.join(logsDir, 'system.log'), 'utf8').catch(() => 'No system logs found.');
    const errorLog = await fs.readFile(path.join(logsDir, 'error.log'), 'utf8').catch(() => 'No error logs found.');
    const databaseLog = await fs.readFile(path.join(logsDir, 'database.log'), 'utf8').catch(() => 'No database logs found.');
    
    // Create embed
    const embed = new EmbedBuilder()
      .setColor('#2ecc71')
      .setTitle('📥 Download Logs')
      .setDescription('Here are the current log files:')
      .setTimestamp()
      .setFooter({ text: 'KrayStakes Bot Logs' });
    
    // Create buttons
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('discordBotLogs:viewLogs')
          .setLabel('🔙 Back to Logs Menu')
          .setStyle(ButtonStyle.Secondary)
      );
    
    // Send response with log files
    await interaction.editReply({
      embeds: [embed],
      components: [row],
      files: [
        { attachment: Buffer.from(systemLog), name: 'system.log' },
        { attachment: Buffer.from(errorLog), name: 'error.log' },
        { attachment: Buffer.from(databaseLog), name: 'database.log' }
      ]
    });
  } catch (error) {
    logger.error('Error downloading logs:', error);
    
    if (interaction.deferred) {
      await interaction.editReply({ 
        embeds: [createErrorEmbed('Error', 'An error occurred while downloading logs.')]
      });
    } else {
      await interaction.reply({
        embeds: [createErrorEmbed('Error', 'An error occurred while downloading logs.')],
        ephemeral: true
      });
    }
  }
}

/**
 * Clean up logs
 * @param {Interaction} interaction - The interaction that triggered this
 * @param {Client} client - The Discord client instance
 */
async function cleanupLogs(interaction, client) {
  try {
    // Check permissions
    if (!interaction.member || !isAdmin(interaction.member)) {
      await interaction.reply({
        embeds: [createErrorEmbed('Permission Denied', 'You must be an Administrator to clean up logs.')],
        ephemeral: true
      });
      return;
    }
    
    // Defer reply
    await interaction.deferReply({ ephemeral: true });
    
    // Create confirmation embed
    const embed = new EmbedBuilder()
      .setColor('#e74c3c')
      .setTitle('🧹 Cleanup Old Logs')
      .setDescription('Are you sure you want to clean up old logs? This will remove logs older than the configured retention period.')
      .setTimestamp()
      .setFooter({ text: 'KrayStakes Bot Logs' });
    
    // Create buttons
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('discordBotLogs:confirmCleanup')
          .setLabel('✅ Confirm Cleanup')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('discordBotLogs:viewLogs')
          .setLabel('❌ Cancel')
          .setStyle(ButtonStyle.Secondary)
      );
    
    // Send response
    await interaction.editReply({
      embeds: [embed],
      components: [row]
    });
  } catch (error) {
    logger.error('Error preparing log cleanup:', error);
    
    if (interaction.deferred) {
      await interaction.editReply({ 
        embeds: [createErrorEmbed('Error', 'An error occurred while preparing log cleanup.')]
      });
    } else {
      await interaction.reply({
        embeds: [createErrorEmbed('Error', 'An error occurred while preparing log cleanup.')],
        ephemeral: true
      });
    }
  }
}

/**
 * Clean up old logs
 * @param {Client} client - The Discord client instance
 */
async function cleanupOldLogs(client) {
  try {
    logger.info('Starting scheduled log cleanup');
    
    // Get retention days from config or use default (30 days)
    const retentionDays = config.logs?.retentionDays || 30;
    
    // If retention is set to 0, logs are kept indefinitely
    if (retentionDays <= 0) {
      logger.info('Log retention is set to indefinite, skipping cleanup');
      return;
    }
    
    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    // Clean up database logs
    const { Log } = require('../database/models');
    const deletedLogs = await Log.destroy({
      where: {
        createdAt: {
          [require('sequelize').Op.lt]: cutoffDate
        }
      }
    });
    
    logger.info(`Cleaned up ${deletedLogs} database logs older than ${retentionDays} days`);
    
    // Notify logs channel if configured
    const logsChannelId = config.channels.logs;
    if (logsChannelId) {
      const logsChannel = await client.channels.fetch(logsChannelId).catch(() => null);
      if (logsChannel) {
        const embed = createSuccessEmbed(
          'Log Cleanup Completed',
          `Removed ${deletedLogs} database logs older than ${retentionDays} days.`
        );
        
        await logsChannel.send({ embeds: [embed] });
      }
    }
  } catch (error) {
    logger.error('Error cleaning up old logs:', error);
  }
}

/**
 * Read last lines from a file
 * @param {string} filePath - Path to the file
 * @param {number} lineCount - Number of lines to read
 * @returns {Promise<string>} - Last lines from the file
 */
async function readLastLinesFromFile(filePath, lineCount) {
  try {
    // Read file
    const data = await fs.readFile(filePath, 'utf8');
    
    // Split into lines
    const lines = data.split('\n');
    
    // Get last lines
    const lastLines = lines.slice(-lineCount);
    
    // Return joined lines
    return lastLines.join('\n');
  } catch (error) {
    logger.error(`Error reading file ${filePath}:`, error);
    return 'Error reading log file.';
  }
}

/**
 * Handle button clicks for this module
 * @param {string} buttonId - The ID of the button that was clicked
 * @param {Interaction} interaction - The interaction that triggered this
 * @param {Client} client - The Discord client instance
 */
function handleButton(buttonId, interaction, client) {
  switch (buttonId) {
    case 'viewLogs':
      return viewLogs(interaction, client);
    case 'viewSystemLogs':
      return viewSystemLogs(interaction, client);
    case 'viewErrorLogs':
      return viewErrorLogs(interaction, client);
    case 'viewDatabaseLogs':
      return viewDatabaseLogs(interaction, client);
    case 'downloadLogs':
      return downloadLogs(interaction, client);
    case 'cleanupLogs':
      return cleanupLogs(interaction, client);
    case 'confirmCleanup':
      return handleConfirmCleanup(interaction, client);
    default:
      interaction.reply({
        embeds: [createErrorEmbed('Unknown Button', `The button "${buttonId}" is not recognized.`)],
        ephemeral: true
      });
  }
}

/**
 * Handle confirmation of log cleanup
 * @param {Interaction} interaction - The interaction that triggered this
 * @param {Client} client - The Discord client instance
 */
async function handleConfirmCleanup(interaction, client) {
  try {
    // Defer update
    await interaction.deferUpdate();
    
    // Get retention days from config or use default (30 days)
    const retentionDays = config.logs?.retentionDays || 30;
    
    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    // Format cutoff date
    const formattedCutoffDate = formatDate(cutoffDate);
    
    // Clean up database logs
    const { Log } = require('../database/models');
    const deletedLogs = await Log.destroy({
      where: {
        createdAt: {
          [require('sequelize').Op.lt]: cutoffDate
        }
      }
    });
    
    // Create success embed
    const embed = createSuccessEmbed(
      'Log Cleanup Completed',
      `Successfully removed ${deletedLogs} database logs older than ${formattedCutoffDate} (${retentionDays} days).`
    );
    
    // Create button to return to logs menu
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('discordBotLogs:viewLogs')
          .setLabel('🔙 Back to Logs Menu')
          .setStyle(ButtonStyle.Secondary)
      );
    
    // Send response
    await interaction.editReply({
      embeds: [embed],
      components: [row]
    });
    
    // Log the action
    logger.info(`Manual cleanup: Removed ${deletedLogs} database logs older than ${retentionDays} days by ${interaction.user.tag}`);
  } catch (error) {
    logger.error('Error confirming log cleanup:', error);
    
    await interaction.editReply({ 
      embeds: [createErrorEmbed('Error', 'An error occurred during log cleanup.')],
      components: []
    });
  }
}

module.exports = {
  viewLogs,
  viewSystemLogs,
  viewErrorLogs,
  viewDatabaseLogs,
  downloadLogs,
  cleanupLogs,
  cleanupOldLogs,
  handleButton
};