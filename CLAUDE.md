# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Gabooja Creator Discovery Platform - A Next.js application for discovering and analyzing social media creators across Instagram, TikTok, and YouTube. The platform provides AI-powered analysis, real-time engagement metrics, and creator discovery tools for marketing professionals.

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
- `INSTAGRAM_SESSION_ID` - Instagram scraping (optional)
- `NODE_ENV` - Set to 'development' for local development

## Core Architecture

### Technology Stack
- **Framework**: Next.js 15+ with App Router
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS 4.0
- **UI Components**: Radix UI via Shadcn/ui
- **Web Scraping**: Playwright (Chromium)
- **AI Analysis**: OpenAI GPT models
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
   - `supabase-service.ts` - Main database operations
   - `creator-service.ts` - Creator-specific database functions
   - `bookmark-service.ts` - Bookmark persistence for authenticated users
   - Supports both RPC functions and direct table operations

### Core Features

#### Creator Analysis Workflow
1. User inputs creator username and platform
2. Playwright scraper extracts profile data and screenshots
3. Data quality validation and normalization
4. AI analysis via OpenAI with cost optimization
5. Results stored in Supabase with full metadata
6. Analysis displayed in responsive UI

#### Discovery System
- Creator database with filtering by platform, category, followers
- Bookmark system with user-specific storage
- Trending creators based on growth metrics
- Pagination and search functionality

### Authentication & Context
- **Custom Authentication**: `CustomAuthService` in `src/lib/custom-auth.ts` - Username/password auth with bcrypt hashing
- **Supabase Authentication**: Alternative auth provider with conditional features  
- `SupabaseAuthProvider` - Global auth state management
- `CreatorProvider` - Analysis history and state management
- Supports both authenticated and guest users with graceful fallbacks

### API Routes Structure
```
/api/
├── analyze-creator/ - Main creator analysis endpoint (POST)
├── discover-creators/ - Creator discovery with filtering (GET)
├── ai-metrics/ - AI usage tracking (GET)
└── data-quality/ - Data validation endpoints (GET)
```

**Key API Features:**
- Rate limiting (10 requests per window) via `rate-limiter.ts`
- CORS configuration in `cors.ts`
- Input validation with Zod schemas
- Data quality scoring and normalization
- Comprehensive error handling with user-friendly messages

### Security & Rate Limiting
- CORS configuration in `src/lib/security/cors.ts`
- Rate limiting implementation in `src/lib/security/rate-limiter.ts`
- Environment variable validation for API keys

### Component Architecture
- **Features**: High-level feature components (`creator-analyzer.tsx`, `creator-discovery.tsx`)
- **UI**: Reusable Shadcn/ui components with consistent styling
- **Layout**: Conditional navigation and responsive layouts

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
  - `custom-auth.ts` - Custom username/password authentication system
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
- `INSTAGRAM_SESSION_ID` - Instagram session (optional)
- `INSTAGRAM_COOKIES_JSON` - Instagram cookies (optional)
- `NODE_ENV` - Set to `production`

### Configuration Details
- **Function Timeouts**: Creator analysis endpoint set to 60s, discovery to 30s
- **Playwright**: Uses `@sparticuz/chromium` for serverless compatibility
- **Build Optimization**: Skips Playwright browser download on Vercel
- **CORS**: Configured for API routes with proper headers
- **Rate Limiting**: Implemented in-memory (consider Redis for production scale)