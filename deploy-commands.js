// KrayStakes Discord Bot - Command Deployment Script
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const logger = require('./utils/logger');

/**
 * Deploy slash commands to Discord
 */
async function deployCommands() {
  // Get token and client ID from config
  const token = config.token;
  const clientId = config.clientId;
  
  if (!token || !clientId) {
    logger.error('Missing token or clientId in configuration. Please check your .env file.');
    process.exit(1);
  }
  
  try {
    logger.info('Starting command deployment...');
    
    const commands = [];
    const commandsPath = path.join(__dirname, 'commands');
    
    // Check if commands directory exists
    if (!fs.existsSync(commandsPath)) {
      logger.warn('Commands directory does not exist. Creating it...');
      fs.mkdirSync(commandsPath, { recursive: true });
    }
    
    // Get all command files
    const allowedCommands = ['help.js', 'newbie.js', 'panel.js', 'setpanel.js', 'status.js'];
    const commandFiles = fs.readdirSync(commandsPath)
      .filter(file => file.endsWith('.js') && allowedCommands.includes(file));
    
    // Load all commands
    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      
      try {
        // Clear cache to ensure we get the latest version
        delete require.cache[require.resolve(filePath)];
        const command = require(filePath);
        
        // Add command data to array
        if ('data' in command && 'execute' in command) {
          commands.push(command.data.toJSON());
          logger.info(`Added command: ${command.data.name}`);
        } else {
          logger.warn(`The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
      } catch (commandError) {
        logger.error(`Error loading command from ${filePath}:`, commandError);
      }
    }
    
    // No commands found
    if (commands.length === 0) {
      logger.warn('No commands found. Make sure you have command files in the commands directory.');
      return; // Return instead of exiting when imported
    }
    
    // Create and prepare REST instance
    const rest = new REST({ version: '10' }).setToken(token);
    
    // Deploy commands
    logger.info(`Deploying ${commands.length} commands...`);
    
    try {
      const data = await rest.put(
        Routes.applicationCommands(clientId),
        { body: commands },
      );
      
      logger.info(`Successfully deployed ${data.length} commands.`);
    } catch (error) {
      logger.error('Error deploying commands:', error);
    }
  } catch (error) {
    logger.error('Error preparing commands for deployment:', error);
  }
}

// Run the deployment if script is called directly
if (require.main === module) {
  deployCommands();
}

module.exports = { deployCommands };