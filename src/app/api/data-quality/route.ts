import { NextRequest, NextResponse } from 'next/server';
import { DataQualityValidator } from '@/lib/data-quality/validator';
import { setCorsHeaders } from '@/lib/security/cors';
import { Platform } from '@/lib/types';

interface ValidateRequest {
  data: Record<string, unknown>;
  platform: Platform;
  mode: 'single' | 'batch';
  checkDuplicates?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as ValidateRequest;
    
    // Validate request
    if (!body.data || !body.platform) {
      const response = NextResponse.json({
        success: false,
        error: 'Missing required fields: data and platform'
      }, { status: 400 });
      return setCorsHeaders(response);
    }

    if (!['instagram', 'tiktok', 'youtube'].includes(body.platform)) {
      const response = NextResponse.json({
        success: false,
        error: 'Invalid platform. Must be instagram, tiktok, or youtube'
      }, { status: 400 });
      return setCorsHeaders(response);
    }

    // Handle single profile validation
    if (body.mode === 'single' || !Array.isArray(body.data)) {
      const report = await DataQualityValidator.validateCreatorProfile(
        body.data,
        body.platform,
        [] // No existing profiles for duplicate check in single mode
      );

      const response = NextResponse.json({
        success: true,
        data: {
          type: 'single',
          report,
          recommendations: report.recommendations,
          summary: {
            isValid: report.isValid,
            qualityScore: report.quality.overall,
            completenessScore: report.quality.completeness,
            consistencyScore: report.quality.consistency,
            reliabilityScore: report.quality.reliability,
            duplicatesFound: report.duplicates.length,
            processingTime: report.processingTime
          }
        }
      });

      return setCorsHeaders(response);
    }

    // Handle batch validation
    if (body.mode === 'batch' && Array.isArray(body.data)) {
      const profiles = body.data.map(item => ({
        data: item,
        platform: body.platform
      }));

      const batchReport = await DataQualityValidator.validateBatch(
        profiles,
        body.checkDuplicates ?? true
      );

      const response = NextResponse.json({
        success: true,
        data: {
          type: 'batch',
          report: batchReport,
          recommendations: batchReport.recommendations,
          summary: {
            totalProfiles: batchReport.totalProfiles,
            validProfiles: batchReport.validProfiles,
            averageQuality: batchReport.averageQuality,
            successRate: Math.round((batchReport.validProfiles / batchReport.totalProfiles) * 100),
            duplicatesFound: batchReport.duplicateStats.totalDuplicates
          }
        }
      });

      return setCorsHeaders(response);
    }

    const response = NextResponse.json({
      success: false,
      error: 'Invalid request format'
    }, { status: 400 });
    return setCorsHeaders(response);

  } catch (error) {
    console.error('Data quality validation error:', error);
    
    const response = NextResponse.json({
      success: false,
      error: 'Data quality validation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
    
    return setCorsHeaders(response);
  }
}

export async function GET() {
  try {
    // Return data quality system information and statistics
    const systemInfo = {
      version: '1.0.0',
      capabilities: {
        normalization: [
          'Username standardization',
          'Count parsing (K, M, B formats)',
          'URL validation and cleanup',
          'Text normalization',
          'Boolean value normalization',
          'Platform-specific metrics mapping'
        ],
        validation: [
          'Required field validation',
          'Data type validation',
          'Range validation',
          'Format validation',
          'Consistency checks',
          'Platform-specific rules'
        ],
        qualityScoring: [
          'Completeness scoring (0-100)',
          'Consistency scoring (0-100)',
          'Reliability scoring (0-100)',
          'Overall quality score (0-100)',
          'Issue severity classification',
          'Actionable recommendations'
        ],
        duplicateDetection: [
          'Username similarity matching',
          'Display name fuzzy matching',
          'Bio content similarity',
          'Profile image comparison',
          'Location matching',
          'Metrics similarity analysis',
          'Confidence scoring',
          'Merge recommendations'
        ]
      },
      supportedPlatforms: ['instagram', 'tiktok', 'youtube'],
      qualityThresholds: {
        excellent: 90,
        good: 70,
        fair: 50,
        poor: 0
      },
      processingModes: ['single', 'batch'],
      endpoints: {
        validate: 'POST /api/data-quality',
        info: 'GET /api/data-quality'
      }
    };

    const response = NextResponse.json({
      success: true,
      data: systemInfo
    });

    return setCorsHeaders(response);

  } catch (error) {
    console.error('Data quality info error:', error);
    
    const response = NextResponse.json({
      success: false,
      error: 'Failed to retrieve data quality information'
    }, { status: 500 });
    
    return setCorsHeaders(response);
  }
} 