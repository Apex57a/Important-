// KrayStakes Discord Bot - Database Initialization
const { Sequelize } = require('sequelize');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');

// Create Sequelize instance
const sequelize = new Sequelize({
  dialect: config.database.dialect || 'sqlite',
  storage: config.database.storage || './data/database.sqlite',
  logging: config.database.logging ? msg => logger.debug(msg, { database: true }) : false,
  define: {
    freezeTableName: false,
    timestamps: true
  }
});

/**
 * Initialize the database
 * @returns {Promise<void>}
 */
async function initDatabase() {
  try {
    // Create data directory if it doesn't exist
    const dataDir = path.dirname(config.database.storage || './data/database.sqlite');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      logger.info(`Created data directory: ${dataDir}`);
    }
    
    // Test database connection - retry up to 3 times
    let connected = false;
    let attempts = 0;
    while (!connected && attempts < 3) {
      try {
        attempts++;
        await sequelize.authenticate();
        connected = true;
        logger.info('Database connection established successfully.');
      } catch (authError) {
        if (attempts >= 3) {
          throw authError;
        }
        logger.warn(`Database connection attempt ${attempts} failed, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retrying
      }
    }
    
    // Load models and sync with database - with more careful error handling
    try {
      await loadModels();
    } catch (modelError) {
      logger.error('Error loading models:', modelError);
      // Continue anyway - we'll try to recreate critical tables
    }
    
    // Initialize default configuration values
    try {
      await initDefaultConfig();
    } catch (configError) {
      logger.error('Error initializing default configuration:', configError);
      // Continue anyway
    }
    
    logger.info('Database initialization completed.');
  } catch (error) {
    logger.error('Unable to connect to the database:', error);
    // Don't throw here - let the bot continue operation with limited functionality
  }
}

/**
 * Load database models and synchronize them
 * @returns {Promise<void>}
 */
async function loadModels() {
  try {
    // Import models
    const models = require('./models');
    
    logger.info('Starting database synchronization...');
    
    // Check if database is fresh or has existing tables
    const tables = await sequelize.getQueryInterface().showAllTables();
    logger.info(`Existing database tables: ${tables.length ? tables.join(', ') : 'none'}`);
    
    const isFreshDatabase = tables.length === 0;
    
    // For a completely fresh database, sync in a more controlled order
    if (isFreshDatabase) {
      logger.info('Setting up a fresh database...');
      
      // First create the independent tables (Log and Configuration)
      try {
        logger.info('Creating Log table...');
        await models.Log.sync();
        
        logger.info('Creating Configuration table...');
        await models.Configuration.sync();
        
        // Next create the Event table (it has no dependencies)
        logger.info('Creating Event table...');
        await models.Event.sync();
        
        // Create Bet table after Event
        logger.info('Creating Bet table...');
        await models.Bet.sync();
        
        // Create Payout table last (it depends on both Event and Bet)
        logger.info('Creating Payout table...');
        await models.Payout.sync();
        
        // Finally sync all to ensure relationships are properly set up
        await sequelize.sync();
        
        logger.info('All tables created for fresh database.');
      } catch (syncError) {
        logger.error('Error syncing fresh database tables:', syncError);
        
        // On an error, try a more aggressive approach - do a full sync
        logger.warn('Attempting full synchronization with force option...');
        await sequelize.sync({ force: true });
      }
    } else {
      // For existing database, just make sure critical tables exist
      logger.info('Updating existing database structure...');
      
      // First make sure critical tables exist
      if (!tables.includes('logs')) {
        logger.info('Creating Log table...');
        await models.Log.sync();
      }
      
      if (!tables.includes('configurations')) {
        logger.info('Creating Configuration table...');
        await models.Configuration.sync();
      }
      
      // For existing database, use alter to safely update schema
      // Alter is safer than force, as it doesn't drop tables
      await sequelize.sync({ alter: true });
    }
    
    // Verify that tables were created properly
    try {
      const updatedTables = await sequelize.getQueryInterface().showAllTables();
      logger.info(`Database tables after synchronization: ${updatedTables.join(', ')}`);
      
      // Check for required tables
      const requiredTables = ['logs', 'configurations', 'events', 'bets', 'payouts'];
      const missingTables = requiredTables.filter(table => !updatedTables.includes(table));
      
      if (missingTables.length > 0) {
        logger.warn(`Missing required tables: ${missingTables.join(', ')}`);
        
        // Try to create just those missing tables
        for (const missingTable of missingTables) {
          // Get model name from table name (singular, capitalized)
          const modelName = missingTable.slice(0, -1).charAt(0).toUpperCase() + missingTable.slice(0, -1).slice(1);
          
          if (models[modelName]) {
            logger.info(`Creating missing table: ${missingTable} using model ${modelName}`);
            await models[modelName].sync({ force: true });
          }
        }
      } else {
        logger.info('All required tables are present');
      }
    } catch (verifyError) {
      logger.error('Error verifying database tables:', verifyError);
    }
    
    logger.info('Database models synchronization completed.');
  } catch (error) {
    logger.error('Error loading models:', error);
    throw error;
  }
}

/**
 * Initialize default configuration values if they don't exist
 * @returns {Promise<void>}
 */
async function initDefaultConfig() {
  try {
    // Get Configuration model
    const { Configuration } = require('./models');
    
    // Default configuration values
    const defaultConfig = [
      // Timezone setting
      {
        key: 'timezone',
        value: config.timezone || 'UTC',
        category: 'general',
        description: 'Default timezone for displaying dates and times'
      },
      // Betting configuration
      {
        key: 'minBet',
        value: config.defaultBetting.minBet.toString(),
        category: 'betting',
        description: 'Minimum bet amount'
      },
      {
        key: 'maxBet',
        value: config.defaultBetting.maxBet.toString(),
        category: 'betting',
        description: 'Maximum bet amount'
      },
      {
        key: 'limitPerUser',
        value: config.defaultBetting.limitPerUser.toString(),
        category: 'betting',
        description: 'Maximum number of bets per user per event'
      },
      {
        key: 'feePercent',
        value: config.defaultBetting.feePercent.toString(),
        category: 'betting',
        description: 'Fee percentage taken from winnings'
      },
      // Payout configuration
      {
        key: 'autoPayoutThreshold',
        value: config.defaultPayout.autoPayoutThreshold.toString(),
        category: 'payout',
        description: 'Amount under which payouts are made automatically'
      },
      {
        key: 'payoutWindow',
        value: config.defaultPayout.payoutWindow.toString(),
        category: 'payout',
        description: 'Number of days to claim payouts'
      },
      // Reports configuration
      {
        key: 'weeklyReportDay',
        value: config.reports.weeklyReportDay.toString(),
        category: 'reports',
        description: 'Day of week for weekly reports (0 = Sunday, 1 = Monday, etc.)'
      },
      {
        key: 'weeklyReportHour',
        value: config.reports.weeklyReportHour.toString(),
        category: 'reports',
        description: 'Hour of day for weekly reports (9 = 9 AM)'
      },
      {
        key: 'monthlyReportDay',
        value: config.reports.monthlyReportDay.toString(),
        category: 'reports',
        description: 'Day of month for monthly reports'
      },
      {
        key: 'monthlyReportHour',
        value: config.reports.monthlyReportHour.toString(),
        category: 'reports',
        description: 'Hour of day for monthly reports'
      },
      // Debug mode
      {
        key: 'debugMode',
        value: config.debugMode.toString(),
        category: 'system',
        description: 'Enable/disable debug mode'
      }
    ];
    
    // Insert or update each default config
    for (const configItem of defaultConfig) {
      await Configuration.findOrCreate({
        where: { key: configItem.key },
        defaults: configItem
      });
    }
    
    logger.info('Default configuration initialized.');
  } catch (error) {
    logger.error('Error initializing default configuration:', error);
  }
}

module.exports = {
  sequelize,
  initDatabase,
  loadModels,
  initDefaultConfig
};