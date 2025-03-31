// KrayStakes Discord Bot - Main Entry Point
const { Client, Collection, Events, GatewayIntentBits, Partials } = require('discord.js');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const logger = require('./utils/logger');
const { initDatabase } = require('./database/dbInit');
const { safeReply, safeDefer, safeUpdate, safeDeferUpdate, handleInteractionError } = require('./utils/interactions');

// Create a new client instance with improved stability options
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel, Partials.Message, Partials.User],
  // Add improved connection options
  restTimeOffset: 750, // Add offset between API calls to avoid rate limits
  failIfNotExists: false, // Don't throw if entities don't exist
  retryLimit: 5, // Number of retries for failed requests
});

// Create a collection for commands
client.commands = new Collection();

// Add reconnection handling
client.on('disconnect', () => {
  logger.warn('Bot disconnected from Discord gateway. Attempting to reconnect...');
  setTimeout(() => {
    logger.info('Trying to reconnect after disconnect...');
    // Avoid immediate reconnect to prevent API abuse
    client.login(process.env.DISCORD_TOKEN).catch(error => {
      logger.error('Failed to reconnect after disconnect:', error);
    });
  }, 5000);
});

client.on('reconnecting', () => {
  logger.info('Bot is reconnecting to Discord gateway...');
});

client.on('error', (error) => {
  logger.error('Discord client error:', error);
});

// Add cache system for API optimization
client.cache = {
  data: new Map(),
  get: function(key) {
    const item = this.data.get(key);
    if (!item) return null;
    
    // Check if cache has expired
    if (item.expiry < Date.now()) {
      this.data.delete(key);
      return null;
    }
    
    return item.value;
  },
  set: function(key, value, ttl = 3600000) { // Default 1 hour TTL
    this.data.set(key, {
      value: value,
      expiry: Date.now() + ttl
    });
  },
  clear: function() {
    this.data.clear();
    logger.info('Cache cleared');
  }
};

// Scheduled tasks
let scheduledTasks = [];

/**
 * Set up scheduled tasks with node-cron
 */
function setupScheduledTasks() {
  logger.info('Setting up scheduled tasks');
  
  // Import required modules
  const { checkUpcomingEvents } = require('./modules/scheduledEvents');
  const { cleanupOldLogs } = require('./modules/discordBotLogs');
  const { generateWeeklyReport, generateMonthlyReport } = require('./modules/reportsLogs');
  const { scheduleAutomaticUpdates } = require('./modules/leaderboard');
  
  // Cancel any existing scheduled tasks
  scheduledTasks.forEach(task => task.stop());
  scheduledTasks = [];
  
  // Check for upcoming events every 15 minutes
  const eventTask = cron.schedule('*/15 * * * *', async () => {
    try {
      logger.debug('Running scheduled event check');
      await checkUpcomingEvents(client);
    } catch (error) {
      logger.error('Error in scheduled event check:', error);
    }
  });
  scheduledTasks.push(eventTask);
  
  // Clean up old logs once per day at 3 AM
  const logCleanupTask = cron.schedule('0 3 * * *', async () => {
    try {
      logger.debug('Running scheduled log cleanup');
      await cleanupOldLogs(client);
    } catch (error) {
      logger.error('Error in scheduled log cleanup:', error);
    }
  });
  scheduledTasks.push(logCleanupTask);
  
  // Generate weekly report (default: Monday at 9 AM)
  const weeklyReportDay = config.reports.weeklyReportDay ?? 1; // Monday
  const weeklyReportHour = config.reports.weeklyReportHour ?? 9; // 9 AM
  const weeklyReportCron = `0 ${weeklyReportHour} * * ${weeklyReportDay}`;
  
  const weeklyReportTask = cron.schedule(weeklyReportCron, async () => {
    try {
      logger.debug('Generating weekly report');
      await generateWeeklyReport(client);
    } catch (error) {
      logger.error('Error generating weekly report:', error);
    }
  });
  scheduledTasks.push(weeklyReportTask);
  
  // Generate monthly report (default: 1st of month at 9 AM)
  const monthlyReportDay = config.reports.monthlyReportDay ?? 1; // 1st of month
  const monthlyReportHour = config.reports.monthlyReportHour ?? 9; // 9 AM
  const monthlyReportCron = `0 ${monthlyReportHour} ${monthlyReportDay} * *`;
  
  const monthlyReportTask = cron.schedule(monthlyReportCron, async () => {
    try {
      logger.debug('Generating monthly report');
      await generateMonthlyReport(client);
    } catch (error) {
      logger.error('Error generating monthly report:', error);
    }
  });
  scheduledTasks.push(monthlyReportTask);
  
  // Update leaderboard once per day at 4 AM
  const leaderboardTask = cron.schedule('0 4 * * *', async () => {
    try {
      logger.debug('Running scheduled leaderboard update');
      await scheduleAutomaticUpdates(client);
    } catch (error) {
      logger.error('Error in scheduled leaderboard update:', error);
    }
  });
  scheduledTasks.push(leaderboardTask);
  
  logger.info(`Set up ${scheduledTasks.length} scheduled tasks`);
}

