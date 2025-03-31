// KrayStakes Discord Bot - Logger
const winston = require('winston');
const fs = require('fs');
const path = require('path');
const config = require('../config');

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    let logMessage = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    // Add metadata if available
    if (Object.keys(meta).length > 0) {
      // Remove error object from meta for prettier logging
      const { error, ...restMeta } = meta;
      if (Object.keys(restMeta).length > 0) {
        logMessage += ` ${JSON.stringify(restMeta)}`;
      }
      
      // Add error stack if available
      if (error && error.stack) {
        logMessage += `\n${error.stack}`;
      }
    }
    
    return logMessage;
  })
);

// Create Winston logger
const logger = winston.createLogger({
  level: config.logLevel || 'info',
  format: logFormat,
  defaultMeta: { service: 'kraystakes-bot' },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    }),
    
    // System logs (info and above)
    new winston.transports.File({
      filename: path.join(logsDir, 'system.log'),
      level: 'info'
    }),
    
    // Error logs
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error'
    }),
    
    // Database logs
    new winston.transports.File({
      filename: path.join(logsDir, 'database.log'),
      level: 'debug',
      // Filter to only include database logs
      format: winston.format.combine(
        winston.format.printf(info => {
          if (info.database) {
            return `${info.timestamp} [DB]: ${info.message}`;
          }
          return null;
        })
      )
    })
  ]
});

// Track database logging errors to avoid excessive error messages
let databaseLogErrorShown = false;
let databaseLoggingEnabled = true;

/**
 * Log to database
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {Object} options - Additional options
 */
async function logToDatabase(level, message, options = {}) {
  // Skip database logging if it's disabled due to repeated errors
  if (!databaseLoggingEnabled) {
    return;
  }
  
  try {
    const { Log } = require('../database/models');
    
    // Create log entry in database
    await Log.create({
      level,
      message,
      userId: options.userId || null,
      type: options.type || 'system',
      metadata: options.metadata ? JSON.stringify(options.metadata) : null
    });
    
    // Reset error flag if successful
    if (databaseLogErrorShown) {
      databaseLogErrorShown = false;
      logger.info('Database logging resumed successfully');
    }
    
    // Log to database log file
    logger.log({
      level: 'debug',
      message: `${level.toUpperCase()}: ${message}`,
      database: true,
      userId: options.userId,
      type: options.type
    });
  } catch (error) {
    // Only log the first error to avoid spamming the logs
    if (!databaseLogErrorShown) {
      logger.error(`Error logging to database: ${error.message}`, { error });
      databaseLogErrorShown = true;
      
      // If this is a "no such table" error, disable database logging until the app is restarted
      if (error.message.includes('no such table')) {
        logger.warn('Database logging temporarily disabled due to missing table error');
        databaseLoggingEnabled = false;
      }
    }
  }
}

// Add database logging methods to logger
logger.db = {
  info: (message, options = {}) => logToDatabase('info', message, options),
  warn: (message, options = {}) => logToDatabase('warn', message, options),
  error: (message, options = {}) => logToDatabase('error', message, options),
  debug: (message, options = {}) => logToDatabase('debug', message, options)
};

// Log environment
logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
logger.info(`Debug mode: ${config.debugMode ? 'enabled' : 'disabled'}`);
logger.info(`Log level: ${config.logLevel || 'info'}`);

module.exports = logger;