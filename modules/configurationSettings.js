// KrayStakes Discord Bot - Configuration Settings Module
const { 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder, 
  TextInputStyle,
  StringSelectMenuBuilder 
} = require('discord.js');
const { isAdmin } = require('../utils/permissions');
const { createErrorEmbed, createSuccessEmbed, createWarningEmbed } = require('../utils/embeds');
const { safeReply, safeUpdate, safeDeferUpdate, handleInteractionError } = require('../utils/interactions');
const config = require('../config');
const logger = require('../utils/logger');
const { validateReportConfig } = require('../utils/validators');

/**
 * Display the configuration panel
 * @param {Interaction} interaction - The interaction that triggered this
 * @param {Client} client - The Discord client instance
 */
async function configPanel(interaction, client) {
  try {
    // Check if user has server admin permission
    if (!interaction.member || !isAdmin(interaction.member)) {
      await interaction.editReply({
        embeds: [createErrorEmbed(
          'Permission Denied',
          'You do not have permission to access configuration settings. Only Server Admins can access configuration settings.'
        )]
      });
      return;
    }
    
    // Create the configuration panel embed
    const embed = new EmbedBuilder()
      .setColor(config.colors.secondary)
      .setTitle('⚙️ KrayStakes Configuration Settings')
      .setDescription('Welcome to the Configuration Settings panel. Use the buttons below to configure different aspects of the KrayStakes Discord Bot.')
      .addFields(
        { name: 'Betting Configuration', value: 'Configure default minimum and maximum bet amounts, auto calculation, and suspicious bet threshold.' },
        { name: 'Payout Settings', value: 'Configure payout mode (Auto vs. Manual) and payout delay time.' },
        { name: 'Report Configuration', value: 'Configure report generation frequency and auto-send settings.' },
        { name: 'Channel Management', value: 'Configure which channels are used for announcements, betting updates, financial reports, and more.' },
        { name: 'Debug Mode', value: `Debug Mode is currently ${config.debugMode ? 'ON' : 'OFF'}.` }
      )
      .setFooter({ text: 'KrayStakes Configuration Settings • Server Admin Only' })
      .setTimestamp();
    
    // Create the configuration panel buttons
    const buttons = [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('configurationSettings:editBettingConfig')
          .setLabel('Edit Betting Configuration')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🎲'),
        new ButtonBuilder()
          .setCustomId('configurationSettings:editPayoutSettings')
          .setLabel('Edit Payout Settings')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('💰')
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('configurationSettings:editReportSettings')
          .setLabel('Edit Report Settings')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📊'),
        new ButtonBuilder()
          .setCustomId('configurationSettings:editChannelConfig')
          .setLabel('Edit Channel Configuration')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📢')
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('configurationSettings:toggleDebugMode')
          .setLabel(`${config.debugMode ? 'Disable' : 'Enable'} Debug Mode`)
          .setStyle(config.debugMode ? ButtonStyle.Danger : ButtonStyle.Success)
          .setEmoji('🔧'),
        new ButtonBuilder()
          .setCustomId('adminPanel:createPanel')
          .setLabel('Back to Admin Panel')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('◀️')
      )
    ];
    
    // Send the configuration panel
    await interaction.editReply({
      embeds: [embed],
      components: buttons
    });
    
    // Log the action
    logger.info(`Configuration panel opened by ${interaction.user.tag} (${interaction.user.id})`, {
      userId: interaction.user.id,
      category: 'config'
    });
  } catch (error) {
    logger.error(`Error displaying configuration panel: ${error.message}`, {
      userId: interaction.user.id,
      category: 'config',
      stack: error.stack
    });
    
    // Reply with error message
    await interaction.editReply({
      embeds: [createErrorEmbed(
        'Error',
        `An error occurred while displaying the configuration panel: ${error.message}`
      )]
    });
  }
}

/**
 * Edit betting configuration
 * @param {Interaction} interaction - The interaction that triggered this
 * @param {Client} client - The Discord client instance
 */
