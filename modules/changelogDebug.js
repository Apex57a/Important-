// KrayStakes Discord Bot - Changelog & Debug Mode Module
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const logger = require('../utils/logger');
const config = require('../config');
const { checkPermission } = require('../utils/permissions');
const { createSuccessEmbed, createErrorEmbed } = require('../utils/embeds');
const { Models } = require('../database/models');

/**
 * Display the changelog panel
 * @param {Interaction} interaction - The interaction that triggered this
 * @param {Client} client - The Discord client instance
 */
async function showChangelog(interaction, client) {
  try {
    // Check permissions
    if (!checkPermission(interaction, 'ADMIN')) {
      await interaction.reply({
        embeds: [createErrorEmbed('Permission Denied', 'You do not have permission to view the changelog.')],
        ephemeral: true
      });
      return;
    }

    // Create changelog embed
    const changelogEmbed = await createChangelogEmbed();

    // Create buttons
    const buttons = createChangelogButtons();

    await interaction.reply({
      embeds: [changelogEmbed],
      components: buttons,
      ephemeral: true
    });

    logger.info(`User ${interaction.user.tag} viewed the changelog panel`);
  } catch (error) {
    logger.error('Error displaying changelog panel:', error);
    await interaction.reply({
      embeds: [createErrorEmbed('Error', 'An error occurred while displaying the changelog panel.')],
      ephemeral: true
    });
  }
}

/**
 * Create the changelog embed
 * @returns {Promise<EmbedBuilder>} The changelog embed
 */
async function createChangelogEmbed() {
  try {
    // Get the current debug mode status
    const debugConfig = await Models.Configuration.findOne({
      where: { key: 'DEBUG_MODE' }
    });

    const debugMode = debugConfig ? (debugConfig.value === 'true' ? 'Enabled' : 'Disabled') : 'Disabled';

    // Create the embed
    const embed = new EmbedBuilder()
      .setTitle('🆕 KrayStakes Bot - Changelog & Debug Mode')
      .setColor('#5865F2')
      .setDescription('View the bot changelog and manage debug mode settings.')
      .addFields(
        { name: '🔍 Current Debug Mode', value: debugMode, inline: true },
        { name: '\u200B', value: '\u200B', inline: true },
        { name: '🛠️ Version', value: '1.0.0', inline: true },
        { name: '📜 Recent Changes', value: getChangelogText() }
      )
      .setFooter({ text: 'KrayStakes Ltd. Bot Management' })
      .setTimestamp();

    return embed;
  } catch (error) {
    logger.error('Error creating changelog embed:', error);
    throw error;
  }
}

/**
 * Get the changelog text
 * @returns {string} The changelog text
 */
function getChangelogText() {
  return `
**Version 1.0.0** (${new Date().toLocaleDateString()})
- Initial release of KrayStakes Bot
- Implemented Admin Panel with interactive buttons
- Created Event Creation with intuitive time selection
- Added Event Management with comprehensive controls
- Implemented Winner Selection and Payout Management
- Added Reports & Logs functionality
- Implemented Configuration Settings
- Added Discord Bot Logs for monitoring
- Implemented Scheduled Events & Reminders
- Created Guide & Help Module for users
`;
}

/**
 * Create the buttons for the changelog panel
 * @returns {Array<ActionRowBuilder>} The buttons
 */
function createChangelogButtons() {
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('changelogDebug:toggleDebug')
        .setLabel('Toggle Debug Mode')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🔍'),
      new ButtonBuilder()
        .setCustomId('changelogDebug:viewFullChangelog')
        .setLabel('View Full Changelog')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📜'),
      new ButtonBuilder()
        .setCustomId('adminPanel:back')
        .setLabel('Back to Admin Panel')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('⬅️')
    );

  return [row];
}

/**
 * Toggle debug mode
 * @param {Interaction} interaction - The interaction that triggered this
 * @param {Client} client - The Discord client instance
 */
