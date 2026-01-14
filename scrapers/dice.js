// Dice Job Scraper Module
import { chromium } from 'playwright';
import { CheerioCrawler } from 'crawlee';
import * as cheerio from 'cheerio';
import { logProgress, normalizeJobData, stripHtmlTags } from '../common/utils.js';

export async function scrapeDice(jobTitle, location) {
    const encodedJobTitle = encodeURIComponent(jobTitle);
    const encodedLocation = encodeURIComponent(location);

    logProgress('Dice', `Searching for "${jobTitle}" in "${location}"`);

    const browser = await chromium.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    });

    // Step 1: Scrape job URLs from the search page
    const searchUrl = `https://www.dice.com/jobs?q=${encodedJobTitle}&location=${encodedLocation}`;
    const jobUrls = [];
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 }
    });
    const page = await context.newPage();

    const maxPages = 5;
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        const pageUrl = `${searchUrl}&page=${pageNum}`;
        try {
            await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.waitForSelector('body', { timeout: 10000 });

            const links = await page.$$eval('a[href*="/job-detail/"]', anchors => anchors.map(a => a.href));
            jobUrls.push(...links);
            logProgress('Dice', `Page ${pageNum}: Found ${links.length} job URLs`);
        } catch (error) {
            logProgress('Dice', `Error scraping page ${pageNum}: ${error.message}`);
            break;
        }
    }
    jobUrls.splice(0, jobUrls.length, ...new Set(jobUrls)); // Deduplicate
    logProgress('Dice', `Total unique job URLs found: ${jobUrls.length}`);
    await context.close();

    // Limit to 100 jobs
    const maxJobs = 100;
    const jobsToProcess = jobUrls.slice(0, maxJobs);

    const detailedData = [];

    // Create contexts for parallel job scraping
    const jobContexts = [];
    for (let i = 0; i < 5; i++) {
        jobContexts.push(await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 },
            ignoreHTTPSErrors: true,
            bypassCSP: true
        }));
    }
    let jobContextIndex = 0;
    const getJobContext = () => {
        const ctx = jobContexts[jobContextIndex];
        jobContextIndex = (jobContextIndex + 1) % jobContexts.length;
        return ctx;
    };

    // Process jobs in parallel using CheerioCrawler
    const jobCrawler = new CheerioCrawler({
        maxConcurrency: 10,
        maxRequestRetries: 2,
        requestHandlerTimeoutSecs: 180,
        async requestHandler({ $, request }) {
            logProgress('Dice', `Processing job ${request.url}`);
            
            // Use Playwright to load the page with JavaScript execution
            let recruiterName = 'N/A';
            let pageHtml = '';
            const jobContext = getJobContext();
            const jobPage = await jobContext.newPage();
            try {
                await jobPage.goto(request.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                await jobPage.waitForTimeout(2000);
                
                // Extract recruiter name from the loaded page
                const recruiterElement = await jobPage.$('[data-cy="recruiterName"]');
                if (recruiterElement) {
                    recruiterName = (await recruiterElement.textContent()).trim();
                }
                
                // Get the full HTML content after JavaScript execution
                pageHtml = await jobPage.content();
                
                await jobPage.close();
            } catch (error) {
                logProgress('Dice', `Error loading job page with Playwright: ${error.message}`);
                try {
                    await jobPage.close();
                } catch (e) {}
                return; // Skip this job if page load fails
            }
            
            // Parse the HTML with Cheerio
            const $job = cheerio.load(pageHtml);
            
            // Dice now uses structured data (Schema.org JobPosting) instead of __NEXT_DATA__
            const structuredDataScript = $job('script[id="jobDetailStructuredData"]').html();
            if (!structuredDataScript) {
                logProgress('Dice', `❌ No structured data found for ${request.url}`);
                return;
            }
            
            logProgress('Dice', `✓ Found structured data script`);
            
            try {
                const jobData = JSON.parse(structuredDataScript);
                logProgress('Dice', `✓ Parsed JSON successfully`);
                
                if (!jobData || jobData['@type'] !== 'JobPosting') {
                    logProgress('Dice', `❌ Invalid structured data type: ${jobData?.['@type']}`);
                    return;
                }
                
                logProgress('Dice', `✓ Extracted job data: ${jobData.title || 'No title'}`);
                
                // Extract job ID from identifier or URL
                const jobId = jobData.identifier?.value || request.url.split('/').pop();
                
                // Extract location from jobLocation
                const location = jobData.jobLocation?.address 
                    ? `${jobData.jobLocation.address.addressLocality}, ${jobData.jobLocation.address.addressRegion}`
                    : 'N/A';
                
                // Extract salary
                let salaryMin = null, salaryMax = null, salaryCurrency = 'USD';
                if (jobData.baseSalary) {
                    if (jobData.baseSalary.value) {
                        // Single value (could be hourly or yearly)
                        salaryMin = jobData.baseSalary.value.minValue || jobData.baseSalary.value;
                        salaryMax = jobData.baseSalary.value.maxValue;
                    }
                    salaryCurrency = jobData.baseSalary.currency || 'USD';
                }
                
                // Extract employment type
                const employmentTypeMap = {
                    'FULL_TIME': 'full_time',
                    'PART_TIME': 'part_time',
                    'CONTRACTOR': 'contract',
                    'TEMPORARY': 'temporary',
                    'INTERN': 'internship'
                };
                const employmentType = employmentTypeMap[jobData.employmentType] || jobData.employmentType?.toLowerCase();
                
                // Company name
                const companyName = jobData.hiringOrganization?.name || 'N/A';
                
                // Description (strip HTML)
                const description = stripHtmlTags(jobData.description || '');
                
                // Posted date
                const postedDate = jobData.datePosted ? new Date(jobData.datePosted).toISOString().split('T')[0] : null;

                const normalizedJob = normalizeJobData({
                    id: jobId,
                    title: jobData.title,
                    company: companyName,
                    location: location,
                    salary_min: salaryMin,
                    salary_max: salaryMax,
                    salary_currency: salaryCurrency,
                    postedDate: postedDate,
                    description: description,
                    employmentType: employmentType,
                    url: jobData.url || request.url,
                    recruiter: { name: recruiterName }
                }, 'Dice');

                detailedData.push(normalizedJob);
                logProgress('Dice', `✅ Job saved: ${jobData.title} at ${companyName} (Total: ${detailedData.length})`);
            } catch (e) {
                logProgress('Dice', `❌ Error parsing job JSON for ${request.url}: ${e.message}`);
                logProgress('Dice', `Stack trace: ${e.stack}`);
            }
        }
    });

    await jobCrawler.run(jobsToProcess.map(url => ({ url })));

    logProgress('Dice', `Crawler finished. Jobs in detailedData array: ${detailedData.length}`);
    
    // Close all contexts
    for (const ctx of jobContexts) {
        await ctx.close();
    }
    await browser.close();

    logProgress('Dice', `Completed! Saved ${detailedData.length} detailed jobs`);
    return detailedData;
}
