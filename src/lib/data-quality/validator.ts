import { Platform } from '@/lib/types';
import { DataNormalizer, NormalizationResult } from './normalizer';
import { DataQualityScorer, QualityScore } from './quality-scorer';
import { DuplicateDetector, DuplicateMatch, ProfileIdentifier } from './duplicate-detector';

export interface DataQualityReport {
  isValid: boolean;
  originalData: Record<string, unknown>;
  normalizedData: Record<string, unknown>;
  normalization: {
    transformations: string[];
    issues: string[];
  };
  quality: QualityScore;
  duplicates: DuplicateMatch[];
  recommendations: string[];
  processingTime: number;
}

export interface BatchQualityReport {
  totalProfiles: number;
  validProfiles: number;
  averageQuality: number;
  qualityDistribution: {
    excellent: number; // 90-100
    good: number; // 70-89
    fair: number; // 50-69
    poor: number; // 0-49
  };
  normalizationStats: {
    totalTransformations: number;
    totalIssues: number;
    successRate: number;
  };
  duplicateStats: {
    totalDuplicates: number;
    highConfidence: number;
    recommendMerge: number;
  };
  commonIssues: string[];
  recommendations: string[];
}

export class DataQualityValidator {
  /**
   * Check if data meets minimum quality thresholds to prevent garbage insertion
   */
  static isDataAcceptable(data: Record<string, unknown>, platform: Platform): { acceptable: boolean; reason?: string } {
    // Check for essential fields
    if (!data.username || typeof data.username !== 'string') {
      return { acceptable: false, reason: 'Missing or invalid username' };
    }
    
    if (!data.displayName || typeof data.displayName !== 'string') {
      return { acceptable: false, reason: 'Missing display name' };
    }
    
    // Check follower count validity
    const followerCount = Number(data.followerCount);
    if (!followerCount || followerCount <= 0 || followerCount > 1000000000) {
      return { acceptable: false, reason: `Invalid follower count: ${followerCount}` };
    }
    
    // Reject test/invalid usernames
    const username = String(data.username).toLowerCase();
    if (username.includes('test') || username.includes('demo') || username.length < 2) {
      return { acceptable: false, reason: 'Test or invalid username detected' };
    }
    
    // Must have either profile image or bio (indicates successful scraping)
    if (!data.profileImageUrl && !data.bio) {
      return { acceptable: false, reason: 'No profile image or bio - indicates scraping failure' };
    }
    
    // Platform-specific validation
    if (platform === 'instagram') {
      // Instagram profiles should have post count
      if (!data.metrics || !Number((data.metrics as Record<string, unknown>)?.postCount)) {
        return { acceptable: false, reason: 'Instagram profile missing post count' };
      }
    }
    
    if (platform === 'tiktok') {
      // TikTok profiles should have video count or like count
      const metrics = data.metrics as Record<string, unknown>;
      if (!metrics || (!Number(metrics.videoCount) && !Number(metrics.likeCount))) {
        return { acceptable: false, reason: 'TikTok profile missing video or like count' };
      }
    }
    
    return { acceptable: true };
  }

