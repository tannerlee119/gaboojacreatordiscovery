# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Gabooja Creator Discovery is a Next.js-based platform for discovering and analyzing social media creators across Instagram and TikTok. It combines web scraping, AI analysis, and data quality validation to provide comprehensive creator insights.

## Common Commands

### Development
```bash
npm run dev          # Start development server on localhost:3000
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint code linting
npm install          # Install dependencies (includes Playwright Chromium)
```

### Database Setup
```bash
# Run the database schema in Supabase SQL editor
cat database-schema.sql | supabase sql --stdin
```

### Testing Web Scraping
```bash
# Test Instagram scraper in development
curl -X POST http://localhost:3000/api/analyze-creator \
  -H "Content-Type: application/json" \
  -d '{"username":"test_user","platform":"instagram"}'
```

## High-Level Architecture

### Core Components

**Web Scraping Engine** (`src/lib/scraping/`)
- Playwright-based browser automation with Sparticuz Chromium for Vercel
- Platform-specific scrapers: `instagram-scraper.ts`, `tiktok-scraper.ts`
- Base scraper class: `playwright-base-scraper.ts` with stealth features
- Handles authentication, rate limiting, and anti-bot measures

**AI Analysis System** (`src/lib/ai-analysis/`)
- OpenAI GPT-4o/GPT-4o-mini integration for creator profile analysis
- Cost optimizer: `cost-optimizer.ts` with tiered analysis (60-80% cost reduction)
- Smart caching system with 7-day TTL and LRU eviction
- Complexity-based model selection (basic/standard/premium)

**Data Quality Pipeline** (`src/lib/data-quality/`)
- Multi-layer validation: normalization, quality scoring, duplicate detection
- Quality scoring: completeness (40%), consistency (30%), reliability (30%)
- Duplicate detection with weighted similarity matching
- Comprehensive validation orchestration

**Database Layer** (`src/lib/database/`)
- Supabase integration with creator profiles and metrics storage
- Platform-specific metrics tables (Instagram, TikTok)
- Service layer: `creator-service.ts` for data operations

**Security & Rate Limiting** (`src/lib/security/`)
- IP-based rate limiting (10 requests per 15 minutes)
- CORS configuration with production domain protection
- Input validation with Zod schemas
- Security headers and XSS prevention

### Data Flow Architecture

```
User Request → Rate Limiter → Input Validation → Web Scraper → Data Quality Validator → AI Analyzer → Database Storage → Response
```

### Context Providers

**AuthProvider** (`src/lib/auth-context.tsx`)
- Local storage-based authentication (development/demo system)
- User registration, login, and guest access
- Automatic session persistence

**CreatorProvider** (`src/lib/creator-context.tsx`)
- Global state management for creator data
- Search history and bookmarks management
- User-specific data persistence

## Environment Variables

Required for production:
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# OpenAI API (for AI analysis)
OPENAI_API_KEY=your_openai_api_key

# Optional: Instagram Authentication
INSTAGRAM_USERNAME=your_instagram_username
INSTAGRAM_PASSWORD=your_instagram_password
INSTAGRAM_COOKIES_JSON=instagram_cookies_array
```

## Key API Endpoints

- `POST /api/analyze-creator` - Main creator analysis endpoint (60s timeout)
- `POST /api/data-quality` - Data quality validation endpoint (30s timeout)
- `GET /api/ai-metrics` - AI cost tracking and cache metrics (15s timeout)
- `POST /api/discover-creators` - Creator discovery with filters

## Development Guidelines

### Web Scraping
- All scrapers extend `PlaywrightBaseScraper` with shared stealth features
- Instagram scraper includes fallback authentication and session management
- Handle rate limiting gracefully with exponential backoff
- Always cleanup browser resources in try/finally blocks

### AI Analysis
- Use cost optimizer to determine analysis complexity before OpenAI calls
- Pass profile data (follower count, verification, website) for tier detection
- Monitor cost via `X-AI-Cost` response headers
- Implement fallback analysis for rate limit scenarios

### Data Quality
- All scraped data goes through automatic validation pipeline
- Quality scores should be ≥70 for production use
- Check `X-Data-Quality-Score` headers in responses
- Use batch validation for processing multiple profiles

### Security
- All API inputs validated with Zod schemas in `src/lib/validation/schemas.ts`
- Rate limiting configured per endpoint in middleware
- Production CORS origins must be updated in `src/lib/security/cors.ts`
- Never expose sensitive data in error messages

## Database Schema

Main entities:
- `creators` - Core creator profiles with platform-agnostic fields
- `instagram_metrics` - Instagram-specific engagement data
- `tiktok_metrics` - TikTok-specific performance data
- `creator_categories` - Many-to-many category relationships

## Performance Considerations

### Vercel Deployment
- Function timeouts configured in `vercel.json`
- Sparticuz Chromium used for browser automation in serverless
- Memory optimization for large-scale scraping operations
- Playwright browser cleanup critical for preventing memory leaks

### Cost Optimization
- AI analysis costs reduced by 60-80% through tiered system
- Caching provides 100% cost savings on repeat analyses
- Screenshot optimization based on analysis complexity
- Automatic fallback to cheaper models during rate limits

## Troubleshooting

### Common Issues
- **Browser fails to launch**: Check Playwright installation with `npx playwright install chromium`
- **Instagram login fails**: Verify credentials and check for challenge redirects
- **High AI costs**: Monitor `/api/ai-metrics` and adjust complexity thresholds
- **Data quality issues**: Check quality scores and review normalization rules
- **Rate limiting**: Monitor `X-RateLimit-*` headers and implement client backoff

### Debug Commands
```bash
# Check Playwright installation
npx playwright --version

# Test browser launch
node -e "const { chromium } = require('playwright'); chromium.launch().then(b => b.close())"

# Monitor API metrics
curl http://localhost:3000/api/ai-metrics
```

## Testing

No specific test framework configured - verify functionality through:
1. Manual API testing with curl/Postman
2. Browser scraping tests with real social media profiles
3. AI analysis validation with known creator profiles
4. Data quality validation with sample datasets

## Deployment Notes

- Optimized for Vercel with Edge Runtime compatibility
- Database schema must be run in Supabase before first deployment
- Update CORS origins for production domains
- Monitor function timeouts and memory usage in Vercel dashboard
- Set up error tracking (Sentry recommended) for production monitoring