// LinkedIn Scraper - CDP Connection Method
// Connects to your existing Chrome browser (no automation detection!)

import { chromium } from 'playwright';
import { logProgress, normalizeJobData } from '../common/utils.js';
import { getCredentialsAPIClient } from '../common/credentialsAPI.js';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const CONFIG = {
    cdpUrl: 'http://localhost:9222',
    searchQuery: 'devops c2c us contract remote sre cloud engineer',  // Boolean: (jobTitle AND location) OR "c2c"
    jobTitle: 'devops',  // Will be set dynamically
    location: 'us',  // Will be set dynamically
    maxPosts: 100,
    scrollDelay: 2000,
    // LinkedIn credentials (fetched from API)
    email: null,
    password: null,
    credentialId: null,
    // Use search instead of feed for better job targeting
    useFeedInsteadOfSearch: false  // Set to true to use feed (has URLs but less relevant)
};

// Helper: Wait function
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: Random delay
const randomDelay = (min, max) => wait(min + Math.random() * (max - min));

// Helper: Check if Chrome is running on port 9222
async function isChromeRunning() {
    try {
        const response = await fetch('http://localhost:9222/json/version');
        return response.ok;
    } catch (error) {
        return false;
    }
}

// Helper: Start Chrome with remote debugging
async function startChromeWithDebugging() {
    return new Promise((resolve, reject) => {
        const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
        const userDataDir = join(process.env.USERPROFILE, 'chrome-debug-profile');
        
        logProgress('LinkedIn', '🚀 Starting Chrome with remote debugging...');
        
        const chromeProcess = spawn(chromePath, [
            '--remote-debugging-port=9222',
            `--user-data-dir=${userDataDir}`,
            'https://www.linkedin.com/feed/'
        ], {
            detached: true,
            stdio: 'ignore'
        });
        
        chromeProcess.unref();
        
        // Wait for Chrome to start and port to be available
        let attempts = 0;
        const maxAttempts = 20;
        
        const checkInterval = setInterval(async () => {
            attempts++;
            const isRunning = await isChromeRunning();
            
            if (isRunning) {
                clearInterval(checkInterval);
                logProgress('LinkedIn', '✅ Chrome started successfully on port 9222');
                resolve();
            } else if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                reject(new Error('Chrome failed to start within 10 seconds'));
            }
        }, 500);
    });
}

async function connectToChrome() {
    logProgress('LinkedIn', '🔗 Connecting to Chrome on port 9222...');
    
    // Check if Chrome is already running with debugging
    const isRunning = await isChromeRunning();
    
    if (!isRunning) {
        logProgress('LinkedIn', '⚠️  Chrome not running with debugging, attempting to start...');
        try {
            await startChromeWithDebugging();
            // Give Chrome a moment to fully initialize
            await wait(2000);
        } catch (error) {
            logProgress('LinkedIn', 'ERROR: ❌ Failed to start Chrome automatically');
            logProgress('LinkedIn', 'ERROR:    Please manually run: start-chrome.bat');
            throw error;
        }
    }
    
    try {
        const browser = await chromium.connectOverCDP(CONFIG.cdpUrl);
        logProgress('LinkedIn', '✅ Connected to Chrome successfully!');
        return browser;
    } catch (error) {
        logProgress('LinkedIn', 'ERROR: ❌ Failed to connect to Chrome. Make sure:');
        logProgress('LinkedIn', 'ERROR:    1. Chrome is running with: start-chrome.bat');
        logProgress('LinkedIn', 'ERROR:    2. You are logged into LinkedIn');
        logProgress('LinkedIn', 'ERROR:    3. Port 9222 is not blocked');
        throw error;
    }
}

