// Event Management Module - Handles the management of ongoing events
const { 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  ComponentType
} = require('discord.js');
const { models } = require('../database/dbInit');
const logger = require('../utils/logger');
const { createEventEmbed } = require('../utils/embeds');
const { formatDateTime } = require('../utils/timeUtils');
const { Op } = require('sequelize');
const { format } = require('date-fns');
const { parseISO, zonedTimeToUtc, utcToZonedTime } = require('date-fns-tz');

// Handler for manageEvents button from admin panel
async function manageEvents(interaction, client) {
  try {
    await interaction.deferReply({ ephemeral: true });
    
    // Get all ongoing events (not closed)
    const events = await models.Event.findAll({
      where: {
        status: {
          [Op.ne]: 'Closed'
        }
      },
      order: [['createdAt', 'DESC']]
    });
    
    if (events.length === 0) {
      return interaction.editReply({
        content: 'There are no active events to manage at this time. Use the "Create Event" button to create a new event.',
        ephemeral: true
      });
    }
    
    // Get the current configuration to determine timezone
    const config = await models.Configuration.findOne();
    const timezone = config.timezone || 'UTC';
    
    // Create the event list embed
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Manage Events')
      .setDescription('Select an event to manage:')
      .setFooter({ text: `Timezone: ${timezone}` });
    
    // Create a select menu for the events
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('eventManagement_selectEvent')
      .setPlaceholder('Select an event to manage...');
    
    // Add options for each event
    for (const event of events) {
      // Create a formatted date string if scheduleDate exists
      let timeStr = 'No scheduled time';
      if (event.scheduleDate) {
        const zonedDateTime = utcToZonedTime(event.scheduleDate, timezone);
        timeStr = format(zonedDateTime, 'MMM d, yyyy HH:mm');
      }
      
      // Add status emoji based on event status
      let statusEmoji = '🟢'; // Active
      if (event.status === 'Paused') statusEmoji = '⏸️';
      if (event.status === 'Locked') statusEmoji = '🔒';
      
      selectMenu.addOptions({
        label: `${event.name} (${event.type})`,
        description: `${statusEmoji} ${event.status} | ${timeStr} | ${event.totalBets} bets`,
        value: event.id.toString()
      });
    }
    
    const row = new ActionRowBuilder().addComponents(selectMenu);
    
    // Send the event selection message
    await interaction.editReply({
      embeds: [embed],
      components: [row],
      ephemeral: true
    });
    
    logger.info(`Event management panel opened by ${interaction.user.tag}`);
  } catch (error) {
    logger.error('Error in manageEvents function:', error);
    if (interaction.deferred) {
      await interaction.editReply({
        content: 'An error occurred while loading the events. Please try again.',
        ephemeral: true
      });
    } else {
      await interaction.reply({
        content: 'An error occurred while loading the events. Please try again.',
        ephemeral: true
      });
    }
  }
}

// Handle event selection
async function selectEventSelect(interaction, client) {
  try {
    await interaction.deferUpdate();
    
    // Get the selected event ID
    const eventId = interaction.values[0];
    
    // Fetch the event from the database
    const event = await models.Event.findByPk(eventId);
    
    if (!event) {
      return interaction.editReply({
        content: 'The selected event could not be found. It may have been deleted.',
        components: [],
        ephemeral: true
      });
    }
    
    // Fetch related bets for statistics
    const bets = await models.Bet.findAll({
      where: { eventId: event.id }
    });
    
    // Get the current configuration to determine timezone
    const config = await models.Configuration.findOne();
    const timezone = config.timezone || 'UTC';
    
    // Create a formatted date string if scheduleDate exists
    let formattedDate = 'Not scheduled';
    if (event.scheduleDate) {
      const zonedDateTime = utcToZonedTime(event.scheduleDate, timezone);
      formattedDate = `${format(zonedDateTime, 'MMMM d, yyyy, HH:mm')} ${timezone}`;
    }
    
    // Calculate time remaining if scheduled and not in the past
    let timeRemaining = 'N/A';
    if (event.scheduleDate) {
      const now = new Date();
      const eventDate = new Date(event.scheduleDate);
      
      if (eventDate > now) {
        const diffMs = eventDate - now;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        
        timeRemaining = `${diffDays}d ${diffHours}h ${diffMinutes}m`;
      } else {
        timeRemaining = 'Event time has passed';
      }
    }
    
    // Create the event details embed
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle(`Managing: ${event.name}`)
      .setDescription(event.description || 'No description provided')
      .addFields(
        { name: 'Event Type', value: event.type, inline: true },
        { name: 'Status', value: event.status, inline: true },
        { name: 'Location', value: event.location || 'Not specified', inline: true },
        { name: 'Scheduled Time', value: formattedDate, inline: true },
        { name: 'Time Remaining', value: timeRemaining, inline: true },
        { name: 'Entry Fee', value: event.entryFee > 0 ? `$${event.entryFee}` : 'None', inline: true },
        { name: 'Betting Limits', value: `Min: $${event.minBetAmount} / Max: $${event.maxBetAmount}`, inline: true },
        { name: 'Total Bets', value: `${event.totalBets} bets ($${event.totalAmount})`, inline: true },
        { name: 'Auto-Calculation', value: event.autoCalculation ? 'Enabled' : 'Disabled', inline: true }
      )
      .setFooter({ text: `Event ID: ${event.id} | Created by: ${event.createdBy}` })
      .setTimestamp();
    
    // Add the image if provided
    if (event.imageUrl) {
      embed.setImage(event.imageUrl);
    }
    
    // Create the management buttons
    const row1 = new ActionRowBuilder();
    const row2 = new ActionRowBuilder();
    
    // Row 1: Standard management actions
    row1.addComponents(
      new ButtonBuilder()
        .setCustomId(`eventManagement_editEvent_${event.id}`)
        .setLabel('Edit Event')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('✏️')
    );
    
    // Lock/Unlock button based on current status
    if (event.status === 'Locked') {
      row1.addComponents(
        new ButtonBuilder()
          .setCustomId(`eventManagement_unlockEvent_${event.id}`)
          .setLabel('Unlock Betting')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🔓')
      );
    } else {
      row1.addComponents(
        new ButtonBuilder()
          .setCustomId(`eventManagement_lockEvent_${event.id}`)
          .setLabel('Lock Betting')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🔒')
      );
    }
    
    // Pause/Resume button based on current status
    if (event.status === 'Paused') {
      row1.addComponents(
        new ButtonBuilder()
          .setCustomId(`eventManagement_resumeEvent_${event.id}`)
          .setLabel('Resume Event')
          .setStyle(ButtonStyle.Success)
          .setEmoji('▶️')
      );
    } else {
      row1.addComponents(
        new ButtonBuilder()
          .setCustomId(`eventManagement_pauseEvent_${event.id}`)
          .setLabel('Pause Event')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('⏸️')
      );
    }
    
    row1.addComponents(
      new ButtonBuilder()
        .setCustomId(`eventManagement_updateTime_${event.id}`)
        .setLabel('Update Time')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('⏰')
    );
    
    // Row 2: Advanced management actions
    row2.addComponents(
      new ButtonBuilder()
        .setCustomId(`eventManagement_viewBets_${event.id}`)
        .setLabel('View All Bets')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('👁️')
    );
    
    // Only show reopen if the event is closed or locked
    if (event.status === 'Closed') {
      row2.addComponents(
        new ButtonBuilder()
          .setCustomId(`eventManagement_reopenEvent_${event.id}`)
          .setLabel('Reopen Event')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🔄')
      );
    }
    
    // Back button
    row2.addComponents(
      new ButtonBuilder()
        .setCustomId('eventManagement_manageEvents')
        .setLabel('Back to Event List')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⬅️')
    );
    
    // Send the event management options
    await interaction.editReply({
      embeds: [embed],
      components: [row1, row2],
      ephemeral: true
    });
    
    logger.info(`Event management details viewed for event "${event.name}" (ID: ${event.id}) by ${interaction.user.tag}`);
  } catch (error) {
    logger.error('Error in selectEventSelect function:', error);
    await interaction.editReply({
      content: 'An error occurred while loading the event details. Please try again.',
      components: [],
      ephemeral: true
    });
  }
}

