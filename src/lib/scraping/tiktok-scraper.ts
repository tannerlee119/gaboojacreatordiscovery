import puppeteer, { Browser, Page } from 'puppeteer';
import { TikTokMetrics } from '@/lib/types';

// Helper function to parse numbers with K/M suffixes
function parseNumberWithSuffix(numberStr: string): number {
  const cleanStr = numberStr.replace(/,/g, '');
  
  if (cleanStr.includes('M')) {
    return Math.round(parseFloat(cleanStr.replace('M', '')) * 1000000);
  } else if (cleanStr.includes('K')) {
    return Math.round(parseFloat(cleanStr.replace('K', '')) * 1000);
  } else {
    return parseInt(cleanStr) || 0;
  }
}

interface TikTokScrapingResult {
  success: boolean;
  data?: {
    displayName: string;
    bio: string;
    profileImageUrl: string;
    isVerified: boolean;
    followerCount: number;
    followingCount: number;
    location?: string;
    website?: string;
    metrics: TikTokMetrics;
  };
  screenshot?: Buffer;
  method: 'scraping' | 'manual';
  error?: string;
}

export async function analyzeTikTokProfile(username: string): Promise<TikTokScrapingResult> {
  let browser: Browser | null = null;
  let page: Page | null = null;
  
  try {
    console.log(`Starting TikTok analysis for: ${username}`);
    
    // Launch browser with enhanced stealth settings for TikTok
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-blink-features=AutomationControlled',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ],
    });

    page = await browser.newPage();
    
    // Enhanced stealth measures
    await page.evaluateOnNewDocument(() => {
      // Remove webdriver property
      delete (window as unknown as { navigator: { webdriver?: unknown } }).navigator.webdriver;
      
      // Override plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
      
      // Override languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
    });
    
    // Set viewport and additional headers
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    });

    // Add random delay to appear more human-like
    const randomDelay = Math.floor(Math.random() * 2000) + 1000; // 1-3 seconds
    await new Promise(resolve => setTimeout(resolve, randomDelay));

    // Navigate to TikTok profile
    const profileUrl = `https://www.tiktok.com/@${username}`;
    console.log(`Navigating to: ${profileUrl}`);
    
    await page.goto(profileUrl, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    // Wait for page to load with random delay
    const loadDelay = Math.floor(Math.random() * 3000) + 3000; // 3-6 seconds
    console.log(`Waiting ${loadDelay}ms for TikTok page to load...`);
    await new Promise(resolve => setTimeout(resolve, loadDelay));

    // Check if we got an error page and try to refresh
    const errorCheck = await page.evaluate(() => {
      return document.body.textContent?.includes('Something went wrong') ||
             document.body.textContent?.includes('Sorry about that') ||
             document.body.textContent?.includes('try again later');
    });
    
    if (errorCheck) {
      console.log('TikTok page error detected, attempting refresh...');
      
      // Try to find and click refresh button using evaluate
      const refreshClicked = await page.evaluate(() => {
        // Look for refresh button by text content
        const buttons = Array.from(document.querySelectorAll('button'));
        const refreshButton = buttons.find(btn => 
          btn.textContent?.toLowerCase().includes('refresh') ||
          btn.textContent?.toLowerCase().includes('retry') ||
          btn.getAttribute('data-testid') === 'refresh-button'
        );
        
        if (refreshButton) {
          refreshButton.click();
          return true;
        }
        return false;
      });
      
      if (refreshClicked) {
        console.log('Clicked refresh button');
        await new Promise(resolve => setTimeout(resolve, 5000));
      } else {
        // Manual refresh if no button found
        console.log('No refresh button found, doing manual page reload...');
        await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      
      // Check again for error
      const stillError = await page.evaluate(() => {
        return document.body.textContent?.includes('Something went wrong');
      });
      
      if (stillError) {
        console.log('Still getting error after refresh, trying different approach...');
        
        // Try with different user agent
        await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1');
        await page.goto(profileUrl, { 
          waitUntil: 'networkidle2',
          timeout: 30000 
        });
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    // Take screenshot before scraping
    const screenshot = Buffer.from(await page.screenshot({ 
      fullPage: false,
      type: 'png'
    }));

    // Check if page loaded successfully by looking for profile elements
    const profileExists = await page.$('[data-e2e="user-title"]') ||
                          await page.$('[data-e2e="user-bio"]') ||
                          await page.$('[data-e2e="user-avatar"]') ||
                          await page.$('h1') ||
                          await page.$('.profile-header');

    if (!profileExists) {
      console.log('TikTok profile elements not found, checking for specific error conditions...');
      
      // Get page content for detailed analysis
      const pageContent = await page.evaluate(() => document.body.textContent || '');
      console.log('Page content sample:', pageContent.substring(0, 300) + '...');
      
      // Check if it's still showing a generic error
      const errorCheck = await page.evaluate(() => {
        return document.body.textContent?.includes('Something went wrong') ||
               document.body.textContent?.includes('Sorry about that') ||
               document.body.textContent?.includes('try again later');
      });
      
      if (errorCheck) {
        throw new Error('TikTok page failed to load - showing error message. This might be due to TikTok\'s anti-bot measures.');
      }

      // Check for account-specific issues - only after confirming it's not a loading error
      if (pageContent.includes('Couldn\'t find this account') ||
          pageContent.includes('This account doesn\'t exist')) {
        
        console.log('TikTok account not found - page content indicates non-existent account');
        throw new Error('This TikTok account does not exist');
      }

      // Check if account is private
      if (pageContent.includes('This account is private') ||
          (pageContent.includes('Private account') && pageContent.includes('Follow'))) {
        
        console.log('TikTok account is private');
        throw new Error('This TikTok account is private');
      }
    }

    // Try to scrape profile data
    const profileData = await scrapeTikTokProfileData(page, username);
    
    // Validate that we got some data
    if (profileData.followerCount === 0 && profileData.followingCount === 0 && !profileData.bio) {
      console.log('Warning: No meaningful data extracted from TikTok profile');
    }
    
    await browser.close();
    
    return {
      success: true,
      data: profileData,
      screenshot,
      method: 'scraping'
    };

  } catch (error) {
    console.error('TikTok scraping error:', error);
    
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('Error closing browser:', closeError);
      }
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown scraping error',
      method: 'scraping'
    };
  }
}

