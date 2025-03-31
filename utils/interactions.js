// KrayStakes Discord Bot - Interaction Utils
const logger = require('./logger');
const { createErrorEmbed } = require('./embeds');
const requestQueue = require('./requestQueue');

/**
 * Safely reply to an interaction
 * @param {Interaction} interaction - The interaction to reply to
 * @param {Object} options - Reply options
 * @param {boolean} [ephemeral=true] - Whether the reply should be ephemeral
 * @returns {Promise<boolean>} Whether the reply was successful
 */
async function safeReply(interaction, options, ephemeral = true) {
  try {
    if (!interaction) {
      logger.error('Attempted to reply to null interaction');
      return false;
    }

    // Clone the options to avoid modifying the original
    const replyOptions = { ...options };
    
    // Set ephemeral if not explicitly set in options
    if (typeof replyOptions.ephemeral === 'undefined') {
      replyOptions.ephemeral = ephemeral;
    }
    
    // Add error handling context to track interaction details
    const interactionDetails = {
      type: interaction.type,
      commandName: interaction.commandName || 'N/A',
      customId: interaction.customId || 'N/A',
      user: interaction.user?.username || 'unknown_user',
      channelId: interaction.channelId || 'unknown_channel'
    };
    
    // Use a request queue for all API calls to prevent rate limits
    // Handle different interaction states
    if (interaction.replied) {
      // Already replied, use followUp
      return await requestQueue.add(async () => {
        try {
          await interaction.followUp(replyOptions);
          return true;
        } catch (followUpError) {
          // If the follow-up fails because the interaction expired, log and return
          if (followUpError.code === 10062) { // INTERACTION_ALREADY_EXPIRED
            logger.warn('Could not follow up - interaction expired');
            return false;
          }
          // For other errors, throw to be caught by the outer catch
          throw followUpError;
        }
      }, `followUp for ${interaction.commandName || interaction.customId || 'unknown interaction'}`);
    } else if (interaction.deferred) {
      // Deferred, use editReply
      return await requestQueue.add(async () => {
        try {
          await interaction.editReply(replyOptions);
          return true;
        } catch (editError) {
          // If the edit fails because the interaction expired, log and try to use a new reply
          if (editError.code === 10062) { // INTERACTION_ALREADY_EXPIRED
            logger.warn('Could not edit reply - interaction expired, trying to create a new reply');
            try {
              await interaction.reply({
                ...replyOptions,
                ephemeral: true 
              });
              return true;
            } catch (replyError) {
              logger.error(`Failed to reply after edit failed: ${replyError.message}`);
              return false;
            }
          }
          // For other errors, throw to be caught by the outer catch
          throw editError;
        }
      }, `editReply for ${interaction.commandName || interaction.customId || 'unknown interaction'}`);
    } else {
      // Not replied or deferred, use reply
      return await requestQueue.add(async () => {
        try {
          await interaction.reply(replyOptions);
          return true;
        } catch (replyError) {
          // If the reply fails with "already acknowledged", try to follow up instead
          if (replyError.message.includes('already been acknowledged')) {
            logger.warn('Interaction already acknowledged, trying followUp instead');
            try {
              await interaction.followUp(replyOptions);
              return true;
            } catch (followUpError) {
              logger.error(`Failed to follow up after reply failed: ${followUpError.message}`);
              return false;
            }
          }
          // Rate limit errors need special handling
          if (replyError.httpStatus === 429) {
            const retryAfter = replyError.headers?.get('retry-after') || 5;
            logger.warn(`Rate limited, retrying after ${retryAfter}s`);
            
            // Wait for the retry period plus a small buffer
            await new Promise(resolve => setTimeout(resolve, (retryAfter * 1000) + 500));
            
            // Adjust request queue rate limit window dynamically to avoid future rate limits
            requestQueue.setRateLimitWindow(Math.max(requestQueue.rateLimitWindow, 1000)); // At least 1 second
            
            // Try again with exponential backoff
            try {
              await interaction.reply(replyOptions);
              return true;
            } catch (retryError) {
              // One more attempt with longer wait if needed
              if (retryError.httpStatus === 429) {
                const secondRetryAfter = retryError.headers?.get('retry-after') || 10;
                logger.warn(`Rate limited again, final retry after ${secondRetryAfter}s`);
                await new Promise(resolve => setTimeout(resolve, (secondRetryAfter * 1000) + 1000));
                
                try {
                  await interaction.reply(replyOptions);
                  return true;
                } catch (finalError) {
                  logger.error(`Failed to reply after multiple rate limit retries: ${finalError.message}`);
                  return false;
                }
              } else {
                logger.error(`Failed to reply after rate limit: ${retryError.message}`);
                return false;
              }
            }
          }
          
          // For other errors, throw to be caught by the outer catch
          throw replyError;
        }
      }, `reply for ${interaction.commandName || interaction.customId || 'unknown interaction'}`);
    }
  } catch (error) {
    logger.error(`Error safely replying to interaction: ${error.message}`, { error });
    return false;
  }
}

