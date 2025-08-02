# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Gabooja Creator Discovery Platform - A Next.js application for discovering and analyzing social media creators across Instagram, TikTok, and YouTube. The platform provides AI-powered analysis, real-time engagement metrics, and creator discovery tools for marketing professionals.

## Development Commands

**Note**: This project is missing essential configuration files. For a complete setup, reference the parallel directory `/Users/tannerlee/Documents/gabooja/gaboojacreatordiscovery` which contains all necessary configuration files.

### Essential Missing Files
- `package.json` - Dependencies and scripts
- `next.config.ts` - Next.js configuration 
- `tsconfig.json` - TypeScript configuration
- `eslint.config.mjs` - Linting rules
- `postcss.config.mjs` - CSS processing with Tailwind
- `components.json` - Shadcn/ui configuration
- `.env.local` - Environment variables

### Standard Commands (when configured)
```bash
# Development server with Turbo mode
npm run dev

# Production build
npm run build

# Start production server
npm start

# Code linting
npm run lint

# Install Playwright for web scraping
npm run postinstall
```

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
- Supabase authentication with conditional features
- `SupabaseAuthProvider` - Global auth state management  
- `CreatorProvider` - Analysis history and state management
- Supports both authenticated and guest users

### API Routes Structure
```
/api/
├── analyze-creator/ - Main creator analysis endpoint
├── discover-creators/ - Creator discovery with filtering
├── ai-metrics/ - AI usage tracking
└── data-quality/ - Data validation endpoints
```

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

1. **Before Starting**: Copy configuration files from the complete version at `/Users/tannerlee/Documents/gabooja/gaboojacreatordiscovery/`

2. **Environment Setup**: Ensure these environment variables are configured:
   - `OPENAI_API_KEY` - OpenAI API access
   - `SUPABASE_URL` & `SUPABASE_ANON_KEY` - Database connection
   - `INSTAGRAM_SESSION_ID` - Instagram scraping (optional)

3. **Database Schema**: Use `database-schema-refined.sql` for Supabase setup

4. **Scraping Considerations**: 
   - Playwright requires Chromium installation
   - Production uses `@sparticuz/chromium` for serverless
   - Implements anti-detection measures and retry logic

5. **AI Cost Management**:
   - Uses complexity-based model selection
   - Implements response caching
   - Optimizes image quality based on creator metrics

### Common Patterns

- Context providers for global state management
- Custom hooks for data fetching and state
- Compound component patterns for complex UI
- Error boundaries with fallback UI
- Progressive enhancement for authenticated features

### File Structure Conventions
- `/src/app/` - Next.js App Router pages and layouts
- `/src/components/` - React components (features/, ui/, layout/)
- `/src/lib/` - Utility functions, services, and business logic
- Type definitions centralized in `/src/lib/types.ts`