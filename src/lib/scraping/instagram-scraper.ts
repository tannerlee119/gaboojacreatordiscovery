import { PlaywrightBaseScraper, ScrapingResult } from './playwright-base-scraper';
import { InstagramMetrics } from '@/lib/types';

interface InstagramScrapingResult extends ScrapingResult {
  data?: {
    displayName: string;
    bio?: string;
    profileImageUrl: string;
    isVerified: boolean;
    followerCount: number;
    followingCount: number;
    location?: string;
    website?: string;
    metrics: InstagramMetrics;
  };
}

class InstagramScraper extends PlaywrightBaseScraper {
  async analyzeProfile(username: string): Promise<InstagramScrapingResult> {
    try {
      console.log(`🔍 Starting Instagram analysis for: ${username}`);
      
      // Initialize browser with Sparticuz chromium if available
      await this.initBrowser();
      
      const profileUrl = `https://www.instagram.com/${username}/`;
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
      await this.page.waitForTimeout(3000);

      // Check for error states
      const errorMessages = [
        'Sorry, this page isn\'t available',
        'The link you followed may be broken',
        'User not found',
        'This account is private'
      ];

      const pageText = await this.page.textContent('body') || '';
      
      for (const errorMsg of errorMessages) {
        if (pageText.includes(errorMsg)) {
          return {
            success: false,
            error: errorMsg.includes('private') ? 
              `Instagram account @${username} is private` : 
              `Instagram account @${username} does not exist`,
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
      console.error('❌ Instagram scraping failed:', error);
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

    // Wait for profile header to load
    await this.page.waitForSelector('header', { timeout: 10000 });

    // Extract basic profile information
    const displayName = await this.page.textContent('header h2') || 
                       await this.page.textContent('header h1') || 
                       username;

    const bio = await this.page.textContent('header + div span') || '';

    // Extract follower/following counts
    const statsText = await this.page.textContent('header') || '';
    const followerMatch = statsText.match(/(\d+(?:,\d{3})*|\d+\.?\d*[KMB]?)\s*followers?/i);
    const followingMatch = statsText.match(/(\d+(?:,\d{3})*|\d+\.?\d*[KMB]?)\s*following/i);

    const followerCount = followerMatch ? this.parseNumber(followerMatch[1]) : 0;
    const followingCount = followingMatch ? this.parseNumber(followingMatch[1]) : 0;

    // Check verification
    const isVerified = await this.page.locator('[aria-label*="Verified"]').count() > 0;

    // Extract profile image
    const profileImageUrl = await this.page.getAttribute('header img', 'src') || '';

    // Build metrics
    const metrics: InstagramMetrics = {
      followerCount,
      followingCount,
      postCount: 0, // Instagram makes this harder to scrape now
      averageLikes: 0,
      averageComments: 0,
      engagementRate: 0,
      recentPosts: []
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

export async function analyzeInstagramProfile(username: string): Promise<InstagramScrapingResult> {
  const scraper = new InstagramScraper();
  return scraper.analyzeProfile(username);
} 