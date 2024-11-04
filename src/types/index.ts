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