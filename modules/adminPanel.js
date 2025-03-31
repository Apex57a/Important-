// KrayStakes Discord Bot - Admin Panel Module
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createSuccessEmbed, createErrorEmbed } = require('../utils/embeds');
const { isAdmin, isEventManager, isPayoutManager } = require('../utils/permissions');
const { safeReply, safeUpdate, safeDeferUpdate, handleInteractionError } = require('../utils/interactions');
const logger = require('../utils/logger');

/**
 * Create the admin panel embed
 * @returns {EmbedBuilder} - The configured embed
 */
function createPanelEmbed() {
  return new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle('KrayStakes Admin Panel')
    .setDescription('Select an action from the buttons below to manage the betting system.')
    .addFields(
      { name: 'Event Management', value: 'Create, edit, and manage betting events.' },
      { name: 'Winner Selection', value: 'Select winners and calculate payouts.' },
      { name: 'Payout Management', value: 'Process payouts and track history.' },
      { name: 'Reports & Logs', value: 'Generate reports and view system logs.' },
      { name: 'Configuration', value: 'Configure bot settings and options.' }
    )
    .setTimestamp()
    .setFooter({ text: 'KrayStakes LTD' });
}

/**
 * Create the admin panel buttons
 * @returns {Array<ActionRowBuilder>} - Array of button rows
 */
function createPanelButtons() {
  // Row 1: Event Management
  const row1 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('eventCreation:createEvent')
        .setLabel('🎲 Create Event')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('eventManagement:manageEvents')
        .setLabel('📋 Manage Events')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('eventManagement:announceEvent')
        .setLabel('📢 Announcements')
        .setStyle(ButtonStyle.Primary)
    );
  
  // Row 2: Winner Selection & Payout
  const row2 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('winnerSelection:selectWinner')
        .setLabel('🏆 Winner Selection')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('payoutManagement:payoutPanel')
        .setLabel('💰 Payout Panel')
        .setStyle(ButtonStyle.Success)
    );
  
  // Row 3: Schedule, Reports & Logs
  const row3 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('scheduledEvents:viewSchedule')
        .setLabel('📅 Scheduled Events')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('reportsLogs:reportsPanel')
        .setLabel('📊 Reports & Logs')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('discordBotLogs:viewLogs')
        .setLabel('🔍 Discord Bot Logs')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('leaderboard:generateLeaderboard')
        .setLabel('🏆 Leaderboard')
        .setStyle(ButtonStyle.Secondary)
    );
  
  // Row 4: Configuration & Help
  const row4 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('configurationSettings:configPanel')
        .setLabel('⚙️ Configuration Settings')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('guideHelp:showHelpMenu')
        .setLabel('📖 Guide & Help')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('changelogDebug:showChangelog')
        .setLabel('🆕 Changelog & Debug Mode')
        .setStyle(ButtonStyle.Secondary)
    );
  
  return [row1, row2, row3, row4];
}

/**
 * Create the admin panel in a channel
 * @param {Interaction} interaction - The interaction that triggered this
 * @param {Client} client - The Discord client instance
 * @param {TextChannel} targetChannel - The channel to create the panel in (optional)
 */
async function createPanel(interaction, client, targetChannel = null) {
  try {
    // Validate inputs
    if (!interaction) {
      logger.error('createPanel called with null interaction');
      return;
    }
    
    // Use the provided channel or the interaction channel
    const channel = targetChannel || interaction.channel;
    
    if (!channel) {
      logger.error('No valid channel found for creating admin panel');
      await safeReply(interaction, {
        embeds: [createErrorEmbed(
          'Error Creating Panel',
          'Unable to determine the target channel for the admin panel.'
        )]
      });
      return;
    }
    
    // Create the embed and buttons
    const embed = createPanelEmbed();
    const buttons = createPanelButtons();
    
    try {
      // Send the panel to the channel
      const message = await channel.send({
        embeds: [embed],
        components: buttons
      });
      
      // Reply to the interaction
      if (interaction.deferred) {
        await interaction.editReply({
          embeds: [createSuccessEmbed(
            'Admin Panel Created',
            `The admin panel has been created in ${channel}.\n\nUse the buttons on the panel to manage the betting system.`
          )]
        });
      } else {
        await safeReply(interaction, {
          embeds: [createSuccessEmbed(
            'Admin Panel Created',
            `The admin panel has been created in ${channel}.\n\nUse the buttons on the panel to manage the betting system.`
          )]
        });
      }
      
      // Log the action
      logger.info(`Admin panel created in channel #${channel.name} (${channel.id}) by ${interaction.user.tag} (${interaction.user.id})`);
    } catch (channelError) {
      logger.error('Error sending panel to channel:', channelError);
      
      // Check if it's a permissions error
      if (channelError.code === 50013) { // Missing Permissions error code
        await safeReply(interaction, {
          embeds: [createErrorEmbed(
            'Missing Permissions',
            `I don't have permission to send messages in ${channel}. Please check my channel permissions and try again.`
          )]
        });
      } else {
        await safeReply(interaction, {
          embeds: [createErrorEmbed(
            'Error Creating Panel',
            `There was an error creating the admin panel in ${channel}. Please try again or choose a different channel.`
          )]
        });
      }
    }
  } catch (error) {
    logger.error('Error creating admin panel:', error);
    
    try {
      // Use more robust error handling
      if (interaction.deferred) {
        await interaction.editReply({
          embeds: [createErrorEmbed(
            'Error Creating Panel',
            'There was an error creating the admin panel. Please check the bot permissions and try again.'
          )]
        });
      } else {
        await safeReply(interaction, {
          embeds: [createErrorEmbed(
            'Error Creating Panel',
            'There was an error creating the admin panel. Please check the bot permissions and try again.'
          )]
        });
      }
    } catch (replyError) {
      logger.error('Failed to send error response for panel creation:', replyError);
    }
  }
}