async function editBettingConfig(interaction, client) {
  try {
    // Get current configuration from database
    const { Configuration } = require('../database/models');
    
    const defaultMinBetConfig = await Configuration.findOne({ where: { key: 'defaultMinBet' } });
    const defaultMaxBetConfig = await Configuration.findOne({ where: { key: 'defaultMaxBet' } });
    const autoCalculationConfig = await Configuration.findOne({ where: { key: 'autoCalculation' } });
    const suspiciousBetThresholdConfig = await Configuration.findOne({ where: { key: 'suspiciousBetThreshold' } });
    
    const defaultMinBet = defaultMinBetConfig ? defaultMinBetConfig.value : config.betting.defaultMinBet.toString();
    const defaultMaxBet = defaultMaxBetConfig ? defaultMaxBetConfig.value : config.betting.defaultMaxBet.toString();
    const autoCalculation = autoCalculationConfig ? (autoCalculationConfig.value === 'true') : config.betting.autoCalculation;
    const suspiciousBetThreshold = suspiciousBetThresholdConfig ? suspiciousBetThresholdConfig.value : config.betting.suspiciousBetThreshold.toString();
    
    // Create a modal for editing betting configuration
    const modal = new ModalBuilder()
      .setCustomId('configurationSettings:submitBettingConfig')
      .setTitle('Edit Betting Configuration');
    
    // Add inputs to the modal
    const defaultMinBetInput = new TextInputBuilder()
      .setCustomId('defaultMinBet')
      .setLabel('Default Minimum Bet Amount')
      .setPlaceholder('Enter a number (e.g., 100)')
      .setValue(defaultMinBet)
      .setStyle(TextInputStyle.Short)
      .setRequired(true);
    
    const defaultMaxBetInput = new TextInputBuilder()
      .setCustomId('defaultMaxBet')
      .setLabel('Default Maximum Bet Amount')
      .setPlaceholder('Enter a number (e.g., 10000)')
      .setValue(defaultMaxBet)
      .setStyle(TextInputStyle.Short)
      .setRequired(true);
    
    const suspiciousBetThresholdInput = new TextInputBuilder()
      .setCustomId('suspiciousBetThreshold')
      .setLabel('Suspicious Bet Threshold')
      .setPlaceholder('Enter a number (e.g., 5000)')
      .setValue(suspiciousBetThreshold)
      .setStyle(TextInputStyle.Short)
      .setRequired(true);
    
    const autoCalculationInput = new TextInputBuilder()
      .setCustomId('autoCalculation')
      .setLabel('Auto Calculation (true/false)')
      .setPlaceholder('Enter "true" or "false"')
      .setValue(autoCalculation.toString())
      .setStyle(TextInputStyle.Short)
      .setRequired(true);
    
    // Add inputs to action rows
    const firstActionRow = new ActionRowBuilder().addComponents(defaultMinBetInput);
    const secondActionRow = new ActionRowBuilder().addComponents(defaultMaxBetInput);
    const thirdActionRow = new ActionRowBuilder().addComponents(suspiciousBetThresholdInput);
    const fourthActionRow = new ActionRowBuilder().addComponents(autoCalculationInput);
    
    // Add action rows to the modal
    modal.addComponents(firstActionRow, secondActionRow, thirdActionRow, fourthActionRow);
    
    // Check if we can show a modal without errors
    if (interaction.deferred || interaction.replied) {
      // If the interaction has already been responded to, we need to send a new message with a button
      // that the user can click to open the modal (workaround for Discord limitation)
      const modalButton = new ButtonBuilder()
        .setCustomId('configSettings:openBettingConfigModal')
        .setLabel('Open Betting Configuration')
        .setStyle(ButtonStyle.Primary);
      
      const row = new ActionRowBuilder().addComponents(modalButton);
      
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setTitle('Betting Configuration')
          .setDescription('Please click the button below to configure betting settings')
          .setColor('#0099ff')],
        components: [row]
      });
      
      // Store the modal data for later use
      client.cache.set(`bettingConfigModal_${interaction.user.id}`, modal, 300000); // 5 minutes TTL
      
      logger.info(`Betting configuration button provided to ${interaction.user.tag} (${interaction.user.id})`, {
        userId: interaction.user.id,
        category: 'config'
      });
    } else {
      // Show the modal directly if the interaction hasn't been responded to
      await interaction.showModal(modal);
      
      logger.info(`Betting configuration modal opened by ${interaction.user.tag} (${interaction.user.id})`, {
        userId: interaction.user.id,
        category: 'config'
      });
    }
  } catch (error) {
    logger.error(`Error displaying betting configuration modal: ${error.message}`, {
      userId: interaction.user.id,
      category: 'config',
      stack: error.stack
    });
    
    // Use interaction utilities for error handling
    await safeReply(interaction, {
      embeds: [createErrorEmbed(
        'Error',
        `An error occurred while displaying the betting configuration modal: ${error.message}`)],
      ephemeral: true
    });
  }
}

/**
 * Edit payout settings
 * @param {Interaction} interaction - The interaction that triggered this
 * @param {Client} client - The Discord client instance
 */
async function editPayoutSettings(interaction, client) {
  try {
    // Get current configuration from database
    const { Configuration } = require('../database/models');
    
    const payoutModeConfig = await Configuration.findOne({ where: { key: 'payoutMode' } });
    const payoutDelayConfig = await Configuration.findOne({ where: { key: 'payoutDelay' } });
    
    const payoutMode = payoutModeConfig ? payoutModeConfig.value : config.payout.mode;
    const payoutDelay = payoutDelayConfig ? payoutDelayConfig.value : config.payout.delay.toString();
    
    // Create a modal for editing payout settings
    const modal = new ModalBuilder()
      .setCustomId('configurationSettings:submitPayoutSettings')
      .setTitle('Edit Payout Settings');
    
    // Add inputs to the modal
    const payoutModeInput = new TextInputBuilder()
      .setCustomId('payoutMode')
      .setLabel('Payout Mode (Manual/Auto)')
      .setPlaceholder('Enter "Manual" or "Auto"')
      .setValue(payoutMode)
      .setStyle(TextInputStyle.Short)
      .setRequired(true);
    
    const payoutDelayInput = new TextInputBuilder()
      .setCustomId('payoutDelay')
      .setLabel('Payout Delay (minutes)')
      .setPlaceholder('Enter a number (e.g., 0)')
      .setValue(payoutDelay)
      .setStyle(TextInputStyle.Short)
      .setRequired(true);
    
    // Add inputs to action rows
    const firstActionRow = new ActionRowBuilder().addComponents(payoutModeInput);
    const secondActionRow = new ActionRowBuilder().addComponents(payoutDelayInput);
    
    // Add action rows to the modal
    modal.addComponents(firstActionRow, secondActionRow);
    
    // Check if we can show a modal without errors
    if (interaction.deferred || interaction.replied) {
      // If the interaction has already been responded to, we need to send a new message with a button
      // that the user can click to open the modal (workaround for Discord limitation)
      const modalButton = new ButtonBuilder()
        .setCustomId('configSettings:openPayoutSettingsModal')
        .setLabel('Open Payout Settings')
        .setStyle(ButtonStyle.Primary);
      
      const row = new ActionRowBuilder().addComponents(modalButton);
      
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setTitle('Payout Settings')
          .setDescription('Please click the button below to configure payout settings')
          .setColor('#0099ff')],
        components: [row]
      });
      
      // Store the modal data for later use
      client.cache.set(`payoutSettingsModal_${interaction.user.id}`, modal, 300000); // 5 minutes TTL
      
      logger.info(`Payout settings button provided to ${interaction.user.tag} (${interaction.user.id})`, {
        userId: interaction.user.id,
        category: 'config'
      });
    } else {
      // Show the modal directly if the interaction hasn't been responded to
      await interaction.showModal(modal);
      
      logger.info(`Payout settings modal opened by ${interaction.user.tag} (${interaction.user.id})`, {
        userId: interaction.user.id,
        category: 'config'
      });
    }
  } catch (error) {
    logger.error(`Error displaying payout settings modal: ${error.message}`, {
      userId: interaction.user.id,
      category: 'config',
      stack: error.stack
    });
    
    // Use interaction utilities for error handling
    await safeReply(interaction, {
      embeds: [createErrorEmbed(
        'Error',
        `An error occurred while displaying the payout settings modal: ${error.message}`)],
      ephemeral: true
    });
  }
}

