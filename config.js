// KrayStakes Discord Bot - Configuration
require('dotenv').config();

module.exports = {
  // Environment
  env: process.env.NODE_ENV || 'development',
  
  // Bot configuration
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  
  // Debug Mode
  debugMode: process.env.DEBUG_MODE === 'true',
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // UI Colors
  colors: {
    primary: '#5865F2',    // Discord Blue
    secondary: '#3498db',  // Light Blue
    success: '#57F287',    // Green
    danger: '#ED4245',     // Red
    warning: '#FEE75C',    // Yellow
    info: '#5865F2',       // Discord Blue
    default: '#99AAB5',    // Grey
  },
  
  // Timezone setting (default: UTC)
  timezone: process.env.TIMEZONE || 'UTC',
  
  // Reminder times (in minutes before event)
  reminderTimes: [1440, 60, 15], // 24 hours, 1 hour, 15 minutes
  
  // Channel configuration
  channels: {
    announcements: process.env.ANNOUNCEMENTS_CHANNEL,
    betting: process.env.BETTING_CHANNEL,
    results: process.env.RESULTS_CHANNEL,
    logs: process.env.LOGS_CHANNEL,
    reports: process.env.REPORTS_CHANNEL
  },
  
  // Role configuration
  roles: {
    admin: process.env.ADMIN_ROLE,
    eventManager: process.env.EVENT_MANAGER_ROLE,
    payoutManager: process.env.PAYOUT_MANAGER_ROLE
  },
  
  // Database configuration
  database: {
    dialect: 'sqlite',
    storage: './data/database.sqlite',
    logging: false, // Set to true for SQL query logging
  },
  
  // Log configuration
  logs: {
    directory: './logs',
    retentionDays: 30, // Number of days to keep logs before cleanup (0 = keep indefinitely)
  },
  
  // Default betting configuration
  defaultBetting: {
    minBet: 10,      // Minimum bet amount
    maxBet: 1000,    // Maximum bet amount
    limitPerUser: 2, // Maximum number of bets per user per event
    feePercent: 5,   // Fee percentage taken from winnings
  },
  
  // Default payout configuration
  defaultPayout: {
    autoPayoutThreshold: 500, // Amount under which payouts are made automatically
    payoutWindow: 7,          // Number of days to claim payouts
  },
  
  // Reports configuration
  reports: {
    weeklyReportDay: 1,      // Day of week for weekly reports (0 = Sunday, 1 = Monday, etc.)
    weeklyReportHour: 9,     // Hour of day for weekly reports (9 = 9 AM)
    monthlyReportDay: 1,     // Day of month for monthly reports
    monthlyReportHour: 9,    // Hour of day for monthly reports
  }
};