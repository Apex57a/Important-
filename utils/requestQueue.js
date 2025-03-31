// KrayStakes Discord Bot - API Request Queue Utility
const logger = require('./logger');

/**
 * A queue system for API requests to prevent rate limiting
 */
class RequestQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.rateLimitWindow = 500; // Default to 500ms between operations for faster response
    this.consecutiveErrors = 0;
    this.lastErrorTime = null;
    this.maxConsecutiveErrors = 5; // After this many errors, increase wait time significantly
    this.baseRateLimitWindow = 500; // Store the original value for resets
    this.lastSuccessTime = Date.now(); // Track when the last successful operation occurred
  }

  /**
   * Add a function to the queue
   * @param {Function} fn - The function to queue (must return a Promise)
   * @param {string} [description='unnamed operation'] - Description for logging
   * @returns {Promise} A promise that resolves with the result of the function
   */
  add(fn, description = 'unnamed operation') {
    return new Promise((resolve, reject) => {
      this.queue.push({
        fn,
        description,
        resolve,
        reject,
        addedAt: Date.now()
      });
      
      logger.debug(`Added operation to queue: ${description} - Queue size: ${this.queue.length}`);
      
      // Start processing if not already in progress
      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  /**
   * Process the queue sequentially
   */
  async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    
    // Adjust rate limit window if too many errors happened recently
    const timeSinceLastSuccess = Date.now() - this.lastSuccessTime;
    if (timeSinceLastSuccess > 30000 && this.consecutiveErrors > this.maxConsecutiveErrors) {
      // More than 30 seconds since last success and many errors - double the window
      const newWindow = Math.min(10000, this.rateLimitWindow * 2); // Max 10 seconds
      if (newWindow > this.rateLimitWindow) {
        logger.warn(`No successful operations in ${Math.round(timeSinceLastSuccess/1000)}s and ${this.consecutiveErrors} consecutive errors. Increasing rate limit window to ${newWindow}ms`);
        this.rateLimitWindow = newWindow;
      }
    }
    
    while (this.queue.length > 0) {
      const item = this.queue.shift();
      const waitTime = Date.now() - item.addedAt;
      
      logger.debug(`Processing queued operation: ${item.description} (waited ${waitTime}ms)`);
      
      try {
        const result = await item.fn();
        
        // Success - reset error counter and record time
        this.consecutiveErrors = 0;
        this.lastSuccessTime = Date.now();
        
        // Gradually decrease rate limit window back to base if it was increased
        if (this.rateLimitWindow > this.baseRateLimitWindow) {
          const newWindow = Math.max(this.baseRateLimitWindow, Math.floor(this.rateLimitWindow * 0.9));
          if (newWindow < this.rateLimitWindow) {
            logger.info(`Operation successful, decreasing rate limit window to ${newWindow}ms`);
            this.rateLimitWindow = newWindow;
          }
        }
        
        item.resolve(result);
      } catch (error) {
        logger.error(`Error in queued operation ${item.description}:`, error);
        
        // Increment error counter and record time
        this.consecutiveErrors++;
        this.lastErrorTime = Date.now();
        
        // Check for rate limit errors
        if (error.httpStatus === 429 || 
            (error.message && error.message.includes('rate limit')) || 
            (error.code && error.code === 10008) || // Unknown Message (often happens when hitting rate limits)
            (error.code && error.code === 10062)) { // Unknown Interaction (often happens when hitting rate limits)
          // Increase rate limit window for rate limit errors
          const newWindow = Math.min(10000, this.rateLimitWindow * 1.5); // Max 10 seconds
          if (newWindow > this.rateLimitWindow) {
            logger.warn(`Rate limit error detected. Increasing rate limit window to ${newWindow}ms`);
            this.rateLimitWindow = newWindow;
          }
          
          // Wait a bit longer after rate limit errors
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        item.reject(error);
      }
      
      // Calculate dynamic wait time based on queue length and error history
      let dynamicWait = this.rateLimitWindow;
      
      // If queue is long, process faster to catch up
      if (this.queue.length > 10) {
        dynamicWait = Math.max(100, dynamicWait * 0.75);
      }
      
      // If we had recent errors, wait longer
      if (this.consecutiveErrors > 0) {
        dynamicWait = Math.min(5000, dynamicWait * (1 + (this.consecutiveErrors * 0.2)));
      }
      
      // Wait before processing the next item to avoid rate limits
      if (this.queue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, dynamicWait));
      }
    }
    
    this.processing = false;
  }

  /**
   * Clear the queue and reject all pending promises
   */
  clearQueue() {
    const count = this.queue.length;
    
    this.queue.forEach(item => {
      item.reject(new Error('Queue was cleared'));
    });
    
    this.queue = [];
    logger.info(`Cleared request queue (${count} items)`);
  }

  /**
   * Set the rate limit window in milliseconds
   * @param {number} ms - Milliseconds to wait between requests
   * @param {boolean} [updateBase=false] - Whether to also update the base rate limit window
   */
  setRateLimitWindow(ms, updateBase = false) {
    const oldWindow = this.rateLimitWindow;
    this.rateLimitWindow = ms;
    
    if (updateBase) {
      this.baseRateLimitWindow = ms;
      logger.info(`Set rate limit window to ${ms}ms (new base value)`);
    } else {
      logger.info(`Set rate limit window to ${ms}ms (was ${oldWindow}ms)`);
    }
    
    // Reset error count if we're setting a higher value
    if (ms > oldWindow) {
      this.consecutiveErrors = 0;
    }
  }
  
  /**
   * Reset rate limits to default values
   */
  resetRateLimits() {
    this.rateLimitWindow = this.baseRateLimitWindow;
    this.consecutiveErrors = 0;
    this.lastSuccessTime = Date.now();
    logger.info(`Reset rate limit window to base value (${this.baseRateLimitWindow}ms)`);
  }
}

// Create a singleton instance
const requestQueue = new RequestQueue();

module.exports = requestQueue;