/**
 * Safely reply with an error message
 * @param {Interaction} interaction - The interaction to reply to
 * @param {string} title - Error title
 * @param {string} message - Error message
 * @returns {Promise<boolean>} Whether the reply was successful
 */
async function replyWithError(interaction, title, message) {
  return safeReply(interaction, {
    embeds: [createErrorEmbed(title, message)],
    ephemeral: true
  });
}

/**
 * Safely defer an interaction if it hasn't been deferred or replied to
 * @param {Interaction} interaction - The interaction to defer
 * @param {boolean} [ephemeral=true] - Whether the reply should be ephemeral
 * @returns {Promise<boolean>} Whether the deferral was successful
 */
async function safeDefer(interaction, ephemeral = true) {
  try {
    if (!interaction) {
      logger.error('Attempted to defer null interaction');
      return false;
    }
    
    if (!interaction.deferred && !interaction.replied) {
      // Use request queue for API call to prevent rate limits
      return await requestQueue.add(async () => {
        try {
          await interaction.deferReply({ ephemeral });
          return true;
        } catch (deferError) {
          // If the interaction has already been acknowledged, log and return
          if (deferError.message.includes('already been acknowledged')) {
            logger.warn('Interaction already acknowledged, cannot defer');
            return false;
          }
          
          // If the interaction expired (took too long to respond)
          if (deferError.code === 10062) { // INTERACTION_ALREADY_EXPIRED
            logger.warn('Interaction expired, cannot defer');
            return false;
          }
          
          // Rate limit errors need special handling
          if (deferError.httpStatus === 429) {
            const retryAfter = deferError.headers?.get('retry-after') || 5;
            logger.warn(`Rate limited when deferring, retrying after ${retryAfter}s`);
            
            // Wait for the retry period plus a small buffer
            await new Promise(resolve => setTimeout(resolve, (retryAfter * 1000) + 500));
            
            // Adjust request queue rate limit window dynamically
            requestQueue.setRateLimitWindow(Math.max(requestQueue.rateLimitWindow, 1000)); // At least 1 second
            
            // Try again with improved error handling
            try {
              await interaction.deferReply({ ephemeral });
              return true;
            } catch (retryError) {
              // If we hit another rate limit, try one more time with longer wait
              if (retryError.httpStatus === 429) {
                const secondRetryAfter = retryError.headers?.get('retry-after') || 10;
                logger.warn(`Rate limited again when deferring, final retry after ${secondRetryAfter}s`);
                await new Promise(resolve => setTimeout(resolve, (secondRetryAfter * 1000) + 1000));
                
                try {
                  await interaction.deferReply({ ephemeral });
                  return true;
                } catch (finalError) {
                  logger.error(`Failed to defer after multiple rate limit retries: ${finalError.message}`);
                  return false;
                }
              } else {
                logger.error(`Failed to defer after rate limit: ${retryError.message}`);
                return false;
              }
            }
          }
          
          // For other errors, throw to be caught by the outer catch
          throw deferError;
        }
      }, `deferReply for ${interaction.commandName || interaction.customId || 'unknown interaction'}`);
    }
    return false; // Already deferred or replied
  } catch (error) {
    logger.error(`Error deferring interaction: ${error.message}`, { error });
    return false;
  }
}

