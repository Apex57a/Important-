// Winner Selection Module - Handles selection and approval of winners after an event ends
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

// Handle the selectWinner button click from admin panel
async function selectWinner(interaction, client) {
  try {
    await interaction.deferReply({ ephemeral: true });
    
    // Get all events that are not Active or Paused (locked or closed)
    const events = await models.Event.findAll({
      where: {
        status: {
          [Op.in]: ['Locked', 'Closed']
        },
        winnerApproved: false
      },
      order: [['createdAt', 'DESC']]
    });
    
    if (events.length === 0) {
      return interaction.editReply({
        content: 'There are no locked or closed events pending winner selection. Please lock an event first before selecting winners.',
        ephemeral: true
      });
    }
    
    // Create the event selection embed
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Winner Selection')
      .setDescription('Select an event to choose winners:');
    
    // Create a select menu for the events
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('winnerSelection_selectEvent')
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
    
    logger.info(`Winner selection panel opened by ${interaction.user.tag}`);
  } catch (error) {
    logger.error('Error in selectWinner function:', error);
    
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
    
    // Fetch all bets for this event
    const bets = await models.Bet.findAll({
      where: { eventId: event.id },
      order: [['timestamp', 'DESC']]
    });
    
    if (bets.length === 0) {
      return interaction.editReply({
        content: `No bets have been placed for the event "${event.name}". There are no winners to select.`,
        components: [],
        ephemeral: true
      });
    }
    
    // Group bets by choice to analyze them
    const betsByChoice = {};
    
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
    }
    
    // Create the winner selection embed
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle(`Winner Selection: ${event.name}`)
      .setDescription('Select the winning choice or outcome for this event.')
      .addFields(
        { name: 'Event Type', value: event.type, inline: true },
        { name: 'Status', value: event.status, inline: true },
        { name: 'Total Bets', value: `${event.totalBets} bets ($${event.totalAmount})`, inline: true }
      );
    
    // Add fields for each choice
    for (const choice in betsByChoice) {
      const choiceData = betsByChoice[choice];
      embed.addFields({
        name: `Choice: ${choice}`,
        value: `${choiceData.count} bets, total $${choiceData.totalAmount}`,
        inline: true
      });
    }
    
    // Create a select menu for the winning choices
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`winnerSelection_selectWinningChoice_${eventId}`)
      .setPlaceholder('Select the winning choice...');
    
    // Add options for each choice
    for (const choice in betsByChoice) {
      selectMenu.addOptions({
        label: choice,
        description: `${betsByChoice[choice].count} bets, total $${betsByChoice[choice].totalAmount}`,
        value: choice
      });
    }
    
    // Add a custom choice option
    selectMenu.addOptions({
      label: 'Custom Winner',
      description: 'Enter a custom winning choice not in the list',
      value: 'CUSTOM'
    });
    
    const row1 = new ActionRowBuilder().addComponents(selectMenu);
    
    // Add back button
    const row2 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('winnerSelection_selectWinner')
          .setLabel('Back to Event List')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('⬅️')
      );
    
    // Send the choice selection message
    await interaction.editReply({
      embeds: [embed],
      components: [row1, row2],
      ephemeral: true
    });
    
    logger.info(`Winner selection choices displayed for event "${event.name}" (ID: ${event.id}) by ${interaction.user.tag}`);
  } catch (error) {
    logger.error('Error in selectEventSelect function:', error);
    await interaction.editReply({
      content: 'An error occurred while loading the event details. Please try again.',
      components: [],
      ephemeral: true
    });
  }
}

