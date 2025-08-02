"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface User {
  id: string;
  username: string;
  email?: string;
  loginTime: string;
  createdAt?: string;
}

interface StoredUser {
  id: string;
  username: string;
  email?: string;
  password: string; // Stored password (in production this would be hashed)
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  loginAsGuest: () => void;
  logout: () => void;
  register: (username: string, email: string, password: string) => Promise<boolean>;
  updateUser: (updates: Partial<User>) => void;
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
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
      const users: StoredUser[] = JSON.parse(localStorage.getItem('users') || '[]');
      
      // Find user by username
      const foundUser = users.find((u: StoredUser) => u.username === username);
      
      if (!foundUser) {
        return false; // User not found
      }

      // Check password (in production, this would use proper password hashing)
      if (foundUser.password !== password) {
        return false; // Wrong password
      }
      
      // Create user data without password for client state
      const userData: User = {
        id: foundUser.id,
        username: foundUser.username,
        email: foundUser.email,
        loginTime: new Date().toISOString(),
        createdAt: foundUser.createdAt
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
      const users: StoredUser[] = JSON.parse(localStorage.getItem('users') || '[]');
      
      // Check if username already exists
      const userExists = users.find((u: StoredUser) => u.username === username);
      if (userExists) {
        return false; // Username already exists
      }

      // Create new stored user (with password)
      const newStoredUser: StoredUser = {
        id: Date.now().toString(),
        username,
        email,
        password, // In production, this would be hashed
        createdAt: new Date().toISOString()
      };

      // Add to users array
      users.push(newStoredUser);
      localStorage.setItem('users', JSON.stringify(users));

      // Create user data without password for client state
      const userData: User = {
        id: newStoredUser.id,
        username: newStoredUser.username,
        email: newStoredUser.email,
        loginTime: new Date().toISOString(),
        createdAt: newStoredUser.createdAt
      };

      // Auto-login
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('isAuthenticated', 'true');
      
      setUser(userData);
      setIsAuthenticated(true);
      
      return true;
    } catch (error) {
      console.error('Registration error:', error);
      return false;
    }
  };

  const updateUser = (updates: Partial<User>) => {
    if (!user) return;
    
    const updatedUser = { ...user, ...updates };
    
    // Update localStorage
    localStorage.setItem('user', JSON.stringify(updatedUser));
    
    // Update users array if it exists (preserving password)
    try {
      const users: StoredUser[] = JSON.parse(localStorage.getItem('users') || '[]');
      const userIndex = users.findIndex((u: StoredUser) => u.id === user.id);
      if (userIndex >= 0) {
        // Only update allowed fields, preserve password
        users[userIndex] = {
          ...users[userIndex],
          username: updatedUser.username,
          email: updatedUser.email
        };
        localStorage.setItem('users', JSON.stringify(users));
      }
    } catch (error) {
      console.error('Error updating users array:', error);
    }
    
    // Update state to trigger re-render
    setUser(updatedUser);
  };

  const changePassword = async (currentPassword: string, newPassword: string): Promise<boolean> => {
    if (!user) return false;
    
    // Guest users can't change passwords
    if (user.id.startsWith('guest_')) {
      return false;
    }
    
    try {
      const users: StoredUser[] = JSON.parse(localStorage.getItem('users') || '[]');
      const userIndex = users.findIndex((u: StoredUser) => u.id === user.id);
      
      if (userIndex < 0) {
        return false; // User not found
      }
      
      // Verify current password
      if (users[userIndex].password !== currentPassword) {
        return false; // Wrong current password
      }
      
      // Update password
      users[userIndex].password = newPassword;
      localStorage.setItem('users', JSON.stringify(users));
      
      return true;
    } catch (error) {
      console.error('Error changing password:', error);
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
      register,
      updateUser,
      changePassword
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