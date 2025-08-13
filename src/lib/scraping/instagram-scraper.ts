import { PlaywrightBaseScraper, ScrapingResult } from './playwright-base-scraper';
import { InstagramMetrics } from '@/lib/types';

interface InstagramScrapingResult extends ScrapingResult {
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
    metrics: InstagramMetrics;
  };
}

class InstagramScraper extends PlaywrightBaseScraper {
  private isLoggedIn = false;

  async analyzeProfile(username: string): Promise<InstagramScrapingResult> {
    const maxRetries = 2; // Allow 2 retries for robustness
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔍 Starting Instagram analysis for: ${username} (attempt ${attempt}/${maxRetries})`);
        
        // Log Vercel environment info
        console.log(`☁️ Vercel Fluid Compute: ${process.env.VERCEL ? 'Yes' : 'No'}`);
        console.log(`🌐 Environment: ${process.env.NODE_ENV}`);
        
        // Initialize browser with Sparticuz chromium if available
        await this.initBrowser();
        
        if (!this.page) {
          throw new Error('Browser page not initialized');
        }

        // Enhanced stealth setup - be more aggressive about appearing human
        await this.setupStealth();
        
        // Inject cookies if provided - this bypasses login entirely
        const cookiesEnv = process.env.INSTAGRAM_COOKIES_JSON;
        let cookiesInjected = false;
        if (cookiesEnv) {
          try {
            const cookies = JSON.parse(cookiesEnv);
            if (Array.isArray(cookies) && cookies.length > 0) {
              await this.page.context().addCookies(cookies);
              cookiesInjected = true;
              console.log(`🍪 Injected ${cookies.length} Instagram session cookies`);
              
              // Log key cookies for debugging
              const sessionCookie = cookies.find(c => c.name === 'sessionid');
              const csrfCookie = cookies.find(c => c.name === 'csrftoken');
              console.log(`   📝 Session ID: ${sessionCookie ? 'Present' : 'Missing'}`);
              console.log(`   🔐 CSRF Token: ${csrfCookie ? 'Present' : 'Missing'}`);
            } else {
              console.log('⚠️ INSTAGRAM_COOKIES_JSON is empty or invalid format');
            }
          } catch (cookieErr) {
            console.log('⚠️ Failed to parse INSTAGRAM_COOKIES_JSON:', cookieErr);
            console.log('   💡 Make sure it\'s valid JSON array format');
          }
        } else {
          console.log('⚠️ No INSTAGRAM_COOKIES_JSON found - will attempt login instead');
          console.log('   💡 Add cookies to .env.local to bypass login issues');
        }
        
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
        
        if (cookiesInjected) {
          console.log('🎯 Strategy: Using injected session cookies (bypass login)');
        } else {
          console.log('🎯 Strategy: Try direct access, then login if needed');
        }

    const profileUrl = `https://www.instagram.com/${username}/`;
        console.log(`📱 Navigating to: ${profileUrl}`);

        // Navigate directly to the profile first with extended timeout
        await this.page.goto(profileUrl, { 
          waitUntil: 'domcontentloaded',
          timeout: 90000 // Extended for Vercel Fluid Compute (up to 800s available)
        });

        // Human-like delays
        await this.page.waitForTimeout(3000 + Math.random() * 2000);

        // Check what we got
        console.log('⏳ Checking page content...');
        
        await this.page.waitForSelector('body', { timeout: 20000 }); // Extended timeout
        
        const pageContent = await this.page.textContent('body') || '';
        const currentUrl = this.page.url();
        
        console.log(`📍 Current URL: ${currentUrl}`);
        console.log(`📄 Page content length: ${pageContent.length} characters`);
        
        // Check for specific error conditions first
        const errorChecks = this.checkForInstagramErrors(pageContent, currentUrl, username);
        if (!errorChecks.success) {
          return errorChecks;
        }
        
        // Check if we got the profile content directly
        const hasProfileContent = (
          pageContent.includes('posts') ||
          pageContent.includes('followers') ||
          pageContent.includes('following') ||
          pageContent.includes(username)
        ) && !currentUrl.includes('/accounts/login/');
        
        let success = false;
        
        if (hasProfileContent) {
          console.log('✅ Profile content loaded directly');
          success = true;
        } else {
          // Need to login
          console.log('🔑 Profile requires login, attempting authentication...');
          
          const loginSuccess = await this.attemptLogin();
          if (loginSuccess) {
            console.log('🎉 Login successful, accessing profile...');
            
            // Navigate to profile after login with extended timeout
            await this.page.goto(profileUrl, { 
              waitUntil: 'domcontentloaded',
              timeout: 90000 // Extended for serverless
            });
            
            await this.page.waitForTimeout(3000); // Give more time to load
            
            // Check for errors after login
            const postLoginContent = await this.page.textContent('body') || '';
            const postLoginUrl = this.page.url();
            const postLoginErrorCheck = this.checkForInstagramErrors(postLoginContent, postLoginUrl, username);
            
            if (!postLoginErrorCheck.success) {
              console.log('❌ Error detected after login');
              return postLoginErrorCheck;
            }
            
            const hasPostLoginContent = (
              postLoginContent.includes('posts') ||
              postLoginContent.includes('followers') ||
              postLoginContent.includes('following') ||
              postLoginContent.includes(username)
            );
            
            if (hasPostLoginContent) {
              console.log('✅ Profile accessible after login');
              success = true;
            } else {
              console.log('❌ Profile still not accessible after login');
              
              // Log more details for debugging
              console.log(`📍 Post-login URL: ${postLoginUrl}`);
              console.log(`📄 Post-login content snippet: ${postLoginContent.substring(0, 200)}...`);
            }
          } else {
            console.log('❌ Login failed - will retry if attempts remaining');
            if (attempt < maxRetries) {
              await this.cleanup();
              await this.page?.waitForTimeout(5000); // Wait before retry
              continue; // Try again
            } else {
      return {
        success: false,
                error: 'Instagram login failed after multiple attempts. This may be due to account verification requirements, rate limiting, or IP restrictions on Vercel servers.',
                method: 'Playwright with Sparticuz Chromium'
              };
            }
          }
        }

        if (!success) {
          const errorMsg = `Unable to access @${username} after ${attempt} attempt(s). ${attempt < maxRetries ? 'Retrying...' : 'Try checking if the account exists and is public.'}`;
          
          if (attempt < maxRetries) {
            console.log(`⚠️ ${errorMsg}`);
            await this.cleanup();
            await this.page?.waitForTimeout(3000); // Wait before retry
            continue; // Try again
      } else {
            return {
              success: false,
              error: errorMsg,
              method: 'Playwright with Sparticuz Chromium'
            };
          }
        }

        // Extract profile data
        console.log('📊 Extracting profile data...');
        const profileData = await this.extractProfileData(username);
        
        // Take screenshot with extended timeout
        let screenshot: Buffer | undefined;
        try {
          screenshot = await this.page.screenshot({
            fullPage: true,
            type: 'png',
            timeout: 30000 // Extended timeout for screenshot
          });
          console.log('📸 Screenshot captured successfully');
        } catch (screenshotError) {
          console.log(`⚠️ Screenshot capture failed: ${screenshotError}`);
        }

        // Log memory usage at end
        if (process.memoryUsage) {
          const memory = process.memoryUsage();
          console.log(`💾 Final memory: ${Math.round(memory.heapUsed / 1024 / 1024)}MB used / ${Math.round(memory.heapTotal / 1024 / 1024)}MB total`);
        }
    
    return {
      success: true,
      data: profileData,
      screenshot,
          method: `Playwright with Sparticuz Chromium${this.isLoggedIn ? ' (Authenticated)' : ' (Anonymous)'} - Attempt ${attempt}`
    };

  } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`❌ Instagram scraping attempt ${attempt} failed:`, lastError);
        
        // Log additional error context
        if (this.page) {
          try {
            const currentUrl = this.page.url();
            const title = await this.page.title();
            console.log(`📍 Error occurred at URL: ${currentUrl}`);
            console.log(`📄 Page title at error: ${title}`);
          } catch {
            console.log('💥 Could not get page info during error');
          }
        }
        
        // Cleanup before potential retry
        await this.cleanup();
        
        if (attempt < maxRetries) {
          console.log(`🔄 Retrying in 3 seconds... (${maxRetries - attempt} attempts remaining)`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    }
    
    // All attempts failed
    return {
      success: false,
      error: `Instagram analysis failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}. This may be due to Vercel timeout limits, memory constraints, or Instagram blocking.`,
      method: 'Playwright with Sparticuz Chromium'
    };
  }

  private checkForInstagramErrors(pageContent: string, currentUrl: string, username: string): InstagramScrapingResult {
    console.log('🔍 Checking for error conditions...');
    
    // Check for "Page Not Found" or similar (be more specific to avoid false positives)
    const notFoundIndicators = [
      'Sorry, this page isn\'t available',
      'The link you followed may be broken',
      'Page Not Found',
      'This page isn\'t available right now'
    ];
    
    const accountNotFoundIndicators = [
      'User not found',
      'This account doesn\'t exist',
      'Account not found',
      'This username isn\'t available',
      'The username you entered doesn\'t appear to belong to an account'
    ];
    
    const privateAccountIndicators = [
      'This Account is Private',
      'This account is private',
      'Follow to see their photos and videos',
      'Follow this account to see their photos and videos',
      'Account is private'
    ];
    
    // Check URL patterns for errors
    if (currentUrl.includes('404') || currentUrl.includes('error')) {
      console.log('❌ URL indicates error page');
      return {
        success: false,
        error: `Instagram account @${username} does not exist`,
        method: 'Playwright with Sparticuz Chromium'
      };
    }
    
    // Check page content for error messages
    const lowerContent = pageContent.toLowerCase();
    
    // Check for account doesn't exist - but be more careful about false positives
    const hasNotFoundIndicators = notFoundIndicators.some(indicator => lowerContent.includes(indicator.toLowerCase()));
    const hasAccountNotFoundIndicators = accountNotFoundIndicators.some(indicator => lowerContent.includes(indicator.toLowerCase()));
    const hasUsernameInContent = lowerContent.includes(username.toLowerCase());
    
    // Only declare account doesn't exist if we have clear indicators AND the username isn't found in content
    if ((hasNotFoundIndicators || hasAccountNotFoundIndicators) && !hasUsernameInContent) {
      console.log('❌ Account does not exist (no username found in content)');
      return {
        success: false,
        error: `Instagram account @${username} does not exist`,
        method: 'Playwright with Sparticuz Chromium'
      };
    }
    
    // If we see error indicators but the username IS in the content, it might be a temporary issue
    if ((hasNotFoundIndicators || hasAccountNotFoundIndicators) && hasUsernameInContent) {
      console.log('⚠️ Error indicators found but username is in content - might be temporary issue, continuing...');
    }
    
    // Check for private account
    if (privateAccountIndicators.some(indicator => lowerContent.includes(indicator.toLowerCase()))) {
      console.log('🔒 Account is private');
      return {
        success: false,
        error: `Instagram account @${username} is private. Only the account holder can see their content.`,
        method: 'Playwright with Sparticuz Chromium'
      };
    }
    
    console.log('✅ No error conditions detected');
    return { success: true, method: 'Playwright with Sparticuz Chromium' };
  }

  private async attemptLogin(): Promise<boolean> {
    if (!this.page) return false;

    const username = process.env.INSTAGRAM_USERNAME;
    const password = process.env.INSTAGRAM_PASSWORD;

    if (!username || !password) {
      console.log('📝 No Instagram credentials found');
      return false;
    }

    try {
      console.log('🔑 Attempting Instagram login...');
      console.log(`👤 Username: ${username.substring(0, 3)}***`);
      console.log(`🌐 Environment: ${process.env.NODE_ENV}`);
      console.log(`☁️ Vercel: ${process.env.VERCEL ? 'Yes' : 'No'}`);
      
      // Log memory usage if available
      if (process.memoryUsage) {
        const memory = process.memoryUsage();
        console.log(`💾 Memory: ${Math.round(memory.heapUsed / 1024 / 1024)}MB used / ${Math.round(memory.heapTotal / 1024 / 1024)}MB total`);
      }
      
      // Navigate to login page with extended timeout for Vercel Fluid Compute
      console.log('🏠 Navigating to Instagram login page...');
      await this.page.goto('https://www.instagram.com/accounts/login/', {
        waitUntil: 'domcontentloaded',
        timeout: 60000 // Increased for serverless
      });
      
      // Log current URL and basic page info
      console.log(`📍 Current URL: ${this.page.url()}`);
      const title = await this.page.title();
      console.log(`📄 Page title: ${title}`);

      // Wait for form with multiple attempts and better error handling
      console.log('⏳ Waiting for login form...');
      let formFound = false;
      const selectors = [
        'input[name="username"]',
        'input[type="text"]',
        'form input[autocomplete="username"]',
        'input[placeholder*="username"]',
        'input[placeholder*="email"]'
      ];
      
      for (let i = 0; i < selectors.length; i++) {
        try {
          await this.page.waitForSelector(selectors[i], { timeout: 15000 });
          console.log(`✅ Found login form with selector: ${selectors[i]}`);
          formFound = true;
          break;
  } catch (error) {
          console.log(`❌ Selector ${selectors[i]} failed: ${error}`);
        }
      }

      if (!formFound) {
        console.log('❌ Could not find any login form selectors');
        const bodyText = await this.page.textContent('body');
        console.log(`📝 Page content snippet: ${bodyText?.substring(0, 200)}...`);
        return false;
      }

      // Add extra stealth measures
      console.log('🥷 Applying additional stealth measures...');
      
      // Simulate human-like mouse movements
      await this.page.mouse.move(100, 100);
      await this.page.waitForTimeout(500 + Math.random() * 1000);
      
      // Click on the username field to focus it
      console.log('👆 Clicking username field...');
      await this.page.click('input[name="username"]');
      await this.page.waitForTimeout(1000 + Math.random() * 1000);
      
      // Clear and fill username with very human-like typing
      console.log('✍️ Filling username field...');
      await this.page.fill('input[name="username"]', ''); // Clear first
      await this.page.waitForTimeout(500);
      
      // Type character by character with realistic delays
      for (const char of username) {
        await this.page.keyboard.type(char);
        await this.page.waitForTimeout(100 + Math.random() * 200);
      }
      
      // Random delay between fields (2-5 seconds)
      const delay = 2000 + Math.random() * 3000;
      console.log(`⏳ Waiting ${Math.round(delay)}ms between fields...`);
      await this.page.waitForTimeout(delay);
      
      // Click and fill password field
      console.log('👆 Clicking password field...');
      await this.page.click('input[name="password"]');
      await this.page.waitForTimeout(1000 + Math.random() * 1000);
      
      console.log('✍️ Filling password field...');
      await this.page.fill('input[name="password"]', ''); // Clear first
      await this.page.waitForTimeout(500);
      
      // Type password character by character
      for (const char of password) {
        await this.page.keyboard.type(char);
        await this.page.waitForTimeout(80 + Math.random() * 150);
      }
      
      // Wait before submitting
      await this.page.waitForTimeout(2000 + Math.random() * 2000);
      
      // Find and click submit button with multiple attempts
      console.log('🎯 Looking for submit button...');
      const submitSelectors = [
        'button[type="submit"]',
        'button:has-text("Log in")',
        'button:has-text("Log In")',
        'input[type="submit"]',
        'form button',
        '[role="button"]:has-text("Log")'
      ];
      
      let submitClicked = false;
      for (const selector of submitSelectors) {
        try {
          const button = await this.page.$(selector);
          if (button) {
            const buttonText = await button.textContent();
            console.log(`📤 Found submit button: "${buttonText}" with selector: ${selector}`);
            await button.click();
            submitClicked = true;
              break;
          }
        } catch (error) {
          console.log(`❌ Submit selector ${selector} failed: ${error}`);
        }
      }

      if (!submitClicked) {
        console.log('❌ Could not find or click submit button');
        // Try pressing Enter as fallback
        console.log('⌨️ Trying Enter key as fallback...');
        await this.page.keyboard.press('Enter');
      }
      
      // Wait for response with extended timeout for Vercel
      console.log('⏳ Waiting for login response (extended timeout)...');
      await this.page.waitForTimeout(15000); // Longer wait for serverless
      
      // Comprehensive post-login analysis
      const currentUrl = this.page.url();
      const pageTitle = await this.page.title();
      const pageText = await this.page.textContent('body') || '';
      
      console.log('🔍 Post-login analysis:');
      console.log(`  📍 URL: ${currentUrl}`);
      console.log(`  📄 Title: ${pageTitle}`);
      console.log(`  📏 Page text length: ${pageText.length} characters`);
      
      // Detailed success/failure detection
      const isOnLoginPage = currentUrl.includes('/accounts/login/');
      const hasChallenge = currentUrl.includes('/challenge/');
      const hasError = pageText.toLowerCase().includes('incorrect') || 
                       pageText.toLowerCase().includes('wrong') || 
                       pageText.toLowerCase().includes('error');
      const hasSuccessIndicators = pageText.includes('Home') || 
                                   pageText.includes('Search') || 
                                   pageText.includes('Profile') ||
                                   currentUrl === 'https://www.instagram.com/' ||
                                   currentUrl.includes('/accounts/onetap/');
      
      console.log('🔍 Login indicators:');
      console.log(`  🏠 Still on login page: ${isOnLoginPage}`);
      console.log(`  🔒 Has challenge/verification: ${hasChallenge}`);
      console.log(`  ❌ Has error messages: ${hasError}`);
      console.log(`  ✅ Has success indicators: ${hasSuccessIndicators}`);
      
      if (hasChallenge) {
        console.log('🔒 Instagram challenge detected - this is the main issue');
        console.log('💡 Challenge URL indicates Instagram wants additional verification');
        console.log('💡 This happens when logging in from new locations (Vercel servers)');
        console.log('💡 Potential solutions:');
        console.log('   - Login manually first from the same IP range');
        console.log('   - Use a different Instagram account');
        console.log('   - Try accessing without login (some profiles work)');
        return false;
      }
      
      if (hasError) {
        console.log('❌ Login error detected in page content');
        console.log(`📝 Error context: ${pageText.substring(0, 500)}...`);
        return false;
      }
      
      if (isOnLoginPage && !hasSuccessIndicators) {
        console.log('⚠️ Still on login page without success indicators');
        return false;
      }
      
      if (hasSuccessIndicators && !isOnLoginPage) {
        console.log('✅ Login appears successful!');
        this.isLoggedIn = true;
        
        // Handle post-login prompts
        await this.handlePostLoginPrompts();
        return true;
      }
      
      console.log('❓ Login status unclear - treating as failed');
      return false;

    } catch (error) {
      console.error('❌ Login attempt crashed:', error);
      
      // Log additional error context
      if (this.page) {
        try {
          const currentUrl = this.page.url();
          const title = await this.page.title();
          console.log(`📍 Error occurred at URL: ${currentUrl}`);
          console.log(`📄 Page title at error: ${title}`);
        } catch {
          console.log('💥 Could not get page info during error');
        }
      }
      
      return false;
    }
  }

  private async handlePostLoginPrompts() {
    if (!this.page) return;

    console.log('🔧 Handling post-login prompts...');

    // Handle "Save Login Info" prompt
    try {
      await this.page.waitForTimeout(3000);
      
      const saveInfoButtons = [
        'button:has-text("Not Now")',
        'button:has-text("Save Info")',
        '[data-testid="save-login-info"] button',
        'button[type="button"]:has-text("Not")'
      ];

      for (const selector of saveInfoButtons) {
        try {
          const button = await this.page.$(selector);
          if (button) {
            const buttonText = await button.textContent();
            console.log(`📱 Found prompt button: "${buttonText}"`);
            if (buttonText?.includes('Not Now') || buttonText?.includes('Not')) {
              await button.click();
              console.log('📱 Dismissed save login info prompt');
              break;
            }
          }
        } catch {
          // Continue to next selector
        }
      }
    } catch {
      console.log('⚠️ Save login info prompt not found or already dismissed');
    }

    // Handle "Turn on Notifications" prompt  
    try {
      await this.page.waitForTimeout(2000);
      
      const notificationButtons = [
        'button:has-text("Not Now")',
        'button:has-text("Turn On")',
        '[data-testid="turn-on-notifications"] button',
        'button[type="button"]:has-text("Not")'
      ];

      for (const selector of notificationButtons) {
        try {
          const button = await this.page.$(selector);
          if (button) {
            const buttonText = await button.textContent();
            console.log(`🔕 Found notification button: "${buttonText}"`);
            if (buttonText?.includes('Not Now') || buttonText?.includes('Not')) {
              await button.click();
              console.log('🔕 Dismissed notification prompt');
              break;
            }
          }
        } catch {
          // Continue to next selector
        }
      }
    } catch {
      console.log('⚠️ Notification prompt not found or already dismissed');
    }

    console.log('✅ Post-login prompt handling completed');
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
        username: pageUsername,
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
      // Debug: Log a sample of the page content to see what we're working with
      const contentSample = profileData.rawContent.substring(0, 500);
      console.log('📄 Page content sample:', contentSample);
      
      // Check if we're seeing signs of being blocked or redirected
      const isBlocked = profileData.rawContent.includes('Please wait a few minutes before you try again') ||
                       profileData.rawContent.includes('Try Again Later') ||
                       profileData.rawContent.includes('We restrict certain activity') ||
                       profileData.rawContent.includes('unusual activity') ||
                       profileData.rawContent.includes('Sorry, this page') ||
                       profileData.rawContent.toLowerCase().includes('challenge') || 
                       profileData.rawContent.toLowerCase().includes('login') ||
                       profileData.rawContent.toLowerCase().includes('sign in') ||
                       profileData.rawContent.toLowerCase().includes('verify') ||
                       profileData.rawContent.includes('This content isn\'t available right now') || 
                       profileData.rawContent.includes('Something went wrong') ||
                       contentSample.length < 100;
      
      if (isBlocked) {
        console.log('🚫 Instagram appears to be blocking or limiting access');
        console.log('💡 This usually means cookies are expired or IP is rate limited');
        throw new Error('Instagram access blocked - likely due to expired cookies or rate limiting');
      }
      
      // Look for follower patterns in the content
      const followerMatches = profileData.rawContent.match(/(\d[\d.,]*\s*(?:[KMB])?)\s*followers?/i);
      console.log('👥 Follower matches found:', followerMatches);
      if (followerMatches) {
        followerCount = this.parseCount(followerMatches[1]);
        console.log(`✅ Parsed follower count: ${followerCount}`);
      } else {
        console.log('⚠️ No follower count found in page content');
        console.log('📝 Full content preview (first 1000 chars):', profileData.rawContent.substring(0, 1000));
      }

      const followingMatches = profileData.rawContent.match(/(\d[\d.,]*\s*(?:[KMB])?)\s*following/i);
      console.log('👥 Following matches found:', followingMatches);
      if (followingMatches) {
        followingCount = this.parseCount(followingMatches[1]);
      }
      
    } catch (error) {
      console.log('⚠️ Could not parse follower counts from content:', error);
    }

    // Extract posts count
    let postCount = 0;
    try {
      const postMatches = profileData.rawContent.match(/(\d[\d.,]*\s*(?:[KMB])?)\s*posts?/i);
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
      username: profileData.username,
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
      console.log(`🔢 Parsing count: "${countStr}"`);
      
      const suffixMatch = countStr.match(/[KMB]$/i);
      const suffix = suffixMatch ? suffixMatch[0].toUpperCase() : '';
      const numericPart = countStr.replace(/[^\d.,]/g, '').replace(/,/g, '');
      const num = parseFloat(numericPart);
      
      if (isNaN(num)) {
        console.log(`❌ Failed to parse numeric part: "${numericPart}"`);
        return 0;
      }
      
      let result: number;
      switch (suffix) {
        case 'K':
          result = Math.round(num * 1_000);
          break;
        case 'M':
          result = Math.round(num * 1_000_000);
          break;
        case 'B':
          result = Math.round(num * 1_000_000_000);
          break;
        default:
          result = Math.round(num);
      }
      
      // Check for JavaScript number precision issues
      if (result > Number.MAX_SAFE_INTEGER) {
        console.log(`⚠️ Number ${result} exceeds MAX_SAFE_INTEGER, precision may be lost`);
      }
      
      console.log(`✅ Parsed "${countStr}" -> ${result.toLocaleString()}`);
      return result;
    } catch (error) {
      console.error(`❌ Error parsing count "${countStr}":`, error);
      return 0;
    }
  }
}

export const instagramScraper = new InstagramScraper();

export async function analyzeInstagramProfile(username: string): Promise<InstagramScrapingResult> {
  const scraper = new InstagramScraper();
  return scraper.analyzeProfile(username);
} 