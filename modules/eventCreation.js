// Event Creation Module for KrayStakes Discord Bot
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const { validateEventData } = require('../utils/validators');
const { formatDateTime, parseDate, parseTime } = require('../utils/timeUtils');
const { checkPermission } = require('../utils/permissions');
const logger = require('../utils/logger');
const config = require('../config');
const db = require('../database/dbInit');

// Main entry point for event creation
async function createEvent(interaction, client) {
  try {
    // Check permissions
    const hasPermission = await checkPermission(interaction.member, ['serverAdmin', 'admin', 'management']);
    
    if (!hasPermission) {
      return interaction.reply({
        content: 'You do not have permission to create events. This action requires Server Admin, Admin, or Management role.',
        ephemeral: true
      });
    }
    
    // Create event type selection embed
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Create New Betting Event')
      .setDescription('Please select the type of event you want to create:')
      .addFields(
        { name: '🥊 Boxing', value: 'For boxing matches and fighting events.' },
        { name: '🏎️ Racing', value: 'For races and competitions involving vehicles.' },
        { name: '🎯 Paintball', value: 'For paintball tournaments and shooting competitions.' },
        { name: '🛠️ Custom', value: 'For any other type of event not listed above.' }
      )
      .setFooter({ text: 'KrayStakes Event Creation' });
    
    // Create event type selection buttons
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('eventCreation_selectTypeBoxing')
          .setLabel('Boxing')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🥊'),
        new ButtonBuilder()
          .setCustomId('eventCreation_selectTypeRacing')
          .setLabel('Racing')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🏎️'),
        new ButtonBuilder()
          .setCustomId('eventCreation_selectTypePaintball')
          .setLabel('Paintball')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🎯'),
        new ButtonBuilder()
          .setCustomId('eventCreation_selectTypeCustom')
          .setLabel('Custom')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🛠️')
      );
    
    // Send the embed with buttons
    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true
    });
    
    logger.info(`Event creation started by ${interaction.user.tag}`);
  } catch (error) {
    logger.error('Error in createEvent function:', error);
    
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: 'An error occurred while starting event creation. This has been logged.',
        ephemeral: true
      });
    }
  }
}

// Generic function to handle event type selection
async function selectType(interaction, client, type) {
  try {
    // Create the basic info modal
    const modal = new ModalBuilder()
      .setCustomId(`eventCreation_submitBasicInfo_${type}`)
      .setTitle(`Create ${type} Event - Basic Info`);
    
    // Add inputs for basic information
    const nameInput = new TextInputBuilder()
      .setCustomId('eventName')
      .setLabel('Event Name (Required)')
      .setPlaceholder('Enter a name for your event (max 100 characters)')
      .setMaxLength(100)
      .setRequired(true)
      .setStyle(TextInputStyle.Short);
    
    const descriptionInput = new TextInputBuilder()
      .setCustomId('eventDescription')
      .setLabel('Description (Optional)')
      .setPlaceholder('Enter a description for your event (max 1000 characters)')
      .setMaxLength(1000)
      .setRequired(false)
      .setStyle(TextInputStyle.Paragraph);
    
    const locationInput = new TextInputBuilder()
      .setCustomId('eventLocation')
      .setLabel('Location (Optional)')
      .setPlaceholder('Enter the location for this event')
      .setMaxLength(100)
      .setRequired(false)
      .setStyle(TextInputStyle.Short);
    
    const entryFeeInput = new TextInputBuilder()
      .setCustomId('eventEntryFee')
      .setLabel('Entry Fee (Optional)')
      .setPlaceholder('Enter the entry fee amount (numeric value only)')
      .setMaxLength(10)
      .setRequired(false)
      .setStyle(TextInputStyle.Short);
    
    const imageUrlInput = new TextInputBuilder()
      .setCustomId('eventImageUrl')
      .setLabel('Event Image URL (Optional)')
      .setPlaceholder('Enter a valid URL for the event image')
      .setMaxLength(200)
      .setRequired(false)
      .setStyle(TextInputStyle.Short);
    
    // Add all inputs to the modal
    modal.addComponents(
      new ActionRowBuilder().addComponents(nameInput),
      new ActionRowBuilder().addComponents(descriptionInput),
      new ActionRowBuilder().addComponents(locationInput),
      new ActionRowBuilder().addComponents(entryFeeInput),
      new ActionRowBuilder().addComponents(imageUrlInput)
    );
    
    // Show the modal
    await interaction.showModal(modal);
    
    logger.debug(`${type} event type selected by ${interaction.user.tag}`);
  } catch (error) {
    logger.error(`Error in selectType (${type}) function:`, error);
    
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: `An error occurred while setting up the ${type} event form. This has been logged.`,
        ephemeral: true
      });
    }
  }
}

