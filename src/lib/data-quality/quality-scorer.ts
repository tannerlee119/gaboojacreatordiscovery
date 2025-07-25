import { Platform } from '@/lib/types';

export interface QualityScore {
  overall: number; // 0-100
  completeness: number; // 0-100
  consistency: number; // 0-100
  reliability: number; // 0-100
  breakdown: {
    requiredFields: number;
    optionalFields: number;
    dataConsistency: number;
    suspiciousMetrics: number;
    platformSpecific: number;
  };
  issues: QualityIssue[];
  recommendations: string[];
}

export interface QualityIssue {
  field: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  impact: number; // Points deducted from score
}

export class DataQualityScorer {
  /**
   * Calculate comprehensive quality score for creator data
   */
  static scoreCreatorData(data: Record<string, unknown>, platform: Platform): QualityScore {
    const issues: QualityIssue[] = [];
    const breakdown = {
      requiredFields: 0,
      optionalFields: 0,
      dataConsistency: 0,
      suspiciousMetrics: 0,
      platformSpecific: 0
    };

    // Score required fields
    breakdown.requiredFields = this.scoreRequiredFields(data, issues);
    
    // Score optional fields
    breakdown.optionalFields = this.scoreOptionalFields(data, issues);
    
    // Score data consistency
    breakdown.dataConsistency = this.scoreDataConsistency(data, platform, issues);
    
    // Score suspicious metrics
    breakdown.suspiciousMetrics = this.scoreSuspiciousMetrics(data, platform, issues);
    
    // Score platform-specific requirements
    breakdown.platformSpecific = this.scorePlatformSpecific(data, platform, issues);

    // Calculate component scores
    const completeness = (breakdown.requiredFields * 0.7 + breakdown.optionalFields * 0.3);
    const consistency = breakdown.dataConsistency;
    const reliability = (breakdown.suspiciousMetrics * 0.6 + breakdown.platformSpecific * 0.4);

    // Calculate overall score
    const overall = (completeness * 0.4 + consistency * 0.3 + reliability * 0.3);

    // Generate recommendations
    const recommendations = this.generateRecommendations(issues, breakdown);

    return {
      overall: Math.round(overall),
      completeness: Math.round(completeness),
      consistency: Math.round(consistency),
      reliability: Math.round(reliability),
      breakdown,
      issues,
      recommendations
    };
  }

  /**
   * Score required fields presence and validity
   */
  private static scoreRequiredFields(data: Record<string, unknown>, issues: QualityIssue[]): number {
    let score = 100;
    const requiredFields = ['username', 'platform', 'displayName'];
    
    requiredFields.forEach(field => {
      if (!data[field]) {
        issues.push({
          field,
          severity: 'critical',
          message: `Required field '${field}' is missing`,
          impact: 25
        });
        score -= 25;
      } else if (typeof data[field] === 'string' && (data[field] as string).trim().length === 0) {
        issues.push({
          field,
          severity: 'critical',
          message: `Required field '${field}' is empty`,
          impact: 20
        });
        score -= 20;
      }
    });

    // Validate username format
    if (data.username && typeof data.username === 'string') {
      const username = data.username as string;
      if (!/^[a-zA-Z0-9._]+$/.test(username)) {
        issues.push({
          field: 'username',
          severity: 'warning',
          message: 'Username contains invalid characters',
          impact: 10
        });
        score -= 10;
      }
      if (username.length > 30) {
        issues.push({
          field: 'username',
          severity: 'warning',
          message: 'Username is too long',
          impact: 5
        });
        score -= 5;
      }
    }

    return Math.max(0, score);
  }

  /**
   * Score optional fields presence and quality
   */
  private static scoreOptionalFields(data: Record<string, unknown>, issues: QualityIssue[]): number {
    let score = 0;
    const optionalFields = [
      { field: 'bio', weight: 15 },
      { field: 'profileImageUrl', weight: 10 },
      { field: 'location', weight: 10 },
      { field: 'website', weight: 15 },
      { field: 'isVerified', weight: 10 },
      { field: 'followerCount', weight: 20 },
      { field: 'followingCount', weight: 10 },
      { field: 'metrics', weight: 10 }
    ];

    optionalFields.forEach(({ field, weight }) => {
      if (data[field] !== undefined && data[field] !== null && data[field] !== '') {
        score += weight;
        
        // Additional validation for specific fields
        if (field === 'website' && typeof data[field] === 'string') {
          try {
            new URL(data[field] as string);
          } catch {
            issues.push({
              field,
              severity: 'warning',
              message: 'Invalid website URL format',
              impact: 5
            });
            score -= 5;
          }
        }
        
        if (field === 'followerCount' && typeof data[field] === 'number') {
          const count = data[field] as number;
          if (count < 0) {
            issues.push({
              field,
              severity: 'warning',
              message: 'Negative follower count',
              impact: 10
            });
            score -= 10;
          }
        }
      }
    });

    return Math.min(100, score);
  }

