/**
 * Common Messages and Error Handling for Job Scrapers
 * Centralized error messages, warnings, and status messages for all platform scrapers
 */

export const MESSAGES = {
    // Success Messages
    SUCCESS: {
        LOGIN: '✅ Login successful!',
        SCRAPING_COMPLETE: '🎉 Scraping complete!',
        JOBS_FOUND: (count) => `✅ Successfully scraped ${count} jobs`,
        BROWSER_CLOSED: '🔄 Closing browser...',
        PAGE_LOADED: '📄 Page loaded successfully',
        DATA_EXTRACTED: '📦 Data extracted successfully',
        SESSION_ESTABLISHED: '🔐 Session established successfully',
        COOKIES_SAVED: '🍪 Cookies saved successfully',
        NAVIGATION_SUCCESS: '✅ Navigation successful'
    },

    // Error Messages
    ERROR: {
        // Authentication Errors
        LOGIN_FAILED: '❌ Login failed',
        INVALID_CREDENTIALS: '❌ Invalid credentials. Please check email and password',
        SESSION_EXPIRED: '❌ Session expired. Please login again',
        AUTHENTICATION_REQUIRED: '❌ Authentication required',
        CREDENTIALS_MISSING: (platform) => `❌ ${platform} credentials not found in credentials.json`,
        CREDENTIALS_REQUIRED: (platform, fields) => `❌ ${platform} requires ${fields.join(', ')} in credentials.json`,
        
        // Navigation Errors
        NAVIGATION_FAILED: '❌ Failed to navigate to page',
        PAGE_LOAD_TIMEOUT: '❌ Page load timeout exceeded',
        REDIRECT_UNEXPECTED: '❌ Unexpected redirect detected',
        
        // Scraping Errors
        NO_JOBS_FOUND: '⚠️  No jobs found for this search query',
        SCRAPING_FAILED: '❌ Scraping failed',
        EXTRACTION_FAILED: '❌ Failed to extract job data',
        PARSING_ERROR: (detail) => `❌ Error parsing data: ${detail}`,
        
        // Network Errors
        NETWORK_ERROR: '❌ Network error occurred',
        REQUEST_FAILED: (status) => `❌ Request failed with status: ${status}`,
        API_ERROR: (code) => `❌ API error: ${code}`,
        TIMEOUT_ERROR: '❌ Request timeout exceeded',
        CONNECTION_REFUSED: '❌ Connection refused',
        
        // Browser Errors
        BROWSER_LAUNCH_FAILED: '❌ Failed to launch browser',
        BROWSER_NOT_FOUND: '❌ Browser not found',
        BROWSER_CRASH: '❌ Browser crashed unexpectedly',
        CONTEXT_CREATION_FAILED: '❌ Failed to create browser context',
        
        // Element Errors
        ELEMENT_NOT_FOUND: (selector) => `❌ Element not found: ${selector}`,
        BUTTON_NOT_FOUND: (name) => `❌ Button not found: ${name}`,
        INPUT_FIELD_MISSING: (field) => `❌ Input field missing: ${field}`,
        
        // Generic
        UNKNOWN_ERROR: '❌ An unknown error occurred',
        OPERATION_FAILED: (operation) => `❌ ${operation} failed`
    },

    // Warning Messages
    WARNING: {
        PARTIAL_DATA: '⚠️  Partial data extracted',
        MISSING_FIELD: (field) => `⚠️  Missing field: ${field}`,
        INCOMPLETE_RESULTS: '⚠️  Incomplete results returned',
        CAPTCHA_DETECTED: '⚠️  CAPTCHA detected - manual intervention may be required',
        TWO_FA_DETECTED: '⚠️  2FA detected - please complete verification',
        RATE_LIMIT_APPROACHING: '⚠️  Approaching rate limit',
        COOKIES_EXPIRED: '⚠️  Cookies may have expired',
        STALE_DATA: '⚠️  Data may be stale',
        SLOW_RESPONSE: '⚠️  Server response is slow',
        DUPLICATE_FOUND: '⚠️  Duplicate entry detected',
        POPUP_DETECTED: (type) => `⚠️  ${type} popup detected`,
        MANUAL_ACTION_REQUIRED: '⚠️  Manual action required',
        WAIT_REQUIRED: (seconds) => `⚠️  Waiting ${seconds} seconds for manual completion...`
    },

    // Info Messages
    INFO: {
        STARTING: (platform) => `--- Starting ${platform.toUpperCase()} scraper ---`,
        SEARCHING: (title, location) => `🔍 Searching for "${title}" in "${location}"`,
        NAVIGATING: (url) => `📍 Navigating to ${url}...`,
        LOGGING_IN: '🔑 Logging in...',
        FILLING_FORM: '📝 Filling form...',
        CLICKING: (element) => `👆 Clicking ${element}...`,
        WAITING: (reason) => `⏳ Waiting for ${reason}...`,
        SCROLLING: '📜 Scrolling page...',
        LOADING_MORE: '📥 Loading more results...',
        EXTRACTING: (type) => `📦 Extracting ${type}...`,
        PROCESSING: (count, total) => `⚙️  Processing ${count}/${total}...`,
        FOUND: (count, type) => `✓ Found ${count} ${type}`,
        CURRENT_PAGE: (page) => `📄 Current page: ${page}`,
        TOTAL_EXTRACTED: (count) => `📊 Total extracted: ${count}`,
        BROWSER_LAUNCHING: '🚀 Launching browser...',
        CLOSING_POPUPS: '❌ Closing popups...',
        DOMAIN_SELECTED: (domain) => `🌐 Using domain: ${domain}`,
        PARALLEL_PROCESSING: (threads) => `⚡ Processing with ${threads} parallel threads...`
    },

    // Status Messages
    STATUS: {
        INITIALIZING: '⚙️  Initializing...',
        CONNECTING: '🔌 Connecting...',
        AUTHENTICATING: '🔐 Authenticating...',
        LOADING: '⏳ Loading...',
        PROCESSING: '⚙️  Processing...',
        COMPLETED: '✅ Completed',
        FAILED: '❌ Failed',
        IN_PROGRESS: '🔄 In progress...',
        RETRYING: (attempt, max) => `🔄 Retrying (${attempt}/${max})...`,
        SKIPPING: (reason) => `⏭️  Skipping: ${reason}`,
        PAUSED: '⏸️  Paused',
        RESUMED: '▶️  Resumed'
    },

    // Progress Messages
    PROGRESS: {
        PAGES_SCRAPED: (current, total) => `📄 Scraped ${current}/${total} pages`,
        JOBS_EXTRACTED: (current, total) => `📦 Extracted ${current}/${total} jobs`,
        DETAILS_FETCHING: (current, total) => `📋 Fetching details ${current}/${total}`,
        COMPANIES_PROCESSED: (current, total) => `🏢 Processed ${current}/${total} companies`,
        PERCENTAGE: (percent) => `${percent}% complete`
    },

    // Platform Specific
    PLATFORM: {
        DICE: {
            FETCHING_URLS: '🔗 Fetching job URLs from search results...',
            PROCESSING_DETAILS: '📋 Processing job details...',
            COMPANY_PROFILE: (name) => `🏢 Fetching company profile: ${name}...`
        },
        MONSTER: {
            API_CALL: '📡 Making API call to Monster...',
            FETCHING_PAGE: (page) => `📄 Fetching page ${page}...`
        },
        TECHFETCH: {
            READY_TO_SEARCH: '✅ Ready to search jobs',
            SESSION_COOKIES: '🍪 Session cookies obtained',
            SEARCH_INITIATED: '🔍 Search initiated successfully'
        },
        LINKEDIN: {
            CDP_CONNECTING: '🔌 Connecting to Chrome DevTools Protocol...',
            CHROME_REQUIRED: '⚠️  Chrome must be running with remote debugging',
            MANUAL_LOGIN: '👤 Manual login required - please login to LinkedIn',
            FEED_MODE: (query) => `📋 Boolean Logic: "${query}"`,
            POST_EXTRACTED: (count) => `📝 Extracted ${count} posts`
        },
        GLASSDOOR: {
            LOADING_COOKIES: (count) => `🍪 Loaded ${count} cookies`,
            SHOW_MORE_CLICKED: '➕ Clicked "Show More" button',
            PARALLEL_EXTRACTION: (tabs) => `🔀 Extracting details with ${tabs} parallel tabs...`,
            POPUP_CLOSED: (type) => `❌ Closed ${type} popup`
        }
    }
};

