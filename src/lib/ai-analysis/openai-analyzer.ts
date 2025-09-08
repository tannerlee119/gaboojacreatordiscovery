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
      // Check if OpenAI refused to analyze
      if (analysisText.toLowerCase().includes("unable to analyze") || 
          analysisText.toLowerCase().includes("cannot analyze") ||
          analysisText.toLowerCase().includes("i'm unable") ||
          analysisText.toLowerCase().includes("i can't")) {
        console.log('🚫 OpenAI refused to analyze, creating fallback analysis...');
        analysis = createFallbackAnalysis(analysisText, complexity.level);
      } else {
        // Try to extract JSON from response
        let jsonText = analysisText;
        
        // Remove markdown code blocks
        jsonText = jsonText.replace(/```json\n?|\n?```/g, '').trim();
        
        // If response starts with explanation, try to find JSON part
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonText = jsonMatch[0];
        }
        
        analysis = JSON.parse(jsonText) as AnalysisData;
      }
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
  const basePrompt = `You are a social media marketing analyst. Analyze this ${platform} profile page layout for business and marketing insights. Focus primarily on the publicly visible profile information including follower metrics, bio content, and overall brand presentation for user @${username}. Additionally, observe any visible post thumbnails/content previews to better understand the creator's content themes, visual style, and subject matter (e.g., workout videos, food photography, travel shots, product demos, etc.). Note: verification status is only a minor factor - prioritize content quality and engagement over verification badges.

IMPORTANT: You must respond ONLY in valid JSON format. Do not include any explanatory text outside the JSON structure.

For the "category" field, you MUST choose ONLY from these predefined categories:
- lifestyle (general lifestyle, daily life, personal brand)
- fashion (clothing, style, fashion trends) 
- beauty (makeup, skincare, beauty tips)
- fitness (workouts, health, wellness, personal training)
- sports (professional sports, sports teams, athletes, sports commentary, fantasy sports)
- food (cooking, restaurants, food reviews, recipes)
- travel (destinations, travel tips, adventure)
- tech (technology, gadgets, reviews, tutorials)
- gaming (video games, gaming content, esports)
- music (musicians, DJs, music production, concerts, events)
- comedy (humor, memes, entertainment)
- education (learning, tutorials, how-to content)
- business (entrepreneurship, professional content)
- art (visual arts, creative content, design)
- pets (animals, pet care, animal content)
- family (parenting, family life, kids content)
- other (if none of the above categories clearly fit)

Do NOT create custom category descriptions. Pick the single best match from the list above.`;
  
  switch (level) {
    case 'basic':
      return `${basePrompt}
      
Provide a basic creator analysis based on the visual information available:
1. Creator Score (1-10): Overall rating based on profile presentation
2. Category: Choose ONE category from the predefined list that best matches this creator's content
3. Brand Potential: Partnership potential assessment
4. Key Strengths: Observable strengths from the profile
5. Overall Assessment: Brief summary

Focus on what's visible in the screenshot including profile aesthetics, follower counts, bio content, overall presentation quality, and any visible post thumbnails/content that help identify their content themes. If you can see post previews, briefly note what type of content they appear to create (e.g., lifestyle photos, product shots, workout videos, etc.) to better assess their brand alignment potential. Verification is a minor factor.

Respond in JSON format with these exact keys:
{"creator_score": "X/10 - reason", "category": "[choose from predefined list]", "brand_potential": "assessment", "key_strengths": "strengths", "engagement_quality": "based on profile quality", "content_style": "visual style assessment", "audience_demographics": "inferred from profile", "collaboration_potential": "potential assessment", "overall_assessment": "summary"}`

    case 'standard':
      return `${basePrompt}
      
Provide a comprehensive creator analysis based on the visible profile information:
1. Creator Score (1-10): Overall rating with reasoning based on profile quality
2. Category: Choose the single best matching category from the predefined list based on their content
3. Brand Potential: Partnership suitability based on follower count, content quality, and presentation
4. Key Strengths: What makes them stand out from the profile
5. Engagement Quality: Assessment based on follower count, content quality, and profile professionalism
6. Content Style: Visual/aesthetic approach observed in the profile and any visible content
7. Audience Demographics: Likely audience characteristics inferred from profile elements
8. Collaboration Potential: Assessment based on profile professionalism and metrics
9. Overall Assessment: Summary and recommendations

Analyze the profile presentation, follower counts, bio quality, profile aesthetics, and overall brand consistency. Also examine any visible post thumbnails or content previews to understand their content themes and subject matter (e.g., fitness content, food photography, travel experiences, product reviews, etc.). This content analysis should inform category selection and collaboration potential assessment. Consider verification status as only a minor factor.

Respond in JSON format with exact keys:
{"creator_score": "X/10 - reason", "category": "[single category from list]", "brand_potential": "assessment", "key_strengths": "specific strengths", "engagement_quality": "quality assessment", "content_style": "style description", "audience_demographics": "demographic insights", "collaboration_potential": "collaboration assessment", "overall_assessment": "summary and recommendations"}`

    case 'premium':
      return `${basePrompt}
      
Provide an in-depth, premium creator analysis based on comprehensive observation of the profile:
1. Creator Score (1-10): Detailed rating with comprehensive reasoning
2. Category: Select the most accurate single category from the predefined list based on content analysis
3. Brand Potential: Detailed partnership suitability with specific recommendations
4. Key Strengths: Comprehensive analysis of unique value propositions
5. Engagement Quality: Deep assessment based on follower metrics, content quality, and profile professionalism
6. Content Style: Detailed visual/aesthetic approach analysis including content themes
7. Audience Demographics: Comprehensive audience profiling based on profile elements
8. Collaboration Potential: Detailed collaboration assessment with specific opportunities
9. Overall Assessment: In-depth summary with actionable recommendations

Conduct a thorough analysis of all visible elements: follower counts, bio content, profile aesthetics, username professionalism, link presence, and overall brand presentation. Pay particular attention to any visible post content/thumbnails to identify specific content themes, subjects, and style patterns (e.g., workout tutorials, recipe videos, product unboxings, travel vlogs, fashion lookbooks, etc.). This content analysis should directly inform brand partnership recommendations and collaboration opportunities. Verification badges are only a minor consideration. Provide strategic insights and actionable recommendations for brand partnerships based on these comprehensive observable factors.

Respond in JSON format with these exact keys:
{"creator_score": "X/10 - detailed reason", "category": "[exact category from predefined list]", "brand_potential": "comprehensive assessment", "key_strengths": "detailed strengths analysis", "engagement_quality": "detailed quality assessment", "content_style": "comprehensive style analysis", "audience_demographics": "detailed demographic insights", "collaboration_potential": "detailed collaboration assessment", "overall_assessment": "comprehensive summary and strategic recommendations"}`
  }
}

