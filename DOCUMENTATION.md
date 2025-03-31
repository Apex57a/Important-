# KrayStakes Discord Bot - Complete Documentation

## Overview

KrayStakes is a sophisticated Discord bot designed for managing in-game betting events for SA-MP RP, providing comprehensive administrative tools and financial tracking with advanced monitoring capabilities.

This documentation covers all aspects of the KrayStakes bot, from its technical architecture to user features and administrative functions.

---

## Technical Architecture

### Stack
- **Discord.js**: Core interaction with Discord API
- **Node.js**: JavaScript runtime environment
- **Sequelize ORM**: Database abstraction layer
- **SQLite**: Default database engine
- **Winston**: Logging framework

### Directory Structure

```
├── attached_assets/       # Image files and documentation assets
├── backups/               # Database backup storage
├── commands/              # Discord slash commands
│   ├── help.js            # Help command implementation
│   ├── newbie.js          # Newbie guide command
│   ├── panel.js           # Admin panel command
│   ├── setpanel.js        # Set admin panel command
│   └── status.js          # Bot status command
├── data/                  # Data files for bot operation
├── database/              # Database files and models
│   ├── dbInit.js          # Database initialization
│   └── models/            # Sequelize model definitions
├── logs/                  # Log files
├── modules/               # Functional modules
│   ├── adminPanel.js      # Admin panel functionality
│   ├── configurationSettings.js # Bot configuration
│   ├── eventCreation.js   # Betting event creation
│   ├── eventManagement.js # Event management features
│   └── ...                # Additional modules
├── utils/                 # Utility functions
│   ├── embeds.js          # Discord embed creators
│   ├── interactions.js    # Interaction utilities
│   ├── logger.js          # Logging configuration
│   ├── permissions.js     # Permission checking
│   └── requestQueue.js    # API request rate limiting
├── .env                   # Environment variables (create from .env.example)
├── .env.example           # Example environment config
├── config.js              # Bot configuration
├── deploy-commands.js     # Command deployment script
├── index.js               # Main bot entry point
├── package.json           # Node.js dependencies
└── README.md              # Basic readme information
```

### Database Models

The KrayStakes bot uses the following database models:

1. **Events**
   - Stores betting events with details like title, description, etc.
   - Manages event statuses (open, locked, completed)

2. **Bets**
   - Records user bets for each event
   - Tracks amount, target selection, and status

3. **Payouts**
   - Records payouts for winning bets
   - Tracks payout amount, recipient, and timestamp

4. **Logs**
   - Stores important bot actions for auditing
   - Records user actions, timestamps, and affected entities

5. **Configurations**
   - Stores bot configuration values
   - Manages admin settings, betting limits, etc.

---

## Core Commands

The simplified KrayStakes version focuses on five essential commands:

### `/help`
- Displays a help menu with available commands
- Offers guidance on bot usage for different user roles
- Includes navigation buttons to different help sections

### `/newbie`
- Creates a detailed guide for new users to understand the betting system
- Posts permanent embeds with explanations in a specified channel
- Includes visual examples and step-by-step instructions

### `/panel`
- Creates a temporary admin panel in the current channel
- Provides buttons for various administrative functions
- Accessible only to users with admin permissions

### `/setpanel`
- Creates a permanent admin panel in a specified channel
- Similar to `/panel` but persists across bot restarts
- Accessible only to server administrators

### `/status`
- Shows bot health metrics and statistics
- Displays uptime, command usage, and system status
- Useful for monitoring bot performance

---

## Admin Panel Modules

The admin panel provides access to these core modules:

### Administration Panel
- Central hub for bot management
- Quick access to all administrative functions
- Permissions-based access control

### Configuration Settings
- Manage betting configurations (minimums, maximums, etc.)
- Configure payout settings and multipliers
- Set up channel configuration for bot announcements
- Toggle debug mode for troubleshooting

### Event Management
- Create, edit, and manage betting events
- Lock/unlock events to control betting periods
- Announce events to designated channels
- View bets placed on specific events

---

## Error Handling & Stability Features

The KrayStakes bot implements sophisticated error handling to ensure stability:

### Request Queue System
- Prevents Discord API rate limiting
- Dynamically adjusts request timing based on response patterns
- Intelligently retries failed requests with backoff strategy

### Interaction Error Recovery
- Safely handles expired interactions
- Multiple fallback mechanisms for different failure scenarios
- Comprehensive logging of error states

### Database Reliability
- Automatic database creation and initialization
- Structure validation on startup
- Transaction-based operations for data integrity

### Global Error Handling
- Unhandled promise rejection capture
- Uncaught exception handling
- Detailed error logging with context information

---

## Scheduled Tasks

The bot performs these regular maintenance tasks:

1. **Log Cleanup**: Removes old logs to prevent disk space issues
2. **Database Backups**: Creates regular backups of the database
3. **Expired Event Handling**: Automatically processes events past their end time
4. **Status Updates**: Updates internal metrics for monitoring
5. **Rate Limit Resets**: Periodically resets rate limit counters

---

## Customization & Extension

### Adding New Commands
1. Create a new file in the `commands` directory
2. Implement the command structure following existing patterns
3. Run the deploy-commands.js script to register with Discord

### Creating New Modules
1. Add a new file in the `modules` directory
2. Implement the module's functionality with proper error handling
3. Export functions for use in commands or other modules
4. Update the index.js file to enable the module if necessary

---

## Security Considerations

### Bot Token Security
- Store your Discord token in the .env file only
- Never commit tokens to version control
- Rotate tokens if you suspect they've been compromised

### Permission Management
- The bot uses permission checks before executing admin commands
- Configure role-based access in your Discord server
- Audit logs track administrative actions

### Data Protection
- User data is stored locally in the SQLite database
- Regular backups help prevent data loss
- Access to the bot's hosting environment should be restricted

---

## Troubleshooting Guide

### Common Issues

#### Interaction Failed Errors
- Usually caused by slow response times or rate limiting
- The bot includes comprehensive handling to minimize these
- Check logs for details on specific failures

#### Database Errors
- Verify database file permissions
- Check for disk space issues
- Database initialization should handle most structural problems

#### Command Registration Problems
- Run the deploy-commands.js script again
- Verify bot has applications.command scope permission
- Check for errors in the logs directory

### Log Locations

- **System Logs**: `logs/system.log`
- **Error Logs**: `logs/error.log`
- **Database Logs**: `logs/database.log`
- **Crash Logs**: `logs/crash.log`

---

## Performance Optimization

For optimal performance:

1. **Hardware**: Minimum 1GB RAM, 1 CPU core
2. **Network**: Stable connection with low latency to Discord servers
3. **Storage**: At least 500MB free space for database and logs
4. **Scaling**: The bot can handle multiple servers, but performance may vary

---

## Maintenance Recommendations

1. **Regular Backups**: Back up the database directory weekly
2. **Log Rotation**: Monitor log size and archive/delete as needed
3. **Updates**: Keep Node.js and dependencies updated
4. **Monitoring**: Check the status command periodically for health metrics

---

## Support & Contact

For additional support:
- Refer to this documentation
- Check the logs for specific error information
- Contact the developer for assistance with complex issues

---

© 2025 KrayStakes LTD - All Rights Reserved