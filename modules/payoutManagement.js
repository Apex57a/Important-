// Payout Management Module - Handles processing and confirming payouts to winners
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ComponentType
} = require('discord.js');
const { models } = require('../database/dbInit');
const logger = require('../utils/logger');
const { formatDateTime } = require('../utils/timeUtils');
const { Op } = require('sequelize');
const { format } = require('date-fns');
const { utcToZonedTime } = require('date-fns-tz');

// Handle the payoutPanel button click from admin panel
async function payoutPanel(interaction, client) {
  try {
    await interaction.deferReply({ ephemeral: true });
    
    // Get events that have approved winners but not all payouts processed
    const events = await models.Event.findAll({
      where: {
        winnerApproved: true,
        status: 'Closed'
      },
      order: [['updatedAt', 'DESC']]
    });
    
    // Filter events that have unpaid winners
    const eventsWithUnpaidWinners = [];
    
    for (const event of events) {
      const unpaidWinners = await models.Bet.count({
        where: {
          eventId: event.id,
          isWinner: true,
          paidOut: false
        }
      });
      
      if (unpaidWinners > 0) {
        eventsWithUnpaidWinners.push({
          event,
          unpaidCount: unpaidWinners
        });
      }
    }
    
    if (eventsWithUnpaidWinners.length === 0) {
      // Get events with paid winners for historical view
      const paidEvents = await models.Event.findAll({
        where: {
          winnerApproved: true,
          status: 'Closed',
          totalPayout: {
            [Op.gt]: 0
          }
        },
        order: [['updatedAt', 'DESC']],
        limit: 5
      });
      
      if (paidEvents.length === 0) {
        return interaction.editReply({
          content: 'There are no events with winners to process payouts for. Use the "Winner Selection" panel to approve winners first.',
          ephemeral: true
        });
      }
      
      // Create the payout history embed
      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('Payout Management')
        .setDescription('All winners have been paid out! Here are the most recent completed events:')
        .setTimestamp();
      
      // Add fields for completed events
      for (const event of paidEvents) {
        const paidOutBets = await models.Bet.count({
          where: {
            eventId: event.id,
            isWinner: true,
            paidOut: true
          }
        });
        
        embed.addFields({
          name: event.name,
          value: `Total payout: $${event.totalPayout} to ${paidOutBets} winners\nWinning choice: ${event.result?.winningChoice || 'Unknown'}`
        });
      }
      
      // Create a lookup button for history
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('payoutManagement_historyLookup')
            .setLabel('Payout History Lookup')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🔍')
        );
      
      // Send the message
      await interaction.editReply({
        embeds: [embed],
        components: [row],
        ephemeral: true
      });
      
      logger.info(`Payout panel viewed (all paid) by ${interaction.user.tag}`);
      return;
    }
    
    // Create the payout selection embed
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Payout Management')
      .setDescription('Select an event to process payouts:')
      .setTimestamp();
    
    // Create a select menu for events with unpaid winners
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('payoutManagement_selectEvent')
      .setPlaceholder('Select an event...');
    
    // Add options for each event
    for (const { event, unpaidCount } of eventsWithUnpaidWinners) {
      selectMenu.addOptions({
        label: event.name,
        description: `${unpaidCount} unpaid winners | Total payout: $${event.totalPayout}`,
        value: event.id.toString()
      });
    }
    
    // Create a history lookup button
    const historyButton = new ButtonBuilder()
      .setCustomId('payoutManagement_historyLookup')
      .setLabel('Payout History Lookup')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔍');
    
    const row1 = new ActionRowBuilder().addComponents(selectMenu);
    const row2 = new ActionRowBuilder().addComponents(historyButton);
    
    // Send the event selection message
    await interaction.editReply({
      embeds: [embed],
      components: [row1, row2],
      ephemeral: true
    });
    
    logger.info(`Payout panel opened by ${interaction.user.tag}`);
  } catch (error) {
    logger.error('Error in payoutPanel function:', error);
    
    if (interaction.deferred) {
      await interaction.editReply({
        content: 'An error occurred while loading the payout panel. Please try again.',
        ephemeral: true
      });
    } else {
      await interaction.reply({
        content: 'An error occurred while loading the payout panel. Please try again.',
        ephemeral: true
      });
    }
  }
}

