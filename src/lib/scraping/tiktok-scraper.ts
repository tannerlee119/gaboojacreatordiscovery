import { PlaywrightBaseScraper, ScrapingResult } from './playwright-base-scraper';
import { TikTokMetrics, TikTokVideo } from '@/lib/types';

interface TikTokScrapingResult extends ScrapingResult {
  data?: {
    username: string;
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
    // 1) Fast path – try TikTok public JSON API (no login, no JS)
    try {
      const apiResult = await this.fetchUserJson(username);
      if (apiResult) return apiResult;
    } catch (apiErr) {
      console.log('⚠️ Public API fallback failed:', apiErr);
    }

    try {
      const totalStartTime = Date.now();
      console.log(`🔍 Starting TikTok analysis for: ${username} at ${new Date().toISOString()}`);
      
      // Initialize browser with Sparticuz chromium if available
      const browserStartTime = Date.now();
      await this.initBrowser();
      console.log(`🚀 Browser initialization took: ${Date.now() - browserStartTime}ms`);

      if (!this.page) {
        throw new Error('Page not initialized');
      }

      // Enhanced stealth setup for TikTok
      await this.setupTikTokStealth();

      // Inject TikTok cookies BEFORE navigation (critical for authentication)
      const cookiesEnv = process.env.TIKTOK_COOKIES_JSON;
      let cookiesInjected = false;
      if (cookiesEnv) {
        try {
          const cookies = JSON.parse(cookiesEnv);
          if (Array.isArray(cookies) && cookies.length > 0) {
            // Ensure cookies have proper TikTok domain/path settings
            const validatedCookies = cookies.map(cookie => ({
              ...cookie,
              domain: cookie.domain || '.tiktok.com',
              path: cookie.path || '/',
              secure: true,
              httpOnly: cookie.httpOnly !== undefined ? cookie.httpOnly : false,
              sameSite: cookie.sameSite || 'None'
            }));

            await this.page.context().addCookies(validatedCookies);
            cookiesInjected = true;
            console.log(`🍪 Injected ${validatedCookies.length} TikTok session cookies with proper domain settings`);
            
            // Log important TikTok cookies for debugging
            const importantCookies = validatedCookies.filter(c => 
              c.name.includes('sessionid') || 
              c.name.includes('sessionid_ss') ||
              c.name.includes('sid_tt') ||
              c.name.includes('sid_guard') ||
              c.name.includes('tt_csrf_token') ||
              c.name.includes('passport_csrf_token')
            );
            console.log(`   📝 Key TikTok cookies found: ${importantCookies.map(c => c.name).join(', ')}`);
          } else {
            console.log('⚠️ TIKTOK_COOKIES_JSON is empty or invalid format');
          }
        } catch (cookieErr) {
          console.log('⚠️ Failed to parse TIKTOK_COOKIES_JSON:', cookieErr);
          console.log('   💡 Make sure it\'s valid JSON array format');
        }
      } else {
        console.log('⚠️ No TIKTOK_COOKIES_JSON found - using anonymous access');
        console.log('   💡 Add TikTok cookies to .env.local for better access to posts and content');
        console.log('   ⚠️ Without authentication, videos may show "Something went wrong" but profile data will still be available');
      }

      const profileUrl = `https://www.tiktok.com/@${username}`;
      console.log(`📱 Navigating to: ${profileUrl}${cookiesInjected ? ' (with session cookies)' : ' (anonymous)'}`);

      // Navigate to profile with retry logic
      let retries = 3;
      while (retries > 0) {
        try {
          console.log(`⏱️ Navigation attempt ${4 - retries} - start time: ${Date.now()}`);
          const navStart = Date.now();
          
          await this.page.goto(profileUrl, { 
            waitUntil: 'domcontentloaded', // Faster than networkidle for SPAs
            timeout: 90000 // Increased for TikTok's heavy SPA loading
          });
          
          console.log(`✅ Navigation completed in ${Date.now() - navStart}ms`);
          break;
        } catch (error) {
          retries--;
          console.log(`⚠️ Navigation attempt failed, ${retries} retries left`);
          if (retries === 0) throw error;
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      // Wait for DOM and attempt to dismiss cookie / login overlays
      await this.page.waitForLoadState('domcontentloaded');

      // Check if authentication worked by looking for login indicators
      const pageContent = await this.page.textContent('body') || '';
      if (cookiesInjected) {
        if (pageContent.includes('Log in') && !pageContent.includes('Log out')) {
          console.log('⚠️ Authentication may have failed - still seeing login prompts');
        } else {
          console.log('✅ Authentication appears successful - no login prompts detected');
        }
      }

      // Dismiss cookie consent if present
      try {
        const acceptBtn = await this.page.$('button:has-text("Accept all")');
        if (acceptBtn) {
          await acceptBtn.click();
          console.log('🍪 Dismissed cookie banner');
          await this.page.waitForTimeout(1000);
        }
      } catch {
        // ignore
      }

      // Dismiss login popup if present
      try {
        const closeLogin = await this.page.$('div[role="dialog"] button:has-text("Close")');
        if (closeLogin) {
          await closeLogin.click();
          console.log('🔒 Closed login modal');
          await this.page.waitForTimeout(1000);
        }
      } catch {
        // ignore
      }

      // Try to dismiss any other overlays
      try {
        const overlaySelectors = [
          'button[data-e2e="close-button"]',
          'button[aria-label="Close"]',
          'div[role="dialog"] button'
        ];
        
        for (const selector of overlaySelectors) {
          const overlay = await this.page.$(selector);
          if (overlay) {
            await overlay.click();
            console.log(`🗂️ Dismissed overlay: ${selector}`);
            await this.page.waitForTimeout(500);
            break;
          }
        }
      } catch {
        // ignore
      }

      // Wait for the profile subtitle (username) to appear
      try {
        await this.page.waitForSelector('[data-e2e="user-subtitle"], h2:has-text("@")', { timeout: 15000 });
      } catch {
        console.log('⚠️ Profile subtitle not found – may be blocked or non-existent');
      }

      // Verify authentication if cookies were injected
      if (cookiesInjected) {
        await this.verifyAuthentication();
      }

      const pageText = (await this.page.textContent('body')) || '';
      const currentUrl = this.page.url();

      // Debug: log what we actually see
      console.log(`📄 Page URL: ${currentUrl}`);
      console.log(`📄 Page title: ${await this.page.title()}`);
      console.log(`📄 Page text length: ${pageText.length}`);
      console.log(`📄 Page text sample: ${pageText.substring(0, 300)}...`);

      // Check for specific error conditions first
      const errorCheck = this.checkForTikTokErrors(pageText, currentUrl, username);
      if (!errorCheck.success) {
        return errorCheck;
      }

      // First, try to extract data from page text (even if login prompts are present)
      console.log('🔍 Attempting to parse profile data from page text...');
      const textData = this.parseFromPageText(pageText, username);
      if (textData) {
        console.log('✅ Successfully parsed profile data from page text');
       
        // Take screenshot for AI analysis
        console.log('📸 Taking full page screenshot for AI analysis...');
        const screenshot = await this.page.screenshot({ 
          fullPage: true,
          type: 'png',
          timeout: 30000 // Extended timeout for screenshot like Instagram
        });
        
        return {
          success: true,
          data: textData,
          screenshot,
          method: 'text-parsing'
        };
      }

      // Check if we have any profile indicators at all
      const hasProfileElements = await Promise.all([
        this.page.$('[data-e2e="user-title"]'),
        this.page.$('[data-e2e="user-subtitle"]'),
        this.page.$('h1'),
        this.page.$('h2'),
        this.page.$(`text=${username}`),
        this.page.$(`text=@${username}`)
      ]);

      const foundElements = hasProfileElements.filter(el => el !== null).length;
      console.log(`📊 Found ${foundElements}/6 profile indicators`);

      // If no text data and no structured elements, check for blocking
      if (foundElements === 0) {
        const blockedIndicators = [
          'Log in to TikTok',
          'Sign up for TikTok',
          'You must be 18 or older',
          'This content is age-restricted',
        ];

        const isBlocked = blockedIndicators.some(indicator => pageText.includes(indicator));
        if (isBlocked) {
          console.log('🚫 No data found and login/age verification wall detected');
      return {
        success: false,
            error: `TikTok is blocking access to @${username} - requires login or age verification`,
        method: 'scraping'
      };
    }

        console.log('❌ No profile data or elements found');
        return {
          success: false,
          error: `Unable to access TikTok profile @${username} - page may be restricted`,
          method: 'scraping'
        };
      }

      // Extract profile data and videos
      console.log('📊 Extracting profile data and videos...');
      const profileData = await this.extractProfileData(username);
      
      // Try to load and extract recent videos
      console.log('🎬 Attempting to extract recent videos...');
      const recentVideos = await this.extractRecentVideos(username);
      
      // Update metrics with video data
      if (profileData && recentVideos.length > 0) {
        const totalViews = recentVideos.reduce((sum, video) => sum + video.views, 0);
        const totalLikes = recentVideos.reduce((sum, video) => sum + video.likes, 0);
        
        profileData.metrics.averageViews = Math.round(totalViews / recentVideos.length);
        profileData.metrics.averageLikes = Math.round(totalLikes / recentVideos.length);
        profileData.metrics.recentVideos = recentVideos;
        // Note: Don't set videoCount since we only extract a limited number of videos from the visible page
        
        // Calculate engagement rate if we have follower count
        if (profileData.followerCount > 0) {
          profileData.metrics.engagementRate = Number((profileData.metrics.averageLikes / profileData.followerCount * 100).toFixed(2));
        }
        
        console.log(`✅ Extracted ${recentVideos.length} recent videos with metrics`);
      } else {
        console.log('⚠️ No videos extracted or profile data missing');
      }
      
      // Wait a bit more for any final loading, then take screenshot
      console.log('📸 Preparing to take screenshot...');
      await this.page.waitForTimeout(3000);
      
      // Comprehensive DOM inspection to understand TikTok structure
      const domInspection = await this.page.evaluate(() => {
        const videoLinks = document.querySelectorAll('a[href*="/video/"]');
        const videoThumbnails = document.querySelectorAll('img[src*="tiktok"]');
        const allImages = document.querySelectorAll('img');
        const allLinks = document.querySelectorAll('a');
        const dataElements = document.querySelectorAll('[data-e2e]');
        const canvasElements = document.querySelectorAll('canvas');
        const videoElements = document.querySelectorAll('video');
        
        // Get all data-e2e attributes to understand TikTok's structure
        const dataE2eValues = Array.from(dataElements).map(el => el.getAttribute('data-e2e')).filter(Boolean);
        
        // Look for text content that might indicate posts area
        const bodyText = document.body.textContent || '';
        const hasVideosText = bodyText.includes('Videos');
        const hasPostsText = bodyText.includes('posts') || bodyText.includes('Posts');
        
        // Check for specific TikTok post-related classes
        const postRelatedSelectors = [
          '.DivItemContainer', // Common TikTok video container class
          '[class*="video"]',
          '[class*="post"]',
          '[class*="item"]',
          '[class*="grid"]',
          '[class*="content"]'
        ];
        
        const postRelatedElements = postRelatedSelectors.map(selector => {
          const elements = document.querySelectorAll(selector);
          return {
            selector,
            count: elements.length,
            hasContent: elements.length > 0
          };
        }).filter(item => item.count > 0);
        
        return {
          // Basic counts
          videoLinks: videoLinks.length,
          thumbnails: videoThumbnails.length,
          allImages: allImages.length,
          allLinks: allLinks.length,
          canvasElements: canvasElements.length,
          videoElements: videoElements.length,
          
          // TikTok-specific elements
          dataE2eElements: dataElements.length,
          dataE2eValues: dataE2eValues.slice(0, 20), // First 20 for debugging
          
          // Content analysis
          hasVideosText,
          hasPostsText,
          hasSomethingWrong: bodyText.includes('Something went wrong'),
          hasNoVideosYet: bodyText.includes('No videos yet'),
          
          // Post-related elements
          postRelatedElements,
          
          // Page state
          currentUrl: window.location.href,
          pageTitle: document.title,
          
          // Sample of actual content structure
          mainContentHTML: document.querySelector('main')?.innerHTML?.substring(0, 500) || 'No main element found'
        };
      });
      
      console.log('🔍 Comprehensive DOM inspection:');
      console.log(`   📊 Video links: ${domInspection.videoLinks}, Images: ${domInspection.allImages}, Canvas: ${domInspection.canvasElements}`);
      console.log(`   🎯 Data-e2e elements: ${domInspection.dataE2eElements}, Values: ${domInspection.dataE2eValues.join(', ')}`);
      console.log(`   📝 Has Videos text: ${domInspection.hasVideosText}, Posts text: ${domInspection.hasPostsText}`);
      console.log(`   ⚠️ Something wrong: ${domInspection.hasSomethingWrong}, No videos: ${domInspection.hasNoVideosYet}`);
      console.log(`   🏗️ Post-related elements found: ${JSON.stringify(domInspection.postRelatedElements)}`);
      console.log(`   📄 Current URL: ${domInspection.currentUrl}`);
      console.log(`   🏷️ Page title: ${domInspection.pageTitle}`);
      console.log(`   📋 Main content sample: ${domInspection.mainContentHTML.substring(0, 200)}...`);
      
      // Take screenshot
      const screenshot = await this.page.screenshot({ 
        fullPage: true,
        type: 'png',
        timeout: 30000 // Add timeout to avoid hanging
      });
      
      console.log('📸 Screenshot captured successfully');
    
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

  private async setupTikTokStealth() {
    if (!this.page) return;

    console.log('🥷 Setting up TikTok stealth techniques...');

    // Set realistic viewport with variation (TikTok is mobile-first)
    const viewportOptions = [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
      { width: 1440, height: 900 },
      { width: 1536, height: 864 }
    ];
    
    const randomViewport = viewportOptions[Math.floor(Math.random() * viewportOptions.length)];
    await this.page.setViewportSize(randomViewport);

    // Set TikTok-specific headers to appear legitimate
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
      'Referer': 'https://www.tiktok.com/',
      // Use a recent Chrome user agent that TikTok expects
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    });

    // Override navigator properties to avoid bot detection
    await this.page.addInitScript(() => {
      // Override webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      // Override plugins to look more realistic
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

      // Add realistic screen properties
      Object.defineProperty(screen, 'availHeight', {
        get: () => 1055,
      });

      Object.defineProperty(screen, 'availWidth', {
        get: () => 1920,
      });

      // Override permissions API to avoid detection
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );

      // Remove playwright-specific properties
      delete window.__playwright;
      delete window.__pw_manual;
      delete window.__PW_inspect;
    });

    console.log('✅ TikTok stealth setup completed');
  }

  private async verifyAuthentication(): Promise<boolean> {
    if (!this.page) return false;

    try {
      // Check for authenticated user indicators
      const indicators = await this.page.evaluate(() => {
        const body = document.body.textContent || '';
        return {
          hasFollowButton: !!document.querySelector('[data-e2e="follow-button"]'),
          hasLogoutOption: body.includes('Log out') || body.includes('Sign out'),
          hasUploadButton: !!document.querySelector('[data-e2e="upload-icon"]'),
          hasProfileMenu: !!document.querySelector('[data-e2e="nav-profile"]'),
          noLoginPrompt: !body.includes('Log in to follow creators')
        };
      });

      const isAuthenticated = indicators.hasFollowButton || 
                              indicators.hasLogoutOption || 
                              indicators.hasUploadButton || 
                              indicators.hasProfileMenu || 
                              indicators.noLoginPrompt;

      if (isAuthenticated) {
        console.log('✅ Authentication verified - user appears to be logged in');
        console.log(`   📊 Indicators: Follow=${indicators.hasFollowButton}, Upload=${indicators.hasUploadButton}, Menu=${indicators.hasProfileMenu}`);
      } else {
        console.log('❌ Authentication failed - user appears to be anonymous');
      }

      return isAuthenticated;
    } catch {
      console.log('⚠️ Could not verify authentication status');
      return false;
    }
  }

  private checkForTikTokErrors(pageText: string, currentUrl: string, username: string): TikTokScrapingResult {
    console.log('🔍 Checking for TikTok error conditions...');
    
    // Check URL patterns for clear errors (be more specific)
    if (currentUrl.includes('/404') || currentUrl.endsWith('/404')) {
      console.log('❌ URL indicates 404 page');
      return {
        success: false,
        error: `TikTok account @${username} does not exist`,
        method: 'scraping'
      };
    }
    
    // Make content checks much more specific to avoid false positives
    const lowerContent = pageText.toLowerCase();
    
    // If we can see profile data in the content, don't flag as error even if there are error messages
    const hasProfileData = lowerContent.includes(`${username.toLowerCase()}`) && 
                          (lowerContent.includes('followers') || lowerContent.includes('following'));
    
    if (hasProfileData) {
      console.log('✅ Profile data detected in page content, ignoring error messages');
      return { success: true, method: 'scraping' };
    }
    
    // Only check for very specific error patterns to avoid false positives
    const notFoundIndicators = [
      `couldn't find this account`, // More specific TikTok error message
      `this user doesn't exist`,
      `@${username.toLowerCase()} not found` // Username-specific
    ];
    
    const privateAccountIndicators = [
      'this account is private',
      'account is private'
    ];
    
    // Only check for very specific error messages that are unlikely to appear in normal content
    if (notFoundIndicators.some(indicator => lowerContent.includes(indicator))) {
      console.log('❌ Specific account not found message detected');
      return {
        success: false,
        error: `TikTok account @${username} does not exist`,
        method: 'scraping'
      };
    }
    
    // Only check for private account if we have a clear indication AND no profile data
    if (privateAccountIndicators.some(indicator => lowerContent.includes(indicator)) && 
        !lowerContent.includes('followers') && !lowerContent.includes('following')) {
      console.log('🔒 Account appears to be private with no accessible data');
      return {
        success: false,
        error: `TikTok account @${username} is private. Only approved followers can see their content.`,
        method: 'scraping'
      };
    }
    
    console.log('✅ No clear error conditions detected, proceeding with analysis');
    return { success: true, method: 'scraping' };
  }

  private async extractRecentVideos(_username: string): Promise<TikTokVideo[]> {
    if (!this.page) {
      console.log('❌ Page not available for video extraction');
      return [];
    }

    try {
      console.log('🎬 Looking for video elements...');
      
      // Try multiple strategies to load videos
      console.log('📜 Attempting to load videos with multiple strategies...');
      
      // Strategy 1: Wait for and click Videos tab (critical for posts to appear)
      try {
        console.log('🎯 Strategy 1: Looking for Videos tab...');
        const videosTabSelectors = [
          'text=Videos',
          '[data-e2e="videos-tab"]',
          'div[role="tablist"] div:has-text("Videos")',
          'a[href*="tab=videos"]',
          'div:has-text("Videos"):not(:has-text("No videos"))'
        ];
        
        let videosTab = null;
        for (const selector of videosTabSelectors) {
          try {
            videosTab = await this.page.locator(selector).first();
            if (await videosTab.isVisible({ timeout: 3000 })) {
              console.log(`✅ Found Videos tab with selector: ${selector}`);
              await videosTab.click();
              console.log('🎬 Clicked Videos tab to load posts');
              await this.page.waitForTimeout(5000); // Wait longer for posts to load
              break;
            }
          } catch {
            continue;
          }
        }
        
        if (!videosTab) {
          console.log('⚠️ Videos tab not found with any selector');
        }
      } catch {
        console.log('⚠️ Videos tab interaction failed');
      }
      
      // Strategy 2: Aggressive scrolling and interaction to trigger lazy loading
      try {
        console.log('📜 Strategy 2: Aggressive scrolling and interaction...');
        
        // First, try hovering over the profile area to trigger JS
        await this.page.hover('main, [data-e2e="user-detail"], div[data-e2e*="profile"]').catch(() => {});
        await this.page.waitForTimeout(1000);
        
        // Scroll down in multiple stages with pauses
        for (let i = 0; i < 5; i++) {
          const scrollAmount = (i + 1) * 300; // Gradually increase scroll
          await this.page.evaluate((scroll) => {
            window.scrollTo(0, scroll);
          }, scrollAmount);
          
          await this.page.waitForTimeout(2000);
          
          // Try to click on any video thumbnails to trigger loading
          try {
            const thumbnail = await this.page.$('img[src*="tiktok"], canvas, video');
            if (thumbnail) {
              await thumbnail.hover();
              console.log(`🖱️ Hovered over media element at scroll ${scrollAmount}px`);
            }
          } catch {}
          
          // Check if videos appeared
          const hasVideos = await this.page.locator('a[href*="/video/"]').count() > 0;
          if (hasVideos) {
            console.log(`✅ Videos detected after scrolling to ${scrollAmount}px`);
            break;
          }
        }
        
        // Scroll back to top smoothly
        await this.page.evaluate(() => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        await this.page.waitForTimeout(2000);
      } catch {
        console.log('⚠️ Scrolling strategy failed, continuing...');
      }
      
      // Strategy 3: Force trigger video loading with simulated interaction
      try {
        console.log('🎮 Strategy 3: Simulating user interaction to trigger posts...');
        
        // Try different approaches to trigger posts loading
        await this.page.evaluate(() => {
          // Trigger intersection observer events
          const observer = new IntersectionObserver(() => {});
          const elements = document.querySelectorAll('div, main, section');
          elements.forEach(el => observer.observe(el));
          
          // Simulate user activity
          window.dispatchEvent(new Event('scroll'));
          window.dispatchEvent(new Event('resize'));
          window.dispatchEvent(new Event('focus'));
          
          // Try to trigger any lazy loading
          const images = document.querySelectorAll('img[data-src], img[loading="lazy"]');
          images.forEach(img => {
            if (img.dataset.src) {
              img.src = img.dataset.src;
            }
          });
        });
        
        await this.page.waitForTimeout(3000);
        
        // Try clicking on profile tabs or sections that might load posts
        const interactionSelectors = [
          '[data-e2e="profile-icon"]',
          '[role="tab"]',
          'div[role="tabpanel"]',
          'main section',
          'div[data-e2e*="user"]'
        ];
        
        for (const selector of interactionSelectors) {
          try {
            const element = await this.page.$(selector);
            if (element) {
              await element.hover();
              await this.page.waitForTimeout(500);
              console.log(`🔄 Interacted with ${selector}`);
            }
          } catch {}
        }
        
      } catch {
        console.log('⚠️ Interaction simulation failed, continuing...');
      }
      
      // Strategy 4: Wait for network activity to settle
      try {
        console.log('⏳ Strategy 4: Waiting for network activity...');
        await this.page.waitForLoadState('networkidle', { timeout: 8000 });
      } catch {
        console.log('⚠️ Network idle timeout, continuing...');
      }
      
      // Wait for video grid to load - try multiple selectors
      const videoSelectors = [
        '[data-e2e="user-post-item"]',
        '[data-e2e="user-post-item-list"] > div',
        'div[data-e2e*="video"]',
        'a[href*="/video/"]',
        'div[style*="video"]',
        'div[class*="video"]',
        'div[class*="DivItemContainer"]',
        'div[class*="tiktok-"]',
        '[role="button"] img', // Video thumbnails
        'div > div > img[src*="tiktok"]' // Generic TikTok image containers
      ];
      
      let videoElements = null;
      
      for (const selector of videoSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 10000 });
          videoElements = await this.page.locator(selector).all();
          if (videoElements.length > 0) {
            console.log(`✅ Found ${videoElements.length} video elements with selector: ${selector}`);
            break;
          }
        } catch {
          console.log(`⚠️ Selector ${selector} not found`);
        }
      }

      if (!videoElements || videoElements.length === 0) {
        console.log('❌ No video elements found on profile');
        
        // Check if there's a "Something went wrong" or "No videos" message
        const pageText = await this.page.textContent('body') || '';
        if (pageText.includes('Something went wrong')) {
          console.log('⚠️ TikTok shows "Something went wrong" - videos section failed to load');
          console.log('💡 This often happens due to authentication requirements or rate limiting');
          console.log('✅ Profile data (followers, likes, bio) is still available for analysis');
        } else if (pageText.includes('No videos yet') || pageText.includes('This user hasn\'t posted')) {
          console.log('📭 User has no videos posted');
        } else {
          console.log('🔍 Videos may be loading asynchronously or require different selectors');
        }
        
        return [];
      }

      console.log(`🔍 Extracting data from ${videoElements.length} videos...`);
      const videos: TikTokVideo[] = [];
      
      // Limit to first 6 videos to avoid long processing times
      const videosToProcess = Math.min(videoElements.length, 6);
      
      for (let i = 0; i < videosToProcess; i++) {
        try {
          const videoElement = videoElements[i];
          
          // Extract video data using page.evaluate with the element
          const videoData = await videoElement.evaluate((element) => {
            // Find thumbnail image
            const img = element.querySelector('img');
            const thumbnailUrl = img?.src || '';
            
            // Try to find video link to extract ID
            const link = element.querySelector('a[href*="/video/"]') || element.closest('a[href*="/video/"]');
            const href = link?.getAttribute('href') || '';
            const videoIdMatch = href.match(/\/video\/(\d+)/);
            const videoId = videoIdMatch ? videoIdMatch[1] : `video_${Date.now()}_${Math.random()}`;
            
            // Try to extract description from alt text or nearby text
            const description = img?.getAttribute('alt') || 
                              element.textContent?.trim().substring(0, 100) || 
                              '';
            
            return {
              id: videoId,
              thumbnailUrl,
              description,
              href
            };
          });
          
          // Try to extract metrics if available in the element
          const metricsData = await videoElement.evaluate((element) => {
            const text = element.textContent || '';
            
            // Look for view counts (may not be visible on profile grid)
            const viewMatch = text.match(/([\d.]+[KMB]?)\s*views?/i);
            const views = viewMatch ? parseFloat(viewMatch[1].replace(/[KMB]/g, '')) * 
                         (viewMatch[1].includes('K') ? 1000 : 
                          viewMatch[1].includes('M') ? 1000000 : 
                          viewMatch[1].includes('B') ? 1000000000 : 1) : 0;
            
            // Look for like counts
            const likeMatch = text.match(/([\d.]+[KMB]?)\s*likes?/i);
            const likes = likeMatch ? parseFloat(likeMatch[1].replace(/[KMB]/g, '')) * 
                         (likeMatch[1].includes('K') ? 1000 : 
                          likeMatch[1].includes('M') ? 1000000 : 
                          likeMatch[1].includes('B') ? 1000000000 : 1) : 0;
            
            return { views: Math.floor(views), likes: Math.floor(likes) };
          });
          
          if (videoData.thumbnailUrl) {
            videos.push({
              id: videoData.id,
              thumbnailUrl: videoData.thumbnailUrl,
              description: videoData.description,
              views: metricsData.views,
              likes: metricsData.likes,
              comments: 0, // Not available in grid view
              shares: 0, // Not available in grid view
              timestamp: new Date(), // Approximate - would need individual video pages for exact timestamp
              duration: 0 // Not available in grid view
            });
            
            console.log(`📹 Video ${i + 1}: ${videoData.description.substring(0, 50)}... (${metricsData.views} views, ${metricsData.likes} likes)`);
          }
          
        } catch (error) {
          console.log(`⚠️ Error extracting video ${i + 1}:`, error);
        }
      }
      
      console.log(`✅ Successfully extracted ${videos.length} videos`);
      return videos;
      
    } catch (error) {
      console.log('❌ Error during video extraction:', error);
      return [];
    }
  }

  private async extractProfileData(username: string) {
    if (!this.page) throw new Error('Page not initialized');

    // Ensure main header elements are loaded
    try {
      await this.page.waitForSelector('[data-e2e="user-title"], h1', { timeout: 15000 });
    } catch {
      console.log('⚠️ Profile header not found');
    }

    // Extract display name
    // Use new selectors first
    const displayName = await this.page.textContent('[data-e2e="user-title"]') ||
                       await this.page.textContent('h1') ||
                       username;

    // Extract bio
    const bio = await this.page.textContent('[data-e2e="user-bio"]') || '';

    // Extract follower/following counts from stats
    const statsElements = await this.page.locator('[data-e2e="followers-count"], [data-e2e="following-count"], strong').all();
    
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
      username,
      displayName: displayName.trim(),
      bio: bio.trim(),
      profileImageUrl,
      isVerified,
      followerCount,
      followingCount,
      metrics
    };
  }

  private async fetchUserJson(username: string): Promise<TikTokScrapingResult | null> {
    try {
      const url = `https://www.tiktok.com/node/share/user/@${username}`;
      console.log(`🌐 Trying JSON API: ${url}`);
      // Use global fetch (Node 18+) – fall back gracefully if not available
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const res = await (typeof fetch !== 'undefined' ? fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0 Safari/537.36',
          'Referer': 'https://www.tiktok.com/'
        }
      }) : null);

      if (!res || res.status === 404) {
        console.log(`❌ JSON API returned 404 - account doesn't exist`);
        return {
          success: false,
          error: `TikTok account @${username} does not exist`,
          method: 'public-json'
        };
      }
      
      if (!res || res.status !== 200) {
        console.log(`🔍 JSON API returned status ${res?.status}`);
        return null;
      }

      const json = await res.json();
      
      // Check if the response indicates the account doesn't exist
      if (!json || !json.userInfo) {
        console.log(`❌ JSON API indicates account doesn't exist`);
        return {
          success: false,
          error: `TikTok account @${username} does not exist`,
          method: 'public-json'
        };
      }
      
      if (!json.userInfo.user) {
        console.log('⚠️ JSON payload missing user data');
        return null;
      }

      const user = json.userInfo.user;
      const stats = json.userInfo.stats || {};

      const metrics: TikTokMetrics = {
        followerCount: stats.followerCount || 0,
        followingCount: stats.followingCount || 0,
        likeCount: stats.heartCount || 0,
        videoCount: stats.videoCount || 0,
        averageViews: 0,
        averageLikes: 0,
        engagementRate: 0,
        recentVideos: []
      };

      return {
        success: true,
        data: {
          username,
          displayName: user.nickname || username,
          bio: user.signature || '',
          profileImageUrl: user.avatarLarger || '',
          isVerified: !!user.verified,
          followerCount: stats.followerCount || 0,
          followingCount: stats.followingCount || 0,
          metrics
        },
        method: 'public-json'
      };
    } catch (err) {
      console.log('⚠️ fetchUserJson error', err);
      return null;
    }
  }

  private parseNumber(str: string): number {
    try {
      console.log(`🔢 TikTok parsing count: "${str}"`);
      
      const cleaned = str.replace(/,/g, '').toLowerCase();
      const number = parseFloat(cleaned);
      
      if (isNaN(number)) {
        console.log(`❌ Failed to parse TikTok number: "${str}"`);
        return 0;
      }
      
      let result: number;
      if (cleaned.includes('k')) {
        result = Math.floor(number * 1000);
      } else if (cleaned.includes('m')) {
        result = Math.floor(number * 1000000);
      } else if (cleaned.includes('b')) {
        result = Math.floor(number * 1000000000);
      } else {
        result = Math.floor(number);
      }
      
      // Check for JavaScript number precision issues
      if (result > Number.MAX_SAFE_INTEGER) {
        console.log(`⚠️ TikTok number ${result} exceeds MAX_SAFE_INTEGER, precision may be lost`);
      }
      
      console.log(`✅ TikTok parsed "${str}" -> ${result.toLocaleString()}`);
      return result;
    } catch (error) {
      console.error(`❌ Error parsing TikTok count "${str}":`, error);
      return 0;
    }
  }

  private parseFromPageText(pageText: string, username: string): TikTokScrapingResult['data'] | null {
    try {
      // Look for the compact format: "usernameDisplay Name123Following456Followers789LikesBio text here"
      const pattern = new RegExp(
        `${username}([^0-9]+?)(\\d+(?:\\.\\d+)?[KMB]?)Following(\\d+(?:\\.\\d+)?[KMB]?)Followers(\\d+(?:\\.\\d+)?[KMB]?)Likes([^{]+?)(?:{|$)`,
        'i'
      );
      
      const match = pageText.match(pattern);
      
      if (!match) {
        console.log('🔍 Could not parse compact format, trying alternative...');
        
        // Try simpler patterns for individual pieces
        const followingMatch = pageText.match(/([\d.]+[KMB]?)Following/i);
        const followersMatch = pageText.match(/([\d.]+[KMB]?)Followers/i);
        const likesMatch = pageText.match(/([\d.]+[KMB]?)Likes/i);
        
        if (!followingMatch || !followersMatch || !likesMatch) {
          return null;
        }
        
        const followingCount = this.parseNumber(followingMatch[1]);
        const followerCount = this.parseNumber(followersMatch[1]);
        const likeCount = this.parseNumber(likesMatch[1]);
        
        // Check for verification indicators in the page text
        const isVerified = pageText.includes('verified') || 
                          pageText.includes('Verified') || 
                          pageText.includes('✓') ||
                          pageText.includes('checkmark') ||
                          /verified["\s]*:\s*true/i.test(pageText);
        
        const metrics: TikTokMetrics = {
          followerCount,
          followingCount,
          likeCount,
          videoCount: 0,
          averageViews: 0,
          averageLikes: 0,
          engagementRate: 0,
          recentVideos: []
        };
        
        return {
          username,
          displayName: username, // Fallback to username
          bio: '',
          profileImageUrl: '',
          isVerified,
          followerCount,
          followingCount,
          metrics
        };
      }
      
      const [, displayName, followingRaw, followersRaw, likesRaw, bioRaw] = match;
      
      const followingCount = this.parseNumber(followingRaw);
      const followerCount = this.parseNumber(followersRaw);
      const likeCount = this.parseNumber(likesRaw);
      
      // Clean up bio text - remove error messages and extra content
      const bio = bioRaw
        .replace(/Something went wrong.*$/i, '')
        .replace(/Try again.*$/i, '')
        .replace(/Videos.*$/i, '')
        .replace(/Liked.*$/i, '')
        .replace(/\{.*$/g, '') // Remove any JSON-like content
        .trim();
      
      // Check for verification indicators in the page text
      const isVerified = pageText.includes('verified') || 
                        pageText.includes('Verified') || 
                        pageText.includes('✓') ||
                        pageText.includes('checkmark') ||
                        /verified["\s]*:\s*true/i.test(pageText);

    const metrics: TikTokMetrics = {
      followerCount,
      followingCount,
      likeCount,
        videoCount: 0,
      averageViews: 0,
      averageLikes: 0,
        engagementRate: 0,
        recentVideos: []
    };
      
      console.log(`📊 Parsed: ${displayName.trim()}, ${followingCount} following, ${followerCount} followers, ${likeCount} likes`);

    return {
        username,
        displayName: displayName.trim(),
        bio: bio,
        profileImageUrl: '',
      isVerified,
      followerCount,
      followingCount,
      metrics
    };

    } catch (err) {
      console.log('⚠️ Error parsing page text:', err);
      return null;
    }
  }
}

export async function analyzeTikTokProfile(username: string): Promise<TikTokScrapingResult> {
  const scraper = new TikTokScraper();
  return scraper.analyzeProfile(username);
} 