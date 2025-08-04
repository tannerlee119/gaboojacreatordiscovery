import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Validation schema for discovery filters
const discoveryFiltersSchema = z.object({
  platform: z.enum(['all', 'instagram', 'tiktok']).optional().default('all'),
  category: z.array(z.enum([
    'lifestyle', 'fashion', 'beauty', 'fitness', 'sports', 'food', 'travel',
    'tech', 'gaming', 'music', 'comedy', 'education', 'business',
    'art', 'pets', 'family', 'other'
  ])).optional(),
  minFollowers: z.number().min(0).optional().default(0),
  maxFollowers: z.number().min(0).optional().default(10000000),
  verified: z.boolean().optional(),
  sortBy: z.enum(['followers', 'engagement', 'recent']).optional().default('followers'),
  page: z.number().min(1).optional().default(1),
  limit: z.number().min(1).max(50).optional().default(12)
});

// Sample creator data - diverse range with focus on mid-tier creators (10K-100K)
const sampleCreators = [
  // ===== NANO INFLUENCERS (1K-10K) =====
  {
    id: '1',
    username: 'local_coffee_sarah',
    platform: 'instagram' as const,
    displayName: 'Sarah Miller',
    overallAssessment: 'Authentic local voice with strong community engagement. Perfect for location-based coffee and food partnerships.',
    isVerified: false,
    followerCount: 3400,
    followingCount: 890,
    category: 'food',
    aiScore: '8.9',
    location: 'Portland, OR'
  },
  {
    id: '2',
    username: 'college_fitness_ben',
    platform: 'tiktok' as const,
    displayName: 'Ben Martinez',
    overallAssessment: 'High-energy college fitness content with excellent engagement. Great for student-focused fitness brands.',
    isVerified: false,
    followerCount: 7200,
    followingCount: 145,
    category: 'fitness',
    aiScore: '12.3',
    location: 'Austin, TX'
  },
  {
    id: '3',
    username: 'weekend_painter_anna',
    platform: 'instagram' as const,
    displayName: 'Anna Chen',
    overallAssessment: 'Creative content with educational value. Strong potential for art supply and tutorial partnerships.',
    isVerified: false,
    followerCount: 5800,
    followingCount: 234,
    category: 'art',
    aiScore: '9.7',
    location: 'Seattle, WA'
  },
  {
    id: '4',
    username: 'study_with_james',
    platform: 'tiktok' as const,
    displayName: 'James Wilson',
    overallAssessment: 'Educational content with authentic student perspective. Excellent for educational tools and study resources.',
    isVerified: false,
    followerCount: 9100,
    followingCount: 67,
    category: 'education',
    aiScore: '11.2',
    location: 'Boston, MA'
  },
  {
    id: '5',
    username: 'thrift_finds_lucy',
    platform: 'instagram' as const,
    displayName: 'Lucy Johnson',
    overallAssessment: 'Sustainable fashion advocate with budget-conscious audience. Perfect for eco-friendly and affordable fashion brands.',
    isVerified: false,
    followerCount: 4600,
    followingCount: 312,
    category: 'fashion',
    aiScore: '10.1',
    location: 'Nashville, TN'
  },

  // ===== MID-TIER CREATORS (10K-100K) - SWEET SPOT =====
  {
    id: '6',
    username: 'fitnessjenna',
    platform: 'instagram' as const,
    displayName: 'Jenna Martinez',
    overallAssessment: 'Professional fitness expertise with proven results. Ideal for fitness equipment and supplement partnerships.',
    isVerified: false,
    followerCount: 45300,
    followingCount: 1200,
    category: 'fitness',
    aiScore: '4.2',
    location: 'Los Angeles, CA'
  },
  {
    id: '7',
    username: 'foodiesamuel',
    platform: 'instagram' as const,
    displayName: 'Samuel Chen',
    overallAssessment: 'Global food expertise with diverse recipe content. Great for international food brands and cooking tools.',
    isVerified: false,
    followerCount: 28700,
    followingCount: 890,
    category: 'food',
    aiScore: '5.8',
    location: 'New York, NY'
  },
  {
    id: '8',
    username: 'techreviews_alex',
    platform: 'tiktok' as const,
    displayName: 'Alex Rodriguez',
    overallAssessment: 'Clear tech communication with viral potential. Perfect for tech product launches and reviews.',
    isVerified: true,
    followerCount: 67800,
    followingCount: 234,
    category: 'tech',
    aiScore: '6.4',
    location: 'San Francisco, CA'
  },
  {
    id: '9',
    username: 'beautybyemma',
    platform: 'instagram' as const,
    displayName: 'Emma Thompson',
    overallAssessment: 'Professional makeup artistry with clean beauty focus. Excellent for beauty brand partnerships.',
    isVerified: false,
    followerCount: 52100,
    followingCount: 1567,
    category: 'beauty',
    aiScore: '7.1',
    location: 'Miami, FL'
  },
  {
    id: '10',
    username: 'wanderlust_maya',
    platform: 'instagram' as const,
    displayName: 'Maya Patel',
    overallAssessment: 'Authentic solo travel content with budget focus. Great for travel gear and budget accommodation brands.',
    isVerified: false,
    followerCount: 34600,
    followingCount: 2100,
    category: 'travel',
    aiScore: '4.9',
    location: 'Austin, TX'
  },
  {
    id: '11',
    username: 'comedy_mike',
    platform: 'tiktok' as const,
    displayName: 'Mike Johnson',
    overallAssessment: 'Consistent comedy content with high engagement. Perfect for entertainment and lifestyle brand partnerships.',
    isVerified: false,
    followerCount: 89200,
    followingCount: 156,
    category: 'comedy',
    aiScore: '8.2',
    location: 'Chicago, IL'
  },
  {
    id: '12',
    username: 'fashionista_lily',
    platform: 'instagram' as const,
    displayName: 'Lily Chang',
    overallAssessment: 'Sustainable fashion expertise with style authority. Ideal for eco-conscious fashion and accessory brands.',
    isVerified: false,
    followerCount: 41800,
    followingCount: 987,
    category: 'fashion',
    aiScore: '5.3',
    location: 'Portland, OR'
  },
  {
    id: '13',
    username: 'gamer_noah',
    platform: 'tiktok' as const,
    displayName: 'Noah Kim',
    overallAssessment: 'Professional gaming content with competitive expertise. Great for gaming hardware and software partnerships.',
    isVerified: true,
    followerCount: 72300,
    followingCount: 89,
    category: 'gaming',
    aiScore: '9.1',
    location: 'Seattle, WA'
  },
  {
    id: '14',
    username: 'lifestyle_sarah',
    platform: 'instagram' as const,
    displayName: 'Sarah Wilson',
    overallAssessment: 'Authentic lifestyle content with family perspective. Perfect for home goods and wellness brands.',
    isVerified: false,
    followerCount: 38900,
    followingCount: 1334,
    category: 'lifestyle',
    aiScore: '4.7',
    location: 'Denver, CO'
  },
  {
    id: '15',
    username: 'pet_lover_carlos',
    platform: 'instagram' as const,
    displayName: 'Carlos Rodriguez',
    overallAssessment: 'Professional pet care expertise with training focus. Excellent for pet product and service partnerships.',
    isVerified: false,
    followerCount: 29400,
    followingCount: 567,
    category: 'pets',
    aiScore: '6.8',
    location: 'Phoenix, AZ'
  },
  {
    id: '16',
    username: 'music_producer_jade',
    platform: 'tiktok' as const,
    displayName: 'Jade Mitchell',
    overallAssessment: 'Creative music production content with industry insights. Perfect for music software and audio equipment partnerships.',
    isVerified: false,
    followerCount: 55600,
    followingCount: 234,
    category: 'music',
    aiScore: '7.3',
    location: 'Nashville, TN'
  },
  {
    id: '17',
    username: 'business_coach_david',
    platform: 'instagram' as const,
    displayName: 'David Park',
    overallAssessment: 'Professional business expertise with proven scaling strategies. Excellent for B2B tools and business service partnerships.',
    isVerified: true,
    followerCount: 63700,
    followingCount: 445,
    category: 'business',
    aiScore: '3.9',
    location: 'Dallas, TX'
  },
  {
    id: '18',
    username: 'art_by_sofia',
    platform: 'instagram' as const,
    displayName: 'Sofia Martinez',
    overallAssessment: 'Professional digital artistry with strong creative community. Great for design software and creative tool partnerships.',
    isVerified: false,
    followerCount: 47200,
    followingCount: 1890,
    category: 'art',
    aiScore: '8.4',
    location: 'San Diego, CA'
  },
  {
    id: '19',
    username: 'educator_kevin',
    platform: 'tiktok' as const,
    displayName: 'Kevin Lee',
    overallAssessment: 'Educational expertise with engaging science content. Perfect for educational tools and STEM learning platform partnerships.',
    isVerified: false,
    followerCount: 43800,
    followingCount: 167,
    category: 'education',
    aiScore: '6.2',
    location: 'Boston, MA'
  },
  {
    id: '20',
    username: 'family_fun_rachel',
    platform: 'instagram' as const,
    displayName: 'Rachel Davis',
    overallAssessment: 'Authentic family content with parenting expertise. Ideal for family products and educational toy partnerships.',
    isVerified: false,
    followerCount: 36500,
    followingCount: 2234,
    category: 'family',
    aiScore: '5.1',
    location: 'Orlando, FL'
  },
  {
    id: '21',
    username: 'workout_with_mike',
    platform: 'instagram' as const,
    displayName: 'Mike Thompson',
    overallAssessment: 'Certified fitness expertise with home workout focus. Great for fitness equipment and nutrition supplement partnerships.',
    isVerified: false,
    followerCount: 76400,
    followingCount: 567,
    category: 'fitness',
    aiScore: '5.7',
    location: 'Miami, FL'
  },
  {
    id: '22',
    username: 'skincare_guru_lisa',
    platform: 'instagram' as const,
    displayName: 'Lisa Park',
    overallAssessment: 'Professional skincare expertise with budget-conscious approach. Perfect for skincare brands and beauty tool partnerships.',
    isVerified: false,
    followerCount: 84300,
    followingCount: 1123,
    category: 'beauty',
    aiScore: '6.9',
    location: 'Los Angeles, CA'
  },
  {
    id: '23',
    username: 'diy_home_projects',
    platform: 'tiktok' as const,
    displayName: 'Jake Miller',
    overallAssessment: 'Practical DIY expertise with budget-friendly solutions. Excellent for home improvement tools and hardware partnerships.',
    isVerified: false,
    followerCount: 92800,
    followingCount: 89,
    category: 'lifestyle',
    aiScore: '7.8',
    location: 'Denver, CO'
  },
  {
    id: '24',
    username: 'plant_mom_jenny',
    platform: 'instagram' as const,
    displayName: 'Jenny Rodriguez',
    overallAssessment: 'Plant care expertise with growing community engagement. Great for gardening supplies and plant care product partnerships.',
    isVerified: false,
    followerCount: 59200,
    followingCount: 1456,
    category: 'lifestyle',
    aiScore: '6.3',
    location: 'Portland, OR'
  },
  {
    id: '25',
    username: 'budget_travel_tom',
    platform: 'instagram' as const,
    displayName: 'Tom Wilson',
    overallAssessment: 'Budget travel expertise with practical travel hacks. Perfect for travel gear and budget accommodation partnerships.',
    isVerified: false,
    followerCount: 67900,
    followingCount: 2890,
    category: 'travel',
    aiScore: '4.1',
    location: 'Austin, TX'
  },

  // ===== LARGER CREATORS (100K-1M) =====
  {
    id: '26',
    username: 'cooking_with_maria',
    platform: 'instagram' as const,
    displayName: 'Maria Gonzalez',
    overallAssessment: 'Professional culinary expertise with traditional recipe authority. Excellent for cooking equipment and ingredient partnerships.',
    isVerified: true,
    followerCount: 234500,
    followingCount: 2345,
    category: 'food',
    aiScore: '3.2',
    location: 'Los Angeles, CA'
  },
  {
    id: '27',
    username: 'tech_explained_simple',
    platform: 'tiktok' as const,
    displayName: 'David Chang',
    overallAssessment: 'Clear tech communication with mass appeal. Perfect for tech product launches and software service partnerships.',
    isVerified: true,
    followerCount: 456700,
    followingCount: 456,
    category: 'tech',
    aiScore: '4.8',
    location: 'San Francisco, CA'
  },
  {
    id: '28',
    username: 'fashion_week_insider',
    platform: 'instagram' as const,
    displayName: 'Isabella Romano',
    overallAssessment: 'Fashion industry authority with insider access. Ideal for high-end fashion and luxury brand partnerships.',
    isVerified: true,
    followerCount: 189300,
    followingCount: 1234,
    category: 'fashion',
    aiScore: '2.9',
    location: 'New York, NY'
  },
  {
    id: '29',
    username: 'gaming_highlights_pro',
    platform: 'tiktok' as const,
    displayName: 'Tyler Brooks',
    overallAssessment: 'Professional gaming expertise with competitive credibility. Great for gaming hardware and esports brand partnerships.',
    isVerified: true,
    followerCount: 678900,
    followingCount: 234,
    category: 'gaming',
    aiScore: '5.4',
    location: 'Las Vegas, NV'
  },
  {
    id: '30',
    username: 'wellness_journey_complete',
    platform: 'instagram' as const,
    displayName: 'Dr. Amanda Smith',
    overallAssessment: 'Professional wellness expertise with mental health authority. Perfect for wellness apps and self-care product partnerships.',
    isVerified: true,
    followerCount: 312800,
    followingCount: 890,
    category: 'lifestyle',
    aiScore: '3.7',
    location: 'Chicago, IL'
  },

  // ===== MEGA INFLUENCERS (1M+) =====
  {
    id: '31',
    username: 'comedy_central_mark',
    platform: 'tiktok' as const,
    displayName: 'Mark Stevens',
    overallAssessment: 'Mainstream comedy appeal with massive reach. Excellent for entertainment brands and lifestyle product partnerships.',
    isVerified: true,
    followerCount: 2340000,
    followingCount: 567,
    category: 'comedy',
    aiScore: '2.1',
    location: 'Los Angeles, CA'
  },
  {
    id: '32',
    username: 'beauty_empire_queen',
    platform: 'instagram' as const,
    displayName: 'Samantha Lee',
    overallAssessment: 'Beauty industry leader with entrepreneurial credibility. Perfect for beauty brand collaborations and product launches.',
    isVerified: true,
    followerCount: 1890000,
    followingCount: 1234,
    category: 'beauty',
    aiScore: '1.8',
    location: 'Miami, FL'
  },
  {
    id: '33',
    username: 'fitness_transformation',
    platform: 'instagram' as const,
    displayName: 'Chris Johnson',
    overallAssessment: 'Proven fitness transformation expertise with documented results. Great for fitness brands and supplement partnerships.',
    isVerified: true,
    followerCount: 1456000,
    followingCount: 2890,
    category: 'fitness',
    aiScore: '2.3',
    location: 'Dallas, TX'
  },
  {
    id: '34',
    username: 'travel_the_world_now',
    platform: 'instagram' as const,
    displayName: 'Adventure Alex',
    overallAssessment: 'Global travel authority with extensive experience. Perfect for travel brands and destination marketing partnerships.',
    isVerified: true,
    followerCount: 3200000,
    followingCount: 4567,
    category: 'travel',
    aiScore: '1.9',
    location: 'Nomadic'
  },
  {
    id: '35',
    username: 'business_mogul_mentor',
    platform: 'instagram' as const,
    displayName: 'Robert Kim',
    overallAssessment: 'High-level business expertise with proven success record. Excellent for B2B services and investment platform partnerships.',
    isVerified: true,
    followerCount: 2780000,
    followingCount: 1890,
    category: 'business',
    aiScore: '1.6',
    location: 'New York, NY'
  }
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse and validate query parameters
    const filters = discoveryFiltersSchema.parse({
      platform: searchParams.get('platform') || 'all',
      category: searchParams.get('category')?.split(',') || undefined,
      minFollowers: searchParams.get('minFollowers') ? parseInt(searchParams.get('minFollowers')!) : undefined,
      maxFollowers: searchParams.get('maxFollowers') ? parseInt(searchParams.get('maxFollowers')!) : undefined,
      verified: searchParams.get('verified') ? searchParams.get('verified') === 'true' : undefined,
      sortBy: searchParams.get('sortBy') || 'followers',
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 12
    });

    // Filter creators based on criteria
    const filteredCreators = sampleCreators.filter(creator => {
      // Platform filter
      if (filters.platform !== 'all' && creator.platform !== filters.platform) {
        return false;
      }

      // Category filter
      if (filters.category && filters.category.length > 0 && !filters.category.includes(creator.category as typeof filters.category[0])) {
        return false;
      }

      // Follower count filter
      if (creator.followerCount < filters.minFollowers || creator.followerCount > filters.maxFollowers) {
        return false;
      }

      // Verified filter
      if (filters.verified !== undefined && creator.isVerified !== filters.verified) {
        return false;
      }

      return true;
    });

    // Sort creators
    filteredCreators.sort((a, b) => {
      switch (filters.sortBy) {
        case 'followers':
          return b.followerCount - a.followerCount;
        case 'engagement':
          return parseFloat(b.aiScore) - parseFloat(a.aiScore);
        case 'recent':
          // For now, just return by follower count (could add lastActive field later)
          return b.followerCount - a.followerCount;
        default:
          return 0;
      }
    });

    // Pagination
    const startIndex = (filters.page - 1) * filters.limit;
    const endIndex = startIndex + filters.limit;
    const paginatedCreators = filteredCreators.slice(startIndex, endIndex);

    return NextResponse.json({
      creators: paginatedCreators,
      totalCount: filteredCreators.length,
      currentPage: filters.page,
      totalPages: Math.ceil(filteredCreators.length / filters.limit),
      hasNextPage: endIndex < filteredCreators.length,
      appliedFilters: filters
    });

  } catch (error) {
    console.error('Discovery API error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid filter parameters', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch creators' },
      { status: 500 }
    );
  }
}