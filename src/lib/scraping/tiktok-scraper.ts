import { PlaywrightBaseScraper, ScrapingResult } from './playwright-base-scraper';
import { TikTokMetrics } from '@/lib/types';

interface TikTokScrapingResult extends ScrapingResult {
  data?: {
    displayName: string;
    bio?: string;
    profileImageUrl: string;
    isVerified: boolean;
    followerCount: number;
    followingCount: number;
    location?: string;
    website?: string;
    metrics: TikTokMetrics;
  };
}

class TikTokScraper extends PlaywrightBaseScraper {
  async analyzeProfile(username: string): Promise<TikTokScrapingResult> {
    try {
      console.log(`🔍 Starting TikTok analysis for: ${username}`);
      
      // Initialize browser with Sparticuz chromium if available
      await this.initBrowser();
      
      const profileUrl = `https://www.tiktok.com/@${username}`;
      console.log(`📱 Navigating to: ${profileUrl}`);
      
      if (!this.page) {
        throw new Error('Page not initialized');
      }

      // Navigate to profile with retry logic
      let retries = 3;
      while (retries > 0) {
        try {
          await this.page.goto(profileUrl, { 
            waitUntil: 'networkidle', 
            timeout: 30000 
          });
          break;
        } catch (error) {
          retries--;
          console.log(`⚠️ Navigation attempt failed, ${retries} retries left`);
          if (retries === 0) throw error;
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      // Wait for page to load
      await this.page.waitForTimeout(5000);

      // Check for error states
      const errorMessages = [
        'Couldn\'t find this account',
        'Something went wrong',
        'This user doesn\'t exist',
        'User not found'
      ];

      const pageText = await this.page.textContent('body') || '';
      
      for (const errorMsg of errorMessages) {
        if (pageText.includes(errorMsg)) {
          return {
            success: false,
            error: `TikTok account @${username} does not exist`,
            method: 'scraping'
          };
        }
      }

      // Extract profile data
      const profileData = await this.extractProfileData(username);
      
      // Take screenshot
      const screenshot = await this.page.screenshot({ 
        fullPage: true,
        type: 'png'
      });

      return {
        success: true,
        data: profileData,
        screenshot,
        method: 'scraping'
      };

    } catch (error) {
      console.error('❌ TikTok scraping failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        method: 'scraping'
      };
    } finally {
      await this.cleanup();
    }
  }

  private async extractProfileData(username: string) {
    if (!this.page) throw new Error('Page not initialized');

    // Wait for profile data to load
    await this.page.waitForTimeout(3000);

    // Extract display name
    const displayName = await this.page.textContent('[data-e2e="user-title"]') || 
                       await this.page.textContent('h1') || 
                       await this.page.textContent('h2') ||
                       username;

    // Extract bio
    const bio = await this.page.textContent('[data-e2e="user-bio"]') || '';

    // Extract follower/following counts from stats
    const statsElements = await this.page.locator('[data-e2e="followers-count"], [data-e2e="following-count"]').all();
    
    let followerCount = 0;
    let followingCount = 0;
    let likeCount = 0;

    // Parse stats from visible elements
    for (const element of statsElements) {
      const text = await element.textContent() || '';
      const number = this.parseNumber(text);
      
      const parentText = await element.locator('..').textContent() || '';
      if (parentText.toLowerCase().includes('followers')) {
        followerCount = number;
      } else if (parentText.toLowerCase().includes('following')) {
        followingCount = number;
      } else if (parentText.toLowerCase().includes('likes')) {
        likeCount = number;
      }
    }

    // Check verification
    const isVerified = await this.page.locator('[data-e2e="user-verified"]').count() > 0;

    // Extract profile image
    const profileImageUrl = await this.page.getAttribute('[data-e2e="user-avatar"] img', 'src') || 
                           await this.page.getAttribute('img[alt*="avatar"]', 'src') || '';

    // Build metrics
    const metrics: TikTokMetrics = {
      followerCount,
      followingCount,
      likeCount,
      videoCount: 0, // Would need additional scraping
      averageViews: 0,
      averageLikes: 0,
      engagementRate: 0,
      recentVideos: []
    };

    return {
      displayName: displayName.trim(),
      bio: bio.trim(),
      profileImageUrl,
      isVerified,
      followerCount,
      followingCount,
      metrics
    };
  }

  private parseNumber(str: string): number {
    const cleaned = str.replace(/,/g, '').toLowerCase();
    const number = parseFloat(cleaned);
    
    if (cleaned.includes('k')) return Math.floor(number * 1000);
    if (cleaned.includes('m')) return Math.floor(number * 1000000);
    if (cleaned.includes('b')) return Math.floor(number * 1000000000);
    
    return Math.floor(number);
  }
}

export async function analyzeTikTokProfile(username: string): Promise<TikTokScrapingResult> {
  const scraper = new TikTokScraper();
  return scraper.analyzeProfile(username);
} 