import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Validation schema for discovery filters
const discoveryFiltersSchema = z.object({
  platform: z.enum(['all', 'instagram', 'tiktok']).optional().default('all'),
  category: z.array(z.enum([
    'lifestyle', 'fashion', 'beauty', 'fitness', 'food', 'travel',
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
    bio: 'Local coffee shop reviews ☕ Finding hidden gems in Portland',
    isVerified: false,
    followerCount: 3400,
    followingCount: 890,
    category: 'food',
    engagementRate: 8.9,
    location: 'Portland, OR'
  },
  {
    id: '2',
    username: 'college_fitness_ben',
    platform: 'tiktok' as const,
    displayName: 'Ben Martinez',
    bio: 'College student sharing dorm workouts 💪 Budget fitness tips',
    isVerified: false,
    followerCount: 7200,
    followingCount: 145,
    category: 'fitness',
    engagementRate: 12.3,
    location: 'Austin, TX'
  },
  {
    id: '3',
    username: 'weekend_painter_anna',
    platform: 'instagram' as const,
    displayName: 'Anna Chen',
    bio: 'Weekend watercolor artist 🎨 Teaching beginners to paint',
    isVerified: false,
    followerCount: 5800,
    followingCount: 234,
    category: 'art',
    engagementRate: 9.7,
    location: 'Seattle, WA'
  },
  {
    id: '4',
    username: 'study_with_james',
    platform: 'tiktok' as const,
    displayName: 'James Wilson',
    bio: 'Medical student sharing study tips 📚 Making learning fun',
    isVerified: false,
    followerCount: 9100,
    followingCount: 67,
    category: 'education',
    engagementRate: 11.2,
    location: 'Boston, MA'
  },
  {
    id: '5',
    username: 'thrift_finds_lucy',
    platform: 'instagram' as const,
    displayName: 'Lucy Johnson',
    bio: 'Thrift store treasure hunter 👗 Sustainable fashion on a budget',
    isVerified: false,
    followerCount: 4600,
    followingCount: 312,
    category: 'fashion',
    engagementRate: 10.1,
    location: 'Nashville, TN'
  },

  // ===== MID-TIER CREATORS (10K-100K) - SWEET SPOT =====
  {
    id: '6',
    username: 'fitnessjenna',
    platform: 'instagram' as const,
    displayName: 'Jenna Martinez',
    bio: 'Personal trainer & wellness coach 💪 Helping you reach your fitness goals',
    isVerified: false,
    followerCount: 45300,
    followingCount: 1200,
    category: 'fitness',
    engagementRate: 4.2,
    location: 'Los Angeles, CA'
  },
  {
    id: '7',
    username: 'foodiesamuel',
    platform: 'instagram' as const,
    displayName: 'Samuel Chen',
    bio: 'Food enthusiast sharing recipes from around the world 🍜',
    isVerified: false,
    followerCount: 28700,
    followingCount: 890,
    category: 'food',
    engagementRate: 5.8,
    location: 'New York, NY'
  },
  {
    id: '8',
    username: 'techreviews_alex',
    platform: 'tiktok' as const,
    displayName: 'Alex Rodriguez',
    bio: 'Breaking down the latest tech in 60 seconds or less ⚡',
    isVerified: true,
    followerCount: 67800,
    followingCount: 234,
    category: 'tech',
    engagementRate: 6.4,
    location: 'San Francisco, CA'
  },
  {
    id: '9',
    username: 'beautybyemma',
    platform: 'instagram' as const,
    displayName: 'Emma Thompson',
    bio: 'Makeup artist & beauty content creator ✨ Clean beauty advocate',
    isVerified: false,
    followerCount: 52100,
    followingCount: 1567,
    category: 'beauty',
    engagementRate: 7.1,
    location: 'Miami, FL'
  },
  {
    id: '10',
    username: 'wanderlust_maya',
    platform: 'instagram' as const,
    displayName: 'Maya Patel',
    bio: 'Solo female traveler 🌍 Budget travel tips & hidden gems',
    isVerified: false,
    followerCount: 34600,
    followingCount: 2100,
    category: 'travel',
    engagementRate: 4.9,
    location: 'Austin, TX'
  },
  {
    id: '11',
    username: 'comedy_mike',
    platform: 'tiktok' as const,
    displayName: 'Mike Johnson',
    bio: 'Daily dose of laughs 😂 Making your day better one joke at a time',
    isVerified: false,
    followerCount: 89200,
    followingCount: 156,
    category: 'comedy',
    engagementRate: 8.2,
    location: 'Chicago, IL'
  },
  {
    id: '12',
    username: 'fashionista_lily',
    platform: 'instagram' as const,
    displayName: 'Lily Chang',
    bio: 'Sustainable fashion advocate 👗 Thrift finds & style tips',
    isVerified: false,
    followerCount: 41800,
    followingCount: 987,
    category: 'fashion',
    engagementRate: 5.3,
    location: 'Portland, OR'
  },
  {
    id: '13',
    username: 'gamer_noah',
    platform: 'tiktok' as const,
    displayName: 'Noah Kim',
    bio: 'Gaming highlights & tips 🎮 Fortnite pro player',
    isVerified: true,
    followerCount: 72300,
    followingCount: 89,
    category: 'gaming',
    engagementRate: 9.1,
    location: 'Seattle, WA'
  },
  {
    id: '14',
    username: 'lifestyle_sarah',
    platform: 'instagram' as const,
    displayName: 'Sarah Wilson',
    bio: 'Minimalist living & self-care tips 🌱 Mom of 2',
    isVerified: false,
    followerCount: 38900,
    followingCount: 1334,
    category: 'lifestyle',
    engagementRate: 4.7,
    location: 'Denver, CO'
  },
  {
    id: '15',
    username: 'pet_lover_carlos',
    platform: 'instagram' as const,
    displayName: 'Carlos Rodriguez',
    bio: 'Dog trainer & pet care expert 🐕 Helping pets live their best life',
    isVerified: false,
    followerCount: 29400,
    followingCount: 567,
    category: 'pets',
    engagementRate: 6.8,
    location: 'Phoenix, AZ'
  },
  {
    id: '16',
    username: 'music_producer_jade',
    platform: 'tiktok' as const,
    displayName: 'Jade Mitchell',
    bio: 'Music producer sharing beats & studio sessions 🎵',
    isVerified: false,
    followerCount: 55600,
    followingCount: 234,
    category: 'music',
    engagementRate: 7.3,
    location: 'Nashville, TN'
  },
  {
    id: '17',
    username: 'business_coach_david',
    platform: 'instagram' as const,
    displayName: 'David Park',
    bio: 'Entrepreneur & business coach 💼 Helping you scale your business',
    isVerified: true,
    followerCount: 63700,
    followingCount: 445,
    category: 'business',
    engagementRate: 3.9,
    location: 'Dallas, TX'
  },
  {
    id: '18',
    username: 'art_by_sofia',
    platform: 'instagram' as const,
    displayName: 'Sofia Martinez',
    bio: 'Digital artist & illustrator 🎨 Commissions open',
    isVerified: false,
    followerCount: 47200,
    followingCount: 1890,
    category: 'art',
    engagementRate: 8.4,
    location: 'San Diego, CA'
  },
  {
    id: '19',
    username: 'educator_kevin',
    platform: 'tiktok' as const,
    displayName: 'Kevin Lee',
    bio: 'Making science fun & accessible 🧪 High school chemistry teacher',
    isVerified: false,
    followerCount: 43800,
    followingCount: 167,
    category: 'education',
    engagementRate: 6.2,
    location: 'Boston, MA'
  },
  {
    id: '20',
    username: 'family_fun_rachel',
    platform: 'instagram' as const,
    displayName: 'Rachel Davis',
    bio: 'Family activities & parenting tips 👨‍👩‍👧‍👦 Making memories together',
    isVerified: false,
    followerCount: 36500,
    followingCount: 2234,
    category: 'family',
    engagementRate: 5.1,
    location: 'Orlando, FL'
  },
  {
    id: '21',
    username: 'workout_with_mike',
    platform: 'instagram' as const,
    displayName: 'Mike Thompson',
    bio: 'Certified personal trainer 🏋️‍♂️ Home workouts & nutrition tips',
    isVerified: false,
    followerCount: 76400,
    followingCount: 567,
    category: 'fitness',
    engagementRate: 5.7,
    location: 'Miami, FL'
  },
  {
    id: '22',
    username: 'skincare_guru_lisa',
    platform: 'instagram' as const,
    displayName: 'Lisa Park',
    bio: 'Licensed esthetician 🧴 Skincare routines for every budget',
    isVerified: false,
    followerCount: 84300,
    followingCount: 1123,
    category: 'beauty',
    engagementRate: 6.9,
    location: 'Los Angeles, CA'
  },
  {
    id: '23',
    username: 'diy_home_projects',
    platform: 'tiktok' as const,
    displayName: 'Jake Miller',
    bio: 'DIY home improvement on a budget 🔨 Weekend warrior projects',
    isVerified: false,
    followerCount: 92800,
    followingCount: 89,
    category: 'lifestyle',
    engagementRate: 7.8,
    location: 'Denver, CO'
  },
  {
    id: '24',
    username: 'plant_mom_jenny',
    platform: 'instagram' as const,
    displayName: 'Jenny Rodriguez',
    bio: 'Indoor plant enthusiast 🌱 Helping you grow your green thumb',
    isVerified: false,
    followerCount: 59200,
    followingCount: 1456,
    category: 'lifestyle',
    engagementRate: 6.3,
    location: 'Portland, OR'
  },
  {
    id: '25',
    username: 'budget_travel_tom',
    platform: 'instagram' as const,
    displayName: 'Tom Wilson',
    bio: 'Backpacker exploring the world on $50/day 🎒 Budget travel hacks',
    isVerified: false,
    followerCount: 67900,
    followingCount: 2890,
    category: 'travel',
    engagementRate: 4.1,
    location: 'Austin, TX'
  },

  // ===== LARGER CREATORS (100K-1M) =====
  {
    id: '26',
    username: 'cooking_with_maria',
    platform: 'instagram' as const,
    displayName: 'Maria Gonzalez',
    bio: 'Professional chef sharing family recipes 👩‍🍳 3 generations of tradition',
    isVerified: true,
    followerCount: 234500,
    followingCount: 2345,
    category: 'food',
    engagementRate: 3.2,
    location: 'Los Angeles, CA'
  },
  {
    id: '27',
    username: 'tech_explained_simple',
    platform: 'tiktok' as const,
    displayName: 'David Chang',
    bio: 'Software engineer explaining tech for everyone 💻 No jargon, just clarity',
    isVerified: true,
    followerCount: 456700,
    followingCount: 456,
    category: 'tech',
    engagementRate: 4.8,
    location: 'San Francisco, CA'
  },
  {
    id: '28',
    username: 'fashion_week_insider',
    platform: 'instagram' as const,
    displayName: 'Isabella Romano',
    bio: 'Fashion industry insider 👗 Behind the scenes of fashion week',
    isVerified: true,
    followerCount: 189300,
    followingCount: 1234,
    category: 'fashion',
    engagementRate: 2.9,
    location: 'New York, NY'
  },
  {
    id: '29',
    username: 'gaming_highlights_pro',
    platform: 'tiktok' as const,
    displayName: 'Tyler Brooks',
    bio: 'Professional esports player 🎮 Valorant & Apex Legends highlights',
    isVerified: true,
    followerCount: 678900,
    followingCount: 234,
    category: 'gaming',
    engagementRate: 5.4,
    location: 'Las Vegas, NV'
  },
  {
    id: '30',
    username: 'wellness_journey_complete',
    platform: 'instagram' as const,
    displayName: 'Dr. Amanda Smith',
    bio: 'Licensed therapist & wellness coach 🧘‍♀️ Mental health awareness',
    isVerified: true,
    followerCount: 312800,
    followingCount: 890,
    category: 'lifestyle',
    engagementRate: 3.7,
    location: 'Chicago, IL'
  },

  // ===== MEGA INFLUENCERS (1M+) =====
  {
    id: '31',
    username: 'comedy_central_mark',
    platform: 'tiktok' as const,
    displayName: 'Mark Stevens',
    bio: 'Stand-up comedian & content creator 😂 Making millions laugh daily',
    isVerified: true,
    followerCount: 2340000,
    followingCount: 567,
    category: 'comedy',
    engagementRate: 2.1,
    location: 'Los Angeles, CA'
  },
  {
    id: '32',
    username: 'beauty_empire_queen',
    platform: 'instagram' as const,
    displayName: 'Samantha Lee',
    bio: 'Beauty entrepreneur & MUA 💄 CEO of SL Beauty | Tutorials & reviews',
    isVerified: true,
    followerCount: 1890000,
    followingCount: 1234,
    category: 'beauty',
    engagementRate: 1.8,
    location: 'Miami, FL'
  },
  {
    id: '33',
    username: 'fitness_transformation',
    platform: 'instagram' as const,
    displayName: 'Chris Johnson',
    bio: 'Certified trainer transforming lives 💪 300+ client success stories',
    isVerified: true,
    followerCount: 1456000,
    followingCount: 2890,
    category: 'fitness',
    engagementRate: 2.3,
    location: 'Dallas, TX'
  },
  {
    id: '34',
    username: 'travel_the_world_now',
    platform: 'instagram' as const,
    displayName: 'Adventure Alex',
    bio: 'Full-time traveler ✈️ Visited 95+ countries | Travel tips & inspiration',
    isVerified: true,
    followerCount: 3200000,
    followingCount: 4567,
    category: 'travel',
    engagementRate: 1.9,
    location: 'Nomadic'
  },
  {
    id: '35',
    username: 'business_mogul_mentor',
    platform: 'instagram' as const,
    displayName: 'Robert Kim',
    bio: 'Serial entrepreneur & investor 💼 Building 7-figure businesses',
    isVerified: true,
    followerCount: 2780000,
    followingCount: 1890,
    category: 'business',
    engagementRate: 1.6,
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
          return b.engagementRate - a.engagementRate;
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