-- Gabooja Creator Discovery Database Schema
-- Optimized for Puppeteer data scraping and storage

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Creator Categories Enum
CREATE TYPE creator_category AS ENUM (
  'lifestyle', 'fashion', 'beauty', 'fitness', 'food', 'travel',
  'tech', 'gaming', 'music', 'comedy', 'education', 'business',
  'art', 'pets', 'family', 'other'
);

-- Platform Enum
CREATE TYPE platform_type AS ENUM ('instagram', 'tiktok');

-- Scraping Status Enum
CREATE TYPE scraping_status AS ENUM ('pending', 'in_progress', 'completed', 'failed', 'rate_limited');

-- Main creators table
CREATE TABLE creators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(255) NOT NULL,
  platform platform_type NOT NULL,
  display_name VARCHAR(255),
  bio TEXT,
  profile_image_url TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  follower_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  location VARCHAR(255),
  website_url TEXT,
  email VARCHAR(255),
  
  -- Scraping metadata
  first_scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  scraping_status scraping_status DEFAULT 'pending',
  scraping_error TEXT,
  scrape_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint on username + platform
  UNIQUE(username, platform)
);

-- Creator categories junction table
CREATE TABLE creator_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID REFERENCES creators(id) ON DELETE CASCADE,
  category creator_category NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(creator_id, category)
);

-- Instagram specific metrics
CREATE TABLE instagram_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID REFERENCES creators(id) ON DELETE CASCADE,
  
  -- Core metrics (scraped data)
  follower_count INTEGER NOT NULL DEFAULT 0,
  following_count INTEGER NOT NULL DEFAULT 0,
  post_count INTEGER NOT NULL DEFAULT 0,
  
  -- Calculated engagement metrics
  average_likes DECIMAL(10,2) DEFAULT 0,
  average_comments DECIMAL(10,2) DEFAULT 0,
  engagement_rate DECIMAL(5,2) DEFAULT 0,
  
  -- Metadata
  scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TikTok specific metrics
CREATE TABLE tiktok_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID REFERENCES creators(id) ON DELETE CASCADE,
  
  -- Core metrics (scraped data)
  follower_count INTEGER NOT NULL DEFAULT 0,
  following_count INTEGER NOT NULL DEFAULT 0,
  like_count INTEGER NOT NULL DEFAULT 0,
  video_count INTEGER NOT NULL DEFAULT 0,
  
  -- Calculated engagement metrics
  average_views DECIMAL(10,2) DEFAULT 0,
  average_likes DECIMAL(10,2) DEFAULT 0,
  engagement_rate DECIMAL(5,2) DEFAULT 0,
  
  -- Metadata
  scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_creators_platform ON creators(platform);
CREATE INDEX idx_creators_username ON creators(username);
CREATE INDEX idx_creators_last_scraped ON creators(last_scraped_at);
CREATE INDEX idx_creators_follower_count ON creators(follower_count); 