/**
 * Handle a button click on the admin panel
 * @param {string} buttonId - The ID of the button that was clicked
 * @param {Interaction} interaction - The interaction that triggered this
 * @param {Client} client - The Discord client instance
 */
async function handleButton(buttonId, interaction, client) {
  try {
    // Validate inputs first before any interaction handling
    if (!interaction) {
      logger.error(`Admin panel handleButton called with null interaction for button: ${buttonId}`);
      return;
    }
    
    if (!buttonId) {
      logger.error('Admin panel handleButton called with null buttonId');
      // Only attempt to reply if not already acknowledged
      if (!interaction.deferred && !interaction.replied) {
        return await safeReply(interaction, {
          embeds: [createErrorEmbed('Error', 'Invalid button ID.')],
          ephemeral: true
        });
      }
      return;
    }
    
    // Safely defer the button interaction to prevent "Interaction failed" errors
    // But only if it hasn't been deferred or replied to already
    if (!interaction.deferred && !interaction.replied) {
      await safeDeferUpdate(interaction);
    }
    
    // Check permissions based on the button clicked
    if (buttonId === 'createEvent' || buttonId === 'manageEvents' || buttonId === 'announceEvent') {
      if (!interaction.member || !isEventManager(interaction.member)) {
        return await safeUpdate(interaction, {
          embeds: [createErrorEmbed('Permission Denied', 'You must be an Event Manager to use this feature.')],
          ephemeral: true
        });
      }
    } else if (buttonId === 'selectWinner' || buttonId === 'payoutPanel') {
      if (!interaction.member || !isPayoutManager(interaction.member)) {
        return await safeUpdate(interaction, {
          embeds: [createErrorEmbed('Permission Denied', 'You must be a Payout Manager to use this feature.')],
          ephemeral: true
        });
      }
    } else if (buttonId === 'configPanel') {
      if (!interaction.member || !isAdmin(interaction.member)) {
        return await safeUpdate(interaction, {
          embeds: [createErrorEmbed('Permission Denied', 'You must be an Administrator to use this feature.')],
          ephemeral: true
        });
      }
    }
    
    // Parse module and action from buttonId
    const parts = buttonId.includes(':') ? buttonId.split(':') : [buttonId, ''];
    const module = parts[0];
    const action = parts[1] || '';
    
    // Handle the button press based on the module
    try {
      switch (module) {
        case 'configurationSettings':
          return await require('./configurationSettings').handleButton(action, interaction, client);
        case 'guideHelp':
          return await require('./guideHelp').handleButton(action, interaction, client);
        case 'changelogDebug':
          return await require('./changelogDebug').handleButton(action, interaction, client);
        case 'eventCreation':
          return await require('./eventCreation').handleButton(action, interaction, client);
        case 'eventManagement':
          return await require('./eventManagement').handleButton(action, interaction, client);
        case 'winnerSelection':
          return await require('./winnerSelection').handleButton(action, interaction, client);
        case 'payoutManagement':
          return await require('./payoutManagement').handleButton(action, interaction, client);
        case 'scheduledEvents':
          return await require('./scheduledEvents').handleButton(action, interaction, client);
        case 'reportsLogs':
          return await require('./reportsLogs').handleButton(action, interaction, client);
        case 'discordBotLogs':
          return await require('./discordBotLogs').handleButton(action, interaction, client);
        case 'leaderboard':
          return await require('./leaderboard').handleButton(action, interaction, client);
        default:
          // For unrecognized modules, send an error message
          return await safeUpdate(interaction, {
            embeds: [createErrorEmbed(
              'Unknown Feature', 
              `The "${module}" module is not recognized.`
            )],
            ephemeral: true
          });
      }
    } catch (error) {
      // If there's an error loading or executing the module, provide a helpful message
      logger.error(`Error handling button for module ${module}:`, error);
      
      return await safeUpdate(interaction, {
        embeds: [createErrorEmbed(
          'Module Error', 
          `There was an error processing your request in the ${module} module. Please try again or contact an administrator.`
        )],
        ephemeral: true
      });
    }
  } catch (error) {
    logger.error(`Error handling admin panel button ${buttonId}:`, error);
    return await handleInteractionError(error, interaction, `adminPanel:${buttonId}`);
  }
}

module.exports = {
  createPanelEmbed,
  createPanelButtons,
  createPanel,
  handleButton
};