// Handle event selection from payout panel
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
    
    // Fetch winners for this event
    const winners = await models.Bet.findAll({
      where: {
        eventId: event.id,
        isWinner: true
      },
      order: [['winningAmount', 'DESC']]
    });
    
    // Count unpaid winners
    const unpaidWinners = winners.filter(winner => !winner.paidOut);
    
    // Create the winners list embed
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle(`Payout Management: ${event.name}`)
      .setDescription(`Winning choice: **${event.result?.winningChoice || 'Unknown'}**\n\nSelect winners to mark as paid:`)
      .addFields(
        { name: 'Total Winners', value: `${winners.length}`, inline: true },
        { name: 'Unpaid Winners', value: `${unpaidWinners.length}`, inline: true },
        { name: 'Total Payout', value: `$${event.totalPayout}`, inline: true }
      )
      .setFooter({ text: `Event ID: ${event.id}` })
      .setTimestamp();
    
    // If there are unpaid winners, create a select menu
    if (unpaidWinners.length > 0) {
      // Create a select menu for unpaid winners
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`payoutManagement_selectWinner_${eventId}`)
        .setPlaceholder('Select a winner to process payout...');
      
      // Add options for each unpaid winner (limited to 25 by Discord)
      const displayLimit = Math.min(unpaidWinners.length, 25);
      
      for (let i = 0; i < displayLimit; i++) {
        const winner = unpaidWinners[i];
        selectMenu.addOptions({
          label: winner.username,
          description: `Bet: $${winner.amount} | Winnings: $${winner.winningAmount}`,
          value: winner.id.toString()
        });
      }
      
      const row1 = new ActionRowBuilder().addComponents(selectMenu);
      
      // Create a full payout button
      const fullPayoutButton = new ButtonBuilder()
        .setCustomId(`payoutManagement_confirmAllPayouts_${eventId}`)
        .setLabel('Mark All as Paid & Announce')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅');
      
      // Create a back button
      const backButton = new ButtonBuilder()
        .setCustomId('payoutManagement_payoutPanel')
        .setLabel('Back to Events')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⬅️');
      
      const row2 = new ActionRowBuilder().addComponents(fullPayoutButton, backButton);
      
      // Send the winner selection message
      await interaction.editReply({
        embeds: [embed],
        components: [row1, row2],
        ephemeral: true
      });
    } else {
      // If all winners are paid, show a message and button to go back
      embed.setDescription(`Winning choice: **${event.result?.winningChoice || 'Unknown'}**\n\nAll winners for this event have been paid!`);
      
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('payoutManagement_payoutPanel')
            .setLabel('Back to Events')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('⬅️')
        );
      
      await interaction.editReply({
        embeds: [embed],
        components: [row],
        ephemeral: true
      });
    }
    
    logger.info(`Payout winners list viewed for event "${event.name}" (ID: ${event.id}) by ${interaction.user.tag}`);
  } catch (error) {
    logger.error('Error in selectEventSelect function:', error);
    await interaction.editReply({
      content: 'An error occurred while loading the winners. Please try again.',
      components: [],
      ephemeral: true
    });
  }
}

// Handle winner selection for payout
async function selectWinnerSelect(interaction, client, params) {
  try {
    const eventId = params[0];
    const selectedBetId = interaction.values[0];
    
    // Fetch the event from the database
    const event = await models.Event.findByPk(eventId);
    
    if (!event) {
      return interaction.reply({
        content: 'The selected event could not be found. It may have been deleted.',
        ephemeral: true
      });
    }
    
    // Fetch the selected bet/winner
    const winner = await models.Bet.findByPk(selectedBetId);
    
    if (!winner) {
      return interaction.reply({
        content: 'The selected winner could not be found. Please try again.',
        ephemeral: true
      });
    }
    
    // Create the bank ID input modal
    const modal = new ModalBuilder()
      .setCustomId(`payoutManagement_submitBankId_${eventId}_${selectedBetId}`)
      .setTitle(`Process Payout for ${winner.username}`);
    
    // Add text input for bank ID
    const bankIdInput = new TextInputBuilder()
      .setCustomId('bankId')
      .setLabel('Enter Bank ID')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g., 12345')
      .setRequired(true);
    
    // Add additional notes input
    const notesInput = new TextInputBuilder()
      .setCustomId('notes')
      .setLabel('Additional Notes (Optional)')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false);
    
    // Add inputs to action rows
    const firstActionRow = new ActionRowBuilder().addComponents(bankIdInput);
    const secondActionRow = new ActionRowBuilder().addComponents(notesInput);
    
    // Add action rows to modal
    modal.addComponents(firstActionRow, secondActionRow);
    
    // Show the modal to the user
    await interaction.showModal(modal);
    
    logger.info(`Payout form opened for ${winner.username} (Bet ID: ${winner.id}) by ${interaction.user.tag}`);
  } catch (error) {
    logger.error('Error in selectWinnerSelect function:', error);
    await interaction.reply({
      content: 'An error occurred while processing the winner selection. Please try again.',
      ephemeral: true
    });
  }
}