// Handle edit event button
async function editEvent(interaction, client, params) {
  try {
    const eventId = params[0];
    
    // Fetch the event from the database
    const event = await models.Event.findByPk(eventId);
    
    if (!event) {
      return interaction.reply({
        content: 'The selected event could not be found. It may have been deleted.',
        ephemeral: true
      });
    }
    
    // Create the edit event modal
    const modal = new ModalBuilder()
      .setCustomId(`eventManagement_submitEditEvent_${eventId}`)
      .setTitle(`Edit Event: ${event.name}`);
    
    // Add text inputs for editable fields
    const eventNameInput = new TextInputBuilder()
      .setCustomId('eventName')
      .setLabel('Event Name')
      .setStyle(TextInputStyle.Short)
      .setMaxLength(100)
      .setRequired(true)
      .setValue(event.name);
    
    const eventDescriptionInput = new TextInputBuilder()
      .setCustomId('eventDescription')
      .setLabel('Description')
      .setStyle(TextInputStyle.Paragraph)
      .setMaxLength(1000)
      .setRequired(false)
      .setValue(event.description || '');
    
    const eventLocationInput = new TextInputBuilder()
      .setCustomId('eventLocation')
      .setLabel('Location')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setValue(event.location || '');
    
    const eventEntryFeeInput = new TextInputBuilder()
      .setCustomId('eventEntryFee')
      .setLabel('Entry Fee (numeric)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setValue(event.entryFee.toString());
    
    const eventImageUrlInput = new TextInputBuilder()
      .setCustomId('eventImageUrl')
      .setLabel('Event Image URL')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setValue(event.imageUrl || '');
    
    // Add inputs to action rows
    const firstActionRow = new ActionRowBuilder().addComponents(eventNameInput);
    const secondActionRow = new ActionRowBuilder().addComponents(eventDescriptionInput);
    const thirdActionRow = new ActionRowBuilder().addComponents(eventLocationInput);
    const fourthActionRow = new ActionRowBuilder().addComponents(eventEntryFeeInput);
    const fifthActionRow = new ActionRowBuilder().addComponents(eventImageUrlInput);
    
    // Add action rows to modal
    modal.addComponents(firstActionRow, secondActionRow, thirdActionRow, fourthActionRow, fifthActionRow);
    
    // Show the modal to the user
    await interaction.showModal(modal);
    
    logger.info(`Edit form opened for event "${event.name}" (ID: ${event.id}) by ${interaction.user.tag}`);
  } catch (error) {
    logger.error('Error in editEvent function:', error);
    await interaction.reply({
      content: 'An error occurred while opening the edit form. Please try again.',
      ephemeral: true
    });
  }
}

// Handle edit event modal submission
async function submitEditEventModalSubmit(interaction, client, params) {
  try {
    const eventId = params[0];
    
    // Fetch the event from the database
    const event = await models.Event.findByPk(eventId);
    
    if (!event) {
      return interaction.reply({
        content: 'The selected event could not be found. It may have been deleted.',
        ephemeral: true
      });
    }
    
    // Get values from the modal
    const newName = interaction.fields.getTextInputValue('eventName');
    const newDescription = interaction.fields.getTextInputValue('eventDescription') || null;
    const newLocation = interaction.fields.getTextInputValue('eventLocation') || null;
    const newEntryFeeStr = interaction.fields.getTextInputValue('eventEntryFee') || '0';
    const newImageUrl = interaction.fields.getTextInputValue('eventImageUrl') || null;
    
    // Validate input
    if (!newName.trim()) {
      return interaction.reply({
        content: 'Event name is required and cannot be empty.',
        ephemeral: true
      });
    }
    
    // Validate numeric fields
    if (isNaN(Number(newEntryFeeStr))) {
      return interaction.reply({
        content: 'Entry fee must be a valid number.',
        ephemeral: true
      });
    }
    
    // Validate URL if provided
    if (newImageUrl && !newImageUrl.match(/^https?:\/\/.*$/)) {
      return interaction.reply({
        content: 'Image URL must be a valid URL starting with http:// or https://.',
        ephemeral: true
      });
    }
    
    // Store old values for logging
    const oldValues = {
      name: event.name,
      description: event.description,
      location: event.location,
      entryFee: event.entryFee,
      imageUrl: event.imageUrl
    };
    
    // Update the event
    await event.update({
      name: newName,
      description: newDescription,
      location: newLocation,
      entryFee: Number(newEntryFeeStr),
      imageUrl: newImageUrl,
      lastModifiedBy: interaction.user.id
    });
    
    // Log the update
    await models.Log.create({
      category: 'AdminAction',
      level: 'info',
      message: `Event "${event.name}" (ID: ${event.id}) was edited`,
      userId: interaction.user.id,
      username: interaction.user.tag,
      eventId: event.id,
      details: {
        oldValues,
        newValues: {
          name: newName,
          description: newDescription,
          location: newLocation,
          entryFee: Number(newEntryFeeStr),
          imageUrl: newImageUrl
        }
      }
    });
    
    // Update the event announcement if it exists
    if (event.messageId && event.channelId) {
      try {
        const channel = await client.channels.fetch(event.channelId);
        
        if (channel) {
          const message = await channel.messages.fetch(event.messageId);
          
          if (message) {
            // Get configuration for timezone
            const config = await models.Configuration.findOne();
            
            // Create updated embed
            const updatedEmbed = createEventEmbed(event, config.timezone);
            
            // Update the message
            await message.edit({ embeds: [updatedEmbed] });
            
            logger.info(`Event announcement updated for "${event.name}" (ID: ${event.id}) in channel ${channel.name}`);
          }
        }
      } catch (error) {
        logger.error(`Error updating event announcement for event ID ${event.id}:`, error);
      }
    }
    
    await interaction.reply({
      content: `✅ Event "${event.name}" has been updated successfully!`,
      ephemeral: true
    });
    
    logger.info(`Event "${event.name}" (ID: ${event.id}) updated successfully by ${interaction.user.tag}`);
  } catch (error) {
    logger.error('Error in submitEditEventModalSubmit function:', error);
    await interaction.reply({
      content: 'An error occurred while updating the event. Please try again.',
      ephemeral: true
    });
  }
}

// Handle lock event button
async function lockEvent(interaction, client, params) {
  try {
    const eventId = params[0];
    
    // Fetch the event from the database
    const event = await models.Event.findByPk(eventId);
    
    if (!event) {
      return interaction.reply({
        content: 'The selected event could not be found. It may have been deleted.',
        ephemeral: true
      });
    }
    
    // Update the event status
    await event.update({
      status: 'Locked',
      lastModifiedBy: interaction.user.id
    });
    
    // Log the action
    await models.Log.create({
      category: 'AdminAction',
      level: 'info',
      message: `Event "${event.name}" (ID: ${event.id}) was locked for betting`,
      userId: interaction.user.id,
      username: interaction.user.tag,
      eventId: event.id
    });
    
    // Send confirmation
    await interaction.reply({
      content: `🔒 Betting for "${event.name}" has been locked. No further bets can be placed.`,
      ephemeral: true
    });
    
    // Update the event announcement if it exists
    if (event.messageId && event.channelId) {
      try {
        const channel = await client.channels.fetch(event.channelId);
        
        if (channel) {
          const message = await channel.messages.fetch(event.messageId);
          
          if (message) {
            // Get configuration for timezone
            const config = await models.Configuration.findOne();
            
            // Create updated embed
            const updatedEmbed = createEventEmbed(event, config.timezone);
            
            // Update the message
            await message.edit({ embeds: [updatedEmbed] });
            
            // Send a follow-up message about betting being locked
            await channel.send({
              embeds: [
                new EmbedBuilder()
                  .setColor('#FF9900')
                  .setTitle(`🔒 Betting Locked for "${event.name}"`)
                  .setDescription('Betting for this event has been locked by the management. No further bets can be placed.')
                  .setTimestamp()
              ]
            });
            
            logger.info(`Event betting locked announcement sent for "${event.name}" (ID: ${event.id}) in channel ${channel.name}`);
          }
        }
      } catch (error) {
        logger.error(`Error updating event announcement for event ID ${event.id}:`, error);
      }
    }
    
    logger.info(`Event "${event.name}" (ID: ${event.id}) locked by ${interaction.user.tag}`);
  } catch (error) {
    logger.error('Error in lockEvent function:', error);
    await interaction.reply({
      content: 'An error occurred while locking the event. Please try again.',
      ephemeral: true
    });
  }
}

// Handle unlock event button
async function unlockEvent(interaction, client, params) {
  try {
    const eventId = params[0];
    
    // Fetch the event from the database
    const event = await models.Event.findByPk(eventId);
    
    if (!event) {
      return interaction.reply({
        content: 'The selected event could not be found. It may have been deleted.',
        ephemeral: true
      });
    }
    
    // Update the event status
    await event.update({
      status: 'Active',
      lastModifiedBy: interaction.user.id
    });
    
    // Log the action
    await models.Log.create({
      category: 'AdminAction',
      level: 'info',
      message: `Event "${event.name}" (ID: ${event.id}) was unlocked for betting`,
      userId: interaction.user.id,
      username: interaction.user.tag,
      eventId: event.id
    });
    
    // Send confirmation
    await interaction.reply({
      content: `🔓 Betting for "${event.name}" has been unlocked. Bets can now be placed again.`,
      ephemeral: true
    });
    
    // Update the event announcement if it exists
    if (event.messageId && event.channelId) {
      try {
        const channel = await client.channels.fetch(event.channelId);
        
        if (channel) {
          const message = await channel.messages.fetch(event.messageId);
          
          if (message) {
            // Get configuration for timezone
            const config = await models.Configuration.findOne();
            
            // Create updated embed
            const updatedEmbed = createEventEmbed(event, config.timezone);
            
            // Update the message
            await message.edit({ embeds: [updatedEmbed] });
            
            // Send a follow-up message about betting being unlocked
            await channel.send({
              embeds: [
                new EmbedBuilder()
                  .setColor('#00FF00')
                  .setTitle(`🔓 Betting Unlocked for "${event.name}"`)
                  .setDescription('Betting for this event has been reopened by the management. You can now place bets again.')
                  .setTimestamp()
              ]
            });
            
            logger.info(`Event betting unlocked announcement sent for "${event.name}" (ID: ${event.id}) in channel ${channel.name}`);
          }
        }
      } catch (error) {
        logger.error(`Error updating event announcement for event ID ${event.id}:`, error);
      }
    }
    
    logger.info(`Event "${event.name}" (ID: ${event.id}) unlocked by ${interaction.user.tag}`);
  } catch (error) {
    logger.error('Error in unlockEvent function:', error);
    await interaction.reply({
      content: 'An error occurred while unlocking the event. Please try again.',
      ephemeral: true
    });
  }
}

// Handle pause event button
async function pauseEvent(interaction, client, params) {
  try {
    const eventId = params[0];
    
    // Fetch the event from the database
    const event = await models.Event.findByPk(eventId);
    
    if (!event) {
      return interaction.reply({
        content: 'The selected event could not be found. It may have been deleted.',
        ephemeral: true
      });
    }
    
    // Update the event status
    await event.update({
      status: 'Paused',
      lastModifiedBy: interaction.user.id
    });
    
    // Log the action
    await models.Log.create({
      category: 'AdminAction',
      level: 'info',
      message: `Event "${event.name}" (ID: ${event.id}) was paused`,
      userId: interaction.user.id,
      username: interaction.user.tag,
      eventId: event.id
    });
    
    // Send confirmation
    await interaction.reply({
      content: `⏸️ Event "${event.name}" has been paused. The pause announcement has been sent.`,
      ephemeral: true
    });
    
    // Update the event announcement if it exists
    if (event.messageId && event.channelId) {
      try {
        const channel = await client.channels.fetch(event.channelId);
        
        if (channel) {
          const message = await channel.messages.fetch(event.messageId);
          
          if (message) {
            // Get configuration for timezone
            const config = await models.Configuration.findOne();
            
            // Create updated embed
            const updatedEmbed = createEventEmbed(event, config.timezone);
            
            // Update the message
            await message.edit({ embeds: [updatedEmbed] });
            
            // Send the pause announcement as specified in the blueprint
            await channel.send({
              embeds: [
                new EmbedBuilder()
                  .setColor('#FF0000')
                  .setTitle(`⏸️ Event Paused: "${event.name}"`)
                  .setDescription('Hello everyone, due to unforeseen circumstances, the management has decided to temporarily withdraw this event. We will update you as soon as we have more details. Thank you for your patience!')
                  .setTimestamp()
              ]
            });
            
            logger.info(`Event pause announcement sent for "${event.name}" (ID: ${event.id}) in channel ${channel.name}`);
          }
        }
      } catch (error) {
        logger.error(`Error updating event announcement for event ID ${event.id}:`, error);
      }
    }
    
    logger.info(`Event "${event.name}" (ID: ${event.id}) paused by ${interaction.user.tag}`);
  } catch (error) {
    logger.error('Error in pauseEvent function:', error);
    await interaction.reply({
      content: 'An error occurred while pausing the event. Please try again.',
      ephemeral: true
    });
  }
}

// Handle resume event button
async function resumeEvent(interaction, client, params) {
  try {
    const eventId = params[0];
    
    // Fetch the event from the database
    const event = await models.Event.findByPk(eventId);
    
    if (!event) {
      return interaction.reply({
        content: 'The selected event could not be found. It may have been deleted.',
        ephemeral: true
      });
    }
    
    // Update the event status
    await event.update({
      status: 'Active',
      lastModifiedBy: interaction.user.id
    });
    
    // Log the action
    await models.Log.create({
      category: 'AdminAction',
      level: 'info',
      message: `Event "${event.name}" (ID: ${event.id}) was resumed`,
      userId: interaction.user.id,
      username: interaction.user.tag,
      eventId: event.id
    });
    
    // Send confirmation
    await interaction.reply({
      content: `▶️ Event "${event.name}" has been resumed. The resume announcement has been sent.`,
      ephemeral: true
    });
    
    // Update the event announcement if it exists
    if (event.messageId && event.channelId) {
      try {
        const channel = await client.channels.fetch(event.channelId);
        
        if (channel) {
          const message = await channel.messages.fetch(event.messageId);
          
          if (message) {
            // Get configuration for timezone
            const config = await models.Configuration.findOne();
            
            // Create updated embed
            const updatedEmbed = createEventEmbed(event, config.timezone);
            
            // Update the message
            await message.edit({ embeds: [updatedEmbed] });
            
            // Send the resume announcement as specified in the blueprint
            await channel.send({
              embeds: [
                new EmbedBuilder()
                  .setColor('#00FF00')
                  .setTitle(`✅ Event Resumed: "${event.name}"`)
                  .setDescription(`✅ Betting for "${event.name}" has resumed!`)
                  .setTimestamp()
              ]
            });
            
            logger.info(`Event resume announcement sent for "${event.name}" (ID: ${event.id}) in channel ${channel.name}`);
          }
        }
      } catch (error) {
        logger.error(`Error updating event announcement for event ID ${event.id}:`, error);
      }
    }
    
    logger.info(`Event "${event.name}" (ID: ${event.id}) resumed by ${interaction.user.tag}`);
  } catch (error) {
    logger.error('Error in resumeEvent function:', error);
    await interaction.reply({
      content: 'An error occurred while resuming the event. Please try again.',
      ephemeral: true
    });
  }
}

// Handle update time button
async function updateTime(interaction, client, params) {
  try {
    const eventId = params[0];
    
    // Fetch the event from the database
    const event = await models.Event.findByPk(eventId);
    
    if (!event) {
      return interaction.reply({
        content: 'The selected event could not be found. It may have been deleted.',
        ephemeral: true
      });
    }
    
    // Get the current configuration to determine timezone
    const config = await models.Configuration.findOne();
    const timezone = config.timezone || 'UTC';
    
    // Create a current date string if scheduleDate exists
    let currentDate = '';
    let currentTime = '';
    
    if (event.scheduleDate) {
      const zonedDateTime = utcToZonedTime(event.scheduleDate, timezone);
      currentDate = format(zonedDateTime, 'yyyy-MM-dd');
      currentTime = format(zonedDateTime, 'HH:mm');
    }
    
    // Create the date time modal
    const modal = new ModalBuilder()
      .setCustomId(`eventManagement_submitUpdateTime_${eventId}`)
      .setTitle(`Update Time: ${event.name}`);
    
    // Add text inputs for date and time
    const dateInput = new TextInputBuilder()
      .setCustomId('eventDate')
      .setLabel(`Date (YYYY-MM-DD, timezone: ${timezone})`)
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g., 2025-03-30')
      .setRequired(true)
      .setValue(currentDate);
    
    const timeInput = new TextInputBuilder()
      .setCustomId('eventTime')
      .setLabel(`Time (HH:MM, 24-hour format, timezone: ${timezone})`)
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g., 14:30')
      .setRequired(true)
      .setValue(currentTime);
    
    // Add inputs to action rows
    const firstActionRow = new ActionRowBuilder().addComponents(dateInput);
    const secondActionRow = new ActionRowBuilder().addComponents(timeInput);
    
    // Add action rows to modal
    modal.addComponents(firstActionRow, secondActionRow);
    
    // Show the modal to the user
    await interaction.showModal(modal);
    
    logger.info(`Time update form opened for event "${event.name}" (ID: ${event.id}) by ${interaction.user.tag}`);
  } catch (error) {
    logger.error('Error in updateTime function:', error);
    await interaction.reply({
      content: 'An error occurred while opening the time update form. Please try again.',
      ephemeral: true
    });
  }
}

// Handle update time modal submission
async function submitUpdateTimeModalSubmit(interaction, client, params) {
  try {
    const eventId = params[0];
    
    // Fetch the event from the database
    const event = await models.Event.findByPk(eventId);
    
    if (!event) {
      return interaction.reply({
        content: 'The selected event could not be found. It may have been deleted.',
        ephemeral: true
      });
    }
    
    // Get values from the modal
    const dateStr = interaction.fields.getTextInputValue('eventDate');
    const timeStr = interaction.fields.getTextInputValue('eventTime');
    
    // Get the current configuration to determine timezone
    const config = await models.Configuration.findOne();
    const timezone = config.timezone || 'UTC';
    
    // Validate and parse the date & time
    try {
      if (!dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        throw new Error('Invalid date format. Please use YYYY-MM-DD format.');
      }
      
      if (!timeStr.match(/^\d{2}:\d{2}$/)) {
        throw new Error('Invalid time format. Please use HH:MM format (24-hour).');
      }
      
      // Combine date and time
      const dateTimeStr = `${dateStr}T${timeStr}:00`;
      const dateTime = parseISO(dateTimeStr);
      
      // Convert to UTC for storage
      const utcDateTime = zonedTimeToUtc(dateTime, timezone);
      
      // Store the old date for logging
      const oldDateTime = event.scheduleDate ? new Date(event.scheduleDate) : null;
      
      // Update the event with the new schedule date
      await event.update({
        scheduleDate: utcDateTime,
        lastModifiedBy: interaction.user.id
      });
      
      // Log the action
      await models.Log.create({
        category: 'AdminAction',
        level: 'info',
        message: `Event "${event.name}" (ID: ${event.id}) time was updated`,
        userId: interaction.user.id,
        username: interaction.user.tag,
        eventId: event.id,
        details: {
          oldDateTime: oldDateTime ? oldDateTime.toISOString() : null,
          newDateTime: utcDateTime.toISOString(),
          timezone
        }
      });
      
      // Format dates for display
      const formattedNewTime = format(utcToZonedTime(utcDateTime, timezone), 'MMMM d, yyyy, HH:mm');
      
      // Send confirmation
      await interaction.reply({
        content: `⏰ Time for event "${event.name}" has been updated to ${formattedNewTime} (${timezone}).`,
        ephemeral: true
      });
      
      // Update the event announcement if it exists
      if (event.messageId && event.channelId) {
        try {
          const channel = await client.channels.fetch(event.channelId);
          
          if (channel) {
            const message = await channel.messages.fetch(event.messageId);
            
            if (message) {
              // Create updated embed
              const updatedEmbed = createEventEmbed(event, timezone);
              
              // Update the message
              await message.edit({ embeds: [updatedEmbed] });
              
              // Send the time update announcement as specified in the blueprint
              let announcementEmbed;
              
              if (event.status === 'Paused') {
                announcementEmbed = new EmbedBuilder()
                  .setColor('#FFCC00')
                  .setTitle(`⏰ Event Rescheduled: "${event.name}"`)
                  .setDescription(`⏰ "${event.name}" (currently paused) has been rescheduled to ${formattedNewTime} (${timezone}). Stay tuned for updates!`)
                  .setTimestamp();
              } else {
                announcementEmbed = new EmbedBuilder()
                  .setColor('#00CCFF')
                  .setTitle(`⏰ Event Rescheduled: "${event.name}"`)
                  .setDescription(`⏰ "${event.name}" has been rescheduled! New time: ${formattedNewTime} (${timezone}). All bets remain valid. Thank you for your understanding!`)
                  .setTimestamp();
              }
              
              await channel.send({ embeds: [announcementEmbed] });
              
              logger.info(`Event time update announcement sent for "${event.name}" (ID: ${event.id}) in channel ${channel.name}`);
            }
          }
        } catch (error) {
          logger.error(`Error updating event announcement for event ID ${event.id}:`, error);
        }
      }
      
      logger.info(`Event "${event.name}" (ID: ${event.id}) time updated by ${interaction.user.tag}`);
    } catch (error) {
      await interaction.reply({
        content: `Error with date/time: ${error.message}`,
        ephemeral: true
      });
    }
  } catch (error) {
    logger.error('Error in submitUpdateTimeModalSubmit function:', error);
    await interaction.reply({
      content: 'An error occurred while updating the event time. Please try again.',
      ephemeral: true
    });
  }
}

// Handle view bets button
async function viewBets(interaction, client, params) {
  try {
    await interaction.deferReply({ ephemeral: true });
    
    const eventId = params[0];
    
    // Fetch the event from the database
    const event = await models.Event.findByPk(eventId);
    
    if (!event) {
      return interaction.editReply({
        content: 'The selected event could not be found. It may have been deleted.',
        ephemeral: true
      });
    }
    
    // Fetch all bets for this event
    const bets = await models.Bet.findAll({
      where: { eventId: event.id },
      order: [['timestamp', 'DESC']]
    });
    
    if (bets.length === 0) {
      return interaction.editReply({
        content: `No bets have been placed for the event "${event.name}" yet.`,
        ephemeral: true
      });
    }
    
    // Get the configuration for suspicious bet threshold
    const config = await models.Configuration.findOne();
    const suspiciousBetThreshold = config.suspiciousBetThreshold || 5000;
    
    // Create an embed to display the bets
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle(`Bets for Event: ${event.name}`)
      .setDescription(`Total bets: ${bets.length} | Total amount: $${event.totalAmount}`)
      .setFooter({ text: `Event ID: ${event.id}` })
      .setTimestamp();
    
    // Group bets by choice
    const betsByChoice = {};
    let suspiciousBets = 0;
    
    for (const bet of bets) {
      if (!betsByChoice[bet.choice]) {
        betsByChoice[bet.choice] = {
          count: 0,
          totalAmount: 0,
          bets: []
        };
      }
      
      betsByChoice[bet.choice].count++;
      betsByChoice[bet.choice].totalAmount += bet.amount;
      betsByChoice[bet.choice].bets.push(bet);
      
      // Check for suspicious bets (exceeding threshold)
      if (bet.amount >= suspiciousBetThreshold) {
        suspiciousBets++;
      }
    }
    
    // Add fields for each choice
    for (const choice in betsByChoice) {
      const choiceData = betsByChoice[choice];
      const betPercentage = ((choiceData.totalAmount / event.totalAmount) * 100).toFixed(1);
      
      embed.addFields({
        name: `${choice} (${choiceData.count} bets, $${choiceData.totalAmount})`,
        value: `${betPercentage}% of total bets`
      });
    }
    
    // Add suspicious bet alert if any are found
    if (suspiciousBets > 0) {
      embed.addFields({
        name: '⚠️ SUSPICIOUS BET ALERT',
        value: `Found ${suspiciousBets} bets exceeding the threshold of $${suspiciousBetThreshold}`
      });
    }
    
    // Create pages of bet details
    const betsPerPage = 10;
    const pages = [];
    
    for (let i = 0; i < bets.length; i += betsPerPage) {
      const pageBets = bets.slice(i, i + betsPerPage);
      
      let pageContent = '';
      
      for (const bet of pageBets) {
        const isSuspicious = bet.amount >= suspiciousBetThreshold ? '⚠️ ' : '';
        const formattedDate = format(new Date(bet.timestamp), 'MMM d, yyyy HH:mm:ss');
        
        pageContent += `${isSuspicious}**${bet.username}**: $${bet.amount} on "${bet.choice}" (${formattedDate})\n`;
      }
      
      pages.push(pageContent);
    }
    
    // If only one page of bets, add it to the embed
    if (pages.length === 1) {
      embed.addFields({
        name: 'Recent Bets',
        value: pages[0]
      });
      
      await interaction.editReply({
        embeds: [embed],
        ephemeral: true
      });
      
      return;
    }
    
    // If multiple pages, create navigation buttons
    let currentPage = 0;
    
    const paginatedEmbed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle(`Bets for Event: ${event.name} (Page ${currentPage + 1}/${pages.length})`)
      .setDescription(`Total bets: ${bets.length} | Total amount: $${event.totalAmount}`)
      .addFields({
        name: 'Bets',
        value: pages[currentPage]
      })
      .setFooter({ text: `Event ID: ${event.id}` })
      .setTimestamp();
    
    // Create navigation buttons
    const navigationRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('eventManagement_prevPage')
          .setLabel('Previous')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('⬅️')
          .setDisabled(currentPage === 0),
        new ButtonBuilder()
          .setCustomId('eventManagement_nextPage')
          .setLabel('Next')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('➡️')
          .setDisabled(currentPage === pages.length - 1),
        new ButtonBuilder()
          .setCustomId(`eventManagement_selectEvent_${eventId}`)
          .setLabel('Back to Event')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🔙')
      );
    
    const response = await interaction.editReply({
      embeds: [paginatedEmbed],
      components: [navigationRow],
      ephemeral: true
    });
    
    // Create a collector to handle navigation button clicks
    const filter = i => i.user.id === interaction.user.id && 
                     (i.customId === 'eventManagement_prevPage' || 
                      i.customId === 'eventManagement_nextPage' || 
                      i.customId === `eventManagement_selectEvent_${eventId}`);
    
    const collector = response.createMessageComponentCollector({ 
      filter, 
      time: 300000, // 5 minutes
      componentType: ComponentType.Button
    });
    
    collector.on('collect', async i => {
      // Handle going back to event details
      if (i.customId === `eventManagement_selectEvent_${eventId}`) {
        await selectEventSelect(i, client);
        collector.stop();
        return;
      }
      
      // Handle navigation
      if (i.customId === 'eventManagement_prevPage') {
        currentPage = Math.max(0, currentPage - 1);
      } else if (i.customId === 'eventManagement_nextPage') {
        currentPage = Math.min(pages.length - 1, currentPage + 1);
      }
      
      // Update the embed
      paginatedEmbed
        .setTitle(`Bets for Event: ${event.name} (Page ${currentPage + 1}/${pages.length})`)
        .spliceFields(0, 1, {
          name: 'Bets',
          value: pages[currentPage]
        });
      
      // Update button states
      navigationRow.components[0].setDisabled(currentPage === 0);
      navigationRow.components[1].setDisabled(currentPage === pages.length - 1);
      
      await i.update({
        embeds: [paginatedEmbed],
        components: [navigationRow]
      });
    });
    
    collector.on('end', () => {
      // Remove navigation buttons when time expires
      if (!interaction.ephemeral) {
        navigationRow.components.forEach(button => button.setDisabled(true));
        interaction.editReply({ components: [navigationRow] }).catch(error => {
          logger.error('Error disabling buttons after collection end:', error);
        });
      }
    });
    
    logger.info(`Bet list viewed for event "${event.name}" (ID: ${event.id}) by ${interaction.user.tag}`);
  } catch (error) {
    logger.error('Error in viewBets function:', error);
    if (interaction.deferred) {
      await interaction.editReply({
        content: 'An error occurred while loading the bets. Please try again.',
        ephemeral: true
      });
    } else {
      await interaction.reply({
        content: 'An error occurred while loading the bets. Please try again.',
        ephemeral: true
      });
    }
  }
}

