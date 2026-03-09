// Scraper Credentials Queue API Client
// Manages credential fetching and reporting via API
// Supports local credentials fallback when API is not configured

import https from 'https';
import fs from 'fs';
import path from 'path';
import { logProgress } from './utils.js';

// Load local credentials from credentials.json
function loadLocalCredentials() {
    try {
        const credentialsPath = path.join(process.cwd(), 'config', 'credentials.json');
        return JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));
    } catch {
        return {};
    }
}

// Create an HTTPS agent that ignores certificate errors (for development/self-signed certs)
const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

class CredentialsAPIClient {
    constructor(apiBaseUrl, apiKey) {
        this.apiBaseUrl = apiBaseUrl;
        this.apiKey = apiKey;
        this.headers = {
            'X-Scraper-API-Key': apiKey,
            'Content-Type': 'application/json'
        };
        this.activeCredentials = new Map(); // Track active credentials {platform: {id, data}}
    }

    /**
     * Fetch next available credential for a platform
     * @param {string} platform - 'linkedin', 'glassdoor', or 'techfetch'
     * @param {string} sessionId - Optional session ID for tracking
     * @returns {Object|null} Credential object or null if none available
     */
    async getCredential(platform, sessionId = null) {
        // --- Local credential fallback ---
        // If no API is configured, use credentials.json directly
        if (!this.apiBaseUrl || !this.apiKey) {
            logProgress(platform, `📂 No API configured - using local credentials from credentials.json`);
            const local = loadLocalCredentials();
            const cred = local[platform.toLowerCase()];
            if (!cred) {
                logProgress(platform, `⚠️  No local credentials found for "${platform}" in credentials.json`);
                return null;
            }
            // Return a credential-shaped object with a fake id so reportSuccess/reportFailure are no-ops
            return { id: `local-${platform}`, ...cred };
        }

        try {
            const url = `${this.apiBaseUrl}/api/scraper-credentials/queue/${platform}/next${sessionId ? `?session_id=${sessionId}` : ''}`;
            
            logProgress(platform, `📡 Fetching credential from API...`);
            
            const fetchOptions = {
                method: 'GET',
                headers: this.headers
            };
            
            // Add HTTPS agent if using HTTPS
            if (url.startsWith('https://')) {
                fetchOptions.agent = httpsAgent;
            }
            
            const response = await fetch(url, fetchOptions);

            // 204 = No credentials available
            if (response.status === 204) {
                logProgress(platform, `⚠️  No credentials available for ${platform}`);
                return null;
            }

            if (!response.ok) {
                const error = await response.json();
                throw new Error(`API Error: ${error.message || response.statusText}`);
            }

            const credential = await response.json();
            
            // Store active credential for this platform
            this.activeCredentials.set(platform, {
                id: credential.id,
                data: credential
            });

            logProgress(platform, `✓ Credential acquired: ${credential.name || credential.email || 'ID ' + credential.id}`);
            
            return credential;

        } catch (error) {
            logProgress(platform, `❌ Failed to fetch credential: ${error.message}`);
            throw error;
        }
    }

    /**
     * Report successful use of a credential
     * @param {string} platform - Platform name
     * @param {string} message - Optional success message
     */
    async reportSuccess(platform, message = null) {
        const credential = this.activeCredentials.get(platform);
        
        if (!credential) {
            console.warn(`⚠️  No active credential found for ${platform}`);
            return;
        }

        // Skip API call for local credentials
        if (credential.id && String(credential.id).startsWith('local-')) {
            logProgress(platform, `✓ Local credential - no API report needed`);
            this.activeCredentials.delete(platform);
            return;
        }

        try {
            const url = `${this.apiBaseUrl}/api/scraper-credentials/queue/${credential.id}/success`;
            
            const body = message ? { message } : {};
            
            const fetchOptions = {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify(body)
            };
            
            if (url.startsWith('https://')) {
                fetchOptions.agent = httpsAgent;
            }
            
            const response = await fetch(url, fetchOptions);

            if (!response.ok) {
                const error = await response.json();
                throw new Error(`API Error: ${error.message || response.statusText}`);
            }

            const result = await response.json();
            logProgress(platform, `✓ Credential released: ${result.status}`);
            
            // Remove from active credentials
            this.activeCredentials.delete(platform);

        } catch (error) {
            logProgress(platform, `❌ Failed to report success: ${error.message}`);
        }
    }

