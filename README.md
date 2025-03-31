<<<<<<< HEAD
# Discord-Bot-Improvements-
=======
<<<<<<< HEAD
# Discord-Bot-Improvements-
=======
# KrayStakes Discord Bot

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Node](https://img.shields.io/badge/node-v16.x+-green.svg)
![Discord.js](https://img.shields.io/badge/discord.js-v14-blue.svg)

A sophisticated Discord bot for KrayStakes LTD that manages in-game betting events for SA-MP RP, providing comprehensive administrative tools and financial tracking with advanced monitoring capabilities.

## Features

- **Robust Command System**: Focused set of slash commands for user interaction
- **Admin Panel**: Comprehensive administrative tools for event and bet management
- **Betting System**: Complete betting event lifecycle management
- **User-Friendly Guides**: In-app documentation and onboarding for new users
- **Stability-Focused**: Enhanced error handling and API rate limit management
- **Secure**: Permission-based access controls for administrative functions

## Core Commands

- **/help** - Shows available commands and usage information
- **/newbie** - Creates a detailed guide for new users
- **/panel** - Opens a temporary admin panel in the current channel
- **/setpanel** - Creates a permanent admin panel in a specified channel
- **/status** - Displays bot health metrics and statistics

## Technical Stack

- **Discord.js**: Core interaction with Discord API
- **Node.js**: JavaScript runtime environment
- **Sequelize ORM**: Database abstraction layer
- **SQLite**: Lightweight database engine
- **Winston**: Comprehensive logging framework

## Documentation

This package includes comprehensive documentation:

- **[Installation Guide](INSTALLATION_GUIDE.md)**: Step-by-step setup instructions
- **[Complete Documentation](DOCUMENTATION.md)**: Detailed feature and architecture information
- **[Troubleshooting Guide](TROUBLESHOOTING.md)**: Solutions for common issues
- **[Changelog](CHANGELOG.md)**: Version history and updates

## Quick Start

1. Create a Discord application and bot in the Discord Developer Portal
2. Copy `.env.example` to `.env` and add your bot token and client ID
3. Install dependencies with `npm install`
4. Deploy commands with `node deploy-commands.js`
5. Start the bot with `node index.js`
6. Invite the bot to your server using the OAuth2 URL generator in the Discord Developer Portal

For detailed setup instructions, see the [Installation Guide](INSTALLATION_GUIDE.md).

## Stability Features

This bot includes multiple layers of stability enhancements:

- **Request Queue System**: Prevents Discord API rate limiting
- **Interaction Error Recovery**: Safely handles expired interactions
- **Database Reliability**: Automatic database creation and structure validation
- **Global Error Handling**: Comprehensive error capture and logging
- **Smart Retry Logic**: Intelligent retries with exponential backoff

## Support & Maintenance

Regular maintenance recommendations:

- Back up the database directory regularly
- Monitor log files for potential issues
- Keep dependencies up to date
- Use a process manager like PM2 for production deployments

## License

© 2025 KrayStakes LTD - All Rights Reserved

---

For additional help, check the documentation files or contact the developer directly.
>>>>>>> b39b330 (Initial commit)
>>>>>>> d965873 (Initial commit)
