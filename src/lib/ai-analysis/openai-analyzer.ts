import OpenAI from 'openai';
import { Platform } from '@/lib/types';
import { AICostOptimizer, AnalysisComplexity, ModelConfig } from './cost-optimizer';

interface OpenAIAnalysisResult {
  success: boolean;
  analysis?: {
    creator_score: string;
    category: string;
    brand_potential: string;
    key_strengths: string;
    engagement_quality: string;
    content_style: string;
    audience_demographics: string;
    collaboration_potential: string;
    overall_assessment: string;
  };
  error?: string;
  cost?: number;
  model?: string;
  cached?: boolean;
}

interface ProfileData {
  followerCount: number;
  isVerified: boolean;
  website?: string;
}

type AnalysisData = {
  creator_score: string;
  category: string;
  brand_potential: string;
  key_strengths: string;
  engagement_quality: string;
  content_style: string;
  audience_demographics: string;
  collaboration_potential: string;
  overall_assessment: string;
};

export async function analyzeWithOpenAI(
  screenshot: Buffer,
  platform: Platform,
  username: string,
  profileData?: ProfileData
): Promise<OpenAIAnalysisResult> {
  const startTime = Date.now();
  
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    
    if (!openaiApiKey) {
      console.log('OpenAI API key not provided, skipping AI analysis');
      return {
        success: false,
        error: 'OpenAI API key not configured'
      };
    }

    // Determine analysis complexity based on profile factors
    const complexity = AICostOptimizer.determineComplexity({
      followerCount: profileData?.followerCount || 0,
      hasVerification: profileData?.isVerified || false,
      hasWebsite: Boolean(profileData?.website),
      platformImportance: AICostOptimizer.getPlatformImportance(platform)
    });

    console.log(`🎯 Analysis complexity determined: ${complexity.level} for @${username} (${complexity.factors.followerCount} followers)`);

    // Generate cache key
    const screenshotHash = AICostOptimizer.generateScreenshotHash(screenshot);
    const cacheKey = AICostOptimizer.generateCacheKey(username, platform, screenshotHash, complexity);

    // Check cache first
    const cachedResult = AICostOptimizer.getCachedAnalysis(cacheKey);
    if (cachedResult) {
      return {
        success: true,
        analysis: cachedResult.analysis as AnalysisData,
        cost: 0,
        model: 'cached',
        cached: true
      };
    }

    // Get optimal model configuration
    const modelConfig = AICostOptimizer.getModelConfig(complexity);
    console.log(`🤖 Using model: ${modelConfig.model} (estimated cost: $${modelConfig.estimatedCostUSD})`);

    // Optimize screenshot
    const optimizedScreenshot = AICostOptimizer.optimizeScreenshot(screenshot, complexity);
    const base64Screenshot = optimizedScreenshot.toString('base64');

    const openai = new OpenAI({
      apiKey: openaiApiKey,
    });

    // Generate tailored prompt based on complexity level
    const prompt = generatePrompt(complexity.level, platform, username);

    console.log('📡 Sending request to OpenAI...');

    const response = await openai.chat.completions.create({
      model: modelConfig.model,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${base64Screenshot}`,
                detail: modelConfig.imageDetail
              }
            }
          ]
        }
      ],
      max_tokens: modelConfig.maxTokens,
      temperature: modelConfig.temperature
    });

    const processingTime = Date.now() - startTime;
    console.log(`⚡ OpenAI request completed in ${processingTime}ms`);

    const analysisText = response.choices[0]?.message?.content;
    if (!analysisText) {
      throw new Error('No response from OpenAI');
    }

    // Parse response with fallback handling
    let analysis: AnalysisData;
    try {
      const jsonText = analysisText.replace(/```json\n?|\n?```/g, '').trim();
      analysis = JSON.parse(jsonText) as AnalysisData;
    } catch (parseError) {
      console.error('Failed to parse OpenAI JSON response:', parseError);
      console.log('Raw response:', analysisText.substring(0, 200) + '...');
      
      // Fallback: create structured response from text
      analysis = createFallbackAnalysis(analysisText, complexity.level);
    }

    // Estimate actual cost (this is approximate - real cost would come from OpenAI usage tracking)
    const actualCost = estimateActualCost(response, modelConfig);

    // Cache the result
    AICostOptimizer.cacheAnalysis(cacheKey, analysis, actualCost);

    console.log(`✅ AI analysis completed successfully (cost: $${actualCost.toFixed(4)})`);

    return {
      success: true,
      analysis,
      cost: actualCost,
      model: modelConfig.model,
      cached: false
    };

  } catch (error) {
    console.error('OpenAI analysis error:', error);
    
    // Implement fallback to basic analysis for premium requests
    if (error instanceof Error && error.message.includes('rate limit')) {
      console.log('🔄 Rate limited, attempting fallback to basic analysis...');
      return attemptFallbackAnalysis(screenshot, platform, username, profileData);
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown OpenAI error',
      cost: 0
    };
  }
}

/**
 * Generate tailored prompt based on complexity level
 */
function generatePrompt(level: AnalysisComplexity['level'], platform: Platform, username: string): string {
  const basePrompt = `Analyze this ${platform} profile screenshot for user @${username}.`;
  
  switch (level) {
    case 'basic':
      return `${basePrompt}
      
Provide a basic creator analysis including:
1. Creator Score (1-10): Overall rating
2. Category: Primary content category  
3. Brand Potential: Basic partnership assessment
4. Key Strengths: Main strengths
5. Overall Assessment: Brief summary

Respond in JSON format with these keys:
{"creator_score": "X/10 - reason", "category": "category", "brand_potential": "assessment", "key_strengths": "strengths", "engagement_quality": "basic", "content_style": "basic", "audience_demographics": "general", "collaboration_potential": "basic", "overall_assessment": "summary"}`;

    case 'standard':
      return `${basePrompt}
      
Provide a comprehensive creator analysis including:
1. Creator Score (1-10): Overall rating with reasoning
2. Category: Primary content category/theme
3. Brand Potential: Partnership suitability assessment
4. Key Strengths: What makes them stand out
5. Engagement Quality: Audience interaction assessment
6. Content Style: Visual/content approach description
7. Audience Demographics: Likely audience characteristics
8. Collaboration Potential: Collaboration assessment
9. Overall Assessment: Summary and recommendations

Be specific and professional. Respond in JSON format with exact keys:
{"creator_score": "X/10 - reason", "category": "category description", "brand_potential": "assessment", "key_strengths": "specific strengths", "engagement_quality": "quality assessment", "content_style": "style description", "audience_demographics": "demographic insights", "collaboration_potential": "collaboration assessment", "overall_assessment": "summary and recommendations"}`;

    case 'premium':
      return `${basePrompt}
      
Provide an in-depth, premium creator analysis including:
1. Creator Score (1-10): Detailed rating with comprehensive reasoning
2. Category: Primary content category with subcategories
3. Brand Potential: Detailed partnership suitability with specific recommendations
4. Key Strengths: Comprehensive analysis of unique value propositions
5. Engagement Quality: Deep assessment of audience interaction patterns
6. Content Style: Detailed visual/content approach analysis
7. Audience Demographics: Comprehensive audience profiling
8. Collaboration Potential: Detailed collaboration assessment with specific opportunities
9. Overall Assessment: In-depth summary with actionable recommendations

Focus on actionable insights, specific metrics observable in the profile, and strategic recommendations. Analyze aesthetics, post quality, follower engagement patterns, and overall brand presentation.

Respond in JSON format with these exact keys:
{"creator_score": "X/10 - detailed reason", "category": "detailed category description", "brand_potential": "comprehensive assessment", "key_strengths": "detailed strengths analysis", "engagement_quality": "detailed quality assessment", "content_style": "comprehensive style analysis", "audience_demographics": "detailed demographic insights", "collaboration_potential": "detailed collaboration assessment", "overall_assessment": "comprehensive summary and strategic recommendations"}`;
  }
}

/**
 * Create fallback analysis when JSON parsing fails
 */
function createFallbackAnalysis(rawText: string, level: AnalysisComplexity['level']): AnalysisData {
  const fallbackQuality = level === 'premium' ? 'Detailed analysis available' : 'Basic analysis available';
  
  return {
    creator_score: `Analysis completed - ${level} level`,
    category: "See full analysis below",
    brand_potential: fallbackQuality,
    key_strengths: fallbackQuality,
    engagement_quality: fallbackQuality,
    content_style: fallbackQuality,
    audience_demographics: fallbackQuality,
    collaboration_potential: fallbackQuality,
    overall_assessment: rawText.substring(0, 1000) + (rawText.length > 1000 ? '...' : '')
  };
}

/**
 * Estimate actual cost based on OpenAI response
 */
function estimateActualCost(response: { usage?: { total_tokens: number } }, modelConfig: ModelConfig): number {
  // This is a rough estimate - real implementation would use OpenAI's usage tracking
  const tokensUsed = response.usage?.total_tokens || modelConfig.maxTokens;
  
  // Approximate pricing (as of 2024)
  const pricePerToken = modelConfig.model === 'gpt-4o' ? 0.00005 : 0.000002;
  const imageCost = modelConfig.imageDetail === 'high' ? 0.01 : 0.003;
  
  return (tokensUsed * pricePerToken) + imageCost;
}

/**
 * Attempt fallback analysis with basic model
 */
async function attemptFallbackAnalysis(
  screenshot: Buffer,
  platform: Platform,
  username: string,
  profileData?: ProfileData
): Promise<OpenAIAnalysisResult> {
  console.log('🔄 Attempting fallback to basic analysis...');
  
  try {
    // Force basic analysis
    const basicProfileData = {
      followerCount: Math.min(profileData?.followerCount || 0, 1000), // Cap at 1000 for basic
      isVerified: false, // Force basic
      website: undefined // Remove website to lower complexity
    };
    
    return await analyzeWithOpenAI(screenshot, platform, username, basicProfileData);
  } catch (fallbackError) {
    console.error('Fallback analysis also failed:', fallbackError);
    return {
      success: false,
      error: 'Analysis temporarily unavailable due to high demand',
      cost: 0
    };
  }
} 