// Handle reopen event button
async function reopenEvent(interaction, client, params) {
  try {
    const eventId = params[0];
    
    // Fetch the event from the database
    const event = await models.Event.findByPk(eventId);
    
    if (!event) {
      return interaction.reply({
        content: 'The selected event could not be found. It may have been deleted.',
        ephemeral: true
      });
    }
    
    // Create a modal to get the reason for reopening
    const modal = new ModalBuilder()
      .setCustomId(`eventManagement_submitReopenEvent_${eventId}`)
      .setTitle(`Reopen Event: ${event.name}`);
    
    // Add text input for the reason
    const reasonInput = new TextInputBuilder()
      .setCustomId('reopenReason')
      .setLabel('Reason for reopening (will be announced)')
      .setStyle(TextInputStyle.Paragraph)
      .setMaxLength(1000)
      .setRequired(true);
    
    // Add input to action row
    const actionRow = new ActionRowBuilder().addComponents(reasonInput);
    
    // Add action row to modal
    modal.addComponents(actionRow);
    
    // Show the modal to the user
    await interaction.showModal(modal);
    
    logger.info(`Reopen form opened for event "${event.name}" (ID: ${event.id}) by ${interaction.user.tag}`);
  } catch (error) {
    logger.error('Error in reopenEvent function:', error);
    await interaction.reply({
      content: 'An error occurred while opening the reopen form. Please try again.',
      ephemeral: true
    });
  }
}

