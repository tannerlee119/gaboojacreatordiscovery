/**
 * Database Cleanup Script
 * Removes garbage data from the creator analysis database
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Criteria for identifying garbage data:
 * - Invalid follower counts (0, null, or unrealistic numbers)
 * - Missing essential profile data
 * - Failed AI analysis or scraping
 * - Test usernames or invalid usernames
 */
async function identifyGarbageData() {
  console.log('🔍 Identifying garbage data...');
  
  const { data: analyses, error } = await supabase
    .from('creator_analyses')
    .select('*')
    .order('created_at', { ascending: false });
    
  if (error) {
    console.error('Error fetching data:', error);
    return [];
  }
  
  const garbageRecords = analyses.filter(record => {
    // Parse profile data
    let profileData;
    try {
      profileData = typeof record.profile_data === 'string' 
        ? JSON.parse(record.profile_data) 
        : record.profile_data;
    } catch {
      return true; // Invalid JSON is garbage
    }
    
    // Check for garbage criteria
    const isGarbage = (
      // Missing or invalid follower count
      !profileData?.followerCount || 
      profileData.followerCount === 0 ||
      profileData.followerCount < 0 ||
      
      // Missing essential profile data
      !profileData?.username ||
      !profileData?.displayName ||
      
      // Test or invalid usernames
      profileData.username?.includes('test') ||
      profileData.username?.includes('Test') ||
      profileData.username?.length < 2 ||
      
      // Failed scraping (no profile image or bio)
      (!profileData?.profileImageUrl && !profileData?.bio) ||
      
      // AI analysis failed completely
      (!record.ai_analysis && !record.ai_summary) ||
      
      // Data quality score too low (if available)
      (record.data_quality_score && record.data_quality_score < 30) ||
      
      // Processing failed
      record.status === 'failed' ||
      
      // Unrealistic follower counts (likely scraping errors)
      (profileData.followerCount && profileData.followerCount > 1000000000)
    );
    
    return isGarbage;
  });
  
  console.log(`📊 Found ${garbageRecords.length} garbage records out of ${analyses.length} total`);
  
  return garbageRecords;
}

/**
 * Display garbage records for review
 */
function displayGarbageRecords(records) {
  console.log('\n🗑️  Garbage Records Found:');
  console.log('=' .repeat(50));
  
  records.forEach((record, index) => {
    let profileData;
    try {
      profileData = typeof record.profile_data === 'string' 
        ? JSON.parse(record.profile_data) 
        : record.profile_data;
    } catch {
      profileData = { username: 'INVALID_JSON' };
    }
    
    console.log(`${index + 1}. ${profileData?.username || 'UNKNOWN'} (${record.platform})`);
    console.log(`   Followers: ${profileData?.followerCount || 'N/A'}`);
    console.log(`   Created: ${new Date(record.created_at).toLocaleDateString()}`);
    console.log(`   Status: ${record.status || 'N/A'}`);
    console.log('');
  });
}

/**
 * Delete garbage records
 */
async function deleteGarbageRecords(records) {
  if (records.length === 0) {
    console.log('✅ No garbage records to delete');
    return;
  }
  
  console.log(`🗑️  Deleting ${records.length} garbage records...`);
  
  const recordIds = records.map(r => r.id);
  
  // Delete in batches to avoid timeout
  const batchSize = 50;
  let deletedCount = 0;
  
  for (let i = 0; i < recordIds.length; i += batchSize) {
    const batch = recordIds.slice(i, i + batchSize);
    
    const { error } = await supabase
      .from('creator_analyses')
      .delete()
      .in('id', batch);
      
    if (error) {
      console.error(`❌ Error deleting batch ${i / batchSize + 1}:`, error);
    } else {
      deletedCount += batch.length;
      console.log(`✅ Deleted batch ${i / batchSize + 1} (${batch.length} records)`);
    }
  }
  
  console.log(`🎉 Successfully deleted ${deletedCount} garbage records`);
  
  // Also clean up related user searches for deleted analyses
  console.log('🧹 Cleaning up related user searches...');
  const { error: searchError } = await supabase
    .from('user_searches')
    .delete()
    .in('analysis_id', recordIds);
    
  if (searchError) {
    console.error('❌ Error cleaning up user searches:', searchError);
  } else {
    console.log('✅ Cleaned up related user searches');
  }
}

/**
 * Main cleanup function
 */
async function cleanup() {
  console.log('🧹 Starting database cleanup...\n');
  
  try {
    // Identify garbage data
    const garbageRecords = await identifyGarbageData();
    
    if (garbageRecords.length === 0) {
      console.log('✅ Database is clean! No garbage data found.');
      return;
    }
    
    // Display found records
    displayGarbageRecords(garbageRecords);
    
    // Confirm deletion
    console.log(`\n⚠️  This will delete ${garbageRecords.length} records permanently.`);
    console.log('To confirm deletion, run: node scripts/cleanup-database.js --confirm');
    
    // Check for confirmation flag
    if (process.argv.includes('--confirm')) {
      await deleteGarbageRecords(garbageRecords);
      console.log('\n🎉 Database cleanup completed!');
    } else {
      console.log('\n👆 Add --confirm flag to actually delete the records');
    }
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

// Run cleanup
cleanup();