// Handle winning choice selection
async function selectWinningChoiceSelect(interaction, client, params) {
  try {
    const eventId = params[0];
    const selectedChoice = interaction.values[0];
    
    // If custom choice selected, show modal for input
    if (selectedChoice === 'CUSTOM') {
      return handleCustomWinningChoice(interaction, eventId);
    }
    
    await interaction.deferUpdate();
    
    // Fetch the event from the database
    const event = await models.Event.findByPk(eventId);
    
    if (!event) {
      return interaction.editReply({
        content: 'The selected event could not be found. It may have been deleted.',
        components: [],
        ephemeral: true
      });
    }
    
    // Fetch all bets for this event
    const bets = await models.Bet.findAll({
      where: { eventId: event.id }
    });
    
    // Determine winners (bets that match the selected choice)
    let winners = [];
    let totalWinningAmount = 0;
    
    for (const bet of bets) {
      if (bet.choice === selectedChoice) {
        winners.push(bet);
        totalWinningAmount += bet.amount;
      }
    }
    
    // Calculate winnings based on the ratio of winning bets to total bets
    // Using a simple formula where winners split the pot proportional to their bet
    const winningRatio = event.totalAmount / totalWinningAmount;
    
    // Update winners and calculate individual winnings
    for (const winner of winners) {
      const winningAmount = Math.floor(winner.amount * winningRatio);
      winner.isWinner = true;
      winner.winningAmount = winningAmount;
      await winner.save();
    }
    
    // Create the winner review embed
    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle(`Winners Selected: ${event.name}`)
      .setDescription(`The winning choice is: **${selectedChoice}**`)
      .addFields(
        { name: 'Total Winners', value: `${winners.length} bets`, inline: true },
        { name: 'Total Winning Bets', value: `$${totalWinningAmount}`, inline: true },
        { name: 'Pot Distribution Ratio', value: `${winningRatio.toFixed(2)}x`, inline: true }
      );
    
    // Add list of winners (up to 10)
    if (winners.length > 0) {
      let winnersList = '';
      const displayLimit = Math.min(winners.length, 10);
      
      for (let i = 0; i < displayLimit; i++) {
        const winner = winners[i];
        winnersList += `${winner.username}: $${winner.amount} → $${winner.winningAmount}\n`;
      }
      
      if (winners.length > 10) {
        winnersList += `...and ${winners.length - 10} more winners`;
      }
      
      embed.addFields({ name: 'Winners Preview', value: winnersList });
    }
    
    // Create confirmation buttons
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`winnerSelection_confirmWinners_${eventId}_${selectedChoice}`)
          .setLabel('Confirm Winners')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✅'),
        new ButtonBuilder()
          .setCustomId(`winnerSelection_editWinners_${eventId}_${selectedChoice}`)
          .setLabel('Edit Winners Manually')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('✏️'),
        new ButtonBuilder()
          .setCustomId(`winnerSelection_selectEvent_${eventId}`)
          .setLabel('Back to Choices')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('⬅️')
      );
    
    // Send the confirmation message
    await interaction.editReply({
      embeds: [embed],
      components: [row],
      ephemeral: true
    });
    
    logger.info(`Winners calculated for event "${event.name}" (ID: ${event.id}), winning choice: ${selectedChoice} by ${interaction.user.tag}`);
  } catch (error) {
    logger.error('Error in selectWinningChoiceSelect function:', error);
    await interaction.editReply({
      content: 'An error occurred while selecting winners. Please try again.',
      components: [],
      ephemeral: true
    });
  }
}

// Handle custom winning choice
async function handleCustomWinningChoice(interaction, eventId) {
  try {
    // Create a modal for custom choice input
    const modal = new ModalBuilder()
      .setCustomId(`winnerSelection_submitCustomChoice_${eventId}`)
      .setTitle('Enter Custom Winning Choice');
    
    // Add text input for the custom choice
    const choiceInput = new TextInputBuilder()
      .setCustomId('customChoice')
      .setLabel('Custom Winning Choice')
      .setStyle(TextInputStyle.Short)
      .setMaxLength(100)
      .setRequired(true);
    
    // Add input to action row
    const actionRow = new ActionRowBuilder().addComponents(choiceInput);
    
    // Add action row to modal
    modal.addComponents(actionRow);
    
    // Show the modal to the user
    await interaction.showModal(modal);
    
    logger.info(`Custom winning choice form opened for event ID: ${eventId} by ${interaction.user.tag}`);
  } catch (error) {
    logger.error('Error in handleCustomWinningChoice function:', error);
    await interaction.reply({
      content: 'An error occurred while opening the custom choice form. Please try again.',
      ephemeral: true
    });
  }
}

