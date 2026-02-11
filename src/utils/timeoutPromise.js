/**
 * Timeout Promise Wrapper
 * Wraps any async operation with a timeout to prevent server freezes.
 */

class TimeoutError extends Error {
  constructor(operation, timeoutMs) {
    super(`Operation "${operation}" timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
    this.operation = operation;
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Wrap a promise with a timeout.
 * @param {Promise} promise - The async operation
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} operationName - Name for error reporting
 * @returns {Promise} - Resolves/rejects based on whichever settles first
 */
function withTimeout(promise, timeoutMs, operationName = 'unknown') {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new TimeoutError(operationName, timeoutMs));
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

module.exports = { withTimeout, TimeoutError };
