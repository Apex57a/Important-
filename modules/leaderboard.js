// KrayStakes Discord Bot - Persistent Leaderboard & Data Channel Module
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Models } = require('../database/models');
const logger = require('../utils/logger');
const config = require('../config');
const { checkPermission } = require('../utils/permissions');
const { createSuccessEmbed, createErrorEmbed } = require('../utils/embeds');
const { formatDate } = require('../utils/timeUtils');

/**
 * Generate and display leaderboard
 * @param {Interaction} interaction - The interaction that triggered this
 * @param {Client} client - The Discord client instance
 */
async function generateLeaderboard(interaction, client) {
  try {
    // Check permissions
    if (!checkPermission(interaction, 'ADMIN')) {
      await interaction.reply({
        embeds: [createErrorEmbed('Permission Denied', 'You do not have permission to generate a leaderboard.')],
        ephemeral: true
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    // Create leaderboard embed
    const embed = await createLeaderboardEmbed();

    // Create buttons
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('leaderboard:updateLeaderboard')
          .setLabel('Update Leaderboard')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🔄'),
        new ButtonBuilder()
          .setCustomId('leaderboard:postToChannel')
          .setLabel('Post to Channel')
          .setStyle(ButtonStyle.Success)
          .setEmoji('📢'),
        new ButtonBuilder()
          .setCustomId('adminPanel:back')
          .setLabel('Back to Admin Panel')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('⬅️')
      );

    await interaction.editReply({
      embeds: [embed],
      components: [row]
    });

    logger.info(`User ${interaction.user.tag} generated a leaderboard`);
  } catch (error) {
    logger.error('Error generating leaderboard:', error);
    await interaction.editReply({
      embeds: [createErrorEmbed('Error', 'An error occurred while generating the leaderboard.')]
    });
  }
}

/**
 * Create the leaderboard embed
 * @returns {Promise<EmbedBuilder>} The leaderboard embed
 */
async function createLeaderboardEmbed() {
  try {
    // Get top betters (users with most bets)
    const topBetters = await getTopBetters();
    
    // Get top winners (users with most winnings)
    const topWinners = await getTopWinners();
    
    // Get recent events
    const recentEvents = await getRecentEvents();

    // Create the embed
    const embed = new EmbedBuilder()
      .setTitle('🏆 KrayStakes Betting Leaderboard')
      .setColor('#FFD700')
      .setDescription('Top players and recent events statistics')
      .addFields(
        { name: '🔥 Top Betters (Most Active)', value: formatTopBetters(topBetters) || 'No bets placed yet', inline: false },
        { name: '💰 Top Winners (Most Winnings)', value: formatTopWinners(topWinners) || 'No winners yet', inline: false },
        { name: '📊 Recent Events', value: formatRecentEvents(recentEvents) || 'No recent events', inline: false }
      )
      .setFooter({ text: `KrayStakes Ltd. • Last Updated: ${new Date().toLocaleString()}` })
      .setTimestamp();

    return embed;
  } catch (error) {
    logger.error('Error creating leaderboard embed:', error);
    throw error;
  }
}

/**
 * Get top betters (users with most bets)
 * @param {number} limit - Maximum number of users to return
 * @returns {Promise<Array>} Top betters
 */
async function getTopBetters(limit = 5) {
  try {
    // Using Sequelize to get users with most bets
    const topBetters = await Models.Bet.findAll({
      attributes: [
        'userId',
        'userName',
        [Models.sequelize.fn('COUNT', Models.sequelize.col('id')), 'betCount'],
        [Models.sequelize.fn('SUM', Models.sequelize.col('amount')), 'totalAmount']
      ],
      group: ['userId', 'userName'],
      order: [
        [Models.sequelize.literal('betCount'), 'DESC']
      ],
      limit: limit
    });

    return topBetters.map(better => ({
      userId: better.userId,
      userName: better.userName,
      betCount: better.getDataValue('betCount'),
      totalAmount: better.getDataValue('totalAmount') || 0
    }));
  } catch (error) {
    logger.error('Error getting top betters:', error);
    return [];
  }
}

/**
 * Get top winners (users with most winnings)
 * @param {number} limit - Maximum number of users to return
 * @returns {Promise<Array>} Top winners
 */
async function getTopWinners(limit = 5) {
  try {
    // Using Sequelize to get users with most winnings
    const topWinners = await Models.Payout.findAll({
      attributes: [
        'userId',
        'userName',
        [Models.sequelize.fn('COUNT', Models.sequelize.col('id')), 'winCount'],
        [Models.sequelize.fn('SUM', Models.sequelize.col('amount')), 'totalWinnings']
      ],
      group: ['userId', 'userName'],
      order: [
        [Models.sequelize.literal('totalWinnings'), 'DESC']
      ],
      limit: limit
    });

    return topWinners.map(winner => ({
      userId: winner.userId,
      userName: winner.userName,
      winCount: winner.getDataValue('winCount'),
      totalWinnings: winner.getDataValue('totalWinnings') || 0
    }));
  } catch (error) {
    logger.error('Error getting top winners:', error);
    return [];
  }
}

/**
 * Get recent events
 * @param {number} limit - Maximum number of events to return
 * @returns {Promise<Array>} Recent events
 */
async function getRecentEvents(limit = 5) {
  try {
    // Using Sequelize to get recent events with winner information
    const recentEvents = await Models.Event.findAll({
      attributes: ['id', 'name', 'eventType', 'status', 'eventTime'],
      where: {
        status: 'COMPLETED'
      },
      order: [
        ['eventTime', 'DESC']
      ],
      limit: limit,
      include: [
        {
          model: Models.Bet,
          attributes: ['id'],
          required: false
        }
      ]
    });

    return await Promise.all(recentEvents.map(async event => {
      // Count the total bet amount for this event
      const totalBetAmount = await Models.Bet.sum('amount', {
        where: { eventId: event.id }
      }) || 0;

      // Count the number of bets for this event
      const betCount = await Models.Bet.count({
        where: { eventId: event.id }
      });

      return {
        id: event.id,
        name: event.name,
        eventType: event.eventType,
        eventTime: event.eventTime,
        betCount: betCount,
        totalBetAmount: totalBetAmount
      };
    }));
  } catch (error) {
    logger.error('Error getting recent events:', error);
    return [];
  }
}

/**
 * Format top betters for display
 * @param {Array} topBetters - Array of top betters
 * @returns {string} Formatted text
 */
function formatTopBetters(topBetters) {
  if (!topBetters || topBetters.length === 0) {
    return 'No bets placed yet';
  }

  return topBetters.map((better, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
    return `${medal} **${better.userName}** - ${better.betCount} bets (${better.totalAmount} coins)`;
  }).join('\n');
}

/**
 * Format top winners for display
 * @param {Array} topWinners - Array of top winners
 * @returns {string} Formatted text
 */
function formatTopWinners(topWinners) {
  if (!topWinners || topWinners.length === 0) {
    return 'No winners yet';
  }

  return topWinners.map((winner, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
    return `${medal} **${winner.userName}** - ${winner.totalWinnings} coins (${winner.winCount} wins)`;
  }).join('\n');
}

/**
 * Format recent events for display
 * @param {Array} recentEvents - Array of recent events
 * @returns {string} Formatted text
 */
function formatRecentEvents(recentEvents) {
  if (!recentEvents || recentEvents.length === 0) {
    return 'No recent events';
  }

  return recentEvents.map(event => {
    const formattedDate = formatDate(event.eventTime, config.timezone);
    return `🗓️ **${event.name}** (${event.eventType}) - ${event.betCount} bets totaling ${event.totalBetAmount} coins (${formattedDate})`;
  }).join('\n');
}

/**
 * Update the leaderboard
 * @param {Interaction} interaction - The interaction that triggered this
 * @param {Client} client - The Discord client instance
 */
async function updateLeaderboard(interaction, client) {
  try {
    await interaction.deferUpdate();

    // Create updated leaderboard embed
    const embed = await createLeaderboardEmbed();

    // Create buttons
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('leaderboard:updateLeaderboard')
          .setLabel('Update Leaderboard')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🔄'),
        new ButtonBuilder()
          .setCustomId('leaderboard:postToChannel')
          .setLabel('Post to Channel')
          .setStyle(ButtonStyle.Success)
          .setEmoji('📢'),
        new ButtonBuilder()
          .setCustomId('adminPanel:back')
          .setLabel('Back to Admin Panel')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('⬅️')
      );

    await interaction.editReply({
      embeds: [embed],
      components: [row]
    });

    logger.info(`User ${interaction.user.tag} updated the leaderboard`);
  } catch (error) {
    logger.error('Error updating leaderboard:', error);
    await interaction.followUp({
      embeds: [createErrorEmbed('Error', 'An error occurred while updating the leaderboard.')],
      ephemeral: true
    });
  }
}

/**
 * Post the leaderboard to a channel
 * @param {Interaction} interaction - The interaction that triggered this
 * @param {Client} client - The Discord client instance
 */
async function postLeaderboardToChannel(interaction, client) {
  try {
    // Check permissions
    if (!checkPermission(interaction, 'ADMIN')) {
      await interaction.reply({
        embeds: [createErrorEmbed('Permission Denied', 'You do not have permission to post the leaderboard.')],
        ephemeral: true
      });
      return;
    }

    await interaction.deferUpdate();

    // Get the channel for leaderboard posts
    const channelId = config.channels.reports;
    if (!channelId) {
      await interaction.followUp({
        embeds: [createErrorEmbed('Configuration Error', 'Leaderboard channel is not configured. Please set the REPORTS_CHANNEL in configuration.')],
        ephemeral: true
      });
      return;
    }

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) {
      await interaction.followUp({
        embeds: [createErrorEmbed('Channel Error', 'Could not find the configured leaderboard channel.')],
        ephemeral: true
      });
      return;
    }

    // Create leaderboard embed
    const embed = await createLeaderboardEmbed();

    // Post to channel
    await channel.send({ embeds: [embed] });

    // Confirm to user
    await interaction.followUp({
      embeds: [createSuccessEmbed('Leaderboard Posted', `The leaderboard has been posted to ${channel}.`)],
      ephemeral: true
    });

    logger.info(`User ${interaction.user.tag} posted the leaderboard to channel #${channel.name} (${channel.id})`);
  } catch (error) {
    logger.error('Error posting leaderboard to channel:', error);
    await interaction.followUp({
      embeds: [createErrorEmbed('Error', 'An error occurred while posting the leaderboard to the channel.')],
      ephemeral: true
    });
  }
}