// Handle custom choice modal submission
async function submitCustomChoiceModalSubmit(interaction, client, params) {
  try {
    const eventId = params[0];
    
    // Get the custom choice from the modal
    const customChoice = interaction.fields.getTextInputValue('customChoice');
    
    // Defer reply to prepare for processing
    await interaction.deferReply({ ephemeral: true });
    
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
      where: { eventId: event.id }
    });
    
    // By default no winners with custom choice
    const winners = [];
    const totalWinningAmount = 0;
    
    // Create the winner review embed
    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle(`Custom Winner Selected: ${event.name}`)
      .setDescription(`The custom winning choice is: **${customChoice}**`)
      .addFields(
        { name: 'Note', value: 'No bets match this custom choice. You will need to select winners manually.', inline: false },
        { name: 'Total Winners', value: `${winners.length} bets`, inline: true },
        { name: 'Total Bets', value: `${bets.length} bets`, inline: true }
      );
    
    // Create confirmation buttons
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`winnerSelection_editWinners_${eventId}_${customChoice}`)
          .setLabel('Select Winners Manually')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('✏️'),
        new ButtonBuilder()
          .setCustomId(`winnerSelection_selectEvent_${eventId}`)
          .setLabel('Back to Choices')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('⬅️')
      );
    
    // Send the confirmation message
    await interaction.editReply({
      embeds: [embed],
      components: [row],
      ephemeral: true
    });
    
    logger.info(`Custom winning choice "${customChoice}" set for event "${event.name}" (ID: ${event.id}) by ${interaction.user.tag}`);
  } catch (error) {
    logger.error('Error in submitCustomChoiceModalSubmit function:', error);
    
    if (interaction.deferred) {
      await interaction.editReply({
        content: 'An error occurred while processing the custom choice. Please try again.',
        ephemeral: true
      });
    } else {
      await interaction.reply({
        content: 'An error occurred while processing the custom choice. Please try again.',
        ephemeral: true
      });
    }
  }
}

// Handle edit winners button
async function editWinners(interaction, client, params) {
  try {
    await interaction.deferUpdate();
    
    const eventId = params[0];
    const selectedChoice = params[1];
    
    // Fetch the event from the database
    const event = await models.Event.findByPk(eventId);
    
    if (!event) {
      return interaction.editReply({
        content: 'The selected event could not be found. It may have been deleted.',
        components: [],
        ephemeral: true
      });
    }
    
    // Fetch all bets for this event
    const bets = await models.Bet.findAll({
      where: { eventId: event.id },
      order: [['timestamp', 'DESC']]
    });
    
    // Create the manual selection embed
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle(`Manual Winner Selection: ${event.name}`)
      .setDescription(`Select which bets are winners for choice: **${selectedChoice}**\n\nClick on bets to toggle them as winners. Then click "Save Winners" when done.`)
      .setFooter({ text: 'Only the first 25 bets are shown due to Discord limitations.' });
    
    // Create a select menu for the bets (limited to 25 options by Discord)
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`winnerSelection_toggleWinner_${eventId}_${selectedChoice}`)
      .setPlaceholder('Select bets to toggle winner status...')
      .setMinValues(1)
      .setMaxValues(Math.min(bets.length, 25));
    
    // Add options for bets (limited to 25)
    const displayLimit = Math.min(bets.length, 25);
    
    for (let i = 0; i < displayLimit; i++) {
      const bet = bets[i];
      const isWinner = bet.isWinner ? '✅ ' : '';
      
      selectMenu.addOptions({
        label: `${isWinner}${bet.username}: ${bet.choice}`,
        description: `Bet: $${bet.amount} | ${new Date(bet.timestamp).toLocaleString()}`,
        value: bet.id.toString(),
        default: bet.isWinner || false
      });
    }
    
    // Create button row for actions
    const actionRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`winnerSelection_saveWinners_${eventId}_${selectedChoice}`)
          .setLabel('Save Winners')
          .setStyle(ButtonStyle.Success)
          .setEmoji('💾'),
        new ButtonBuilder()
          .setCustomId(`winnerSelection_calculateWinnings_${eventId}_${selectedChoice}`)
          .setLabel('Calculate Winnings')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🧮'),
        new ButtonBuilder()
          .setCustomId(`winnerSelection_selectEvent_${eventId}`)
          .setLabel('Back')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('⬅️')
      );
    
    // If there are more than 25 bets, add a note
    if (bets.length > 25) {
      embed.setDescription(`${embed.data.description}\n\n**Note:** This event has ${bets.length} bets, but Discord limits select menus to 25 options. Consider using automatic winner calculation for events with many bets.`);
    }
    
    const row1 = new ActionRowBuilder().addComponents(selectMenu);
    
    // Send the selection message
    await interaction.editReply({
      embeds: [embed],
      components: [row1, actionRow],
      ephemeral: true
    });
    
    logger.info(`Manual winner selection opened for event "${event.name}" (ID: ${event.id}) by ${interaction.user.tag}`);
  } catch (error) {
    logger.error('Error in editWinners function:', error);
    await interaction.editReply({
      content: 'An error occurred while loading the manual winner selection. Please try again.',
      components: [],
      ephemeral: true
    });
  }
}

