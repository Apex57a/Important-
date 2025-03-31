// KrayStakes Discord Bot - Guide & Help Module
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createSuccessEmbed, createErrorEmbed } = require('../utils/embeds');
const { safeReply, safeDefer, safeUpdate, handleInteractionError } = require('../utils/interactions');
const config = require('../config');
const logger = require('../utils/logger');

// Help topics
const helpTopics = {
  general: {
    title: 'General Information',
    description: 'KrayStakes is a betting management system for in-game events. It allows users to place bets on various events and receive payouts based on the results.',
    fields: [
      { name: 'Commands', value: 'Use /help to view this help menu at any time.' },
      { name: 'Basic Usage', value: 'Bet on events in the designated betting channel. View the event list first, then place your bets.' },
      { name: 'Getting Started', value: 'Check the announcements channel for upcoming events. When an event is posted, you can place bets using the buttons on the event message.' }
    ]
  },
  events: {
    title: 'Events Guide',
    description: 'Events are the core of the KrayStakes system. Here\'s how they work:',
    fields: [
      { name: 'Event Types', value: 'Boxing, Racing, Paintball, and Custom events are supported.' },
      { name: 'Event Status', value: '**Pending** - Event is scheduled but not yet open for betting\n**Open** - Event is open for betting\n**Locked** - Betting is closed, event in progress\n**Paused** - Event is temporarily paused\n**Completed** - Event is over, winners announced\n**Cancelled** - Event was cancelled, bets refunded' },
      { name: 'Viewing Events', value: 'Events are announced in the designated announcements channel.' }
    ]
  },
  betting: {
    title: 'Betting Guide',
    description: 'How to place bets and understand the betting system:',
    fields: [
      { name: 'Placing Bets', value: 'Click the "Place Bet" button on an event announcement to place a bet. Follow the prompts to select your choice and bet amount.' },
      { name: 'Bet Limits', value: `Minimum bet: ${config.defaultBetting.minBet} coins\nMaximum bet: ${config.defaultBetting.maxBet} coins\nMax bets per user: ${config.defaultBetting.limitPerUser} per event` },
      { name: 'Cancelling Bets', value: 'You can cancel a bet before the event is locked by viewing your bets and selecting the cancel option.' }
    ]
  },
  payouts: {
    title: 'Payout Guide',
    description: 'How payouts work:',
    fields: [
      { name: 'Winning Bets', value: 'If your choice wins, you\'ll receive a payout based on the odds and your bet amount.' },
      { name: 'Fees', value: `A ${config.defaultBetting.feePercent}% fee is applied to all winnings.` },
      { name: 'Payout Process', value: `Small payouts (under ${config.defaultPayout.autoPayoutThreshold} coins) are processed automatically. Larger payouts require manual processing by a Payout Manager.` },
      { name: 'Payout Window', value: `You have ${config.defaultPayout.payoutWindow} days to claim your payout after an event ends.` }
    ]
  },
  roles: {
    title: 'Roles Guide',
    description: 'User roles and permissions in the KrayStakes system:',
    fields: [
      { name: 'Administrators', value: 'Full access to all bot functions, including configuration, events, payouts, and reports.' },
      { name: 'Event Managers', value: 'Can create, edit, and manage events. Can also announce events and handle winner selection.' },
      { name: 'Payout Managers', value: 'Can process payouts and view payout history. Cannot create or manage events.' },
      { name: 'Regular Users', value: 'Can view events, place bets, view their bet history, and receive payouts.' }
    ]
  }
};

/**
 * Show the main help menu
 * @param {Interaction} interaction - The interaction that triggered this
 * @param {Client} client - The Discord client instance
 */
async function showHelpMenu(interaction, client) {
  try {
    // Safely defer reply
    await safeDefer(interaction, true);
    
    // Create embed
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('KrayStakes Bot Help')
      .setDescription('Welcome to the KrayStakes betting system! Please select a help topic below:')
      .addFields(
        { name: '📋 General Information', value: 'Basic information about the bot and its commands.' },
        { name: '🎮 Events Guide', value: 'Learn about how events work and their statuses.' },
        { name: '💰 Betting Guide', value: 'Understand how to place bets and betting limits.' },
        { name: '💸 Payout Guide', value: 'Information about payouts and how to claim them.' },
        { name: '👑 Roles Guide', value: 'Explanation of user roles and permissions.' }
      )
      .setFooter({ text: 'KrayStakes Bot - Help Menu' });
    
    // Create buttons
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('guideHelp:general')
          .setLabel('General Info')
          .setEmoji('📋')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('guideHelp:events')
          .setLabel('Events')
          .setEmoji('🎮')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('guideHelp:betting')
          .setLabel('Betting')
          .setEmoji('💰')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('guideHelp:payouts')
          .setLabel('Payouts')
          .setEmoji('💸')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('guideHelp:roles')
          .setLabel('Roles')
          .setEmoji('👑')
          .setStyle(ButtonStyle.Primary)
      );
    
    // Safely send response
    if (interaction.deferred) {
      await interaction.editReply({
        embeds: [embed],
        components: [row]
      });
    } else {
      await safeReply(interaction, {
        embeds: [embed],
        components: [row]
      }, true);
    }
  } catch (error) {
    logger.error('Error showing help menu:', error);
    await handleInteractionError(error, interaction, 'showHelpMenu');
  }
}

