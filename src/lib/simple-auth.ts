import { supabase } from './supabase';

export interface SimpleUser {
  id: string;
  username: string;
  created_at: string;
  updated_at: string;
}

export interface SimpleSession {
  user: SimpleUser;
  token: string;
  expires_at: string;
}

export class SimpleAuthService {
  private static readonly SESSION_KEY = 'gabooja_auth_session';
  private static readonly TOKEN_EXPIRY_HOURS = 24 * 7; // 7 days

  /**
   * Simple hash function using Web Crypto API
   */
  private static async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Generate a simple session token
   */
  private static generateToken(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  /**
   * Create a new user account
   */
  static async signUp(username: string, password: string): Promise<{ user?: SimpleUser; error?: string }> {
    try {
      console.log('Creating account for username:', username);

      // Check if username already exists in auth_users table
      const { data: existingUser, error: checkError } = await supabase
        .from('auth_users')
        .select('id')
        .eq('username', username)
        .single();

      if (existingUser) {
        return { error: 'Username already exists' };
      }

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking username:', checkError);
        return { error: 'Failed to check username availability' };
      }

      // Hash the password
      const passwordHash = await this.hashPassword(password);

      // Generate a unique ID
      const userId = crypto.randomUUID();

      // First create a simple users table entry for authentication
      const { data: authUser, error: authError } = await supabase
        .from('auth_users')
        .insert({
          id: userId,
          username,
          password_hash: passwordHash,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('id, username, created_at, updated_at')
        .single();

      if (authError) {
        console.error('Error creating auth user:', authError);
        console.error('Error details:', JSON.stringify(authError, null, 2));
        return { error: `Failed to create account: ${authError.message || 'Database error'}` };
      }

      // Then create profile without password_hash
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          username,
          display_name: username,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('id, username, created_at, updated_at')
        .single();

      if (createError) {
        console.error('Error creating profile:', createError);
        console.error('Error details:', JSON.stringify(createError, null, 2));
        return { error: `Failed to create account: ${createError.message || 'Database error'}` };
      }

      // Create user settings
      await supabase
        .from('user_settings')
        .insert({
          user_id: userId,
          email_notifications: false,
          dark_mode: false,
          auto_save: true,
          show_bookmarks: true,
          show_recent_searches: true,
          skip_delete_confirmation: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      console.log('Account created successfully:', newProfile);
      return { user: newProfile };
    } catch (error) {
      console.error('Signup error:', error);
      return { error: 'Failed to create account' };
    }
  }

  /**
   * Sign in with username and password
   */
  static async signIn(username: string, password: string): Promise<{ session?: SimpleSession; error?: string }> {
    try {
      console.log('Attempting login for username:', username);

      // Hash the password to compare
      const passwordHash = await this.hashPassword(password);

      // Get user by username and password hash from auth_users table
      const { data: authUser, error: profileError } = await supabase
        .from('auth_users')
        .select('id, username, created_at, updated_at, password_hash')
        .eq('username', username)
        .eq('password_hash', passwordHash)
        .single();

      if (profileError || !authUser) {
        console.log('Login failed: Invalid credentials');
        return { error: 'Invalid username or password' };
      }

      // Create session
      const token = this.generateToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + this.TOKEN_EXPIRY_HOURS);

      const session: SimpleSession = {
        user: {
          id: authUser.id,
          username: authUser.username,
          created_at: authUser.created_at,
          updated_at: authUser.updated_at
        },
        token,
        expires_at: expiresAt.toISOString()
      };

      // Store session in localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
      }

      console.log('Login successful');
      return { session };
    } catch (error) {
      console.error('Sign in error:', error);
      return { error: 'Failed to sign in' };
    }
  }

  /**
   * Get current session from localStorage
   */
  static getSession(): SimpleSession | null {
    if (typeof window === 'undefined') return null;

    try {
      const sessionData = localStorage.getItem(this.SESSION_KEY);
      if (!sessionData) return null;

      const session: SimpleSession = JSON.parse(sessionData);
      
      // Check if session is expired
      if (new Date() > new Date(session.expires_at)) {
        this.signOut();
        return null;
      }

      return session;
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  }

  /**
   * Sign out and clear session
   */
  static signOut(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.SESSION_KEY);
    }
  }

  /**
   * Check if user is authenticated
   */
  static isAuthenticated(): boolean {
    return this.getSession() !== null;
  }

  /**
   * Get current user
   */
  static getCurrentUser(): SimpleUser | null {
    const session = this.getSession();
    return session?.user || null;
  }
}