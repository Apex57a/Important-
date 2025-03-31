// Reports & Logs Module for KrayStakes Discord Bot
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');
const { format, subDays, subWeeks, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth } = require('date-fns');
const { formatInTimeZone } = require('date-fns-tz');
const logger = require('../utils/logger');
const config = require('../config');
const db = require('../database/dbInit');
const { checkPermission } = require('../utils/permissions');

// Main reports panel
async function reportsPanel(interaction, client) {
  try {
    // Check permissions
    const hasPermission = await checkPermission(interaction.member, ['serverAdmin', 'admin', 'management']);
    
    if (!hasPermission) {
      return interaction.reply({
        content: 'You do not have permission to access reports. This action requires Server Admin, Admin, or Management role.',
        ephemeral: true
      });
    }
    
    // Create the embed for reports panel
    const embed = new EmbedBuilder()
      .setColor(config.colors.primary)
      .setTitle('KrayStakes Reports')
      .setDescription('Generate and view reports for the KrayStakes betting system.')
      .addFields(
        { name: `${config.emojis.money} Financial Reports`, value: 'Generate reports on betting activity and payouts.' }
      )
      .setFooter({ text: 'KrayStakes LTD Reports Panel' })
      .setTimestamp();
    
    // Create buttons for report types
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('reportsLogs_dailyReport')
          .setLabel('Daily Report')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📅'),
        new ButtonBuilder()
          .setCustomId('reportsLogs_weeklyReport')
          .setLabel('Weekly Report')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📆'),
        new ButtonBuilder()
          .setCustomId('reportsLogs_monthlyReport')
          .setLabel('Monthly Report')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📊')
      );
    
    const row2 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('reportsLogs_customDateReport')
          .setLabel('Custom Date Range')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🗓️'),
        new ButtonBuilder()
          .setCustomId('reportsLogs_exportData')
          .setLabel('Export Data')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📤')
      );
    
    // Send the panel
    await interaction.reply({
      embeds: [embed],
      components: [row, row2],
      ephemeral: true
    });
    
    logger.info(`Reports panel opened by ${interaction.user.tag}`, {
      category: 'Reports',
      userId: interaction.user.id,
      username: interaction.user.tag
    });
  } catch (error) {
    logger.error(`Error opening reports panel: ${error.message}`, { stack: error.stack });
    
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: 'There was an error opening the reports panel. This has been logged.',
        ephemeral: true
      });
    }
  }
}

// Generate weekly report (scheduled task)
async function generateWeeklyReport(client) {
  try {
    logger.info('Generating weekly report');
    
    // Get the configured timezone
    const timezone = config.timezone || 'UTC';
    
    // Calculate date range (last week)
    const endDate = new Date();
    const startDate = subWeeks(endDate, 1);
    
    // Generate the report
    const reportText = await generateReportText(startDate, endDate, 'Weekly', timezone);
    
    // Get the reports channel
    const reportsChannelId = config.channels.reports;
    if (!reportsChannelId) {
      logger.warn('No reports channel configured. Cannot send weekly report.');
      return;
    }
    
    // Get the channel
    const reportsChannel = await client.channels.fetch(reportsChannelId).catch(error => {
      logger.error(`Error fetching reports channel: ${error.message}`, { stack: error.stack });
      return null;
    });
    
    if (!reportsChannel) {
      logger.error(`Reports channel with ID ${reportsChannelId} not found.`);
      return;
    }
    
    // Format the date range
    const formattedStartDate = formatInTimeZone(startDate, timezone, 'MMM d, yyyy');
    const formattedEndDate = formatInTimeZone(endDate, timezone, 'MMM d, yyyy');
    
    // Create the embed
    const embed = new EmbedBuilder()
      .setColor(config.colors.primary)
      .setTitle(`Weekly Report: ${formattedStartDate} - ${formattedEndDate}`)
      .setDescription(reportText)
      .setFooter({ text: `KrayStakes LTD Weekly Report • Generated at ${formatInTimeZone(new Date(), timezone, 'MMM d, yyyy h:mm a zzz')}` })
      .setTimestamp();
    
    // Send the report
    await reportsChannel.send({ embeds: [embed] });
    
    logger.info('Weekly report generated and sent successfully');
  } catch (error) {
    logger.error(`Error generating weekly report: ${error.message}`, { stack: error.stack });
  }
}