/**
 * Error Classes for different types of failures
 */
export class ScraperError extends Error {
    constructor(message, code = 'UNKNOWN_ERROR', platform = null) {
        super(message);
        this.name = 'ScraperError';
        this.code = code;
        this.platform = platform;
        this.timestamp = new Date().toISOString();
    }
}

export class AuthenticationError extends ScraperError {
    constructor(message, platform = null) {
        super(message, 'AUTH_ERROR', platform);
        this.name = 'AuthenticationError';
    }
}

export class NetworkError extends ScraperError {
    constructor(message, statusCode = null, platform = null) {
        super(message, 'NETWORK_ERROR', platform);
        this.name = 'NetworkError';
        this.statusCode = statusCode;
    }
}

export class ParsingError extends ScraperError {
    constructor(message, data = null, platform = null) {
        super(message, 'PARSING_ERROR', platform);
        this.name = 'ParsingError';
        this.data = data;
    }
}

export class BrowserError extends ScraperError {
    constructor(message, platform = null) {
        super(message, 'BROWSER_ERROR', platform);
        this.name = 'BrowserError';
    }
}

/**
 * Validation helpers
 */
export const VALIDATION = {
    CREDENTIALS: {
        EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        URL: /^https?:\/\/.+/
    },
    
    validateCredentials: (credentials, required = ['email', 'password']) => {
        const missing = required.filter(field => !credentials || !credentials[field]);
        if (missing.length > 0) {
            throw new AuthenticationError(
                MESSAGES.ERROR.CREDENTIALS_REQUIRED('Platform', missing)
            );
        }
        return true;
    },
    
    validateEmail: (email) => {
        if (!VALIDATION.CREDENTIALS.EMAIL.test(email)) {
            throw new AuthenticationError('Invalid email format');
        }
        return true;
    }
};

