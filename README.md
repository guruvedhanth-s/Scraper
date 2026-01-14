# Unified Job Scraper

A powerful Node.js-based job scraping system that automatically collects job postings from multiple platforms (Monster, Dice, TechFetch, LinkedIn, Glassdoor) and integrates with the Blacklight backend for job matching.

## 🚀 Features

- **Multi-Platform Support**: Scrapes jobs from 5 major platforms
  - Monster
  - Dice Jobs
  - TechFetch
  - LinkedIn
  - Glassdoor

- **Blacklight Integration**: Seamless integration with Blacklight backend API
  - Queue-based role+location workflow
  - Automatic job submission and duplicate detection
  - Session management and progress tracking
  - Credential management for authenticated platforms

- **Automated Queue Processing**: Auto-checks queue every 30 seconds
- **Express API**: REST API for manual scraping and status checks
- **Credential Management**: Handles authentication for LinkedIn and Glassdoor
- **Robust Error Handling**: Graceful failure recovery and detailed logging

## 📋 Prerequisites

- **Node.js** v18 or higher
- **npm** v9 or higher
- **Playwright** browsers (auto-installed)

## 🔧 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/guruvedhanth-s/Scraper.git
cd Scraper
```

### 2. Install Dependencies

```bash
npm install
```

This will install all required packages including:
- Express.js (Web server)
- Crawlee (Web scraping framework)
- Playwright (Browser automation)
- Cheerio (HTML parsing)
- JSDOM (DOM manipulation)

### 3. Install Playwright Browsers

```bash
npx playwright install
```

This downloads Chromium, Firefox, and WebKit browsers used for scraping.

### 4. Configure Credentials

Create a `config/credentials.json` file with the following structure:

```json
{
  "blacklight": {
    "apiUrl": "https://blacklight-backend-kko63bb3aa-el.a.run.app",
    "apiKey": "your-scraper-api-key-here"
  },
  "scraperCredentials": {
    "apiUrl": "https://blacklight-backend-kko63bb3aa-el.a.run.app",
    "apiKey": "your-scraper-api-key-here"
  },
  "linkedin": {
    "email": "your-linkedin-email@example.com",
    "password": "your-linkedin-password"
  },
  "glassdoor": {
    "cookies": "your-glassdoor-cookies-here"
  }
}
```

**Important**: 
- Replace `your-scraper-api-key-here` with your actual Blacklight API key
- Add LinkedIn credentials for LinkedIn scraping (optional)
- Add Glassdoor cookies for Glassdoor scraping (optional)
- Never commit this file to version control (it's in .gitignore)

## 🎯 Usage

### Start the Server

```bash
npm start
```

The server will start on `http://localhost:3000` with:
- ✅ REST API endpoints available
- ✅ Auto queue checker running (checks every 30 seconds)

### Development Mode (with auto-restart)

```bash
npm run dev
```

## 📡 API Endpoints

### 1. Manual Scraping

Scrape jobs from specific platforms:

```bash
# Single platform
curl -X POST http://localhost:3000/scrape \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "dice",
    "jobTitle": "DevOps Engineer",
    "location": "New York"
  }'

# Multiple platforms
curl -X POST http://localhost:3000/scrape \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "monster,dice,techfetch",
    "jobTitle": "Software Engineer",
    "location": "California"
  }'

# All platforms
curl -X POST http://localhost:3000/scrape \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "all",
    "jobTitle": "Data Scientist",
    "location": "Remote"
  }'
```

### 2. Health Check

```bash
curl http://localhost:3000/
```

Response:
```json
{
  "message": "Unified Job Scraper API is running",
  "version": "1.0.0",
  "platforms": ["monster", "dice", "techfetch", "linkedin", "glassdoor"],
  "endpoints": {
    "scrape": "POST /scrape - Scrape jobs from platforms",
    "health": "GET / - API health check"
  }
}
```

## 🔄 Automatic Queue Processing

The scraper automatically:

1. **Checks the Blacklight queue** every 30 seconds
2. **Fetches the next role+location** to scrape
3. **Scrapes all configured platforms** for that role
4. **Submits jobs to Blacklight** for matching
5. **Completes the session** and triggers candidate matching
6. **Repeats** for the next queue item

### Queue Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                    AUTOMATIC WORKFLOW                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Check active session                                    │
│  2. Get next role+location from queue                       │
│  3. For each platform:                                      │
│     a. Get credentials (if needed)                          │
│     b. Scrape jobs                                          │
│     c. Submit to Blacklight                                 │
│  4. Complete session → Trigger matching                     │
│  5. Wait 30s → Repeat                                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 📂 Project Structure

