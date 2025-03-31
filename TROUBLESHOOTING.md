# KrayStakes Discord Bot - Troubleshooting Guide

This guide covers common issues you might encounter with the KrayStakes Discord Bot and provides solutions to resolve them.

## Connection Issues

### Bot Won't Connect to Discord

**Symptoms:**
- Bot shows "Error connecting to Discord" in logs
- Bot starts but immediately disconnects

**Possible Causes and Solutions:**

1. **Invalid Token**
   - Verify your Discord bot token is correct in the `.env` file
   - Generate a new token in the Discord Developer Portal if necessary

2. **Network Issues**
   - Check your server's internet connection
   - Verify firewall rules allow outbound connections to Discord

3. **Discord API Outage**
   - Check Discord's status page at [status.discord.com](https://status.discord.com)
   - Wait for Discord to resolve any ongoing issues

## Command Issues

### Slash Commands Not Appearing

**Symptoms:**
- Slash commands do not appear in Discord
- `/` menu doesn't show bot commands

**Possible Causes and Solutions:**

1. **Commands Not Deployed**
   - Run `node deploy-commands.js` to register commands with Discord
   - Check for errors in the output

2. **Insufficient Bot Permissions**
   - Ensure the bot has the `applications.commands` scope
   - Re-invite the bot to your server with the correct permissions

3. **Discord Cache Issue**
   - Try using the commands in a different channel
   - Restart your Discord client

### Commands Return "Interaction Failed"

**Symptoms:**
- Error message appears when using commands
- "This interaction failed" message in Discord

**Possible Causes and Solutions:**

1. **Slow Response Time**
   - The bot's error handling should prevent most of these
   - Check server load and network latency

2. **Rate Limiting**
   - The bot includes advanced rate limit handling
   - Check logs for rate limit warnings

3. **Bot Errors**
   - Check the error logs in `logs/error.log`
   - Verify the bot has proper permissions in the channel

## Database Issues

### Database Errors on Startup

**Symptoms:**
- Error messages related to database in console
- Bot fails to start completely

**Possible Causes and Solutions:**

1. **Missing Database File**
   - The bot should create a new database automatically
   - Check file permissions in the database directory

2. **Corrupt Database**
   - Restore from a backup in the `backups` directory
   - If no backup exists, rename or remove the database file to let the bot create a new one

3. **Schema Changes**
   - Check logs for schema migration errors
   - Database should automatically update when possible

### Data Not Saving Properly

**Symptoms:**
- Events or bets disappear after bot restart
- Settings reset unexpectedly

**Possible Causes and Solutions:**

1. **Disk Space Issues**
   - Check available disk space on your server
   - Free up space if necessary

2. **File Permission Problems**
   - Verify the bot has write access to the database directory
   - Check ownership and permissions on database files

3. **Transaction Failures**
   - Look for transaction-related errors in the logs
   - Verify database is not locked by another process

## Permission Issues

### Can't Use Admin Commands

**Symptoms:**
- "You don't have permission" error messages
- Admin panel doesn't appear

**Possible Causes and Solutions:**

1. **Incorrect Discord Permissions**
   - Verify you have the Administrator permission in Discord
   - Check the server roles configuration

2. **Bot Configuration Issue**
   - The bot uses Discord's permission system
   - Ensure admin role IDs are correctly set up

3. **Command Used in Wrong Channel**
   - Try using admin commands in a private channel
   - Verify bot has proper permissions in the channel

## Performance Issues

### Bot Responds Slowly

**Symptoms:**
- Long delays between command and response
- Interactions time out frequently

**Possible Causes and Solutions:**

1. **Server Resource Limitations**
   - Check CPU and memory usage on your server
   - Consider upgrading your hosting if consistently high

2. **Many Concurrent Commands**
   - The bot uses a request queue to manage API calls
   - Try spacing out commands during heavy usage

3. **Large Database**
   - If database has grown very large, operations may slow down
   - Consider archiving old events and bets

### High CPU or Memory Usage

**Symptoms:**
- Server resources consistently high
- Bot crashes or restarts unexpectedly

**Possible Causes and Solutions:**

1. **Memory Leaks**
   - Restart the bot regularly using a cron job
   - Update to the latest version which may contain fixes

2. **Too Many Concurrent Operations**
   - Limit the number of simultaneous bot users
   - Encourage using commands in different channels

3. **Logging Level Too Verbose**
   - Check log settings in configuration
   - Reduce log level to info or warning in production

## Common Error Messages

### "Unknown Interaction"

**Cause:** The interaction expired before the bot could respond (took over 3 seconds).

**Solution:** 
- The bot includes handling for this, but if it persists, check server performance
- Verify network latency between your server and Discord

### "Missing Access" or "Missing Permissions"

**Cause:** The bot doesn't have the required permissions in the channel or server.

**Solution:**
- Check the bot's role and channel-specific permissions
- Re-invite the bot with the correct permission scopes

### "Cannot Send Messages to this User"

**Cause:** A user has DMs closed or has blocked the bot.

**Solution:**
- The bot will attempt to reply in the channel instead
- Inform users they need to enable DMs for certain features

## Advanced Debugging

For more advanced troubleshooting:

1. **Enable Debug Mode**
   - Set debug mode to true in configuration
   - This provides more verbose logging

2. **Check Log Files**
   - System logs: `logs/system.log`
   - Error logs: `logs/error.log`
   - Database logs: `logs/database.log`
   - Crash logs: `logs/crash.log`

3. **Test in Development Environment**
   - Create a separate test server
   - Use a development bot token
   - Test changes before deploying to production

## Getting Additional Help

If you've tried the solutions in this guide and still experience issues:

1. Check the latest documentation for updates
2. Review the complete logs for more context on errors
3. Contact the developer with detailed information about your issue

Remember to include:
- Error messages from the logs
- Steps to reproduce the issue
- Your environment details (Node.js version, hosting platform)
- Recent changes made to the bot configuration