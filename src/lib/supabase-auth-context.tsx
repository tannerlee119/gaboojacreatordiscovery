"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { SimpleAuthService, SimpleUser, SimpleSession } from './simple-auth';
import { supabase } from './supabase';

interface Profile {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

interface UserSettings {
  id: string;
  user_id: string;
  email_notifications: boolean;
  dark_mode: boolean;
  auto_save: boolean;
  show_bookmarks: boolean;
  show_recent_searches: boolean;
  skip_delete_confirmation: boolean;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: SimpleUser | null;
  profile: Profile | null;
  settings: UserSettings | null;
  session: SimpleSession | null;
  loading: boolean;
  signUp: (username: string, password: string) => Promise<{ error: string | null }>;
  signIn: (username: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<{ error: string | null }>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
  updateSettings: (updates: Partial<UserSettings>) => Promise<{ error: Error | null }>;
  changePassword: (newPassword: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SimpleUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [session, setSession] = useState<SimpleSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session from simple auth
    const getInitialSession = async () => {
      try {
        console.log('Loading initial session...');
        
        const currentSession = SimpleAuthService.getSession();
        
        if (currentSession) {
          console.log('Session found:', currentSession.user.username);
          setSession(currentSession);
          setUser(currentSession.user);
          
          // Load profile data
          loadUserData(currentSession.user.id, currentSession.user).catch((error) => {
            console.warn('Failed to load user profile/settings:', error);
          });
        } else {
          console.log('No active session');
          setSession(null);
          setUser(null);
        }
        
        setLoading(false);
        console.log('Auth initialization complete');
        
      } catch (error) {
        console.error('Unexpected error during auth initialization:', error);
        setSession(null);
        setUser(null);
        setLoading(false);
      }
    };

    getInitialSession();
  }, []);

  const loadUserData = async (userId: string, currentUser?: SimpleUser) => {
    try {
      console.log('Loading user data for:', userId);
      
      // Load profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) {
        if (profileError.code === 'PGRST116') {
          console.log('No profile found for user, this is normal for new users');
          setProfile(null);
        } else {
          console.error('Error loading profile:', profileError);
          setProfile(null);
        }
      } else {
        console.log('Profile loaded:', profileData);
        setProfile(profileData);
      }

      // If no profile found, create a minimal profile object from the user data
      if (!profileData && currentUser) {
        console.log('Creating minimal profile from user data');
        setProfile({
          id: currentUser.id,
          username: currentUser.username,
          display_name: currentUser.username,
          created_at: currentUser.created_at,
          updated_at: currentUser.updated_at
        });
      }

      // Load settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (settingsError) {
        if (settingsError.code === 'PGRST116') {
          console.log('No settings found for user, this is normal for new users');
          setSettings(null);
        } else {
          console.error('Error loading settings:', settingsError);
          setSettings(null);
        }
      } else {
        console.log('Settings loaded:', settingsData);
        setSettings(settingsData);
      }
    } catch (error) {
      console.error('Unexpected error loading user data:', error);
      setProfile(null);
      setSettings(null);
    }
  };

  const signUp = async (username: string, password: string) => {
    try {
      console.log('Creating account for username:', username);
      
      const { user, error } = await SimpleAuthService.signUp(username, password);
      
      if (error) {
        return { error };
      }

      if (user) {
        console.log('User created:', user.id);
        
        // Create session automatically after signup
        const { session, error: sessionError } = await SimpleAuthService.signIn(username, password);
        
        if (sessionError || !session) {
          console.error('Failed to create session after signup:', sessionError);
          return { error: sessionError || 'Failed to create session' };
        }
        
        // Set the auth state
        setUser(session.user);
        setSession(session);
        
        // Load profile data
        loadUserData(session.user.id, session.user).catch((error) => {
          console.warn('Failed to load profile after signup:', error);
        });
        
        console.log('Signup and login successful');
      }

      return { error: null };
    } catch (err) {
      console.error('Unexpected signup error:', err);
      return { error: err instanceof Error ? err.message : 'Signup failed' };
    }
  };

  const signIn = async (username: string, password: string) => {
    try {
      console.log('Attempting username login for:', username);
      
      const { session, error } = await SimpleAuthService.signIn(username, password);
      
      if (error) {
        return { error };
      }

      if (session) {
        console.log('Login successful');
        setUser(session.user);
        setSession(session);
        
        // Load profile data
        loadUserData(session.user.id, session.user).catch((error) => {
          console.warn('Failed to load profile after login:', error);
        });
      }

      return { error: null };

    } catch (err) {
      console.error('Unexpected error in signIn:', err);
      return { error: err instanceof Error ? err.message : 'Login failed' };
    }
  };

  const signOut = async () => {
    try {
      console.log('Signing out...');
      
      SimpleAuthService.signOut();
      
      // Clear local state
      setSession(null);
      setUser(null);
      setProfile(null);
      setSettings(null);
      
      console.log('Sign out successful');
      return { error: null };
    } catch (err) {
      console.error('Sign out error:', err);
      // Clear local state regardless of error
      setSession(null);
      setUser(null);
      setProfile(null);
      setSettings(null);
      return { error: err instanceof Error ? err.message : 'Sign out failed' };
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: new Error('Not authenticated') };

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setProfile(data);
      }
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const updateSettings = async (updates: Partial<UserSettings>) => {
    if (!user) return { error: new Error('Not authenticated') };

    try {
      const { data, error } = await supabase
        .from('user_settings')
        .update(updates)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setSettings(data);
      }
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const changePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    return { error: error ? error.message : null };
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      settings,
      session,
      loading,
      signUp,
      signIn,
      signOut,
      updateProfile,
      updateSettings,
      changePassword
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useSupabaseAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useSupabaseAuth must be used within a SupabaseAuthProvider');
  }
  return context;
}