```
UnifiedJobScraper/
├── server.js                 # Main Express server & queue orchestrator
├── package.json              # Node.js dependencies
├── README.md                 # This file
├── Complete API.md           # Blacklight API documentation
├── .gitignore               # Git ignore rules
│
├── common/                   # Shared utilities
│   ├── utils.js             # Helper functions & Blacklight API client
│   ├── credentialsAPI.js    # Credential management API
│   └── messages.js          # Success/error messages
│
├── config/                   # Configuration (not in git)
│   └── credentials.json     # API keys & login credentials
│
├── scrapers/                 # Platform-specific scrapers
│   ├── monster.js           # Monster Jobs scraper
│   ├── dice.js              # Dice Jobs scraper
│   ├── techfetch.js         # TechFetch scraper
│   ├── linkedin.js          # LinkedIn scraper (requires login)
│   └── glassdoor.js         # Glassdoor scraper (requires cookies)
│
├── schemas/                  # Data schemas
│   └── master-schema.json   # Unified job data schema
│
├── results/                  # Scraped data output (gitignored)
│   └── *.json
│
└── storage/                  # Crawlee storage (gitignored)
    ├── key_value_stores/
    └── request_queues/
```

## 🛠️ Configuration

### Environment Variables (Optional)

You can set these environment variables:

```bash
export PORT=3000                    # Server port (default: 3000)
export QUEUE_CHECK_INTERVAL=30000   # Queue check interval in ms (default: 30000)
```

### Queue Auto-Checker

To disable automatic queue checking, modify `server.js`:

```javascript
// Comment out this line:
// setInterval(autoCheckQueue, 30000);
```

## 📊 Data Format

Jobs are scraped and normalized to this format before submission:

```json
{
  "platform_job_id": "12345",
  "title": "Senior DevOps Engineer",
  "company": "Acme Corp",
  "location": "New York, NY",
  "description": "Full job description...",
  "url": "https://...",
  "salary_min": 120000,
  "salary_max": 160000,
  "salary_currency": "USD",
  "job_type": "full_time",
  "experience_level": "senior",
  "posted_date": "2026-01-14",
  "is_remote": false
}
```

See `schemas/master-schema.json` for complete schema details.

## 🔐 Credential Management

### LinkedIn Credentials

LinkedIn scraping requires login credentials. The scraper:
1. Fetches available credentials from Blacklight API
2. Logs in using the credentials
3. Scrapes jobs
4. Reports success/failure back to API

### Glassdoor Cookies

Glassdoor requires authentication cookies:
1. Log in to Glassdoor manually in your browser
2. Export cookies (using browser extension or DevTools)
3. Add to `config/credentials.json`
4. Cookies are used for authenticated requests

## 🐛 Troubleshooting

### "Queue is empty"
- No jobs in the Blacklight queue
- Wait for admin to add roles/locations
- Or use manual `/scrape` endpoint

### "Active session exists"
- A scraping session is already in progress
- Wait for it to complete or fail
- Check session status in Blacklight admin panel

### "No credentials available"
- No LinkedIn/Glassdoor credentials in the pool
- Add credentials via Blacklight admin panel
- Or skip authenticated platforms

### Playwright Installation Issues

```bash
# Force reinstall browsers
npx playwright install --force

# Install system dependencies (Linux)
npx playwright install-deps
```

### Module Import Errors

Ensure `package.json` has `"type": "module"` for ES6 imports:

```json
{
  "type": "module"
}
```

## 📝 Logs

The scraper provides detailed console logs:

```
[2:30:15 pm] [DICE] Searching for "DevOps Engineer" in "New York"
[2:30:16 pm] [DICE] Page 1: Found 60 job URLs
[2:30:17 pm] [DICE] Total unique job URLs found: 100
[2:30:45 pm] [DICE] ✅ Job saved: Senior DevOps Engineer at Acme Corp (Total: 25)
[2:31:22 pm] [DICE] Completed! Saved 100 detailed jobs
```

## 🚦 Status Codes

- `200` - Success
- `202` - Accepted (async processing)
- `400` - Bad Request (invalid parameters)
- `404` - Not Found (invalid platform)
- `409` - Conflict (active session exists)
- `500` - Internal Server Error

## 📚 API Documentation

Full Blacklight API documentation is available in [Complete API.md](Complete%20API.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License - See LICENSE file for details

## 🔗 Links

- **Repository**: https://github.com/guruvedhanth-s/Scraper.git
- **Blacklight Backend**: https://blacklight-backend-kko63bb3aa-el.a.run.app
- **Issues**: https://github.com/guruvedhanth-s/Scraper/issues

## 💡 Tips

1. **Rate Limiting**: The scraper respects platform rate limits automatically
2. **Concurrency**: Scrapes multiple jobs in parallel (configurable in scraper files)
3. **Resilience**: Continues even if some jobs fail
4. **Deduplication**: Blacklight backend handles duplicate detection
5. **Monitoring**: Check logs for detailed progress information

## 🆘 Support

For issues, questions, or contributions:
- Open an issue on GitHub
- Check existing issues for solutions
- Review the API documentation in `Complete API.md`

---

**Happy Scraping! 🎉**