// Type-specific handler functions
async function selectTypeBoxing(interaction, client) {
  await selectType(interaction, client, 'Boxing');
}

async function selectTypeRacing(interaction, client) {
  await selectType(interaction, client, 'Racing');
}

async function selectTypePaintball(interaction, client) {
  await selectType(interaction, client, 'Paintball');
}

async function selectTypeCustom(interaction, client) {
  await selectType(interaction, client, 'Custom');
}

// Handle basic info modal submission
async function submitBasicInfoModalSubmit(interaction, client, params) {
  try {
    // Extract event type from the customId (format: eventCreation_submitBasicInfo_TYPE)
    const customIdParts = interaction.customId.split('_');
    const eventType = customIdParts[2];
    
    // Get the input values
    const eventName = interaction.fields.getTextInputValue('eventName');
    const eventDescription = interaction.fields.getTextInputValue('eventDescription');
    const eventLocation = interaction.fields.getTextInputValue('eventLocation');
    const eventEntryFee = interaction.fields.getTextInputValue('eventEntryFee');
    const eventImageUrl = interaction.fields.getTextInputValue('eventImageUrl');
    
    // Validate entry fee (if provided)
    let entryFee = null;
    if (eventEntryFee) {
      entryFee = parseFloat(eventEntryFee);
      if (isNaN(entryFee) || entryFee < 0) {
        return interaction.reply({
          content: 'Entry fee must be a positive number.',
          ephemeral: true
        });
      }
    }
    
    // Create the event data object
    const eventData = {
      name: eventName,
      type: eventType,
      description: eventDescription || null,
      location: eventLocation || null,
      entryFee: entryFee,
      imageUrl: eventImageUrl || null,
      createdBy: interaction.user.tag,
      createdById: interaction.user.id
    };
    
    // Store the event data temporarily in the session (for this interaction flow)
    // In a production environment, you would use a more robust session management system
    global.eventCreationSession = global.eventCreationSession || {};
    global.eventCreationSession[interaction.user.id] = eventData;
    
    // Acknowledge the submission
    await interaction.reply({
      content: 'Basic information saved. Now let\'s set the date and time for this event.',
      ephemeral: true
    });
    
    // Show date/time selection options
    await setDateTime(interaction, client, { eventData });
    
    logger.info(`Basic event info submitted by ${interaction.user.tag} for ${eventType} event`);
  } catch (error) {
    logger.error('Error in submitBasicInfoModalSubmit function:', error);
    
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: 'An error occurred while processing the event information. This has been logged.',
        ephemeral: true
      });
    }
  }
}

// Show date/time selection interface
async function setDateTime(interaction, client, params) {
  try {
    const { eventData } = params;
    
    // Create the embed for date/time selection
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Event Date & Time')
      .setDescription('Please select a date and time for this event, or skip this step if the event timing is not yet determined.')
      .addFields(
        { name: 'Event Name', value: eventData.name },
        { name: 'Event Type', value: eventData.type },
        { name: 'Current Timezone', value: config.timezone || 'UTC' }
      )
      .setFooter({ text: 'All times will be displayed in the configured timezone' });
    
    // Create the date/time selection button
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('eventCreation_submitDateTime')
          .setLabel('Set Date & Time')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('⏰'),
        new ButtonBuilder()
          .setCustomId('eventCreation_skipDateTime')
          .setLabel('Skip (No Date/Time)')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('⏭️')
      );
    
    // Send the embed with buttons
    await interaction.followUp({
      embeds: [embed],
      components: [row],
      ephemeral: true
    });
    
    logger.debug(`Date/time selection interface shown to ${interaction.user.tag}`);
  } catch (error) {
    logger.error('Error in setDateTime function:', error);
    
    await interaction.followUp({
      content: 'An error occurred while setting up the date/time selection. This has been logged.',
      ephemeral: true
    });
  }
}