// Handle reopen event modal submission
async function submitReopenEventModalSubmit(interaction, client, params) {
  try {
    const eventId = params[0];
    
    // Fetch the event from the database
    const event = await models.Event.findByPk(eventId);
    
    if (!event) {
      return interaction.reply({
        content: 'The selected event could not be found. It may have been deleted.',
        ephemeral: true
      });
    }
    
    // Get the reason from the modal
    const reason = interaction.fields.getTextInputValue('reopenReason');
    
    // Update the event status
    await event.update({
      status: 'Active',
      lastModifiedBy: interaction.user.id
    });
    
    // Log the action
    await models.Log.create({
      category: 'AdminAction',
      level: 'info',
      message: `Event "${event.name}" (ID: ${event.id}) was reopened`,
      userId: interaction.user.id,
      username: interaction.user.tag,
      eventId: event.id,
      details: {
        reason
      }
    });
    
    // Send confirmation
    await interaction.reply({
      content: `🔄 Event "${event.name}" has been reopened. Betting is now active again.`,
      ephemeral: true
    });
    
    // Update the event announcement if it exists
    if (event.messageId && event.channelId) {
      try {
        const channel = await client.channels.fetch(event.channelId);
        
        if (channel) {
          const message = await channel.messages.fetch(event.messageId);
          
          if (message) {
            // Get configuration for timezone
            const config = await models.Configuration.findOne();
            
            // Create updated embed
            const updatedEmbed = createEventEmbed(event, config.timezone);
            
            // Update the message
            await message.edit({ embeds: [updatedEmbed] });
            
            // Send a reopen announcement
            await channel.send({
              embeds: [
                new EmbedBuilder()
                  .setColor('#00FF00')
                  .setTitle(`🔄 Event Reopened: "${event.name}"`)
                  .setDescription(`This event has been reopened by management.\n\n**Reason:** ${reason}\n\nBetting is now active again.`)
                  .setTimestamp()
              ]
            });
            
            logger.info(`Event reopen announcement sent for "${event.name}" (ID: ${event.id}) in channel ${channel.name}`);
          }
        }
      } catch (error) {
        logger.error(`Error updating event announcement for event ID ${event.id}:`, error);
      }
    }
    
    logger.info(`Event "${event.name}" (ID: ${event.id}) reopened by ${interaction.user.tag}`);
  } catch (error) {
    logger.error('Error in submitReopenEventModalSubmit function:', error);
    await interaction.reply({
      content: 'An error occurred while reopening the event. Please try again.',
      ephemeral: true
    });
  }
}

