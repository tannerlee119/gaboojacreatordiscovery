import { chromium, Browser, BrowserContext, Page, BrowserContextOptions } from 'playwright';

export interface ScrapingResult {
  success: boolean;
  data?: unknown;
  screenshot?: Buffer;
  method: 'scraping' | 'manual';
  error?: string;
}

export class PlaywrightBaseScraper {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  constructor() {
    // Initialize with default settings
  }

  /**
   * Launch browser with enhanced stealth settings
   */
  async launchBrowser(options: {
    headless?: boolean;
    mobileDevice?: boolean;
    proxy?: string;
  } = {}): Promise<void> {
    try {
      console.log('Launching Playwright browser...');
      
      // Enhanced browser launch arguments for stealth and compatibility
      const launchOptions = {
        headless: options.headless !== false, // Default to headless
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
          '--disable-background-networking',
          '--disable-background-timer-throttling',
          '--disable-renderer-backgrounding',
          '--disable-backgrounding-occluded-windows',
          '--disable-client-side-phishing-detection',
          '--disable-component-extensions-with-background-pages',
          '--disable-default-apps',
          '--disable-extensions',
          '--disable-features=TranslateUI',
          '--disable-hang-monitor',
          '--disable-ipc-flooding-protection',
          '--disable-popup-blocking',
          '--disable-prompt-on-repost',
          '--disable-sync',
          '--force-color-profile=srgb',
          '--metrics-recording-only',
          '--no-default-browser-check',
          '--no-pings',
          '--password-store=basic',
          '--use-mock-keychain',
          '--enable-features=NetworkService,NetworkServiceLogging',
          '--force-device-scale-factor=1',
        ],
      };

      // Add proxy if provided
      if (options.proxy) {
        launchOptions.args.push(`--proxy-server=${options.proxy}`);
      }

      this.browser = await chromium.launch(launchOptions);

      // Create context with enhanced stealth settings
      const contextOptions: BrowserContextOptions = {
        viewport: options.mobileDevice 
          ? { width: 375, height: 667 } // iPhone dimensions
          : { width: 1920, height: 1080 },
        userAgent: options.mobileDevice
          ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1'
          : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        locale: 'en-US',
        timezoneId: 'America/New_York',
        permissions: [],
        extraHTTPHeaders: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
        },
      };

      // Mobile device simulation
      if (options.mobileDevice) {
        contextOptions.deviceScaleFactor = 2;
        contextOptions.isMobile = true;
        contextOptions.hasTouch = true;
      }

      this.context = await this.browser.newContext(contextOptions);

      // Additional stealth measures
      await this.context.addInitScript(() => {
        // Remove webdriver property
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });

        // Mock languages and plugins to appear more human-like
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en'],
        });

        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });

        // Override the `onLine` property
        Object.defineProperty(navigator, 'onLine', {
          get: () => true,
        });

        // Hide automation indicators
        // @ts-expect-error - Adding chrome property for stealth
        window.chrome = {
          runtime: {},
        };
      });

      this.page = await this.context.newPage();

      // Block unnecessary resources for faster loading
      await this.page.route('**/*', (route) => {
        const resourceType = route.request().resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
          route.abort();
        } else {
          route.continue();
        }
      });

      console.log('Browser launched successfully');
    } catch (error) {
      console.error('Failed to launch browser:', error);
      throw error;
    }
  }

  /**
   * Navigate to a URL with retry logic and error handling
   */
  async navigateWithRetry(
    url: string, 
    options: {
      maxRetries?: number;
      waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
      timeout?: number;
      delayBetweenRetries?: number;
    } = {}
  ): Promise<void> {
    const {
      maxRetries = 3,
      waitUntil = 'networkidle',
      timeout = 30000,
      delayBetweenRetries = 2000
    } = options;

    if (!this.page) {
      throw new Error('Browser page not initialized');
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Navigating to ${url} (attempt ${attempt}/${maxRetries})`);
        
        await this.page.goto(url, { 
          waitUntil, 
          timeout 
        });

        // Random delay to appear more human-like
        await this.randomDelay(1000, 3000);
        
        return; // Success
      } catch (error) {
        console.error(`Navigation attempt ${attempt} failed:`, error);
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Wait before retry
        await this.delay(delayBetweenRetries);
      }
    }
  }

  /**
   * Wait for an element with retry logic
   */
  async waitForElementWithRetry(
    selector: string,
    options: {
      timeout?: number;
      maxRetries?: number;
    } = {}
  ): Promise<unknown> {
    const { timeout = 10000, maxRetries = 3 } = options;

    if (!this.page) {
      throw new Error('Browser page not initialized');
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.page.waitForSelector(selector, { timeout });
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        console.log(`Element wait attempt ${attempt} failed, retrying...`);
        await this.delay(1000);
      }
    }
  }

  /**
   * Take a screenshot with options
   */
  async takeScreenshot(options: {
    fullPage?: boolean;
    quality?: number;
  } = {}): Promise<Buffer> {
    if (!this.page) {
      throw new Error('Browser page not initialized');
    }

    return await this.page.screenshot({
      fullPage: options.fullPage || false,
      type: 'png',
      ...options
    });
  }

  /**
   * Check for common error indicators on the page
   */
  async checkForErrors(): Promise<{ hasError: boolean; errorType?: string; message?: string }> {
    if (!this.page) {
      return { hasError: false };
    }

    const pageContent = await this.page.textContent('body') || '';
    const pageTitle = await this.page.title();

    // Common error patterns
    const errorPatterns = [
      {
        type: 'not_found',
        patterns: [
          'Sorry, this page isn\'t available',
          'The link you followed may be broken',
          'User not found',
          'Page not found',
          '404',
          'doesn\'t exist'
        ]
      },
      {
        type: 'private_account',
        patterns: [
          'This Account is Private',
          'This account is private',
          'Account is private'
        ]
      },
      {
        type: 'rate_limited',
        patterns: [
          'Too many requests',
          'Rate limit exceeded',
          'Try again later',
          'Temporary restriction'
        ]
      },
      {
        type: 'blocked',
        patterns: [
          'Something went wrong',
          'Access denied',
          'Blocked',
          'Suspended',
          'Temporarily unavailable'
        ]
      },
      {
        type: 'login_required',
        patterns: [
          'Log in to continue',
          'Sign up',
          'Create account',
          'Login required'
        ]
      }
    ];

    for (const errorCategory of errorPatterns) {
      for (const pattern of errorCategory.patterns) {
        if (pageContent.includes(pattern) || pageTitle.includes(pattern)) {
          return {
            hasError: true,
            errorType: errorCategory.type,
            message: pattern
          };
        }
      }
    }

    return { hasError: false };
  }

  /**
   * Parse number with K/M suffixes
   */
  parseNumberWithSuffix(numberStr: string): number {
    const cleanStr = numberStr.replace(/,/g, '').trim();
    
    if (cleanStr.includes('M')) {
      return Math.round(parseFloat(cleanStr.replace('M', '')) * 1000000);
    } else if (cleanStr.includes('K')) {
      return Math.round(parseFloat(cleanStr.replace('K', '')) * 1000);
    } else {
      return parseInt(cleanStr) || 0;
    }
  }

  /**
   * Random delay to appear more human-like
   */
  async randomDelay(min: number, max: number): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return this.delay(delay);
  }

  /**
   * Simple delay function
   */
  async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      if (this.context) {
        await this.context.close();
        this.context = null;
      }
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      console.log('Browser cleanup completed');
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  /**
   * Get current page reference
   */
  getPage(): Page | null {
    return this.page;
  }

  /**
   * Get current browser reference
   */
  getBrowser(): Browser | null {
    return this.browser;
  }

  /**
   * Get current context reference
   */
  getContext(): BrowserContext | null {
    return this.context;
  }
} 