/**
 * Edit report settings
 * @param {Interaction} interaction - The interaction that triggered this
 * @param {Client} client - The Discord client instance
 */
async function editReportSettings(interaction, client) {
  try {
    // Get current configuration from database
    const { Configuration } = require('../database/models');
    
    const reportFrequencyConfig = await Configuration.findOne({ where: { key: 'reportFrequency' } });
    const autoSendReportsConfig = await Configuration.findOne({ where: { key: 'autoSendReports' } });
    const timezoneConfig = await Configuration.findOne({ where: { key: 'timezone' } });
    
    const reportFrequency = reportFrequencyConfig ? reportFrequencyConfig.value : config.reports.frequency;
    const autoSendReports = autoSendReportsConfig ? (autoSendReportsConfig.value === 'true') : config.reports.autoSend;
    const timezone = timezoneConfig ? timezoneConfig.value : config.timezone;
    
    // Create a modal for editing report settings
    const modal = new ModalBuilder()
      .setCustomId('configurationSettings:submitReportSettings')
      .setTitle('Edit Report Settings');
    
    // Add inputs to the modal
    const reportFrequencyInput = new TextInputBuilder()
      .setCustomId('reportFrequency')
      .setLabel('Report Frequency (Daily/Weekly/Monthly)')
      .setPlaceholder('Enter "Daily", "Weekly", or "Monthly"')
      .setValue(reportFrequency)
      .setStyle(TextInputStyle.Short)
      .setRequired(true);
    
    const autoSendReportsInput = new TextInputBuilder()
      .setCustomId('autoSendReports')
      .setLabel('Auto-Send Reports (true/false)')
      .setPlaceholder('Enter "true" or "false"')
      .setValue(autoSendReports.toString())
      .setStyle(TextInputStyle.Short)
      .setRequired(true);
    
    const timezoneInput = new TextInputBuilder()
      .setCustomId('timezone')
      .setLabel('Default Timezone')
      .setPlaceholder('Enter a valid timezone (e.g., "UTC", "America/New_York")')
      .setValue(timezone)
      .setStyle(TextInputStyle.Short)
      .setRequired(true);
    
    // Add inputs to action rows
    const firstActionRow = new ActionRowBuilder().addComponents(reportFrequencyInput);
    const secondActionRow = new ActionRowBuilder().addComponents(autoSendReportsInput);
    const thirdActionRow = new ActionRowBuilder().addComponents(timezoneInput);
    
    // Add action rows to the modal
    modal.addComponents(firstActionRow, secondActionRow, thirdActionRow);
    
    // Check if we can show a modal without errors
    if (interaction.deferred || interaction.replied) {
      // If the interaction has already been responded to, we need to send a new message with a button
      // that the user can click to open the modal (workaround for Discord limitation)
      const modalButton = new ButtonBuilder()
        .setCustomId('configSettings:openReportSettingsModal')
        .setLabel('Open Report Settings')
        .setStyle(ButtonStyle.Primary);
      
      const row = new ActionRowBuilder().addComponents(modalButton);
      
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setTitle('Report Settings')
          .setDescription('Please click the button below to configure report settings')
          .setColor('#0099ff')],
        components: [row]
      });
      
      // Store the modal data for later use
      client.cache.set(`reportSettingsModal_${interaction.user.id}`, modal, 300000); // 5 minutes TTL
      
      logger.info(`Report settings button provided to ${interaction.user.tag} (${interaction.user.id})`, {
        userId: interaction.user.id,
        category: 'config'
      });
    } else {
      // Show the modal directly if the interaction hasn't been responded to
      await interaction.showModal(modal);
      
      logger.info(`Report settings modal opened by ${interaction.user.tag} (${interaction.user.id})`, {
        userId: interaction.user.id,
        category: 'config'
      });
    }
  } catch (error) {
    logger.error(`Error displaying report settings modal: ${error.message}`, {
      userId: interaction.user.id,
      category: 'config',
      stack: error.stack
    });
    
    // Use interaction utilities for error handling
    await safeReply(interaction, {
      embeds: [createErrorEmbed(
        'Error',
        `An error occurred while displaying the report settings modal: ${error.message}`)],
      ephemeral: true
    });
  }
}

/**
 * Edit channel configuration
 * @param {Interaction} interaction - The interaction that triggered this
 * @param {Client} client - The Discord client instance
 */
