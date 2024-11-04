import { format } from 'date-fns';

// 数字转中文数字
export function numberToChinese(num: number): string {
  const chineseNumbers = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  if (num <= 10) return chineseNumbers[num];
  if (num < 20) return '十' + (num > 10 ? chineseNumbers[num - 10] : '');
  const tens = Math.floor(num / 10);
  const ones = num % 10;
  return chineseNumbers[tens] + '十' + (ones > 0 ? chineseNumbers[ones] : '');
}

// 获取农历月份
export function getLunarMonth(month: number): string {
  const prefix = month === 1 ? '正' : numberToChinese(month);
  return `${prefix}月`;
}

// 获取农历日期
export function getLunarDay(day: number): string {
  const chineseDays = [
    '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
    '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
    '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'
  ];
  return chineseDays[day - 1];
}

// 获取节气
export function getSolarTerm(date: Date): string | null {
  // 这里需要一个节气数据库，简化版本：
  const solarTerms: Record<string, string> = {
    '2024-02-04': '立春',
    '2024-02-19': '雨水',
    // ... 添加更多节气
  };
  const dateStr = format(date, 'yyyy-MM-dd');
  return solarTerms[dateStr] || null;
}

// 获取节日
export function getFestivals(date: Date, lunarDate: any): string[] {
  const festivals: string[] = [];
  
  // 公历节日
  const solarFestivals: Record<string, string> = {
    '01-01': '元旦',
    '05-01': '劳动节',
    // ... 添加更多节日
  };
  
  // 农历节日
  const lunarFestivals: Record<string, string> = {
    '01-01': '春节',
    '01-15': '元宵节',
    // ... 添加更多节日
  };
  
  const solarKey = format(date, 'MM-dd');
  const lunarKey = `${String(lunarDate.month).padStart(2, '0')}-${String(lunarDate.day).padStart(2, '0')}`;
  
  if (solarFestivals[solarKey]) festivals.push(solarFestivals[solarKey]);
  if (lunarFestivals[lunarKey]) festivals.push(lunarFestivals[lunarKey]);
  
  return festivals;
} 