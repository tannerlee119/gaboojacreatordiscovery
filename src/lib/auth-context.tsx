"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface User {
  id: string;
  username: string;
  email?: string;
  loginTime: string;
  createdAt?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  loginAsGuest: () => void;
  logout: () => void;
  register: (username: string, email: string, password: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check for existing authentication on mount
    const isAuth = localStorage.getItem('isAuthenticated') === 'true';
    const userData = localStorage.getItem('user');
    
    if (isAuth && userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Error parsing user data:', error);
        // Clear invalid data
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('user');
      }
    }
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      // Get stored users
      const users = JSON.parse(localStorage.getItem('users') || '[]');
      
      // Find user by username
      const foundUser = users.find((u: any) => u.username === username);
      
      if (!foundUser) {
        return false; // User not found
      }

      // For now, we'll accept any password for existing users
      // In production, you'd want proper password hashing and verification
      
      const userData = {
        ...foundUser,
        loginTime: new Date().toISOString()
      };

      // Store authentication state
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('isAuthenticated', 'true');
      
      setUser(userData);
      setIsAuthenticated(true);
      
      return true;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const loginAsGuest = () => {
    const guestUser = {
      id: 'guest_' + Date.now(),
      username: 'Guest',
      loginTime: new Date().toISOString()
    };

    localStorage.setItem('user', JSON.stringify(guestUser));
    localStorage.setItem('isAuthenticated', 'true');
    
    setUser(guestUser);
    setIsAuthenticated(true);
  };

  const register = async (username: string, email: string, password: string): Promise<boolean> => {
    try {
      // Get existing users
      const users = JSON.parse(localStorage.getItem('users') || '[]');
      
      // Check if username already exists
      const userExists = users.find((u: any) => u.username === username);
      if (userExists) {
        return false; // Username already exists
      }

      // Create new user
      const newUser = {
        id: Date.now().toString(),
        username,
        email,
        createdAt: new Date().toISOString(),
        loginTime: new Date().toISOString()
      };

      // Add to users array
      users.push(newUser);
      localStorage.setItem('users', JSON.stringify(users));

      // Auto-login
      localStorage.setItem('user', JSON.stringify(newUser));
      localStorage.setItem('isAuthenticated', 'true');
      
      setUser(newUser);
      setIsAuthenticated(true);
      
      return true;
    } catch (error) {
      console.error('Registration error:', error);
      return false;
    }
  };

  const logout = () => {
    // Clear user-specific data if user exists
    if (user) {
      // Note: We don't clear user-specific bookmarks and searches on logout
      // as they should persist for when the user logs back in
    }
    
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('user');
    setUser(null);
    setIsAuthenticated(false);
    
    // Redirect to login page
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      login,
      loginAsGuest,
      logout,
      register
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 