async function loginToLinkedIn(page) {
    logProgress('LinkedIn', '🔐 Checking login status...');
    
    const currentUrl = page.url();
    
    // Check if already logged in
    const isLoggedIn = await page.evaluate(() => {
        const bodyText = document.body.innerText;
        return !bodyText.includes('Sign in') && 
               !window.location.href.includes('/login') &&
               !bodyText.includes('Join now');
    });
    
    if (isLoggedIn) {
        logProgress('LinkedIn', '✅ Already logged in!');
        return true;
    }
    
    logProgress('LinkedIn', '🔑 Not logged in, proceeding to login...');
    
    // Navigate to login page
    if (!currentUrl.includes('/login') && !currentUrl.includes('/checkpoint')) {
        logProgress('LinkedIn', '📍 Navigating to login page...');
        await page.goto('https://www.linkedin.com/login');
        await randomDelay(2000, 3000);
    }
        // Check if "Sign in using another account" button exists and click it
    try {
        const anotherAccountButton = await page.$('button.signin-other-account, button.artdeco-list__item.signin-other-account, .signin-other-account');
        if (anotherAccountButton) {
            const isVisible = await anotherAccountButton.isVisible();
            if (isVisible) {
                logProgress('LinkedIn', '🔘 Clicking "Sign in using another account" button...');
                await anotherAccountButton.click();
                await randomDelay(2000, 3000);
            }
        }
    } catch (error) {
        // Button not found, continue to email field
        logProgress('LinkedIn', '   No account selection page, proceeding to email field...');
    }
        // Fill email
    logProgress('LinkedIn', `📧 Entering email: ${CONFIG.email}`);
    await page.waitForSelector('#username', { timeout: 10000 });
    await page.click('#username');
    await randomDelay(300, 600);
    
    // Clear any existing text in email field
    await page.evaluate(() => {
        const emailField = document.querySelector('#username');
        if (emailField) emailField.value = '';
    });
    
    // Select all and delete as backup
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await randomDelay(200, 400);
    
    // Type new email
    for (let char of CONFIG.email) {
        await page.keyboard.type(char, { delay: 50 + Math.random() * 100 });
    }
    
    await randomDelay(500, 1000);
    
    // Fill password
    logProgress('LinkedIn', '🔒 Entering password...');
    await page.click('#password');
    await randomDelay(300, 600);
    
    // Clear any existing text in password field
    await page.evaluate(() => {
        const passwordField = document.querySelector('#password');
        if (passwordField) passwordField.value = '';
    });
    
    // Select all and delete as backup
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await randomDelay(200, 400);
    
    // Type new password
    for (let char of CONFIG.password) {
        await page.keyboard.type(char, { delay: 50 + Math.random() * 100 });
    }
    
    await randomDelay(1000, 2000);
    
    // Click sign in button
    logProgress('LinkedIn', '🖱️  Clicking Sign in button...');
    const signInButton = await page.$('button[type="submit"]');
    if (signInButton) {
        await signInButton.click();
    } else {
        await page.keyboard.press('Enter');
    }
    
    // Wait longer for LinkedIn to process login and redirect
    logProgress('LinkedIn', '⏳ Waiting for login to complete...');
    await randomDelay(8000, 10000);
    
    // Check the result
    const finalUrl = page.url();
    logProgress('LinkedIn', `   Current URL: ${finalUrl}`);
    
    // First check: Are we successfully logged in? (on feed or authenticated page)
    const isOnAuthenticatedPage = finalUrl.includes('/feed') || 
                                   finalUrl.includes('/mynetwork') || 
                                   finalUrl.includes('/search') ||
                                   finalUrl.includes('/in/') ||
                                   finalUrl.includes('/jobs');
    
    if (isOnAuthenticatedPage) {
        logProgress('LinkedIn', '✅ Login successful!');
        return true;
    }
    
    // Check for explicit error messages (only if still on login-related pages)
    if (finalUrl.includes('/login') || finalUrl.includes('/uas/login')) {
        const hasError = await page.evaluate(() => {
            const errorText = document.body.innerText.toLowerCase();
            const hasErrorMessage = errorText.includes('wrong email or password') || 
                   errorText.includes('incorrect email or password') ||
                   errorText.includes("couldn't find a linkedin account") ||
                   errorText.includes('that password is incorrect');
            
            const hasErrorElement = document.querySelector('.alert-error, .error-message, .form__error') !== null;
            
            return hasErrorMessage || hasErrorElement;
        });
        
        if (hasError) {
            logProgress('LinkedIn', '❌ Wrong credentials detected on page!');
            throw new Error('Login failed: Invalid email or password');
        }
        
        // Still on login page but no error message = credentials likely wrong
        logProgress('LinkedIn', '❌ Still on login page - credentials likely wrong');
        throw new Error('Login failed: Invalid credentials (still on login page)');
    }
    
    // Check for security challenges/verification
    if (finalUrl.includes('/challenge') || finalUrl.includes('/checkpoint/challenge')) {
        logProgress('LinkedIn', '⚠️  Security challenge/verification required');
        throw new Error('Login failed: Security challenge detected - account may need verification');
    }
    
    // If we reached here and passed all checks, assume success
    logProgress('LinkedIn', '✅ Login successful - redirected to authenticated page');
    return true;
}

