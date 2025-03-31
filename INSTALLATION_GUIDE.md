# KrayStakes Discord Bot - Installation Guide

This guide provides step-by-step instructions for setting up the KrayStakes Discord Bot on a new server.

## Prerequisites

- Node.js v16.x or higher
- NPM v7.x or higher
- A Discord account with permissions to create a bot
- Basic knowledge of Discord bot development

## Setup Steps

### 1. Create a Discord Bot Application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name (e.g., "KrayStakes")
3. Navigate to the "Bot" tab and click "Add Bot"
4. Under the "Privileged Gateway Intents" section, enable:
   - Presence Intent
   - Server Members Intent
   - Message Content Intent
5. Save your changes

### 2. Get Bot Token and Client ID

1. In the Bot tab, click "Reset Token" and copy your bot token
2. Go to the "OAuth2" tab and copy your Client ID
3. Keep these values secure - they will be needed for the configuration

### 3. Set Up the Bot Files

1. Extract the KrayStakes bot package to your server
2. Navigate to the extracted directory
3. Copy the `.env.example` file to create a new `.env` file:
   ```
   cp .env.example .env
   ```
4. Edit the `.env` file with your bot token and client ID:
   ```
   DISCORD_TOKEN=your_bot_token_here
   CLIENT_ID=your_client_id_here
   ```

### 4. Install Dependencies

Run the following command in the bot directory:

```bash
npm install
```

This will install all required dependencies as specified in package.json.

### 5. Deploy Bot Commands

Before starting the bot for the first time, you need to deploy the slash commands:

```bash
node deploy-commands.js
```

### 6. Start the Bot

You can start the bot using:

```bash
node index.js
```

For production environments, we recommend using a process manager like PM2:

```bash
# Install PM2 globally if you haven't already
npm install -g pm2

# Start the bot with PM2
pm2 start index.js --name kraystakes-bot

# Set PM2 to start the bot automatically on system startup
pm2 startup
pm2 save
```

## Inviting the Bot to Your Server

1. Go to the Discord Developer Portal
2. Navigate to your application's OAuth2 → URL Generator
3. Select the following scopes:
   - `bot`
   - `applications.commands`
4. In bot permissions, select:
   - Read Messages/View Channels
   - Send Messages
   - Embed Links
   - Attach Files
   - Read Message History
   - Add Reactions
   - Use Slash Commands
   - Manage Webhooks (if needed for announcements)
5. Copy the generated URL and open it in your browser
6. Select the server you want to add the bot to and follow the prompts

## Configuration

The bot will automatically create necessary directories and a default configuration on first run. You can modify settings using the bot's admin panel once it's running.

## Troubleshooting

### Bot Won't Start
- Check if your .env file has the correct DISCORD_TOKEN and CLIENT_ID
- Verify Node.js is the correct version (16.x+)
- Check for errors in console output

### Commands Not Working
- Run `node deploy-commands.js` again to ensure commands are registered
- Verify bot has the right permissions in your Discord server
- Check if the bot is online and responsive

### Database Issues
- The bot uses SQLite by default and should create the database file automatically
- If there are database errors, check the logs directory for more details

## Maintenance

Regular maintenance tasks include:

- Backing up the `database` directory containing the SQLite database
- Monitoring the `logs` directory for any issues
- Keeping Node.js and dependencies updated

For any additional help, refer to the `DOCUMENTATION.md` file or contact the developer.