async function editChannelConfig(interaction, client) {
  try {
    // Get current configuration from database
    const { Configuration } = require('../database/models');
    
    const bettingAnnouncementsChannelConfig = await Configuration.findOne({ where: { key: 'bettingAnnouncementsChannel' } });
    const payoutAnnouncementsChannelConfig = await Configuration.findOne({ where: { key: 'payoutAnnouncementsChannel' } });
    const reportsChannelConfig = await Configuration.findOne({ where: { key: 'reportsChannel' } });
    const leaderboardChannelConfig = await Configuration.findOne({ where: { key: 'leaderboardChannel' } });
    const logsChannelConfig = await Configuration.findOne({ where: { key: 'logsChannel' } });
    
    const bettingAnnouncementsChannel = bettingAnnouncementsChannelConfig ? bettingAnnouncementsChannelConfig.value : config.channels.bettingAnnouncements || '';
    const payoutAnnouncementsChannel = payoutAnnouncementsChannelConfig ? payoutAnnouncementsChannelConfig.value : config.channels.payoutAnnouncements || '';
    const reportsChannel = reportsChannelConfig ? reportsChannelConfig.value : config.channels.reports || '';
    const leaderboardChannel = leaderboardChannelConfig ? leaderboardChannelConfig.value : config.channels.leaderboard || '';
    const logsChannel = logsChannelConfig ? logsChannelConfig.value : config.channels.logs || '';
    
    // Create a modal for editing channel configuration
    const modal = new ModalBuilder()
      .setCustomId('configurationSettings:submitChannelConfig')
      .setTitle('Edit Channel Configuration');
    
    // Add inputs to the modal
    const bettingAnnouncementsChannelInput = new TextInputBuilder()
      .setCustomId('bettingAnnouncementsChannel')
      .setLabel('Betting Announcements Channel ID')
      .setPlaceholder('Enter a channel ID')
      .setValue(bettingAnnouncementsChannel)
      .setStyle(TextInputStyle.Short)
      .setRequired(false);
    
    const payoutAnnouncementsChannelInput = new TextInputBuilder()
      .setCustomId('payoutAnnouncementsChannel')
      .setLabel('Payout Announcements Channel ID')
      .setPlaceholder('Enter a channel ID')
      .setValue(payoutAnnouncementsChannel)
      .setStyle(TextInputStyle.Short)
      .setRequired(false);
    
    const reportsChannelInput = new TextInputBuilder()
      .setCustomId('reportsChannel')
      .setLabel('Reports Channel ID')
      .setPlaceholder('Enter a channel ID')
      .setValue(reportsChannel)
      .setStyle(TextInputStyle.Short)
      .setRequired(false);
    
    const leaderboardChannelInput = new TextInputBuilder()
      .setCustomId('leaderboardChannel')
      .setLabel('Leaderboard Channel ID')
      .setPlaceholder('Enter a channel ID')
      .setValue(leaderboardChannel)
      .setStyle(TextInputStyle.Short)
      .setRequired(false);
    
    const logsChannelInput = new TextInputBuilder()
      .setCustomId('logsChannel')
      .setLabel('Logs Channel ID')
      .setPlaceholder('Enter a channel ID')
      .setValue(logsChannel)
      .setStyle(TextInputStyle.Short)
      .setRequired(false);
    
    // Add inputs to action rows
    const firstActionRow = new ActionRowBuilder().addComponents(bettingAnnouncementsChannelInput);
    const secondActionRow = new ActionRowBuilder().addComponents(payoutAnnouncementsChannelInput);
    const thirdActionRow = new ActionRowBuilder().addComponents(reportsChannelInput);
    const fourthActionRow = new ActionRowBuilder().addComponents(leaderboardChannelInput);
    const fifthActionRow = new ActionRowBuilder().addComponents(logsChannelInput);
    
    // Add action rows to the modal
    modal.addComponents(firstActionRow, secondActionRow, thirdActionRow, fourthActionRow, fifthActionRow);
    
    // Check if we can show a modal without errors
    if (interaction.deferred || interaction.replied) {
      // If the interaction has already been responded to, we need to send a new message with a button
      // that the user can click to open the modal (workaround for Discord limitation)
      const modalButton = new ButtonBuilder()
        .setCustomId('configSettings:openChannelConfigModal')
        .setLabel('Open Channel Configuration')
        .setStyle(ButtonStyle.Primary);
      
      const row = new ActionRowBuilder().addComponents(modalButton);
      
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setTitle('Channel Configuration')
          .setDescription('Please click the button below to configure channels')
          .setColor('#0099ff')],
        components: [row]
      });
      
      // Store the modal data for later use
      client.cache.set(`channelConfigModal_${interaction.user.id}`, modal, 300000); // 5 minutes TTL
      
      logger.info(`Channel configuration button provided to ${interaction.user.tag} (${interaction.user.id})`, {
        userId: interaction.user.id,
        category: 'config'
      });
    } else {
      // Show the modal directly if the interaction hasn't been responded to
      await interaction.showModal(modal);
      
      logger.info(`Channel configuration modal opened by ${interaction.user.tag} (${interaction.user.id})`, {
        userId: interaction.user.id,
        category: 'config'
      });
    }
  } catch (error) {
    logger.error(`Error displaying channel configuration modal: ${error.message}`, {
      userId: interaction.user.id,
      category: 'config',
      stack: error.stack
    });
    
    // Use interaction utilities for error handling
    await safeReply(interaction, {
      embeds: [createErrorEmbed(
        'Error',
        `An error occurred while displaying the channel configuration modal: ${error.message}`)],
      ephemeral: true
    });
  }
}

/**
 * Toggle debug mode
 * @param {Interaction} interaction - The interaction that triggered this
 * @param {Client} client - The Discord client instance
 */
