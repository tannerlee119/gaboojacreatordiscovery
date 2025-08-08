import { PlaywrightBaseScraper, ScrapingResult } from './playwright-base-scraper';
import { TikTokMetrics } from '@/lib/types';

interface TikTokScrapingResult extends ScrapingResult {
  data?: {
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
      console.log(`🔍 Starting TikTok analysis for: ${username}`);
      
      // Initialize browser with Sparticuz chromium if available
      await this.initBrowser();

    const profileUrl = `https://www.tiktok.com/@${username}`;
      console.log(`📱 Navigating to: ${profileUrl}`);
      
      if (!this.page) {
        throw new Error('Page not initialized');
      }

      // Navigate to profile with retry logic
      let retries = 3;
      while (retries > 0) {
        try {
          await this.page.goto(profileUrl, { 
      waitUntil: 'networkidle',
            timeout: 30000 
          });
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

      // Dismiss cookie consent if present
      try {
        const acceptBtn = await this.page.$('button:has-text("Accept all")');
        if (acceptBtn) {
          await acceptBtn.click();
          console.log('🍪 Dismissed cookie banner');
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

      const pageText = (await this.page.textContent('body')) || '';
      const currentUrl = this.page.url();

      // Debug: log what we actually see
      console.log(`📄 Page URL: ${currentUrl}`);
      console.log(`📄 Page title: ${await this.page.title()}`);
      console.log(`📄 Page text length: ${pageText.length}`);
      console.log(`📄 Page text sample: ${pageText.substring(0, 300)}...`);

      // Check for specific error conditions first
      const errorCheck = this.checkForErrors(pageText, currentUrl, username);
      if (!errorCheck.success) {
        return errorCheck;
      }

      // First, try to extract data from page text (even if login prompts are present)
      console.log('🔍 Attempting to parse profile data from page text...');
      const textData = this.parseFromPageText(pageText, username);
      if (textData) {
        console.log('✅ Successfully parsed profile data from page text');
       
        // Take screenshot for AI analysis
        console.log('📸 Taking screenshot for AI analysis...');
        const screenshot = await this.page.screenshot({ 
          fullPage: false,
          type: 'jpeg',
          quality: 80,
          clip: { x: 0, y: 0, width: 1280, height: 1024 }
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

      // Extract profile data
      const profileData = await this.extractProfileData(username);
      
      // Take screenshot
      const screenshot = await this.page.screenshot({ 
        fullPage: true,
        type: 'png'
      });
    
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

  private checkForErrors(pageText: string, currentUrl: string, username: string): TikTokScrapingResult {
    console.log('🔍 Checking for TikTok error conditions...');
    
    const notFoundIndicators = [
      'Couldn\'t find this account',
      'This user doesn\'t exist',
      'User not found',
      'Page Not Found',
      '404',
      'Something went wrong',
      'Account not found',
      'This account cannot be found',
      'No such user exists'
    ];
    
    const privateAccountIndicators = [
      'This account is private',
      'Account is private',
      'Private account',
      'This user\'s account is private'
    ];
    
    const restrictedAccessIndicators = [
      'Log in to TikTok',
      'Sign up for TikTok', 
      'You must be 18 or older',
      'This content is age-restricted',
      'Age verification required',
      'Create an account or log in'
    ];
    
    // Check URL patterns for errors
    if (currentUrl.includes('404') || currentUrl.includes('error') || currentUrl.includes('not-found')) {
      console.log('❌ URL indicates error page');
      return {
        success: false,
        error: `TikTok account @${username} does not exist`,
        method: 'scraping'
      };
    }
    
    // Check page content for error messages
    const lowerContent = pageText.toLowerCase();
    
    // Check for account doesn't exist
    if (notFoundIndicators.some(indicator => lowerContent.includes(indicator.toLowerCase()))) {
      console.log('❌ Account does not exist');
      return {
        success: false,
        error: `TikTok account @${username} does not exist`,
        method: 'scraping'
      };
    }
    
    // Check for private account
    if (privateAccountIndicators.some(indicator => lowerContent.includes(indicator.toLowerCase()))) {
      console.log('🔒 Account is private');
      return {
        success: false,
        error: `TikTok account @${username} is private. Only approved followers can see their content.`,
        method: 'scraping'
      };
    }
    
    // Check for restricted access (requires login/age verification)
    if (restrictedAccessIndicators.some(indicator => lowerContent.includes(indicator.toLowerCase()))) {
      console.log('🚫 Content is restricted or requires login');
      return {
        success: false,
        error: `TikTok account @${username} requires login or age verification to view`,
        method: 'scraping'
      };
    }
    
    console.log('✅ No error conditions detected');
    return { success: true, method: 'scraping' };
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
      
      // Clean up bio text
      const bio = bioRaw.replace(/Something went wrong.*$/i, '').trim();
      
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