// Skip date/time setting
async function skipDateTime(interaction, client, params) {
  try {
    // Get the event data from the session
    const eventData = global.eventCreationSession && global.eventCreationSession[interaction.user.id];
    
    if (!eventData) {
      return interaction.reply({
        content: 'Event creation session expired or not found. Please start again.',
        ephemeral: true
      });
    }
    
    // Acknowledge and proceed to betting configuration
    await interaction.reply({
      content: 'Date/time setting skipped. Now let\'s configure the betting settings.',
      ephemeral: true
    });
    
    // Show betting configuration
    await showBettingConfig(interaction, client, eventData);
    
    logger.debug(`Date/time setting skipped by ${interaction.user.tag}`);
  } catch (error) {
    logger.error('Error in skipDateTime function:', error);
    
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: 'An error occurred while skipping date/time setting. This has been logged.',
        ephemeral: true
      });
    }
  }
}

// Show date/time input modal
async function submitDateTime(interaction, client) {
  try {
    // Create the date/time modal
    const modal = new ModalBuilder()
      .setCustomId('eventCreation_submitDateTimeModal')
      .setTitle('Set Event Date & Time');
    
    // Add inputs for date and time
    const dateInput = new TextInputBuilder()
      .setCustomId('eventDate')
      .setLabel('Event Date (YYYY-MM-DD)')
      .setPlaceholder('e.g., 2025-03-30')
      .setRequired(true)
      .setStyle(TextInputStyle.Short);
    
    const timeInput = new TextInputBuilder()
      .setCustomId('eventTime')
      .setLabel('Event Time (HH:MM in 24-hour format)')
      .setPlaceholder('e.g., 14:30')
      .setRequired(true)
      .setStyle(TextInputStyle.Short);
    
    // Add all inputs to the modal
    modal.addComponents(
      new ActionRowBuilder().addComponents(dateInput),
      new ActionRowBuilder().addComponents(timeInput)
    );
    
    // Show the modal
    await interaction.showModal(modal);
    
    logger.debug(`Date/time modal shown to ${interaction.user.tag}`);
  } catch (error) {
    logger.error('Error in submitDateTime function:', error);
    
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: 'An error occurred while setting up the date/time form. This has been logged.',
        ephemeral: true
      });
    }
  }
}

// Handle date/time modal submission
async function submitDateTimeModalSubmit(interaction, client, params) {
  try {
    // Get the input values
    const dateStr = interaction.fields.getTextInputValue('eventDate');
    const timeStr = interaction.fields.getTextInputValue('eventTime');
    
    // Parse and validate the date and time
    const dateObj = parseDate(dateStr);
    if (!dateObj) {
      return interaction.reply({
        content: 'Invalid date format. Please use YYYY-MM-DD format (e.g., 2025-03-30).',
        ephemeral: true
      });
    }
    
    const dateTimeObj = parseTime(timeStr, dateObj);
    if (!dateTimeObj) {
      return interaction.reply({
        content: 'Invalid time format. Please use HH:MM format in 24-hour time (e.g., 14:30).',
        ephemeral: true
      });
    }
    
    // Check if the date is in the future
    const now = new Date();
    if (dateTimeObj <= now) {
      return interaction.reply({
        content: 'The event date and time must be in the future.',
        ephemeral: true
      });
    }
    
    // Get the event data from the session
    const eventData = global.eventCreationSession && global.eventCreationSession[interaction.user.id];
    
    if (!eventData) {
      return interaction.reply({
        content: 'Event creation session expired or not found. Please start again.',
        ephemeral: true
      });
    }
    
    // Update the event data with the schedule date
    eventData.scheduleDate = dateTimeObj;
    global.eventCreationSession[interaction.user.id] = eventData;
    
    // Format the date for display
    const formattedDate = formatDateTime(dateTimeObj, config.timezone);
    
    // Acknowledge the submission
    await interaction.reply({
      content: `Date and time set: ${formattedDate}. Now let's configure the betting settings.`,
      ephemeral: true
    });
    
    // Show betting configuration
    await showBettingConfig(interaction, client, eventData);
    
    logger.info(`Date/time set to ${formattedDate} by ${interaction.user.tag}`);
  } catch (error) {
    logger.error('Error in submitDateTimeModalSubmit function:', error);
    
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: 'An error occurred while processing the date and time. This has been logged.',
        ephemeral: true
      });
    }
  }
}

