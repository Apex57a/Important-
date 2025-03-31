// KrayStakes Discord Bot - Embeds
const { EmbedBuilder } = require('discord.js');
const { formatDate, getTimeRemaining } = require('./timeUtils');
const config = require('../config');

/**
 * Create an embed for an event announcement
 * @param {Object} event - The event object from the database
 * @param {string} timezone - The timezone to display times in
 * @returns {EmbedBuilder} - The configured embed
 */
function createEventEmbed(event, timezone = 'UTC') {
  // Initialize embed with color based on event type
  const embed = new EmbedBuilder()
    .setColor(getEventColor(event.type))
    .setTitle(`${getEventEmoji(event.type)} ${event.name}`)
    .setDescription(event.description || '*No description provided*');

  // Add event details
  let detailsField = '';
  if (event.scheduledTime) {
    detailsField += `📅 **Date & Time:** ${formatDate(event.scheduledTime, 'PPpp', timezone)}\n`;
    detailsField += `⏱️ **Time Until Event:** ${getTimeRemaining(event.scheduledTime)}\n`;
  }
  if (event.location) {
    detailsField += `📍 **Location:** ${event.location}\n`;
  }
  detailsField += `🏆 **Type:** ${event.type.charAt(0).toUpperCase() + event.type.slice(1)}\n`;
  detailsField += `📊 **Status:** ${getStatusWithEmoji(event.status)}\n`;
  embed.addFields({ name: 'Event Details', value: detailsField });

  // Add betting options
  const optionsField = event.choices.map((choice, index) => {
    // Get choice name, supporting both string and object formats
    const choiceName = typeof choice === 'string' ? choice : choice.name;
    return `${index + 1}. ${choiceName}`;
  }).join('\n');
  embed.addFields({ name: 'Betting Options', value: optionsField });

  // Add betting limits
  let limitsField = '';
  limitsField += `💰 **Min Bet:** ${event.minBet} coins\n`;
  limitsField += `💵 **Max Bet:** ${event.maxBet} coins\n`;
  limitsField += `🔄 **Bets Per User:** ${event.limitPerUser}\n`;
  limitsField += `💼 **House Fee:** ${event.feePercent}%\n`;
  embed.addFields({ name: 'Betting Limits', value: limitsField });

  // Add footer
  embed.setFooter({ 
    text: `Event ID: ${event.id} • Created by ${event.createdBy}`,
  });
  embed.setTimestamp();

  return embed;
}

/**
 * Create an embed for winners announcement
 * @param {Object} event - The event object from the database
 * @param {Array} winners - Array of winners
 * @param {string} timezone - The timezone to display times in
 * @returns {EmbedBuilder} - The configured embed
 */
function createWinnersEmbed(event, winners, timezone = 'UTC') {
  // Initialize embed with color based on event type
  const embed = new EmbedBuilder()
    .setColor(getEventColor(event.type))
    .setTitle(`🏆 Winners Announced: ${event.name}`)
    .setDescription(event.customResults || '*No custom results provided*');

  // Add event details
  let detailsField = '';
  if (event.scheduledTime) {
    detailsField += `📅 **Event Date:** ${formatDate(event.scheduledTime, 'PPpp', timezone)}\n`;
  }
  if (event.location) {
    detailsField += `📍 **Location:** ${event.location}\n`;
  }
  detailsField += `🏆 **Type:** ${event.type.charAt(0).toUpperCase() + event.type.slice(1)}\n`;
  detailsField += `📊 **Status:** ${getStatusWithEmoji(event.status)}\n`;
  embed.addFields({ name: 'Event Details', value: detailsField });

  // Add winning results
  if (winners && winners.length > 0) {
    const winnersField = winners.map((winnerIndex) => {
      const choice = event.choices[winnerIndex];
      const choiceName = typeof choice === 'string' ? choice : choice.name;
      return `🥇 **${choiceName}**`;
    }).join('\n');
    embed.addFields({ name: 'Winning Choices', value: winnersField });
  } else {
    embed.addFields({ name: 'Winning Choices', value: '*No winners selected yet*' });
  }

  // Add betting stats
  let statsField = '';
  statsField += `💰 **Total Bets:** ${event.totalBetsAmount} coins\n`;
  statsField += `👥 **Number of Bets:** ${event.totalBetsCount}\n`;
  statsField += `💼 **House Fee:** ${event.feePercent}%\n`;
  embed.addFields({ name: 'Betting Statistics', value: statsField });

  // Add footer
  embed.setFooter({ 
    text: `Event ID: ${event.id} • Winners selected by staff`,
  });
  embed.setTimestamp();

  return embed;
}

/**
 * Create an embed for event list
 * @param {Array} events - Array of event objects
 * @param {string} timezone - The timezone to display times in
 * @param {string} title - The title for the embed
 * @returns {EmbedBuilder} - The configured embed
 */