// Handle toggle winner selection
async function toggleWinnerSelect(interaction, client, params) {
  try {
    await interaction.deferUpdate();
    
    const eventId = params[0];
    const selectedChoice = params[1];
    
    // Get the selected bet IDs
    const selectedBetIds = interaction.values;
    
    // Fetch the event from the database
    const event = await models.Event.findByPk(eventId);
    
    if (!event) {
      return interaction.editReply({
        content: 'The selected event could not be found. It may have been deleted.',
        components: [],
        ephemeral: true
      });
    }
    
    // Fetch all bets for this event
    const bets = await models.Bet.findAll({
      where: { eventId: event.id },
      order: [['timestamp', 'DESC']]
    });
    
    // Toggle winner status for selected bets
    for (const bet of bets) {
      if (selectedBetIds.includes(bet.id.toString())) {
        bet.isWinner = !bet.isWinner;
        await bet.save();
      }
    }
    
    // Reload the bets after saving
    const updatedBets = await models.Bet.findAll({
      where: { eventId: event.id },
      order: [['timestamp', 'DESC']]
    });
    
    // Create the updated embed
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle(`Manual Winner Selection: ${event.name}`)
      .setDescription(`Select which bets are winners for choice: **${selectedChoice}**\n\nClick on bets to toggle them as winners. Then click "Save Winners" when done.`)
      .setFooter({ text: 'Only the first 25 bets are shown due to Discord limitations.' });
    
    // Create an updated select menu
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`winnerSelection_toggleWinner_${eventId}_${selectedChoice}`)
      .setPlaceholder('Select bets to toggle winner status...')
      .setMinValues(1)
      .setMaxValues(Math.min(updatedBets.length, 25));
    
    // Add options for bets (limited to 25)
    const displayLimit = Math.min(updatedBets.length, 25);
    
    for (let i = 0; i < displayLimit; i++) {
      const bet = updatedBets[i];
      const isWinner = bet.isWinner ? '✅ ' : '';
      
      selectMenu.addOptions({
        label: `${isWinner}${bet.username}: ${bet.choice}`,
        description: `Bet: $${bet.amount} | ${new Date(bet.timestamp).toLocaleString()}`,
        value: bet.id.toString(),
        default: bet.isWinner || false
      });
    }
    
    // Create button row for actions
    const actionRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`winnerSelection_saveWinners_${eventId}_${selectedChoice}`)
          .setLabel('Save Winners')
          .setStyle(ButtonStyle.Success)
          .setEmoji('💾'),
        new ButtonBuilder()
          .setCustomId(`winnerSelection_calculateWinnings_${eventId}_${selectedChoice}`)
          .setLabel('Calculate Winnings')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🧮'),
        new ButtonBuilder()
          .setCustomId(`winnerSelection_selectEvent_${eventId}`)
          .setLabel('Back')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('⬅️')
      );
    
    // If there are more than 25 bets, add a note
    if (updatedBets.length > 25) {
      embed.setDescription(`${embed.data.description}\n\n**Note:** This event has ${updatedBets.length} bets, but Discord limits select menus to 25 options. Consider using automatic winner calculation for events with many bets.`);
    }
    
    const row1 = new ActionRowBuilder().addComponents(selectMenu);
    
    // Send the updated message
    await interaction.editReply({
      embeds: [embed],
      components: [row1, actionRow],
      ephemeral: true
    });
    
    logger.info(`Winners toggled for event "${event.name}" (ID: ${event.id}) by ${interaction.user.tag}`);
  } catch (error) {
    logger.error('Error in toggleWinnerSelect function:', error);
    await interaction.editReply({
      content: 'An error occurred while toggling winners. Please try again.',
      components: [],
      ephemeral: true
    });
  }
}