// Handle announcements & event scheduling button
async function announceEvent(interaction, client) {
  try {
    await interaction.deferReply({ ephemeral: true });
    
    // Get all active events
    const events = await models.Event.findAll({
      where: {
        status: {
          [Op.ne]: 'Closed'
        }
      },
      order: [['createdAt', 'DESC']]
    });
    
    if (events.length === 0) {
      return interaction.editReply({
        content: 'There are no active events to announce at this time.',
        ephemeral: true
      });
    }
    
    // Get configuration
    const config = await models.Configuration.findOne();
    const channelId = config.bettingAnnouncementsChannelId;
    
    if (!channelId) {
      return interaction.editReply({
        content: 'No betting announcements channel is configured. Please configure one in the Configuration Settings.',
        ephemeral: true
      });
    }
    
    // Create the announcement options embed
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Announcements & Event Scheduling')
      .setDescription('Select an action to perform:')
      .addFields(
        { name: 'Post Event Announcement', value: 'Post or repost an event announcement to the betting channel.' },
        { name: 'Manual Actions', value: 'Manually announce event status changes.' }
      );
    
    // Create action buttons
    const row1 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('eventManagement_postAnnouncement')
          .setLabel('Post Event Announcement')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📢'),
        new ButtonBuilder()
          .setCustomId('eventManagement_pauseAnnouncement')
          .setLabel('Send Pause Announcement')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('⏸️')
      );
    
    // Send the options
    await interaction.editReply({
      embeds: [embed],
      components: [row1],
      ephemeral: true
    });
    
    logger.info(`Announcements & Event Scheduling panel opened by ${interaction.user.tag}`);
  } catch (error) {
    logger.error('Error in announceEvent function:', error);
    if (interaction.deferred) {
      await interaction.editReply({
        content: 'An error occurred while loading the announcement options. Please try again.',
        ephemeral: true
      });
    } else {
      await interaction.reply({
        content: 'An error occurred while loading the announcement options. Please try again.',
        ephemeral: true
      });
    }
  }
}

