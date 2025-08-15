import { chromium, Browser, Page } from 'playwright';

// Import chromium for serverless environments
let chromiumPkg: { executablePath: () => Promise<string>; args: string[] } | null = null;
try {
  // Only import in serverless/production environments
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    chromiumPkg = require('@sparticuz/chromium');
  }
} catch {
  // Silently fail if package not available
  console.log('Sparticuz chromium not available, using default Playwright chromium');
}

export interface ScrapingResult {
  success: boolean;
  data?: Record<string, unknown>;
  screenshot?: Buffer;
  method: string;
  error?: string;
}

export abstract class PlaywrightBaseScraper {
  protected browser: Browser | null = null;
  protected page: Page | null = null;
  
  protected async initBrowser(): Promise<void> {
    try {
      console.log('🚀 Launching browser...');
      
      // Configure browser launch options based on environment
      const launchOptions: {
        headless: boolean;
        args: string[];
        executablePath?: string;
      } = {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          // Additional performance optimizations for TikTok
          '--disable-extensions',
          '--disable-plugins',
          '--disable-default-apps',
          '--disable-sync',
          '--disable-background-networking',
          '--no-default-browser-check',
          '--memory-pressure-off',
          '--single-process',
          '--disable-features=TranslateUI'
        ]
      };

      // Use Sparticuz chromium in production/Vercel environments
      if (chromiumPkg) {
        console.log('📦 Using Sparticuz chromium for serverless environment');
        launchOptions.executablePath = await chromiumPkg.executablePath();
        launchOptions.args = [
          ...chromiumPkg.args,
          ...launchOptions.args
        ];
      } else {
        console.log('🖥️ Using default Playwright chromium for local development');
      }

      this.browser = await chromium.launch(launchOptions);
      this.page = await this.browser.newPage();
      
      // Set viewport and user agent
      await this.page.setViewportSize({ width: 1920, height: 1080 });
      await this.page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9'
      });
      
      console.log('✅ Browser launched successfully');
    } catch (error) {
      console.error('❌ Failed to launch browser:', error);
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
    
    console.log('Page title:', pageTitle);
    console.log('Page content sample:', pageContent.substring(0, 200) + '...');
    
    // Skip error detection if page content is mostly JSON schema (common on TikTok)
    if (pageContent.trim().startsWith('{') || pageContent.includes('"@context":"https://schema.org/"')) {
      console.log('Page contains JSON schema, checking visible content only...');
      
      // Get visible text content instead of all text content
      const visibleContent = await this.page.evaluate(() => {
        // Get only visible text, excluding script tags and hidden elements
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
          {
            acceptNode: function(node) {
              const parent = node.parentElement;
              if (!parent) return NodeFilter.FILTER_REJECT;
              
              const style = window.getComputedStyle(parent);
              if (style.display === 'none' || style.visibility === 'hidden' || 
                  parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE') {
                return NodeFilter.FILTER_REJECT;
              }
              
              return NodeFilter.FILTER_ACCEPT;
            }
          }
        );
        
        let visibleText = '';
        let node;
        while (node = walker.nextNode()) {
          visibleText += node.textContent + ' ';
        }
        
        return visibleText.trim();
      });
      
      console.log('Visible content sample:', visibleContent.substring(0, 200) + '...');
      return this.checkErrorPatterns(visibleContent, pageTitle);
    }
    
    return this.checkErrorPatterns(pageContent, pageTitle);
  }

  private checkErrorPatterns(content: string, title: string): { hasError: boolean; errorType?: string; message?: string } {
    // Common error patterns - made more specific to avoid false positives
    const errorPatterns = [
      {
        type: 'not_found',
        patterns: [
          'Sorry, this page isn\'t available.',
          'The link you followed may be broken, or the page may have been removed.',
          'User not found',
          'Page not found',
          'Couldn\'t find this account'
        ]
      },
      {
        type: 'private_account',
        patterns: [
          'This Account is Private',
          'This account is private'
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
      }
    ];

    for (const errorCategory of errorPatterns) {
      for (const pattern of errorCategory.patterns) {
        if (content.includes(pattern) || title.includes(pattern)) {
          console.log(`Error pattern found: "${pattern}" in ${content.includes(pattern) ? 'content' : 'title'}`);
          return {
            hasError: true,
            errorType: errorCategory.type,
            message: pattern
          };
        }
      }
    }

    console.log('No error patterns found');
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
} 