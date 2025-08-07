import { supabase } from './supabase';
import bcrypt from 'bcryptjs';

export interface CustomUser {
  id: string;
  username: string;
  created_at: string;
  updated_at: string;
}

export interface AuthSession {
  user: CustomUser;
  token: string;
  expires_at: string;
}

export class CustomAuthService {
  private static readonly SESSION_KEY = 'gabooja_auth_session';
  private static readonly TOKEN_EXPIRY_HOURS = 24 * 7; // 7 days

  /**
   * Generate a simple session token
   */
  private static generateToken(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  /**
   * Hash password using bcrypt
   */
  private static async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
  }

  /**
   * Verify password against hash
   */
  private static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }

  /**
   * Create a new user account
   */
  static async signUp(username: string, password: string): Promise<{ user?: CustomUser; error?: string }> {
    try {
      // Check if username already exists
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
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

      // Create the user
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          username,
          password_hash: passwordHash,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('id, username, created_at, updated_at')
        .single();

      if (createError) {
        console.error('Error creating user:', createError);
        return { error: 'Failed to create account' };
      }

      // Create profile
      await supabase
        .from('profiles')
        .insert({
          id: newUser.id,
          username,
          display_name: username,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      // Create user settings
      await supabase
        .from('user_settings')
        .insert({
          user_id: newUser.id,
          email_notifications: false,
          dark_mode: false,
          auto_save: true,
          show_bookmarks: true,
          show_recent_searches: true,
          skip_delete_confirmation: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      return { user: newUser };
    } catch (error) {
      console.error('Signup error:', error);
      return { error: 'Failed to create account' };
    }
  }

  /**
   * Sign in with username and password
   */
  static async signIn(username: string, password: string): Promise<{ session?: AuthSession; error?: string }> {
    try {
      // Get user by username
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, username, password_hash, created_at, updated_at')
        .eq('username', username)
        .single();

      if (userError || !user) {
        return { error: 'Invalid username or password' };
      }

      // Verify password
      const isValidPassword = await this.verifyPassword(password, user.password_hash);
      if (!isValidPassword) {
        return { error: 'Invalid username or password' };
      }

      // Create session
      const token = this.generateToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + this.TOKEN_EXPIRY_HOURS);

      const session: AuthSession = {
        user: {
          id: user.id,
          username: user.username,
          created_at: user.created_at,
          updated_at: user.updated_at
        },
        token,
        expires_at: expiresAt.toISOString()
      };

      // Store session in localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
      }

      return { session };
    } catch (error) {
      console.error('Sign in error:', error);
      return { error: 'Failed to sign in' };
    }
  }

  /**
   * Get current session from localStorage
   */
  static getSession(): AuthSession | null {
    if (typeof window === 'undefined') return null;

    try {
      const sessionData = localStorage.getItem(this.SESSION_KEY);
      if (!sessionData) return null;

      const session: AuthSession = JSON.parse(sessionData);
      
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
  static getCurrentUser(): CustomUser | null {
    const session = this.getSession();
    return session?.user || null;
  }
}