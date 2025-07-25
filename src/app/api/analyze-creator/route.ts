import { NextRequest, NextResponse } from 'next/server';
import { analyzeInstagramProfile } from '@/lib/scraping/instagram-scraper';
import { analyzeTikTokProfile } from '@/lib/scraping/tiktok-scraper';
import { analyzeWithOpenAI } from '@/lib/ai-analysis/openai-analyzer';
import { saveCreatorProfile } from '@/lib/database/creator-service';
import { analyzeCreatorRequestSchema, InputSanitizer } from '@/lib/validation/schemas';
import { apiRateLimiter, getClientIdentifier } from '@/lib/security/rate-limiter';
import { setCorsHeaders, handleCorsPreFlight } from '@/lib/security/cors';
import { ZodError } from 'zod';

// Handle CORS preflight requests
export async function OPTIONS() {
  return handleCorsPreFlight();
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request);
    const rateLimitResult = apiRateLimiter.isAllowed(clientId);
    
    if (!rateLimitResult.allowed) {
      const response = NextResponse.json(
        { 
          success: false, 
          error: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil((rateLimitResult.resetTime! - Date.now()) / 1000)
        },
        { status: 429 }
      );
      
      // Add rate limit headers
      response.headers.set('X-RateLimit-Limit', '10');
      response.headers.set('X-RateLimit-Remaining', '0');
      response.headers.set('X-RateLimit-Reset', rateLimitResult.resetTime!.toString());
      
      return setCorsHeaders(response);
    }

    // Content-Type validation
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const response = NextResponse.json(
        { success: false, error: 'Content-Type must be application/json' },
        { status: 400 }
      );
      return setCorsHeaders(response);
    }

    // Request size validation (basic check)
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 1024 * 10) { // 10KB limit
      const response = NextResponse.json(
        { success: false, error: 'Request payload too large' },
        { status: 413 }
      );
      return setCorsHeaders(response);
    }

    // Parse and validate request body
    let requestBody;
    try {
      requestBody = await request.json();
    } catch {
      const response = NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
      return setCorsHeaders(response);
    }

    // Validate input using Zod schema
    let validatedData;
    try {
      validatedData = analyzeCreatorRequestSchema.parse(requestBody);
    } catch (validationError) {
      if (validationError instanceof ZodError) {
        const response = NextResponse.json(
          { 
            success: false, 
            error: 'Invalid input data', 
            details: validationError.issues.map((issue) => ({
              field: issue.path.join('.'),
              message: issue.message
            }))
          },
          { status: 400 }
        );
        return setCorsHeaders(response);
      }
      
      const response = NextResponse.json(
        { success: false, error: 'Input validation failed' },
        { status: 400 }
      );
      return setCorsHeaders(response);
    }

    const { username, platform } = validatedData;

    console.log(`Starting analysis for ${platform} user: ${username}`);

    let scrapingResult;
    let screenshotBuffer: Buffer | null = null;

    // Scrape the profile based on platform
    switch (platform) {
      case 'instagram':
        scrapingResult = await analyzeInstagramProfile(username);
        screenshotBuffer = scrapingResult.screenshot || null;
        break;
      case 'tiktok':
        scrapingResult = await analyzeTikTokProfile(username);
        screenshotBuffer = scrapingResult.screenshot || null;
        break;
      default:
        const response = NextResponse.json(
          { success: false, error: `Platform ${platform} not supported yet` },
          { status: 400 }
        );
        return setCorsHeaders(response);
    }

    if (!scrapingResult.success) {
      // Check if it's a user-friendly error (private/non-existent account)
      if (scrapingResult.error?.includes('private') || 
          scrapingResult.error?.includes('does not exist') ||
          scrapingResult.error?.includes('doesn\'t exist')) {
        const response = NextResponse.json(
          { success: false, error: scrapingResult.error },
          { status: 400 } // Bad request for user issues
        );
        return setCorsHeaders(response);
      }
      
      // Technical error
      const response = NextResponse.json(
        { success: false, error: 'Analysis failed. Please try again later.' },
        { status: 500 }
      );
      return setCorsHeaders(response);
    }

    if (!scrapingResult.data) {
      const response = NextResponse.json(
        { success: false, error: 'No data returned from analysis' },
        { status: 500 }
      );
      return setCorsHeaders(response);
    }

    // Sanitize scraped data to prevent XSS attacks
    const sanitizedData = InputSanitizer.sanitizeProfileData(scrapingResult.data);

    // Analyze with OpenAI if we have a screenshot
    let aiAnalysis = null;
    let aiCost = 0;
    let aiModel = 'none';
    if (screenshotBuffer) {
      console.log('Analyzing screenshot with OpenAI...');
      try {
        const profileDataForAI = {
          followerCount: Number(sanitizedData.followerCount) || 0,
          isVerified: Boolean(sanitizedData.isVerified),
          website: (sanitizedData.website as string) || undefined
        };
        
        const aiResult = await analyzeWithOpenAI(screenshotBuffer, platform, username, profileDataForAI);
        if (aiResult.success) {
          aiAnalysis = aiResult.analysis;
          aiCost = aiResult.cost || 0;
          aiModel = aiResult.model || 'unknown';
          
          if (aiResult.cached) {
            console.log('💰 Cost saved through caching!');
          }
        }
      } catch (aiError) {
        console.error('AI analysis failed:', aiError);
        // Continue without AI analysis rather than failing the entire request
      }
    }

    // Prepare the creator profile data
    const creatorProfile = {
      username,
      platform,
      displayName: (sanitizedData.displayName as string) || '',
      bio: (sanitizedData.bio as string) || undefined,
      profileImageUrl: (sanitizedData.profileImageUrl as string) || undefined,
      isVerified: Boolean(sanitizedData.isVerified),
      followerCount: Number(sanitizedData.followerCount) || 0,
      followingCount: Number(sanitizedData.followingCount) || 0,
      location: (sanitizedData.location as string) || undefined,
      website: (sanitizedData.website as string) || undefined,
      metrics: sanitizedData.metrics || {},
      aiAnalysis,
      profileImageBase64: screenshotBuffer ? screenshotBuffer.toString('base64') : undefined,
    };

    // Save to database
    try {
      await saveCreatorProfile(creatorProfile);
    } catch (dbError) {
      console.error('Database save error:', dbError);
      // Continue even if DB save fails - don't expose internal errors
    }

    const processingTime = Date.now() - startTime;
    
    const response = NextResponse.json({
      success: true,
      data: {
        profile: creatorProfile,
        scrapingDetails: {
          method: scrapingResult.method,
          timestamp: new Date().toISOString(),
        },
        aiMetrics: {
          model: aiModel,
          cost: aiCost,
          cached: aiModel === 'cached'
        }
      }
    });

    // Add rate limit headers for successful requests
    response.headers.set('X-RateLimit-Limit', '10');
    response.headers.set('X-RateLimit-Remaining', (rateLimitResult.remainingRequests || 0).toString());
    response.headers.set('X-RateLimit-Reset', (rateLimitResult.resetTime || 0).toString());
    response.headers.set('X-Processing-Time', `${processingTime}ms`);
    
    // Add AI cost tracking headers
    response.headers.set('X-AI-Cost', aiCost.toFixed(6));
    response.headers.set('X-AI-Model', aiModel);
    response.headers.set('X-AI-Cached', aiModel === 'cached' ? 'true' : 'false');

    return setCorsHeaders(response);

  } catch (error) {
    console.error('Analysis error:', error);
    
    // Don't expose internal error details in production
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : error instanceof Error ? error.message : 'Unknown error occurred';
    
    const response = NextResponse.json(
      { 
        success: false, 
        error: errorMessage
      },
      { status: 500 }
    );
    
    return setCorsHeaders(response);
  }
} 