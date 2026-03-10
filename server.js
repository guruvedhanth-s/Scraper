// Unified Job Scraper API Server
import express from 'express';
import fs from 'fs';
import path from 'path';
import { scrapeMonster } from './scrapers/monster.js';
import { scrapeDice } from './scrapers/dice.js';
import { scrapeTechFetch } from './scrapers/techfetch.js';
import { scrapeLinkedIn } from './scrapers/linkedin.js';
import { scrapeGlassdoor } from './scrapers/glassdoor.js';
import { initializeCredentialsAPI } from './common/credentialsAPI.js';
import { 
    sanitizeFilename, 
    generateTimestamp, 
    handleError,
    checkActiveSession,
    getNextRoleLocation,
    submitJobs,
    completeSession,
    formatJobForBlacklight
} from './common/utils.js';

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());

// Load credentials
let credentials = {};
try {
    const credentialsPath = path.join(process.cwd(), 'config', 'credentials.json');
    credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));
    console.log('✓ Credentials loaded successfully');
    
    // Initialize Credential API Client
    if (process.env.NODE_ENV === 'development') {
        // In development mode, skip remote API and use local credentials from credentials.json
        initializeCredentialsAPI(null, null);
        console.log('✓ Credentials: using LOCAL credentials (development mode)');
    } else if (credentials.scraperCredentials && credentials.scraperCredentials.apiUrl && credentials.scraperCredentials.apiKey) {
        initializeCredentialsAPI(
            credentials.scraperCredentials.apiUrl,
            credentials.scraperCredentials.apiKey
        );
        console.log('✓ Scraper Credentials API client initialized');
    } else {
        console.warn('⚠️  Warning: scraperCredentials configuration missing in credentials.json');
    }
} catch (error) {
    console.warn('⚠️  Warning: Could not load credentials.json. Some features may not work.');
}

// Platform scraper mapping
const SCRAPERS = {
    monster: scrapeMonster,
    dice: scrapeDice,
    techfetch: scrapeTechFetch,
    linkedin: scrapeLinkedIn,
    glassdoor: scrapeGlassdoor
};

// Available platforms
const PLATFORMS = Object.keys(SCRAPERS);

