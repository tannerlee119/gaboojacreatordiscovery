// Simple test script to check Supabase authentication
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  console.log('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing');
  console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey ? 'Set' : 'Missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testAuth() {
  console.log('Testing Supabase connection...');
  
  try {
    // Test basic connection
    console.log('1. Testing basic connection...');
    const { data, error } = await supabase.from('profiles').select('count').limit(1);
    
    if (error) {
      console.error('Connection test failed:', error);
      return;
    }
    
    console.log('✓ Connection successful');
    
    // Test auth session
    console.log('2. Testing auth session...');
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Session test failed:', sessionError);
      return;
    }
    
    console.log('✓ Session check successful (no active session expected)');
    
    // Test creating a new user (will fail if user exists, that's fine)
    console.log('3. Testing user creation...');
    const testEmail = `testuser${Math.floor(Math.random() * 1000)}@gmail.com`;
    const testPassword = 'testpassword123';
    
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        emailRedirectTo: undefined,
        data: {
          username: `testuser_${Date.now()}`,
          display_name: 'Test User'
        }
      }
    });
    
    if (signUpError) {
      console.error('Sign up test failed:', signUpError);
      return;
    }
    
    console.log('✓ User creation test successful');
    console.log('User ID:', signUpData.user?.id);
    
    // Clean up: sign out
    await supabase.auth.signOut();
    console.log('✓ Cleanup successful');
    
  } catch (error) {
    console.error('Unexpected test error:', error);
  }
}

testAuth();