// Handle bank ID modal submission
async function submitBankIdModalSubmit(interaction, client, params) {
  try {
    await interaction.deferReply({ ephemeral: true });
    
    const eventId = params[0];
    const betId = params[1];
    
    // Get values from the modal
    const bankId = interaction.fields.getTextInputValue('bankId');
    const notes = interaction.fields.getTextInputValue('notes') || null;
    
    // Fetch the event and bet from the database
    const event = await models.Event.findByPk(eventId);
    const bet = await models.Bet.findByPk(betId);
    
    if (!event || !bet) {
      return interaction.editReply({
        content: 'The selected event or winner could not be found. Please try again.',
        ephemeral: true
      });
    }
    
    // Update the bet with payout information
    await bet.update({
      paidOut: true,
      payoutTimestamp: new Date(),
      payoutConfirmedBy: interaction.user.id,
      bankId: bankId
    });
    
    // Create a payout record in the database
    await models.Payout.create({
      eventId: event.id,
      betId: bet.id,
      userId: bet.userId,
      username: bet.username,
      amount: bet.winningAmount,
      confirmedBy: interaction.user.id,
      status: 'Completed',
      notes: notes,
      bankId: bankId
    });
    
    // Log the payout
    await models.Log.create({
      category: 'PayoutHistory',
      level: 'info',
      message: `Payout processed for ${bet.username} in event "${event.name}" (ID: ${event.id})`,
      userId: interaction.user.id,
      username: interaction.user.tag,
      eventId: event.id,
      details: {
        betId: bet.id,
        betterUsername: bet.username,
        betterId: bet.userId,
        amount: bet.winningAmount,
        bankId: bankId,
        notes: notes
      }
    });
    
    // Try to send a DM to the user if they're in the server
    try {
      const user = await client.users.fetch(bet.userId);
      if (user) {
        await user.send({
          embeds: [
            new EmbedBuilder()
              .setColor('#00FF00')
              .setTitle(`Payout Confirmation: ${event.name}`)
              .setDescription(`Hello, your betting reward ($${bet.winningAmount}) has been transferred to your Bank ID (#${bankId}).`)
              .addFields(
                { name: 'Event', value: event.name, inline: true },
                { name: 'Winning Choice', value: bet.choice, inline: true },
                { name: 'Your Bet', value: `$${bet.amount}`, inline: true },
                { name: 'Payout Amount', value: `$${bet.winningAmount}`, inline: true },
                { name: 'Bank ID', value: bankId, inline: true },
                { name: 'Processed By', value: interaction.user.tag, inline: true }
              )
              .setTimestamp()
          ]
        });
        
        logger.info(`Payout DM sent to ${bet.username} (${bet.userId})`);
      }
    } catch (error) {
      logger.error(`Error sending payout DM to ${bet.username} (${bet.userId}):`, error);
    }
    
    // Send confirmation to admin
    await interaction.editReply({
      content: `✅ Payout of $${bet.winningAmount} to ${bet.username} has been processed and recorded. Bank ID: ${bankId}`,
      ephemeral: true
    });
    
    // Return to the event's payout list
    await selectEventSelect(interaction, client);
    
    logger.info(`Payout processed for ${bet.username} (Bet ID: ${bet.id}) by ${interaction.user.tag}`);
  } catch (error) {
    logger.error('Error in submitBankIdModalSubmit function:', error);
    await interaction.editReply({
      content: 'An error occurred while processing the payout. Please try again.',
      ephemeral: true
    });
  }
}

// Handle confirm all payouts button
async function confirmAllPayouts(interaction, client, params) {
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
    
    // Fetch all unpaid winners for this event
    const unpaidWinners = await models.Bet.findAll({
      where: {
        eventId: event.id,
        isWinner: true,
        paidOut: false
      }
    });
    
    if (unpaidWinners.length === 0) {
      return interaction.editReply({
        content: 'There are no unpaid winners for this event.',
        ephemeral: true
      });
    }
    
    // Create the bank ID input modal for batch processing
    const modal = new ModalBuilder()
      .setCustomId(`payoutManagement_submitAllBankIds_${eventId}`)
      .setTitle(`Process All Payouts (${unpaidWinners.length} winners)`);
    
    // Add text input for default bank ID prefix (optional)
    const bankIdPrefixInput = new TextInputBuilder()
      .setCustomId('bankIdPrefix')
      .setLabel('Default Bank ID Prefix (Optional)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g., VR-')
      .setRequired(false);
    
    // Add notes input
    const notesInput = new TextInputBuilder()
      .setCustomId('notes')
      .setLabel('Additional Notes (Optional)')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false);
    
    // Add inputs to action rows
    const firstActionRow = new ActionRowBuilder().addComponents(bankIdPrefixInput);
    const secondActionRow = new ActionRowBuilder().addComponents(notesInput);
    
    // Add action rows to modal
    modal.addComponents(firstActionRow, secondActionRow);
    
    // Show the modal to the user
    await interaction.showModal(modal);
    
    logger.info(`Batch payout form opened for event "${event.name}" (ID: ${event.id}) with ${unpaidWinners.length} winners by ${interaction.user.tag}`);
  } catch (error) {
    logger.error('Error in confirmAllPayouts function:', error);
    await interaction.editReply({
      content: 'An error occurred while opening the batch payout form. Please try again.',
      ephemeral: true
    });
  }
}