// Blacklight Scraper Queue orchestrator
async function runBlacklightQueue() {
    const blacklightConfig = credentials.blacklight;
    
    if (!blacklightConfig || !blacklightConfig.apiUrl || !blacklightConfig.apiKey) {
        throw new Error('Blacklight API configuration missing in credentials.json');
    }
    
    const { apiUrl, apiKey } = blacklightConfig;
    
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🔄 Starting Blacklight Scraper Queue Workflow`);
    console.log(`${'='.repeat(70)}\n`);
    
    // Step 1: Check for active session
    console.log('📋 Step 1: Checking for active session...');
    const sessionCheck = await checkActiveSession(apiUrl, apiKey);
    
    if (sessionCheck.has_active_session) {
        console.log('⚠️  Active session found. Resuming session:');
        console.log(`   Session ID: ${sessionCheck.session.session_id}`);
        console.log(`   Role: ${sessionCheck.session.role_name}`);
        console.log(`   Location: ${sessionCheck.session.location}`);
        console.log(`   Progress: ${sessionCheck.session.platforms_completed}/${sessionCheck.session.platforms_total}`);
        return { error: 'Active session already exists. Complete it first.' };
    }
    
    console.log('✓ No active session found\n');
    
    // Step 2: Get next role+location from queue
    console.log('📋 Step 2: Fetching next role+location from queue...');
    const queueItem = await getNextRoleLocation(apiUrl, apiKey);
    
    if (!queueItem) {
        console.log('ℹ️  Queue is empty. No jobs to scrape.\n');
        return { message: 'Queue is empty' };
    }
    
    const { session_id, role, location, platforms } = queueItem;
    
    console.log('✓ Queue item retrieved:');
    console.log(`   Session ID: ${session_id}`);
    console.log(`   Role: ${role.name}`);
    console.log(`   Aliases: ${role.aliases.join(', ')}`);
    console.log(`   Location: ${location}`);
    console.log(`   Platforms: ${platforms.map(p => p.display_name).join(', ')}`);
    console.log(`   Candidates waiting: ${role.candidate_count}\n`);
    
    const results = {
        session_id,
        role: role.name,
        location,
        platforms: {},
        summary: {
            total_platforms: platforms.length,
            successful: 0,
            failed: 0
        }
    };
    
    // Step 3: Scrape each platform
    console.log(`📋 Step 3: Scraping ${platforms.length} platforms...\n`);
    
    for (const platformInfo of platforms) {
        const platformName = platformInfo.name.toLowerCase();
        const scraper = SCRAPERS[platformName];
        
        if (!scraper) {
            console.log(`⚠️  Skipping unknown platform: ${platformName}`);
            await submitJobs(apiUrl, apiKey, session_id, platformName, [], 'failed', `Platform not supported: ${platformName}`);
            results.platforms[platformName] = { success: false, error: 'Platform not supported' };
            results.summary.failed++;
            continue;
        }
        
        try {
            console.log(`\n--- Starting ${platformInfo.display_name} scraper ---`);
            console.log(`   Searching for: ${role.name}`);
            console.log(`   Location: ${location}`);
            
            // Scrape jobs using role name, location, and session_id for credential tracking
            const jobs = await scraper(role.name, location, session_id);
            
            console.log(`✓ ${platformInfo.display_name} scraping completed: ${jobs.length} jobs found`);
            
            // Format jobs for Blacklight API
            const formattedJobs = jobs.map(job => formatJobForBlacklight(job, platformName));
            
            // Debug: Log first job for inspection
            if (formattedJobs.length > 0) {
                console.log(`   Sample formatted job:`, JSON.stringify(formattedJobs[0], null, 2));
            }
            
            // Submit jobs to Blacklight API
            console.log(`📤 Submitting ${formattedJobs.length} jobs to Blacklight API...`);
            const submitResponse = await submitJobs(apiUrl, apiKey, session_id, platformName, formattedJobs, 'success');
            
            console.log(`✓ Jobs submitted successfully`);
            console.log(`   Progress: ${submitResponse.progress.completed}/${submitResponse.progress.total_platforms} platforms completed`);
            
            results.platforms[platformName] = {
                success: true,
                jobs_found: jobs.length,
                jobs_submitted: formattedJobs.length
            };
            results.summary.successful++;
            
        } catch (error) {
            console.error(`✗ ${platformInfo.display_name} failed: ${error.message}`);
            
            // Report failure to Blacklight API
            try {
                await submitJobs(apiUrl, apiKey, session_id, platformName, [], 'failed', error.message);
            } catch (submitError) {
                console.error(`   Failed to report error to API: ${submitError.message}`);
            }
            
            results.platforms[platformName] = {
                success: false,
                error: error.message
            };
            results.summary.failed++;
        }
    }
    
    // Step 4: Complete the session
    console.log(`\n📋 Step 4: Completing session...`);
    
    try {
        const completionResponse = await completeSession(apiUrl, apiKey, session_id);
        
        console.log(`\n${'='.repeat(70)}`);
        console.log(`✓ Session Completed Successfully!`);
        console.log(`${'='.repeat(70)}`);
        console.log(`Role: ${completionResponse.role_name}`);
        console.log(`Location: ${completionResponse.location}`);
        console.log(`Duration: ${completionResponse.duration_seconds}s`);
        console.log(`Platforms: ${completionResponse.summary.successful_platforms}/${completionResponse.summary.total_platforms} successful`);
        console.log(`Jobs Found: ${completionResponse.jobs.total_found}`);
        console.log(`Jobs Imported: ${completionResponse.jobs.total_imported}`);
        console.log(`Jobs Skipped: ${completionResponse.jobs.total_skipped}`);
        console.log(`Matching Triggered: ${completionResponse.matching_triggered ? 'Yes' : 'No'}`);
        console.log(`${'='.repeat(70)}\n`);
        
        results.completion = completionResponse;
        
    } catch (error) {
        console.error(`✗ Failed to complete session: ${error.message}`);
        results.completion_error = error.message;
    }
    
    return results;
}

// Main scraping function
async function scrapeJobs(platforms, jobTitle, location, sessionId = null, saveIncrementally = true) {
    const results = {
        timestamp: new Date().toISOString(),
        jobTitle,
        location,
        platforms: {}
    };

    const platformsToScrape = platforms.includes('all') ? PLATFORMS : platforms;
    const baseTimestamp = generateTimestamp(); // Single timestamp for all platform files
    const savedFiles = [];

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Starting job scraping`);
    console.log(`Job Title: "${jobTitle}"`);
    console.log(`Location: "${location}"`);
    console.log(`Platforms: ${platformsToScrape.join(', ')}`);
    console.log(`Incremental Save: ${saveIncrementally ? 'Enabled' : 'Disabled'}`);
    if (sessionId) console.log(`Session ID: ${sessionId}`);
    console.log(`${'='.repeat(60)}\n`);

    // Scrape each platform sequentially to avoid resource conflicts
    for (const platform of platformsToScrape) {
        const scraper = SCRAPERS[platform];
        
        if (!scraper) {
            console.log(`⚠️  Unknown platform: ${platform}`);
            continue;
        }

        try {
            console.log(`\n--- Starting ${platform.toUpperCase()} scraper ---`);
            
            // Pass sessionId for credential API tracking
            const jobs = await scraper(jobTitle, location, sessionId);
            
            results.platforms[platform] = {
                success: true,
                count: jobs.length,
                jobs: jobs
            };

            console.log(`✓ ${platform.toUpperCase()} completed: ${jobs.length} jobs found`);

            // Save individual platform results immediately
            if (saveIncrementally) {
                const filename = savePlatformResults(platform, results.platforms[platform], jobTitle, location, baseTimestamp);
                savedFiles.push(filename);
            }
        } catch (error) {
            console.error(`✗ ${platform.toUpperCase()} failed: ${error.message}`);
            results.platforms[platform] = handleError(platform, error);

            // Save individual platform results even after failures
            if (saveIncrementally) {
                const filename = savePlatformResults(platform, results.platforms[platform], jobTitle, location, baseTimestamp);
                savedFiles.push(filename);
            }
        }
    }

    // Calculate final totals
    const totalJobs = Object.values(results.platforms)
        .filter(p => p.success)
        .reduce((sum, p) => sum + p.count, 0);

    results.summary = {
        totalPlatforms: platformsToScrape.length,
        completedPlatforms: Object.keys(results.platforms).length,
        successfulPlatforms: Object.values(results.platforms).filter(p => p.success).length,
        failedPlatforms: Object.values(results.platforms).filter(p => !p.success).length,
        totalJobs: totalJobs,
        status: 'completed',
        savedFiles: savedFiles
    };

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Scraping Complete!`);
    console.log(`Total jobs found: ${totalJobs}`);
    console.log(`Successful platforms: ${results.summary.successfulPlatforms}/${results.summary.totalPlatforms}`);
    console.log(`Files saved: ${savedFiles.length}`);
    console.log(`${'='.repeat(60)}\n`);

    return results;
}

// Save results to file
function saveResults(results, jobTitle, location, platforms) {
    const sanitizedJobTitle = sanitizeFilename(jobTitle);
    const sanitizedLocation = sanitizeFilename(location);
    const platformsStr = platforms.includes('all') ? 'all' : platforms.join('-');
    const timestamp = generateTimestamp();
    
    const filename = `unified_${sanitizedJobTitle}_${sanitizedLocation}_${platformsStr}_${timestamp}.json`;
    const filepath = path.join(process.cwd(), 'results', filename);
    
    fs.writeFileSync(filepath, JSON.stringify(results, null, 2));
    console.log(`📁 Results saved to: ${filename}`);
    
    return filename;
}

// Save individual platform results to a separate file
function savePlatformResults(platformName, platformData, jobTitle, location, timestamp) {
    const sanitizedJobTitle = sanitizeFilename(jobTitle);
    const sanitizedLocation = sanitizeFilename(location);
    
    const filename = `${platformName}_${sanitizedJobTitle}_${sanitizedLocation}_${timestamp}.json`;
    const filepath = path.join(process.cwd(), 'results', filename);
    
    const platformResults = {
        timestamp: new Date().toISOString(),
        platform: platformName,
        jobTitle,
        location,
        ...platformData
    };
    
    fs.writeFileSync(filepath, JSON.stringify(platformResults, null, 2));
    console.log(`📁 Platform results saved to: ${filename}`);
    
    return filename;
}

// POST /scrape endpoint
app.post('/scrape', async (req, res) => {
    try {
        const { platform, jobTitle, location } = req.body;

        // Validation
        if (!platform) {
            return res.status(400).json({
                error: 'Missing required parameter: platform',
                usage: 'Platform can be: ' + PLATFORMS.join(', ') + ', or "all"'
            });
        }

        if (!jobTitle || location === undefined || location === null) {
            return res.status(400).json({
                error: 'Missing required parameters: jobTitle and/or location'
            });
        }

        // Parse platforms
        let platforms = [];
        if (typeof platform === 'string') {
            platforms = platform.toLowerCase() === 'all' 
                ? ['all'] 
                : platform.split(',').map(p => p.trim().toLowerCase());
        } else if (Array.isArray(platform)) {
            platforms = platform.map(p => p.toLowerCase());
        }

        // Validate platforms
        const invalidPlatforms = platforms.filter(p => 
            p !== 'all' && !PLATFORMS.includes(p)
        );

        if (invalidPlatforms.length > 0) {
            return res.status(400).json({
                error: `Invalid platform(s): ${invalidPlatforms.join(', ')}`,
                validPlatforms: PLATFORMS,
                hint: 'Use "all" to scrape all platforms'
            });
        }

        // Start scraping
        console.log(`\n📥 Received scraping request`);
        console.log(`   Platform: ${platform}`);
        console.log(`   Job Title: ${jobTitle}`);
        console.log(`   Location: ${location}`);

        const results = await scrapeJobs(platforms, jobTitle, location, null, true);

        res.json({
            success: true,
            message: 'Scraping completed',
            summary: results.summary,
            results: results
        });

    } catch (error) {
        console.error('❌ Server error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// POST /scrape-queue - Blacklight Scraper Queue workflow
app.post('/scrape-queue', async (req, res) => {
    try {
        console.log('\n📥 Received Blacklight Queue request');
        
        const results = await runBlacklightQueue();
        
        if (results.error) {
            return res.status(409).json({
                success: false,
                error: results.error
            });
        }
        
        if (results.message) {
            return res.status(200).json({
                success: true,
                message: results.message
            });
        }
        
        res.json({
            success: true,
            message: 'Blacklight queue workflow completed',
            results
        });
        
    } catch (error) {
        console.error('❌ Blacklight queue error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// GET / - Health check and usage info
app.get('/', (req, res) => {
    res.json({
        status: 'Unified Job Scraper API is running',
        version: '1.0.0',
        availablePlatforms: PLATFORMS,
        endpoints: {
            scrape: {
                method: 'POST',
                path: '/scrape',
                description: 'Manual scraping - specify platform, job title, and location. Credentials are fetched automatically from API.',
                body: {
                    platform: 'string or array (e.g., "dice", "monster,dice", ["dice", "monster"], or "all")',
                    jobTitle: 'string (e.g., "DevOps Engineer")',
                    location: 'string (e.g., "california", "New York")'
                }
            },
            scrapeQueue: {
                method: 'POST',
                path: '/scrape-queue',
                description: 'Blacklight Scraper Queue - automatically gets next role+location from queue',
                body: 'No body required - uses Blacklight API configuration from credentials.json'
            }
        },
        examples: [
            {
                description: 'Single platform',
                curl: `curl -X POST http://localhost:${PORT}/scrape -H "Content-Type: application/json" -d '{"platform":"monster","jobTitle":"DevOps Engineer","location":"california"}'`
            },
            {
                description: 'Multiple platforms',
                curl: `curl -X POST http://localhost:${PORT}/scrape -H "Content-Type: application/json" -d '{"platform":"monster,dice","jobTitle":"Software Engineer","location":"New York"}'`
            },
            {
                description: 'All platforms',
                curl: `curl -X POST http://localhost:${PORT}/scrape -H "Content-Type: application/json" -d '{"platform":"all","jobTitle":"DevOps Engineer","location":"us"}'`
            },
            {
                description: 'Blacklight Queue - Automated workflow',
                curl: `curl -X POST http://localhost:${PORT}/scrape-queue`
            }
        ]
    });
});

