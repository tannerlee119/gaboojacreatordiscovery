# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Gabooja Creator Discovery Platform - A comprehensive Next.js application for discovering and analyzing social media creators across Instagram and TikTok. The platform provides AI-powered analysis, real-time engagement metrics, creator discovery tools, growth trend analysis, cross-platform creator matching, and advanced filtering capabilities for marketing professionals.

## Development Commands
```bash
# Development server with Turbo mode
npm run dev

# Production build
npm run build

# Start production server
npm start

# Code linting (includes TypeScript checking)
npm run lint

# Install Playwright for web scraping
npm run postinstall

# Database cleanup utilities
npm run cleanup-db          # Preview cleanup operations
npm run cleanup-db:confirm  # Execute cleanup operations
```

### Environment Setup
Ensure these environment variables are configured in `.env.local`:
- `OPENAI_API_KEY` - OpenAI API access for creator analysis
- `NEXT_PUBLIC_SUPABASE_URL` & `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Database connection
- `SUPABASE_SERVICE_ROLE_KEY` - For server-side database operations
- `INSTAGRAM_SESSION_ID` - Instagram scraping (deprecated, use cookies instead)
- `INSTAGRAM_COOKIES_JSON` - **CRITICAL**: Fresh Instagram cookies in JSON array format for authentication
- `TIKTOK_COOKIES_JSON` - TikTok session cookies as JSON array (optional)
- `NODE_ENV` - Set to 'development' for local development

## Core Architecture

### Technology Stack
- **Framework**: Next.js 15+ with App Router
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS 4.0
- **UI Components**: Radix UI via Shadcn/ui
- **Web Scraping**: Playwright (Chromium) with enhanced error detection
- **AI Analysis**: OpenAI GPT models with cost optimization
- **Data Visualization**: Chart.js for growth trend analysis
- **Icons**: Lucide React

### Key Architectural Components

#### Data Flow Architecture
1. **Web Scraping Layer** (`src/lib/scraping/`)
   - `playwright-base-scraper.ts` - Base scraper with retry logic and error handling
   - `instagram-scraper.ts` & `tiktok-scraper.ts` - Platform-specific scrapers
   - Uses Playwright with Chromium for dynamic content extraction

2. **AI Analysis Pipeline** (`src/lib/ai-analysis/`)
   - `openai-analyzer.ts` - OpenAI GPT integration for creator analysis
   - `cost-optimizer.ts` - Intelligent cost management and caching
   - Adaptive analysis complexity based on creator metrics

3. **Data Quality System** (`src/lib/data-quality/`)
   - `validator.ts` - Comprehensive data validation
   - `normalizer.ts` - Data normalization and standardization
   - `duplicate-detector.ts` - Duplicate detection and deduplication
   - `quality-scorer.ts` - Data quality scoring system

4. **Database Layer** (`src/lib/database/`)
   - `supabase-service.ts` - Main database operations with real-time data access
   - `creator-service.ts` - Creator-specific database functions
   - `bookmark-service.ts` - Bookmark persistence for authenticated users
   - `growth-data-service.ts` - Historical growth data processing and analysis
   - Supports both RPC functions and direct table operations
   - Hybrid approach for live data vs cached views

5. **Creator Matching System** (`src/lib/creator-matching/`)
   - `matching-service.ts` - Multi-signal cross-platform creator identification
   - Weighted confidence scoring with display name, bio, website, and username analysis
   - Future-ready caching architecture for match results

6. **User Management** (`src/lib/`)
   - `user-bookmarks.ts` - User-specific bookmark management with database integration
   - `bookmarks.ts` - Local storage fallback for non-authenticated users
   - Seamless transition between authenticated and guest experiences

### Core Features

#### Creator Analysis Workflow
1. User inputs creator username and platform
2. Playwright scraper extracts profile data and screenshots with enhanced error detection
3. Data quality validation and normalization with detailed feedback
4. AI analysis via OpenAI with intelligent cost optimization
5. Results stored in Supabase with full metadata and analysis history
6. Analysis displayed in responsive UI with refresh capabilities
7. Growth trend analysis with historical data tracking

#### Discovery System
- Creator database with advanced filtering by platform, category, followers, verification status
- Real-time filter application with loading states and active filter badges
- Bookmark system with user-specific storage and commenting capabilities
- Trending creators based on growth metrics with clickable growth trend indicators
- Pagination and search functionality with state persistence
- Mobile-responsive collapsible filters

#### Growth Analysis System
- Historical follower count tracking across multiple analyses
- Interactive Chart.js visualizations with data points and growth percentages
- Growth trend modals accessible from discovery, bookmarks, and analysis pages
- Comprehensive growth metrics including absolute and percentage changes
- Timeline analysis with days between data points

#### Cross-Platform Creator Matching
- Multi-signal algorithm for identifying creators across Instagram and TikTok
- Weighted confidence scoring based on display name, bio, website, and username similarity
- High-confidence match suggestions with detailed reasoning
- Manual verification workflow with direct profile links
- Comprehensive matching factors analysis

### Authentication & Context
- **Custom Authentication**: Simple username/password system in `src/lib/simple-auth.ts` with bcrypt hashing
- **Supabase Authentication**: Alternative auth provider with conditional features via `src/lib/supabase-auth-context.tsx`
- **Auth Context**: `src/lib/auth-context.tsx` - Global auth state management
- **Creator Context**: `src/lib/creator-context.tsx` - Analysis history and state management
- Supports both authenticated and guest users with graceful fallbacks

### API Routes Structure
```
/api/
├── analyze-creator/ - Main creator analysis endpoint with refresh capabilities (POST)
├── discover-creators/ - Creator discovery with advanced filtering and real-time data (GET)
├── growth-data/ - Historical growth analysis endpoint (GET)
├── creator-matches/ - Cross-platform creator matching endpoint (GET)
├── ai-metrics/ - AI usage tracking (GET)
├── data-quality/ - Data validation endpoints (GET)
└── debug-env/ - Environment debugging for development (GET)
```

**Key API Features:**
- Rate limiting (10 requests per window) via `rate-limiter.ts`
- CORS configuration in `cors.ts`
- Input validation with Zod schemas and comprehensive error messages
- Data quality scoring and normalization with Instagram-specific feedback
- Enhanced error handling with detailed debugging information
- Real-time data validation and cache invalidation
- Growth data processing with percentage calculations and timeline analysis
- Multi-signal creator matching with confidence scoring

### Security & Rate Limiting
- CORS configuration in `src/lib/security/cors.ts`
- Rate limiting implementation in `src/lib/security/rate-limiter.ts`
- Environment variable validation for API keys

### Component Architecture
- **Features**: High-level feature components with advanced functionality:
  - `creator-analyzer.tsx` - Analysis with refresh and state restoration
  - `creator-discovery.tsx` - Discovery with real-time filtering and pagination
  - `growth-chart-modal.tsx` - Interactive Chart.js growth visualization
  - `creator-matching-modal.tsx` - Cross-platform creator identification UI
- **UI**: Reusable Shadcn/ui components with consistent styling:
  - `discovery-filters.tsx` - Advanced filtering with mobile responsiveness
  - `discovery-creator-card.tsx` - Creator cards with growth trend indicators
  - `analysis-modal.tsx` - Comprehensive analysis display with refresh capabilities
  - `bookmark-comment-modal.tsx` - User annotation system
- **Layout**: Conditional navigation and responsive layouts with state persistence

## Development Guidelines

### Working with the Codebase

1. **Configuration**: All essential configuration files are present:
   - `package.json` - Dependencies and scripts
   - `next.config.ts` - Next.js configuration with image domains
   - `tsconfig.json` - TypeScript configuration with path aliases
   - `eslint.config.mjs` - ESLint rules with Next.js standards
   - `postcss.config.mjs` - PostCSS with Tailwind CSS
   - `components.json` - Shadcn/ui configuration

2. **Database Schema**: Requires Supabase setup with creator analysis tables

3. **Scraping Architecture**: 
   - Playwright with Chromium for dynamic content extraction
   - `@sparticuz/chromium` optimized for serverless deployment
   - Base scraper class with retry logic and error handling
   - Platform-specific scrapers for Instagram and TikTok
   - Anti-detection measures and rate limiting

4. **AI Cost Management**:
   - `cost-optimizer.ts` implements intelligent model selection
   - Response caching to reduce API costs
   - Image quality optimization based on creator metrics
   - Cost tracking headers in API responses

### Common Patterns

- **Context Providers**: `SupabaseAuthProvider` and `CreatorProvider` for global state
- **Data Quality Pipeline**: Validation → Normalization → Quality Scoring → Storage
- **Progressive Enhancement**: Features work for both authenticated and guest users
- **Error Handling**: User-friendly error messages with internal error logging
- **Security**: Input sanitization, rate limiting, and CORS protection
- **Cost Optimization**: AI analysis caching and complexity-based model selection

### File Structure Conventions
- `/src/app/` - Next.js App Router pages, layouts, and API routes
- `/src/components/` - React components organized by purpose:
  - `features/` - High-level feature components (creator-analyzer, creator-discovery)
  - `ui/` - Reusable Shadcn/ui components
  - `layout/` - Navigation and layout components
- `/src/lib/` - Business logic organized by domain:
  - `ai-analysis/` - OpenAI integration and cost optimization
  - `data-quality/` - Validation, normalization, and quality scoring
  - `database/` - Supabase services, creator operations, and bookmarks
  - `scraping/` - Platform-specific scrapers with base class
  - `security/` - Rate limiting and CORS configuration
  - `validation/` - Input validation schemas
  - `simple-auth.ts` - Simple username/password authentication system
  - `user-bookmarks.ts` - Bookmark management with database/localStorage hybrid
- Type definitions centralized in `/src/lib/types.ts` with platform-specific interfaces

## Important Implementation Details

### Data Flow Architecture Deep Dive

1. **Request Processing** (`/api/analyze-creator/route.ts`):
   - Rate limiting and CORS validation
   - Zod schema validation for input sanitization
   - Platform-specific scraping with error handling
   - Data quality validation and normalization
   - AI analysis with cost optimization
   - Comprehensive database storage

2. **Scraping Implementation**:
   - Base class `PlaywrightBaseScraper` with retry logic and error handling
   - Platform-specific implementations extend base class
   - Screenshot capture for AI analysis
   - Anti-detection measures and user agent rotation

3. **Data Quality System**:
   - `validator.ts` - Comprehensive validation with quality scoring
   - `normalizer.ts` - Data standardization and cleanup
   - `quality-scorer.ts` - Multi-dimensional quality assessment
   - `duplicate-detector.ts` - Intelligent duplicate detection

4. **AI Analysis Pipeline**:
   - `openai-analyzer.ts` - GPT integration with image analysis
   - `cost-optimizer.ts` - Model selection based on complexity
   - Response caching to minimize API costs
   - Structured JSON output with quality metrics

### Key Configuration Files

- **ESLint**: Extends Next.js standards with TypeScript support
- **Next.js**: Configured for social media image domains and optimization
- **TypeScript**: Strict mode with path aliases (`@/*` → `./src/*`)
- **Tailwind**: PostCSS integration for CSS processing

### Security Implementation

- **Rate Limiting**: 10 requests per sliding window in `rate-limiter.ts`
- **CORS**: Configured for cross-origin requests in `cors.ts`
- **Input Sanitization**: Zod schemas with HTML sanitization
- **Error Handling**: User-friendly messages without exposing internals

## Vercel Deployment

### Quick Deploy
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to Vercel
vercel --prod
```

### Environment Variables (Vercel Dashboard)
Set these in your Vercel project settings:
- `OPENAI_API_KEY` - OpenAI API key for creator analysis
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `INSTAGRAM_SESSION_ID` - Instagram session (deprecated, use cookies instead)
- `INSTAGRAM_COOKIES_JSON` - **CRITICAL**: Fresh Instagram cookies in JSON array format for authentication
- `TIKTOK_COOKIES_JSON` - TikTok session cookies as JSON array (optional)
- `NODE_ENV` - Set to `production`

### Configuration Details
- **Function Timeouts**: Creator analysis endpoint set to 60s, discovery to 30s
- **Playwright**: Uses `@sparticuz/chromium` for serverless compatibility
- **Build Optimization**: Skips Playwright browser download on Vercel
- **CORS**: Configured for API routes with proper headers
- **Rate Limiting**: Implemented in-memory (consider Redis for production scale)

## Common Issues & Troubleshooting

### TikTok Creators Not Appearing in Discovery Page (RESOLVED)

**Issue**: TikTok creators were being analyzed successfully but not showing up in the discovery page, while Instagram creators worked fine.

**Root Causes & Solutions**:

1. **localStorage Filter State Persistence (Primary Issue)**
   - **Problem**: The discovery page persisted user filter preferences in localStorage. If users had previously filtered to show only Instagram creators, this setting persisted and prevented TikTok creators from displaying.
   - **Solution**: Updated localStorage key from `'gabooja-discovery-state-v2'` to `'gabooja-discovery-state-v3'` and added cleanup of old keys to force reset to defaults.
   - **File Modified**: `src/components/features/creator-discovery.tsx` (lines 19, 150-151)

2. **Database Schema Mismatches (Secondary Issue)**
   - **Problem**: TikTok metrics saving failed due to missing database columns, preventing proper data storage.
   - **Solution**: Fixed `supabase-service.ts` to use only existing table columns and handle platform-specific metrics properly.
   - **File Modified**: `src/lib/database/supabase-service.ts`

### TikTok Bookmark Functionality Not Working (RESOLVED)

**Issue**: TikTok creators couldn't be bookmarked from the analysis page, while Instagram bookmark functionality worked correctly.

**Root Cause & Solution**:
- **Problem**: The `getOrCreateCreator` function in bookmark service relied solely on a database RPC function `get_or_create_creator` that wasn't handling TikTok creators properly.
- **Solution**: Enhanced `getOrCreateCreator` with a robust three-tier approach:
  1. First tries to find existing creator in database
  2. Falls back to RPC function if creator not found
  3. If RPC fails, manually creates creator record
- **File Modified**: `src/lib/database/bookmark-service.ts` (lines 281-329)

### Data Flow Verification Process

When debugging platform-specific issues (Instagram vs TikTok):

1. **API Layer Check**: Test discovery API directly: `curl "http://localhost:3000/api/discover-creators?platform=all"`
2. **Database Layer Check**: Verify creators table has both Instagram and TikTok entries
3. **Frontend Filter Check**: Clear localStorage and check default platform setting is `'all'`
4. **Bookmark Service Check**: Test both database and localStorage fallback paths

### Key Learning Points

- **localStorage Persistence**: Frontend state persistence can mask platform-specific bugs by preserving invalid filter states
- **Database Resilience**: Always implement fallback strategies for database operations, especially for user-facing features like bookmarks  
- **Platform Parity**: When one platform works and another doesn't, check both data flow differences and frontend state management
- **API vs Frontend Debugging**: Always test API endpoints directly to isolate whether issues are in backend logic or frontend display

### Database Schema Notes

The system uses multiple tables for creator data:
- `creators` - Basic creator information (username, platform, display_name)
- `creator_analyses` - Detailed analysis results with AI data
- `creator_discovery` - View/table for discovery page with optimized fields
- `instagram_metrics` / `tiktok_metrics` - Platform-specific metrics
- `user_bookmarks` - User bookmark relationships

When adding new platforms or modifying data structures, ensure all layers (scraping → analysis → storage → discovery → bookmarks) are updated consistently.

## Critical Production Issues & Solutions

### Instagram Scraping Authentication (ONGOING MAINTENANCE)

**Issue**: Instagram requires valid session cookies for profile access. Without fresh cookies, all Instagram analyses fail with "Invalid follower count: 0" errors.

**Symptoms**:
- Instagram creators return follower count 0
- Error message: "Invalid follower count: 0. This usually indicates Instagram access is blocked due to expired cookies"
- TikTok creators work fine, only Instagram affected

**Solution Process**:
1. **Get Fresh Cookies**: Log into Instagram in browser, extract cookies using developer tools
2. **Format Cookies**: Convert to JSON array format with proper domain/path/security settings
3. **Update Environment**: Set `INSTAGRAM_COOKIES_JSON` in Vercel dashboard
4. **Redeploy**: Trigger new deployment or wait for automatic deployment

**Cookie Format Example**:
```json
[
  {
    "name": "sessionid",
    "value": "75565908758%3AHz2awM0WNj0XC3%3A5%3AAYecAdAwhHV...",
    "domain": ".instagram.com",
    "path": "/",
    "httpOnly": false,
    "secure": true,
    "sameSite": "None"
  },
  {
    "name": "csrftoken", 
    "value": "9tg3kmionV7apNe2RA3wRmuqMlrgxiYj",
    "domain": ".instagram.com",
    "path": "/",
    "httpOnly": false,
    "secure": true,
    "sameSite": "None"
  }
]
```

**Browser Console Script** (run on instagram.com while logged in):
```javascript
copy(JSON.stringify(document.cookie.split(';').map(c => {
  const [name, value] = c.trim().split('=');
  return {
    name: name,
    value: value,
    domain: '.instagram.com',
    path: '/',
    httpOnly: false,
    secure: true,
    sameSite: 'None'
  };
})))
```

**Maintenance Schedule**: Update Instagram cookies every 1-2 weeks or when scraping failures occur.

**Monitoring**: Enhanced error messages in scraper provide clear guidance when cookies need refreshing:
- "Instagram access blocked - likely due to expired cookies or rate limiting"
- Detailed page content logging to diagnose blocking patterns
- Cookie injection status logging for debugging

### Recent Architectural Improvements

#### Growth Trend Analysis System (Added 2024)
- **Files Added**: 
  - `src/lib/database/growth-data-service.ts` - Historical data processing
  - `src/app/api/growth-data/route.ts` - Growth data API endpoint
  - `src/components/features/growth-chart-modal.tsx` - Chart.js visualization
- **Features**: Interactive follower growth charts with percentage calculations and timeline analysis
- **Integration**: Accessible from discovery cards, bookmarks, and analysis modals

#### Cross-Platform Creator Matching (Added 2024)  
- **Files Added**:
  - `src/lib/creator-matching/matching-service.ts` - Multi-signal matching algorithm
  - `src/app/api/creator-matches/route.ts` - Matching API endpoint
  - `src/components/features/creator-matching-modal.tsx` - Matching results UI
- **Features**: Identifies same creators across Instagram and TikTok with confidence scoring
- **Algorithm**: Weighted analysis of display name, bio, website, and username similarity

#### Advanced Discovery Filters (Enhanced 2024)
- **Files Modified**: `src/components/ui/discovery-filters.tsx`, `src/components/features/creator-discovery.tsx`
- **Improvements**: Real-time filter application, mobile responsiveness, active filter badges
- **Bug Fix**: Fixed critical issue where "Apply" button required navigation to take effect
- **UX**: Collapsible mobile interface with loading states and visual feedback

#### Enhanced Modal System (Refined 2024)
- **Issue Fixed**: Duplicate close buttons in modals causing UI confusion
- **Solution**: Custom Tailwind classes to override Shadcn Dialog focus styles
- **Implementation**: `[&>button]:focus:outline-none [&>button]:focus:ring-0 [&>button]:focus:bg-transparent`
- **Result**: Clean, single close button without auto-highlighting when modals open