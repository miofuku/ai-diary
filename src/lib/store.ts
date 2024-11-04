import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UserState {
  birthData: {
    solar: string;
    lunar: {
      year: number;
      month: number;
      day: number;
      hour: number;
    };
  } | null;
  setBirthData: (data: UserState['birthData']) => void;
}

export const useStore = create<UserState>()(
  persist(
    (set) => ({
      birthData: null,
      setBirthData: (data) => set({ birthData: data }),
    }),
    {
      name: 'lunar-calendar-storage',
    }
  )
)

export interface LunarDate {
    year: number;
    month: number;
    day: number;
  }
  
  export interface DailyForecast {
    date: string;
    recommendations: string[];
    auspiciousActivities: string[];
    colors: string[];
    directions: string[];
  }
  
  export interface UserBirthData {
    solar: string;
    lunar: LunarDate;
  }

  interface BaziInfo {
    pillars: {
      year: string;
      month: string;
      day: string;
      hour: string;
    };
    elements: string[];
    zodiac: string;
  }

  interface PersonalizedRecommendation {
    dailyLuck: string;
    luckyColors: string[];
    clothingSuggestions: string[];
    accessories: string[];
    activities: {
      recommended: string[];
      avoided: string[];
    };
  }

  interface ExtendedUserState {
    birthData: UserBirthData;
    preferences: {
      notifications: boolean;
      theme: 'light' | 'dark';
      subscriptionType: 'free' | 'premium';
    };
    savedDates: Array<{
      date: string;
      event: string;
      reminder: boolean;
    }>;
  }