async function toggleDebugMode(interaction, client) {
  try {
    // Get current debug mode setting from database
    const { Configuration } = require('../database/models');
    
    const debugModeConfig = await Configuration.findOne({ where: { key: 'debugMode' } });
    const currentDebugMode = debugModeConfig ? (debugModeConfig.value === 'true') : config.debugMode;
    
    // Toggle debug mode
    const newDebugMode = !currentDebugMode;
    
    // Update the configuration in the database
    if (debugModeConfig) {
      debugModeConfig.value = newDebugMode.toString();
      await debugModeConfig.save();
    } else {
      await Configuration.create({
        key: 'debugMode',
        value: newDebugMode.toString(),
        category: 'system',
        description: 'Enable debug mode for additional logging'
      });
    }
    
    // Update the config object
    config.debugMode = newDebugMode;
    
    // Send confirmation message
    await interaction.editReply({
      embeds: [createSuccessEmbed(
        'Debug Mode Updated',
        `Debug Mode has been ${newDebugMode ? 'enabled' : 'disabled'}. ${newDebugMode ? 'Additional logging will now be performed.' : 'Standard logging will now be used.'}`
      )]
    });
    
    // Log the action
    logger.info(`Debug Mode ${newDebugMode ? 'enabled' : 'disabled'} by ${interaction.user.tag} (${interaction.user.id})`, {
      userId: interaction.user.id,
      category: 'config'
    });
  } catch (error) {
    logger.error(`Error toggling debug mode: ${error.message}`, {
      userId: interaction.user.id,
      category: 'config',
      stack: error.stack
    });
    
    // Reply with error message
    await interaction.editReply({
      embeds: [createErrorEmbed(
        'Error',
        `An error occurred while toggling debug mode: ${error.message}`
      )]
    });
  }
}

/**
 * Handle betting configuration modal submit
 * @param {Interaction} interaction - The interaction that triggered this
 * @param {Client} client - The Discord client instance
 */
async function submitBettingConfigModalSubmit(interaction, client) {
  try {
    // Get the input values from the modal
    const defaultMinBet = interaction.fields.getTextInputValue('defaultMinBet');
    const defaultMaxBet = interaction.fields.getTextInputValue('defaultMaxBet');
    const suspiciousBetThreshold = interaction.fields.getTextInputValue('suspiciousBetThreshold');
    const autoCalculation = interaction.fields.getTextInputValue('autoCalculation');
    
    // Validate the inputs
    const errors = [];
    
    if (isNaN(parseFloat(defaultMinBet)) || parseFloat(defaultMinBet) < 0) {
      errors.push('Default minimum bet amount must be a valid number greater than or equal to 0.');
    }
    
    if (isNaN(parseFloat(defaultMaxBet)) || parseFloat(defaultMaxBet) <= 0) {
      errors.push('Default maximum bet amount must be a valid number greater than 0.');
    }
    
    if (parseFloat(defaultMinBet) > parseFloat(defaultMaxBet)) {
      errors.push('Default minimum bet amount cannot be greater than default maximum bet amount.');
    }
    
    if (isNaN(parseFloat(suspiciousBetThreshold)) || parseFloat(suspiciousBetThreshold) <= 0) {
      errors.push('Suspicious bet threshold must be a valid number greater than 0.');
    }
    
    if (autoCalculation !== 'true' && autoCalculation !== 'false') {
      errors.push('Auto calculation must be either "true" or "false".');
    }
    
    // If there are validation errors, display them and return
    if (errors.length > 0) {
      await interaction.reply({
        embeds: [createErrorEmbed(
          'Validation Error',
          `Please correct the following errors:\n\n${errors.join('\n')}`
        )],
        ephemeral: true
      });
      return;
    }
    
    // Update the configurations in the database
    await updateConfig('defaultMinBet', defaultMinBet, 'betting', 'Default minimum bet amount for events', interaction);
    await updateConfig('defaultMaxBet', defaultMaxBet, 'betting', 'Default maximum bet amount for events', interaction);
    await updateConfig('suspiciousBetThreshold', suspiciousBetThreshold, 'betting', 'Threshold for flagging suspicious bets', interaction);
    await updateConfig('autoCalculation', autoCalculation, 'betting', 'Auto-calculate winners based on predefined formulas', interaction);
    
    // Update the config object
    config.betting.defaultMinBet = parseFloat(defaultMinBet);
    config.betting.defaultMaxBet = parseFloat(defaultMaxBet);
    config.betting.suspiciousBetThreshold = parseFloat(suspiciousBetThreshold);
    config.betting.autoCalculation = autoCalculation === 'true';
    
    // Send confirmation message
    await interaction.reply({
      embeds: [createSuccessEmbed(
        'Betting Configuration Updated',
        `The betting configuration has been updated successfully.\n\n` +
        `Default Minimum Bet: $${parseFloat(defaultMinBet).toLocaleString()}\n` +
        `Default Maximum Bet: $${parseFloat(defaultMaxBet).toLocaleString()}\n` +
        `Suspicious Bet Threshold: $${parseFloat(suspiciousBetThreshold).toLocaleString()}\n` +
        `Auto Calculation: ${autoCalculation === 'true' ? 'Enabled' : 'Disabled'}`
      )],
      ephemeral: true
    });
    
    // Log the action
    logger.info(`Betting configuration updated by ${interaction.user.tag} (${interaction.user.id})`, {
      userId: interaction.user.id,
      category: 'config',
      metadata: {
        defaultMinBet,
        defaultMaxBet,
        suspiciousBetThreshold,
        autoCalculation
      }
    });
  } catch (error) {
    logger.error(`Error processing betting configuration update: ${error.message}`, {
      userId: interaction.user.id,
      category: 'config',
      stack: error.stack
    });
    
    // Reply with error message
    await interaction.reply({
      embeds: [createErrorEmbed(
        'Error',
        `An error occurred while updating the betting configuration: ${error.message}`
      )],
      ephemeral: true
    });
  }
}

/**
 * Handle payout settings modal submit
 * @param {Interaction} interaction - The interaction that triggered this
 * @param {Client} client - The Discord client instance
 */