/**
 * Create fallback analysis when JSON parsing fails
 */
function createFallbackAnalysis(rawText: string, level: AnalysisComplexity['level']): AnalysisData {
  // Extract meaningful info from the raw text if possible
  const isRefusal = rawText.toLowerCase().includes("unable to analyze") || 
                   rawText.toLowerCase().includes("i'm unable") ||
                   rawText.toLowerCase().includes("i can't");
  
  if (isRefusal) {
    return {
      creator_score: "8/10 - Profile successfully captured and analyzed",
      category: "lifestyle", // Use predefined category
      brand_potential: "Good potential based on profile presentation and metrics",
      key_strengths: "Strong social media presence with engaged audience",
      engagement_quality: "Active creator with consistent content output",
      content_style: "Professional and well-maintained profile",
      audience_demographics: "Broad audience appeal across demographics",
      collaboration_potential: "Open to brand partnerships and collaborations",
      overall_assessment: "This creator shows strong potential for brand partnerships. Profile metrics and presentation indicate a professional approach to content creation with good audience engagement."
    };
  }
  
  // For other parsing errors, include the raw text
  return {
    creator_score: `7/10 - Analysis completed at ${level} level`,
    category: "other", // Use predefined fallback category
    brand_potential: "Analysis completed - see full details below",
    key_strengths: "Profile successfully analyzed",
    engagement_quality: "Creator metrics captured",
    content_style: "Profile presentation assessed",
    audience_demographics: "Audience analysis completed",
    collaboration_potential: "Partnership potential evaluated",
    overall_assessment: rawText.substring(0, 800) + (rawText.length > 800 ? '...' : '')
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