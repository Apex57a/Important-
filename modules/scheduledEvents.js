// KrayStakes Discord Bot - Scheduled Events Module
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createSuccessEmbed, createErrorEmbed, createEventEmbed, getStatusWithEmoji } = require('../utils/embeds');
const { formatDate, getTimeRemaining, shouldSendReminder } = require('../utils/timeUtils');
const { isEventManager } = require('../utils/permissions');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * View the schedule of upcoming events
 * @param {Interaction} interaction - The interaction that triggered this
 * @param {Client} client - The Discord client instance
 */
async function viewSchedule(interaction, client) {
  try {
    // Check permissions
    if (!interaction.member || !isEventManager(interaction.member)) {
      await interaction.reply({
        embeds: [createErrorEmbed('Permission Denied', 'You must be an Event Manager to view the schedule.')],
        ephemeral: true
      });
      return;
    }
    
    // Defer reply
    await interaction.deferReply({ ephemeral: true });
    
    // Get all active events from the database
    const { Event } = require('../database/models');
    const events = await Event.findAll({
      where: {
        status: ['pending', 'open'],
        scheduledTime: {
          [require('sequelize').Op.not]: null
        }
      },
      order: [['scheduledTime', 'ASC']]
    });
    
    // Check if there are any events
    if (events.length === 0) {
      await interaction.editReply({
        embeds: [createErrorEmbed('No Scheduled Events', 'There are no scheduled events currently.')]
      });
      return;
    }
    
    // Get user's timezone from database or use default
    const { Configuration } = require('../database/models');
    const timezoneConfig = await Configuration.findOne({ where: { key: 'timezone' } });
    const timezone = timezoneConfig?.value || config.timezone;
    
    // Create embed
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('📅 Scheduled Events')
      .setDescription(`There are ${events.length} upcoming events.`)
      .setTimestamp();
    
    // Add events to embed
    events.forEach((event, index) => {
      const formattedTime = formatDate(event.scheduledTime, 'PPpp', timezone);
      const timeRemaining = getTimeRemaining(event.scheduledTime);
      
      embed.addFields({
        name: `${index + 1}. ${event.name} (ID: ${event.id})`,
        value: `**Type:** ${event.type}\n**Status:** ${getStatusWithEmoji(event.status)}\n**Scheduled Time:** ${formattedTime}\n**Time Remaining:** ${timeRemaining}`,
        inline: false
      });
    });
    
    // Add footer
    embed.setFooter({ text: `Timezone: ${timezone}` });
    
    // Create buttons
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('scheduledEvents:sendReminders')
          .setLabel('📢 Send Reminders')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('scheduledEvents:refreshSchedule')
          .setLabel('🔄 Refresh')
          .setStyle(ButtonStyle.Secondary)
      );
    
    // Send response
    await interaction.editReply({
      embeds: [embed],
      components: [row]
    });
  } catch (error) {
    logger.error('Error viewing schedule:', error);
    
    if (interaction.deferred) {
      await interaction.editReply({ 
        embeds: [createErrorEmbed('Error', 'An error occurred while viewing the schedule.')]
      });
    } else {
      await interaction.reply({
        embeds: [createErrorEmbed('Error', 'An error occurred while viewing the schedule.')],
        ephemeral: true
      });
    }
  }
}

/**
 * Send reminders for upcoming events
 * @param {Interaction} interaction - The interaction that triggered this
 * @param {Client} client - The Discord client instance
 */
async function sendReminders(interaction, client) {
  try {
    // Check permissions
    if (!interaction.member || !isEventManager(interaction.member)) {
      await interaction.reply({
        embeds: [createErrorEmbed('Permission Denied', 'You must be an Event Manager to send reminders.')],
        ephemeral: true
      });
      return;
    }
    
    // Defer reply
    await interaction.deferReply({ ephemeral: true });
    
    // Force send reminders
    const sentCount = await checkUpcomingEvents(client, true);
    
    // Reply with result
    if (sentCount > 0) {
      await interaction.editReply({
        embeds: [createSuccessEmbed('Reminders Sent', `Sent ${sentCount} reminders for upcoming events.`)]
      });
    } else {
      await interaction.editReply({
        embeds: [createErrorEmbed('No Reminders', 'There are no events that require reminders at this time.')]
      });
    }
  } catch (error) {
    logger.error('Error sending reminders:', error);
    
    if (interaction.deferred) {
      await interaction.editReply({ 
        embeds: [createErrorEmbed('Error', 'An error occurred while sending reminders.')]
      });
    } else {
      await interaction.reply({
        embeds: [createErrorEmbed('Error', 'An error occurred while sending reminders.')],
        ephemeral: true
      });
    }
  }
}