/**
 * Handle button interactions for this module
 * @param {string} buttonId - The ID of the button that was clicked
 * @param {Interaction} interaction - The interaction that triggered this
 * @param {Client} client - The Discord client instance
 */
async function handleButton(buttonId, interaction, client) {
  try {
    switch (buttonId) {
      case 'updateLeaderboard':
        await updateLeaderboard(interaction, client);
        break;
      case 'postToChannel':
        await postLeaderboardToChannel(interaction, client);
        break;
      default:
        logger.warn(`Unknown button ID in leaderboard module: ${buttonId}`);
        await interaction.reply({
          content: 'Unknown button action.',
          ephemeral: true
        });
    }
  } catch (error) {
    logger.error('Error handling button in leaderboard module:', error);
    await interaction.reply({
      embeds: [createErrorEmbed('Error', 'An error occurred while processing your request.')],
      ephemeral: true
    });
  }
}

/**
 * Schedule automatic leaderboard updates
 * @param {Client} client - The Discord client instance
 */
async function scheduleAutomaticUpdates(client) {
  try {
    // Get leaderboard update configuration
    const updateConfig = await Models.Configuration.findOne({
      where: { key: 'LEADERBOARD_AUTO_UPDATE' }
    });

    if (!updateConfig || updateConfig.value !== 'true') {
      logger.debug('Automatic leaderboard updates are disabled');
      return;
    }

    // Get the channel for leaderboard posts
    const channelId = config.channels.reports;
    if (!channelId) {
      logger.warn('Leaderboard channel is not configured for automatic updates');
      return;
    }

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) {
      logger.warn('Could not find the configured leaderboard channel for automatic updates');
      return;
    }

    // Create leaderboard embed
    const embed = await createLeaderboardEmbed();

    // Post to channel
    await channel.send({ embeds: [embed] });

    logger.info(`Automatic leaderboard update posted to channel #${channel.name} (${channel.id})`);
  } catch (error) {
    logger.error('Error in scheduled leaderboard update:', error);
  }
}

module.exports = {
  generateLeaderboard,
  updateLeaderboard,
  postLeaderboardToChannel,
  scheduleAutomaticUpdates,
  handleButton
};