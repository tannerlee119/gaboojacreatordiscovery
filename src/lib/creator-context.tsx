"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform } from '@/lib/types';
import { useSupabaseAuth } from '@/lib/supabase-auth-context';

interface AnalysisResult {
  profile: {
    username: string;
    platform: Platform;
    displayName: string;
    bio?: string;
    profileImageUrl: string;
    isVerified: boolean;
    followerCount: number;
    followingCount: number;
    location?: string;
    website?: string;
    metrics: {
      followerCount?: number;
      followingCount?: number;
      postCount?: number;
      engagementRate?: number;
      // TikTok-specific metrics
      likeCount?: number;
      videoCount?: number;
      averageViews?: number;
      averageLikes?: number;
    };
    aiAnalysis?: {
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
    profileImageBase64?: string;
  };
  scrapingDetails: {
    method: string;
    timestamp: string;
  };
}

interface CreatorContextType {
  currentAnalysis: AnalysisResult | null;
  setCurrentAnalysis: (analysis: AnalysisResult | null) => void;
  analysisHistory: AnalysisResult[];
  addToHistory: (analysis: AnalysisResult) => void;
  clearHistory: () => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

const CreatorContext = createContext<CreatorContextType | undefined>(undefined);

const MAX_HISTORY_SIZE = 10;

// Helper functions to get user-specific storage keys
const getStorageKey = (userId: string | null) => 
  userId ? `user_${userId}_creator-data` : 'gabooja-creator-data';

const getHistoryKey = (userId: string | null) => 
  userId ? `user_${userId}_creator-history` : 'gabooja-creator-history';

export function CreatorProvider({ children }: { children: ReactNode }) {
  const { user, session } = useSupabaseAuth();
  const isAuthenticated = !!session;
  const [currentAnalysis, setCurrentAnalysisState] = useState<AnalysisResult | null>(null);
  const [analysisHistory, setAnalysisHistory] = useState<AnalysisResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load data from localStorage when user changes
  useEffect(() => {
    try {
      const userId = isAuthenticated && user ? user.id : null;
      const storageKey = getStorageKey(userId);
      const historyKey = getHistoryKey(userId);
      
      const storedAnalysis = localStorage.getItem(storageKey);
      const storedHistory = localStorage.getItem(historyKey);
      
      if (storedAnalysis) {
        const analysis = JSON.parse(storedAnalysis);
        setCurrentAnalysisState(analysis);
      } else {
        setCurrentAnalysisState(null);
      }
      
      if (storedHistory) {
        const history = JSON.parse(storedHistory);
        setAnalysisHistory(history);
      } else {
        setAnalysisHistory([]);
      }
    } catch (error) {
      console.error('Error loading creator data from localStorage:', error);
      setCurrentAnalysisState(null);
      setAnalysisHistory([]);
    }
  }, [user, isAuthenticated]);

  // Save current analysis to localStorage whenever it changes
  const setCurrentAnalysis = (analysis: AnalysisResult | null) => {
    setCurrentAnalysisState(analysis);
    
    try {
      const userId = isAuthenticated && user ? user.id : null;
      const storageKey = getStorageKey(userId);
      
      if (analysis) {
        localStorage.setItem(storageKey, JSON.stringify(analysis));
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch (error) {
      console.error('Error saving creator data to localStorage:', error);
    }
  };

  // Add analysis to history and save to localStorage
  const addToHistory = (analysis: AnalysisResult) => {
    setAnalysisHistory(prev => {
      // Remove any existing analysis for the same user/platform
      const filtered = prev.filter(
        item => !(item.profile.username === analysis.profile.username && 
                 item.profile.platform === analysis.profile.platform)
      );
      
      // Add new analysis to the beginning
      const newHistory = [analysis, ...filtered].slice(0, MAX_HISTORY_SIZE);
      
      try {
        const userId = isAuthenticated && user ? user.id : null;
        const historyKey = getHistoryKey(userId);
        localStorage.setItem(historyKey, JSON.stringify(newHistory));
      } catch (error) {
        console.error('Error saving analysis history to localStorage:', error);
      }
      
      return newHistory;
    });
  };

  // Clear history
  const clearHistory = () => {
    setAnalysisHistory([]);
    try {
      const userId = isAuthenticated && user ? user.id : null;
      const historyKey = getHistoryKey(userId);
      localStorage.removeItem(historyKey);
    } catch (error) {
      console.error('Error clearing analysis history:', error);
    }
  };

  const value: CreatorContextType = {
    currentAnalysis,
    setCurrentAnalysis,
    analysisHistory,
    addToHistory,
    clearHistory,
    isLoading,
    setIsLoading,
  };

  return (
    <CreatorContext.Provider value={value}>
      {children}
    </CreatorContext.Provider>
  );
}

export function useCreator() {
  const context = useContext(CreatorContext);
  if (context === undefined) {
    throw new Error('useCreator must be used within a CreatorProvider');
  }
  return context;
} 