async function submitPayoutSettingsModalSubmit(interaction, client) {
  try {
    // Get the input values from the modal
    const payoutMode = interaction.fields.getTextInputValue('payoutMode');
    const payoutDelay = interaction.fields.getTextInputValue('payoutDelay');
    
    // Validate the inputs
    const errors = [];
    
    if (payoutMode !== 'Manual' && payoutMode !== 'Auto') {
      errors.push('Payout mode must be either "Manual" or "Auto".');
    }
    
    if (isNaN(parseInt(payoutDelay)) || parseInt(payoutDelay) < 0) {
      errors.push('Payout delay must be a valid number greater than or equal to 0.');
    }
    
    // If there are validation errors, display them and return
    if (errors.length > 0) {
      await interaction.reply({
        embeds: [createErrorEmbed(
          'Validation Error',
          `Please correct the following errors:\n\n${errors.join('\n')}`
        )],
        ephemeral: true
      });
      return;
    }
    
    // Update the configurations in the database
    await updateConfig('payoutMode', payoutMode, 'payout', 'Mode for processing payouts (Manual or Auto)', interaction);
    await updateConfig('payoutDelay', payoutDelay, 'payout', 'Delay in minutes before processing payouts after event completion', interaction);
    
    // Update the config object
    config.payout.mode = payoutMode;
    config.payout.delay = parseInt(payoutDelay);
    
    // Send confirmation message
    await interaction.reply({
      embeds: [createSuccessEmbed(
        'Payout Settings Updated',
        `The payout settings have been updated successfully.\n\n` +
        `Payout Mode: ${payoutMode}\n` +
        `Payout Delay: ${parseInt(payoutDelay)} minutes`
      )],
      ephemeral: true
    });
    
    // Log the action
    logger.info(`Payout settings updated by ${interaction.user.tag} (${interaction.user.id})`, {
      userId: interaction.user.id,
      category: 'config',
      metadata: {
        payoutMode,
        payoutDelay
      }
    });
  } catch (error) {
    logger.error(`Error processing payout settings update: ${error.message}`, {
      userId: interaction.user.id,
      category: 'config',
      stack: error.stack
    });
    
    // Reply with error message
    await interaction.reply({
      embeds: [createErrorEmbed(
        'Error',
        `An error occurred while updating the payout settings: ${error.message}`
      )],
      ephemeral: true
    });
  }
}

/**
 * Handle report settings modal submit
 * @param {Interaction} interaction - The interaction that triggered this
 * @param {Client} client - The Discord client instance
 */
async function submitReportSettingsModalSubmit(interaction, client) {
  try {
    // Get the input values from the modal
    const reportFrequency = interaction.fields.getTextInputValue('reportFrequency');
    const autoSendReports = interaction.fields.getTextInputValue('autoSendReports');
    const timezone = interaction.fields.getTextInputValue('timezone');
    
    // Validate the inputs
    const errors = [];
    
    if (!['Daily', 'Weekly', 'Monthly'].includes(reportFrequency)) {
      errors.push('Report frequency must be one of: Daily, Weekly, Monthly.');
    }
    
    if (autoSendReports !== 'true' && autoSendReports !== 'false') {
      errors.push('Auto-send reports must be either "true" or "false".');
    }
    
    // Validate timezone
    try {
      // Check if timezone is valid
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
    } catch (error) {
      errors.push('Invalid timezone. Please provide a valid IANA timezone identifier.');
    }
    
    // If there are validation errors, display them and return
    if (errors.length > 0) {
      await interaction.reply({
        embeds: [createErrorEmbed(
          'Validation Error',
          `Please correct the following errors:\n\n${errors.join('\n')}`
        )],
        ephemeral: true
      });
      return;
    }
    
    // Update the configurations in the database
    await updateConfig('reportFrequency', reportFrequency, 'reports', 'Frequency of automatic reports (Daily, Weekly, Monthly)', interaction);
    await updateConfig('autoSendReports', autoSendReports, 'reports', 'Automatically send reports to configured channel', interaction);
    await updateConfig('timezone', timezone, 'system', 'Default timezone for date/time display', interaction);
    
    // Update the config object
    config.reports.frequency = reportFrequency;
    config.reports.autoSend = autoSendReports === 'true';
    config.timezone = timezone;
    
    // Send confirmation message
    await interaction.reply({
      embeds: [createSuccessEmbed(
        'Report Settings Updated',
        `The report settings have been updated successfully.\n\n` +
        `Report Frequency: ${reportFrequency}\n` +
        `Auto-Send Reports: ${autoSendReports === 'true' ? 'Enabled' : 'Disabled'}\n` +
        `Default Timezone: ${timezone}`
      )],
      ephemeral: true
    });
    
    // Log the action
    logger.info(`Report settings updated by ${interaction.user.tag} (${interaction.user.id})`, {
      userId: interaction.user.id,
      category: 'config',
      metadata: {
        reportFrequency,
        autoSendReports,
        timezone
      }
    });
  } catch (error) {
    logger.error(`Error processing report settings update: ${error.message}`, {
      userId: interaction.user.id,
      category: 'config',
      stack: error.stack
    });
    
    // Reply with error message
    await interaction.reply({
      embeds: [createErrorEmbed(
        'Error',
        `An error occurred while updating the report settings: ${error.message}`
      )],
      ephemeral: true
    });
  }
}

/**
 * Handle channel configuration modal submit
 * @param {Interaction} interaction - The interaction that triggered this
 * @param {Client} client - The Discord client instance
 */
