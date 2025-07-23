import { PlaywrightBaseScraper } from './playwright-base-scraper';
import { InstagramMetrics } from '@/lib/types';
import { Page } from 'playwright';

// Note: parseNumberWithSuffix is now handled by PlaywrightBaseScraper.parseNumberWithSuffix

interface InstagramScrapingResult {
  success: boolean;
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
  screenshot?: Buffer;
  method: 'scraping' | 'manual';
  error?: string;
}

export async function analyzeInstagramProfile(username: string): Promise<InstagramScrapingResult> {
  const scraper = new PlaywrightBaseScraper();
  
  try {
    console.log(`Starting Instagram analysis for: ${username}`);
    
    // Launch browser with mobile device simulation for better success rate
    await scraper.launchBrowser({
      headless: true,
      mobileDevice: true // Instagram often works better with mobile user agent
    });

    const profileUrl = `https://www.instagram.com/${username}/`;
    console.log(`Navigating to: ${profileUrl}`);
    
    // Navigate with retry logic
    await scraper.navigateWithRetry(profileUrl, {
      maxRetries: 3,
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Check for specific errors first (more targeted detection)
    const errorCheck = await scraper.checkForErrors();
    if (errorCheck.hasError) {
      console.log('Error detected:', errorCheck);
      await scraper.cleanup();
      
      let errorMessage = 'Unknown error occurred';
      switch (errorCheck.errorType) {
        case 'not_found':
          errorMessage = 'This Instagram account does not exist';
          break;
        case 'private_account':
          errorMessage = 'This Instagram account is private';
          break;
        case 'rate_limited':
          errorMessage = 'Rate limited by Instagram. Please try again later';
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

    console.log('No errors detected, proceeding with scraping...');

    const page = scraper.getPage();
    if (!page) {
      throw new Error('Page not available');
    }

    // Handle login if required
    const loginRequired = await page.locator('input[name="username"]').first().isVisible().catch(() => false);
    if (loginRequired) {
      console.log('Login detected, attempting to handle...');
      
      // Try to get Instagram credentials from environment
      const instagramUsername = process.env.INSTAGRAM_USERNAME;
      const instagramPassword = process.env.INSTAGRAM_PASSWORD;
      
      if (instagramUsername && instagramPassword) {
        await handleInstagramLogin(page, instagramUsername, instagramPassword, scraper);
        
        // Navigate back to profile after login
        await scraper.navigateWithRetry(profileUrl, {
          waitUntil: 'networkidle',
          timeout: 30000
        });
      } else {
        console.log('No Instagram credentials provided, continuing without login...');
      }
    }

    // Take screenshot before scraping
    const screenshot = await scraper.takeScreenshot({ 
      fullPage: false
    });

    // Try to scrape profile data
    const profileData = await scrapeInstagramProfileData(page, username, scraper);
    
    await scraper.cleanup();
    
    return {
      success: true,
      data: profileData,
      screenshot,
      method: 'scraping'
    };

  } catch (error) {
    console.error('Instagram scraping error:', error);
    
    await scraper.cleanup();
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown scraping error',
      method: 'scraping'
    };
  }
}

async function handleInstagramLogin(page: Page, username: string, password: string, scraper: PlaywrightBaseScraper): Promise<void> {
  try {
    console.log('Attempting Instagram login...');
    
    // Fill in credentials
    await page.fill('input[name="username"]', username);
    await scraper.delay(500);
    await page.fill('input[name="password"]', password);
    await scraper.delay(500);
    
    // Click login button
    await page.click('button[type="submit"]');
    
    // Wait for navigation or error
    await scraper.delay(5000);
    
    // Handle potential "Not Now" buttons for save login info
    try {
      const notNowButton = page.locator('button:has-text("Not Now")').first();
      if (await notNowButton.isVisible({ timeout: 3000 })) {
        await notNowButton.click();
        await scraper.delay(2000);
      }
    } catch {
      // Ignore if button not found
    }
    
    // Handle notification dialog
    try {
      const notNowNotifications = page.locator('button:has-text("Not Now")').first();
      if (await notNowNotifications.isVisible({ timeout: 3000 })) {
        await notNowNotifications.click();
        await scraper.delay(2000);
      }
    } catch {
      // Ignore if button not found
    }
    
    console.log('Instagram login completed');
  } catch (error) {
    console.error('Instagram login error:', error);
    throw error;
  }
}

async function scrapeInstagramProfileData(page: Page, username: string, scraper: PlaywrightBaseScraper) {
  // Default values
  let displayName = username;
  let profileImageUrl = '';
  let isVerified = false;
  let followerCount = 0;
  let followingCount = 0;
  let postCount = 0;
  const location = '';
  let website = '';

  try {
    // Extract profile data using multiple selectors as fallbacks
    
    // Display name
    try {
      const nameElement = page.locator('h2').first();
      if (await nameElement.isVisible({ timeout: 5000 })) {
        displayName = await nameElement.textContent() || username;
      }
    } catch {
      console.log('Could not extract display name');
    }

    // Profile image
    try {
      const imgElement = page.locator('img[alt*="profile picture"], header img').first();
      if (await imgElement.isVisible({ timeout: 5000 })) {
        profileImageUrl = await imgElement.getAttribute('src') || '';
      }
    } catch {
      console.log('Could not extract profile image');
    }

    // Verification status
    try {
      const verifiedElement = page.locator('svg[aria-label="Verified"], svg[title="Verified"]').first();
      isVerified = await verifiedElement.isVisible({ timeout: 3000 });
    } catch {
      console.log('Could not check verification status');
    }

    // Website link
    try {
      console.log('Attempting to extract website link...');
      
      // Look for external links in the profile, but exclude social media and help links
      const linkElements = page.locator('header a[href^="http"]');
      const linkCount = await linkElements.count();
      
      for (let i = 0; i < linkCount; i++) {
        const linkElement = linkElements.nth(i);
        const href = await linkElement.getAttribute('href') || '';
        const linkText = await linkElement.textContent() || '';
        
        console.log('Found link:', href, 'with text:', linkText);
        
        // Skip social media links, help links, and button-like text
        if (href && 
            !href.includes('facebook.com/help') &&
            !href.includes('instagram.com') &&
            !href.includes('help.instagram.com') &&
            !href.includes('threads.com') &&
            !href.includes('facebook.com') &&
            !href.includes('twitter.com') &&
            !href.includes('x.com') &&
            linkText !== 'Follow' &&
            linkText !== 'Following' &&
            !linkText.includes('Followers') &&
            !linkText.includes('posts')) {
          
          website = href;
          console.log('Valid website found:', website);
          break;
        }
      }
    } catch (error) {
      console.log('Error extracting website:', error);
    }

    // Follower count and other metrics
    try {
      console.log('Attempting to extract follower counts...');
      
      // Multiple selectors for follower count
      const followerSelectors = [
        'a[href*="/followers/"] span',
        'button:has-text("followers") span',
        'a:has-text("followers") span',
        '[data-testid="followers"] span'
      ];
      
      for (const selector of followerSelectors) {
        try {
          const elements = page.locator(selector);
          const count = await elements.count();
          
          for (let i = 0; i < count; i++) {
            const element = elements.nth(i);
            const text = await element.textContent() || '';
            const cleanText = text.trim();
            
            console.log('Found potential follower count:', cleanText);
            
            // Check if this looks like a number
            if (/^[\d,KM.]+$/.test(cleanText) && cleanText !== '0') {
              followerCount = scraper.parseNumberWithSuffix(cleanText);
              console.log('Parsed follower count:', followerCount);
              break;
            }
          }
          
          if (followerCount > 0) break;
        } catch (error) {
          console.log(`Selector ${selector} failed:`, error);
        }
      }
      
      // Following count
      const followingSelectors = [
        'a[href*="/following/"] span',
        'button:has-text("following") span',
        'a:has-text("following") span'
      ];
      
      for (const selector of followingSelectors) {
        try {
          const elements = page.locator(selector);
          const count = await elements.count();
          
          for (let i = 0; i < count; i++) {
            const element = elements.nth(i);
            const text = await element.textContent() || '';
            const cleanText = text.trim();
            
            console.log('Found potential following count:', cleanText);
            
            if (/^[\d,KM.]+$/.test(cleanText) && cleanText !== '0') {
              followingCount = scraper.parseNumberWithSuffix(cleanText);
              console.log('Parsed following count:', followingCount);
              break;
            }
          }
          
          if (followingCount > 0) break;
        } catch (error) {
          console.log(`Following selector ${selector} failed:`, error);
        }
      }
      
      // Posts count
      const postSelectors = [
        'div:has-text("posts") span',
        'a:has-text("posts") span',
        'button:has-text("posts") span'
      ];
      
      for (const selector of postSelectors) {
        try {
          const elements = page.locator(selector);
          const count = await elements.count();
          
          for (let i = 0; i < count; i++) {
            const element = elements.nth(i);
            const text = await element.textContent() || '';
            const cleanText = text.trim();
            
            console.log('Found potential post count:', cleanText);
            
            if (/^[\d,KM.]+$/.test(cleanText)) {
              postCount = scraper.parseNumberWithSuffix(cleanText);
              console.log('Parsed post count:', postCount);
              break;
            }
          }
          
          if (postCount > 0) break;
        } catch (error) {
          console.log(`Post selector ${selector} failed:`, error);
        }
      }
      
    } catch (error) {
      console.error('Error extracting metrics:', error);
    }

    console.log('Final extracted data:', {
      displayName,
      followerCount,
      followingCount,
      postCount,
      isVerified,
      website
    });

    const metrics: InstagramMetrics = {
      followerCount,
      followingCount,
      postCount,
      engagementRate: 0, // Will be calculated later
      averageLikes: 0,
      averageComments: 0,
      recentPosts: [] // Would need additional scraping to populate
    };

    return {
      displayName,
      profileImageUrl,
      isVerified,
      followerCount,
      followingCount,
      location,
      website,
      metrics
    };

  } catch (error) {
    console.error('Error in scrapeInstagramProfileData:', error);
    throw error;
  }
} 