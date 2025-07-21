import puppeteer, { Browser, Page } from 'puppeteer';
import { InstagramMetrics } from '@/lib/types';

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
  let website = '';

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

    // Bio - extract actual bio text, not meta description
    try {
      // Try multiple selectors for bio
      let bioElement = await page.$('header section div:last-child div') ||
                       await page.$('[data-testid="user-bio"]') ||
                       await page.$('header section > div:nth-child(2) > div') ||
                       await page.$('header div[dir="auto"]');
      
      if (bioElement) {
        const bioText = await page.evaluate(el => {
          // Get text content but exclude follower count section
          const text = el.textContent?.trim() || '';
          // Filter out lines that look like follower counts (contain "Followers", "Following", "Posts")
          const lines = text.split('\n').filter(line => 
            !line.includes('Followers') && 
            !line.includes('Following') && 
            !line.includes('Posts') &&
            !line.match(/^\d+[\d,KM]*\s*(Followers|Following|Posts)/i) &&
            line.trim().length > 0
          );
          return lines.join('\n').trim();
        }, bioElement);
        
        if (bioText && !bioText.includes('Followers') && !bioText.includes('Following')) {
          bio = bioText;
        }
      }
      
      // Alternative method: look for bio in specific Instagram structure
      if (!bio) {
        const bioElements = await page.$$('header section span, header section div[dir="auto"]');
        for (const element of bioElements) {
          const text = await page.evaluate(el => el.textContent?.trim() || '', element);
          if (text && 
              !text.includes('Followers') && 
              !text.includes('Following') && 
              !text.includes('Posts') &&
              !text.match(/^\d+[\d,KM]*$/) && // Not just numbers
              text.length > 10) { // Reasonable bio length
            bio = text;
            break;
          }
        }
      }
      
      console.log('Extracted bio:', bio);
    } catch (error) {
      console.log('Could not extract bio:', error);
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

    // Website link
    try {
      // Look for external links in the profile
      const linkElement = await page.$('header a[href^="http"]') ||
                          await page.$('header a[target="_blank"]') ||
                          await page.$('a[role="link"][href^="http"]');
      
      if (linkElement) {
        website = await page.evaluate(el => el.href || '', linkElement);
        console.log('Extracted website:', website);
      }
    } catch (error) {
      console.log('Could not extract website:', error);
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
        console.log('Instagram description content:', descContent);
        
        // Parse numbers from description using regex - handle M, K suffixes and comma-separated numbers
        const followerMatch = descContent.match(/([\d,]+(?:\.\d+)?[MK]?)\s+Followers/i);
        const followingMatch = descContent.match(/([\d,]+(?:\.\d+)?[MK]?)\s+Following/i);
        const postMatch = descContent.match(/([\d,]+(?:\.\d+)?[MK]?)\s+Posts/i);
        
        console.log('Follower match:', followerMatch);
        console.log('Following match:', followingMatch);
        console.log('Post match:', postMatch);
        
        if (followerMatch) {
          followerCount = parseNumberWithSuffix(followerMatch[1]);
        }
        if (followingMatch) {
          followingCount = parseNumberWithSuffix(followingMatch[1]);
        }
        if (postMatch) {
          postCount = parseNumberWithSuffix(postMatch[1]);
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