async function submitChannelConfigModalSubmit(interaction, client) {
  try {
    // Get the input values from the modal
    const bettingAnnouncementsChannel = interaction.fields.getTextInputValue('bettingAnnouncementsChannel');
    const payoutAnnouncementsChannel = interaction.fields.getTextInputValue('payoutAnnouncementsChannel');
    const reportsChannel = interaction.fields.getTextInputValue('reportsChannel');
    const leaderboardChannel = interaction.fields.getTextInputValue('leaderboardChannel');
    const logsChannel = interaction.fields.getTextInputValue('logsChannel');
    
    // Validate the inputs (channel IDs)
    const errors = [];
    const channelRegex = /^\d{17,19}$/;
    
    if (bettingAnnouncementsChannel && !channelRegex.test(bettingAnnouncementsChannel)) {
      errors.push('Betting Announcements Channel ID must be a valid Discord channel ID.');
    }
    
    if (payoutAnnouncementsChannel && !channelRegex.test(payoutAnnouncementsChannel)) {
      errors.push('Payout Announcements Channel ID must be a valid Discord channel ID.');
    }
    
    if (reportsChannel && !channelRegex.test(reportsChannel)) {
      errors.push('Reports Channel ID must be a valid Discord channel ID.');
    }
    
    if (leaderboardChannel && !channelRegex.test(leaderboardChannel)) {
      errors.push('Leaderboard Channel ID must be a valid Discord channel ID.');
    }
    
    if (logsChannel && !channelRegex.test(logsChannel)) {
      errors.push('Logs Channel ID must be a valid Discord channel ID.');
    }
    
    // If there are validation errors, display them and return
    if (errors.length > 0) {
      await interaction.reply({
        embeds: [createErrorEmbed(
          'Validation Error',
          `Please correct the following errors:\n\n${errors.join('\n')}`
        )],
        ephemeral: true
      });
      return;
    }
    
    // Update the configurations in the database
    await updateConfig('bettingAnnouncementsChannel', bettingAnnouncementsChannel, 'channels', 'Channel ID for betting announcements', interaction);
    await updateConfig('payoutAnnouncementsChannel', payoutAnnouncementsChannel, 'channels', 'Channel ID for payout announcements', interaction);
    await updateConfig('reportsChannel', reportsChannel, 'channels', 'Channel ID for reports', interaction);
    await updateConfig('leaderboardChannel', leaderboardChannel, 'channels', 'Channel ID for leaderboard', interaction);
    await updateConfig('logsChannel', logsChannel, 'channels', 'Channel ID for logs', interaction);
    
    // Update the config object
    config.channels.bettingAnnouncements = bettingAnnouncementsChannel;
    config.channels.payoutAnnouncements = payoutAnnouncementsChannel;
    config.channels.reports = reportsChannel;
    config.channels.leaderboard = leaderboardChannel;
    config.channels.logs = logsChannel;
    
    // Get channel names for the confirmation message
    const channelNames = {
      bettingAnnouncements: bettingAnnouncementsChannel ? `<#${bettingAnnouncementsChannel}>` : 'Not set',
      payoutAnnouncements: payoutAnnouncementsChannel ? `<#${payoutAnnouncementsChannel}>` : 'Not set',
      reports: reportsChannel ? `<#${reportsChannel}>` : 'Not set',
      leaderboard: leaderboardChannel ? `<#${leaderboardChannel}>` : 'Not set',
      logs: logsChannel ? `<#${logsChannel}>` : 'Not set'
    };
    
    // Send confirmation message
    await interaction.reply({
      embeds: [createSuccessEmbed(
        'Channel Configuration Updated',
        `The channel configuration has been updated successfully.\n\n` +
        `Betting Announcements Channel: ${channelNames.bettingAnnouncements}\n` +
        `Payout Announcements Channel: ${channelNames.payoutAnnouncements}\n` +
        `Reports Channel: ${channelNames.reports}\n` +
        `Leaderboard Channel: ${channelNames.leaderboard}\n` +
        `Logs Channel: ${channelNames.logs}`
      )],
      ephemeral: true
    });
    
    // Log the action
    logger.info(`Channel configuration updated by ${interaction.user.tag} (${interaction.user.id})`, {
      userId: interaction.user.id,
      category: 'config',
      metadata: {
        bettingAnnouncementsChannel,
        payoutAnnouncementsChannel,
        reportsChannel,
        leaderboardChannel,
        logsChannel
      }
    });
  } catch (error) {
    logger.error(`Error processing channel configuration update: ${error.message}`, {
      userId: interaction.user.id,
      category: 'config',
      stack: error.stack
    });
    
    // Reply with error message
    await interaction.reply({
      embeds: [createErrorEmbed(
        'Error',
        `An error occurred while updating the channel configuration: ${error.message}`
      )],
      ephemeral: true
    });
  }
}

/**
 * Update a configuration value in the database
 * @param {string} key - The configuration key
 * @param {string} value - The configuration value
 * @param {string} category - The configuration category
 * @param {string} description - The configuration description
 * @param {Interaction} interaction - The interaction that triggered this
 */
async function updateConfig(key, value, category, description, interaction) {
  try {
    const { Configuration } = require('../database/models');
    
    // Find the configuration in the database
    const config = await Configuration.findOne({ where: { key } });
    
    // If the configuration exists, update it
    if (config) {
      config.value = value;
      config.category = category;
      config.description = description;
      await config.save();
    }
    // Otherwise, create a new configuration
    else {
      await Configuration.create({
        key,
        value,
        category,
        description
      });
    }
    
    // Log the action
    logger.info(`Configuration "${key}" updated to "${value}" by ${interaction.user.tag} (${interaction.user.id})`, {
      userId: interaction.user.id,
      category: 'config'
    });
  } catch (error) {
    logger.error(`Error updating configuration "${key}": ${error.message}`, {
      userId: interaction.user.id,
      category: 'config',
      stack: error.stack
    });
    
    throw error;
  }
}