// Handle all bank IDs modal submission
async function submitAllBankIdsModalSubmit(interaction, client, params) {
  try {
    await interaction.deferReply({ ephemeral: true });
    
    const eventId = params[0];
    
    // Get values from the modal
    const bankIdPrefix = interaction.fields.getTextInputValue('bankIdPrefix') || '';
    const notes = interaction.fields.getTextInputValue('notes') || null;
    
    // Fetch the event from the database
    const event = await models.Event.findByPk(eventId);
    
    if (!event) {
      return interaction.editReply({
        content: 'The selected event could not be found. It may have been deleted.',
        ephemeral: true
      });
    }
    
    // Fetch all unpaid winners for this event
    const unpaidWinners = await models.Bet.findAll({
      where: {
        eventId: event.id,
        isWinner: true,
        paidOut: false
      }
    });
    
    if (unpaidWinners.length === 0) {
      return interaction.editReply({
        content: 'There are no unpaid winners for this event.',
        ephemeral: true
      });
    }
    
    // Process all payouts
    const now = new Date();
    const payoutDetails = [];
    let totalPaidOut = 0;
    
    for (const winner of unpaidWinners) {
      // Generate a unique bank ID for each winner
      const bankId = `${bankIdPrefix}${winner.id}-${Math.floor(Math.random() * 10000)}`;
      
      // Update the bet with payout information
      await winner.update({
        paidOut: true,
        payoutTimestamp: now,
        payoutConfirmedBy: interaction.user.id,
        bankId: bankId
      });
      
      // Create a payout record in the database
      await models.Payout.create({
        eventId: event.id,
        betId: winner.id,
        userId: winner.userId,
        username: winner.username,
        amount: winner.winningAmount,
        confirmedBy: interaction.user.id,
        status: 'Completed',
        notes: notes,
        bankId: bankId
      });
      
      // Add to payout details for logging and announcement
      payoutDetails.push({
        username: winner.username,
        amount: winner.winningAmount,
        bankId: bankId
      });
      
      totalPaidOut += winner.winningAmount;
      
      // Try to send a DM to the user if they're in the server
      try {
        const user = await client.users.fetch(winner.userId);
        if (user) {
          await user.send({
            embeds: [
              new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle(`Payout Confirmation: ${event.name}`)
                .setDescription(`Hello, your betting reward ($${winner.winningAmount}) has been transferred to your Bank ID (#${bankId}).`)
                .addFields(
                  { name: 'Event', value: event.name, inline: true },
                  { name: 'Winning Choice', value: winner.choice, inline: true },
                  { name: 'Your Bet', value: `$${winner.amount}`, inline: true },
                  { name: 'Payout Amount', value: `$${winner.winningAmount}`, inline: true },
                  { name: 'Bank ID', value: bankId, inline: true },
                  { name: 'Processed By', value: interaction.user.tag, inline: true }
                )
                .setTimestamp()
            ]
          });
        }
      } catch (error) {
        logger.error(`Error sending payout DM to ${winner.username} (${winner.userId}):`, error);
      }
    }
    
    // Log the batch payout
    await models.Log.create({
      category: 'PayoutHistory',
      level: 'info',
      message: `Batch payout processed for event "${event.name}" (ID: ${event.id})`,
      userId: interaction.user.id,
      username: interaction.user.tag,
      eventId: event.id,
      details: {
        totalWinners: unpaidWinners.length,
        totalPaidOut: totalPaidOut,
        bankIdPrefix: bankIdPrefix,
        notes: notes,
        payouts: payoutDetails
      }
    });
    
    // Get configuration
    const config = await models.Configuration.findOne();
    const channelId = config.payoutAnnouncementsChannelId;
    
    // Send the payout announcement if a channel is configured
    if (channelId) {
      try {
        const channel = await client.channels.fetch(channelId);
        
        if (channel) {
          // Create a formatted list of payouts (limit to 15 for readability)
          let payoutList = '';
          const displayLimit = Math.min(payoutDetails.length, 15);
          
          for (let i = 0; i < displayLimit; i++) {
            const payout = payoutDetails[i];
            payoutList += `${payout.username}: $${payout.amount}\n`;
          }
          
          if (payoutDetails.length > 15) {
            payoutList += `...and ${payoutDetails.length - 15} more winners`;
          }
          
          // Send the announcement
          await channel.send({
            embeds: [
              new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle(`💰 Payouts Complete: ${event.name}`)
                .setDescription(`Attention everyone, payouts for "${event.name}" are complete. Total amount paid: $${totalPaidOut}.`)
                .addFields({ name: 'Details', value: payoutList })
                .setTimestamp()
            ]
          });
          
          logger.info(`Payout announcement sent for event "${event.name}" (ID: ${event.id}) in channel ${channel.name}`);
        }
      } catch (error) {
        logger.error(`Error sending payout announcement for event ID ${event.id}:`, error);
      }
    }
    
    // Send confirmation to admin
    await interaction.editReply({
      content: `✅ Processed ${unpaidWinners.length} payouts totaling $${totalPaidOut} for event "${event.name}". All winners have been paid!`,
      ephemeral: true
    });
    
    // Return to the payout panel
    await payoutPanel(interaction, client);
    
    logger.info(`Batch payout completed for event "${event.name}" (ID: ${event.id}) with ${unpaidWinners.length} winners by ${interaction.user.tag}`);
  } catch (error) {
    logger.error('Error in submitAllBankIdsModalSubmit function:', error);
    await interaction.editReply({
      content: 'An error occurred while processing the batch payout. Please try again.',
      ephemeral: true
    });
  }
}