/**
 * Safely update an interaction if it's a button, select menu, or modal submit
 * @param {Interaction} interaction - The interaction to update
 * @param {Object} options - Update options
 * @returns {Promise<boolean>} Whether the update was successful
 */
async function safeUpdate(interaction, options) {
  try {
    if (!interaction) {
      logger.error('Attempted to update null interaction');
      return false;
    }
    
    if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) {
      if (!interaction.replied && !interaction.deferred) {
        // Use request queue for API call to prevent rate limits
        return await requestQueue.add(async () => {
          try {
            await interaction.update(options);
            return true;
          } catch (error) {
            // If the interaction failed because it expired, try to reply instead
            if (error.code === 10062) { // INTERACTION_ALREADY_EXPIRED
              logger.warn(`Interaction expired, attempting to reply instead`);
              try {
                // Create a new message instead of updating the component
                await interaction.reply({
                  ...options,
                  ephemeral: true
                });
                return true;
              } catch (replyError) {
                logger.error(`Failed to reply after interaction expired: ${replyError.message}`);
                return false;
              }
            } 
            
            // Rate limit errors need special handling
            if (error.httpStatus === 429) {
              const retryAfter = error.headers?.get('retry-after') || 5;
              logger.warn(`Rate limited when updating, retrying after ${retryAfter}s`);
              
              // Wait for the retry period plus a small buffer
              await new Promise(resolve => setTimeout(resolve, (retryAfter * 1000) + 500));
              
              // Adjust request queue rate limit window dynamically
              requestQueue.setRateLimitWindow(Math.max(requestQueue.rateLimitWindow, 1000)); // At least 1 second
              
              // Try again with improved error handling
              try {
                await interaction.update(options);
                return true;
              } catch (retryError) {
                // If we hit another rate limit, try one more time with longer wait
                if (retryError.httpStatus === 429) {
                  const secondRetryAfter = retryError.headers?.get('retry-after') || 10;
                  logger.warn(`Rate limited again when updating, final retry after ${secondRetryAfter}s`);
                  await new Promise(resolve => setTimeout(resolve, (secondRetryAfter * 1000) + 1000));
                  
                  try {
                    await interaction.update(options);
                    return true;
                  } catch (finalError) {
                    logger.error(`Failed to update after multiple rate limit retries: ${finalError.message}`);
                    return false;
                  }
                } else {
                  logger.error(`Failed to update after rate limit: ${retryError.message}`);
                  return false;
                }
              }
            } else {
              throw error;
            }
          }
        }, `update for ${interaction.customId || 'unknown interaction'}`);
      } else {
        // Try to follow up if the interaction has already been responded to
        return await requestQueue.add(async () => {
          try {
            await interaction.followUp({
              ...options,
              ephemeral: true
            });
            return true;
          } catch (followUpError) {
            logger.error(`Failed to follow up: ${followUpError.message}`);
            return false;
          }
        }, `followUp for ${interaction.customId || 'unknown interaction'}`);
      }
    } else {
      logger.warn(`Attempted to update an interaction that's not a button, select menu, or modal submit`);
      return false;
    }
  } catch (error) {
    logger.error(`Error updating interaction: ${error.message}`, { error });
    return false;
  }
}

/**
 * Safely defer an update to an interaction if it's a button, select menu, or modal submit
 * @param {Interaction} interaction - The interaction to defer the update for
 * @returns {Promise<boolean>} Whether the update deferral was successful
 */