// Handle save winners button
async function saveWinners(interaction, client, params) {
  try {
    await interaction.deferUpdate();
    
    const eventId = params[0];
    const selectedChoice = params[1];
    
    // Fetch the event from the database
    const event = await models.Event.findByPk(eventId);
    
    if (!event) {
      return interaction.editReply({
        content: 'The selected event could not be found. It may have been deleted.',
        components: [],
        ephemeral: true
      });
    }
    
    // Fetch all bets for this event
    const bets = await models.Bet.findAll({
      where: { eventId: event.id }
    });
    
    // Get the winners
    const winners = bets.filter(bet => bet.isWinner);
    
    // Calculate total winning bet amount
    let totalWinningAmount = 0;
    for (const winner of winners) {
      totalWinningAmount += winner.amount;
    }
    
    // Create the saved winners embed
    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle(`Winners Saved: ${event.name}`)
      .setDescription(`Winning choice: **${selectedChoice}**`)
      .addFields(
        { name: 'Total Winners', value: `${winners.length} bets`, inline: true },
        { name: 'Total Winning Bets', value: `$${totalWinningAmount}`, inline: true }
      );
    
    // Add list of winners (up to 10)
    if (winners.length > 0) {
      let winnersList = '';
      const displayLimit = Math.min(winners.length, 10);
      
      for (let i = 0; i < displayLimit; i++) {
        const winner = winners[i];
        winnersList += `${winner.username}: $${winner.amount}${winner.winningAmount ? ` → $${winner.winningAmount}` : ''}\n`;
      }
      
      if (winners.length > 10) {
        winnersList += `...and ${winners.length - 10} more winners`;
      }
      
      embed.addFields({ name: 'Winners Preview', value: winnersList });
    } else {
      embed.addFields({ name: 'No Winners', value: 'No winners were selected for this event.' });
    }
    
    // Create next step buttons
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`winnerSelection_calculateWinnings_${eventId}_${selectedChoice}`)
          .setLabel('Calculate Winnings')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🧮'),
        new ButtonBuilder()
          .setCustomId(`winnerSelection_editWinners_${eventId}_${selectedChoice}`)
          .setLabel('Edit Winners')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('✏️'),
        new ButtonBuilder()
          .setCustomId(`winnerSelection_confirmWinners_${eventId}_${selectedChoice}`)
          .setLabel('Confirm & Finalize')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✅')
      );
    
    // Send the confirmation message
    await interaction.editReply({
      embeds: [embed],
      components: [row],
      ephemeral: true
    });
    
    logger.info(`Winners saved for event "${event.name}" (ID: ${event.id}), choice: ${selectedChoice} by ${interaction.user.tag}`);
  } catch (error) {
    logger.error('Error in saveWinners function:', error);
    await interaction.editReply({
      content: 'An error occurred while saving winners. Please try again.',
      components: [],
      ephemeral: true
    });
  }
}

