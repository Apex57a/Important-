// KrayStakes Discord Bot - Validators
const { isDateInPast } = require('./timeUtils');
const logger = require('./logger');

/**
 * Validate event data before creation
 * @param {Object} eventData - The event data to validate
 * @returns {Object} - { valid: boolean, errors: Array }
 */
function validateEvent(eventData) {
  const errors = [];
  
  // Check required fields
  if (!eventData.name || eventData.name.trim() === '') {
    errors.push('Event name is required');
  } else if (eventData.name.length > 100) {
    errors.push('Event name must be 100 characters or less');
  }
  
  // Validate type
  const validTypes = ['boxing', 'racing', 'paintball', 'custom'];
  if (!validTypes.includes(eventData.type)) {
    errors.push(`Event type must be one of: ${validTypes.join(', ')}`);
  }
  
  // Validate choices
  if (!eventData.choices || !Array.isArray(eventData.choices) || eventData.choices.length < 2) {
    errors.push('Event must have at least 2 choices');
  } else {
    // Check for duplicates
    const choiceNames = eventData.choices.map(c => typeof c === 'string' ? c : c.name);
    const uniqueChoices = new Set(choiceNames);
    if (uniqueChoices.size !== choiceNames.length) {
      errors.push('Event choices must be unique');
    }
    
    // Check for empty choices
    const hasEmptyChoice = eventData.choices.some(c => {
      const name = typeof c === 'string' ? c : c.name;
      return !name || name.trim() === '';
    });
    if (hasEmptyChoice) {
      errors.push('Event choices cannot be empty');
    }
  }
  
  // Validate scheduled time
  if (eventData.scheduledTime) {
    const date = new Date(eventData.scheduledTime);
    if (isNaN(date.getTime())) {
      errors.push('Invalid scheduled time');
    } else if (isDateInPast(date)) {
      errors.push('Scheduled time cannot be in the past');
    }
  }
  
  // Validate betting limits
  if (eventData.minBet !== undefined) {
    if (isNaN(eventData.minBet) || eventData.minBet < 1) {
      errors.push('Minimum bet must be at least 1');
    }
  }
  
  if (eventData.maxBet !== undefined) {
    if (isNaN(eventData.maxBet)) {
      errors.push('Maximum bet must be a number');
    } else if (eventData.maxBet < eventData.minBet) {
      errors.push('Maximum bet cannot be less than minimum bet');
    }
  }
  
  if (eventData.limitPerUser !== undefined) {
    if (isNaN(eventData.limitPerUser) || eventData.limitPerUser < 1) {
      errors.push('Bet limit per user must be at least 1');
    }
  }
  
  if (eventData.feePercent !== undefined) {
    if (isNaN(eventData.feePercent) || eventData.feePercent < 0 || eventData.feePercent > 100) {
      errors.push('Fee percent must be between 0 and 100');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate bet data before creation
 * @param {Object} betData - The bet data to validate
 * @param {Object} event - The event object
 * @returns {Object} - { valid: boolean, errors: Array }
 */
function validateBet(betData, event) {
  const errors = [];
  
  // Check required fields
  if (!betData.userId) {
    errors.push('User ID is required');
  }
  
  if (!betData.amount || isNaN(betData.amount)) {
    errors.push('Bet amount is required and must be a number');
  } else {
    // Check bet limits
    if (betData.amount < event.minBet) {
      errors.push(`Bet amount must be at least ${event.minBet}`);
    }
    if (betData.amount > event.maxBet) {
      errors.push(`Bet amount cannot exceed ${event.maxBet}`);
    }
  }
  
  // Validate choice
  if (betData.choiceIndex === undefined || betData.choiceIndex === null) {
    errors.push('Bet choice is required');
  } else if (isNaN(betData.choiceIndex) || betData.choiceIndex < 0 || 
             betData.choiceIndex >= (event.choices ? event.choices.length : 0)) {
    errors.push('Invalid bet choice');
  }
  
  // Check event status
  if (event.status !== 'open') {
    errors.push(`Cannot place bets on events that are ${event.status}`);
  }
  
  // Check if event is in the past
  if (event.scheduledTime && isDateInPast(event.scheduledTime) && event.status !== 'pending') {
    errors.push('Cannot place bets on events that have already started');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate date string
 * @param {string} dateStr - The date string to validate (YYYY-MM-DD)
 * @returns {boolean} - Whether the date is valid
 */
function isValidDateString(dateStr) {
  // Regular expression to match YYYY-MM-DD format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  
  if (!dateRegex.test(dateStr)) {
    return false;
  }
  
  // Check if the date is valid
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return false;
  }
  
  return true;
}

/**
 * Validate time string
 * @param {string} timeStr - The time string to validate (HH:MM)
 * @returns {boolean} - Whether the time is valid
 */
function isValidTimeString(timeStr) {
  // Regular expression to match HH:MM format
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  
  return timeRegex.test(timeStr);
}

/**
 * Validate payout data before creation
 * @param {Object} payoutData - The payout data to validate
 * @returns {Object} - { valid: boolean, errors: Array }
 */
function validatePayout(payoutData) {
  const errors = [];
  
  // Check required fields
  if (!payoutData.userId) {
    errors.push('User ID is required');
  }
  
  if (!payoutData.betId) {
    errors.push('Bet ID is required');
  }
  
  if (!payoutData.amount || isNaN(payoutData.amount) || payoutData.amount <= 0) {
    errors.push('Payout amount must be a positive number');
  }
  
  // Validate payout method if provided
  if (payoutData.method) {
    const validMethods = ['bank', 'paypal', 'cashapp', 'venmo', 'other'];
    if (!validMethods.includes(payoutData.method)) {
      errors.push(`Payout method must be one of: ${validMethods.join(', ')}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  validateEvent,
  validateBet,
  isValidDateString,
  isValidTimeString,
  validatePayout
};