// Handle history lookup button
async function historyLookup(interaction, client) {
  try {
    await interaction.deferReply({ ephemeral: true });
    
    // Create search options embed
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Payout History Lookup')
      .setDescription('Choose a search method:')
      .setTimestamp();
    
    // Create buttons for different search methods
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('payoutManagement_searchByEvent')
          .setLabel('Search by Event')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🎲'),
        new ButtonBuilder()
          .setCustomId('payoutManagement_searchByUser')
          .setLabel('Search by User')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('👤'),
        new ButtonBuilder()
          .setCustomId('payoutManagement_searchByDate')
          .setLabel('Search by Date')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📅'),
        new ButtonBuilder()
          .setCustomId('payoutManagement_payoutPanel')
          .setLabel('Back')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('⬅️')
      );
    
    // Send the search options message
    await interaction.editReply({
      embeds: [embed],
      components: [row],
      ephemeral: true
    });
    
    logger.info(`Payout history lookup opened by ${interaction.user.tag}`);
  } catch (error) {
    logger.error('Error in historyLookup function:', error);
    await interaction.editReply({
      content: 'An error occurred while opening the history lookup. Please try again.',
      ephemeral: true
    });
  }
}

// Handle search by event button
async function searchByEvent(interaction, client) {
  try {
    await interaction.deferUpdate();
    
    // Get events with payouts
    const events = await models.Event.findAll({
      where: {
        totalPayout: {
          [Op.gt]: 0
        }
      },
      order: [['updatedAt', 'DESC']],
      limit: 25 // Discord limit for select menu options
    });
    
    if (events.length === 0) {
      return interaction.editReply({
        content: 'No events with payouts found.',
        components: [],
        ephemeral: true
      });
    }
    
    // Create the event selection embed
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Search Payouts by Event')
      .setDescription('Select an event to view its payout history:')
      .setTimestamp();
    
    // Create a select menu for events
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('payoutManagement_selectEventForHistory')
      .setPlaceholder('Select an event...');
    
    // Add options for each event
    for (const event of events) {
      selectMenu.addOptions({
        label: event.name,
        description: `Total payout: $${event.totalPayout}`,
        value: event.id.toString()
      });
    }
    
    // Create a back button
    const backButton = new ButtonBuilder()
      .setCustomId('payoutManagement_historyLookup')
      .setLabel('Back to Search Options')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('⬅️');
    
    const row1 = new ActionRowBuilder().addComponents(selectMenu);
    const row2 = new ActionRowBuilder().addComponents(backButton);
    
    // Send the event selection message
    await interaction.editReply({
      embeds: [embed],
      components: [row1, row2],
      ephemeral: true
    });
    
    logger.info(`Search payouts by event opened by ${interaction.user.tag}`);
  } catch (error) {
    logger.error('Error in searchByEvent function:', error);
    await interaction.editReply({
      content: 'An error occurred while loading the events. Please try again.',
      components: [],
      ephemeral: true
    });
  }
}