// Handle calculate winnings button
async function calculateWinnings(interaction, client, params) {
  try {
    await interaction.deferUpdate();
    
    const eventId = params[0];
    const selectedChoice = params[1];
    
    // Fetch the event from the database
    const event = await models.Event.findByPk(eventId);
    
    if (!event) {
      return interaction.editReply({
        content: 'The selected event could not be found. It may have been deleted.',
        components: [],
        ephemeral: true
      });
    }
    
    // Fetch all bets for this event
    const bets = await models.Bet.findAll({
      where: { eventId: event.id }
    });
    
    // Get the winners
    const winners = bets.filter(bet => bet.isWinner);
    
    if (winners.length === 0) {
      return interaction.editReply({
        content: 'No winners have been selected for this event. Please select winners first.',
        components: [],
        ephemeral: true
      });
    }
    
    // Calculate total winning bet amount
    let totalWinningAmount = 0;
    for (const winner of winners) {
      totalWinningAmount += winner.amount;
    }
    
    // Calculate winnings based on the ratio of winning bets to total bets
    // Using a simple formula where winners split the pot proportional to their bet
    const winningRatio = event.totalAmount / totalWinningAmount;
    
    // Update winners with calculated winnings
    for (const winner of winners) {
      const winningAmount = Math.floor(winner.amount * winningRatio);
      winner.winningAmount = winningAmount;
      await winner.save();
    }
    
    // Calculate total payout
    let totalPayout = 0;
    for (const winner of winners) {
      totalPayout += winner.winningAmount;
    }
    
    // Update event with total payout
    await event.update({
      totalPayout: totalPayout
    });
    
    // Create the winnings calculated embed
    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle(`Winnings Calculated: ${event.name}`)
      .setDescription(`Winning choice: **${selectedChoice}**`)
      .addFields(
        { name: 'Total Winners', value: `${winners.length} bets`, inline: true },
        { name: 'Total Winning Bets', value: `$${totalWinningAmount}`, inline: true },
        { name: 'Pot Distribution Ratio', value: `${winningRatio.toFixed(2)}x`, inline: true },
        { name: 'Total Payout', value: `$${totalPayout}`, inline: true }
      );
    
    // Add list of winners with calculated winnings (up to 10)
    if (winners.length > 0) {
      let winnersList = '';
      const displayLimit = Math.min(winners.length, 10);
      
      for (let i = 0; i < displayLimit; i++) {
        const winner = winners[i];
        winnersList += `${winner.username}: $${winner.amount} → $${winner.winningAmount}\n`;
      }
      
      if (winners.length > 10) {
        winnersList += `...and ${winners.length - 10} more winners`;
      }
      
      embed.addFields({ name: 'Winners Preview', value: winnersList });
    }
    
    // Create confirmation buttons
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`winnerSelection_confirmWinners_${eventId}_${selectedChoice}`)
          .setLabel('Confirm & Finalize')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✅'),
        new ButtonBuilder()
          .setCustomId(`winnerSelection_editWinners_${eventId}_${selectedChoice}`)
          .setLabel('Edit Winners')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('✏️'),
        new ButtonBuilder()
          .setCustomId(`winnerSelection_selectEvent_${eventId}`)
          .setLabel('Back')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('⬅️')
      );
    
    // Send the confirmation message
    await interaction.editReply({
      embeds: [embed],
      components: [row],
      ephemeral: true
    });
    
    logger.info(`Winnings calculated for event "${event.name}" (ID: ${event.id}), choice: ${selectedChoice} by ${interaction.user.tag}`);
  } catch (error) {
    logger.error('Error in calculateWinnings function:', error);
    await interaction.editReply({
      content: 'An error occurred while calculating winnings. Please try again.',
      components: [],
      ephemeral: true
    });
  }
}