// Handle post announcement button
async function postAnnouncement(interaction, client) {
  try {
    await interaction.deferUpdate();
    
    // Get all active events
    const events = await models.Event.findAll({
      where: {
        status: {
          [Op.ne]: 'Closed'
        }
      },
      order: [['createdAt', 'DESC']]
    });
    
    if (events.length === 0) {
      return interaction.editReply({
        content: 'There are no active events to announce at this time.',
        ephemeral: true
      });
    }
    
    // Create the event selection embed
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Post Event Announcement')
      .setDescription('Select an event to announce:');
    
    // Create a select menu for the events
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('eventManagement_selectAnnounceEvent')
      .setPlaceholder('Select an event to announce...');
    
    // Add options for each event
    for (const event of events) {
      selectMenu.addOptions({
        label: event.name,
        description: `${event.type} | ${event.status} | ${event.totalBets} bets`,
        value: event.id.toString()
      });
    }
    
    const row = new ActionRowBuilder().addComponents(selectMenu);
    
    // Send the event selection message
    await interaction.editReply({
      embeds: [embed],
      components: [row],
      ephemeral: true
    });
    
    logger.info(`Event announcement selection opened by ${interaction.user.tag}`);
  } catch (error) {
    logger.error('Error in postAnnouncement function:', error);
    await interaction.editReply({
      content: 'An error occurred while loading the events for announcement. Please try again.',
      ephemeral: true
    });
  }
}