async function scrapeTikTokProfileData(page: Page, username: string) {
  // Default values
  let displayName = username;
  let bio = '';
  let profileImageUrl = '';
  let isVerified = false;
  let followerCount = 0;
  let followingCount = 0;
  let likeCount = 0;
  let videoCount = 0;
  const location = '';
  const website = '';

  try {
    // Extract profile data using multiple selectors as fallbacks
    
    // Display name
    try {
      const nameElement = await page.$('[data-e2e="user-title"]') || 
                          await page.$('h1[data-e2e="user-title"]') ||
                          await page.$('.tiktok-1baulvz-H1ShareTitle');
      if (nameElement) {
        displayName = await page.evaluate(el => el.textContent?.trim() || '', nameElement) || username;
      }
        } catch {
      console.log('Could not extract display name');
    }

    // Bio
    try {
      const bioElement = await page.$('[data-e2e="user-bio"]') ||
                         await page.$('.tiktok-1baulvz-H2ShareDesc');
      if (bioElement) {
        bio = await page.evaluate(el => el.textContent?.trim() || '', bioElement);
      }
    } catch {
      console.log('Could not extract bio');
    }

    // Profile image - try multiple selectors and methods
    try {
      const imgElement = await page.$('[data-e2e="user-avatar"]') ||
                       await page.$('img[data-e2e="user-avatar"]') ||
                       await page.$('.tiktok-1zpj2q-ImgAvatar') ||
                       await page.$('img[alt*="avatar"]') ||
                       await page.$('header img') ||
                       await page.$('span[data-e2e="user-avatar"] img');
      
      if (imgElement) {
        profileImageUrl = await page.evaluate(el => (el as HTMLImageElement).src || '', imgElement);
      }
      
      // Alternative: try to find avatar in spans or divs with background images
      if (!profileImageUrl) {
        const avatarElements = await page.$$('[data-e2e="user-avatar"], .avatar, [class*="avatar"]');
        for (const element of avatarElements) {
          const backgroundImage = await page.evaluate(el => {
            const style = window.getComputedStyle(el);
            return style.backgroundImage;
          }, element);
          
          if (backgroundImage && backgroundImage.includes('url(')) {
            const match = backgroundImage.match(/url\("?([^"]+)"?\)/);
            if (match) {
              profileImageUrl = match[1];
              break;
            }
          }
        }
      }
      
      console.log('Profile image URL found:', profileImageUrl);
    } catch {
      console.log('Could not extract profile image');
    }

    // Verification status
    try {
      const verifiedElement = await page.$('[data-e2e="user-verified"]') ||
                              await page.$('.verified-icon') ||
                              await page.$('svg[data-e2e="user-verified"]');
      isVerified = !!verifiedElement;
    } catch {
      console.log('Could not check verification status');
    }

    // Follower/Following/Likes counts
    try {
      console.log('Attempting to extract TikTok stats...');
      
      // Try primary method with data-e2e attributes
      const statsElements = await page.$$('[data-e2e="followers-count"], [data-e2e="following-count"], [data-e2e="likes-count"]');
      console.log(`Found ${statsElements.length} stat elements with data-e2e`);
      
      for (const statElement of statsElements) {
        const text = await page.evaluate(el => el.textContent?.trim() || '', statElement);
        const dataE2e = await page.evaluate(el => el.getAttribute('data-e2e') || '', statElement);
        
        console.log(`Processing stat element: ${dataE2e} = "${text}"`);
        const number = parseNumberWithSuffix(text);
        
        if (dataE2e.includes('followers') && number > 0) {
          followerCount = number;
          console.log(`✓ Followers set to: ${followerCount}`);
        } else if (dataE2e.includes('following') && number > 0) {
          followingCount = number;
          console.log(`✓ Following set to: ${followingCount}`);
        } else if (dataE2e.includes('likes') && number > 0) {
          likeCount = number;
          console.log(`✓ Likes set to: ${likeCount}`);
        }
      }
      
      console.log(`TikTok stats after data-e2e - Followers: ${followerCount}, Following: ${followingCount}, Likes: ${likeCount}`);
    } catch (error) {
      console.log('Could not extract follower counts from data-e2e:', error);
    }

    // Try alternative method for stats using text content and broader selectors
    if (followerCount === 0 || followingCount === 0 || likeCount === 0) {
      try {
        console.log('Trying alternative methods for TikTok stats...');
        
        // Method 1: Look for numbers near specific text patterns
        const allText = await page.evaluate(() => document.body.textContent || '');
        console.log('Page text sample:', allText.substring(0, 500) + '...');
        
        // Look for follower patterns in the text
        const followerMatch = allText.match(/(\d+(?:\.\d+)?[KM]?)\s*(?:Followers|followers)/i);
        const followingMatch = allText.match(/(\d+(?:\.\d+)?[KM]?)\s*(?:Following|following)/i);
        const likeMatch = allText.match(/(\d+(?:\.\d+)?[KM]?)\s*(?:Likes|likes)/i);
        
        if (followerMatch && followerCount === 0) {
          followerCount = parseNumberWithSuffix(followerMatch[1]);
          console.log(`✓ Followers from text: ${followerCount}`);
        }
        if (followingMatch && followingCount === 0) {
          followingCount = parseNumberWithSuffix(followingMatch[1]);
          console.log(`✓ Following from text: ${followingCount}`);
        }
        if (likeMatch && likeCount === 0) {
          likeCount = parseNumberWithSuffix(likeMatch[1]);
          console.log(`✓ Likes from text: ${likeCount}`);
        }
        
        // Method 2: Try to find stats by looking at strong/span elements
        const strongElements = await page.$$('strong, span[title], [data-e2e] strong, [data-e2e] span');
        console.log(`Found ${strongElements.length} potential stat elements`);
        
        for (const element of strongElements) {
          const text = await page.evaluate(el => el.textContent?.trim() || '', element);
          
          if (text && text.match(/^\d+(\.\d+)?[KM]?$/)) {
            const number = parseNumberWithSuffix(text);
            
            // Look at parent or sibling elements for context
            const context = await page.evaluate(el => {
              const parent = el.parentElement;
              return parent ? parent.textContent?.toLowerCase() || '' : '';
            }, element);
            
            if (context.includes('follower') && followerCount === 0) {
              followerCount = number;
              console.log(`✓ Followers from context: ${followerCount}`);
            } else if (context.includes('following') && followingCount === 0) {
              followingCount = number;
              console.log(`✓ Following from context: ${followingCount}`);
            } else if (context.includes('like') && likeCount === 0) {
              likeCount = number;
              console.log(`✓ Likes from context: ${likeCount}`);
            }
          }
        }
        
        console.log(`TikTok final alternative stats - Followers: ${followerCount}, Following: ${followingCount}, Likes: ${likeCount}`);
      } catch (error) {
        console.log('Could not extract stats from alternative methods:', error);
      }
    }

    // Count videos
    try {
      const videoElements = await page.$$('[data-e2e="user-post-item"]');
      videoCount = videoElements.length;
    } catch {
      console.log('Could not count videos');
    }

  } catch (error) {
    console.error('Error scraping TikTok profile data:', error);
  }

  // Create metrics object
  const metrics: TikTokMetrics = {
    followerCount,
    followingCount,
    likeCount,
    videoCount,
    averageViews: 0, // Would need to scrape individual videos for this
    averageLikes: likeCount > 0 && videoCount > 0 ? Math.round(likeCount / videoCount) : 0,
    engagementRate: followerCount > 0 ? Math.round((likeCount / followerCount) * 100 * 100) / 100 : 0,
    recentVideos: [] // Would need additional scraping for video details
  };

  return {
    displayName,
    bio,
    profileImageUrl,
    isVerified,
    followerCount,
    followingCount,
    location,
    website,
    metrics
  };
} 