// Handle confirm winners button
async function confirmWinners(interaction, client, params) {
  try {
    await interaction.deferUpdate();
    
    const eventId = params[0];
    const selectedChoice = params[1];
    
    // Fetch the event from the database
    const event = await models.Event.findByPk(eventId);
    
    if (!event) {
      return interaction.editReply({
        content: 'The selected event could not be found. It may have been deleted.',
        components: [],
        ephemeral: true
      });
    }
    
    // Fetch all bets for this event
    const bets = await models.Bet.findAll({
      where: { eventId: event.id }
    });
    
    // Get the winners
    const winners = bets.filter(bet => bet.isWinner);
    
    if (winners.length === 0) {
      return interaction.editReply({
        content: 'No winners have been selected for this event. Please select winners first.',
        components: [],
        ephemeral: true
      });
    }
    
    // Calculate total winning bet amount and check if winnings are calculated
    let totalWinningAmount = 0;
    let winningsCalculated = true;
    
    for (const winner of winners) {
      totalWinningAmount += winner.amount;
      if (winner.winningAmount === null || winner.winningAmount === undefined) {
        winningsCalculated = false;
      }
    }
    
    // If winnings are not calculated, calculate them
    if (!winningsCalculated) {
      // Calculate winnings based on the ratio of winning bets to total bets
      const winningRatio = event.totalAmount / totalWinningAmount;
      
      // Update winners with calculated winnings
      for (const winner of winners) {
        const winningAmount = Math.floor(winner.amount * winningRatio);
        winner.winningAmount = winningAmount;
        await winner.save();
      }
      
      // Calculate total payout
      let totalPayout = 0;
      for (const winner of winners) {
        totalPayout += winner.winningAmount;
      }
      
      // Update event with total payout
      await event.update({
        totalPayout: totalPayout
      });
    }
    
    // Update the event with winner information
    await event.update({
      status: 'Closed',
      winnerApproved: true,
      result: {
        winningChoice: selectedChoice,
        totalWinners: winners.length,
        totalWinningAmount: totalWinningAmount,
        totalPayout: event.totalPayout
      },
      lastModifiedBy: interaction.user.id
    });
    
    // Log the winner selection
    await models.Log.create({
      category: 'AdminAction',
      level: 'info',
      message: `Winners confirmed for event "${event.name}" (ID: ${event.id})`,
      userId: interaction.user.id,
      username: interaction.user.tag,
      eventId: event.id,
      details: {
        winningChoice: selectedChoice,
        totalWinners: winners.length,
        totalWinningAmount: totalWinningAmount,
        totalPayout: event.totalPayout
      }
    });
    
    // Create the final confirmation embed
    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle(`Winners Confirmed: ${event.name}`)
      .setDescription(`The event has been closed with the winning choice: **${selectedChoice}**\n\nAll winners have been approved and are ready for payout.`)
      .addFields(
        { name: 'Total Winners', value: `${winners.length} bets`, inline: true },
        { name: 'Total Winning Bets', value: `$${totalWinningAmount}`, inline: true },
        { name: 'Total Payout', value: `$${event.totalPayout}`, inline: true }
      );
    
    // Create next steps button
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('payoutManagement_payoutPanel')
          .setLabel('Go to Payout Panel')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('💰'),
        new ButtonBuilder()
          .setCustomId('winnerSelection_selectWinner')
          .setLabel('Back to Winner Selection')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('⬅️')
      );
    
    // Send the confirmation message
    await interaction.editReply({
      embeds: [embed],
      components: [row],
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
            
            // Send a results announcement
            await channel.send({
              embeds: [
                new EmbedBuilder()
                  .setColor('#FFD700') // Gold color
                  .setTitle(`🏆 Results Announced: "${event.name}"`)
                  .setDescription(`The results are in! The winning choice is: **${selectedChoice}**\n\n**${winners.length}** bettor(s) have won!\nTotal payout: $${event.totalPayout}\n\nPayouts will be processed shortly. Thank you for participating!`)
                  .setTimestamp()
              ]
            });
            
            logger.info(`Event results announcement sent for "${event.name}" (ID: ${event.id}) in channel ${channel.name}`);
          }
        }
      } catch (error) {
        logger.error(`Error updating event announcement for event ID ${event.id}:`, error);
      }
    }
    
    logger.info(`Event "${event.name}" (ID: ${event.id}) winners confirmed and event closed by ${interaction.user.tag}`);
  } catch (error) {
    logger.error('Error in confirmWinners function:', error);
    await interaction.editReply({
      content: 'An error occurred while confirming winners. Please try again.',
      components: [],
      ephemeral: true
    });
  }
}

module.exports = {
  selectWinner,
  selectEventSelect,
  selectWinningChoiceSelect,
  submitCustomChoiceModalSubmit,
  editWinners,
  toggleWinnerSelect,
  saveWinners,
  calculateWinnings,
  confirmWinners
};
