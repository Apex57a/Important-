// KrayStakes Discord Bot - Newbie Guide Command
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const logger = require('../utils/logger');
const { checkAdmin } = require('../utils/permissions');
const { safeReply, safeDefer, handleInteractionError } = require('../utils/interactions');
const { createSuccessEmbed, createErrorEmbed } = require('../utils/embeds');

// Define the newbie guide content
const newbieGuideContent = {
  title: 'KrayStakes Complete Newbie Guide',
  description: 'Welcome to KrayStakes! This guide will help you understand how our betting system works.',
  sections: [
    {
      title: '🎮 What is KrayStakes?',
      content: 'KrayStakes is a betting system for SA-MP roleplay servers. It allows you to place bets on various in-game events such as boxing matches, races, paintball tournaments, and other custom events. Winners receive payouts based on the odds and bet amounts.'
    },
    {
      title: '🏁 Getting Started',
      content: 'To start using KrayStakes, follow these simple steps:\n\n1. Check the announcements channel for upcoming events\n2. When an event is posted, click the "Place Bet" button\n3. Select your prediction and enter your bet amount\n4. Confirm your bet and wait for the event results\n5. If you win, you\'ll receive a payout notification'
    },
    {
      title: '💰 Placing Bets',
      content: 'Betting is simple:\n\n• Find an event in the announcements channel\n• Click "Place Bet" on the event message\n• Choose who/what you think will win\n• Enter your bet amount (minimum and maximum limits apply)\n• Confirm your bet\n\nYou can place multiple bets on different options for the same event, but there may be a limit to how many bets you can place per event.'
    },
    {
      title: '📊 Understanding Odds',
      content: 'Odds determine your potential payout:\n\n• Higher odds = higher potential payout, but lower probability\n• Lower odds = lower potential payout, but higher probability\n• Odds are displayed in decimal format (e.g., 2.5x means you\'ll win 2.5 times your bet amount)\n• Odds may change as more bets are placed'
    },
    {
      title: '💸 Payouts',
      content: 'If your bet wins:\n\n• Small payouts are processed automatically\n• Larger payouts require manual processing by a Payout Manager\n• Payouts = Bet Amount × Odds (minus any fees)\n• You\'ll receive a notification when your payout is ready\n• You must claim your payout within the designated time window'
    },
    {
      title: '🏁 Event Types',
      content: 'KrayStakes supports several event types:\n\n• Boxing: 1v1 boxing matches\n• Racing: Vehicle races with multiple participants\n• Paintball: Paintball tournaments or matches\n• Custom: Any other type of event the admins create'
    },
    {
      title: '📱 Command Reference',
      content: '• /help - Show the help menu\n• /panel - Create a temporary admin panel (admin only)\n• /setpanel - Create a permanent admin panel in a channel (admin only)\n• /newbie - Create this detailed newbie guide (admin only)'
    },
    {
      title: '❓ Getting Help',
      content: 'If you have questions or need assistance:\n\n• Use the /help command to see the basic help menu\n• Ask in the designated help channel\n• Contact a server administrator or moderator\n• Check pinned messages for frequently asked questions'
    }
  ],
  footer: 'KrayStakes LTD - SA-MP RP Betting System'
};

/**
 * Create a permanent newbie guide in a specified channel
 * @param {Interaction} interaction - The interaction object
 * @param {Client} client - The Discord client
 * @param {TextChannel} channel - The channel to post the guide in
 */
async function createNewbieGuide(interaction, client, channel) {
  try {
    // Create the main embed
    const mainEmbed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle(newbieGuideContent.title)
      .setDescription(newbieGuideContent.description)
      .setFooter({ text: newbieGuideContent.footer })
      .setTimestamp();
    
    // Add fields for the first few sections to the main embed
    for (let i = 0; i < Math.min(3, newbieGuideContent.sections.length); i++) {
      const section = newbieGuideContent.sections[i];
      mainEmbed.addFields({ name: section.title, value: section.content });
    }
    
    // Create additional embeds for the remaining sections
    const additionalEmbeds = [];
    for (let i = 3; i < newbieGuideContent.sections.length; i += 3) {
      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setFooter({ text: newbieGuideContent.footer });
      
      // Add fields for the next sections
      for (let j = i; j < Math.min(i + 3, newbieGuideContent.sections.length); j++) {
        const section = newbieGuideContent.sections[j];
        embed.addFields({ name: section.title, value: section.content });
      }
      
      additionalEmbeds.push(embed);
    }
    
    // Send the embeds to the channel
    await channel.send({ embeds: [mainEmbed] });
    
    // Send each additional embed separately
    for (const embed of additionalEmbeds) {
      await channel.send({ embeds: [embed] });
    }
    
    // Log the action
    logger.info(`Newbie guide created in channel #${channel.name} (${channel.id}) by ${interaction.user.tag} (${interaction.user.id})`);
    
    // Success message
    return true;
  } catch (error) {
    logger.error('Error creating newbie guide:', error);
    return false;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('newbie')
    .setDescription('Create a detailed newbie guide in a channel')
    .addChannelOption(option => 
      option.setName('channel')
        .setDescription('The channel to post the guide in')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  async execute(interaction, client) {
    try {
      // Check if user has permission
      if (!checkAdmin(interaction.member)) {
        return safeReply(interaction, {
          content: 'You do not have permission to use this command.'
        }, true);
      }

      logger.info(`${interaction.user.tag} used /newbie command`);
      
      // Defer reply
      await safeDefer(interaction, true);
      
      // Get the channel or use the current channel
      const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
      
      // Create the newbie guide
      const success = await createNewbieGuide(interaction, client, targetChannel);
      
      if (success) {
        // Success response
        await interaction.editReply({
          embeds: [createSuccessEmbed(
            'Newbie Guide Created',
            `The detailed newbie guide has been created in ${targetChannel}.`
          )]
        });
        
        // Log successful guide creation
        logger.db.info(`Newbie guide created by ${interaction.user.tag} in ${targetChannel.name}`, {
          userId: interaction.user.id,
          channelId: targetChannel.id,
          type: 'newbieGuide'
        });
      } else {
        // Error response
        await interaction.editReply({
          embeds: [createErrorEmbed(
            'Error Creating Guide',
            'There was an error creating the newbie guide. Please check the bot permissions and try again.'
          )]
        });
      }
      
    } catch (error) {
      await handleInteractionError(error, interaction, 'newbie command');
    }
  }
};