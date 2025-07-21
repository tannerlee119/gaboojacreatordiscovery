# Gabooja Creator Discovery

A powerful web application for discovering and analyzing social media creators across Instagram and TikTok. Built with Next.js, TypeScript, and Supabase.

## Features

- 🔍 **Creator Analysis**: Analyze Instagram and TikTok profiles with detailed metrics
- 📊 **Engagement Analytics**: Track follower counts, engagement rates, and content performance
- 🎯 **Smart Discovery**: Find creators by category, follower range, and verification status
- 🤖 **Automated Scraping**: Real-time data extraction from social media platforms
- 📝 **Manual Entry**: Fallback system for when automated scraping fails
- 💾 **Data Persistence**: Store and retrieve creator profiles with full history
- 🎨 **Modern UI**: Beautiful, responsive interface built with Tailwind CSS and Radix UI

## Prerequisites

Before running this project, make sure you have the following installed:

- **Node.js** (version 18.0 or higher)
- **npm** or **yarn** or **pnpm** or **bun**
- **Git**

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd gabooja-creator-discovery
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   # or
   bun install
   ```

3. **Set up environment variables**
   
   Create a `.env.local` file in the root directory and add the following variables:
   ```env
   # Supabase Configuration
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   ```

   **To get these values:**
   - Sign up at [Supabase](https://supabase.com)
   - Create a new project
   - Go to Settings > API to find your keys and URL

4. **Set up Supabase Database**
   
   Run the database schema setup in your Supabase SQL editor using the provided `database-schema.sql` file.

5. **Install Puppeteer dependencies (for web scraping)**
   
   **On macOS:**
   ```bash
   # Puppeteer should install Chrome automatically
   # If you encounter issues, you can install Chrome manually
   ```

   **On Ubuntu/Debian:**
   ```bash
   sudo apt-get update
   sudo apt-get install -y wget gnupg
   wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
   sudo sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list'
   sudo apt-get update
   sudo apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 --no-install-recommends
   ```

## Development

1. **Start the development server**
   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   # or
   bun dev
   ```

2. **Open your browser**
   
   Navigate to [http://localhost:3000](http://localhost:3000) to see the application.

## Key Technologies

- **Framework**: Next.js 15.3.5 with TypeScript
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS 4.0
- **UI Components**: Radix UI primitives
- **Web Scraping**: Puppeteer
- **Icons**: Lucide React
- **Deployment**: Vercel (recommended)

## Project Structure

```
gabooja-creator-discovery/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── api/               # API endpoints
│   │   ├── discovery/         # Creator discovery page
│   │   └── trending/          # Trending creators page
│   ├── components/            # React components
│   │   ├── ui/               # Base UI components
│   │   ├── layout/           # Layout components
│   │   └── features/         # Feature-specific components
│   └── lib/                  # Utility libraries
│       ├── types.ts          # TypeScript type definitions
│       ├── utils.ts          # Helper functions
│       └── supabase.ts       # Supabase client
├── public/                   # Static assets
└── ...config files
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anonymous key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key | Yes |

## Features Overview

### Creator Analyzer
- Search and analyze individual Instagram and TikTok profiles
- View detailed metrics including followers, engagement rates, and recent posts
- Manual data entry fallback when automated scraping fails
- Real-time data extraction with error handling

### Creator Discovery
- Browse and filter creators by platform, category, and follower count
- Search functionality across usernames, display names, and bios
- Verified creator filtering
- Responsive grid layout with detailed creator cards

### Web Scraping Engine
- Automated data extraction from Instagram and TikTok
- Rate limiting and retry logic for reliability
- Browser automation with Puppeteer
- Fallback mechanisms for anti-bot measures

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Deployment

### Deploy on Vercel

1. Push your code to GitHub
2. Connect your repository to [Vercel](https://vercel.com)
3. Add your environment variables in Vercel's dashboard
4. Deploy automatically

### Environment Variables for Production

Make sure to add these in your deployment platform:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Support

If you encounter any issues or have questions, please open an issue in the repository.
