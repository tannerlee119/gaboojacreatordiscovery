import { NextRequest, NextResponse } from 'next/server';
import { analyzeInstagramProfile } from '@/lib/scraping/instagram-scraper';
import { analyzeTikTokProfile } from '@/lib/scraping/tiktok-scraper';
import { analyzeWithOpenAI } from '@/lib/ai-analysis/openai-analyzer';
import { saveCreatorProfile } from '@/lib/database/creator-service';
import { Platform } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const { username, platform }: { username: string; platform: Platform } = await request.json();
    
    if (!username || !platform) {
      return NextResponse.json(
        { success: false, error: 'Username and platform are required' },
        { status: 400 }
      );
    }

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
        return NextResponse.json(
          { success: false, error: `Platform ${platform} not supported yet` },
          { status: 400 }
        );
    }

    if (!scrapingResult.success) {
      // Check if it's a user-friendly error (private/non-existent account)
      if (scrapingResult.error?.includes('private') || 
          scrapingResult.error?.includes('does not exist') ||
          scrapingResult.error?.includes('doesn\'t exist')) {
        return NextResponse.json(
          { success: false, error: scrapingResult.error },
          { status: 400 } // Bad request for user issues
        );
      }
      
      // Technical error
      return NextResponse.json(
        { success: false, error: scrapingResult.error || 'No data returned from scraping' },
        { status: 500 }
      );
    }

    if (!scrapingResult.data) {
      return NextResponse.json(
        { success: false, error: 'No data returned from scraping' },
        { status: 500 }
      );
    }

    // Analyze with OpenAI if we have a screenshot
    let aiAnalysis = null;
    if (screenshotBuffer) {
      console.log('Analyzing screenshot with OpenAI...');
      const aiResult = await analyzeWithOpenAI(screenshotBuffer, platform, username);
      if (aiResult.success) {
        aiAnalysis = aiResult.analysis;
      }
    }

    // Prepare the creator profile data
    const creatorProfile = {
      username,
      platform,
      displayName: scrapingResult.data.displayName,
      bio: 'bio' in scrapingResult.data ? scrapingResult.data.bio : undefined,
      profileImageUrl: scrapingResult.data.profileImageUrl,
      isVerified: scrapingResult.data.isVerified,
      followerCount: scrapingResult.data.followerCount,
      followingCount: scrapingResult.data.followingCount,
      location: scrapingResult.data.location,
      website: scrapingResult.data.website,
      metrics: scrapingResult.data.metrics,
      aiAnalysis,
      profileImageBase64: screenshotBuffer ? screenshotBuffer.toString('base64') : undefined,
    };

    // Save to database
    try {
      await saveCreatorProfile(creatorProfile);
    } catch (dbError) {
      console.error('Database save error:', dbError);
      // Continue even if DB save fails
    }

    return NextResponse.json({
      success: true,
      data: {
        profile: creatorProfile,
        scrapingDetails: {
          method: scrapingResult.method,
          timestamp: new Date().toISOString(),
        }
      }
    });

  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    );
  }
} 