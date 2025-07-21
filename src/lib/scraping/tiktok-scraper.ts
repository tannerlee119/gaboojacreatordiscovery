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

    // Navigate to TikTok profile
    const profileUrl = `https://www.tiktok.com/@${username}`;
    console.log(`Navigating to: ${profileUrl}`);
    
    await page.goto(profileUrl, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    // Wait a bit for the page to load
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Take screenshot before scraping
    const screenshot = Buffer.from(await page.screenshot({ 
      fullPage: false,
      type: 'png'
    }));

    // Try to scrape profile data
    const profileData = await scrapeTikTokProfileData(page, username);
    
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

    // Profile image
    try {
      const imgElement = await page.$('[data-e2e="user-avatar"]') ||
                         await page.$('img[data-e2e="user-avatar"]') ||
                         await page.$('.tiktok-1zpj2q-ImgAvatar');
      if (imgElement) {
        profileImageUrl = await page.evaluate(el => (el as HTMLImageElement).src || '', imgElement);
      }
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
      const statsElements = await page.$$('[data-e2e="followers-count"], [data-e2e="following-count"], [data-e2e="likes-count"]');
      
      for (const statElement of statsElements) {
        const text = await page.evaluate(el => el.textContent?.trim() || '', statElement);
        const dataE2e = await page.evaluate(el => el.getAttribute('data-e2e') || '', statElement);
        
        const number = parseNumberWithSuffix(text);
        
        if (dataE2e.includes('followers') && number > 0) {
          followerCount = number;
        } else if (dataE2e.includes('following') && number > 0) {
          followingCount = number;
        } else if (dataE2e.includes('likes') && number > 0) {
          likeCount = number;
        }
      }
      
      console.log(`TikTok stats - Followers: ${followerCount}, Following: ${followingCount}, Likes: ${likeCount}`);
    } catch {
      console.log('Could not extract follower counts from data-e2e');
    }

    // Try alternative method for stats using text content
    if (followerCount === 0) {
      try {
        const allText = await page.evaluate(() => document.body.textContent || '');
        
        // Look for follower patterns in the text
        const followerMatch = allText.match(/(\d+(?:\.\d+)?[KM]?)\s*(?:Followers|followers)/i);
        const followingMatch = allText.match(/(\d+(?:\.\d+)?[KM]?)\s*(?:Following|following)/i);
        const likeMatch = allText.match(/(\d+(?:\.\d+)?[KM]?)\s*(?:Likes|likes)/i);
        
        if (followerMatch) {
          followerCount = parseNumberWithSuffix(followerMatch[1]);
        }
        if (followingMatch) {
          followingCount = parseNumberWithSuffix(followingMatch[1]);
        }
        if (likeMatch) {
          likeCount = parseNumberWithSuffix(likeMatch[1]);
        }
        
        console.log(`TikTok alternative stats - Followers: ${followerCount}, Following: ${followingCount}, Likes: ${likeCount}`);
      } catch {
        console.log('Could not extract stats from text content');
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