// Auto queue checker
let isProcessingQueue = false;
let queueCheckInterval = null;

async function autoCheckQueue() {
    // Skip if already processing
    if (isProcessingQueue) {
        console.log('⏭️  Skipping queue check - already processing a job');
        return;
    }

    // Check if Blacklight is configured
    if (!credentials.blacklight || !credentials.blacklight.apiUrl || !credentials.blacklight.apiKey) {
        console.log('⚠️  Blacklight API not configured. Skipping auto queue check.');
        return;
    }

    try {
        isProcessingQueue = true;
        console.log(`\n⏰ [${new Date().toLocaleTimeString()}] Auto-checking Blacklight queue...`);
        
        const results = await runBlacklightQueue();
        
        if (results.error) {
            console.log(`ℹ️  ${results.error}`);
        } else if (results.message) {
            console.log(`ℹ️  ${results.message}`);
        } else {
            console.log(`✅ Queue job completed successfully`);
        }
        
    } catch (error) {
        console.error(`❌ Auto queue check error: ${error.message}`);
    } finally {
        isProcessingQueue = false;
    }
}

function startAutoQueueChecker() {
    // Skip auto queue checker in local development
    if (process.env.NODE_ENV === 'development') {
        console.log('\n⚠️  Auto Queue Checker: DISABLED (development mode)');
        console.log('   Set NODE_ENV=production or use "npm start" to enable.\n');
        return;
    }

    // Check if Blacklight is configured
    if (!credentials.blacklight || !credentials.blacklight.apiUrl || !credentials.blacklight.apiKey) {
        console.log('\n⚠️  Blacklight API not configured. Auto queue checking disabled.');
        console.log('   Configure "blacklight" section in credentials.json to enable.\n');
        return;
    }

    console.log('\n🔄 Auto Queue Checker: ENABLED');
    console.log('   Checking queue every 30 seconds...\n');

    // Check immediately on startup
    setTimeout(() => autoCheckQueue(), 5000); // Wait 5 seconds after startup

    // Then check every 30 seconds
    queueCheckInterval = setInterval(autoCheckQueue, 30000);
}