function createEventListEmbed(events, timezone = 'UTC', title = 'Events List') {
  // Initialize embed
  const embed = new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle(title)
    .setDescription(`Showing ${events.length} events (Timezone: ${timezone})`);

  // Group events by status
  const pendingEvents = events.filter(e => e.status === 'pending');
  const openEvents = events.filter(e => e.status === 'open');
  const pausedEvents = events.filter(e => e.status === 'paused');
  const lockedEvents = events.filter(e => e.status === 'locked');
  const completedEvents = events.filter(e => e.status === 'completed');

  // Add event groups as fields
  if (openEvents.length > 0) {
    const fieldValue = openEvents.map(event => {
      let line = `**${event.name}** (ID: ${event.id})`;
      if (event.scheduledTime) {
        line += `\n📅 ${formatDate(event.scheduledTime, 'Pp', timezone)} (${getTimeRemaining(event.scheduledTime)})`;
      }
      return line;
    }).join('\n\n');
    embed.addFields({ name: '🟢 Open Events', value: fieldValue });
  }

  if (pendingEvents.length > 0) {
    const fieldValue = pendingEvents.map(event => {
      let line = `**${event.name}** (ID: ${event.id})`;
      if (event.scheduledTime) {
        line += `\n📅 ${formatDate(event.scheduledTime, 'Pp', timezone)} (${getTimeRemaining(event.scheduledTime)})`;
      }
      return line;
    }).join('\n\n');
    embed.addFields({ name: '⚪ Pending Events', value: fieldValue });
  }

  if (pausedEvents.length > 0) {
    const fieldValue = pausedEvents.map(event => {
      let line = `**${event.name}** (ID: ${event.id})`;
      if (event.scheduledTime) {
        line += `\n📅 ${formatDate(event.scheduledTime, 'Pp', timezone)} (${getTimeRemaining(event.scheduledTime)})`;
      }
      return line;
    }).join('\n\n');
    embed.addFields({ name: '⏸️ Paused Events', value: fieldValue });
  }

  if (lockedEvents.length > 0) {
    const fieldValue = lockedEvents.map(event => {
      let line = `**${event.name}** (ID: ${event.id})`;
      if (event.scheduledTime) {
        line += `\n📅 ${formatDate(event.scheduledTime, 'Pp', timezone)} (${getTimeRemaining(event.scheduledTime)})`;
      }
      return line;
    }).join('\n\n');
    embed.addFields({ name: '🔒 Locked Events', value: fieldValue });
  }

  if (completedEvents.length > 0) {
    const fieldValue = completedEvents.map(event => {
      let line = `**${event.name}** (ID: ${event.id})`;
      if (event.scheduledTime) {
        line += `\n📅 ${formatDate(event.scheduledTime, 'Pp', timezone)}`;
      }
      return line;
    }).join('\n\n');
    embed.addFields({ name: '✅ Completed Events', value: fieldValue });
  }

  // Add footer
  embed.setFooter({ text: 'Use /event info <id> to view details about a specific event' });
  embed.setTimestamp();

  return embed;
}

/**
 * Create an embed for bet list
 * @param {Array} bets - Array of bet objects
 * @param {Object} event - The event object
 * @param {string} timezone - The timezone to display times in
 * @returns {EmbedBuilder} - The configured embed
 */
function createBetListEmbed(bets, event, timezone = 'UTC') {
  // Initialize embed
  const embed = new EmbedBuilder()
    .setColor(getEventColor(event.type))
    .setTitle(`Bets for ${event.name}`)
    .setDescription(`Showing ${bets.length} bets for Event ID: ${event.id}`);

  // Group bets by choice
  const betsByChoice = {};
  event.choices.forEach((choice, index) => {
    const choiceName = typeof choice === 'string' ? choice : choice.name;
    betsByChoice[index] = {
      name: choiceName,
      bets: bets.filter(b => b.choiceIndex === index),
      totalAmount: 0
    };
  });

  // Calculate totals
  bets.forEach(bet => {
    if (betsByChoice[bet.choiceIndex]) {
      betsByChoice[bet.choiceIndex].totalAmount += bet.amount;
    }
  });

  // Add bet groups as fields
  Object.values(betsByChoice).forEach(choiceGroup => {
    if (choiceGroup.bets.length > 0) {
      const fieldValue = choiceGroup.bets.map(bet => {
        return `**${bet.userTag}** - ${bet.amount} coins (${bet.status})`;
      }).join('\n');
      
      embed.addFields({ 
        name: `${choiceGroup.name} (${choiceGroup.bets.length} bets, ${choiceGroup.totalAmount} coins)`, 
        value: fieldValue 
      });
    }
  });

  // Add footer
  embed.setFooter({ 
    text: `Total: ${bets.length} bets, ${bets.reduce((sum, bet) => sum + bet.amount, 0)} coins`,
  });
  embed.setTimestamp();

  return embed;
}

/**
 * Create an embed for payout list
 * @param {Array} payouts - Array of payout objects
 * @param {Object} event - The event object
 * @param {string} timezone - The timezone to display times in
 * @returns {EmbedBuilder} - The configured embed
 */