// Generate monthly report (scheduled task)
async function generateMonthlyReport(client) {
  try {
    logger.info('Generating monthly report');
    
    // Get the configured timezone
    const timezone = config.timezone || 'UTC';
    
    // Calculate date range (last month)
    const endDate = new Date();
    const startDate = subMonths(endDate, 1);
    
    // Generate the report
    const reportText = await generateReportText(startDate, endDate, 'Monthly', timezone);
    
    // Get the reports channel
    const reportsChannelId = config.channels.reports;
    if (!reportsChannelId) {
      logger.warn('No reports channel configured. Cannot send monthly report.');
      return;
    }
    
    // Get the channel
    const reportsChannel = await client.channels.fetch(reportsChannelId).catch(error => {
      logger.error(`Error fetching reports channel: ${error.message}`, { stack: error.stack });
      return null;
    });
    
    if (!reportsChannel) {
      logger.error(`Reports channel with ID ${reportsChannelId} not found.`);
      return;
    }
    
    // Format the date range
    const formattedStartDate = formatInTimeZone(startDate, timezone, 'MMM d, yyyy');
    const formattedEndDate = formatInTimeZone(endDate, timezone, 'MMM d, yyyy');
    
    // Create the embed
    const embed = new EmbedBuilder()
      .setColor(config.colors.primary)
      .setTitle(`Monthly Report: ${formattedStartDate} - ${formattedEndDate}`)
      .setDescription(reportText)
      .setFooter({ text: `KrayStakes LTD Monthly Report • Generated at ${formatInTimeZone(new Date(), timezone, 'MMM d, yyyy h:mm a zzz')}` })
      .setTimestamp();
    
    // Send the report
    await reportsChannel.send({ embeds: [embed] });
    
    logger.info('Monthly report generated and sent successfully');
  } catch (error) {
    logger.error(`Error generating monthly report: ${error.message}`, { stack: error.stack });
  }
}

// Generate report text
async function generateReportText(startDate, endDate, reportType, timezone) {
  try {
    // Database queries
    const { Event, Bet, Payout } = db.models;
    const { Op } = db.Sequelize;
    
    // Format the date range for queries
    const startDateStr = startDate.toISOString();
    const endDateStr = endDate.toISOString();
    
    // Get events created in the date range
    const events = await Event.count({
      where: {
        createdAt: {
          [Op.between]: [startDateStr, endDateStr]
        }
      }
    });
    
    // Get completed events in the date range
    const completedEvents = await Event.count({
      where: {
        status: 'Completed',
        updatedAt: {
          [Op.between]: [startDateStr, endDateStr]
        }
      }
    });
    
    // Get total bets placed in the date range
    const totalBets = await Bet.count({
      where: {
        createdAt: {
          [Op.between]: [startDateStr, endDateStr]
        }
      }
    });
    
    // Get total bet amount in the date range
    const totalBetAmount = await Bet.sum('amount', {
      where: {
        createdAt: {
          [Op.between]: [startDateStr, endDateStr]
        }
      }
    }) || 0;
    
    // Get total payouts processed in the date range
    const totalPayouts = await Payout.count({
      where: {
        status: 'Completed',
        processedDate: {
          [Op.between]: [startDateStr, endDateStr]
        }
      }
    });
    
    // Get total payout amount in the date range
    const totalPayoutAmount = await Payout.sum('amount', {
      where: {
        status: 'Completed',
        processedDate: {
          [Op.between]: [startDateStr, endDateStr]
        }
      }
    }) || 0;
    
    // Calculate profits
    const profits = totalBetAmount - totalPayoutAmount;
    
    // Create the report text
    let reportText = `# ${reportType} Report Summary\n\n`;
    reportText += `**Period:** ${formatInTimeZone(startDate, timezone, 'MMM d, yyyy')} - ${formatInTimeZone(endDate, timezone, 'MMM d, yyyy')}\n\n`;
    reportText += `**Events Created:** ${events}\n`;
    reportText += `**Events Completed:** ${completedEvents}\n\n`;
    reportText += `**Total Bets Placed:** ${totalBets}\n`;
    reportText += `**Total Bet Amount:** $${totalBetAmount.toLocaleString()}\n\n`;
    reportText += `**Payouts Processed:** ${totalPayouts}\n`;
    reportText += `**Total Payout Amount:** $${totalPayoutAmount.toLocaleString()}\n\n`;
    reportText += `**Net Profit/Loss:** $${profits.toLocaleString()}\n`;
    
    return reportText;
  } catch (error) {
    logger.error(`Error generating report text: ${error.message}`, { stack: error.stack });
    return `Error generating report: ${error.message}`;
  }
}

module.exports = {
  reportsPanel,
  generateWeeklyReport,
  generateMonthlyReport,
  generateReportText
};