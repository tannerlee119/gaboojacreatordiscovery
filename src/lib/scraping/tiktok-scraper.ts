import { PlaywrightBaseScraper } from './playwright-base-scraper';
import { TikTokMetrics } from '@/lib/types';
import { Page } from 'playwright';

// Note: parseNumberWithSuffix is now handled by PlaywrightBaseScraper.parseNumberWithSuffix

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
  const scraper = new PlaywrightBaseScraper();
  
  try {
    console.log(`Starting TikTok analysis for: ${username}`);
    
    // Launch browser with mobile device simulation - TikTok works better with mobile
    await scraper.launchBrowser({
      headless: true,
      mobileDevice: true
    });

    const profileUrl = `https://www.tiktok.com/@${username}`;
    console.log(`Navigating to: ${profileUrl}`);
    
    // Navigate with retry logic and longer timeout for TikTok
    await scraper.navigateWithRetry(profileUrl, {
      maxRetries: 3,
      waitUntil: 'networkidle',
      timeout: 45000, // TikTok can be slow to load
      delayBetweenRetries: 3000
    });

    // Additional wait for TikTok to fully load content
    await scraper.delay(5000);

    // Check for errors first
    const errorCheck = await scraper.checkForErrors();
    if (errorCheck.hasError) {
      await scraper.cleanup();
      
      let errorMessage = 'Unknown error occurred';
      switch (errorCheck.errorType) {
        case 'not_found':
          errorMessage = 'This TikTok account does not exist';
          break;
        case 'private_account':
          errorMessage = 'This TikTok account is private';
          break;
        case 'rate_limited':
          errorMessage = 'Rate limited by TikTok. Please try again later';
          break;
        case 'blocked':
          errorMessage = 'Unable to access TikTok profile - page showing error';
          break;
        default:
          errorMessage = errorCheck.message || 'Unknown error occurred';
      }
      
      return {
        success: false,
        error: errorMessage,
        method: 'scraping'
      };
    }

    const page = scraper.getPage();
    if (!page) {
      throw new Error('Page not available');
    }

    // Take screenshot before scraping
    const screenshot = await scraper.takeScreenshot({ 
      fullPage: false
    });

    // Try to scrape profile data
    const profileData = await scrapeTikTokProfileData(page, username, scraper);
    
    await scraper.cleanup();
    
    return {
      success: true,
      data: profileData,
      screenshot,
      method: 'scraping'
    };

  } catch (error) {
    console.error('TikTok scraping error:', error);
    
    await scraper.cleanup();
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown scraping error',
      method: 'scraping'
    };
  }
}