// Handle select event for announcement
async function selectAnnounceEventSelect(interaction, client) {
  try {
    await interaction.deferUpdate();
    
    // Get the selected event ID
    const eventId = interaction.values[0];
    
    // Fetch the event from the database
    const event = await models.Event.findByPk(eventId);
    
    if (!event) {
      return interaction.editReply({
        content: 'The selected event could not be found. It may have been deleted.',
        components: [],
        ephemeral: true
      });
    }
    
    // Get configuration
    const config = await models.Configuration.findOne();
    const channelId = config.bettingAnnouncementsChannelId;
    
    if (!channelId) {
      return interaction.editReply({
        content: 'No betting announcements channel is configured. Please configure one in the Configuration Settings.',
        components: [],
        ephemeral: true
      });
    }
    
    try {
      // Get the channel
      const channel = await client.channels.fetch(channelId);
      
      if (!channel) {
        return interaction.editReply({
          content: 'Could not find the configured betting announcements channel. Please check the channel ID in Configuration Settings.',
          components: [],
          ephemeral: true
        });
      }
      
      // Create the event embed
      const eventEmbed = createEventEmbed(event, config.timezone);
      
      // Send the announcement
      const message = await channel.send({ embeds: [eventEmbed] });
      
      // Update the event with the new message ID and channel ID
      await event.update({
        messageId: message.id,
        channelId: channelId,
        lastModifiedBy: interaction.user.id
      });
      
      // Log the action
      await models.Log.create({
        category: 'AdminAction',
        level: 'info',
        message: `Event "${event.name}" (ID: ${event.id}) announcement posted`,
        userId: interaction.user.id,
        username: interaction.user.tag,
        eventId: event.id,
        details: {
          channelId,
          messageId: message.id
        }
      });
      
      await interaction.editReply({
        content: `✅ Announcement for event "${event.name}" has been posted to <#${channelId}>.`,
        components: [],
        ephemeral: true
      });
      
      logger.info(`Event announcement posted for "${event.name}" (ID: ${event.id}) in channel ${channel.name} by ${interaction.user.tag}`);
    } catch (error) {
      logger.error(`Error posting event announcement for event ID ${event.id}:`, error);
      await interaction.editReply({
        content: `Error posting announcement: ${error.message}`,
        components: [],
        ephemeral: true
      });
    }
  } catch (error) {
    logger.error('Error in selectAnnounceEventSelect function:', error);
    await interaction.editReply({
      content: 'An error occurred while posting the announcement. Please try again.',
      components: [],
      ephemeral: true
    });
  }
}

// Handle pause announcement button
async function pauseAnnouncement(interaction, client) {
  try {
    await interaction.deferUpdate();
    
    // Get all active events
    const events = await models.Event.findAll({
      where: {
        status: {
          [Op.ne]: 'Closed'
        }
      },
      order: [['createdAt', 'DESC']]
    });
    
    if (events.length === 0) {
      return interaction.editReply({
        content: 'There are no active events to announce at this time.',
        ephemeral: true
      });
    }
    
    // Create the event selection embed
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Send Pause Announcement')
      .setDescription('Select an event to send a pause announcement for:');
    
    // Create a select menu for the events
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('eventManagement_selectPauseEvent')
      .setPlaceholder('Select an event...');
    
    // Add options for each event
    for (const event of events) {
      selectMenu.addOptions({
        label: event.name,
        description: `${event.type} | ${event.status} | ${event.totalBets} bets`,
        value: event.id.toString()
      });
    }
    
    const row = new ActionRowBuilder().addComponents(selectMenu);
    
    // Send the event selection message
    await interaction.editReply({
      embeds: [embed],
      components: [row],
      ephemeral: true
    });
    
    logger.info(`Pause announcement selection opened by ${interaction.user.tag}`);
  } catch (error) {
    logger.error('Error in pauseAnnouncement function:', error);
    await interaction.editReply({
      content: 'An error occurred while loading the events for pause announcement. Please try again.',
      ephemeral: true
    });
  }
}