/**
 * Retry configuration
 */
export const RETRY_CONFIG = {
    MAX_RETRIES: 3,
    INITIAL_DELAY: 2000,
    MAX_DELAY: 30000,
    BACKOFF_MULTIPLIER: 2,
    
    calculateDelay: (attempt) => {
        const delay = RETRY_CONFIG.INITIAL_DELAY * Math.pow(RETRY_CONFIG.BACKOFF_MULTIPLIER, attempt - 1);
        return Math.min(delay, RETRY_CONFIG.MAX_DELAY);
    }
};

/**
 * Timeout configuration
 */
export const TIMEOUTS = {
    PAGE_LOAD: 60000,
    ELEMENT_WAIT: 30000,
    API_REQUEST: 30000,
    LOGIN: 45000,
    SHORT: 5000,
    MEDIUM: 15000,
    LONG: 60000,
    MANUAL_ACTION: 30000
};

/**
 * Helper function to log errors consistently
 */
export function logError(platform, error, context = {}) {
    const errorInfo = {
        platform,
        message: error.message,
        code: error.code || 'UNKNOWN',
        timestamp: new Date().toISOString(),
        ...context
    };
    
    console.error(`[${platform.toUpperCase()}] ❌ Error:`, JSON.stringify(errorInfo, null, 2));
    return errorInfo;
}

/**
 * Helper function to handle retries
 */
export async function withRetry(operation, platform, maxRetries = RETRY_CONFIG.MAX_RETRIES) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            
            if (attempt < maxRetries) {
                const delay = RETRY_CONFIG.calculateDelay(attempt);
                console.log(MESSAGES.STATUS.RETRYING(attempt, maxRetries));
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    throw new ScraperError(
        `Operation failed after ${maxRetries} attempts: ${lastError.message}`,
        'MAX_RETRIES_EXCEEDED',
        platform
    );
}
