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
        throw new Error('Browser page not initialized');
      }

      // Navigate with extended timeout for serverless
      await this.page.goto(profileUrl, { 
        waitUntil: 'networkidle',
        timeout: 45000 // 45 seconds for serverless
      });

      // Wait for page to load - try multiple selectors with extended timeout
      console.log('⏳ Waiting for page elements to load...');
      
      try {
        // Try to find main content area with multiple possible selectors
        await this.page.waitForSelector('main, [role="main"], article, section', { 
          timeout: 20000 // 20 seconds for element detection
        });
      } catch {
        // If main selectors fail, try profile-specific selectors
        try {
          await this.page.waitForSelector('h2, [data-testid], img[alt*="profile"]', { 
            timeout: 15000 
          });
        } catch {
          console.log('⚠️ Standard selectors failed, checking for login or error states...');
        }
      }

      // Check for login prompt or access restrictions
      const loginPrompt = await this.page.$('input[name="username"], [data-testid="loginForm"]');
      if (loginPrompt) {
        console.log('🔒 Login required - Instagram is blocking access');
        return {
          success: false,
          error: 'Instagram requires login to access this profile',
          method: 'Playwright with Sparticuz Chromium'
        };
      }

      // Check if profile exists
      const pageText = await this.page.textContent('body') || '';
      if (pageText.includes('Sorry, this page isn\'t available')) {
        return {
          success: false,
          error: 'Profile not found',
          method: 'Playwright with Sparticuz Chromium'
        };
      }

      // Extract profile data with enhanced error handling
      const profileData = await this.extractProfileData(username);
      
      // Take screenshot (smaller size for serverless efficiency)
      let screenshot: Buffer | undefined;
      try {
        screenshot = await this.page.screenshot({
          type: 'jpeg',
          quality: 60, // Reduced quality for smaller file size
          clip: { x: 0, y: 0, width: 800, height: 600 } // Smaller viewport
        });
        console.log('📸 Screenshot captured successfully');
      } catch {
        console.log('⚠️ Screenshot capture failed, continuing without it');
      }

      return {
        success: true,
        data: profileData,
        screenshot,
        method: 'Playwright with Sparticuz Chromium'
      };

    } catch (error) {
      console.error('❌ Instagram scraping failed:', error);
      return {
        success: false,
        error: `Instagram scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        method: 'Playwright with Sparticuz Chromium'
      };
    } finally {
      await this.cleanup();
    }
  }

  private async extractProfileData(username: string) {
    if (!this.page) {
      throw new Error('Page not available');
    }

    console.log('📊 Extracting profile data...');
    
    // Extract data using multiple strategies
    const profileData = await this.page.evaluate((pageUsername) => {
      // Strategy 1: Try to find structured data
      const getTextContent = (selector: string): string => {
        const element = document.querySelector(selector);
        return element?.textContent?.trim() || '';
      };

      const getAttributeContent = (selector: string, attribute: string): string => {
        const element = document.querySelector(selector);
        return element?.getAttribute(attribute) || '';
      };

      // Try multiple selectors for display name
      let displayName = '';
      const displayNameSelectors = [
        'h2', 
        '[data-testid*="username"]',
        'header h1',
        'header h2',
        'span[title]'
      ];
      
      for (const selector of displayNameSelectors) {
        displayName = getTextContent(selector);
        if (displayName && displayName !== pageUsername) break;
      }

      // Try multiple selectors for bio
      let bio = '';
      const bioSelectors = [
        '[data-testid*="bio"]',
        'div[dir] span',
        'header div:last-child span',
        '-webkit-box span'
      ];
      
      for (const selector of bioSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent && element.textContent.length > 20) {
          bio = element.textContent.trim();
          break;
        }
      }

      // Try to find profile image
      let profileImageUrl = '';
      const imgSelectors = [
        `img[alt*="${pageUsername}"]`,
        'img[alt*="profile picture"]',
        'header img',
        'img[src*="profile"]'
      ];
      
      for (const selector of imgSelectors) {
        profileImageUrl = getAttributeContent(selector, 'src');
        if (profileImageUrl) break;
      }

      // Check for verification badge
      const isVerified = !!(
        document.querySelector('[aria-label*="Verified"]') ||
        document.querySelector('[data-testid*="verified"]') ||
        document.querySelector('svg[aria-label*="Verified"]')
      );

      return {
        displayName: displayName || pageUsername,
        bio: bio || undefined,
        profileImageUrl: profileImageUrl || '',
        isVerified,
        rawContent: document.body.innerText // For follower count parsing
      };
    }, username);

    // Parse follower/following counts from page content
    let followerCount = 0;
    let followingCount = 0;
    
    try {
      // Look for follower patterns in the content
      const followerMatches = profileData.rawContent.match(/(\d+(?:[.,]\d+)*)\s*(?:K|M|B)?\s*followers?/i);
      if (followerMatches) {
        followerCount = this.parseCount(followerMatches[1]);
      }

      const followingMatches = profileData.rawContent.match(/(\d+(?:[.,]\d+)*)\s*(?:K|M|B)?\s*following/i);
      if (followingMatches) {
        followingCount = this.parseCount(followingMatches[1]);
      }
    } catch {
      console.log('⚠️ Could not parse follower counts from content');
    }

    // Extract posts count
    let postCount = 0;
    try {
      const postMatches = profileData.rawContent.match(/(\d+(?:[.,]\d+)*)\s*(?:K|M|B)?\s*posts?/i);
      if (postMatches) {
        postCount = this.parseCount(postMatches[1]);
      }
    } catch {
      console.log('⚠️ Could not parse post count from content');
    }

    // Try to extract location and website
    let location: string | undefined;
    let website: string | undefined;
    
    try {
      // Look for location in bio or profile info
      const locationMatch = profileData.rawContent.match(/📍\s*([^\n]+)/);
      if (locationMatch) {
        location = locationMatch[1].trim();
      }

      // Look for website links
      const urlMatch = profileData.rawContent.match(/(https?:\/\/[^\s]+)/);
      if (urlMatch) {
        website = urlMatch[1];
      }
    } catch {
      // Location and website are optional, ignore errors
    }

    const metrics: InstagramMetrics = {
      followerCount,
      followingCount,
      postCount,
      averageLikes: 0, // Would need to analyze posts for this
      averageComments: 0, // Would need to analyze posts for this
      engagementRate: 0, // Would need to calculate from posts
      recentPosts: [] // Add empty array to satisfy interface requirement
    };

    return {
      displayName: profileData.displayName,
      bio: profileData.bio,
      profileImageUrl: profileData.profileImageUrl,
      isVerified: profileData.isVerified,
      followerCount,
      followingCount,
      location,
      website,
      metrics
    };
  }

  private parseCount(countStr: string): number {
    try {
      // Remove commas and convert to number
      const cleanStr = countStr.replace(/,/g, '');
      const num = parseFloat(cleanStr);
      
      // Handle K, M, B suffixes
      if (countStr.includes('K')) return Math.round(num * 1000);
      if (countStr.includes('M')) return Math.round(num * 1000000);
      if (countStr.includes('B')) return Math.round(num * 1000000000);
      
      return Math.round(num);
    } catch {
      return 0;
    }
  }
}

export const instagramScraper = new InstagramScraper();

export async function analyzeInstagramProfile(username: string): Promise<InstagramScrapingResult> {
  const scraper = new InstagramScraper();
  return scraper.analyzeProfile(username);
} 