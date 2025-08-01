import { NextRequest, NextResponse } from 'next/server';
import { analyzeInstagramProfile } from '@/lib/scraping/instagram-scraper';
import { analyzeTikTokProfile } from '@/lib/scraping/tiktok-scraper';
import { analyzeWithOpenAI } from '@/lib/ai-analysis/openai-analyzer';
import { saveCreatorAnalysis } from '@/lib/database/supabase-service';
import { logUserSearch } from '@/lib/database/supabase-service';
import { createServerClient } from '@/lib/supabase';
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

    // Validate data quality
    console.log('🔍 Validating data quality...');
    const { DataQualityValidator } = await import('@/lib/data-quality/validator');
    const qualityReport = await DataQualityValidator.validateCreatorProfile(
      sanitizedData,
      platform,
      [] // No existing profiles for duplicate check in this context
    );

    console.log(`📊 Data quality score: ${qualityReport.quality.overall}/100 (${qualityReport.isValid ? 'VALID' : 'INVALID'})`);

    // Log quality issues if any
    if (qualityReport.quality.issues.length > 0) {
      console.log('⚠️ Data quality issues:', qualityReport.quality.issues.map(i => `${i.field}: ${i.message}`));
    }

    // Use normalized data instead of sanitized data
    const finalData = qualityReport.normalizedData;

    // Analyze with OpenAI if we have a screenshot
    let aiAnalysis = null;
    let aiCost = 0;
    let aiModel = 'none';
    if (screenshotBuffer) {
      console.log('Analyzing screenshot with OpenAI...');
      try {
        const profileDataForAI = {
          followerCount: Number(finalData.followerCount) || 0,
          isVerified: Boolean(finalData.isVerified),
          website: (finalData.website as string) || undefined
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

    // Data will be structured in the analysisData object below

    // Get user ID from request headers (if authenticated)
    let userId: string | undefined;
    try {
      const supabase = createServerClient();
      const { data: { session } } = await supabase.auth.getSession();
      userId = session?.user?.id;
    } catch {
      // Continue without user ID for anonymous analysis
    }

    // Prepare complete analysis data for Supabase
    const processingTime = Date.now() - startTime;
    
    const analysisData = {
      profile: {
        username,
        platform,
        displayName: (finalData.displayName as string) || '',
        bio: (finalData.bio as string) || undefined,
        profileImageUrl: (finalData.profileImageUrl as string) || undefined,
        profileImageBase64: screenshotBuffer ? screenshotBuffer.toString('base64') : undefined,
        isVerified: Boolean(finalData.isVerified),
        followerCount: Number(finalData.followerCount) || 0,
        followingCount: Number(finalData.followingCount) || 0,
        location: (finalData.location as string) || undefined,
        website: (finalData.website as string) || undefined,
        metrics: finalData.metrics || {},
        aiAnalysis: aiAnalysis || undefined
      },
      scrapingDetails: {
        method: scrapingResult.method,
        timestamp: new Date().toISOString()
      },
      aiMetrics: {
        model: aiModel,
        cost: aiCost,
        cached: aiModel === 'cached'
      },
      dataQuality: {
        score: qualityReport.quality.overall,
        isValid: qualityReport.isValid,
        breakdown: {
          completeness: qualityReport.quality.completeness,
          consistency: qualityReport.quality.consistency,
          reliability: qualityReport.quality.reliability
        },
        issues: qualityReport.quality.issues.filter(i => i.severity === 'critical' || i.severity === 'warning'),
        transformations: qualityReport.normalization.transformations.length
      },
      processingTime
    };

    // Save complete analysis to Supabase
    let analysisId: string | undefined;
    try {
      console.log('💾 Attempting to save analysis data:', JSON.stringify({
        username: analysisData.profile.username,
        platform: analysisData.profile.platform,
        hasAiAnalysis: !!analysisData.profile.aiAnalysis,
        dataQualityScore: analysisData.dataQuality?.score,
        processingTime: analysisData.processingTime
      }, null, 2));
      
      const saveResult = await saveCreatorAnalysis(analysisData, userId);
      if (saveResult.success) {
        analysisId = saveResult.analysisId;
        console.log(`✅ Analysis saved to Supabase with ID: ${analysisId}`);
      } else {
        console.error('❌ Failed to save analysis:', saveResult.error);
      }
    } catch (dbError) {
      console.error('💥 Database save error:', dbError);
      // Continue even if DB save fails - don't expose internal errors
    }

    // Log user search if authenticated
    if (userId) {
      try {
        await logUserSearch(userId, username, platform, undefined, analysisId);
      } catch (searchLogError) {
        console.error('Failed to log user search:', searchLogError);
        // Continue even if search logging fails
      }
    }

    const response = NextResponse.json({
      success: true,
      data: {
        profile: {
          username,
          platform,
          displayName: (finalData.displayName as string) || '',
          bio: (finalData.bio as string) || undefined,
          profileImageUrl: (finalData.profileImageUrl as string) || undefined,
          profileImageBase64: screenshotBuffer ? screenshotBuffer.toString('base64') : undefined,
          isVerified: Boolean(finalData.isVerified),
          followerCount: Number(finalData.followerCount) || 0,
          followingCount: Number(finalData.followingCount) || 0,
          location: (finalData.location as string) || undefined,
          website: (finalData.website as string) || undefined,
          metrics: finalData.metrics || {},
          aiAnalysis
        },
        scrapingDetails: {
          method: scrapingResult.method,
          timestamp: new Date().toISOString(),
        },
        aiMetrics: {
          model: aiModel,
          cost: aiCost,
          cached: aiModel === 'cached'
        },
        dataQuality: {
          score: qualityReport.quality.overall,
          isValid: qualityReport.isValid,
          breakdown: {
            completeness: qualityReport.quality.completeness,
            consistency: qualityReport.quality.consistency,
            reliability: qualityReport.quality.reliability
          },
          issues: qualityReport.quality.issues.filter(i => i.severity === 'critical' || i.severity === 'warning'),
          transformations: qualityReport.normalization.transformations.length,
          recommendations: qualityReport.recommendations.slice(0, 3) // Top 3 recommendations
        },
        processingTime
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
    
    // Add data quality tracking headers
    response.headers.set('X-Data-Quality-Score', qualityReport.quality.overall.toString());
    response.headers.set('X-Data-Quality-Valid', qualityReport.isValid ? 'true' : 'false');
    response.headers.set('X-Data-Transformations', qualityReport.normalization.transformations.length.toString());
    response.headers.set('X-Data-Issues', qualityReport.quality.issues.length.toString());

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