/**
 * Show help for a specific topic
 * @param {Interaction} interaction - The interaction that triggered this
 * @param {string} topic - The help topic to display
 */
async function showTopic(interaction, topic) {
  try {
    // Check if topic exists
    if (!helpTopics[topic]) {
      await safeReply(interaction, {
        embeds: [createErrorEmbed('Invalid Topic', 'The requested help topic does not exist.')],
        ephemeral: true
      });
      return;
    }
    
    // Get topic data
    const topicData = helpTopics[topic];
    
    // Create embed
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle(topicData.title)
      .setDescription(topicData.description)
      .setFooter({ text: 'KrayStakes Bot - Help' });
    
    // Add fields from topic data
    topicData.fields.forEach(field => {
      embed.addFields({ name: field.name, value: field.value });
    });
    
    // Create back button
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('guideHelp:menu')
          .setLabel('Back to Help Menu')
          .setStyle(ButtonStyle.Secondary)
      );
    
    // Safely update reply
    await safeUpdate(interaction, {
      embeds: [embed],
      components: [row]
    });
  } catch (error) {
    logger.error(`Error showing help topic ${topic}:`, error);
    await handleInteractionError(error, interaction, `showTopic:${topic}`);
  }
}

/**
 * Handle button clicks for this module
 * @param {string} buttonId - The ID of the button that was clicked
 * @param {Interaction} interaction - The interaction that triggered this
 * @param {Client} client - The Discord client instance
 */
async function handleButton(buttonId, interaction, client) {
  try {
    // Validate inputs first
    if (!interaction) {
      logger.error(`Guide help handleButton called with null interaction for button: ${buttonId}`);
      return;
    }
    
    if (!buttonId) {
      logger.error('Guide help handleButton called with null buttonId');
      // Only attempt to reply if not already acknowledged
      if (!interaction.deferred && !interaction.replied) {
        return await safeReply(interaction, {
          embeds: [createErrorEmbed('Error', 'Invalid help button ID.')],
          ephemeral: true
        });
      }
      return;
    }
    
    // Defer only if the interaction hasn't been deferred or replied to
    let deferSuccess = false;
    if (!interaction.deferred && !interaction.replied) {
      deferSuccess = await safeDeferUpdate(interaction);
    } else {
      deferSuccess = true; // Interaction is already deferred or replied to
    }
    
    // If deferral failed, the interaction might have expired - try to create a new reply instead
    if (!deferSuccess) {
      logger.warn(`Failed to defer update for '${buttonId}' button, attempting to create a new message`);
      
      // For the main menu button, show the full help menu again with a fresh interaction
      if (buttonId === 'menu') {
        // Only create a new reply if the interaction hasn't been replied to
        if (!interaction.replied) {
          return await safeReply(interaction, {
            content: "Here's the help menu again (the previous interaction expired):",
            ephemeral: true
          }, true).then(() => showHelpMenu(interaction, client));
        }
        return await showHelpMenu(interaction, client);
      }
      
      // For other buttons, inform the user and suggest using /help again
      // Only if the interaction hasn't been replied to
      if (!interaction.replied) {
        return await safeReply(interaction, {
          embeds: [createErrorEmbed(
            'Interaction Expired', 
            'This button interaction has expired. Please use the `/help` command again to view the help menu.'
          )],
          ephemeral: true
        });
      }
      return;
    }
    
    // Process the button click if deferral was successful
    switch (buttonId) {
      case 'menu':
        return await showHelpMenu(interaction, client);
      case 'general':
      case 'events':
      case 'betting':
      case 'payouts':
      case 'roles':
        return await showTopic(interaction, buttonId);
      default:
        logger.warn(`Unknown guide/help button ID clicked: ${buttonId}`);
        return await safeUpdate(interaction, {
          embeds: [createErrorEmbed('Unknown Button', `This button is not configured properly. Please use the /help command again.`)],
          components: []
        });
    }
  } catch (error) {
    logger.error(`Error handling button ${buttonId} in Guide & Help module:`, error);
    
    // Try to provide helpful error message to user
    try {
      await safeReply(interaction, {
        embeds: [createErrorEmbed(
          'Error Processing Help', 
          'There was an error processing your help request. Please try using the `/help` command again.'
        )],
        ephemeral: true
      });
    } catch (replyError) {
      logger.error('Failed to send error message after button handling failed:', replyError);
    }
  }
}

module.exports = {
  showHelpMenu,
  showTopic,
  handleButton
};