async function navigateToSearch(page, query) {
    logProgress('LinkedIn', `🔍 Boolean Search: ("${CONFIG.jobTitle}" AND "${CONFIG.location}") OR "c2c"`);
    
    // Make sure we're logged in first
    await loginToLinkedIn(page);
    
    // Navigate to feed first to establish session
    logProgress('LinkedIn', '📍 Navigating to LinkedIn feed first...');
    await page.goto('https://www.linkedin.com/feed/');
    await randomDelay(2000, 3000);
    
    // Choose between feed (with URLs) or search (filtered but less reliable URLs)
    if (CONFIG.useFeedInsteadOfSearch) {
        logProgress('LinkedIn', '✅ Using main feed (posts will have URLs)');
        logProgress('LinkedIn', `🔍 Filtering: ("${CONFIG.jobTitle}" AND "${CONFIG.location}") OR "c2c"`);
        // Stay on feed page
    } else {
        // Construct direct content search URL - matches LinkedIn's format
        const searchKeywords = `${CONFIG.jobTitle} ${CONFIG.location}`;
        const encodedQuery = encodeURIComponent(searchKeywords);
        const contentSearchUrl = `https://www.linkedin.com/search/results/content/?keywords=${encodedQuery}&origin=SWITCH_SEARCH_VERTICAL&sid=*To`;
        
        logProgress('LinkedIn', `🔗 Navigating to content search page...`);
        logProgress('LinkedIn', `   Search: "${searchKeywords}"`);
        logProgress('LinkedIn', `   URL: ${contentSearchUrl}`);
        
        // Navigate directly to content search results
        await page.goto(contentSearchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await randomDelay(4000, 6000);
    }
    
    // Verify we're on the right page
    const currentUrl = page.url();
    logProgress('LinkedIn', `📍 Current URL: ${currentUrl}`);
    
    const isFeedPage = currentUrl.includes('/feed');
    const isSearchPage = currentUrl.includes('/search/results/content/');
    
    if (isFeedPage) {
        logProgress('LinkedIn', '✅ On main feed page (posts will include URLs)');
    } else if (isSearchPage) {
        logProgress('LinkedIn', '✅ On content search results page');
        logProgress('LinkedIn', '⚠️  Post URLs not available from search (use feed mode instead)');
    } else {
        logProgress('LinkedIn', '⚠️  Unexpected page, continuing anyway...');
    }
    
    // Check what's on the page
    const pageInfo = await page.evaluate(() => {
        return {
            title: document.title,
            hasResults: document.querySelector('.search-results-container, .scaffold-finite-scroll') !== null,
            hasFeed: document.querySelector('.feed-shared-update-v2, #main') !== null,
            bodyPreview: document.body.innerText.substring(0, 300)
        };
    });
    
    logProgress('LinkedIn', `📄 Page title: ${pageInfo.title}`);
    logProgress('LinkedIn', `📊 Has results container: ${pageInfo.hasResults || pageInfo.hasFeed}`);
    
    if (pageInfo.bodyPreview.includes('No results') || pageInfo.bodyPreview.includes('Try searching for')) {
        logProgress('LinkedIn', '⚠️  No results found for this search query');
    }
}

async function extractPosts(page, maxPosts) {
    logProgress('LinkedIn', `📦 Extracting up to ${maxPosts} posts...`);
    
    const isFeedMode = CONFIG.useFeedInsteadOfSearch;
    const keywords = CONFIG.searchQuery.toLowerCase().split(' ');
    
    if (isFeedMode) {
        logProgress('LinkedIn', `   📋 Boolean Logic: ("${CONFIG.jobTitle}" AND "${CONFIG.location}") OR "c2c"\n`);
    } else {
        logProgress('LinkedIn', '   Note: Only extracting CONTENT posts (not people/jobs/companies)\n');
    }
    
    // Debug: Check what's on the page
    const debugInfo = await page.evaluate(() => {
        const selectors = {
            '.feed-shared-update-v2': document.querySelectorAll('.feed-shared-update-v2').length,
            '.occludable-update': document.querySelectorAll('.occludable-update').length,
            '[data-urn*="activity:"]': document.querySelectorAll('[data-urn*="activity:"]').length,
            'div[data-id*="activity:"]': document.querySelectorAll('div[data-id*="activity:"]').length,
            '.search-results__list li': document.querySelectorAll('.search-results__list li').length,
            '.reusable-search__result-container': document.querySelectorAll('.reusable-search__result-container').length,
            'li.reusable-search__result-container': document.querySelectorAll('li.reusable-search__result-container').length,
            'div.search-results-container': document.querySelectorAll('div.search-results-container').length,
            '.entity-result': document.querySelectorAll('.entity-result').length
        };
        
        // Get sample HTML from first few elements
        const sampleElement = document.querySelector('.search-results__list li, .reusable-search__result-container, li');
        const sampleHTML = sampleElement ? sampleElement.outerHTML.substring(0, 500) : 'No elements found';
        
        return { selectors, sampleHTML };
    });
    
    logProgress('LinkedIn', '\n🔍 DEBUG INFO - Elements found on page:');
    Object.entries(debugInfo.selectors).forEach(([selector, count]) => {
        logProgress('LinkedIn', `   ${count > 0 ? '✓' : '✗'} ${selector}: ${count}`);
    });
    logProgress('LinkedIn', '\n📄 Sample HTML (first element):');
    logProgress('LinkedIn', 'Sample HTML: ' + debugInfo.sampleHTML.substring(0, 300) + '...\n');
    
    const allPosts = [];
    const seenIds = new Set();
    const seenContentHashes = new Set(); // Track content to avoid duplicates
    let scrollAttempts = 0;
    const maxScrolls = 150;
    let noNewPostsCount = 0;
    
    while (allPosts.length < maxPosts && scrollAttempts < maxScrolls) {
        scrollAttempts++;
        logProgress('LinkedIn', `📜 Scroll ${scrollAttempts}/${maxScrolls} - Posts found: ${allPosts.length}`);
        
        // FIRST: Expand all "see more" buttons in the current viewport
        await page.evaluate(() => {
            // Find and click all "see more" buttons to expand truncated content
            const seeMoreButtons = document.querySelectorAll(
                'button[aria-label*="see more"], ' +
                'button.feed-shared-inline-show-more-text__button, ' +
                '.feed-shared-inline-show-more-text button, ' +
                'button.see-more, ' +
                'button[data-test-id="see-more-button"], ' +
                '.update-components-text__see-more-less-toggle, ' +
                'button.update-components-text__see-more-less-toggle'
            );
            
            seeMoreButtons.forEach(button => {
                try {
                    if (button.offsetParent !== null) { // Check if visible
                        button.click();
                    }
                } catch (e) {
                    // Ignore click errors
                }
            });
        });
        
        // Wait a moment for content to expand
        await randomDelay(500, 800);
        
        // THEN: Extract posts from current viewport
        const posts = await page.evaluate((config) => {
            // For search results, use different selectors
            const isSearchPage = window.location.href.includes('/search/results/content/');
            
            let postElements;
            if (isSearchPage) {
                // Search results use different structure
                postElements = document.querySelectorAll('.reusable-search__result-container, .feed-shared-update-v2');
            } else {
                // Feed page structure
                postElements = document.querySelectorAll('.feed-shared-update-v2');
            }
            
            const results = [];
            const debugInfo = { sampleLinks: [], foundIds: [] };
            const keywords = config.searchQuery.toLowerCase().split(' ');
            
            postElements.forEach((element, index) => {
                try {
                    // Skip if this is a job card
                    const isJobCard = element.querySelector('a[href*="/jobs/view/"]') !== null;
                    if (isJobCard) {
                        return;
                    }
                    
                    // DEBUG: Collect sample link hrefs for first element only
                    if (index === 0 && results.length === 0) {
                        const sampleLinks = Array.from(element.querySelectorAll('a[href]')).slice(0, 10);
                        debugInfo.sampleLinks = sampleLinks.map(link => link.getAttribute('href'));
                        
                        // Also get the element's data attributes
                        debugInfo.elementInfo = {
                            className: element.className,
                            dataUrn: element.getAttribute('data-urn'),
                            dataId: element.getAttribute('data-id'),
                            id: element.id,
                            hasTimestampLink: !!element.querySelector('.feed-shared-actor__sub-description a, time a')
                        };
                    }
                    
                    // Get post ID from URN or data attributes - try multiple approaches
                    let postId = null;
                    let activityUrn = null;
                    
                    // Method 1: Check parent container data-urn
                    const containerUrn = element.getAttribute('data-urn');
                    if (containerUrn && containerUrn.includes('activity:')) {
                        const match = containerUrn.match(/activity:([^:,\s)]+)/);
                        if (match) {
                            postId = match[1];
                            activityUrn = containerUrn;
                        }
                    }
                    
                    // Method 2: Check child elements for activity URNs
                    if (!postId) {
                        const urnElements = element.querySelectorAll('[data-urn], [data-id], [id]');
                        for (const el of urnElements) {
                            const urn = el.getAttribute('data-urn') || el.getAttribute('data-id') || el.id;
                            if (urn && urn.includes('activity:')) {
                                const match = urn.match(/activity:([^:,\s)]+)/);
                                if (match) {
                                    postId = match[1];
                                    activityUrn = urn;
                                    break;
                                }
                            }
                        }
                    }
                    
                    // Method 3: Check all links in the post for activity IDs in URLs
                    if (!postId) {
                        const allLinks = element.querySelectorAll('a[href]');
                        for (const link of allLinks) {
                            const href = link.getAttribute('href');
                            // Look for patterns like /feed/update/urn:li:activity:XXXXXXX or activity-XXXXXXX
                            const activityMatch = href?.match(/(?:activity[:-])(\d{19})/);
                            if (activityMatch) {
                                postId = activityMatch[1];
                                activityUrn = `urn:li:activity:${postId}`;
                                break;
                            }
                        }
                    }
                    
                    // Fallback: generate ID from content hash
                    if (!postId) {
                        postId = 'post_' + Math.random().toString(36).substr(2, 9);
                    }
                    
                    // Get author name - try multiple selectors
                    const authorNameSelectors = [
                        '.update-components-actor__name',
                        '.feed-shared-actor__name', 
                        '.update-components-actor__title',
                        'span.update-components-actor__name span[aria-hidden="true"]',
                        '.feed-shared-actor__title',
                        'span[dir="ltr"]'
                    ];
                    
                    let authorName = '';
                    for (const selector of authorNameSelectors) {
                        const el = element.querySelector(selector);
                        if (el?.textContent?.trim() && el.textContent.trim().length > 2) {
                            authorName = el.textContent.trim();
                            break;
                        }
                    }
                    
                    // Get author profile URL
                    const authorLinkSelectors = [
                        '.update-components-actor__container a[href*="/in/"]',
                        '.feed-shared-actor a[href*="/in/"]',
                        'a.update-components-actor__meta-link[href*="/in/"]',
                        'a[data-control-name="actor"][href*="/in/"]',
                        '.update-components-actor__image-link[href*="/in/"]',
                        'a.app-aware-link[href*="/in/"]'
                    ];
                    
                    let authorProfileUrl = '';
                    for (const selector of authorLinkSelectors) {
                        const linkEl = element.querySelector(selector);
                        if (linkEl?.href && linkEl.href.includes('/in/')) {
                            // Clean URL - remove query parameters
                            authorProfileUrl = linkEl.href.split('?')[0];
                            break;
                        }
                    }
                    
                    // Get post content
                    const contentSelectors = [
                        '.feed-shared-update-v2__description',
                        '.update-components-text',
                        '.feed-shared-text',
                        '.update-components-update-v2__commentary',
                        '.feed-shared-update-v2__commentary',
                        '[data-test-id="main-feed-activity-card__commentary"]',
                        '.feed-shared-inline-show-more-text',
                        'div[dir="ltr"]' // Generic text content
                    ];
                    
                    let postContent = '';
                    for (const selector of contentSelectors) {
                        const contentEl = element.querySelector(selector);
                        if (contentEl?.textContent?.trim() && contentEl.textContent.trim().length > 20) {
                            postContent = contentEl.textContent.trim();
                            break;
                        }
                    }
                    
                    // Get timestamp
                    const timestampSelectors = [
                        '.update-components-actor__sub-description',
                        '.feed-shared-actor__sub-description',
                        '.update-components-actor__supplementary-actor-info',
                        'time',
                        '[datetime]'
                    ];
                    
                    let timestamp = '';
                    for (const selector of timestampSelectors) {
                        const timeEl = element.querySelector(selector);
                        if (timeEl) {
                            timestamp = timeEl.getAttribute('datetime') || timeEl.textContent?.trim() || '';
                            if (timestamp) {
                                break;
                            }
                        }
                    }
                    
                    // Get post URL - improved extraction
                    let postUrl = '';
                    
                    // Method 1: Look for timestamp link (most reliable)
                    const timestampLink = element.querySelector('.update-components-actor__sub-description a, .feed-shared-actor__sub-description a, time a, a.app-aware-link[href*="activity"]');
                    if (timestampLink?.href && timestampLink.href.includes('activity')) {
                        postUrl = timestampLink.href.split('?')[0];
                    }
                    
                    // Method 2: Try standard post link selectors
                    if (!postUrl) {
                        const postLinkSelectors = [
                            'a[href*="/feed/update/urn:li:activity:"]',
                            'a[href*="/posts/activity-"]',
                            'a.update-components-actor__supplementary-actor-info',
                            '[data-urn*="activity:"] a[href*="activity"]',
                            'a[data-control-name*="like_post"] ~ a[href*="activity"]'
                        ];
                        
                        for (const selector of postLinkSelectors) {
                            const linkEl = element.querySelector(selector);
                            if (linkEl?.href && (linkEl.href.includes('/posts/') || linkEl.href.includes('/feed/update/'))) {
                                postUrl = linkEl.href.split('?')[0];
                                break;
                            }
                        }
                    }
                    
                    // Method 3: Search all links in the element
                    if (!postUrl) {
                        const allLinks = element.querySelectorAll('a[href]');
                        for (const link of allLinks) {
                            const href = link.getAttribute('href');
                            if (href && (href.includes('/feed/update/urn:li:activity:') || href.match(/\/posts\/.*activity-\d{19}/))) {
                                postUrl = href.split('?')[0];
                                break;
                            }
                        }
                    }
                    
                    // Fallback: construct post URL from activity URN if we have a real activity ID
                    if (!postUrl && postId && !postId.startsWith('post_')) {
                        postUrl = `https://www.linkedin.com/feed/update/urn:li:activity:${postId}`;
                    }
                    
                    // NOTE: LinkedIn content search results don't include direct post URLs
                    // Post URLs are only available if we can extract activity IDs from data attributes
                    // If no URL found, users will need to search based on author + content
                    if (!postUrl) {
                        postUrl = ''; // Explicitly set empty rather than undefined
                    }
                    
                    // DEBUG: Track found IDs
                    if (index === 0 && results.length === 0) {
                        debugInfo.foundIds.push({ postId, postUrl, hasRealId: !postId.startsWith('post_') });
                    }
                    
                    // Create a content hash for deduplication
                    const contentHash = postContent.substring(0, 100) + authorName;
                    
                    // Note: Filtering is done by LinkedIn search, not client-side
                    // Search page already filters by keywords in the URL
                    
                    // Only include if we have at least author and some content
                    if (authorName && postContent && postContent.length > 20) {
                        results.push({
                            id: postId,
                            author: authorName,
                            authorProfileUrl: authorProfileUrl,
                            content: postContent,
                            timestamp: timestamp,
                            postUrl: postUrl,
                            contentLength: postContent.length,
                            contentHash: contentHash // Add hash for deduplication
                        });
                    }
                } catch (e) {
                    // Skip invalid posts
                }
            });
            
            return { results, debugInfo };
        }, CONFIG); // Pass CONFIG to page.evaluate
        
        // Log debug info for first scroll
        if (scrollAttempts === 1 && posts.debugInfo) {
            logProgress('LinkedIn', '\n🔍 DEBUG - First post analysis:');
            logProgress('LinkedIn', 'Element info: ' + JSON.stringify(posts.debugInfo.elementInfo));
            logProgress('LinkedIn', '\nSample links from first post:');
            posts.debugInfo.sampleLinks?.forEach((link, i) => {
                logProgress('LinkedIn', `  ${i + 1}. ${link?.substring(0, 80)}`);
            });
            logProgress('LinkedIn', '\nID extraction results: ' + JSON.stringify(posts.debugInfo.foundIds));
            logProgress('LinkedIn', '');
        }
        
        // Use the results array from the returned object
        const extractedPosts = posts.results || posts;
        
        // Add new posts with deduplication
        let newPostsCount = 0;
        extractedPosts.forEach(post => {
            // Check both ID and content hash to avoid duplicates
            const isDuplicateById = seenIds.has(post.id);
            const isDuplicateByContent = seenContentHashes.has(post.contentHash);
            
            // Only add if not duplicate and we haven't reached max
            if (!isDuplicateById && !isDuplicateByContent && allPosts.length < maxPosts) {
                seenIds.add(post.id);
                seenContentHashes.add(post.contentHash);
                
                // Remove contentHash before adding to final results
                const { contentHash, ...postWithoutHash } = post;
                allPosts.push(postWithoutHash);
                newPostsCount++;
            }
        });
        
        if (newPostsCount > 0) {
            logProgress('LinkedIn', `   ✓ Found ${newPostsCount} new posts (total: ${allPosts.length})`);
            // Log sample URLs from first post
            if (allPosts.length === newPostsCount) {
                const firstPost = allPosts[0];
                logProgress('LinkedIn', `   📎 Sample URLs:`);
                logProgress('LinkedIn', `      Author: ${firstPost.authorProfileUrl ? '✓' : '✗'} ${firstPost.authorProfileUrl || 'Not found'}`);
                logProgress('LinkedIn', `      Post: ${firstPost.postUrl ? '✓' : '✗'} ${firstPost.postUrl || 'Not found'}`);
            }
            noNewPostsCount = 0;
        } else {
            noNewPostsCount++;
            logProgress('LinkedIn', `   ⚠️  No new posts found (${noNewPostsCount} scrolls without new content)`);
        }
        
        // Stop if no new posts for 15 consecutive scrolls
        if (noNewPostsCount >= 15) {
            logProgress('LinkedIn', '   ℹ️  No new posts for 15 scrolls, stopping...');
            break;
        }
        
        // Scroll down
        await page.evaluate(() => {
            window.scrollBy(0, 500 + Math.random() * 300);
        });
        
        await randomDelay(CONFIG.scrollDelay, CONFIG.scrollDelay + 1000);
    }
    
    if (allPosts.length === 0) {
        logProgress('LinkedIn', '\n⚠️  WARNING: No posts extracted!');
        logProgress('LinkedIn', '   This could mean:');
        logProgress('LinkedIn', '   1. Not on content search results page');
        logProgress('LinkedIn', '   2. LinkedIn changed their HTML structure');
        logProgress('LinkedIn', '   3. No results for this search query');
        logProgress('LinkedIn', '   4. Content is not loading (check browser window)');
    }
    
    return allPosts;
}

