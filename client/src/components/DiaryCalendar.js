import React from 'react';
import Calendar from 'react-calendar';
import { SolarDay } from 'tyme4ts';
import 'react-calendar/dist/Calendar.css';
import '../styles/DiaryCalendar.css';

function DiaryCalendar({ entries, onDateSelect, selectedDate }) {
  // 创建一个包含日记条目日期的映射
  const datesWithEntries = entries.reduce((acc, entry) => {
    if (!entry || !entry.createdAt) return acc;
    
    try {
      const date = new Date(entry.createdAt).toLocaleDateString();
      acc[date] = true;
    } catch (error) {
      console.error('日期解析错误:', error);
    }
    return acc;
  }, {});
  
  // 获取农历信息
  const getLunarInfo = (date) => {
    try {
      const solar = SolarDay.fromYmd(
        date.getFullYear(), 
        date.getMonth() + 1, 
        date.getDate()
      );
      const lunar = solar.getLunarDay();
      
      // 获取农历日
      const lunarDay = lunar.getDayInChinese();
      
      // 节日信息
      const festivals = [];

      // 添加农历节日
      lunar.getFestivals().forEach(f => {
        festivals.push({
          name: f.getName(),
          isHoliday: f.isHoliday()
        });
      });

      // 添加公历节日
      solar.getFestivals().forEach(f => {
        festivals.push({
          name: f.getName(),
          isHoliday: f.isHoliday()
        });
      });

      // 获取节气
      const solarTerm = solar.getSolarTerm();
      if (solarTerm) {
        festivals.push({
          name: solarTerm.getName(),
          isHoliday: false
        });
      }

      return {
        lunarDay,
        festivals
      };
    } catch (error) {
      console.error('获取农历信息失败:', error, date);
      return {
        lunarDay: '',
        festivals: []
      };
    }
  };

  // 自定义日期内容渲染
  const tileContent = ({ date, view }) => {
    if (view !== 'month') return null;

    const dateStr = date.toLocaleDateString();
    const hasEntries = datesWithEntries[dateStr];
    
    // 获取农历信息
    const { lunarDay, festivals } = getLunarInfo(date);
    
    return (
      <div className="custom-tile-content">
        {hasEntries && <div className="diary-date-indicator"></div>}
        <div className="lunar-day">{lunarDay}</div>
        {festivals.length > 0 && (
          <div className={`festival ${festivals.some(f => f.isHoliday) ? 'holiday' : ''}`}>
            {festivals[0].name}
          </div>
        )}
      </div>
    );
  };

  // 自定义周末显示
  const formatShortWeekday = (locale, date) => {
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    return weekdays[date.getDay()];
  };

  // 自定义月份显示
  const formatMonthYear = (locale, date) => {
    return `${date.getFullYear()}年 ${date.getMonth() + 1}月`;
  };

  return (
    <div className="diary-calendar">
      <Calendar 
        onChange={onDateSelect}
        value={selectedDate}
        tileContent={tileContent}
        formatShortWeekday={formatShortWeekday}
        formatMonthYear={formatMonthYear}
        locale="zh-CN"
      />
    </div>
  );
}

export default DiaryCalendar; 