  /**
   * Score data consistency and logical coherence
   */
  private static scoreDataConsistency(data: Record<string, unknown>, platform: Platform, issues: QualityIssue[]): number {
    let score = 100;

    // Check follower/following ratio consistency
    if (typeof data.followerCount === 'number' && typeof data.followingCount === 'number') {
      const followers = data.followerCount as number;
      const following = data.followingCount as number;
      
      if (followers === 0 && following > 1000) {
        issues.push({
          field: 'followingCount',
          severity: 'warning',
          message: 'High following count with zero followers is suspicious',
          impact: 15
        });
        score -= 15;
      }
      
      if (followers > 1000000 && following === 0) {
        issues.push({
          field: 'followingCount',
          severity: 'info',
          message: 'Large account with zero following is unusual but possible',
          impact: 5
        });
        score -= 5;
      }
    }

    // Check metrics consistency
    if (data.metrics && typeof data.metrics === 'object') {
      const metrics = data.metrics as Record<string, unknown>;
      score -= this.validateMetricsConsistency(metrics, platform, issues);
    }

    // Check verification consistency
    if (data.isVerified === true && typeof data.followerCount === 'number') {
      const followers = data.followerCount as number;
      if (followers < 1000) {
        issues.push({
          field: 'isVerified',
          severity: 'warning',
          message: 'Verified account with very low follower count is unusual',
          impact: 10
        });
        score -= 10;
      }
    }

    return Math.max(0, score);
  }

  /**
   * Score suspicious metrics that might indicate data quality issues
   */
  private static scoreSuspiciousMetrics(data: Record<string, unknown>, platform: Platform, issues: QualityIssue[]): number {
    let score = 100;

    if (!data.metrics || typeof data.metrics !== 'object') {
      return score; // No metrics to validate
    }

    const metrics = data.metrics as Record<string, unknown>;
    const followers = (data.followerCount as number) || 0;

    switch (platform) {
      case 'instagram':
        score -= this.validateInstagramMetrics(metrics, followers, issues);
        break;
      case 'tiktok':
        score -= this.validateTikTokMetrics(metrics, followers, issues);
        break;
      case 'youtube':
        score -= this.validateYouTubeMetrics(metrics, followers, issues);
        break;
    }

    return Math.max(0, score);
  }

  /**
   * Score platform-specific data requirements
   */
  private static scorePlatformSpecific(data: Record<string, unknown>, platform: Platform, issues: QualityIssue[]): number {
    let score = 100;

    // Ensure platform matches data structure
    if (data.platform !== platform) {
      issues.push({
        field: 'platform',
        severity: 'critical',
        message: `Platform mismatch: expected ${platform}, got ${data.platform}`,
        impact: 30
      });
      score -= 30;
    }

    // Platform-specific requirements
    switch (platform) {
      case 'instagram':
        if (!data.metrics || !(data.metrics as Record<string, unknown>).postCount) {
          issues.push({
            field: 'metrics.postCount',
            severity: 'warning',
            message: 'Instagram profiles should include post count',
            impact: 10
          });
          score -= 10;
        }
        break;
        
      case 'tiktok':
        if (!data.metrics || !(data.metrics as Record<string, unknown>).videoCount) {
          issues.push({
            field: 'metrics.videoCount',
            severity: 'warning',
            message: 'TikTok profiles should include video count',
            impact: 10
          });
          score -= 10;
        }
        break;
        
      case 'youtube':
        if (!data.metrics || !(data.metrics as Record<string, unknown>).subscriberCount) {
          issues.push({
            field: 'metrics.subscriberCount',
            severity: 'warning',
            message: 'YouTube profiles should include subscriber count',
            impact: 10
          });
          score -= 10;
        }
        break;
    }

    return Math.max(0, score);
  }

  /**
   * Validate metrics consistency for any platform
   */
  private static validateMetricsConsistency(metrics: Record<string, unknown>, platform: Platform, issues: QualityIssue[]): number {
    let deduction = 0;

    // Check engagement rate bounds
    if (typeof metrics.engagementRate === 'number') {
      const rate = metrics.engagementRate as number;
      if (rate < 0 || rate > 100) {
        issues.push({
          field: 'metrics.engagementRate',
          severity: 'warning',
          message: `Engagement rate ${rate}% is outside normal bounds (0-100%)`,
          impact: 15
        });
        deduction += 15;
      } else if (rate > 20) {
        issues.push({
          field: 'metrics.engagementRate',
          severity: 'info',
          message: `Very high engagement rate ${rate}% should be verified`,
          impact: 5
        });
        deduction += 5;
      }
    }

    return deduction;
  }

