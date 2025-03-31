// KrayStakes Discord Bot - Time Utilities
const { format, formatDistanceToNow, parseISO, differenceInMinutes, isBefore } = require('date-fns');
const { zonedTimeToUtc, utcToZonedTime } = require('date-fns-tz');
const config = require('../config');

/**
 * Format a date according to the specified format and timezone
 * @param {Date|string} date - The date to format
 * @param {string} formatString - The format string to use (from date-fns)
 * @param {string} timezone - The timezone to use
 * @returns {string} - The formatted date
 */
function formatDate(date, formatString = 'PPpp', timezone = config.timezone) {
  try {
    // Convert string to Date if necessary
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    
    // Convert to timezone
    const zonedDate = utcToZonedTime(dateObj, timezone);
    
    // Format according to format string
    return format(zonedDate, formatString);
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid date';
  }
}

/**
 * Get time remaining until a date
 * @param {Date|string} date - The date to calculate time to
 * @returns {string} - Human-readable time remaining
 */
function getTimeRemaining(date) {
  try {
    // Convert string to Date if necessary
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    
    // Calculate time remaining
    return formatDistanceToNow(dateObj, { addSuffix: true });
  } catch (error) {
    console.error('Error calculating time remaining:', error);
    return 'Unknown time';
  }
}

/**
 * Check if reminder should be sent for an event
 * @param {Date|string} eventDate - The event date
 * @param {number} reminderMinutes - Minutes before event to send reminder
 * @param {Array} sentReminders - Array of already sent reminder times
 * @returns {boolean} - Whether reminder should be sent
 */
function shouldSendReminder(eventDate, reminderMinutes, sentReminders = []) {
  try {
    // If this reminder time has already been sent, skip it
    if (sentReminders.includes(reminderMinutes)) {
      return false;
    }
    
    // Convert string to Date if necessary
    const dateObj = typeof eventDate === 'string' ? parseISO(eventDate) : eventDate;
    
    // Get current time
    const now = new Date();
    
    // Calculate time difference in minutes
    const minutesUntilEvent = differenceInMinutes(dateObj, now);
    
    // Check if we're within the reminder window
    // The window is +/- 5 minutes from the exact reminder time
    return minutesUntilEvent <= reminderMinutes + 5 && minutesUntilEvent >= reminderMinutes - 5;
  } catch (error) {
    console.error('Error checking reminder:', error);
    return false;
  }
}

/**
 * Convert timezone aware time to UTC
 * @param {string} date - The date string
 * @param {string} time - The time string
 * @param {string} timezone - The timezone
 * @returns {Date} - The UTC date
 */
function convertToUTC(date, time, timezone = config.timezone) {
  try {
    // Combine date and time
    const dateTimeStr = `${date}T${time}`;
    
    // Create Date object in local timezone
    const localDate = parseISO(dateTimeStr);
    
    // Convert to UTC considering the timezone
    return zonedTimeToUtc(localDate, timezone);
  } catch (error) {
    console.error('Error converting to UTC:', error);
    return new Date();
  }
}

/**
 * Check if a date is in the past
 * @param {Date|string} date - The date to check
 * @returns {boolean} - True if date is in the past
 */
function isDateInPast(date) {
  try {
    // Convert string to Date if necessary
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    
    // Check if date is before now
    return isBefore(dateObj, new Date());
  } catch (error) {
    console.error('Error checking if date is in past:', error);
    return false;
  }
}

/**
 * Get a sorted list of common timezones
 * @returns {Array} - Array of timezone objects
 */
function getCommonTimezones() {
  return [
    { label: 'UTC', value: 'UTC' },
    { label: 'Los Angeles (PST/PDT)', value: 'America/Los_Angeles' },
    { label: 'New York (EST/EDT)', value: 'America/New_York' },
    { label: 'Toronto (EST/EDT)', value: 'America/Toronto' },
    { label: 'London (GMT/BST)', value: 'Europe/London' },
    { label: 'Paris (CET/CEST)', value: 'Europe/Paris' },
    { label: 'Berlin (CET/CEST)', value: 'Europe/Berlin' },
    { label: 'Moscow (MSK)', value: 'Europe/Moscow' },
    { label: 'Dubai (GST)', value: 'Asia/Dubai' },
    { label: 'Mumbai (IST)', value: 'Asia/Kolkata' },
    { label: 'Singapore (SGT)', value: 'Asia/Singapore' },
    { label: 'Tokyo (JST)', value: 'Asia/Tokyo' },
    { label: 'Sydney (AEST/AEDT)', value: 'Australia/Sydney' },
    { label: 'Auckland (NZST/NZDT)', value: 'Pacific/Auckland' }
  ].sort((a, b) => a.label.localeCompare(b.label));
}

module.exports = {
  formatDate,
  getTimeRemaining,
  shouldSendReminder,
  convertToUTC,
  isDateInPast,
  getCommonTimezones
};