async function scrapeTikTokProfileData(page: Page, username: string, scraper: PlaywrightBaseScraper) {
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
    console.log('Starting TikTok profile data extraction...');
    
    // Display name
    try {
      console.log('Extracting display name...');
      const displayNameSelectors = [
        '[data-e2e="user-title"]',
        'h1[data-e2e="user-title"]',
        'h1',
        '[data-testid="user-title"]'
      ];
      
      for (const selector of displayNameSelectors) {
        try {
          const element = page.locator(selector).first();
          if (await element.isVisible({ timeout: 5000 })) {
            const text = await element.textContent();
            if (text && text.trim()) {
              displayName = text.trim();
              console.log('Found display name:', displayName);
              break;
            }
          }
        } catch (error) {
          console.log(`Display name selector ${selector} failed:`, error);
        }
      }
    } catch (error) {
      console.log('Could not extract display name:', error);
    }

    // Bio
    try {
      console.log('Extracting bio...');
      const bioSelectors = [
        '[data-e2e="user-bio"]',
        '[data-testid="user-bio"]',
        '.user-bio'
      ];
      
      for (const selector of bioSelectors) {
        try {
          const element = page.locator(selector).first();
          if (await element.isVisible({ timeout: 5000 })) {
            const text = await element.textContent();
            if (text && text.trim()) {
              bio = text.trim();
              console.log('Found bio:', bio);
              break;
            }
          }
        } catch (error) {
          console.log(`Bio selector ${selector} failed:`, error);
        }
      }
    } catch (error) {
      console.log('Could not extract bio:', error);
    }

    // Profile image
    try {
      console.log('Extracting profile image...');
      const avatarSelectors = [
        '[data-e2e="user-avatar"] img',
        'img[data-e2e="user-avatar"]',
        '.user-avatar img',
        'span[data-e2e="user-avatar"] img',
        'div[data-e2e="user-avatar"] img'
      ];
      
      for (const selector of avatarSelectors) {
        try {
          const element = page.locator(selector).first();
          if (await element.isVisible({ timeout: 5000 })) {
            const src = await element.getAttribute('src');
            if (src && src.trim()) {
              profileImageUrl = src.trim();
              console.log('Found profile image:', profileImageUrl);
              break;
            }
          }
        } catch (error) {
          console.log(`Avatar selector ${selector} failed:`, error);
        }
      }
    } catch (error) {
      console.log('Could not extract profile image:', error);
    }

    // Verification status
    try {
      console.log('Checking verification status...');
      const verifiedSelectors = [
        '[data-e2e="user-verified"]',
        'svg[data-e2e="user-verified"]',
        '.user-verified',
        '[title="Verified account"]'
      ];
      
      for (const selector of verifiedSelectors) {
        try {
          const element = page.locator(selector).first();
          if (await element.isVisible({ timeout: 3000 })) {
            isVerified = true;
            console.log('Account is verified');
            break;
          }
        } catch (error) {
          console.log(`Verified selector ${selector} failed:`, error);
        }
      }
    } catch (error) {
      console.log('Could not check verification status:', error);
    }

    // Metrics extraction
    try {
      console.log('Extracting follower metrics...');
      
             // Note: Multiple approaches for extracting metrics
      
      // Try to find metrics containers
      const metricsContainers = [
        '[data-e2e="user-page"]',
        '.user-page',
        'main'
      ];
      
      for (const containerSelector of metricsContainers) {
        try {
          const container = page.locator(containerSelector).first();
          if (await container.isVisible({ timeout: 5000 })) {
            
            // Look for follower count
            const followerTexts = [
              'Followers', 'followers', 'Follower', 'follower'
            ];
            
            for (const followerText of followerTexts) {
              try {
                const followerElements = container.locator(`text=${followerText}`);
                const count = await followerElements.count();
                
                for (let i = 0; i < count; i++) {
                  const element = followerElements.nth(i);
                  const parent = element.locator('..').first();
                  const text = await parent.textContent() || '';
                  
                  console.log('Found potential follower text:', text);
                  
                  // Extract number from the text
                  const matches = text.match(/([\d,]+(?:\.\d+)?[KM]?)/);
                  if (matches && matches[1]) {
                    const numberStr = matches[1];
                    if (/^[\d,KM.]+$/.test(numberStr)) {
                      followerCount = scraper.parseNumberWithSuffix(numberStr);
                      console.log('Parsed follower count:', followerCount);
                      break;
                    }
                  }
                }
                
                if (followerCount > 0) break;
              } catch (error) {
                console.log(`Follower extraction failed for "${followerText}":`, error);
              }
            }
            
            // Look for following count
            const followingTexts = [
              'Following', 'following'
            ];
            
            for (const followingText of followingTexts) {
              try {
                const followingElements = container.locator(`text=${followingText}`);
                const count = await followingElements.count();
                
                for (let i = 0; i < count; i++) {
                  const element = followingElements.nth(i);
                  const parent = element.locator('..').first();
                  const text = await parent.textContent() || '';
                  
                  console.log('Found potential following text:', text);
                  
                  const matches = text.match(/([\d,]+(?:\.\d+)?[KM]?)/);
                  if (matches && matches[1]) {
                    const numberStr = matches[1];
                    if (/^[\d,KM.]+$/.test(numberStr)) {
                      followingCount = scraper.parseNumberWithSuffix(numberStr);
                      console.log('Parsed following count:', followingCount);
                      break;
                    }
                  }
                }
                
                if (followingCount > 0) break;
              } catch (error) {
                console.log(`Following extraction failed for "${followingText}":`, error);
              }
            }
            
            // Look for likes count
            const likesTexts = [
              'Likes', 'likes', 'Like', 'like'
            ];
            
            for (const likesText of likesTexts) {
              try {
                const likesElements = container.locator(`text=${likesText}`);
                const count = await likesElements.count();
                
                for (let i = 0; i < count; i++) {
                  const element = likesElements.nth(i);
                  const parent = element.locator('..').first();
                  const text = await parent.textContent() || '';
                  
                  console.log('Found potential likes text:', text);
                  
                  const matches = text.match(/([\d,]+(?:\.\d+)?[KM]?)/);
                  if (matches && matches[1]) {
                    const numberStr = matches[1];
                    if (/^[\d,KM.]+$/.test(numberStr)) {
                      likeCount = scraper.parseNumberWithSuffix(numberStr);
                      console.log('Parsed likes count:', likeCount);
                      break;
                    }
                  }
                }
                
                if (likeCount > 0) break;
              } catch (error) {
                console.log(`Likes extraction failed for "${likesText}":`, error);
              }
            }
            
            break; // Exit container loop if we found the right container
          }
        } catch (error) {
          console.log(`Container ${containerSelector} failed:`, error);
        }
      }
      
      // Try to estimate video count by counting video elements
      try {
        const videoElements = page.locator('[data-e2e="user-post-item"], .video-feed-item');
        videoCount = await videoElements.count();
        console.log('Estimated video count:', videoCount);
      } catch (error) {
        console.log('Could not count videos:', error);
      }
      
    } catch (error) {
      console.error('Error extracting TikTok metrics:', error);
    }

    console.log('Final extracted TikTok data:', {
      displayName,
      bio: bio.substring(0, 100) + (bio.length > 100 ? '...' : ''),
      followerCount,
      followingCount,
      likeCount,
      videoCount,
      isVerified,
      profileImageUrl: profileImageUrl ? 'Found' : 'Not found'
    });

    const metrics: TikTokMetrics = {
      followerCount,
      followingCount,
      likeCount,
      videoCount,
      engagementRate: 0, // Will be calculated later
      averageViews: 0,
      averageLikes: 0,
      recentVideos: [] // Would need additional scraping to populate
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

  } catch (error) {
    console.error('Error in scrapeTikTokProfileData:', error);
    throw error;
  }
} 