async function analyzePosts(posts) {
    logProgress('LinkedIn', '\n📊 Analyzing posts...');
    
    const jobPosts = posts.filter(post => {
        const content = post.content.toLowerCase();
        const isJobRelated = 
            content.includes('hiring') ||
            content.includes('job') ||
            content.includes('position') ||
            content.includes('looking for') ||
            content.includes('join our team') ||
            content.includes('apply') ||
            content.includes('engineer') ||
            content.includes('developer');
        
        return isJobRelated;
    });
    
    logProgress('LinkedIn', `✅ Total posts extracted: ${posts.length}`);
    logProgress('LinkedIn', `✅ Job-related posts: ${jobPosts.length}`);
    logProgress('LinkedIn', `✅ Other posts: ${posts.length - jobPosts.length}`);
    
    return {
        all: posts,
        jobRelated: jobPosts
    };
}



// Export function for UnifiedJobScraper
export async function scrapeLinkedIn(jobTitle, location, sessionId = null) {
    logProgress('LinkedIn', '🚀 LinkedIn Post Scraper (CDP Method)\n');
    logProgress('LinkedIn', '='.repeat(50));
    
    // Override CONFIG with parameters
    CONFIG.jobTitle = jobTitle.toLowerCase();
    CONFIG.location = location.toLowerCase();
    CONFIG.searchQuery = `${jobTitle} ${location} c2c contract remote`;  // Display query
    
    const apiClient = getCredentialsAPIClient();
    const maxAttempts = 3;
    let attemptCount = 0;
    let lastError = null;
    
    // Retry loop: Try up to maxAttempts credentials
    while (attemptCount < maxAttempts) {
        attemptCount++;
        
        // Fetch credentials from API with wait-and-retry logic
        logProgress('LinkedIn', `\n🔑 Attempting to fetch credential (attempt ${attemptCount}/${maxAttempts})...`);
        
        let credential = null;
        const maxCredentialRetries = 10; // Wait for credentials up to 10 times
        const credentialRetryDelay = 60000; // 60 seconds between retries
        
        for (let credRetry = 0; credRetry < maxCredentialRetries; credRetry++) {
            credential = await apiClient.getCredential('linkedin', sessionId);
            
            if (credential) {
                // Got a credential, break out of retry loop
                break;
            }
            
            if (credRetry < maxCredentialRetries - 1) {
                logProgress('LinkedIn', `⏳ No credentials available, waiting ${credentialRetryDelay/1000}s before retry ${credRetry + 1}/${maxCredentialRetries}...`);
                await new Promise(resolve => setTimeout(resolve, credentialRetryDelay));
            }
        }
        
        if (!credential) {
            logProgress('LinkedIn', `⚠️  No LinkedIn credentials available after ${maxCredentialRetries} retries`);
            if (lastError) {
                throw lastError;
            }
            throw new Error('No LinkedIn credentials available from API');
        }
        
        // Print credential info (mask password)
        logProgress('LinkedIn', `✅ Credential fetched:`);
        logProgress('LinkedIn', `   📧 Email: ${credential.email}`);
        logProgress('LinkedIn', `   🔒 Password: ${'*'.repeat(credential.password?.length || 8)}`);
        logProgress('LinkedIn', `   🆔 Credential ID: ${credential.id}`);
        
        CONFIG.email = credential.email;
        CONFIG.password = credential.password;
        CONFIG.credentialId = credential.id;
        
        let browser;
        let loginSuccess = false;
    
    try {
        // Connect to existing Chrome
        browser = await connectToChrome();
        
        // Get the default context (user's real browser context)
        const contexts = browser.contexts();
        if (contexts.length === 0) {
            throw new Error('No browser contexts found. Make sure Chrome is running with the debug flag.');
        }
        
        const context = contexts[0];
        const pages = context.pages();
        
        // Use existing page or create new one
        let page;
        if (pages.length > 0) {
            page = pages[0];
            logProgress('LinkedIn', '📄 Using existing tab');
        } else {
            page = await context.newPage();
            logProgress('LinkedIn', '📄 Created new tab');
        }
        
        // Navigate and search
        await navigateToSearch(page, CONFIG.searchQuery);
        
        // Extract posts
        const posts = await extractPosts(page, CONFIG.maxPosts);
        
        // Analyze posts
        const analyzed = await analyzePosts(posts);
        
        logProgress('LinkedIn', '\n✨ Scraping completed successfully!');
        logProgress('LinkedIn', `📊 Found ${analyzed.jobRelated.length} job-related posts`);
        
        // Helper: hash string for fallback jobId
        function hashString(str) {
            let hash = 5381;
            for (let i = 0; i < str.length; i++) {
                hash = ((hash << 5) + hash) + str.charCodeAt(i);
            }
            return 'h' + (hash >>> 0).toString(36);
        }

        // Helper: parse ISO date or return undefined
        function parseISODate(val) {
            if (!val) return undefined;
            // Accept ISO or YYYY-MM-DD
            if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val;
            // Try to parse relative dates (e.g., '2d ago') as today
            if (/ago$/.test(val)) return new Date().toISOString().slice(0, 10);
            return undefined;
        }

        // Helper: Clean text - remove extra whitespace, newlines, special characters
        function cleanText(text) {
            if (!text) return '';
            return text
                .replace(/\s+/g, ' ')  // Replace multiple whitespace with single space
                .replace(/[\r\n\t]/g, ' ')  // Replace newlines and tabs with space
                .replace(/[^\x20-\x7E]/g, '')  // Remove non-printable characters
                .trim();
        }

        const normalizedPosts = analyzed.all.map(post => {
            // Required fields: title, company, location, description, job_url, external_job_id
            
            // Extract clean company name from author (remove LinkedIn badges and extra text)
            let companyName = cleanText(post.author || '');
            
            // Remove LinkedIn badge indicators like "• 1st", "• 2nd", "• 3rd+", "Premium", "Follows"
            companyName = companyName
                .replace(/\s*•\s*(1st|2nd|3rd\+?|Premium|Follows?)\s*/gi, '')
                .replace(/\s+/g, ' ')
                .trim();
            
            // Handle duplicated names (sometimes LinkedIn duplicates the author name)
            // If the name appears twice with possible whitespace between, take only the first occurrence
            const nameParts = companyName.split(/\s+/);
            if (nameParts.length > 2) {
                // Check if first half equals second half (duplicated)
                const mid = Math.floor(nameParts.length / 2);
                const firstHalf = nameParts.slice(0, mid).join(' ');
                const secondHalf = nameParts.slice(mid).join(' ');
                if (firstHalf === secondHalf || secondHalf.startsWith(firstHalf)) {
                    companyName = firstHalf;
                }
            }
            
            // Final cleanup
            companyName = companyName.trim();
            if (!companyName) companyName = 'LinkedIn Post Author';
            
            // Clean title - use first 200 chars of content (not truncated)
            let title = cleanText(post.content || '').substring(0, 200);
            if (!title) title = 'LinkedIn Job Post';
            
            // Clean description
            const desc = cleanText(post.content || '') || 'N/A';
            
            // Job URL - use post URL or author profile as fallback
            const url = (post.postUrl || post.authorProfileUrl || '').trim() || '';
            
            // Generate unique job ID
            let jobId = post.id;
            if (!jobId || typeof jobId !== 'string' || jobId.length > 40) {
                jobId = url ? hashString(url) : hashString(title + companyName + location);
            }
            const postedDate = parseISODate(post.timestamp);

            const jobObj = {
                title,
                company: companyName,
                location: location || '',
                description: desc,
                url,
                jobId,
                postId: post.id,
                activityUrn: post.activityUrn,
                author: post.author,
                authorProfile: post.authorProfileUrl,
                timestamp: post.timestamp,
                engagement: post.engagement,
                isJobRelated: post.isJobRelated
            };
            if (postedDate) jobObj.postedDate = postedDate;
            return normalizeJobData(jobObj, 'LinkedIn');
        });

        // Report success to API
        loginSuccess = true;
        await apiClient.reportSuccess('linkedin', `Scraped ${normalizedPosts.length} posts successfully`);

        return normalizedPosts;
        
    } catch (error) {
        logProgress('LinkedIn', '\n❌ Error: ' + error.message);
        logProgress('LinkedIn', 'Stack trace: ' + error.stack);
        
        lastError = error;
        
        // Report failure to API
        if (!loginSuccess) {
            // Login or authentication failure - try next credential
            if (error.message.includes('Login failed') || error.message.includes('credentials') || error.message.includes('waitForSelector')) {
                logProgress('LinkedIn', '🔄 Login/navigation failed - will try next credential...');
                logProgress('LinkedIn', '📤 Notifying system: WRONG CREDENTIALS (permanent failure)');
                await apiClient.reportFailure('linkedin', `Login failed: ${error.message}`, 0);
            } else if (error.message.includes('rate limit') || error.message.includes('challenge')) {
                logProgress('LinkedIn', '⏳ Rate limited - will try next credential...');
                logProgress('LinkedIn', '📤 Notifying system: RATE LIMIT (60 min cooldown)');
                await apiClient.reportFailure('linkedin', `Rate limited or challenge: ${error.message}`, 60);
            } else {
                // Any other error during login/setup phase - treat as credential failure
                logProgress('LinkedIn', '⚠️  Credential error - will try next credential...');
                logProgress('LinkedIn', `   Error details: ${error.message}`);
                logProgress('LinkedIn', '📤 Notifying system: CREDENTIAL ERROR (permanent failure)');
                await apiClient.reportFailure('linkedin', `Credential error: ${error.message}`, 0);
            }
            // Continue to next credential attempt - no throw, let loop continue
        } else {
            // If login was successful but scraping failed, still try next credential
            logProgress('LinkedIn', '⚠️  Scraping error after login - will try next credential...');
            logProgress('LinkedIn', '📤 Notifying system: SCRAPING ERROR (30 min cooldown)');
            await apiClient.reportFailure('linkedin', `Scraping error: ${error.message}`, 30);
        }
        
    } finally {
        if (browser) {
            logProgress('LinkedIn', '🔌 Closing Chrome browser...');
            try {
                // Get all contexts and close all pages before disconnecting
                const contexts = browser.contexts();
                for (const context of contexts) {
                    await context.close();
                }
                await browser.close();
            } catch (closeError) {
                logProgress('LinkedIn', `⚠️  Error closing browser: ${closeError.message}`);
            }
        }
    }
    } // End of while loop
    
    // If we exhausted all attempts, throw the last error
    logProgress('LinkedIn', `\n❌ All ${maxAttempts} credential attempts failed`);
    throw lastError || new Error('All LinkedIn credential attempts failed');
}


