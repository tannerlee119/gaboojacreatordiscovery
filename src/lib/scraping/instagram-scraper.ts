import puppeteer, { Browser, Page } from 'puppeteer';
import { InstagramMetrics } from '@/lib/types';

interface InstagramScrapingResult {
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
    metrics: InstagramMetrics;
  };
  screenshot?: Buffer;
  method: 'scraping' | 'manual';
  error?: string;
}

export async function analyzeInstagramProfile(username: string): Promise<InstagramScrapingResult> {
  let browser: Browser | null = null;
  let page: Page | null = null;
  
  try {
    console.log(`Starting Instagram analysis for: ${username}`);
    
    // Launch browser with stealth settings
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
        '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      ],
    });

    page = await browser.newPage();
    
    // Set viewport and additional headers
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
    });

    // Navigate to Instagram profile
    const profileUrl = `https://www.instagram.com/${username}/`;
    console.log(`Navigating to: ${profileUrl}`);
    
    await page.goto(profileUrl, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    // Wait a bit for the page to load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check if login is required
    const loginRequired = await page.$('input[name="username"]');
    if (loginRequired) {
      console.log('Login detected, attempting to handle...');
      
      // Try to get Instagram credentials from environment
      const instagramUsername = process.env.INSTAGRAM_USERNAME;
      const instagramPassword = process.env.INSTAGRAM_PASSWORD;
      
      if (instagramUsername && instagramPassword) {
        await handleInstagramLogin(page, instagramUsername, instagramPassword);
        
        // Navigate back to profile after login
        await page.goto(profileUrl, { 
          waitUntil: 'networkidle2',
          timeout: 30000 
        });
        await new Promise(resolve => setTimeout(resolve, 3000));
      } else {
        console.log('No Instagram credentials provided, continuing without login...');
      }
    }

    // Take screenshot before scraping
    const screenshot = Buffer.from(await page.screenshot({ 
      fullPage: false,
      type: 'png'
    }));

    // Try to scrape profile data
    const profileData = await scrapeInstagramProfileData(page, username);
    
    await browser.close();
    
    return {
      success: true,
      data: profileData,
      screenshot,
      method: 'scraping'
    };

  } catch (error) {
    console.error('Instagram scraping error:', error);
    
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

async function handleInstagramLogin(page: Page, username: string, password: string): Promise<void> {
  try {
    console.log('Attempting Instagram login...');
    
    // Fill in credentials
    await page.type('input[name="username"]', username, { delay: 100 });
    await page.type('input[name="password"]', password, { delay: 100 });
    
    // Click login button
    await page.click('button[type="submit"]');
    
    // Wait for navigation or error
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Handle potential "Not Now" buttons for save login info
    try {
      const notNowButton = await page.$('button:has-text("Not Now")');
      if (notNowButton) {
        await notNowButton.click();
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch {
      // Ignore if button not found
    }
    
    // Handle notification dialog
    try {
      const notNowNotifications = await page.$('button:has-text("Not Now")');
      if (notNowNotifications) {
        await notNowNotifications.click();
        await new Promise(resolve => setTimeout(resolve, 2000));
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

async function scrapeInstagramProfileData(page: Page, username: string) {
  // Default values
  let displayName = username;
  let bio = '';
  let profileImageUrl = '';
  let isVerified = false;
  let followerCount = 0;
  let followingCount = 0;
  let postCount = 0;
  const location = '';
  const website = '';

  try {
    // Extract profile data using multiple selectors as fallbacks
    
    // Display name
    try {
      const nameElement = await page.$('h2') || await page.$('[data-testid="user-name"]');
      if (nameElement) {
        displayName = await page.evaluate(el => el.textContent?.trim() || '', nameElement) || username;
      }
    } catch {
      console.log('Could not extract display name');
    }

    // Bio
    try {
      const bioElement = await page.$('meta[property="og:description"]');
      if (bioElement) {
        bio = await page.evaluate(el => el.getAttribute('content') || '', bioElement);
      }
    } catch {
      console.log('Could not extract bio');
    }

    // Profile image
    try {
      const imgElement = await page.$('img[alt*="profile picture"]') || await page.$('header img');
      if (imgElement) {
        profileImageUrl = await page.evaluate(el => el.src || '', imgElement);
      }
    } catch {
      console.log('Could not extract profile image');
    }

    // Verification status
    try {
      const verifiedElement = await page.$('[title="Verified"]') || await page.$('svg[aria-label="Verified"]');
      isVerified = !!verifiedElement;
    } catch {
      console.log('Could not check verification status');
    }

    // Follower/Following/Posts counts
    try {
      const statsElements = await page.$$('meta[property="og:description"]');
      if (statsElements.length > 0) {
        const descContent = await page.evaluate(el => el.getAttribute('content') || '', statsElements[0]);
        
        // Parse numbers from description using regex
        const followerMatch = descContent.match(/(\d+(?:,\d+)*)\s+Followers/i);
        const followingMatch = descContent.match(/(\d+(?:,\d+)*)\s+Following/i);
        const postMatch = descContent.match(/(\d+(?:,\d+)*)\s+Posts/i);
        
        if (followerMatch) {
          followerCount = parseInt(followerMatch[1].replace(/,/g, ''));
        }
        if (followingMatch) {
          followingCount = parseInt(followingMatch[1].replace(/,/g, ''));
        }
        if (postMatch) {
          postCount = parseInt(postMatch[1].replace(/,/g, ''));
        }
      }
    } catch {
      console.log('Could not extract follower counts from meta');
    }

    // Try alternative method for stats
    if (followerCount === 0) {
      try {
        const statsLinks = await page.$$('a[href*="/followers/"], a[href*="/following/"]');
        for (const link of statsLinks) {
          const text = await page.evaluate(el => el.textContent || '', link);
          const number = parseInt(text.replace(/[^0-9]/g, ''));
          
          const href = await page.evaluate(el => el.href || '', link);
          if (href.includes('/followers/') && !isNaN(number)) {
            followerCount = number;
          } else if (href.includes('/following/') && !isNaN(number)) {
            followingCount = number;
          }
        }
      } catch {
        console.log('Could not extract stats from links');
      }
    }

  } catch (error) {
    console.error('Error scraping profile data:', error);
  }

  // Create metrics object
  const metrics: InstagramMetrics = {
    followerCount,
    followingCount,
    postCount,
    averageLikes: 0, // Would need to scrape recent posts for this
    averageComments: 0, // Would need to scrape recent posts for this
    engagementRate: 0, // Would calculate based on likes/comments
    recentPosts: [] // Would need additional scraping
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