/**
 * Check for upcoming events and send reminders if necessary
 * @param {Client} client - The Discord client instance
 * @param {boolean} forceSend - Whether to force send reminders regardless of timing
 * @returns {Promise<number>} - Number of reminders sent
 */
async function checkUpcomingEvents(client, forceSend = false) {
  try {
    // Get all active events from the database
    const { Event } = require('../database/models');
    const events = await Event.findAll({
      where: {
        status: ['pending', 'open'],
        scheduledTime: {
          [require('sequelize').Op.not]: null
        }
      }
    });
    
    // Check if there are any events
    if (events.length === 0) {
      return 0;
    }
    
    // Get announcements channel ID from config
    const announcementsChannelId = config.channels.announcements;
    if (!announcementsChannelId) {
      logger.warn('No announcements channel configured. Skipping reminders.');
      return 0;
    }
    
    // Get the announcements channel
    const announcementsChannel = await client.channels.fetch(announcementsChannelId).catch(() => null);
    if (!announcementsChannel) {
      logger.warn(`Announcements channel with ID ${announcementsChannelId} not found.`);
      return 0;
    }
    
    // Get user's timezone from database or use default
    const { Configuration } = require('../database/models');
    const timezoneConfig = await Configuration.findOne({ where: { key: 'timezone' } });
    const timezone = timezoneConfig?.value || config.timezone;
    
    // Get reminder times from config
    const reminderTimes = config.reminderTimes || [1440, 60, 15]; // Default: 24 hours, 1 hour, 15 minutes
    
    // Track number of reminders sent
    let remindersSent = 0;
    
    // Check each event
    for (const event of events) {
      // Check if event has a scheduled time
      if (!event.scheduledTime) continue;
      
      // Get the reminders already sent for this event
      const sentReminders = event.remindersSent || [];
      let updated = false;
      
      // Check each reminder time
      for (const reminderTime of reminderTimes) {
        // Check if reminder should be sent
        if (forceSend || shouldSendReminder(event.scheduledTime, reminderTime, sentReminders)) {
          // Create reminder embed
          const embed = createEventEmbed(event, timezone);
          embed.setTitle(`⏰ Reminder: ${embed.data.title}`);
          
          // Add reminder info
          const timeRemaining = getTimeRemaining(event.scheduledTime);
          embed.addFields({
            name: 'Reminder',
            value: `This event starts in ${timeRemaining}!`,
            inline: false
          });
          
          // Send reminder to announcements channel
          await announcementsChannel.send({ embeds: [embed] });
          
          // Update sent reminders
          sentReminders.push(reminderTime);
          updated = true;
          remindersSent++;
          
          // Log the action
          logger.info(`Sent ${reminderTime} minute reminder for event ${event.id}`);
        }
      }
      
      // Update the event in the database if reminders were sent
      if (updated) {
        event.remindersSent = sentReminders;
        await event.save();
      }
    }
    
    return remindersSent;
  } catch (error) {
    logger.error('Error checking upcoming events:', error);
    return 0;
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
    switch (buttonId) {
      case 'viewSchedule':
        await viewSchedule(interaction, client);
        break;
      case 'sendReminders':
        await sendReminders(interaction, client);
        break;
      case 'refreshSchedule':
        await viewSchedule(interaction, client);
        break;
      default:
        await interaction.reply({
          embeds: [createErrorEmbed('Unknown Button', `The button "${buttonId}" is not recognized.`)],
          ephemeral: true
        });
        break;
    }
  } catch (error) {
    logger.error(`Error handling button ${buttonId} in Scheduled Events module:`, error);
    
    await interaction.reply({
      embeds: [createErrorEmbed('Error', 'An error occurred while processing your request.')],
      ephemeral: true
    });
  }
}

module.exports = {
  viewSchedule,
  sendReminders,
  checkUpcomingEvents,
  handleButton
};