  /**
   * Validate Instagram-specific metrics
   */
  private static validateInstagramMetrics(metrics: Record<string, unknown>, followers: number, issues: QualityIssue[]): number {
    let deduction = 0;

    if (typeof metrics.averageLikes === 'number') {
      const avgLikes = metrics.averageLikes as number;
      if (followers > 0 && avgLikes > followers * 0.5) {
        issues.push({
          field: 'metrics.averageLikes',
          severity: 'warning',
          message: 'Average likes exceed 50% of followers (suspicious)',
          impact: 20
        });
        deduction += 20;
      }
    }

    return deduction;
  }

  /**
   * Validate TikTok-specific metrics
   */
  private static validateTikTokMetrics(metrics: Record<string, unknown>, followers: number, issues: QualityIssue[]): number {
    let deduction = 0;

    if (typeof metrics.averageViews === 'number') {
      const avgViews = metrics.averageViews as number;
      if (followers === 0 && avgViews > 10000) {
        issues.push({
          field: 'metrics.averageViews',
          severity: 'warning',
          message: 'High view count with zero followers is suspicious',
          impact: 15
        });
        deduction += 15;
      }
    }

    return deduction;
  }

  /**
   * Validate YouTube-specific metrics
   */
  private static validateYouTubeMetrics(metrics: Record<string, unknown>, followers: number, issues: QualityIssue[]): number {
    let deduction = 0;

    if (typeof metrics.viewCount === 'number' && typeof metrics.videoCount === 'number') {
      const views = metrics.viewCount as number;
      const videos = metrics.videoCount as number;
      
      if (videos === 0 && views > 0) {
        issues.push({
          field: 'metrics.viewCount',
          severity: 'warning',
          message: 'View count without videos is inconsistent',
          impact: 20
        });
        deduction += 20;
      }
    }

    return deduction;
  }

  /**
   * Generate recommendations based on quality issues
   */
  private static generateRecommendations(issues: QualityIssue[], breakdown: QualityScore['breakdown']): string[] {
    const recommendations: string[] = [];

    if (breakdown.requiredFields < 80) {
      recommendations.push('Ensure all required fields (username, platform, displayName) are present and valid');
    }

    if (breakdown.optionalFields < 60) {
      recommendations.push('Add more profile information (bio, website, location) to improve data completeness');
    }

    if (breakdown.dataConsistency < 70) {
      recommendations.push('Review data for logical inconsistencies (follower/following ratios, verification status)');
    }

    if (breakdown.suspiciousMetrics < 80) {
      recommendations.push('Verify metrics accuracy - some values appear unusually high or inconsistent');
    }

    const criticalIssues = issues.filter(issue => issue.severity === 'critical');
    if (criticalIssues.length > 0) {
      recommendations.push('Address critical data quality issues before processing');
    }

    if (recommendations.length === 0) {
      recommendations.push('Data quality is good - no major improvements needed');
    }

    return recommendations;
  }

  /**
   * Batch score multiple profiles
   */
  static batchScore(profiles: Array<{ data: Record<string, unknown>; platform: Platform }>): QualityScore[] {
    return profiles.map(({ data, platform }) => this.scoreCreatorData(data, platform));
  }

  /**
   * Get quality statistics across multiple scores
   */
  static getQualityStats(scores: QualityScore[]): {
    averageScore: number;
    distribution: { excellent: number; good: number; fair: number; poor: number };
    commonIssues: Record<string, number>;
    improvementAreas: string[];
  } {
    const averageScore = scores.reduce((sum, score) => sum + score.overall, 0) / scores.length;
    
    const distribution = {
      excellent: scores.filter(s => s.overall >= 90).length,
      good: scores.filter(s => s.overall >= 70 && s.overall < 90).length,
      fair: scores.filter(s => s.overall >= 50 && s.overall < 70).length,
      poor: scores.filter(s => s.overall < 50).length
    };

    const commonIssues: Record<string, number> = {};
    scores.forEach(score => {
      score.issues.forEach(issue => {
        const key = `${issue.field}: ${issue.message}`;
        commonIssues[key] = (commonIssues[key] || 0) + 1;
      });
    });

    const improvementAreas = Array.from(new Set(
      scores.flatMap(score => score.recommendations)
    )).slice(0, 5); // Top 5 recommendations

    return {
      averageScore: Math.round(averageScore),
      distribution,
      commonIssues,
      improvementAreas
    };
  }
} 