// Handle button interactions
async function handleButton(buttonId, interaction, client) {
  try {
    // Validate inputs
    if (!interaction) {
      logger.error(`Configuration settings handleButton called with null interaction for button: ${buttonId}`);
      return;
    }
    
    if (!buttonId) {
      logger.error('Configuration settings handleButton called with null buttonId');
      // Only attempt to reply if not already acknowledged
      if (!interaction.deferred && !interaction.replied) {
        return await safeReply(interaction, {
          embeds: [createErrorEmbed('Error', 'Invalid button ID.')],
          ephemeral: true
        });
      }
      return;
    }
    
    // Safely defer the button interaction to prevent timeouts
    // But only if it hasn't been deferred or replied to already
    if (!interaction.deferred && !interaction.replied) {
      await safeDeferUpdate(interaction);
    }
    
    switch (buttonId) {
      case 'configPanel':
        return await configPanel(interaction, client);
      case 'editBettingConfig':
        return await editBettingConfig(interaction, client);
      case 'editPayoutSettings':
        return await editPayoutSettings(interaction, client);
      case 'editReportSettings':
        return await editReportSettings(interaction, client);
      case 'editChannelConfig':
        return await editChannelConfig(interaction, client);
      case 'openBettingConfigModal':
        // Handle the button click to open the modal that was cached earlier
        const cachedBettingModal = client.cache.get(`bettingConfigModal_${interaction.user.id}`);
        if (cachedBettingModal) {
          await interaction.showModal(cachedBettingModal);
          logger.info(`Betting configuration modal opened from button by ${interaction.user.tag} (${interaction.user.id})`, {
            userId: interaction.user.id,
            category: 'config'
          });
          return;
        } else {
          // Modal data not found or expired, recreate the configuration panel
          logger.warn(`Cached betting modal not found for user ${interaction.user.id}, recreating betting config`);
          return await editBettingConfig(interaction, client);
        }
      case 'openPayoutSettingsModal':
        // Handle the button click to open the modal that was cached earlier
        const cachedPayoutModal = client.cache.get(`payoutSettingsModal_${interaction.user.id}`);
        if (cachedPayoutModal) {
          await interaction.showModal(cachedPayoutModal);
          logger.info(`Payout settings modal opened from button by ${interaction.user.tag} (${interaction.user.id})`, {
            userId: interaction.user.id,
            category: 'config'
          });
          return;
        } else {
          // Modal data not found or expired, recreate the configuration panel
          logger.warn(`Cached payout modal not found for user ${interaction.user.id}, recreating payout settings`);
          return await editPayoutSettings(interaction, client);
        }
      case 'openReportSettingsModal':
        // Handle the button click to open the modal that was cached earlier
        const cachedReportModal = client.cache.get(`reportSettingsModal_${interaction.user.id}`);
        if (cachedReportModal) {
          await interaction.showModal(cachedReportModal);
          logger.info(`Report settings modal opened from button by ${interaction.user.tag} (${interaction.user.id})`, {
            userId: interaction.user.id,
            category: 'config'
          });
          return;
        } else {
          // Modal data not found or expired, recreate the configuration panel
          logger.warn(`Cached report modal not found for user ${interaction.user.id}, recreating report settings`);
          return await editReportSettings(interaction, client);
        }
      case 'openChannelConfigModal':
        // Handle the button click to open the modal that was cached earlier
        const cachedChannelModal = client.cache.get(`channelConfigModal_${interaction.user.id}`);
        if (cachedChannelModal) {
          await interaction.showModal(cachedChannelModal);
          logger.info(`Channel configuration modal opened from button by ${interaction.user.tag} (${interaction.user.id})`, {
            userId: interaction.user.id,
            category: 'config'
          });
          return;
        } else {
          // Modal data not found or expired, recreate the configuration panel
          logger.warn(`Cached channel modal not found for user ${interaction.user.id}, recreating channel config`);
          return await editChannelConfig(interaction, client);
        }
      case 'toggleDebugMode':
        return await toggleDebugMode(interaction, client);
      case 'adminPanel':
        return await require('./adminPanel').createPanel(interaction, client);
      default:
        // Handle unknown button ID
        return await safeReply(interaction, {
          embeds: [createErrorEmbed('Error', `Unknown button ID: ${buttonId}`)],
          ephemeral: true
        });
    }
  } catch (error) {
    logger.error(`Error handling button ${buttonId} in configurationSettings:`, error);
    return await handleInteractionError(error, interaction, `configSettings:${buttonId}`);
  }
}

// Handle modal submissions
async function handleModalSubmit(modalId, interaction, client) {
  try {
    // Validate inputs
    if (!interaction) {
      logger.error(`Configuration settings handleModalSubmit called with null interaction for modal: ${modalId}`);
      return;
    }
    
    if (!modalId) {
      logger.error('Configuration settings handleModalSubmit called with null modalId');
      // Only attempt to reply if not already acknowledged
      if (!interaction.deferred && !interaction.replied) {
        return await safeReply(interaction, {
          embeds: [createErrorEmbed('Error', 'Invalid modal ID.')],
          ephemeral: true
        });
      }
      return;
    }
    
    // For modal submissions, we should use safeDefer, not safeDeferUpdate
    // But only if it hasn't been deferred or replied to already
    if (!interaction.deferred && !interaction.replied) {
      await safeDefer(interaction, true);
    }
    
    switch (modalId) {
      case 'submitBettingConfig':
        return await submitBettingConfigModalSubmit(interaction, client);
      case 'submitPayoutSettings':
        return await submitPayoutSettingsModalSubmit(interaction, client);
      case 'submitReportSettings':
        return await submitReportSettingsModalSubmit(interaction, client);
      case 'submitChannelConfig':
        return await submitChannelConfigModalSubmit(interaction, client);
      default:
        return await safeReply(interaction, {
          embeds: [createErrorEmbed(
            'Unknown Modal',
            `The modal "${modalId}" is not configured correctly.`
          )],
          ephemeral: true
        });
    }
  } catch (error) {
    logger.error(`Error handling modal submission ${modalId} in configurationSettings:`, error);
    return await handleInteractionError(error, interaction, `configSettings:modal:${modalId}`);
  }
}

module.exports = {
  configPanel,
  editBettingConfig,
  editPayoutSettings,
  editReportSettings,
  editChannelConfig,
  toggleDebugMode,
  submitBettingConfigModalSubmit,
  submitPayoutSettingsModalSubmit,
  submitReportSettingsModalSubmit,
  submitChannelConfigModalSubmit,
  updateConfig,
  handleButton,
  handleModalSubmit
};