// Show betting configuration
async function showBettingConfig(interaction, client, eventData) {
  try {
    // Get default values from the configuration
    const { defaultMinBet, defaultMaxBet, autoCalculation } = config.betting;
    
    // Create the embed for betting configuration
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Betting Configuration')
      .setDescription('Please set the betting parameters for this event.')
      .addFields(
        { name: 'Event Name', value: eventData.name },
        { name: 'Event Type', value: eventData.type },
        { name: 'Default Min Bet', value: `$${defaultMinBet.toLocaleString()}` },
        { name: 'Default Max Bet', value: `$${defaultMaxBet.toLocaleString()}` },
        { name: 'Auto-Calculation', value: autoCalculation ? 'Enabled' : 'Disabled' }
      )
      .setFooter({ text: 'You can use the default values or customize them' });
    
    // Create the betting config button
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('eventCreation_submitBettingConfig')
          .setLabel('Configure Betting Settings')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('💰')
      );
    
    // Send the embed with button
    await interaction.followUp({
      embeds: [embed],
      components: [row],
      ephemeral: true
    });
    
    logger.debug(`Betting configuration interface shown to ${interaction.user.tag}`);
  } catch (error) {
    logger.error('Error in showBettingConfig function:', error);
    
    await interaction.followUp({
      content: 'An error occurred while setting up the betting configuration. This has been logged.',
      ephemeral: true
    });
  }
}

// Show betting configuration modal
async function submitBettingConfig(interaction, client) {
  try {
    // Get default values from the configuration
    const { defaultMinBet, defaultMaxBet, autoCalculation } = config.betting;
    
    // Create the betting config modal
    const modal = new ModalBuilder()
      .setCustomId('eventCreation_submitBettingConfigModal')
      .setTitle('Betting Configuration');
    
    // Add inputs for min/max bet and auto-calculation
    const minBetInput = new TextInputBuilder()
      .setCustomId('minBetAmount')
      .setLabel(`Minimum Bet Amount (Default: $${defaultMinBet})`)
      .setPlaceholder('Enter the minimum bet amount (numeric value only)')
      .setValue(defaultMinBet.toString())
      .setRequired(true)
      .setStyle(TextInputStyle.Short);
    
    const maxBetInput = new TextInputBuilder()
      .setCustomId('maxBetAmount')
      .setLabel(`Maximum Bet Amount (Default: $${defaultMaxBet})`)
      .setPlaceholder('Enter the maximum bet amount (numeric value only)')
      .setValue(defaultMaxBet.toString())
      .setRequired(true)
      .setStyle(TextInputStyle.Short);
    
    const autoCalcInput = new TextInputBuilder()
      .setCustomId('autoCalculation')
      .setLabel('Auto-Calculation (true/false)')
      .setPlaceholder('Enable automatic winner calculation and payouts')
      .setValue(autoCalculation.toString())
      .setRequired(true)
      .setStyle(TextInputStyle.Short);
    
    // Add all inputs to the modal
    modal.addComponents(
      new ActionRowBuilder().addComponents(minBetInput),
      new ActionRowBuilder().addComponents(maxBetInput),
      new ActionRowBuilder().addComponents(autoCalcInput)
    );
    
    // Show the modal
    await interaction.showModal(modal);
    
    logger.debug(`Betting configuration modal shown to ${interaction.user.tag}`);
  } catch (error) {
    logger.error('Error in submitBettingConfig function:', error);
    
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: 'An error occurred while setting up the betting configuration form. This has been logged.',
        ephemeral: true
      });
    }
  }
}