function createPayoutListEmbed(payouts, event, timezone = 'UTC') {
  // Initialize embed
  const embed = new EmbedBuilder()
    .setColor(getEventColor(event.type))
    .setTitle(`Payouts for ${event.name}`)
    .setDescription(`Showing ${payouts.length} payouts for Event ID: ${event.id}`);

  // Group payouts by status
  const pendingPayouts = payouts.filter(p => p.status === 'pending');
  const completedPayouts = payouts.filter(p => p.status === 'completed');
  const cancelledPayouts = payouts.filter(p => p.status === 'cancelled');

  // Add payout groups as fields
  if (pendingPayouts.length > 0) {
    const fieldValue = pendingPayouts.map(payout => {
      let line = `**${payout.userTag}** - ${payout.amount} coins`;
      if (payout.method) {
        line += ` (${payout.method})`;
      }
      return line;
    }).join('\n');
    embed.addFields({ 
      name: `⏳ Pending Payouts (${pendingPayouts.length})`, 
      value: fieldValue 
    });
  }

  if (completedPayouts.length > 0) {
    const fieldValue = completedPayouts.map(payout => {
      let line = `**${payout.userTag}** - ${payout.amount} coins`;
      if (payout.processedAt) {
        line += ` - Paid on ${formatDate(payout.processedAt, 'PP', timezone)}`;
      }
      return line;
    }).join('\n');
    embed.addFields({ 
      name: `✅ Completed Payouts (${completedPayouts.length})`, 
      value: fieldValue 
    });
  }

  if (cancelledPayouts.length > 0) {
    const fieldValue = cancelledPayouts.map(payout => {
      return `**${payout.userTag}** - ${payout.amount} coins`;
    }).join('\n');
    embed.addFields({ 
      name: `❌ Cancelled Payouts (${cancelledPayouts.length})`, 
      value: fieldValue 
    });
  }

  // Add footer with totals
  const totalAmount = payouts.reduce((sum, payout) => sum + payout.amount, 0);
  const totalFees = payouts.reduce((sum, payout) => sum + payout.feeAmount, 0);
  embed.setFooter({ 
    text: `Total: ${payouts.length} payouts, ${totalAmount} coins, ${totalFees} in fees`,
  });
  embed.setTimestamp();

  return embed;
}

/**
 * Get a color for an event type
 * @param {string} eventType - The event type
 * @returns {string} - Hex color code
 */
function getEventColor(eventType) {
  switch (eventType.toLowerCase()) {
    case 'boxing':
      return '#FF0000'; // Red
    case 'racing':
      return '#00FF00'; // Green
    case 'paintball':
      return '#0000FF'; // Blue
    case 'custom':
    default:
      return '#FFA500'; // Orange
  }
}

/**
 * Get an emoji for an event type
 * @param {string} eventType - The event type
 * @returns {string} - Emoji
 */
function getEventEmoji(eventType) {
  switch (eventType.toLowerCase()) {
    case 'boxing':
      return '🥊';
    case 'racing':
      return '🏎️';
    case 'paintball':
      return '🔫';
    case 'custom':
    default:
      return '🎮';
  }
}

/**
 * Get status text with emoji
 * @param {string} status - The event status
 * @returns {string} - Status with emoji
 */
function getStatusWithEmoji(status) {
  switch (status) {
    case 'pending':
      return '⚪ Pending';
    case 'open':
      return '🟢 Open for Betting';
    case 'locked':
      return '🔒 Locked';
    case 'paused':
      return '⏸️ Paused';
    case 'completed':
      return '✅ Completed';
    case 'cancelled':
      return '❌ Cancelled';
    default:
      return status;
  }
}

/**
 * Create an error embed
 * @param {string} title - The title of the error
 * @param {string} description - The error description
 * @returns {EmbedBuilder} - The configured embed
 */
function createErrorEmbed(title, description) {
  return new EmbedBuilder()
    .setColor('#FF0000')
    .setTitle(`❌ ${title}`)
    .setDescription(description)
    .setTimestamp();
}

/**
 * Create a success embed
 * @param {string} title - The title of the success message
 * @param {string} description - The success description
 * @returns {EmbedBuilder} - The configured embed
 */
function createSuccessEmbed(title, description) {
  return new EmbedBuilder()
    .setColor('#00FF00')
    .setTitle(`✅ ${title}`)
    .setDescription(description)
    .setTimestamp();
}

/**
 * Create a warning embed
 * @param {string} title - The title of the warning
 * @param {string} description - The warning description
 * @returns {EmbedBuilder} - The configured embed
 */
function createWarningEmbed(title, description) {
  return new EmbedBuilder()
    .setColor('#FFA500')
    .setTitle(`⚠️ ${title}`)
    .setDescription(description)
    .setTimestamp();
}

module.exports = {
  createEventEmbed,
  createWinnersEmbed,
  createEventListEmbed,
  createBetListEmbed,
  createPayoutListEmbed,
  getEventColor,
  getEventEmoji,
  getStatusWithEmoji,
  createErrorEmbed,
  createSuccessEmbed,
  createWarningEmbed
};