// Handle select event for history
async function selectEventForHistorySelect(interaction, client) {
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
    
    // Fetch payouts for this event
    const payouts = await models.Payout.findAll({
      where: { eventId: event.id },
      order: [['timestamp', 'DESC']]
    });
    
    if (payouts.length === 0) {
      return interaction.editReply({
        content: `No payouts found for event "${event.name}".`,
        components: [],
        ephemeral: true
      });
    }
    
    // Create the payout history embed
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle(`Payout History: ${event.name}`)
      .setDescription(`Total payout: $${event.totalPayout}`)
      .addFields(
        { name: 'Event Type', value: event.type, inline: true },
        { name: 'Winning Choice', value: event.result?.winningChoice || 'Unknown', inline: true },
        { name: 'Total Payouts', value: `${payouts.length}`, inline: true }
      )
      .setFooter({ text: `Event ID: ${event.id}` })
      .setTimestamp();
    
    // Create pages of payout details
    const payoutsPerPage = 10;
    const pages = [];
    
    for (let i = 0; i < payouts.length; i += payoutsPerPage) {
      const pagePayouts = payouts.slice(i, i + payoutsPerPage);
      
      let pageContent = '';
      
      for (const payout of pagePayouts) {
        const formattedDate = format(new Date(payout.timestamp), 'MMM d, yyyy HH:mm:ss');
        
        pageContent += `**${payout.username}**: $${payout.amount} (Bank ID: ${payout.bankId}) - ${formattedDate}\n`;
        
        if (payout.notes) {
          pageContent += `  *Note: ${payout.notes}*\n`;
        }
      }
      
      pages.push(pageContent);
    }
    
    // If only one page of payouts, add it to the embed
    if (pages.length === 1) {
      embed.addFields({
        name: 'Payout Details',
        value: pages[0]
      });
      
      // Create a back button
      const backButton = new ButtonBuilder()
        .setCustomId('payoutManagement_searchByEvent')
        .setLabel('Back to Events')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⬅️');
      
      const row = new ActionRowBuilder().addComponents(backButton);
      
      await interaction.editReply({
        embeds: [embed],
        components: [row],
        ephemeral: true
      });
      
      return;
    }
    
    // If multiple pages, create navigation buttons
    let currentPage = 0;
    
    const paginatedEmbed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle(`Payout History: ${event.name} (Page ${currentPage + 1}/${pages.length})`)
      .setDescription(`Total payout: $${event.totalPayout}`)
      .addFields(
        { name: 'Event Type', value: event.type, inline: true },
        { name: 'Winning Choice', value: event.result?.winningChoice || 'Unknown', inline: true },
        { name: 'Total Payouts', value: `${payouts.length}`, inline: true },
        { name: 'Payout Details', value: pages[currentPage] }
      )
      .setFooter({ text: `Event ID: ${event.id}` })
      .setTimestamp();
    
    // Create navigation buttons
    const navigationRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('payoutManagement_prevPage')
          .setLabel('Previous')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('⬅️')
          .setDisabled(currentPage === 0),
        new ButtonBuilder()
          .setCustomId('payoutManagement_nextPage')
          .setLabel('Next')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('➡️')
          .setDisabled(currentPage === pages.length - 1),
        new ButtonBuilder()
          .setCustomId('payoutManagement_searchByEvent')
          .setLabel('Back to Events')
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
                   (i.customId === 'payoutManagement_prevPage' || 
                    i.customId === 'payoutManagement_nextPage' || 
                    i.customId === 'payoutManagement_searchByEvent');
    
    const collector = response.createMessageComponentCollector({ 
      filter, 
      time: 300000, // 5 minutes
      componentType: ComponentType.Button
    });
    
    collector.on('collect', async i => {
      // Handle going back to event selection
      if (i.customId === 'payoutManagement_searchByEvent') {
        await searchByEvent(i, client);
        collector.stop();
        return;
      }
      
      // Handle navigation
      if (i.customId === 'payoutManagement_prevPage') {
        currentPage = Math.max(0, currentPage - 1);
      } else if (i.customId === 'payoutManagement_nextPage') {
        currentPage = Math.min(pages.length - 1, currentPage + 1);
      }
      
      // Update the embed
      paginatedEmbed
        .setTitle(`Payout History: ${event.name} (Page ${currentPage + 1}/${pages.length})`)
        .spliceFields(3, 1, {
          name: 'Payout Details',
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
    
    logger.info(`Payout history viewed for event "${event.name}" (ID: ${event.id}) by ${interaction.user.tag}`);
  } catch (error) {
    logger.error('Error in selectEventForHistorySelect function:', error);
    await interaction.editReply({
      content: 'An error occurred while loading the payout history. Please try again.',
      components: [],
      ephemeral: true
    });
  }
}

// Handle search by user button
async function searchByUser(interaction, client) {
  try {
    // Create the user search modal
    const modal = new ModalBuilder()
      .setCustomId('payoutManagement_submitUserSearch')
      .setTitle('Search Payouts by User');
    
    // Add text input for username
    const usernameInput = new TextInputBuilder()
      .setCustomId('username')
      .setLabel('Enter Username or User ID')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g., John123 or 123456789012345678')
      .setRequired(true);
    
    // Add input to action row
    const actionRow = new ActionRowBuilder().addComponents(usernameInput);
    
    // Add action row to modal
    modal.addComponents(actionRow);
    
    // Show the modal to the user
    await interaction.showModal(modal);
    
    logger.info(`Search payouts by user form opened by ${interaction.user.tag}`);
  } catch (error) {
    logger.error('Error in searchByUser function:', error);
    await interaction.reply({
      content: 'An error occurred while opening the user search form. Please try again.',
      ephemeral: true
    });
  }
}

// Handle user search modal submission
async function submitUserSearchModalSubmit(interaction, client) {
  try {
    await interaction.deferReply({ ephemeral: true });
    
    // Get the search term from the modal
    const searchTerm = interaction.fields.getTextInputValue('username');
    
    // Search for payouts by username or user ID
    const payouts = await models.Payout.findAll({
      where: {
        [Op.or]: [
          { username: { [Op.like]: `%${searchTerm}%` } },
          { userId: searchTerm }
        ]
      },
      order: [['timestamp', 'DESC']],
      limit: 100
    });
    
    if (payouts.length === 0) {
      return interaction.editReply({
        content: `No payouts found for user "${searchTerm}".`,
        components: [],
        ephemeral: true
      });
    }
    
    // Create the payout history embed
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle(`Payout History for: ${searchTerm}`)
      .setDescription(`Found ${payouts.length} payouts`)
      .setTimestamp();
    
    // Create pages of payout details
    const payoutsPerPage = 10;
    const pages = [];
    
    // Group payouts by event
    const eventPayouts = {};
    
    for (const payout of payouts) {
      if (!eventPayouts[payout.eventId]) {
        eventPayouts[payout.eventId] = [];
      }
      
      eventPayouts[payout.eventId].push(payout);
    }
    
    // Process each event group
    for (const eventId in eventPayouts) {
      const eventPayouts = payouts.filter(p => p.eventId === parseInt(eventId));
      
      // Fetch the event
      const event = await models.Event.findByPk(eventId);
      
      if (!event) continue;
      
      // Create the content for this event
      let pageContent = `**Event:** ${event.name} (${event.type})\n`;
      
      for (const payout of eventPayouts) {
        const formattedDate = format(new Date(payout.timestamp), 'MMM d, yyyy HH:mm:ss');
        
        pageContent += `• $${payout.amount} - ${formattedDate} (Bank ID: ${payout.bankId})\n`;
        
        if (payout.notes) {
          pageContent += `  *Note: ${payout.notes}*\n`;
        }
      }
      
      pageContent += '\n';
      
      pages.push(pageContent);
    }
    
    // If only one page of payouts, add it to the embed
    if (pages.length === 1) {
      embed.addFields({
        name: 'Payout Details',
        value: pages[0]
      });
      
      // Create a back button
      const backButton = new ButtonBuilder()
        .setCustomId('payoutManagement_historyLookup')
        .setLabel('Back to Search Options')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⬅️');
      
      const row = new ActionRowBuilder().addComponents(backButton);
      
      await interaction.editReply({
        embeds: [embed],
        components: [row],
        ephemeral: true
      });
      
      return;
    }
    
    // If multiple pages, create navigation buttons
    let currentPage = 0;
    
    const paginatedEmbed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle(`Payout History for: ${searchTerm} (Page ${currentPage + 1}/${pages.length})`)
      .setDescription(`Found ${payouts.length} payouts`)
      .addFields({ name: 'Payout Details', value: pages[currentPage] })
      .setTimestamp();
    
    // Create navigation buttons
    const navigationRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('payoutManagement_prevPage')
          .setLabel('Previous')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('⬅️')
          .setDisabled(currentPage === 0),
        new ButtonBuilder()
          .setCustomId('payoutManagement_nextPage')
          .setLabel('Next')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('➡️')
          .setDisabled(currentPage === pages.length - 1),
        new ButtonBuilder()
          .setCustomId('payoutManagement_historyLookup')
          .setLabel('Back to Search')
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
                   (i.customId === 'payoutManagement_prevPage' || 
                    i.customId === 'payoutManagement_nextPage' || 
                    i.customId === 'payoutManagement_historyLookup');
    
    const collector = response.createMessageComponentCollector({ 
      filter, 
      time: 300000, // 5 minutes
      componentType: ComponentType.Button
    });
    
    collector.on('collect', async i => {
      // Handle going back to search options
      if (i.customId === 'payoutManagement_historyLookup') {
        await historyLookup(i, client);
        collector.stop();
        return;
      }
      
      // Handle navigation
      if (i.customId === 'payoutManagement_prevPage') {
        currentPage = Math.max(0, currentPage - 1);
      } else if (i.customId === 'payoutManagement_nextPage') {
        currentPage = Math.min(pages.length - 1, currentPage + 1);
      }
      
      // Update the embed
      paginatedEmbed
        .setTitle(`Payout History for: ${searchTerm} (Page ${currentPage + 1}/${pages.length})`)
        .spliceFields(0, 1, {
          name: 'Payout Details',
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
    
    logger.info(`Payout history viewed for user "${searchTerm}" by ${interaction.user.tag}`);
  } catch (error) {
    logger.error('Error in submitUserSearchModalSubmit function:', error);
    await interaction.editReply({
      content: 'An error occurred while searching for payouts. Please try again.',
      ephemeral: true
    });
  }
}

// Handle search by date button
async function searchByDate(interaction, client) {
  try {
    // Create the date search modal
    const modal = new ModalBuilder()
      .setCustomId('payoutManagement_submitDateSearch')
      .setTitle('Search Payouts by Date');
    
    // Add text inputs for start and end dates
    const startDateInput = new TextInputBuilder()
      .setCustomId('startDate')
      .setLabel('Start Date (YYYY-MM-DD)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g., 2025-01-01')
      .setRequired(true);
    
    const endDateInput = new TextInputBuilder()
      .setCustomId('endDate')
      .setLabel('End Date (YYYY-MM-DD, optional)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g., 2025-01-31')
      .setRequired(false);
    
    // Add inputs to action rows
    const firstActionRow = new ActionRowBuilder().addComponents(startDateInput);
    const secondActionRow = new ActionRowBuilder().addComponents(endDateInput);
    
    // Add action rows to modal
    modal.addComponents(firstActionRow, secondActionRow);
    
    // Show the modal to the user
    await interaction.showModal(modal);
    
    logger.info(`Search payouts by date form opened by ${interaction.user.tag}`);
  } catch (error) {
    logger.error('Error in searchByDate function:', error);
    await interaction.reply({
      content: 'An error occurred while opening the date search form. Please try again.',
      ephemeral: true
    });
  }
}

// Handle date search modal submission
async function submitDateSearchModalSubmit(interaction, client) {
  try {
    await interaction.deferReply({ ephemeral: true });
    
    // Get the date range from the modal
    const startDateStr = interaction.fields.getTextInputValue('startDate');
    const endDateStr = interaction.fields.getTextInputValue('endDate') || '';
    
    // Validate and parse the dates
    if (!startDateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return interaction.editReply({
        content: 'Invalid start date format. Please use YYYY-MM-DD format.',
        ephemeral: true
      });
    }
    
    if (endDateStr && !endDateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return interaction.editReply({
        content: 'Invalid end date format. Please use YYYY-MM-DD format.',
        ephemeral: true
      });
    }
    
    let startDate = new Date(`${startDateStr}T00:00:00Z`);
    let endDate = endDateStr ? new Date(`${endDateStr}T23:59:59Z`) : new Date(startDate);
    
    if (endDateStr) {
      endDate.setHours(23, 59, 59, 999);
    } else {
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    }
    
    // Search for payouts within the date range
    const payouts = await models.Payout.findAll({
      where: {
        timestamp: {
          [Op.between]: [startDate, endDate]
        }
      },
      order: [['timestamp', 'DESC']],
      limit: 100
    });
    
    if (payouts.length === 0) {
      return interaction.editReply({
        content: `No payouts found between ${startDateStr} and ${endDateStr || startDateStr}.`,
        components: [],
        ephemeral: true
      });
    }
    
    // Create the payout history embed
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle(`Payout History: ${startDateStr} to ${endDateStr || startDateStr}`)
      .setDescription(`Found ${payouts.length} payouts`)
      .setTimestamp();
    
    // Calculate total payout amount
    let totalPayoutAmount = 0;
    for (const payout of payouts) {
      totalPayoutAmount += payout.amount;
    }
    
    embed.addFields({
      name: 'Total Payout Amount',
      value: `$${totalPayoutAmount}`,
      inline: true
    });
    
    // Create pages of payout details
    const payoutsPerPage = 10;
    const pages = [];
    
    for (let i = 0; i < payouts.length; i += payoutsPerPage) {
      const pagePayouts = payouts.slice(i, i + payoutsPerPage);
      
      let pageContent = '';
      
      for (const payout of pagePayouts) {
        // Fetch the event
        const event = await models.Event.findByPk(payout.eventId);
        const eventName = event ? event.name : 'Unknown Event';
        
        const formattedDate = format(new Date(payout.timestamp), 'MMM d, yyyy HH:mm:ss');
        
        pageContent += `**${payout.username}**: $${payout.amount} - ${formattedDate}\n`;
        pageContent += `Event: ${eventName} | Bank ID: ${payout.bankId}\n`;
        
        if (payout.notes) {
          pageContent += `*Note: ${payout.notes}*\n`;
        }
        
        pageContent += '\n';
      }
      
      pages.push(pageContent);
    }
    
    // If only one page of payouts, add it to the embed
    if (pages.length === 1) {
      embed.addFields({
        name: 'Payout Details',
        value: pages[0]
      });
      
      // Create a back button
      const backButton = new ButtonBuilder()
        .setCustomId('payoutManagement_historyLookup')
        .setLabel('Back to Search Options')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⬅️');
      
      const row = new ActionRowBuilder().addComponents(backButton);
      
      await interaction.editReply({
        embeds: [embed],
        components: [row],
        ephemeral: true
      });
      
      return;
    }
    
    // If multiple pages, create navigation buttons
    let currentPage = 0;
    
    const paginatedEmbed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle(`Payout History: ${startDateStr} to ${endDateStr || startDateStr} (Page ${currentPage + 1}/${pages.length})`)
      .setDescription(`Found ${payouts.length} payouts`)
      .addFields(
        {
          name: 'Total Payout Amount',
          value: `$${totalPayoutAmount}`,
          inline: true
        },
        {
          name: 'Payout Details',
          value: pages[currentPage]
        }
      )
      .setTimestamp();
    
    // Create navigation buttons
    const navigationRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('payoutManagement_prevPage')
          .setLabel('Previous')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('⬅️')
          .setDisabled(currentPage === 0),
        new ButtonBuilder()
          .setCustomId('payoutManagement_nextPage')
          .setLabel('Next')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('➡️')
          .setDisabled(currentPage === pages.length - 1),
        new ButtonBuilder()
          .setCustomId('payoutManagement_historyLookup')
          .setLabel('Back to Search')
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
                   (i.customId === 'payoutManagement_prevPage' || 
                    i.customId === 'payoutManagement_nextPage' || 
                    i.customId === 'payoutManagement_historyLookup');
    
    const collector = response.createMessageComponentCollector({ 
      filter, 
      time: 300000, // 5 minutes
      componentType: ComponentType.Button
    });
    
    collector.on('collect', async i => {
      // Handle going back to search options
      if (i.customId === 'payoutManagement_historyLookup') {
        await historyLookup(i, client);
        collector.stop();
        return;
      }
      
      // Handle navigation
      if (i.customId === 'payoutManagement_prevPage') {
        currentPage = Math.max(0, currentPage - 1);
      } else if (i.customId === 'payoutManagement_nextPage') {
        currentPage = Math.min(pages.length - 1, currentPage + 1);
      }
      
      // Update the embed
      paginatedEmbed
        .setTitle(`Payout History: ${startDateStr} to ${endDateStr || startDateStr} (Page ${currentPage + 1}/${pages.length})`)
        .spliceFields(1, 1, {
          name: 'Payout Details',
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
    
    logger.info(`Payout history viewed for date range ${startDateStr} to ${endDateStr || startDateStr} by ${interaction.user.tag}`);
  } catch (error) {
    logger.error('Error in submitDateSearchModalSubmit function:', error);
    await interaction.editReply({
      content: 'An error occurred while searching for payouts. Please try again.',
      ephemeral: true
    });
  }
}

module.exports = {
  payoutPanel,
  selectEventSelect,
  selectWinnerSelect,
  submitBankIdModalSubmit,
  confirmAllPayouts,
  submitAllBankIdsModalSubmit,
  historyLookup,
  searchByEvent,
  selectEventForHistorySelect,
  searchByUser,
  submitUserSearchModalSubmit,
  searchByDate,
  submitDateSearchModalSubmit
};
