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

      // Set longer timeout for serverless environments
      const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
      const navigationTimeout = isServerless ? 45000 : 30000;
      const selectorTimeout = isServerless ? 20000 : 10000;

      // Navigate to profile with retry logic
      let retries = 3;
      while (retries > 0) {
        try {
          await this.page.goto(profileUrl, { 
            waitUntil: 'networkidle', 
            timeout: navigationTimeout 
          });
          break;
        } catch (error) {
          retries--;
          console.log(`⚠️ Navigation attempt failed, ${retries} retries left`);
          if (retries === 0) throw error;
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }

      // Wait longer for page to load in serverless environment
      await this.page.waitForTimeout(isServerless ? 8000 : 3000);

      // Check for error states first
      const errorMessages = [
        'Sorry, this page isn\'t available',
        'The link you followed may be broken',
        'User not found',
        'This account is private',
        'Page not found'
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

      // Check for login prompt or rate limiting
      const loginDetected = await this.page.locator('input[name="username"]').count() > 0;
      if (loginDetected) {
        console.log('⚠️ Login prompt detected, attempting to continue...');
        // Try to find profile data anyway, sometimes available
      }

      // Extract profile data with enhanced error handling
      const profileData = await this.extractProfileData(username, selectorTimeout);
      
      // Take screenshot
      const screenshot = await this.page.screenshot({ 
        fullPage: false, // Smaller screenshot for serverless
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

  private async extractProfileData(username: string, timeout: number) {
    if (!this.page) throw new Error('Page not initialized');

    // Multiple selector strategies for different Instagram layouts
    const headerSelectors = [
      'header',
      '[role="banner"]',
      'article header',
      'main header',
      '[data-testid="user-header"]',
      'section:first-child'
    ];

    let headerFound = false;
    for (const selector of headerSelectors) {
      try {
        await this.page.waitForSelector(selector, { timeout: timeout / headerSelectors.length });
        console.log(`✅ Found header with selector: ${selector}`);
        headerFound = true;
        break;
      } catch (error) {
        console.log(`⚠️ Header selector ${selector} failed, trying next...`);
        continue;
      }
    }

    if (!headerFound) {
      console.log('⚠️ No header found, attempting to extract from page content...');
    }

    // Extract basic profile information with multiple strategies
    let displayName = username;
    try {
      const nameSelectors = [
        'header h2',
        'header h1', 
        '[data-testid="user-title"]',
        'h1',
        'h2'
      ];
      
      for (const selector of nameSelectors) {
        const element = await this.page.locator(selector).first();
        if (await element.count() > 0) {
          const text = await element.textContent();
          if (text && text.trim()) {
            displayName = text.trim();
            break;
          }
        }
      }
    } catch (error) {
      console.log('⚠️ Could not extract display name, using username');
    }

    // Extract bio
    let bio = '';
    try {
      const bioSelectors = [
        'header + div span',
        '[data-testid="user-bio"]',
        'header span:not([title])',
        'article span'
      ];
      
      for (const selector of bioSelectors) {
        const element = await this.page.locator(selector).first();
        if (await element.count() > 0) {
          const text = await element.textContent();
          if (text && text.trim() && text.length > 10) {
            bio = text.trim();
            break;
          }
        }
      }
    } catch (error) {
      console.log('⚠️ Could not extract bio');
    }

    // Extract follower/following counts with enhanced parsing
    let followerCount = 0;
    let followingCount = 0;

    try {
      // Get all text content and parse numbers
      const pageContent = await this.page.textContent('body') || '';
      
      // Look for follower patterns
      const followerPatterns = [
        /(\d+(?:,\d{3})*|\d+\.?\d*[KMB]?)\s*followers?/gi,
        /followers?\s*(\d+(?:,\d{3})*|\d+\.?\d*[KMB]?)/gi
      ];
      
      for (const pattern of followerPatterns) {
        const matches = pageContent.match(pattern);
        if (matches && matches.length > 0) {
          const numberMatch = matches[0].match(/(\d+(?:,\d{3})*|\d+\.?\d*[KMB]?)/);
          if (numberMatch) {
            followerCount = this.parseNumber(numberMatch[1]);
            break;
          }
        }
      }

      // Look for following patterns
      const followingPatterns = [
        /(\d+(?:,\d{3})*|\d+\.?\d*[KMB]?)\s*following/gi,
        /following\s*(\d+(?:,\d{3})*|\d+\.?\d*[KMB]?)/gi
      ];
      
      for (const pattern of followingPatterns) {
        const matches = pageContent.match(pattern);
        if (matches && matches.length > 0) {
          const numberMatch = matches[0].match(/(\d+(?:,\d{3})*|\d+\.?\d*[KMB]?)/);
          if (numberMatch) {
            followingCount = this.parseNumber(numberMatch[1]);
            break;
          }
        }
      }
    } catch (error) {
      console.log('⚠️ Could not extract follower counts');
    }

    // Check verification with multiple selectors
    let isVerified = false;
    try {
      const verifiedSelectors = [
        '[aria-label*="Verified"]',
        '[title*="Verified"]',
        'svg[aria-label*="Verified"]',
        '.verified'
      ];
      
      for (const selector of verifiedSelectors) {
        if (await this.page.locator(selector).count() > 0) {
          isVerified = true;
          break;
        }
      }
    } catch (error) {
      console.log('⚠️ Could not check verification status');
    }

    // Extract profile image with multiple strategies
    let profileImageUrl = '';
    try {
      const imageSelectors = [
        'header img',
        'img[alt*="profile picture"]',
        'img[data-testid="user-avatar"]',
        'img[src*="profile"]'
      ];
      
      for (const selector of imageSelectors) {
        const element = await this.page.locator(selector).first();
        if (await element.count() > 0) {
          const src = await element.getAttribute('src');
          if (src && src.trim()) {
            profileImageUrl = src.trim();
            break;
          }
        }
      }
    } catch (error) {
      console.log('⚠️ Could not extract profile image');
    }

    console.log(`✅ Extracted data - Followers: ${followerCount}, Following: ${followingCount}, Verified: ${isVerified}`);

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