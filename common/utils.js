// Common utility functions for all scrapers
import https from 'https';

// Create an HTTPS agent that ignores certificate errors (for development/self-signed certs)
const httpsAgent = new https.Agent({
    rejectUnauthorized: false // WARNING: Only use in development or with trusted self-signed certs
});

export function sanitizeFilename(text) {
    return text.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

export function generateTimestamp() {
    return new Date().toISOString().replace(/[:.]/g, '-');
}

export function humanDelay(min = 1000, max = 3000) {
    return new Promise(resolve => 
        setTimeout(resolve, Math.floor(Math.random() * (max - min + 1)) + min)
    );
}

export function stripHtmlTags(html) {
    if (!html || typeof html !== 'string') return html;
    
    // Remove HTML tags
    let text = html.replace(/<[^>]*>/g, '');
    
    // Decode common HTML entities
    const entities = {
        '&nbsp;': ' ',
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&#39;': "'",
        '&apos;': "'",
        '&mdash;': '-',
        '&ndash;': '-',
        '&bull;': '*',
        '&hellip;': '...',
        '&lsquo;': "'",
        '&rsquo;': "'",
        '&ldquo;': '"',
        '&rdquo;': '"'
    };
    
    for (const [entity, char] of Object.entries(entities)) {
        text = text.replace(new RegExp(entity, 'g'), char);
    }
    
    // Decode numeric entities
    text = text.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
    text = text.replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
    
    // Clean up whitespace
    text = text.replace(/\s+/g, ' ').trim();
    
    return text;
}

/**
 * Normalizes job data from different platforms into a unified master schema
 * @param {Object} job - Raw job data from platform scraper
 * @param {string} platform - Platform name (dice, monster, techfetch, linkedin, glassdoor)
 * @returns {Object} Normalized job data conforming to master schema
 */
export function normalizeJobData(job, platform) {
    // Helper to parse skills from string or array
    const parseSkills = (skills) => {
        if (!skills) return [];
        if (Array.isArray(skills)) return skills.filter(s => s && s.trim());
        if (typeof skills === 'string') {
            return skills.split(',').map(s => s.trim()).filter(s => s);
        }
        return [];
    };

    // Helper to parse work authorization
    const parseWorkAuth = (workAuth) => {
        if (!workAuth) return [];
        if (Array.isArray(workAuth)) return workAuth;
        if (typeof workAuth === 'string') {
            return workAuth.split(',').map(s => s.trim()).filter(s => s && s !== 'N/A');
        }
        return [];
    };

    // Helper to parse preferred employment
    const parseEmployment = (employment) => {
        if (!employment) return [];
        if (Array.isArray(employment)) return employment;
        if (typeof employment === 'string') {
            return employment.split(',').map(s => s.trim()).filter(s => s && s !== 'N/A');
        }
        return [];
    };

    const normalized = {
        // Metadata section
        _metadata: {
            platform: platform.toLowerCase(),
            extractedAt: new Date().toISOString(),
            scraperId: `${platform}-${Date.now()}`
        },

        // Core job information
        job: {
            title: job.title || job.jobTitle || 'N/A',
            description: job.description || 'N/A',
            url: job.url || job.jobUrl || job.jobLink || 'N/A',
            applyUrl: job.applyUrl || job.url || job.jobUrl || job.jobLink || 'N/A',
            postedDate: job.postedDate || job.datePosted || job.createdDate || 'N/A'
        },

        // Company information
        company: {
            name: job.company || job.hiringOrganization || 'N/A',
            rating: job.rating || job.companyRating || null,
            about: job.companyData?.about || null,
            website: job.companyData?.website || null,
            headquarters: job.companyData?.headquarters || null,
            employeesCount: job.companyData?.employeesCount || null,
            foundedYear: job.companyData?.foundedYear || null,
            techStacks: job.companyData?.techStacks || []
        },

        // Location information
        location: {
            formatted: job.location || job.jobLocation || 'N/A',
            city: null,  // Could be parsed from formatted
            state: null,
            country: null,
            remote: job.location?.toLowerCase().includes('remote') || false,
            companyLocation: job.companyLocation || null
        },

        // Compensation details
        compensation: {
            salary: job.salary || job.rate || job.salaryEstimate || job.compensationDetail || 'N/A',
            salaryMin: null,  // Could be parsed from salary string
            salaryMax: null,
            currency: 'USD',
            period: null  // Could be parsed from salary string
        },

        // Employment details
        employment: {
            type: job.employmentType || 'N/A',
            duration: job.duration || null,
            workAuthorization: parseWorkAuth(job.workAuthorization),
            preferredEmployment: parseEmployment(job.preferredEmployment),
            easyApply: job.easyApply || false
        },

        // Experience and skills
        experience: {
            level: job.experienceLevel || null,
            yearsRequired: job.experienceRequired || null,
            requiredSkills: parseSkills(job.skills || job.requiredSkills),
            preferredSkills: parseSkills(job.preferredSkills),
            specialArea: job.specialArea || null,
            domain: job.domain || null
        },

        // Recruiter information (mainly for Dice)
        recruiter: job.recruiter ? {
            name: job.recruiter.name || job.recruiter,
            company: job.recruiter.company || null,
            contact: job.recruiter.contact || null
        } : null,

        // Social media data (mainly for LinkedIn)
        social: job.postId || job.activityUrn ? {
            postId: job.postId || null,
            activityUrn: job.activityUrn || null,
            author: job.author || job.authorName || null,
            authorProfile: job.authorProfile || job.authorUrl || null,
            timestamp: job.timestamp || job.postTime || null,
            engagement: job.engagement || null,
            isJobRelated: job.isJobRelated !== undefined ? job.isJobRelated : null
        } : null
    };

    // Remove null sections to keep output clean
    if (!normalized.recruiter) delete normalized.recruiter;
    if (!normalized.social) delete normalized.social;
    if (normalized.company.techStacks.length === 0) delete normalized.company.techStacks;
    if (normalized.employment.workAuthorization.length === 0) delete normalized.employment.workAuthorization;
    if (normalized.employment.preferredEmployment.length === 0) delete normalized.employment.preferredEmployment;
    if (normalized.experience.requiredSkills.length === 0) delete normalized.experience.requiredSkills;
    if (normalized.experience.preferredSkills.length === 0) delete normalized.experience.preferredSkills;

    return normalized;
}

export function logProgress(platform, message) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] [${platform.toUpperCase()}] ${message}`);
}

export function handleError(platform, error) {
    console.error(`[${platform.toUpperCase()}] Error: ${error.message}`);
    return {
        success: false,
        platform: platform,
        error: error.message,
        timestamp: new Date().toISOString()
    };
}

// Blacklight Scraper Queue API utilities
const RETRY_DELAYS = [1000, 2000, 5000, 10000, 30000]; // milliseconds

export async function makeApiRequest(url, options = {}, retries = 5) {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            // Add HTTPS agent to bypass certificate validation if URL uses HTTPS
            const fetchOptions = { ...options };
            if (url.startsWith('https://')) {
                fetchOptions.agent = httpsAgent;
            }
            
            const response = await fetch(url, fetchOptions);
            
            // Handle rate limiting
            if (response.status === 429) {
                const delay = RETRY_DELAYS[attempt] || 30000;
                console.warn(`⚠️  Rate limited. Retrying in ${delay / 1000}s... (attempt ${attempt + 1}/${retries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            
            // Handle server errors
            if (response.status >= 500) {
                const delay = RETRY_DELAYS[attempt] || 30000;
                console.warn(`⚠️  Server error (${response.status}). Retrying in ${delay / 1000}s... (attempt ${attempt + 1}/${retries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            
            // Return response for caller to handle
            return response;
            
        } catch (error) {
            if (attempt === retries - 1) {
                // Log full error details on final attempt
                console.error(`❌ Final attempt failed (${attempt + 1}/${retries}):`);
                console.error(`   Error Type: ${error.constructor.name}`);
                console.error(`   Error Message: ${error.message}`);
                console.error(`   Error Code: ${error.code || 'N/A'}`);
                console.error(`   URL: ${url}`);
                if (error.cause) {
                    console.error(`   Cause: ${error.cause}`);
                }
                console.error(`   Stack: ${error.stack}`);
                throw error;
            }
            const delay = RETRY_DELAYS[attempt] || 30000;
            console.warn(`⚠️  Request failed: ${error.message}. Retrying in ${delay / 1000}s... (attempt ${attempt + 1}/${retries})`);
            console.warn(`   Error details: ${error.code || 'N/A'} | URL: ${url}`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    throw new Error('Max retries exceeded');
}

export async function checkActiveSession(apiUrl, apiKey) {
    const url = `${apiUrl}/api/scraper/queue/current-session`;
    const response = await makeApiRequest(url, {
        method: 'GET',
        headers: {
            'X-Scraper-API-Key': apiKey
        }
    });
    
    if (response.ok) {
        return await response.json();
    }
    
    throw new Error(`Failed to check active session: ${response.status} ${response.statusText}`);
}

export async function getNextRoleLocation(apiUrl, apiKey) {
    const url = `${apiUrl}/api/scraper/queue/next-role-location`;
    const response = await makeApiRequest(url, {
        method: 'GET',
        headers: {
            'X-Scraper-API-Key': apiKey
        }
    });
    
    if (response.status === 204) {
        return null; // Queue is empty
    }
    
    if (response.status === 409) {
        throw new Error('Scraper already has an active session');
    }
    
    if (response.ok) {
        return await response.json();
    }
    
    throw new Error(`Failed to get next role+location: ${response.status} ${response.statusText}`);
}

export async function submitJobs(apiUrl, apiKey, sessionId, platform, jobs, status = 'success', errorMessage = null) {
    const url = `${apiUrl}/api/scraper/queue/jobs`;
    const body = {
        session_id: sessionId,
        platform: platform,
        jobs: jobs
    };
    
    if (status === 'failed') {
        body.status = 'failed';
        body.error_message = errorMessage;
    }
    
    const response = await makeApiRequest(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Scraper-API-Key': apiKey
        },
        body: JSON.stringify(body)
    });
    
    if (response.status === 202 || response.ok) {
        return await response.json();
    }
    
    throw new Error(`Failed to submit jobs: ${response.status} ${response.statusText}`);
}

export async function completeSession(apiUrl, apiKey, sessionId) {
    const url = `${apiUrl}/api/scraper/queue/complete`;
    const response = await makeApiRequest(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Scraper-API-Key': apiKey
        },
        body: JSON.stringify({ session_id: sessionId })
    });
    
    if (response.ok) {
        return await response.json();
    }
    
    throw new Error(`Failed to complete session: ${response.status} ${response.statusText}`);
}

export function formatJobForBlacklight(job, platform) {
    // Handle both nested (job.job.field) and flat (job.field) structures
    const jobData = job.job || job;
    const companyData = job.company || {};
    const locationData = job.location || {};
    const compensationData = job.compensation || {};
    const employmentData = job.employment || {};
    const experienceData = job.experience || {};
    
    // Extract platform_job_id (required by API)
    let platform_job_id = null;
    
    // Try jobId first
    if (jobData.jobId && jobData.jobId !== 'N/A' && typeof jobData.jobId === 'string') {
        platform_job_id = jobData.jobId;
    }
    // Try postId
    else if (jobData.postId && jobData.postId !== 'N/A' && typeof jobData.postId === 'string') {
        platform_job_id = jobData.postId;
    }
    // Try id
    else if (jobData.id && jobData.id !== 'N/A' && typeof jobData.id === 'string') {
        platform_job_id = jobData.id;
    }
    // Try flat-level fields
    else if (job.jobId && job.jobId !== 'N/A' && typeof job.jobId === 'string') {
        platform_job_id = job.jobId;
    }
    else if (job.postId && job.postId !== 'N/A' && typeof job.postId === 'string') {
        platform_job_id = job.postId;
    }
    else if (job.id && job.id !== 'N/A' && typeof job.id === 'string') {
        platform_job_id = job.id;
    }
    
    // If still no id, hash the URL
    if (!platform_job_id) {
        const url = jobData.url || jobData.applyUrl || job.url || job.applyUrl || '';
        if (url && url !== 'N/A' && typeof url === 'string') {
            platform_job_id = hashString(url);
        }
    }
    
    // Last resort: generate random ID
    if (!platform_job_id) {
        platform_job_id = `${platform}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    // Extract required fields
    const title = jobData.title || job.title || 'N/A';
    const description = jobData.description || job.description || '';
    const url = jobData.url || jobData.applyUrl || job.url || job.applyUrl || '';
    
    // Extract company (can be string or object)
    let company = companyData.name || job.company || 'N/A';
    if (typeof company === 'object' && company.name) {
        company = company.name;
    }
    
    // Extract location (can be string or object)
    let location = locationData.formatted || job.location || 'N/A';
    if (typeof location === 'object' && location.formatted) {
        location = location.formatted;
    }
    
    // Build base object with required fields per API spec
    const formatted = {
        platform_job_id,  // Required
        title,            // Required
        company,          // Required
        location,         // Required
        description,      // Required
        url               // Required
    };
    
    // Add optional fields only if they have valid values
    
    // Salary fields
    const salaryMin = compensationData.salaryMin || job.salary_min || job.salaryMin || null;
    const salaryMax = compensationData.salaryMax || job.salary_max || job.salaryMax || null;
    const salaryCurrency = compensationData.currency || job.salary_currency || 'USD';
    
    if (salaryMin) formatted.salary_min = parseInt(salaryMin);
    if (salaryMax) formatted.salary_max = parseInt(salaryMax);
    if (salaryCurrency && salaryCurrency !== 'N/A') formatted.salary_currency = salaryCurrency;
    
    // Job type
    const jobType = employmentData.type || job.job_type || job.jobType || job.employmentType || null;
    if (jobType && jobType !== 'N/A') formatted.job_type = jobType.toLowerCase().replace(/[\s-]/g, '_');
    
    // Experience level
    const experienceLevel = experienceData.level || job.experience_level || job.experienceLevel || null;
    if (experienceLevel && experienceLevel !== 'N/A') formatted.experience_level = experienceLevel.toLowerCase();
    
    // Posted date - only include if valid ISO format (YYYY-MM-DD)
    let postedDate = jobData.postedDate || job.posted_date || job.postedDate || null;
    if (postedDate && /^\d{4}-\d{2}-\d{2}/.test(postedDate)) {
        // Extract just the date part if it's a full ISO timestamp
        formatted.posted_date = postedDate.split('T')[0];
    }
    
    // Remote flag
    const isRemote = locationData.remote || job.is_remote || job.isRemote || 
                     (typeof location === 'string' && location.toLowerCase().includes('remote')) || false;
    if (isRemote === true) formatted.is_remote = true;
    
    return formatted;
}

// Simple hash function for string (djb2)
function hashString(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
    }
    return 'h' + (hash >>> 0).toString(36);
}

