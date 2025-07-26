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
  private isLoggedIn = false;

  async analyzeProfile(username: string): Promise<InstagramScrapingResult> {
    try {
      console.log(`🔍 Starting Instagram analysis for: ${username}`);
      
      // Initialize browser with Sparticuz chromium if available
      await this.initBrowser();
      
      if (!this.page) {
        throw new Error('Browser page not initialized');
      }

      // Enhanced stealth setup
      await this.setupStealth();
      
      // Attempt login if credentials are available
      await this.attemptLogin();
      
      const profileUrl = `https://www.instagram.com/${username}/`;
      console.log(`📱 Navigating to: ${profileUrl}`);

      // Navigate with extended timeout for serverless
      await this.page.goto(profileUrl, { 
        waitUntil: 'networkidle',
        timeout: 45000 // 45 seconds for serverless
      });

      // Add random delay to appear more human
      await this.page.waitForTimeout(2000 + Math.random() * 3000);

      // Wait for page to load - try multiple selectors with extended timeout
      console.log('⏳ Waiting for page elements to load...');
      
      let contentLoaded = false;
      try {
        // Try to find main content area with multiple possible selectors
        await this.page.waitForSelector('main, [role="main"], article, section', { 
          timeout: 20000 // 20 seconds for element detection
        });
        contentLoaded = true;
      } catch {
        // If main selectors fail, try profile-specific selectors
        try {
          await this.page.waitForSelector('h2, [data-testid], img[alt*="profile"]', { 
            timeout: 15000 
          });
          contentLoaded = true;
        } catch {
          console.log('⚠️ Standard selectors failed, checking for access restrictions...');
        }
      }

      // Only check access restrictions if we're not logged in
      if (!this.isLoggedIn) {
        const accessCheck = await this.checkAccessRestrictions(username);
        if (!accessCheck.success) {
          return accessCheck;
        }
      }

      // If we couldn't load content and no specific error, it might be blocked
      if (!contentLoaded) {
        console.log('⚠️ Content not loading, likely access restricted');
        return {
          success: false,
          error: this.isLoggedIn 
            ? 'Instagram profile access restricted even with login - profile may be private or suspended'
            : 'Instagram profile access restricted - try again later or use a different profile',
          method: 'Playwright with Sparticuz Chromium' + (this.isLoggedIn ? ' (Authenticated)' : '')
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
        method: 'Playwright with Sparticuz Chromium' + (this.isLoggedIn ? ' (Authenticated)' : '')
      };

    } catch (error) {
      console.error('❌ Instagram scraping failed:', error);
      return {
        success: false,
        error: `Instagram analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}. ${this.isLoggedIn ? '' : 'Note: Instagram may require login for some profiles.'}`,
        method: 'Playwright with Sparticuz Chromium' + (this.isLoggedIn ? ' (Authenticated)' : '')
      };
    } finally {
      await this.cleanup();
    }
  }

  private async attemptLogin(): Promise<boolean> {
    if (!this.page) return false;

    // Check if credentials are available
    const username = process.env.INSTAGRAM_USERNAME;
    const password = process.env.INSTAGRAM_PASSWORD;

    if (!username || !password) {
      console.log('📝 No Instagram credentials found in environment variables, proceeding without login');
      return false;
    }

    try {
      console.log('🔑 Attempting Instagram login...');
      
      // Navigate to Instagram login page
      await this.page.goto('https://www.instagram.com/accounts/login/', {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      // Wait for login form to load
      await this.page.waitForSelector('input[name="username"]', { timeout: 15000 });
      
      // Fill in credentials
      await this.page.fill('input[name="username"]', username);
      await this.page.waitForTimeout(1000); // Small delay between inputs
      await this.page.fill('input[name="password"]', password);
      
      // Submit login form
      await this.page.click('button[type="submit"]');
      console.log('📤 Login form submitted');

      // Wait for navigation after login
      await this.page.waitForTimeout(5000);

      // Check if login was successful
      const currentUrl = this.page.url();
      
      // Check for common login success indicators
      if (currentUrl.includes('/accounts/onetap/') || 
          currentUrl === 'https://www.instagram.com/' ||
          await this.page.$('[aria-label*="Home"]')) {
        
        console.log('✅ Instagram login successful');
        this.isLoggedIn = true;

        // Handle potential "Save Login Info" prompt
        try {
          const saveInfoButton = await this.page.$('button:has-text("Not Now")');
          if (saveInfoButton) {
            await saveInfoButton.click();
            console.log('📱 Dismissed save login info prompt');
          }
        } catch {
          // Ignore if prompt doesn't appear
        }

        // Handle potential "Turn on Notifications" prompt  
        try {
          const notificationButton = await this.page.$('button:has-text("Not Now")');
          if (notificationButton) {
            await notificationButton.click();
            console.log('🔕 Dismissed notification prompt');
          }
        } catch {
          // Ignore if prompt doesn't appear
        }

        return true;
      }

      // Check for login errors
      const errorElement = await this.page.$('div[id*="error"], p[data-testid="login-error-message"]');
      if (errorElement) {
        const errorText = await errorElement.textContent();
        console.error('❌ Instagram login failed:', errorText);
        return false;
      }

      // Check for 2FA requirement
      if (currentUrl.includes('/challenge/') || await this.page.$('input[name="verificationCode"]')) {
        console.log('🔐 Two-factor authentication required - cannot proceed automatically');
        return false;
      }

      console.log('⚠️ Login status unclear, proceeding without authentication');
      return false;

    } catch (error) {
      console.error('❌ Login attempt failed:', error);
      return false;
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
    });
  }

  private async checkAccessRestrictions(username: string): Promise<InstagramScrapingResult> {
    if (!this.page) {
      throw new Error('Page not available');
    }

    // Get page content for analysis
    const pageText = await this.page.textContent('body') || '';
    const pageTitle = await this.page.title();

    // Check for login requirement (only relevant when not logged in)
    const loginSelectors = [
      'input[name="username"]', 
      '[data-testid="loginForm"]',
      'form[id="loginForm"]',
      'a[href*="login"]'
    ];

    for (const selector of loginSelectors) {
      if (await this.page.$(selector)) {
        console.log('🔒 Login required - Instagram is blocking automated access');
        return {
          success: false,
          error: 'Instagram requires login for this profile. Consider adding INSTAGRAM_USERNAME and INSTAGRAM_PASSWORD to your environment variables for authenticated access.',
          method: 'Playwright with Sparticuz Chromium'
        };
      }
    }

    // Check for profile not found
    const notFoundMessages = [
      'Sorry, this page isn\'t available',
      'The link you followed may be broken',
      'User not found',
      'Page Not Found'
    ];

    for (const message of notFoundMessages) {
      if (pageText.includes(message) || pageTitle.includes(message)) {
        return {
          success: false,
          error: `Instagram profile @${username} not found or may be private`,
          method: 'Playwright with Sparticuz Chromium'
        };
      }
    }

    // Check for rate limiting
    const rateLimitMessages = [
      'Try again later',
      'Please wait a few minutes',
      'Too many requests',
      'Rate limit'
    ];

    for (const message of rateLimitMessages) {
      if (pageText.includes(message)) {
        return {
          success: false,
          error: 'Instagram rate limiting detected. Please try again in a few minutes.',
          method: 'Playwright with Sparticuz Chromium'
        };
      }
    }

    // Check for private account
    if (pageText.includes('This Account is Private')) {
      return {
        success: false,
        error: `Instagram account @${username} is private and cannot be analyzed`,
        method: 'Playwright with Sparticuz Chromium'
      };
    }

    // Check for suspicious activity detection
    const suspiciousMessages = [
      'Suspicious Login Attempt',
      'We suspect automated behavior',
      'unusual activity'
    ];

    for (const message of suspiciousMessages) {
      if (pageText.includes(message)) {
        return {
          success: false,
          error: 'Instagram detected automated behavior. This is common with serverless environments.',
          method: 'Playwright with Sparticuz Chromium'
        };
      }
    }

    // If we get here, no restrictions detected
    return { success: true, method: 'Playwright with Sparticuz Chromium' };
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