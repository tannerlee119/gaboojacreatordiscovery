"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform } from '@/lib/types';

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

const STORAGE_KEY = 'gabooja-creator-data';
const HISTORY_KEY = 'gabooja-creator-history';
const MAX_HISTORY_SIZE = 10;

export function CreatorProvider({ children }: { children: ReactNode }) {
  const [currentAnalysis, setCurrentAnalysisState] = useState<AnalysisResult | null>(null);
  const [analysisHistory, setAnalysisHistory] = useState<AnalysisResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load data from localStorage on mount
  useEffect(() => {
    try {
      const storedAnalysis = localStorage.getItem(STORAGE_KEY);
      const storedHistory = localStorage.getItem(HISTORY_KEY);
      
      if (storedAnalysis) {
        const analysis = JSON.parse(storedAnalysis);
        setCurrentAnalysisState(analysis);
      }
      
      if (storedHistory) {
        const history = JSON.parse(storedHistory);
        setAnalysisHistory(history);
      }
    } catch (error) {
      console.error('Error loading creator data from localStorage:', error);
    }
  }, []);

  // Save current analysis to localStorage whenever it changes
  const setCurrentAnalysis = (analysis: AnalysisResult | null) => {
    setCurrentAnalysisState(analysis);
    
    try {
      if (analysis) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(analysis));
      } else {
        localStorage.removeItem(STORAGE_KEY);
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
        localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
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
      localStorage.removeItem(HISTORY_KEY);
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