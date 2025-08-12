import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCreatorGrowthData } from '@/lib/database/growth-data-service';

// Validation schema for growth data request
const growthDataRequestSchema = z.object({
  username: z.string().min(1).max(50).trim(),
  platform: z.enum(['instagram', 'tiktok'])
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse and validate query parameters
    const params = growthDataRequestSchema.parse({
      username: searchParams.get('username'),
      platform: searchParams.get('platform')
    });
    
    console.log(`📈 Growth data API request: ${params.platform}/@${params.username}`);
    
    // Fetch growth data from service
    const result = await getCreatorGrowthData(params.username, params.platform);
    
    if (!result.success) {
      // Handle different error types
      if (result.error?.includes('not found')) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 404 }
        );
      }
      
      if (result.error?.includes('Not enough data')) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to fetch growth data' },
        { status: 500 }
      );
    }
    
    // Return successful response with growth data
    return NextResponse.json({
      success: true,
      data: result.data
    });
    
  } catch (error) {
    console.error('❌ Growth data API error:', error);
    
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid request parameters',
          details: error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        },
        { status: 400 }
      );
    }
    
    // Handle other errors
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}