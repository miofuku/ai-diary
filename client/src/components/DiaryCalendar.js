import React from 'react';
import Calendar from 'react-calendar';
import { SolarDay } from 'tyme4ts';
import 'react-calendar/dist/Calendar.css';
import '../styles/DiaryCalendar.css';

function DiaryCalendar({ entries, onDateSelect, selectedDate }) {
  // 创建日期条目的映射
  const datesWithEntries = entries.reduce((acc, entry) => {
    if (entry && entry.createdAt) {
      try {
        const entryDate = new Date(entry.createdAt);
        const dateKey = `${entryDate.getFullYear()}-${entryDate.getMonth() + 1}-${entryDate.getDate()}`;
        acc[dateKey] = true;
      } catch (error) {
        console.error('处理日期条目时出错:', error);
      }
    }
    return acc;
  }, {});

  // 获取农历日期文本
  const getLunarDayText = (date) => {
    try {
      // 创建公历对象
      const solar = SolarDay.fromYmd(
        date.getFullYear(),
        date.getMonth() + 1,
        date.getDate()
      );
      
      // 获取农历对象
      const lunar = solar.getLunarDay();
      
      // 获取农历日期（如 "初一"）
      const day = lunar.getDay();
      const chineseDayNames = [
        "初一", "初二", "初三", "初四", "初五", "初六", "初七", "初八", "初九", "初十",
        "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十",
        "廿一", "廿二", "廿三", "廿四", "廿五", "廿六", "廿七", "廿八", "廿九", "三十"
      ];
      const lunarDayName = chineseDayNames[day - 1];
      
      const lunarMonthName = lunar.getLunarMonth().getName();
      
      // 根据图片中的样式，显示类似 "初四庚子" 的文本
      const gzDay = lunar.getSixtyCycle(); // 获取干支日
      
      return `${lunarDayName}${gzDay}`;
    } catch (error) {
      console.error('获取农历信息失败:', error, date);
      return "";
    }
  };

  // 自定义日期内容
  const tileContent = ({ date, view }) => {
    if (view !== 'month') return null;
    
    // 获取公历日期的键
    const dateKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    const hasEntries = datesWithEntries[dateKey];
    
    // 获取农历信息
    const lunarText = getLunarDayText(date);
    
    // 判断是否属于当前月份
    const isCurrentMonth = date.getMonth() === selectedDate.getMonth();
    
    // 判断是否是周末
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    
    return (
      <div className={`tile-content ${isCurrentMonth ? 'current-month' : 'other-month'} ${isWeekend ? 'weekend' : ''}`}>
        <div className="solar-day">{date.getDate()}</div>
        <div className="lunar-info">{lunarText}</div>
        {hasEntries && <div className="diary-entry-dot"></div>}
      </div>
    );
  };

  return (
    <div className="diary-calendar-container">
      <Calendar
        onChange={onDateSelect}
        value={selectedDate}
        tileContent={tileContent}
        formatShortWeekday={(locale, date) => ['日', '一', '二', '三', '四', '五', '六'][date.getDay()]}
        formatMonthYear={(locale, date) => `${date.getFullYear()}年 ${date.getMonth() + 1}月`}
        locale="zh-CN"
        showNeighboringMonth={true}
      />
      <div className="selected-date-info">
        选中日期: {selectedDate ? `${selectedDate.getFullYear()}年${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日` : ''}
      </div>
    </div>
  );
}

export default DiaryCalendar; 