  /**
   * Validate a single creator profile
   */
  static async validateCreatorProfile(
    rawData: Record<string, unknown>, 
    platform: Platform,
    existingProfiles: ProfileIdentifier[] = []
  ): Promise<DataQualityReport> {
    const startTime = Date.now();
    
    try {
      // Step 1: Normalize the data
      const normalizationResult = DataNormalizer.normalizeCreatorData(rawData, platform);
      
      // Step 2: Score data quality
      const qualityScore = DataQualityScorer.scoreCreatorData(normalizationResult.normalized, platform);
      
      // Step 3: Check for duplicates if we have existing profiles
      let duplicates: DuplicateMatch[] = [];
      if (existingProfiles.length > 0 && normalizationResult.normalized.username) {
        const currentProfile: ProfileIdentifier = {
          id: 'current',
          username: normalizationResult.normalized.username as string,
          platform,
          displayName: normalizationResult.normalized.displayName as string || '',
          bio: normalizationResult.normalized.bio as string,
          profileImageUrl: normalizationResult.normalized.profileImageUrl as string,
          location: normalizationResult.normalized.location as string,
          followerCount: normalizationResult.normalized.followerCount as number,
          isVerified: normalizationResult.normalized.isVerified as boolean
        };
        
        duplicates = DuplicateDetector.findSimilarProfiles(currentProfile, existingProfiles);
      }
      
      // Step 4: Generate comprehensive recommendations
      const recommendations = this.generateRecommendations(
        normalizationResult,
        qualityScore,
        duplicates
      );
      
      // Step 5: Determine overall validity
      const isValid = this.determineValidity(qualityScore, duplicates);
      
      const processingTime = Date.now() - startTime;
      
      return {
        isValid,
        originalData: rawData,
        normalizedData: normalizationResult.normalized,
        normalization: {
          transformations: normalizationResult.transformations,
          issues: normalizationResult.issues
        },
        quality: qualityScore,
        duplicates,
        recommendations,
        processingTime
      };
      
    } catch (error) {
      console.error('Data quality validation error:', error);
      
      return {
        isValid: false,
        originalData: rawData,
        normalizedData: rawData,
        normalization: {
          transformations: [],
          issues: [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`]
        },
        quality: {
          overall: 0,
          completeness: 0,
          consistency: 0,
          reliability: 0,
          breakdown: {
            requiredFields: 0,
            optionalFields: 0,
            dataConsistency: 0,
            suspiciousMetrics: 0,
            platformSpecific: 0
          },
          issues: [],
          recommendations: ['Fix validation errors before processing']
        },
        duplicates: [],
        recommendations: ['Fix validation errors before processing'],
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Validate multiple creator profiles in batch
   */
  static async validateBatch(
    profiles: Array<{ data: Record<string, unknown>; platform: Platform }>,
    checkDuplicates: boolean = true
  ): Promise<BatchQualityReport> {
    const reports: DataQualityReport[] = [];
    const allProfiles: ProfileIdentifier[] = [];
    
    // First pass: normalize and score all profiles
    for (const { data, platform } of profiles) {
      const report = await this.validateCreatorProfile(data, platform, []);
      reports.push(report);
      
      // Collect profiles for duplicate detection
      if (checkDuplicates && report.normalizedData.username) {
        allProfiles.push({
          id: `${platform}:${report.normalizedData.username}`,
          username: report.normalizedData.username as string,
          platform,
          displayName: report.normalizedData.displayName as string || '',
          bio: report.normalizedData.bio as string,
          profileImageUrl: report.normalizedData.profileImageUrl as string,
          location: report.normalizedData.location as string,
          followerCount: report.normalizedData.followerCount as number,
          isVerified: report.normalizedData.isVerified as boolean
        });
      }
    }
    
    // Second pass: check for duplicates across all profiles
    let allDuplicates: DuplicateMatch[] = [];
    if (checkDuplicates && allProfiles.length > 1) {
      allDuplicates = DuplicateDetector.findDuplicates(allProfiles);
      
      // Update reports with duplicate information
      allDuplicates.forEach(duplicate => {
        const [profile1, profile2] = [duplicate.profile1, duplicate.profile2];
        const report1 = reports.find(r => 
          `${r.normalizedData.platform}:${r.normalizedData.username}` === profile1
        );
        const report2 = reports.find(r => 
          `${r.normalizedData.platform}:${r.normalizedData.username}` === profile2
        );
        
        if (report1) report1.duplicates.push(duplicate);
        if (report2) report2.duplicates.push(duplicate);
      });
    }
    
    // Generate batch statistics
    return this.generateBatchReport(reports, allDuplicates);
  }

  /**
   * Generate comprehensive recommendations
   */
  private static generateRecommendations(
    normalization: NormalizationResult,
    quality: QualityScore,
    duplicates: DuplicateMatch[]
  ): string[] {
    const recommendations: string[] = [];
    
    // Normalization recommendations
    if (normalization.issues.length > 0) {
      recommendations.push('Address data normalization issues to improve data consistency');
    }
    
    if (normalization.transformations.length > 3) {
      recommendations.push('Review data collection process - high number of transformations needed');
    }
    
    // Quality recommendations
    recommendations.push(...quality.recommendations);
    
    // Duplicate recommendations
    if (duplicates.length > 0) {
      const highConfidenceDuplicates = duplicates.filter(d => d.confidence === 'high');
      if (highConfidenceDuplicates.length > 0) {
        recommendations.push(`${highConfidenceDuplicates.length} high-confidence duplicate(s) found - investigate for merging`);
      }
      
      const mediumConfidenceDuplicates = duplicates.filter(d => d.confidence === 'medium');
      if (mediumConfidenceDuplicates.length > 0) {
        recommendations.push(`${mediumConfidenceDuplicates.length} potential duplicate(s) found - manual review recommended`);
      }
    }
    
    // Overall recommendations based on quality score
    if (quality.overall < 50) {
      recommendations.unshift('⚠️ Poor data quality detected - consider re-scraping or manual verification');
    } else if (quality.overall < 70) {
      recommendations.unshift('⚠️ Fair data quality - some improvements needed');
    } else if (quality.overall >= 90) {
      recommendations.unshift('✅ Excellent data quality - ready for production use');
    }
    
    return [...new Set(recommendations)]; // Remove duplicates
  }

  /**
   * Determine if data is valid for use
   */
  private static determineValidity(quality: QualityScore, duplicates: DuplicateMatch[]): boolean {
    // Must have minimum quality score
    if (quality.overall < 40) {
      return false;
    }
    
    // Must not have critical issues
    const criticalIssues = quality.issues.filter(issue => issue.severity === 'critical');
    if (criticalIssues.length > 0) {
      return false;
    }
    
    // Check for high-confidence exact duplicates (might be data corruption)
    const exactDuplicates = duplicates.filter(d => 
      d.confidence === 'high' && 
      d.similarity >= 95 &&
      d.reasons.some(r => r.type === 'exact_match')
    );
    if (exactDuplicates.length > 0) {
      return false;
    }
    
    return true;
  }

  /**
   * Generate batch quality report
   */
  private static generateBatchReport(
    reports: DataQualityReport[],
    duplicates: DuplicateMatch[]
  ): BatchQualityReport {
    const validProfiles = reports.filter(r => r.isValid).length;
    const averageQuality = reports.reduce((sum, r) => sum + r.quality.overall, 0) / reports.length;
    
    // Quality distribution
    const qualityDistribution = {
      excellent: reports.filter(r => r.quality.overall >= 90).length,
      good: reports.filter(r => r.quality.overall >= 70 && r.quality.overall < 90).length,
      fair: reports.filter(r => r.quality.overall >= 50 && r.quality.overall < 70).length,
      poor: reports.filter(r => r.quality.overall < 50).length
    };
    
    // Normalization statistics
    const totalTransformations = reports.reduce((sum, r) => sum + r.normalization.transformations.length, 0);
    const totalIssues = reports.reduce((sum, r) => sum + r.normalization.issues.length, 0);
    const successfulNormalizations = reports.filter(r => r.normalization.issues.length === 0).length;
    
    // Common issues analysis
    const issueMap: Record<string, number> = {};
    reports.forEach(report => {
      report.quality.issues.forEach(issue => {
        const key = `${issue.field}: ${issue.message}`;
        issueMap[key] = (issueMap[key] || 0) + 1;
      });
      
      report.normalization.issues.forEach(issue => {
        issueMap[`Normalization: ${issue}`] = (issueMap[`Normalization: ${issue}`] || 0) + 1;
      });
    });
    
    const commonIssues = Object.entries(issueMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([issue]) => issue);
    
    // Duplicate statistics
    const duplicateStats = {
      totalDuplicates: duplicates.length,
      highConfidence: duplicates.filter(d => d.confidence === 'high').length,
      recommendMerge: duplicates.filter(d => d.recommendation === 'merge').length
    };
    
    // Global recommendations
    const recommendations = this.generateBatchRecommendations(
      reports,
      qualityDistribution,
      duplicateStats
    );
    
    return {
      totalProfiles: reports.length,
      validProfiles,
      averageQuality: Math.round(averageQuality),
      qualityDistribution,
      normalizationStats: {
        totalTransformations,
        totalIssues,
        successRate: Math.round((successfulNormalizations / reports.length) * 100)
      },
      duplicateStats,
      commonIssues,
      recommendations
    };
  }

  /**
   * Generate recommendations for batch processing
   */
  private static generateBatchRecommendations(
    reports: DataQualityReport[],
    qualityDistribution: BatchQualityReport['qualityDistribution'],
    duplicateStats: BatchQualityReport['duplicateStats']
  ): string[] {
    const recommendations: string[] = [];
    
    const totalProfiles = reports.length;
    
    // Quality-based recommendations
    if (qualityDistribution.poor > totalProfiles * 0.2) {
      recommendations.push('High rate of poor quality data detected - review data collection process');
    }
    
    if (qualityDistribution.excellent < totalProfiles * 0.3) {
      recommendations.push('Consider improving data collection to achieve higher quality scores');
    }
    
    // Duplicate-based recommendations
    if (duplicateStats.totalDuplicates > totalProfiles * 0.1) {
      recommendations.push('High duplicate rate detected - implement better deduplication in data collection');
    }
    
    if (duplicateStats.recommendMerge > 0) {
      recommendations.push(`${duplicateStats.recommendMerge} profiles recommended for merging due to high similarity`);
    }
    
    // Overall recommendations
    const averageQuality = reports.reduce((sum, r) => sum + r.quality.overall, 0) / reports.length;
    if (averageQuality < 60) {
      recommendations.push('Overall data quality below acceptable threshold - comprehensive review needed');
    } else if (averageQuality >= 80) {
      recommendations.push('Good overall data quality - minor improvements will optimize performance');
    }
    
    return recommendations;
  }

  /**
   * Get quick validation summary for a profile
   */
  static getQuickValidation(data: Record<string, unknown>, _platform: Platform): {
    isValid: boolean;
    score: number;
    criticalIssues: string[];
  } {
    const requiredFields = ['username', 'platform', 'displayName'];
    const criticalIssues: string[] = [];
    
    // Check required fields
    requiredFields.forEach(field => {
      if (!data[field]) {
        criticalIssues.push(`Missing required field: ${field}`);
      }
    });
    
    // Quick quality estimate
    let score = 100;
    if (criticalIssues.length > 0) score -= criticalIssues.length * 25;
    if (!data.followerCount) score -= 10;
    if (!data.bio) score -= 10;
    if (!data.profileImageUrl) score -= 5;
    
    return {
      isValid: criticalIssues.length === 0 && score >= 40,
      score: Math.max(0, score),
      criticalIssues
    };
  }
} 