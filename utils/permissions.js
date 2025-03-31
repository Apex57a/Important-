// KrayStakes Discord Bot - Permissions
const { PermissionFlagsBits } = require('discord.js');
const config = require('../config');
const logger = require('./logger');

/**
 * Check if user has admin permissions
 * @param {GuildMember} member - Discord.js GuildMember object
 * @returns {boolean} - Whether the user has admin permissions
 */
function isAdmin(member) {
  // Safety check for null/undefined member
  if (!member) {
    logger.warn('Permission check called with null/undefined member');
    return false;
  }

  try {
    // Return true for owner
    if (member.guild && member.id === member.guild.ownerId) {
      return true;
    }
    
    // Return true for Discord administrators
    if (member.permissions && typeof member.permissions.has === 'function' && 
        member.permissions.has(PermissionFlagsBits.Administrator)) {
      return true;
    }
    
    // Return true for members with configured admin role
    const adminRoleId = config.roles?.admin;
    if (adminRoleId && member.roles && member.roles.cache && 
        typeof member.roles.cache.has === 'function' && 
        member.roles.cache.has(adminRoleId)) {
      return true;
    }
    
    // Check custom admin IDs in config
    if (config.adminUserIds && Array.isArray(config.adminUserIds) && 
        config.adminUserIds.includes(member.id)) {
      return true;
    }
    
    return false;
  } catch (error) {
    logger.error('Error in isAdmin permission check:', error);
    return false;
  }
}

/**
 * Check if user has payout manager permissions
 * @param {GuildMember} member - Discord.js GuildMember object
 * @returns {boolean} - Whether the user has payout manager permissions
 */
function isPayoutManager(member) {
  // Safety check for null/undefined member
  if (!member) {
    logger.warn('PayoutManager permission check called with null/undefined member');
    return false;
  }

  try {
    // Admins always have payout manager permissions
    if (isAdmin(member)) {
      return true;
    }
    
    // Return true for members with configured payout manager role
    const payoutRoleId = config.roles?.payoutManager;
    if (payoutRoleId && member.roles && member.roles.cache && 
        typeof member.roles.cache.has === 'function' && 
        member.roles.cache.has(payoutRoleId)) {
      return true;
    }
    
    return false;
  } catch (error) {
    logger.error('Error in isPayoutManager permission check:', error);
    return false;
  }
}

/**
 * Check if user has event manager permissions
 * @param {GuildMember} member - Discord.js GuildMember object
 * @returns {boolean} - Whether the user has event manager permissions
 */
function isEventManager(member) {
  // Safety check for null/undefined member
  if (!member) {
    logger.warn('EventManager permission check called with null/undefined member');
    return false;
  }

  try {
    // Admins always have event manager permissions
    if (isAdmin(member)) {
      return true;
    }
    
    // Return true for members with configured event manager role
    const eventRoleId = config.roles?.eventManager;
    if (eventRoleId && member.roles && member.roles.cache && 
        typeof member.roles.cache.has === 'function' && 
        member.roles.cache.has(eventRoleId)) {
      return true;
    }
    
    return false;
  } catch (error) {
    logger.error('Error in isEventManager permission check:', error);
    return false;
  }
}

/**
 * Check if user has permitted role to use the bot
 * @param {GuildMember} member - Discord.js GuildMember object
 * @returns {boolean} - Whether the user has permission to use the bot
 */
function canUseBetting(member) {
  // Safety check for null/undefined member
  if (!member) {
    logger.warn('CanUseBetting permission check called with null/undefined member');
    return false;
  }

  try {
    // If no permitted roles are configured, allow everyone
    if (!config.roles?.permitted || !Array.isArray(config.roles.permitted) || config.roles.permitted.length === 0) {
      return true;
    }
    
    // Admins, payout managers, and event managers can always use betting
    if (isAdmin(member) || isPayoutManager(member) || isEventManager(member)) {
      return true;
    }
    
    // Check if user has any of the permitted roles
    if (member.roles && member.roles.cache && typeof member.roles.cache.has === 'function') {
      return config.roles.permitted.some(roleId => member.roles.cache.has(roleId));
    }
    
    return false;
  } catch (error) {
    logger.error('Error in canUseBetting permission check:', error);
    return false;
  }
}

/**
 * Log permission check
 * @param {GuildMember} member - Discord.js GuildMember object
 * @param {string} permissionType - Type of permission checked
 * @param {boolean} result - Result of the permission check
 */
function logPermissionCheck(member, permissionType, result) {
  // Safety check for null/undefined member
  if (!member) {
    logger.warn(`Permission log check called with null member: ${permissionType}`);
    return;
  }

  try {
    // Make sure member has necessary properties
    const userId = member.id || 'unknown';
    const userTag = member.user && member.user.tag ? member.user.tag : userId;
    
    logger.debug(`Permission check: ${userTag} (${userId}) - ${permissionType}: ${result}`, {
      userId: userId,
      type: 'permission'
    });
    
    // If in debug mode and member has necessary properties, log to database
    if (config.debugMode) {
      let roles = [];
      
      // Safely extract roles if they exist
      if (member.roles && member.roles.cache) {
        try {
          if (typeof member.roles.cache.keys === 'function') {
            const keysIterator = member.roles.cache.keys();
            roles = Array.from(keysIterator);
          }
        } catch (error) {
          logger.warn('Failed to extract roles from member', error);
        }
      }
      
      // Check that logger.db exists and has the debug method
      if (logger.db && typeof logger.db.debug === 'function') {
        logger.db.debug(
          `Permission check: ${userTag} (${userId}) - ${permissionType}: ${result}`,
          {
            userId: userId,
            type: 'permission',
            metadata: {
              permissionType,
              result,
              roles
            }
          }
        );
      }
    }
  } catch (error) {
    logger.error('Error in logPermissionCheck:', error);
  }
}

/**
 * Check if user has admin permissions, with logging
 * @param {GuildMember} member - Discord.js GuildMember object
 * @returns {boolean} - Whether the user has admin permissions
 */
function checkAdmin(member) {
  const result = isAdmin(member);
  logPermissionCheck(member, 'admin', result);
  return result;
}

/**
 * Check if user has payout manager permissions, with logging
 * @param {GuildMember} member - Discord.js GuildMember object
 * @returns {boolean} - Whether the user has payout manager permissions
 */
function checkPayoutManager(member) {
  const result = isPayoutManager(member);
  logPermissionCheck(member, 'payoutManager', result);
  return result;
}

/**
 * Check if user has event manager permissions, with logging
 * @param {GuildMember} member - Discord.js GuildMember object
 * @returns {boolean} - Whether the user has event manager permissions
 */
function checkEventManager(member) {
  const result = isEventManager(member);
  logPermissionCheck(member, 'eventManager', result);
  return result;
}

/**
 * Check if user has permitted role to use the bot, with logging
 * @param {GuildMember} member - Discord.js GuildMember object
 * @returns {boolean} - Whether the user has permission to use the bot
 */
function checkCanUseBetting(member) {
  const result = canUseBetting(member);
  logPermissionCheck(member, 'canUseBetting', result);
  return result;
}

module.exports = {
  isAdmin,
  isPayoutManager,
  isEventManager,
  canUseBetting,
  checkAdmin,
  checkPayoutManager,
  checkEventManager,
  checkCanUseBetting
};