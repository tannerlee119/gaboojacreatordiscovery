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
      
      if (!this.page) {
        throw new Error('Browser page not initialized');
      }

      // Enhanced stealth setup - be more aggressive about appearing human
      await this.setupStealth();
      
      // Add some additional stealth measures
      await this.page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-User': '?1',
        'Sec-Fetch-Dest': 'document'
      });
      
      console.log('🎯 Strategy: Direct access with enhanced stealth');
      
      const profileUrl = `https://www.instagram.com/${username}/`;
      console.log(`📱 Navigating to: ${profileUrl}`);

      // Navigate directly to the profile
      await this.page.goto(profileUrl, { 
        waitUntil: 'domcontentloaded', // Less strict waiting
        timeout: 45000
      });

      // Human-like delays
      await this.page.waitForTimeout(3000 + Math.random() * 2000);

      // Try to wait for profile content - simple approach
      console.log('⏳ Waiting for profile content...');
      
      let success = false;
      
      try {
        // Wait for any content to load, then check what we got
        await this.page.waitForSelector('body', { timeout: 10000 });
        
        // Check if we can find profile indicators
        const pageContent = await this.page.textContent('body') || '';
        const currentUrl = this.page.url();
        
        // Simple check - if we see profile-like content, proceed
        const hasProfileContent = (
          pageContent.includes('posts') ||
          pageContent.includes('followers') ||
          pageContent.includes('following') ||
          pageContent.includes(username)
        ) && !currentUrl.includes('/accounts/login/');
        
        if (hasProfileContent) {
          console.log('✅ Profile content detected');
          success = true;
        } else {
          console.log('⚠️ No profile content found or redirected to login');
          
          // Check if this is a login requirement or other issue
          if (currentUrl.includes('/accounts/login/') || pageContent.includes('Log in')) {
            console.log('🔒 Instagram requires login for this profile');
            return {
              success: false,
              error: `Instagram requires login to view @${username}. This often happens for:\n• Private accounts\n• New or restricted profiles\n• When Instagram detects automated access\n\nTry popular public profiles like @instagram, @nike, @cocacola, or @natgeo instead.`,
              method: 'Playwright with Sparticuz Chromium'
            };
          } else if (pageContent.includes('Page Not Found') || pageContent.includes("isn't available")) {
            console.log('❌ Profile not found');
            return {
              success: false,
              error: `Instagram profile @${username} not found or may be private`,
              method: 'Playwright with Sparticuz Chromium'
            };
          } else {
            console.log('❓ Unknown response from Instagram');
            return {
              success: false,
              error: `Unable to access @${username}. Instagram may be blocking automated access. Try popular public profiles like @instagram, @nike, @cocacola.`,
              method: 'Playwright with Sparticuz Chromium'
            };
          }
        }
      } catch {
        console.log('⚠️ Timeout waiting for content');
        return {
          success: false,
          error: `Timeout accessing @${username}. Instagram may be slow or blocking access. Try popular public profiles like @instagram, @nike, @cocacola.`,
          method: 'Playwright with Sparticuz Chromium'
        };
      }

      if (!success) {
        return {
          success: false,
          error: `Unable to load profile for @${username}. Try popular public profiles like @instagram, @nike, @cocacola.`,
          method: 'Playwright with Sparticuz Chromium'
        };
      }

      // Extract profile data
      console.log('📊 Extracting profile data...');
      const profileData = await this.extractProfileData(username);
      
      // Take screenshot
      let screenshot: Buffer | undefined;
      try {
        screenshot = await this.page.screenshot({
          type: 'jpeg',
          quality: 70,
          clip: { x: 0, y: 0, width: 1000, height: 800 }
        });
        console.log('📸 Screenshot captured successfully');
      } catch {
        console.log('⚠️ Screenshot capture failed, continuing without it');
      }

      return {
        success: true,
        data: profileData,
        screenshot,
        method: 'Playwright with Sparticuz Chromium (Anonymous)'
      };

    } catch (error) {
      console.error('❌ Instagram scraping failed:', error);
      return {
        success: false,
        error: `Instagram analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}. Try popular public profiles like @instagram, @nike, @cocacola.`,
        method: 'Playwright with Sparticuz Chromium'
      };
    } finally {
      await this.cleanup();
    }
  }

  private async setupStealth() {
    if (!this.page) return;

    console.log('🥷 Setting up stealth techniques...');

    // Set realistic viewport with some variation
    const viewportOptions = [
      { width: 1366, height: 768 },
      { width: 1920, height: 1080 },
      { width: 1440, height: 900 },
      { width: 1536, height: 864 }
    ];
    
    const randomViewport = viewportOptions[Math.floor(Math.random() * viewportOptions.length)];
    await this.page.setViewportSize(randomViewport);

    // Set additional headers to appear more legitimate
    await this.page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    });

    // Override navigator properties to reduce detection
    await this.page.addInitScript(() => {
      // Override webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      // Override plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });

      // Override languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });

      // Override platform
      Object.defineProperty(navigator, 'platform', {
        get: () => 'MacIntel',
      });
    });
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