async function safeDeferUpdate(interaction) {
  try {
    if (!interaction) {
      logger.error('Attempted to defer update for null interaction');
      return false;
    }
    
    if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) {
      if (!interaction.replied && !interaction.deferred) {
        // Use request queue for API call to prevent rate limits
        return await requestQueue.add(async () => {
          try {
            await interaction.deferUpdate();
            return true;
          } catch (error) {
            // If the interaction failed because it expired, try to defer a reply instead
            if (error.code === 10062) { // INTERACTION_ALREADY_EXPIRED
              logger.warn(`Interaction expired, attempting to defer reply instead`);
              try {
                await interaction.deferReply({ ephemeral: true });
                return true;
              } catch (deferError) {
                logger.error(`Failed to defer reply after interaction expired: ${deferError.message}`);
                return false;
              }
            }
            
            // Rate limit errors need special handling
            if (error.httpStatus === 429) {
              const retryAfter = error.headers?.get('retry-after') || 5;
              logger.warn(`Rate limited when deferring update, retrying after ${retryAfter}s`);
              
              // Wait for the retry period plus a small buffer
              await new Promise(resolve => setTimeout(resolve, (retryAfter * 1000) + 500));
              
              // Adjust request queue rate limit window dynamically
              requestQueue.setRateLimitWindow(Math.max(requestQueue.rateLimitWindow, 1000)); // At least 1 second
              
              // Try again with improved error handling
              try {
                await interaction.deferUpdate();
                return true;
              } catch (retryError) {
                // Try to defer a reply instead if update fails again
                if (retryError.httpStatus === 429 || retryError.code === 10062) {
                  logger.warn('Deferring update failed, attempting to defer reply instead');
                  try {
                    await interaction.deferReply({ ephemeral: true });
                    return true;
                  } catch (deferReplyError) {
                    logger.error(`Failed to defer reply after deferUpdate failed: ${deferReplyError.message}`);
                    return false;
                  }
                } else {
                  logger.error(`Failed to defer update after rate limit: ${retryError.message}`);
                  return false;
                }
              }
            } else {
              throw error; // Rethrow other errors
            }
          }
        }, `deferUpdate for ${interaction.customId || 'unknown interaction'}`);
      } else {
        logger.warn('Attempted to defer update for a replied or deferred interaction');
        return false;
      }
    } else {
      logger.warn(`Attempted to defer update for an interaction that's not a button, select menu, or modal submit`);
      return false;
    }
  } catch (error) {
    logger.error(`Error deferring update for interaction: ${error.message}`, { error });
    return false;
  }
}

/**
 * Handle an interaction error safely
 * @param {Error} error - The error that occurred
 * @param {Interaction} interaction - The interaction that caused the error
 * @param {string} [location='unknown location'] - Where the error occurred
 * @returns {Promise<void>}
 */
async function handleInteractionError(error, interaction, location = 'unknown location') {
  const errorMessage = error?.message || 'Unknown error';
  logger.error(`Error in ${location}: ${errorMessage}`, { error });
  
  if (!interaction) {
    logger.error('Null interaction provided to handleInteractionError');
    return;
  }
  
  // Skip sending error messages for specific error types
  const skipErrorTypes = [
    'already been acknowledged',   // Already replied to the interaction
    'Unknown interaction',         // Interaction timed out
    'expired',                     // Interaction expired
    'Unknown Webhook',             // Webhook no longer exists
    'Cannot send messages to this user', // User has DMs closed
  ];
  
  // Check if we should skip sending an error response
  const shouldSkip = skipErrorTypes.some(type => errorMessage.includes(type));
  if (shouldSkip) {
    logger.warn(`Skipping error response for "${errorMessage}" in ${location}`);
    return;
  }
  
  try {    
    // Use our safe reply method with better error handling
    const success = await replyWithError(
      interaction,
      'Error Occurred',
      'Sorry, something went wrong while processing your request.'
    );
    
    if (!success) {
      logger.warn(`Could not send error response to user for error in ${location}`);
    }
  } catch (replyError) {
    logger.error(`Failed to report error to user: ${replyError.message}`, { error: replyError });
  }
}

module.exports = {
  safeReply,
  replyWithError,
  safeDefer,
  safeUpdate,
  safeDeferUpdate,
  handleInteractionError
};