async function toggleDebugMode(interaction, client) {
  try {
    // Check permissions (only Server Admin can toggle debug mode)
    if (!checkPermission(interaction, 'SERVER_ADMIN')) {
      await interaction.reply({
        embeds: [createErrorEmbed('Permission Denied', 'Only Server Admins can toggle debug mode.')],
        ephemeral: true
      });
      return;
    }

    // Get current debug mode setting
    const debugConfig = await Models.Configuration.findOne({
      where: { key: 'DEBUG_MODE' }
    });

    const currentDebugMode = debugConfig ? (debugConfig.value === 'true') : false;
    const newDebugMode = !currentDebugMode;

    // Update the configuration
    if (debugConfig) {
      await debugConfig.update({
        value: String(newDebugMode)
      });
    } else {
      await Models.Configuration.create({
        key: 'DEBUG_MODE',
        value: String(newDebugMode),
        category: 'LOGGING',
        description: 'Enable/disable debug mode'
      });
    }

    // Also update the global config for immediate effect
    config.debugMode = newDebugMode;

    // Log the change
    logger.info(`Debug mode toggled to ${newDebugMode} by ${interaction.user.tag}`);

    // Create success message
    const statusText = newDebugMode ? 'Enabled' : 'Disabled';
    const successEmbed = createSuccessEmbed(
      'Debug Mode Updated',
      `Debug mode has been ${statusText.toLowerCase()}. ${newDebugMode 
        ? 'Detailed logs will now be generated for troubleshooting.' 
        : 'Standard logging has been restored.'}`
    );

    await interaction.reply({
      embeds: [successEmbed],
      ephemeral: true
    });

    // Refresh the changelog view after a short delay
    setTimeout(async () => {
      try {
        // Create updated changelog embed
        const changelogEmbed = await createChangelogEmbed();
        // Create buttons
        const buttons = createChangelogButtons();

        await interaction.followUp({
          embeds: [changelogEmbed],
          components: buttons,
          ephemeral: true
        });
      } catch (error) {
        logger.error('Error refreshing changelog view:', error);
      }
    }, 1000);

  } catch (error) {
    logger.error('Error toggling debug mode:', error);
    await interaction.reply({
      embeds: [createErrorEmbed('Error', 'An error occurred while toggling debug mode.')],
      ephemeral: true
    });
  }
}

/**
 * View the full changelog
 * @param {Interaction} interaction - The interaction that triggered this
 * @param {Client} client - The Discord client instance
 */
async function viewFullChangelog(interaction, client) {
  try {
    // Check permissions
    if (!checkPermission(interaction, 'ADMIN')) {
      await interaction.reply({
        embeds: [createErrorEmbed('Permission Denied', 'You do not have permission to view the full changelog.')],
        ephemeral: true
      });
      return;
    }

    // Create full changelog embed
    const fullChangelogEmbed = new EmbedBuilder()
      .setTitle('📜 KrayStakes Bot - Full Changelog')
      .setColor('#5865F2')
      .setDescription('Complete history of bot updates and changes.')
      .addFields(
        { 
          name: '**Version 1.0.0** (Initial Release)', 
          value: `
• Implemented comprehensive Admin Panel with interactive buttons
• Created Event Creation module with intuitive time selection
• Added Event Management with extensive controls for event monitoring
• Implemented Winner Selection for accurate result tracking
• Added Payout Management for efficient reward distribution
• Created Reports & Logs for detailed financial tracking
• Implemented Configuration Settings for full customization
• Added Discord Bot Logs for system monitoring and error tracking
• Implemented Scheduled Events & Reminders functionality
• Created Guide & Help Module for user assistance
• Added Changelog & Debug Mode Module for version tracking
• Implemented full database persistence for reliable data storage
• Added comprehensive permission system with role-based access
• Created timezone-aware scheduling and display capabilities
`
        },
        { 
          name: '**Future Updates**', 
          value: `
• Enhanced mobile compatibility
• Additional event types and betting options
• Integration with external payment systems
• Advanced statistical analysis tools
• User preference customization
` 
        }
      )
      .setFooter({ text: 'KrayStakes Ltd. Bot Management' })
      .setTimestamp();

    // Create a button to go back
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('changelogDebug:back')
          .setLabel('Back')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('⬅️')
      );

    await interaction.reply({
      embeds: [fullChangelogEmbed],
      components: [row],
      ephemeral: true
    });

    logger.info(`User ${interaction.user.tag} viewed the full changelog`);
  } catch (error) {
    logger.error('Error displaying full changelog:', error);
    await interaction.reply({
      embeds: [createErrorEmbed('Error', 'An error occurred while displaying the full changelog.')],
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
      case 'toggleDebug':
        await toggleDebugMode(interaction, client);
        break;
      case 'viewFullChangelog':
        await viewFullChangelog(interaction, client);
        break;
      case 'back':
        // Return to main changelog panel
        const changelogEmbed = await createChangelogEmbed();
        const buttons = createChangelogButtons();
        await interaction.update({
          embeds: [changelogEmbed],
          components: buttons
        });
        break;
      default:
        logger.warn(`Unknown button ID in changelog module: ${buttonId}`);
        await interaction.reply({
          content: 'Unknown button action.',
          ephemeral: true
        });
    }
  } catch (error) {
    logger.error('Error handling button in changelog module:', error);
    await interaction.reply({
      embeds: [createErrorEmbed('Error', 'An error occurred while processing your request.')],
      ephemeral: true
    });
  }
}

module.exports = {
  showChangelog,
  toggleDebugMode,
  viewFullChangelog,
  handleButton
};