function stopAutoQueueChecker() {
    if (queueCheckInterval) {
        clearInterval(queueCheckInterval);
        queueCheckInterval = null;
        console.log('\n🛑 Auto Queue Checker: STOPPED\n');
    }
}

// Start server
app.listen(PORT, () => {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`  🚀 Unified Job Scraper API Server`);
    console.log(`  📡 Running on: http://localhost:${PORT}`);
    console.log(`  📋 Available Platforms: ${PLATFORMS.join(', ')}`);
    console.log(`${'='.repeat(70)}\n`);
    console.log(`Usage Examples:\n`);
    console.log(`  Single platform:`);
    console.log(`  curl -X POST http://localhost:${PORT}/scrape \\`);
    console.log(`    -H "Content-Type: application/json" \\`);
    console.log(`    -d '{"platform":"monster","jobTitle":"DevOps","location":"california"}'\n`);
    console.log(`  Multiple platforms:`);
    console.log(`  curl -X POST http://localhost:${PORT}/scrape \\`);
    console.log(`    -H "Content-Type: application/json" \\`);
    console.log(`    -d '{"platform":"monster,dice","jobTitle":"DevOps","location":"california"}'\n`);
    console.log(`  All platforms:`);
    console.log(`  curl -X POST http://localhost:${PORT}/scrape \\`);
    console.log(`    -H "Content-Type: application/json" \\`);
    console.log(`    -d '{"platform":"all","jobTitle":"DevOps","location":"us"}'\n`);
    
    // Start auto queue checker
    startAutoQueueChecker();
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n🛑 Shutting down gracefully...');
    stopAutoQueueChecker();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n\n🛑 Shutting down gracefully...');
    stopAutoQueueChecker();
    process.exit(0);
});
