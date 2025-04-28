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

  // 获取农历日显示文本的函数
  const getLunarDayText = (lunar) => {
    try {
      // 使用 getDay 方法获取农历日数值
      const day = lunar.getDay();
      
      // 转换数字为中文日期
      const chineseDays = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
                         '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
                         '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'];
      return chineseDays[day - 1] || day.toString();
    } catch (error) {
      console.error('获取农历日显示文本失败:', error);
      return '';
    }
  };

  // 自定义日期内容
  const tileContent = ({ date, view }) => {
    if (view !== 'month') return null;
    
    // 获取公历日期的键
    const dateKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    const hasEntries = datesWithEntries[dateKey];
    
    // 获取农历信息
    let lunarDay = '';
    try {
      const solar = SolarDay.fromYmd(
        date.getFullYear(), 
        date.getMonth() + 1, 
        date.getDate()
      );
      
      const lunar = solar.getLunarDay();
      lunarDay = getLunarDayText(lunar);
      
      // 检查是否有节日
      const festival = lunar.getFestival();
      if (festival) {
        console.log(`${date.toLocaleDateString()} 的节日:`, festival.getName());
      }
    } catch (error) {
      console.error('获取农历日期出错:', error, date);
    }

    return (
      <div className="tile-content">
        {hasEntries && <div className="diary-entry-dot"></div>}
        {lunarDay && <div className="lunar-day">{lunarDay}</div>}
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
      />
      <p className="selected-date">
        Selected Date: {selectedDate ? `${selectedDate.getFullYear()}年${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日` : ''}
      </p>
    </div>
  );
}

export default DiaryCalendar; 