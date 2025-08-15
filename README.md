# Gabooja Creator Discovery Platform

A Next.js application for discovering and analyzing social media creators across Instagram and TikTok. The platform provides AI-powered analysis, real-time engagement metrics, and creator discovery tools for marketing professionals.

## 🚀 Features

- **Multi-Platform Support**: Instagram and TikTok creator analysis
- **AI-Powered Analysis**: OpenAI GPT integration for comprehensive creator insights
- **Web Scraping**: Playwright-based scraping with anti-detection measures
- **Data Quality Validation**: Comprehensive data validation and normalization
- **Creator Discovery**: Database of creators with advanced filtering
- **Bookmark System**: Save and organize creators with comments
- **Real-time Analytics**: Processing time, AI costs, and quality metrics
- **Responsive UI**: Modern design with Tailwind CSS and Shadcn/ui

## 🛠 Technology Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS 4.0
- **UI Components**: Radix UI via Shadcn/ui
- **Web Scraping**: Playwright (Chromium)
- **AI Analysis**: OpenAI GPT models
- **Icons**: Lucide React

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account
- OpenAI API key

## 🚀 Quick Start

1. **Clone and Install**
```bash
git clone <repository-url>
cd newcreatordiscovery
npm install
```

2. **Environment Setup**
```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:
```env
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Instagram Scraping (Optional)
INSTAGRAM_SESSION_ID=your_instagram_session_id

# Environment
NODE_ENV=development
```

3. **Start Development**
```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## 📝 Available Scripts

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

## 🏗 Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Authentication pages
│   ├── api/               # API routes
│   └── [pages]/           # Application pages
├── components/            # React components
│   ├── features/          # Feature-specific components
│   ├── layout/            # Layout components
│   └── ui/                # Reusable UI components
└── lib/                   # Utilities and services
    ├── ai-analysis/       # OpenAI integration
    ├── data-quality/      # Data validation
    ├── database/          # Supabase services
    ├── scraping/          # Web scraping
    ├── security/          # Rate limiting & CORS
    └── validation/        # Input validation
```

## 🔧 Configuration

### Supabase Setup
1. Create a new Supabase project
2. Run the database schema from the complete version
3. Configure environment variables

### OpenAI Setup
1. Get API key from OpenAI
2. Add to environment variables
3. Adjust cost optimization settings in `ai-analysis/cost-optimizer.ts`

## 🐛 Bugs Fixed

1. **Authentication Provider**: Uncommented SupabaseAuthProvider in layout.tsx
2. **Environment Variables**: Fixed naming convention for Supabase vars
3. **Missing Files**: Added next-env.d.ts for TypeScript support
4. **Configuration**: Complete setup with all required config files

## 📊 API Endpoints

- `POST /api/analyze-creator` - Analyze creator profile
- `GET /api/discover-creators` - Get creator discovery data
- `GET /api/ai-metrics` - AI usage tracking
- `GET /api/data-quality` - Data validation metrics

## 🔒 Security Features

- Rate limiting (10 requests per window)
- CORS configuration
- Input sanitization and validation
- SQL injection prevention
- Environment variable protection

## 🎨 UI Components

Built with Shadcn/ui components:
- Cards, Buttons, Inputs
- Modals, Dropdowns, Tabs
- Analysis and booking modals
- Responsive creator cards

## 📈 Performance

- Turbo mode for development
- Image optimization for social media
- Intelligent AI cost management
- Data quality caching
- Progressive enhancement

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create pull request

## 📄 License

This project is private and proprietary.