/**
 * Load commands from the commands directory
 */
async function loadCommands() {
  const commandsPath = path.join(__dirname, 'commands');
  
  // Create commands directory if it doesn't exist
  if (!fs.existsSync(commandsPath)) {
    fs.mkdirSync(commandsPath, { recursive: true });
    logger.info('Created commands directory');
  }
  
  const allowedCommands = ['help.js', 'newbie.js', 'panel.js', 'processPics.js', 'setpanel.js', 'status.js'];
  const commandFiles = fs.readdirSync(commandsPath)
    .filter(file => file.endsWith('.js') && allowedCommands.includes(file));
  
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    // Set a new item in the Collection with the key as the command name and the value as the exported module
    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
      logger.info(`Loaded command: ${command.data.name}`);
    } else {
      logger.warn(`The command at ${filePath} is missing a required "data" or "execute" property`);
    }
  }
  
  logger.info(`Loaded ${client.commands.size} commands`);
}

/**
 * Create necessary directories and files
 */
function createDirectories() {
  // Create data directory
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    logger.info('Created data directory');
  }
  
  // Create logs directory
  const logsDir = path.join(__dirname, 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
    logger.info('Created logs directory');
  }
  
  // Ensure database directory exists and create an empty database file if it doesn't exist
  const dbStorage = config.database.storage || './data/database.sqlite';
  const dbDir = path.dirname(dbStorage);
  
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    logger.info(`Created database directory: ${dbDir}`);
  }
  
  // Create an empty database file if it doesn't exist
  if (!fs.existsSync(dbStorage)) {
    try {
      fs.writeFileSync(dbStorage, '');
      logger.info(`Created empty database file: ${dbStorage}`);
    } catch (error) {
      logger.error(`Failed to create empty database file: ${error.message}`);
    }
  }
}

/**
 * Initialize the bot
 */