// Handle betting configuration modal submission
async function submitBettingConfigModalSubmit(interaction, client, params) {
  try {
    // Get the input values
    const minBetStr = interaction.fields.getTextInputValue('minBetAmount');
    const maxBetStr = interaction.fields.getTextInputValue('maxBetAmount');
    const autoCalcStr = interaction.fields.getTextInputValue('autoCalculation');
    
    // Parse and validate the betting configuration
    const minBet = parseFloat(minBetStr);
    if (isNaN(minBet) || minBet < 0) {
      return interaction.reply({
        content: 'Minimum bet amount must be a positive number.',
        ephemeral: true
      });
    }
    
    const maxBet = parseFloat(maxBetStr);
    if (isNaN(maxBet) || maxBet < 0) {
      return interaction.reply({
        content: 'Maximum bet amount must be a positive number.',
        ephemeral: true
      });
    }
    
    if (minBet > maxBet) {
      return interaction.reply({
        content: 'Minimum bet amount cannot be greater than maximum bet amount.',
        ephemeral: true
      });
    }
    
    const autoCalc = autoCalcStr.toLowerCase() === 'true';
    
    // Get the event data from the session
    const eventData = global.eventCreationSession && global.eventCreationSession[interaction.user.id];
    
    if (!eventData) {
      return interaction.reply({
        content: 'Event creation session expired or not found. Please start again.',
        ephemeral: true
      });
    }
    
    // Update the event data with the betting configuration
    eventData.minBetAmount = minBet;
    eventData.maxBetAmount = maxBet;
    eventData.autoCalculation = autoCalc;
    global.eventCreationSession[interaction.user.id] = eventData;
    
    // Acknowledge the submission
    await interaction.reply({
      content: `Betting configuration saved. Min Bet: $${minBet.toLocaleString()}, Max Bet: $${maxBet.toLocaleString()}, Auto-Calculation: ${autoCalc ? 'Enabled' : 'Disabled'}`,
      ephemeral: true
    });
    
    // Show event confirmation
    await showEventConfirmation(interaction, client, eventData);
    
    logger.info(`Betting configuration set by ${interaction.user.tag} (Min: ${minBet}, Max: ${maxBet}, Auto: ${autoCalc})`);
  } catch (error) {
    logger.error('Error in submitBettingConfigModalSubmit function:', error);
    
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: 'An error occurred while processing the betting configuration. This has been logged.',
        ephemeral: true
      });
    }
  }
}

// Show event confirmation
async function showEventConfirmation(interaction, client, eventData) {
  try {
    // Create the embed for event confirmation
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Event Confirmation')
      .setDescription('Please review and confirm the event details below.')
      .addFields(
        { name: 'Event Name', value: eventData.name },
        { name: 'Event Type', value: eventData.type },
        { name: 'Description', value: eventData.description || 'N/A' },
        { name: 'Location', value: eventData.location || 'N/A' },
        { name: 'Entry Fee', value: eventData.entryFee ? `$${eventData.entryFee.toLocaleString()}` : 'Free Entry' }
      );
    
    // Add schedule date if available
    if (eventData.scheduleDate) {
      const formattedDate = formatDateTime(eventData.scheduleDate, config.timezone);
      embed.addFields({ name: 'Date & Time', value: formattedDate });
    } else {
      embed.addFields({ name: 'Date & Time', value: 'Not scheduled yet' });
    }
    
    // Add betting configuration
    embed.addFields(
      { name: 'Min Bet Amount', value: `$${eventData.minBetAmount.toLocaleString()}` },
      { name: 'Max Bet Amount', value: `$${eventData.maxBetAmount.toLocaleString()}` },
      { name: 'Auto-Calculation', value: eventData.autoCalculation ? 'Enabled' : 'Disabled' }
    );
    
    // Add image if available
    if (eventData.imageUrl) {
      embed.setImage(eventData.imageUrl);
    }
    
    embed.setFooter({ text: `Created by ${eventData.createdBy}` });
    
    // Create the confirmation buttons
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('eventCreation_confirmEvent')
          .setLabel('Confirm & Create Event')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✅'),
        new ButtonBuilder()
          .setCustomId('eventCreation_cancelEvent')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('❌')
      );
    
    // Send the embed with buttons
    await interaction.followUp({
      embeds: [embed],
      components: [row],
      ephemeral: true
    });
    
    logger.debug(`Event confirmation interface shown to ${interaction.user.tag}`);
  } catch (error) {
    logger.error('Error in showEventConfirmation function:', error);
    
    await interaction.followUp({
      content: 'An error occurred while setting up the event confirmation. This has been logged.',
      ephemeral: true
    });
  }
}

