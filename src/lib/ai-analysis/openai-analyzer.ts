import OpenAI from 'openai';
import { Platform } from '@/lib/types';

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
}

export async function analyzeWithOpenAI(
  screenshot: Buffer,
  platform: Platform,
  username: string
): Promise<OpenAIAnalysisResult> {
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    
    if (!openaiApiKey) {
      console.log('OpenAI API key not provided, skipping AI analysis');
      return {
        success: false,
        error: 'OpenAI API key not configured'
      };
    }

    const openai = new OpenAI({
      apiKey: openaiApiKey,
    });

    // Convert screenshot to base64
    const base64Screenshot = screenshot.toString('base64');

    const prompt = `
Analyze this ${platform} profile screenshot for user @${username}. 

Provide a comprehensive creator analysis including:

1. Creator Score (1-10): Overall rating as a content creator
2. Category: Primary content category/theme
3. Brand Potential: How suitable they are for brand partnerships
4. Key Strengths: What makes them stand out
5. Engagement Quality: Assessment of their audience interaction
6. Content Style: Description of their visual/content approach
7. Audience Demographics: Likely audience characteristics
8. Collaboration Potential: How good they'd be for collaborations
9. Overall Assessment: Summary and recommendations

Be specific, professional, and provide actionable insights. Focus on what you can observe from the profile aesthetics, post quality, follower counts, and overall presentation.

Respond in JSON format with these exact keys:
{
  "creator_score": "X/10 - reason",
  "category": "category description",
  "brand_potential": "assessment",
  "key_strengths": "specific strengths",
  "engagement_quality": "quality assessment",
  "content_style": "style description",
  "audience_demographics": "demographic insights",
  "collaboration_potential": "collaboration assessment",
  "overall_assessment": "summary and recommendations"
}
`;

    console.log('Sending screenshot to OpenAI for analysis...');

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
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
                detail: "high"
              }
            }
          ]
        }
      ],
      max_tokens: 1000,
      temperature: 0.3
    });

    const analysisText = response.choices[0]?.message?.content;
    if (!analysisText) {
      throw new Error('No response from OpenAI');
    }

    // Try to parse JSON response
    let analysis;
    try {
      // Clean the response in case there are markdown code blocks
      const jsonText = analysisText.replace(/```json\n?|\n?```/g, '').trim();
      analysis = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('Failed to parse OpenAI JSON response:', parseError);
      console.log('Raw response:', analysisText);
      
      // Fallback: create structured response from text
      analysis = {
        creator_score: "Analysis available",
        category: "See full analysis",
        brand_potential: "See full analysis",
        key_strengths: "See full analysis",
        engagement_quality: "See full analysis",
        content_style: "See full analysis",
        audience_demographics: "See full analysis",
        collaboration_potential: "See full analysis",
        overall_assessment: analysisText
      };
    }

    console.log('OpenAI analysis completed successfully');

    return {
      success: true,
      analysis
    };

  } catch (error) {
    console.error('OpenAI analysis error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown OpenAI error'
    };
  }
} 