// Handle select event for pause announcement
async function selectPauseEventSelect(interaction, client) {
  try {
    await interaction.deferUpdate();
    
    // Get the selected event ID
    const eventId = interaction.values[0];
    
    // Fetch the event from the database
    const event = await models.Event.findByPk(eventId);
    
    if (!event) {
      return interaction.editReply({
        content: 'The selected event could not be found. It may have been deleted.',
        components: [],
        ephemeral: true
      });
    }
    
    // Get configuration
    const config = await models.Configuration.findOne();
    const channelId = config.bettingAnnouncementsChannelId;
    
    if (!channelId) {
      return interaction.editReply({
        content: 'No betting announcements channel is configured. Please configure one in the Configuration Settings.',
        components: [],
        ephemeral: true
      });
    }
    
    try {
      // Get the channel
      const channel = await client.channels.fetch(channelId);
      
      if (!channel) {
        return interaction.editReply({
          content: 'Could not find the configured betting announcements channel. Please check the channel ID in Configuration Settings.',
          components: [],
          ephemeral: true
        });
      }
      
      // Update the event status to Paused
      await event.update({
        status: 'Paused',
        lastModifiedBy: interaction.user.id
      });
      
      // Create the pause announcement embed
      const pauseEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle(`⏸️ Event Paused: "${event.name}"`)
        .setDescription('Hello everyone, due to unforeseen circumstances, the management has decided to temporarily withdraw this event. We will update you as soon as we have more details. Thank you for your patience!')
        .setTimestamp();
      
      // Send the announcement
      const message = await channel.send({ embeds: [pauseEmbed] });
      
      // Log the action
      await models.Log.create({
        category: 'AdminAction',
        level: 'info',
        message: `Event "${event.name}" (ID: ${event.id}) paused with announcement`,
        userId: interaction.user.id,
        username: interaction.user.tag,
        eventId: event.id,
        details: {
          channelId,
          messageId: message.id
        }
      });
      
      // Update the event embed if it exists
      if (event.messageId) {
        try {
          const eventMessage = await channel.messages.fetch(event.messageId);
          
          if (eventMessage) {
            // Create updated embed
            const updatedEmbed = createEventEmbed(event, config.timezone);
            
            // Update the message
            await eventMessage.edit({ embeds: [updatedEmbed] });
          }
        } catch (error) {
          logger.error(`Error updating event message for event ID ${event.id}:`, error);
        }
      }
      
      await interaction.editReply({
        content: `✅ Event "${event.name}" has been paused and the announcement has been sent to <#${channelId}>.`,
        components: [],
        ephemeral: true
      });
      
      logger.info(`Event pause announcement sent for "${event.name}" (ID: ${event.id}) in channel ${channel.name} by ${interaction.user.tag}`);
    } catch (error) {
      logger.error(`Error sending pause announcement for event ID ${event.id}:`, error);
      await interaction.editReply({
        content: `Error sending pause announcement: ${error.message}`,
        components: [],
        ephemeral: true
      });
    }
  } catch (error) {
    logger.error('Error in selectPauseEventSelect function:', error);
    await interaction.editReply({
      content: 'An error occurred while sending the pause announcement. Please try again.',
      components: [],
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
    // Extract event ID if present in the button ID (format: "action_eventId")
    let params = {};
    if (buttonId.includes('_')) {
      const [action, eventId] = buttonId.split('_');
      params = { eventId };
      buttonId = action; // Set buttonId to just the action part
    }

    switch (buttonId) {
      case 'manageEvents':
        await manageEvents(interaction, client);
        break;
      case 'editEvent':
        await editEvent(interaction, client, params);
        break;
      case 'lockEvent':
        await lockEvent(interaction, client, params);
        break;
      case 'unlockEvent':
        await unlockEvent(interaction, client, params);
        break;
      case 'pauseEvent':
        await pauseEvent(interaction, client, params);
        break;
      case 'resumeEvent':
        await resumeEvent(interaction, client, params);
        break;
      case 'updateTime':
        await updateTime(interaction, client, params);
        break;
      case 'viewBets':
        await viewBets(interaction, client, params);
        break;
      case 'reopenEvent':
        await reopenEvent(interaction, client, params);
        break;
      case 'announceEvent':
        await announceEvent(interaction, client);
        break;
      case 'postAnnouncement':
        await postAnnouncement(interaction, client);
        break;
      case 'pauseAnnouncement':
        await pauseAnnouncement(interaction, client);
        break;
      default:
        await interaction.reply({
          content: `Unknown button action: ${buttonId}`,
          ephemeral: true
        });
    }
  } catch (error) {
    console.error(`Error handling button ${buttonId}:`, error);
    // Check if the interaction has already been replied to or deferred
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: 'There was an error handling this button interaction.',
        ephemeral: true
      });
    } else {
      await interaction.reply({
        content: 'There was an error handling this button interaction.',
        ephemeral: true
      });
    }
  }
}

/**
 * Handle select menu interactions for this module
 * @param {string} selectId - The ID of the select menu
 * @param {Interaction} interaction - The interaction that triggered this
 * @param {Client} client - The Discord client instance
 */
async function handleSelect(selectId, interaction, client) {
  try {
    switch (selectId) {
      case 'selectEvent':
        await selectEventSelect(interaction, client);
        break;
      case 'selectAnnounceEvent':
        await selectAnnounceEventSelect(interaction, client);
        break;
      case 'selectPauseEvent':
        await selectPauseEventSelect(interaction, client);
        break;
      default:
        await interaction.reply({
          content: `Unknown select menu action: ${selectId}`,
          ephemeral: true
        });
    }
  } catch (error) {
    console.error(`Error handling select menu ${selectId}:`, error);
    // Check if the interaction has already been replied to or deferred
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: 'There was an error handling this select menu interaction.',
        ephemeral: true
      });
    } else {
      await interaction.reply({
        content: 'There was an error handling this select menu interaction.',
        ephemeral: true
      });
    }
  }
}

/**
 * Handle modal submit interactions for this module
 * @param {string} modalId - The ID of the modal
 * @param {Interaction} interaction - The interaction that triggered this
 * @param {Client} client - The Discord client instance
 */
async function handleModalSubmit(modalId, interaction, client) {
  try {
    // Extract event ID if present in the modal ID (format: "action_eventId")
    let params = {};
    if (modalId.includes('_')) {
      const [action, eventId] = modalId.split('_');
      params = { eventId };
      modalId = action; // Set modalId to just the action part
    }

    switch (modalId) {
      case 'submitEditEvent':
        await submitEditEventModalSubmit(interaction, client, params);
        break;
      case 'submitUpdateTime':
        await submitUpdateTimeModalSubmit(interaction, client, params);
        break;
      case 'submitReopenEvent':
        await submitReopenEventModalSubmit(interaction, client, params);
        break;
      default:
        await interaction.reply({
          content: `Unknown modal submission: ${modalId}`,
          ephemeral: true
        });
    }
  } catch (error) {
    console.error(`Error handling modal submit ${modalId}:`, error);
    // Check if the interaction has already been replied to or deferred
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: 'There was an error handling this modal submission.',
        ephemeral: true
      });
    } else {
      await interaction.reply({
        content: 'There was an error handling this modal submission.',
        ephemeral: true
      });
    }
  }
}

module.exports = {
  manageEvents,
  selectEventSelect,
  editEvent,
  submitEditEventModalSubmit,
  lockEvent,
  unlockEvent,
  pauseEvent,
  resumeEvent,
  updateTime,
  submitUpdateTimeModalSubmit,
  viewBets,
  reopenEvent,
  submitReopenEventModalSubmit,
  announceEvent,
  postAnnouncement,
  selectAnnounceEventSelect,
  pauseAnnouncement,
  selectPauseEventSelect,
  handleButton,
  handleSelect,
  handleModalSubmit
};