    /**
     * Report credential failure
     * @param {string} platform - Platform name
     * @param {string} errorMessage - What went wrong
     * @param {number} cooldownMinutes - 0 for permanent failure, >0 for temporary cooldown
     */
    async reportFailure(platform, errorMessage, cooldownMinutes = 0) {
        const credential = this.activeCredentials.get(platform);
        
        if (!credential) {
            console.warn(`⚠️  No active credential found for ${platform}`);
            return;
        }

        // Skip API call for local credentials
        if (credential.id && String(credential.id).startsWith('local-')) {
            logProgress(platform, `⚠️  Local credential - no API failure report needed`);
            this.activeCredentials.delete(platform);
            return;
        }

        try {
            const url = `${this.apiBaseUrl}/api/scraper-credentials/queue/${credential.id}/failure`;
            
            logProgress(platform, `📡 Sending POST to credential API...`);
            logProgress(platform, `   Endpoint: POST /api/scraper-credentials/queue/${credential.id}/failure`);
            logProgress(platform, `   Error: ${errorMessage}`);
            logProgress(platform, `   Cooldown: ${cooldownMinutes} minutes`);
            
            const fetchOptions = {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify({
                    error_message: errorMessage,
                    cooldown_minutes: cooldownMinutes
                })
            };
            
            if (url.startsWith('https://')) {
                fetchOptions.agent = httpsAgent;
            }
            
            const response = await fetch(url, fetchOptions);

            if (!response.ok) {
                const error = await response.json();
                throw new Error(`API Error: ${error.message || response.statusText}`);
            }

            const result = await response.json();
            const failureType = cooldownMinutes > 0 ? `cooldown (${cooldownMinutes}m)` : 'failed';
            logProgress(platform, `⚠️  Credential marked as ${failureType}: ${result.status}`);
            
            // Remove from active credentials
            this.activeCredentials.delete(platform);

        } catch (error) {
            logProgress(platform, `❌ Failed to report failure: ${error.message}`);
        }
    }

    /**
     * Release credential without reporting success or failure
     * @param {string} platform - Platform name
     */
    async releaseCredential(platform) {
        const credential = this.activeCredentials.get(platform);
        
        if (!credential) {
            console.warn(`⚠️  No active credential found for ${platform}`);
            return;
        }

        // Skip API call for local credentials
        if (credential.id && String(credential.id).startsWith('local-')) {
            logProgress(platform, `✓ Local credential released`);
            this.activeCredentials.delete(platform);
            return;
        }

        try {
            const url = `${this.apiBaseUrl}/api/scraper-credentials/queue/${credential.id}/release`;
            
            const fetchOptions = {
                method: 'POST',
                headers: this.headers
            };
            
            if (url.startsWith('https://')) {
                fetchOptions.agent = httpsAgent;
            }
            
            const response = await fetch(url, fetchOptions);

            if (!response.ok) {
                const error = await response.json();
                throw new Error(`API Error: ${error.message || response.statusText}`);
            }

            const result = await response.json();
            logProgress(platform, `✓ Credential released without reporting: ${result.status}`);
            
            // Remove from active credentials
            this.activeCredentials.delete(platform);

        } catch (error) {
            logProgress(platform, `❌ Failed to release credential: ${error.message}`);
        }
    }

    /**
     * Get the active credential data for a platform (without API call)
     * @param {string} platform - Platform name
     * @returns {Object|null} Credential data or null
     */
    getActiveCredential(platform) {
        const credential = this.activeCredentials.get(platform);
        return credential ? credential.data : null;
    }

    /**
     * Release all active credentials (cleanup on shutdown)
     */
    async releaseAll() {
        const platforms = Array.from(this.activeCredentials.keys());
        
        for (const platform of platforms) {
            await this.releaseCredential(platform);
        }
    }
}

// Singleton instance - auto-initialized in local mode
let apiClient = new CredentialsAPIClient(null, null);

/**
 * Initialize the credentials API client
 * @param {string} apiBaseUrl - Base URL of the API (e.g., 'http://localhost:5000')
 * @param {string} apiKey - Scraper API key
 */
export function initializeCredentialsAPI(apiBaseUrl, apiKey) {
    if (!apiBaseUrl || !apiKey) {
        console.log('ℹ️  No API credentials provided - using local credentials mode');
        apiClient = new CredentialsAPIClient(null, null);
        return apiClient;
    }
    
    apiClient = new CredentialsAPIClient(apiBaseUrl, apiKey);
    console.log('✓ Credentials API client initialized');
    return apiClient;
}

/**
 * Get the singleton API client instance
 * @returns {CredentialsAPIClient}
 */
export function getCredentialsAPIClient() {
    return apiClient;
}

export { CredentialsAPIClient };
