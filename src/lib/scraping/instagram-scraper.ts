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
      
      console.log('🎯 Strategy: Try anonymous access first, login as fallback');
      
      const profileUrl = `https://www.instagram.com/${username}/`;
      console.log(`📱 Navigating to: ${profileUrl}`);

      // Try direct profile access first (often works for public profiles)
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
        console.log('✅ Profile content loaded successfully without login');
      } catch {
        // If main selectors fail, try profile-specific selectors
        try {
          await this.page.waitForSelector('h2, [data-testid], img[alt*="profile"]', { 
            timeout: 15000 
          });
          contentLoaded = true;
          console.log('✅ Profile elements found without login');
        } catch {
          console.log('⚠️ Direct access failed, checking if login is required...');
        }
      }

      // If direct access failed, check what kind of restriction we're dealing with
      if (!contentLoaded) {
        const accessCheck = await this.checkAccessRestrictions(username);
        
        // If it's just a login requirement, try authenticating
        if (!accessCheck.success && accessCheck.error?.includes('login')) {
          console.log('🔑 Direct access blocked, attempting login...');
          
          const loginResult = await this.attemptLogin();
          if (loginResult) {
            console.log('🎉 Login successful, retrying profile access...');
            
            // Navigate to profile again after successful login
            await this.page.goto(profileUrl, { 
              waitUntil: 'networkidle',
              timeout: 45000 
            });
            
            // Try loading content again
            try {
              await this.page.waitForSelector('main, [role="main"], article, section', { 
                timeout: 20000 
              });
              contentLoaded = true;
              console.log('✅ Profile accessible after authentication');
            } catch {
              console.log('❌ Profile still not accessible even after login');
            }
          } else {
            console.log('❌ Login failed, Instagram challenge/verification required');
            return {
              success: false,
              error: 'Instagram requires identity verification for this login attempt. This happens when logging in from new locations (like Vercel servers). Solutions: 1) Access Instagram manually first to complete verification, 2) Try different public profiles like @instagram, @nike, @cocacola, or 3) Use a different Instagram account.',
              method: 'Playwright with Sparticuz Chromium'
            };
          }
        } else {
          // Return the original access restriction error
          return accessCheck;
        }
      }

      // If we still couldn't load content, it might be blocked
      if (!contentLoaded) {
        console.log('⚠️ Content not loading, likely access restricted');
        return {
          success: false,
          error: this.isLoggedIn 
            ? 'Instagram profile access restricted even with login - profile may be private or suspended'
            : 'Instagram profile access restricted - try popular public profiles like @instagram, @nike, @cocacola',
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
        method: 'Playwright with Sparticuz Chromium' + (this.isLoggedIn ? ' (Authenticated)' : ' (Anonymous)')
      };

    } catch (error) {
      console.error('❌ Instagram scraping failed:', error);
      return {
        success: false,
        error: `Instagram analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}. Try popular public profiles like @instagram, @nike, @cocacola.`,
        method: 'Playwright with Sparticuz Chromium' + (this.isLoggedIn ? ' (Authenticated)' : '')
      };
    } finally {
      await this.cleanup();
    }
  }

  private async attemptLogin(): Promise<boolean> {
    if (!this.page) return false;

    // Check if credentials are available with detailed logging
    const username = process.env.INSTAGRAM_USERNAME;
    const password = process.env.INSTAGRAM_PASSWORD;

    console.log('🔍 Environment check:');
    console.log(`- INSTAGRAM_USERNAME exists: ${!!username}`);
    console.log(`- INSTAGRAM_PASSWORD exists: ${!!password}`);
    console.log(`- NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`- VERCEL: ${process.env.VERCEL}`);

    if (!username || !password) {
      console.log('📝 No Instagram credentials found in environment variables, proceeding without login');
      return false;
    }

    try {
      console.log('🔑 Attempting Instagram login...');
      console.log(`👤 Username: ${username.substring(0, 3)}***`);
      
      // Navigate to Instagram login page
      await this.page.goto('https://www.instagram.com/accounts/login/', {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      console.log('📍 Reached login page, waiting for form...');

      // Wait for login form to load with multiple selector attempts
      let formFound = false;
      const formSelectors = [
        'input[name="username"]',
        'input[type="text"]',
        'form input[autocomplete="username"]'
      ];

      for (const selector of formSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 5000 });
          console.log(`✅ Found login form with selector: ${selector}`);
          formFound = true;
          break;
        } catch {
          console.log(`❌ Selector failed: ${selector}`);
        }
      }

      if (!formFound) {
        console.log('❌ Could not find login form');
        return false;
      }

      // Take a screenshot for debugging
      try {
        const debugScreenshot = await this.page.screenshot({ 
          type: 'png',
          fullPage: false 
        });
        console.log(`📸 Login page screenshot captured (${debugScreenshot.length} bytes)`);
      } catch {
        console.log('⚠️ Could not capture debug screenshot');
      }

      // Fill in credentials with very human-like behavior
      console.log('✍️ Filling username field...');
      await this.page.click('input[name="username"]');
      await this.page.fill('input[name="username"]', ''); // Clear first
      await this.page.type('input[name="username"]', username, { delay: 100 });
      
      // Random delay between fields
      const delay = 2000 + Math.random() * 2000; // 2-4 seconds
      console.log(`⏳ Waiting ${Math.round(delay)}ms between fields...`);
      await this.page.waitForTimeout(delay);
      
      console.log('✍️ Filling password field...');
      await this.page.click('input[name="password"]');
      await this.page.fill('input[name="password"]', ''); // Clear first
      await this.page.type('input[name="password"]', password, { delay: 120 });
      
      // Wait a bit before submitting
      await this.page.waitForTimeout(1500 + Math.random() * 1000);
      
      // Find and click submit button
      const submitSelectors = [
        'button[type="submit"]',
        'button:has-text("Log in")',
        'button:has-text("Log In")',
        'input[type="submit"]'
      ];

      let submitClicked = false;
      for (const selector of submitSelectors) {
        try {
          const submitButton = await this.page.$(selector);
          if (submitButton) {
            await submitButton.click();
            console.log(`📤 Clicked submit button: ${selector}`);
            submitClicked = true;
            break;
          }
        } catch {
          console.log(`❌ Submit selector failed: ${selector}`);
        }
      }

      if (!submitClicked) {
        console.log('❌ Could not find submit button');
        return false;
      }

      // Wait for navigation and log the process
      console.log('⏳ Waiting for login response...');
      await this.page.waitForTimeout(10000); // Wait longer

      // Check current URL and page state with detailed logging
      const currentUrl = this.page.url();
      const pageTitle = await this.page.title();
      console.log(`🔍 After login attempt:`);
      console.log(`- URL: ${currentUrl}`);
      console.log(`- Title: ${pageTitle}`);
      
      // Check page content for debugging
      const bodyText = await this.page.textContent('body') || '';
      const hasHomeLink = bodyText.includes('Home') || bodyText.includes('home');
      const hasProfileLink = bodyText.includes('Profile') || bodyText.includes('profile');
      
      console.log(`- Page contains 'Home': ${hasHomeLink}`);
      console.log(`- Page contains 'Profile': ${hasProfileLink}`);

      // Check for Instagram's identity verification challenge (NOT 2FA)
      if (currentUrl.includes('/challenge/') || 
          await this.page.$('input[name="verificationCode"]') ||
          await this.page.$('[data-testid="challenge-form"]')) {
        
        console.log('🔒 Instagram identity verification required');
        console.log('💡 This is NOT 2FA - it\'s Instagram\'s "suspicious login" protection');
        console.log('💡 Instagram blocks logins from new locations (like Vercel servers)');
        console.log('💡 This is different from your account having 2FA enabled');
        return false; // Login failed due to challenge
      }

      // Look for error messages
      const errorText = bodyText.toLowerCase();
      if (errorText.includes('incorrect') || 
          errorText.includes('wrong') || 
          errorText.includes('error') ||
          errorText.includes('try again')) {
        console.log('❌ Login error detected in page content');
        console.log(`Error indicators found in: ${errorText.substring(0, 200)}...`);
        return false;
      }

      // Check for common login success indicators
      const successIndicators = [
        currentUrl.includes('/accounts/onetap/'),
        currentUrl === 'https://www.instagram.com/',
        currentUrl.includes('/accounts/welcomeback/'),
        await this.page.$('[aria-label*="Home"]'),
        await this.page.$('[data-testid="mobile-nav-logged-in"]'),
        hasHomeLink && hasProfileLink
      ];

      const successCount = successIndicators.filter(Boolean).length;
      console.log(`✅ Success indicators found: ${successCount}/6`);

      if (successCount >= 2) {
        console.log('✅ Instagram login appears successful');
        this.isLoggedIn = true;
        await this.handlePostLoginPrompts();
        return true;
      }

      // If we're still on login page, login failed
      if (currentUrl.includes('/accounts/login/')) {
        console.log('⚠️ Still on login page after submission');
        console.log('💡 This might indicate incorrect credentials or Instagram blocking the login');
        return false;
      }

      console.log('⚠️ Login status unclear, treating as failed');
      return false;

    } catch (error) {
      console.error('❌ Login attempt crashed:', error);
      return false;
    }
  }

  private async handlePostLoginPrompts() {
    if (!this.page) return;

    // Handle "Save Login Info" prompt
    try {
      await this.page.waitForTimeout(2000);
      const saveInfoSelectors = [
        'button:has-text("Not Now")',
        'button:has-text("Save Info")',
        '[data-testid="save-login-info"]'
      ];

      for (const selector of saveInfoSelectors) {
        const button = await this.page.$(selector);
        if (button) {
          const buttonText = await button.textContent();
          if (buttonText?.includes('Not Now')) {
            await button.click();
            console.log('📱 Dismissed save login info prompt');
            break;
          }
        }
      }
    } catch {
      // Ignore if prompt doesn't appear
    }

    // Handle "Turn on Notifications" prompt  
    try {
      await this.page.waitForTimeout(2000);
      const notificationSelectors = [
        'button:has-text("Not Now")',
        'button:has-text("Turn On")',
        '[data-testid="turn-on-notifications"]'
      ];

      for (const selector of notificationSelectors) {
        const button = await this.page.$(selector);
        if (button) {
          const buttonText = await button.textContent();
          if (buttonText?.includes('Not Now')) {
            await button.click();
            console.log('🔕 Dismissed notification prompt');
            break;
          }
        }
      }
    } catch {
      // Ignore if prompt doesn't appear
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
        
        // Check if user has credentials but they're not working (likely 2FA)
        const hasCredentials = process.env.INSTAGRAM_USERNAME && process.env.INSTAGRAM_PASSWORD;
        const errorMessage = hasCredentials 
          ? 'Instagram login failed (likely due to 2FA). Solutions: 1) Temporarily disable 2FA on your Instagram account, 2) Use an account without 2FA, or 3) Try different profiles like @instagram, @nike, @cocacola which are sometimes accessible.'
          : 'Instagram requires login for this profile. Add INSTAGRAM_USERNAME and INSTAGRAM_PASSWORD to your .env.local file for authenticated access, or try popular public profiles like @instagram, @nike, @cocacola.';
        
        return {
          success: false,
          error: errorMessage,
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