async function initialize() {
  // Set up error handling for unhandled promise rejections
  process.on('unhandledRejection', error => {
    logger.error('Unhandled promise rejection:', error);
    // Try to identify the source of the rejection
    const stack = error?.stack || '';
    if (stack.includes('discord.js')) {
      logger.error('Discord.js related promise rejection. This might indicate a rate limit issue or API problem.');
    } else if (stack.includes('sequelize')) {
      logger.error('Database related promise rejection. Check database connection and integrity.');
    }
  });

  // Set up error handling for uncaught exceptions
  process.on('uncaughtException', error => {
    logger.error('Uncaught exception:', error);
    
    // Log important details for debugging
    const errorMessage = error?.message || 'Unknown error';
    const errorName = error?.name || 'UnknownError';
    logger.error(`Uncaught exception [${errorName}]: ${errorMessage}`);
    
    // Report error details to log file for later analysis
    try {
      const fs = require('fs');
      const path = require('path');
      const logsDir = path.join('.', 'logs');
      
      // Ensure logs directory exists
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      
      // Append to crash log file with timestamp
      const timestamp = new Date().toISOString();
      const crashLogPath = path.join(logsDir, 'crash.log');
      fs.appendFileSync(
        crashLogPath,
        `\n[${timestamp}] UNCAUGHT EXCEPTION: ${errorName}: ${errorMessage}\n${error.stack}\n\n`
      );
      
      logger.info(`Crash details written to ${crashLogPath}`);
    } catch (fileError) {
      logger.error('Error writing crash details to file:', fileError);
    }
    
    // Keep the process running despite the error
  });

  try {
    logger.info('Starting bot initialization');
    
    // Create necessary directories
    createDirectories();
    
    // Initialize database
    await initDatabase();
    
    // Load commands
    await loadCommands();
    
    // Interaction utilities already imported at the top level
    
    // Handle interaction events with improved error handling
    client.on(Events.InteractionCreate, async interaction => {
      try {
        // Handle slash commands with better error recovery
        if (interaction.isChatInputCommand()) {
          const command = client.commands.get(interaction.commandName);
          
          if (!command) {
            logger.warn(`No command matching ${interaction.commandName} was found.`);
            return;
          }
          
          try {
            // Automatically defer long commands to prevent "interaction failed" errors
            // This gives the bot up to 15 minutes to respond instead of just 3 seconds
            const shouldDefer = ['panel', 'setpanel', 'help', 'newbie', 'status'].includes(interaction.commandName);
            if (shouldDefer) {
              await safeDefer(interaction, true);
            }
            
            await command.execute(interaction, client);
          } catch (error) {
            logger.error(`Error executing command ${interaction.commandName}:`, error);
            
            // Use safer error handling
            await handleInteractionError(error, interaction, `command ${interaction.commandName}`);
          }
        }
        // Handle button interactions
        else if (interaction.isButton()) {
          // Immediately defer update for buttons to prevent "interaction failed" errors
          // This gives us up to 15 minutes to respond instead of just 3 seconds
          try {
            // We'll defer updates, but handle failures gracefully - no need to block execution
            const deferSuccess = await safeDeferUpdate(interaction);
            if (!deferSuccess) {
              logger.warn(`Failed to defer button interaction with ID: ${interaction.customId}`);
              // We continue processing - our utility functions will handle expired interactions
            }
          } catch (deferError) {
            // Log but continue - we still want to try processing the button click
            logger.error(`Error deferring button interaction: ${deferError.message}`);
          }
          
          const buttonId = interaction.customId;
          
          // Check if button ID contains a module identifier (format: "module:action")
          if (buttonId.includes(':')) {
            const [moduleId, actionId] = buttonId.split(':');
            logger.debug(`Processing button click: module=${moduleId}, action=${actionId}`);
            
            // Create a list of enabled modules based on our core functionality
            const enabledModules = [
              'guideHelp',             // For help button functionality
              'adminPanel',            // For admin panel
              'configurationSettings', // For panel configuration
              'discordBotLogs',        // For viewing bot logs
              'changelogDebug',        // For changelog and debug mode
              'eventCreation',         // For creating events
              'eventManagement',       // For managing events
              'winnerSelection',       // For selecting winners
              'payoutManagement',      // For managing payouts
              'scheduledEvents',       // For viewing scheduled events
              'reportsLogs',           // For reports and logs
              'leaderboard'            // For leaderboards
            ];
            
            // Check if module is enabled (only allow our core modules for this simplified version)
            if (!enabledModules.includes(moduleId)) {
              logger.warn(`Button clicked for disabled module: ${moduleId}`);
              try {
                // Make sure we properly handle the interaction even for disabled modules
                if (interaction.deferred) {
                  await interaction.editReply({
                    content: `This functionality (${moduleId}) is not enabled in this version of the bot.`,
                    ephemeral: true,
                    components: [] // Remove buttons to prevent further clicking
                  });
                } else {
                  await safeUpdate(interaction, {
                    content: `This functionality (${moduleId}) is not enabled in this version of the bot.`,
                    ephemeral: true,
                    components: [] // Remove buttons to prevent further clicking
                  });
                }
                logger.info(`Successfully responded to disabled module button: ${moduleId}`);
              } catch (disabledModuleError) {
                logger.error(`Error responding to disabled module button ${moduleId}:`, disabledModuleError);
                // Use our safer error handling utility
                await handleInteractionError(disabledModuleError, interaction, `disabled-module-${moduleId}`);
              }
              return;
            }
            
            // Import the appropriate module handler based on the module ID
            try {
              // Only import enabled modules
              let moduleHandler;
              
              switch (moduleId) {
                case 'adminPanel':
                  moduleHandler = require('./modules/adminPanel');
                  break;
                case 'configurationSettings':
                  moduleHandler = require('./modules/configurationSettings');
                  break;
                case 'guideHelp':
                  moduleHandler = require('./modules/guideHelp');
                  break;
                case 'discordBotLogs':
                  moduleHandler = require('./modules/discordBotLogs');
                  break;
                case 'changelogDebug':
                  moduleHandler = require('./modules/changelogDebug');
                  break;
                case 'eventCreation':
                  moduleHandler = require('./modules/eventCreation');
                  break;
                case 'eventManagement':
                  moduleHandler = require('./modules/eventManagement');
                  break;
                case 'winnerSelection':
                  moduleHandler = require('./modules/winnerSelection');
                  break;
                case 'payoutManagement':
                  moduleHandler = require('./modules/payoutManagement');
                  break;
                case 'scheduledEvents':
                  moduleHandler = require('./modules/scheduledEvents');
                  break;
                case 'reportsLogs':
                  moduleHandler = require('./modules/reportsLogs');
                  break;
                case 'leaderboard':
                  moduleHandler = require('./modules/leaderboard');
                  break;
                default:
                  throw new Error(`Module not found: ${moduleId}`);
              }
              
              // Call the module's handleButton function
              if (moduleHandler && typeof moduleHandler.handleButton === 'function') {
                await moduleHandler.handleButton(actionId, interaction, client);
              } else {
                logger.warn(`Module ${moduleId} does not have a handleButton function`);
                await safeUpdate(interaction, {
                  embeds: [require('./utils/embeds').createErrorEmbed(
                    'Button Handler Not Implemented',
                    `Button handler not implemented for ${moduleId}. This feature will be available in a future update.`
                  )],
                  components: [] // Remove the buttons to prevent further clicking
                });
              }
            } catch (error) {
              logger.error(`Error handling button ${buttonId}:`, error);
              
              // Use our safer error handling utility
              await handleInteractionError(error, interaction, `button ${buttonId}`);
            }
          } else {
            logger.warn(`Invalid button ID format: ${buttonId}`);
            
            // Use our safer update method with better error handling
            await safeUpdate(interaction, {
              embeds: [require('./utils/embeds').createErrorEmbed(
                'Unknown Button',
                `The button "${buttonId}" is not configured correctly. Please contact an administrator.`
              )],
              components: [] // Remove the buttons to prevent further clicking
            });
          }
        }
        // Handle select menu interactions
        else if (interaction.isStringSelectMenu()) {
          // Immediately defer update for select menus to prevent "interaction failed" errors
          try {
            const deferSuccess = await safeDeferUpdate(interaction);
            if (!deferSuccess) {
              logger.warn(`Failed to defer select menu interaction with ID: ${interaction.customId}`);
            }
          } catch (deferError) {
            logger.error(`Error deferring select menu interaction: ${deferError.message}`);
          }
          
          const selectId = interaction.customId;
          
          // Check if select ID contains a module identifier (format: "module:action")
          if (selectId.includes(':')) {
            const [moduleId, actionId] = selectId.split(':');
            logger.debug(`Processing select menu: module=${moduleId}, action=${actionId}`);
            
            // Create a list of enabled modules for select menu interactions
            const enabledModules = [
              'eventManagement',       // For managing events
              'winnerSelection',       // For selecting winners
              'payoutManagement',      // For managing payouts
              'scheduledEvents',       // For viewing scheduled events
              'reportsLogs'            // For reports and logs
            ];
            
            // Check if module is enabled
            if (!enabledModules.includes(moduleId)) {
              logger.warn(`Select menu used for disabled module: ${moduleId}`);
              try {
                // Make sure we properly handle the interaction even for disabled modules
                if (interaction.deferred) {
                  await interaction.editReply({
                    embeds: [require('./utils/embeds').createErrorEmbed(
                      'Feature Not Available',
                      `This functionality (${moduleId}) is not enabled in this version of the bot.`
                    )],
                    components: [] // Remove the select menu to prevent further interactions
                  });
                } else {
                  await safeUpdate(interaction, {
                    embeds: [require('./utils/embeds').createErrorEmbed(
                      'Feature Not Available',
                      `This functionality (${moduleId}) is not enabled in this version of the bot.`
                    )],
                    components: [] // Remove the select menu to prevent further interactions
                  });
                }
                logger.info(`Successfully responded to disabled module select menu: ${moduleId}`);
              } catch (disabledModuleError) {
                logger.error(`Error responding to disabled module select menu ${moduleId}:`, disabledModuleError);
                // Use our safer error handling utility
                await handleInteractionError(disabledModuleError, interaction, `disabled-select-menu-${moduleId}`);
              }
              return;
            }
            
            // Import the appropriate module handler based on the module ID
            try {
              let moduleHandler;
              
              switch (moduleId) {
                case 'eventManagement':
                  moduleHandler = require('./modules/eventManagement');
                  break;
                case 'winnerSelection':
                  moduleHandler = require('./modules/winnerSelection');
                  break;
                case 'payoutManagement':
                  moduleHandler = require('./modules/payoutManagement');
                  break;
                case 'scheduledEvents':
                  moduleHandler = require('./modules/scheduledEvents');
                  break;
                case 'reportsLogs':
                  moduleHandler = require('./modules/reportsLogs');
                  break;
                default:
                  throw new Error(`Module not found: ${moduleId}`);
              }
              
              // Call the module's handleSelect function
              if (moduleHandler && typeof moduleHandler.handleSelect === 'function') {
                await moduleHandler.handleSelect(actionId, interaction, client);
              } else {
                logger.warn(`Module ${moduleId} does not have a handleSelect function`);
                await safeUpdate(interaction, {
                  embeds: [require('./utils/embeds').createErrorEmbed(
                    'Select Menu Handler Not Implemented',
                    `Select menu handler not implemented for ${moduleId}. This feature will be available in a future update.`
                  )],
                  components: [] // Remove the select menu to prevent further interactions
                });
              }
            } catch (error) {
              logger.error(`Error handling select menu ${selectId}:`, error);
              
              // Use our safer error handling utility
              await handleInteractionError(error, interaction, `select-menu ${selectId}`);
            }
          } else {
            logger.warn(`Invalid select menu ID format: ${selectId}`);
            
            // Use our safer update method with better error handling
            await safeUpdate(interaction, {
              embeds: [require('./utils/embeds').createErrorEmbed(
                'Unknown Select Menu',
                `The select menu "${selectId}" is not configured correctly. Please contact an administrator.`
              )],
              components: [] // Remove the select menu to prevent further interactions
            });
          }
        }
        // Handle modal submit interactions - simplified for core functionality
        else if (interaction.isModalSubmit()) {
          // Immediately defer reply for modal submits to prevent "interaction failed" errors
          try {
            const deferSuccess = await safeDefer(interaction, true);
            if (!deferSuccess) {
              logger.warn(`Failed to defer modal submit interaction with ID: ${interaction.customId}`);
            }
          } catch (deferError) {
            logger.error(`Error deferring modal submit interaction: ${deferError.message}`);
          }
          
          const modalId = interaction.customId;
          
          // Check if modal ID contains a module identifier (format: "module:action")
          if (modalId.includes(':')) {
            const [moduleId, actionId] = modalId.split(':');
            logger.debug(`Processing modal submit: module=${moduleId}, action=${actionId}`);
            
            // Create a list of enabled modules for modal submissions
            const enabledModules = [
              'configurationSettings',  // For panel configuration
              'eventCreation',         // For creating events
              'eventManagement',       // For managing events
              'winnerSelection',       // For selecting winners
              'payoutManagement',      // For managing payouts
              'reportsLogs'            // For reports and logs
            ];
            
            // Check if module is enabled in our simplified version
            if (!enabledModules.includes(moduleId)) {
              logger.warn(`Modal submitted for disabled module: ${moduleId}`);
              try {
                // Make sure we properly handle the interaction even for disabled modules
                if (interaction.deferred) {
                  await interaction.editReply({
                    embeds: [require('./utils/embeds').createErrorEmbed(
                      'Feature Not Available',
                      'This feature is not available in the simplified version of the bot.'
                    )],
                    ephemeral: true
                  });
                } else {
                  await safeReply(interaction, {
                    embeds: [require('./utils/embeds').createErrorEmbed(
                      'Feature Not Available',
                      'This feature is not available in the simplified version of the bot.'
                    )],
                    ephemeral: true
                  });
                }
                logger.info(`Successfully responded to disabled module modal: ${moduleId}`);
              } catch (disabledModuleError) {
                logger.error(`Error responding to disabled module modal ${moduleId}:`, disabledModuleError);
                // Use our safer error handling utility
                await handleInteractionError(disabledModuleError, interaction, `disabled-modal-${moduleId}`);
              }
              return;
            }
            
            // Import the appropriate module handler based on the module ID
            try {
              let moduleHandler;
              
              switch (moduleId) {
                case 'configurationSettings':
                  moduleHandler = require('./modules/configurationSettings');
                  break;
                case 'eventCreation':
                  moduleHandler = require('./modules/eventCreation');
                  break;
                case 'eventManagement':
                  moduleHandler = require('./modules/eventManagement');
                  break;
                case 'winnerSelection':
                  moduleHandler = require('./modules/winnerSelection');
                  break;
                case 'payoutManagement':
                  moduleHandler = require('./modules/payoutManagement');
                  break;
                case 'reportsLogs':
                  moduleHandler = require('./modules/reportsLogs');
                  break;
                default:
                  throw new Error(`Module not found: ${moduleId}`);
              }
              
              // Call the module's handleModalSubmit function
              if (moduleHandler && typeof moduleHandler.handleModalSubmit === 'function') {
                await moduleHandler.handleModalSubmit(actionId, interaction, client);
              } else {
                logger.warn(`Module ${moduleId} does not have a handleModalSubmit function`);
                await safeReply(interaction, {
                  embeds: [require('./utils/embeds').createErrorEmbed(
                    'Modal Handler Not Implemented',
                    `Modal handler for ${moduleId} is not implemented in this version of the bot.`
                  )],
                  ephemeral: true
                });
              }
            } catch (error) {
              logger.error(`Error handling modal submit ${modalId}:`, error);
              await handleInteractionError(error, interaction, `modal submit ${modalId}`);
            }
          } else {
            logger.warn(`Invalid modal ID format: ${modalId}`);
            await safeReply(interaction, {
              embeds: [require('./utils/embeds').createErrorEmbed(
                'Invalid Modal Format',
                'This modal is not configured correctly. Please contact an administrator.'
              )],
              ephemeral: true
            });
          }
        }
      } catch (error) {
        logger.error('Error handling interaction:', error);
        
        try {
          // For any unhandled interaction errors, create a fallback error response
          if (interaction && !interaction.replied && !interaction.deferred) {
            // Try to provide a generic error message using safeReply
            await safeReply(interaction, { 
              content: 'An unexpected error occurred. Please try again later.',
              ephemeral: true 
            });
          }
        } catch (responseError) {
          // If we can't even respond, just log it
          logger.error('Failed to send error response:', responseError);
        }
      }
    });
    
    // Set up scheduled tasks
    setupScheduledTasks();
    
    // Log in to Discord - handle token issues gracefully
    try {
      // Check if token exists
      if (!config.token) {
        logger.error('Discord token is missing. Please check your environment variables or .env file.');
        throw new Error('Discord token is missing or invalid');
      }
      
      // Try logging in with the token
      await client.login(config.token);
      logger.info('Bot logged in successfully');
      
      // Log when the bot is ready
      client.once(Events.ClientReady, readyClient => {
        logger.info(`Bot is ready! Logged in as ${readyClient.user.tag}`);
      });
    } catch (error) {
      // For development environment, log the error but don't exit
      if (config.env === 'development' || config.env === 'test') {
        logger.warn(`Discord login failed: ${error.message} (Check your DISCORD_TOKEN environment variable)`);
        logger.info('Bot initialization will continue without Discord connection for development/testing');
      } else {
        // In production, this is a critical error
        logger.error(`Failed to log in to Discord: ${error.message}. Make sure DISCORD_TOKEN is set correctly.`);
        throw error;
      }
    }
    
  } catch (error) {
    logger.error('Error during bot initialization:', error);
    process.exit(1);
  }
}

// Start the bot
initialize();