// Create the event in the database
async function confirmEvent(interaction, client, params) {
  try {
    // Get the event data from the session
    const eventData = global.eventCreationSession && global.eventCreationSession[interaction.user.id];
    
    if (!eventData) {
      return interaction.reply({
        content: 'Event creation session expired or not found. Please start again.',
        ephemeral: true
      });
    }
    
    // Validate the event data
    const validation = validateEventData(eventData);
    if (!validation.valid) {
      return interaction.reply({
        content: `Validation failed: ${validation.errors.join(', ')}`,
        ephemeral: true
      });
    }
    
    // Create the event in the database
    const event = await db.models.Event.create({
      name: eventData.name,
      description: eventData.description,
      type: eventData.type,
      location: eventData.location,
      status: 'Active',
      scheduleDate: eventData.scheduleDate,
      entryFee: eventData.entryFee,
      minBetAmount: eventData.minBetAmount,
      maxBetAmount: eventData.maxBetAmount,
      autoCalculation: eventData.autoCalculation,
      imageUrl: eventData.imageUrl,
      createdBy: eventData.createdBy,
      createdById: eventData.createdById,
      totalBets: 0,
      totalAmount: 0
    });
    
    // Clean up the session
    if (global.eventCreationSession && global.eventCreationSession[interaction.user.id]) {
      delete global.eventCreationSession[interaction.user.id];
    }
    
    // Acknowledge the creation
    await interaction.reply({
      content: `Event created successfully! Event ID: ${event.id}`,
      ephemeral: true
    });
    
    // Ask if they want to post an announcement
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('eventManagement_postAnnouncement')
          .setLabel('Post Announcement')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📢'),
        new ButtonBuilder()
          .setCustomId('eventManagement_announceEvent')
          .setLabel('Post Later (Manage Events)')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('⏱️')
      );
    
    await interaction.followUp({
      content: 'Would you like to post an announcement for this event now?',
      components: [row],
      ephemeral: true
    });
    
    // Log the event creation
    logger.info(`Event created by ${interaction.user.tag}. Event ID: ${event.id}, Name: ${event.name}`, {
      category: 'Event',
      userId: interaction.user.id,
      username: interaction.user.tag,
      eventId: event.id,
      details: {
        eventType: event.type,
        eventName: event.name
      }
    });
  } catch (error) {
    logger.error('Error in confirmEvent function:', error);
    
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: 'An error occurred while creating the event. This has been logged.',
        ephemeral: true
      });
    } else {
      await interaction.followUp({
        content: 'An error occurred while creating the event. This has been logged.',
        ephemeral: true
      });
    }
  }
}

// Cancel event creation
async function cancelEvent(interaction, client) {
  try {
    // Clean up the session
    if (global.eventCreationSession && global.eventCreationSession[interaction.user.id]) {
      delete global.eventCreationSession[interaction.user.id];
    }
    
    // Acknowledge the cancellation
    await interaction.reply({
      content: 'Event creation cancelled.',
      ephemeral: true
    });
    
    logger.info(`Event creation cancelled by ${interaction.user.tag}`);
  } catch (error) {
    logger.error('Error in cancelEvent function:', error);
    
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: 'An error occurred while cancelling the event creation. This has been logged.',
        ephemeral: true
      });
    }
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
      case 'createEvent':
        await createEvent(interaction, client);
        break;
      case 'selectTypeBoxing':
        await selectTypeBoxing(interaction, client);
        break;
      case 'selectTypeRacing':
        await selectTypeRacing(interaction, client);
        break;
      case 'selectTypePaintball':
        await selectTypePaintball(interaction, client);
        break;
      case 'selectTypeCustom':
        await selectTypeCustom(interaction, client);
        break;
      case 'setDateTime':
        await setDateTime(interaction, client);
        break;
      case 'skipDateTime':
        await skipDateTime(interaction, client);
        break;
      case 'submitDateTime':
        await submitDateTime(interaction, client);
        break;
      case 'showBettingConfig':
        await showBettingConfig(interaction, client);
        break;
      case 'submitBettingConfig':
        await submitBettingConfig(interaction, client);
        break;
      case 'showEventConfirmation':
        await showEventConfirmation(interaction, client);
        break;
      case 'confirmEvent':
        await confirmEvent(interaction, client);
        break;
      case 'cancelEvent':
        await cancelEvent(interaction, client);
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

module.exports = {
  createEvent,
  selectTypeBoxing,
  selectTypeRacing,
  selectTypePaintball,
  selectTypeCustom,
  submitBasicInfoModalSubmit,
  setDateTime,
  skipDateTime,
  submitDateTime,
  submitDateTimeModalSubmit,
  showBettingConfig,
  submitBettingConfig,
  submitBettingConfigModalSubmit,
  showEventConfirmation,
  confirmEvent,
  cancelEvent,
  handleButton
};