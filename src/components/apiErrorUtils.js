// apiErrorUtils.js
/**
 * Utility functions for handling API errors consistently across the application
 */

/**
 * Formats error messages from various sources into user-friendly messages
 * @param {Error|Object} error - The error object
 * @param {string} defaultMessage - Default message if no specific error found
 * @returns {string} User-friendly error message
 */
export function formatErrorMessage(error, defaultMessage = 'An unexpected error occurred') {
    if (!error) return defaultMessage;

    // Handle Axios errors
    if (error.response) {
        const status = error.response.status;
        const statusText = error.response.statusText;
        
        switch (status) {
            case 400:
                return 'Bad request. Please check your input and try again.';
            case 401:
                return 'Authentication failed. Please log in again.';
            case 403:
                return 'Access denied. You don\'t have permission to perform this action.';
            case 404:
                return 'The requested resource was not found.';
            case 408:
                return 'Request timed out. Please try again.';
            case 429:
                return 'Too many requests. Please wait a moment and try again.';
            case 500:
                return 'Server error. Please try again later.';
            case 502:
                return 'Bad gateway. The server is temporarily unavailable.';
            case 503:
                return 'Service unavailable. Please try again later.';
            case 504:
                return 'Gateway timeout. The request took too long to process.';
            default:
                return `Server error (${status}): ${statusText || 'Unknown error'}`;
        }
    }

    // Handle network errors
    if (error.request) {
        return 'Network error. Please check your internet connection and try again.';
    }

    // Handle timeout errors
    if (error.name === 'AbortError' || error.code === 'ECONNABORTED') {
        return 'Request timed out. Please check your connection and try again.';
    }

    // Handle Geotab API specific errors
    if (error.error && error.error.message) {
        return `API Error: ${error.error.message}`;
    }

    // Handle generic error messages
    if (error.message) {
        return error.message;
    }

    // Handle string errors
    if (typeof error === 'string') {
        return error;
    }

    return defaultMessage;
}

/**
 * Determines if an error is recoverable (user can retry)
 * @param {Error|Object} error - The error object
 * @returns {boolean} True if the error is recoverable
 */
export function isRecoverableError(error) {
    if (!error) return false;

    // Network errors are generally recoverable
    if (error.request && !error.response) return true;

    // Timeout errors are recoverable
    if (error.name === 'AbortError' || error.code === 'ECONNABORTED') return true;

    // Specific HTTP status codes that are recoverable
    if (error.response) {
        const recoverableStatuses = [408, 429, 500, 502, 503, 504];
        return recoverableStatuses.includes(error.response.status);
    }

    return false;
}

/**
 * Logs errors with context information
 * @param {Error|Object} error - The error object
 * @param {string} context - Context where the error occurred
 * @param {Object} additionalInfo - Additional information to log
 */
export function logError(error, context = 'Unknown', additionalInfo = {}) {
    const errorInfo = {
        context,
        timestamp: new Date().toISOString(),
        error: {
            message: error?.message || 'Unknown error',
            stack: error?.stack,
            name: error?.name,
            code: error?.code,
        },
        response: error?.response ? {
            status: error.response.status,
            statusText: error.response.statusText,
            data: error.response.data,
        } : null,
        additionalInfo,
    };

    console.error(`[${context}] Error occurred:`, errorInfo);

    // In a production environment, you might want to send this to an error tracking service
    // Example: sendToErrorTrackingService(errorInfo);
}

/**
 * Creates a retry mechanism for API calls
 * @param {Function} apiCall - The API call function to retry
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} delay - Delay between retries in milliseconds
 * @returns {Promise} Promise that resolves when the API call succeeds or all retries are exhausted
 */
export async function retryApiCall(apiCall, maxRetries = 3, delay = 1000) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const result = await apiCall();
            return result;
        } catch (error) {
            lastError = error;
            
            logError(error, `API Retry Attempt ${attempt}/${maxRetries}`);

            // Don't retry if it's not a recoverable error
            if (!isRecoverableError(error)) {
                throw error;
            }

            // Don't wait after the last attempt
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, delay * attempt));
            }
        }
    }

    // If we get here, all retries failed
    throw lastError;
}

/**
 * Validates session information before making API calls
 * @param {Object} sessionInfo - Session information object
 * @throws {Error} If session information is invalid
 */
export function validateSessionInfo(sessionInfo) {
    if (!sessionInfo) {
        throw new Error('Session information is missing');
    }

    if (!sessionInfo.sessionId) {
        throw new Error('Authentication session not found');
    }

    if (!sessionInfo.server) {
        throw new Error('Server information is missing');
    }

    if (!sessionInfo.database) {
        throw new Error('Database information is missing');
    }

    if (!sessionInfo.userName) {
        throw new Error('User name is missing');
    }
}

/**
 * Creates a standardized API request configuration
 * @param {Object} sessionInfo - Session information
 * @param {string} method - API method name
 * @param {Object} params - API parameters
 * @param {number} timeout - Request timeout in milliseconds
 * @returns {Object} Axios request configuration
 */
export function createApiConfig(sessionInfo, method, params = {}, timeout = 30000) {
    validateSessionInfo(sessionInfo);

    const apiUrl = `https://${sessionInfo.server}/apiv1/`;

    return {
        url: apiUrl,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        data: {
            jsonrpc: '2.0',
            method: method,
            params: {
                ...params,
                credentials: {
                    database: sessionInfo.database,
                    userName: sessionInfo.userName,
                    sessionId: sessionInfo.sessionId,
                },
            },
            id: Math.floor(Math.random() * 10000),
        },
        timeout: timeout,
    };
}

/**
 * Makes a standardized API call with error handling
 * @param {Object} sessionInfo - Session information
 * @param {string} method - API method name
 * @param {Object} params - API parameters
 * @param {Object} options - Additional options
 * @returns {Promise} Promise that resolves to the API result
 */
export async function makeApiCall(sessionInfo, method, params = {}, options = {}) {
    const {
        timeout = 30000,
        retries = 1,
        retryDelay = 1000,
        context = method
    } = options;

    const apiCall = async () => {
        try {
            const config = createApiConfig(sessionInfo, method, params, timeout);
            const response = await axios(config);

            if (!response || !response.data) {
                throw new Error('Invalid response structure from server');
            }

            if (response.data.error) {
                const error = new Error(response.data.error.message || 'API Error');
                error.apiError = response.data.error;
                throw error;
            }

            return response.data.result;
        } catch (error) {
            logError(error, context, { method, params });
            throw error;
        }
    };

    if (retries > 1) {
        return retryApiCall(apiCall, retries, retryDelay);
    } else {
        return apiCall();
    }
}

/**
 * Error boundary helper for React components
 */
export class ApiErrorHandler {
    constructor(context = 'Unknown') {
        this.context = context;
        this.retryCount = 0;
        this.maxRetries = 3;
    }

    async handleApiCall(apiCall, onError = null, onRetry = null) {
        try {
            const result = await apiCall();
            this.retryCount = 0; // Reset on success
            return result;
        } catch (error) {
            this.retryCount++;
            
            const errorMessage = formatErrorMessage(error);
            const canRetry = isRecoverableError(error) && this.retryCount < this.maxRetries;
            
            logError(error, this.context, { 
                retryCount: this.retryCount,
                canRetry 
            });

            if (onError) {
                onError(errorMessage, canRetry, this.retryCount);
            }

            if (canRetry && onRetry) {
                onRetry();
            }

            throw error;
        }
    }

    reset() {
        this.retryCount = 0;
    }
}

// Import axios at the top of the file
import axios from 'axios';