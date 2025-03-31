const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const os = require('os');
const { checkAdmin } = require('../utils/permissions');
const { safeReply } = require('../utils/interactions');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Check the bot\'s system status, memory usage, and latency'),
  
  /**
   * Execute the status command
   * @param {Interaction} interaction - The interaction object
   * @param {Client} client - The Discord client
   */
  async execute(interaction, client) {
    logger.info(`Command executed: status by ${interaction.user.tag}`);
    
    try {
      // Check if user has admin permissions
      if (!checkAdmin(interaction.member)) {
        return await safeReply(interaction, {
          embeds: [
            new EmbedBuilder()
              .setTitle('Permission Denied')
              .setDescription('You need administrator permissions to use this command.')
              .setColor('#FF0000')
          ],
          ephemeral: true
        });
      }
      
      // Don't send an acknowledgement message if the interaction was already deferred
      if (!interaction.deferred && !interaction.replied) {
        // Ensure the interaction is acknowledged
        await safeReply(interaction, {
          content: 'Gathering system information...',
          ephemeral: true
        });
      }
      
      // Get system information
      const memoryUsage = process.memoryUsage();
      const systemMemory = {
        total: (os.totalmem() / 1024 / 1024).toFixed(2),
        free: (os.freemem() / 1024 / 1024).toFixed(2),
      };
      
      const cpuUsage = os.loadavg()[0].toFixed(2);
      const uptime = {
        bot: formatUptime(client.uptime),
        system: formatUptime(os.uptime() * 1000)
      };
      
      // Get Discord API latency (ping)
      const latency = client.ws.ping;
      
      // Calculate commands loaded
      const commandCount = client.commands.size;
      
      // Create rich embed for system status
      const statusEmbed = new EmbedBuilder()
        .setTitle('KrayStakes Bot Status')
        .setColor('#00FF00')
        .setDescription('Current system health and performance metrics')
        .addFields(
          { name: 'Memory Usage', value: `🧠 RSS: ${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB\n🧠 Heap: ${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB / ${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`, inline: true },
          { name: 'System Memory', value: `🧠 Total: ${systemMemory.total} MB\n🧠 Free: ${systemMemory.free} MB`, inline: true },
          { name: 'Performance', value: `📊 CPU Load: ${cpuUsage}\n⏱️ API Latency: ${latency}ms`, inline: true },
          { name: 'Uptime', value: `🤖 Bot: ${uptime.bot}\n💻 System: ${uptime.system}`, inline: true },
          { name: 'Bot Stats', value: `📚 Commands: ${commandCount}\n🦾 Node.js: ${process.version}`, inline: true },
          { name: 'Platform', value: `💻 ${os.platform()} ${os.release()}\n💻 ${os.arch()}`, inline: true }
        )
        .setFooter({ text: 'KrayStakes Bot Status Monitor' })
        .setTimestamp();
      
      // Send the status embed
      if (interaction.deferred || interaction.replied) {
        // Use followUp if already replied
        await interaction.followUp({
          embeds: [statusEmbed],
          ephemeral: true
        }).catch(error => {
          logger.error(`Error following up status command: ${error.message}`, { error });
        });
      } else {
        // Use safe reply if not replied yet
        await safeReply(interaction, {
          embeds: [statusEmbed],
          ephemeral: true
        });
      }
      
      logger.info(`Status command executed successfully by ${interaction.user.tag}`);
    } catch (error) {
      logger.error(`Error executing status command: ${error.message}`, { error });
      
      // Check interaction state before responding with error
      const errorEmbed = new EmbedBuilder()
        .setTitle('Error')
        .setDescription('Failed to retrieve system status. Please try again.')
        .setColor('#FF0000');
      
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({
          embeds: [errorEmbed],
          ephemeral: true
        }).catch(followUpError => {
          logger.error(`Failed to send error message after status command: ${followUpError.message}`);
        });
      } else {
        await safeReply(interaction, {
          embeds: [errorEmbed],
          ephemeral: true
        }).catch(replyError => {
          logger.error(`Failed to send error reply for status command: ${replyError.message}`);
        });
      }
    }
  }
};

/**
 * Format uptime in a human-readable format
 * @param {number} ms - Milliseconds of uptime
 * @returns {string} Formatted uptime string
 */
function formatUptime(ms) {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0) parts.push(`${seconds}s`);
  
  return parts.join(' ') || '0s';
}