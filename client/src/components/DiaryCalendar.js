import React, { useState, useEffect } from 'react';
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

  // 获取农历日期和干支文本
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
      
      // 获取干支日
      let gzDay = '';
      try {
        if (lunar.getSixtyCycle) {
          gzDay = lunar.getSixtyCycle();
        }
      } catch (e) {
        console.error('获取干支日失败', e);
      }
      
      // 确保day在有效范围内
      if (day >= 1 && day <= 30) {
        const lunarDayName = chineseDayNames[day - 1];
        return `${lunarDayName}${gzDay ? gzDay : ''}`;
      }
      return "";
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
    
    // 获取农历信息 (流日和干支)
    const lunarText = getLunarDayText(date);
    
    // 判断是否属于当前月份
    const isCurrentMonth = date.getMonth() === selectedDate.getMonth();
    
    // 判断是否是周末
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    
    // 重要：确保渲染农历日期，即使获取失败也显示空字符串而不是null
    return (
      <div className="tile-content-wrapper" style={{
        width: '100%', 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3px 0'
      }}>
        <div className="solar-day" style={{
          fontSize: '16px', 
          marginBottom: '2px',
          color: isWeekend ? '#ff3366' : isCurrentMonth ? 'inherit' : '#cccccc'
        }}>{date.getDate()}</div>
        <div className="lunar-info" style={{
          fontSize: '11px', 
          color: isCurrentMonth ? '#666' : '#cccccc', 
          minHeight: '16px'
        }}>{lunarText || ""}</div>
        {hasEntries && <div className="diary-entry-dot" style={{
          position: 'absolute', 
          top: '5px', 
          right: '5px', 
          width: '4px', 
          height: '4px', 
          backgroundColor: '#ff3366', 
          borderRadius: '50%'
        }}></div>}
      </div>
    );
  };

  // 覆盖默认的日期显示
  const tileClassName = ({ date, view }) => {
    if (view === 'month') {
      const classes = ['custom-tile'];
      
      // 检查是否是今天
      const today = new Date();
      if (
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear()
      ) {
        classes.push('today-tile');
      }
      
      return classes.join(' ');
    }
    return null;
  };

  return (
    <div className="diary-calendar-container">
      <Calendar
        onChange={onDateSelect}
        value={selectedDate}
        tileContent={tileContent}
        tileClassName={tileClassName}
        formatShortWeekday={(locale, date) => ['日', '一', '二', '三', '四', '五', '六'][date.getDay()]}
        formatMonthYear={(locale, date) => `${date.getFullYear()}年 ${date.getMonth() + 1}月`}
        locale="zh-CN"
        showNeighboringMonth={true}
      />
      
      <HardcodedYiJi selectedDate={selectedDate} />
    </div>
  );
}

// 硬编码的宜忌信息 - 确保始终显示内容
function HardcodedYiJi({ selectedDate }) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    // 模拟加载
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [selectedDate]);
  
  if (isLoading) {
    return <div className="day-detail-loading">加载中...</div>;
  }
  
  // 获取农历信息 (如果可用)
  let lunarDate = "";
  try {
    const solar = SolarDay.fromYmd(
      selectedDate.getFullYear(),
      selectedDate.getMonth() + 1,
      selectedDate.getDate()
    );
    const lunar = solar.getLunarDay();
    const lunarMonth = lunar.getLunarMonth().getName();
    const day = lunar.getDay();
    const chineseDayNames = [
      "初一", "初二", "初三", "初四", "初五", "初六", "初七", "初八", "初九", "初十",
      "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十",
      "廿一", "廿二", "廿三", "廿四", "廿五", "廿六", "廿七", "廿八", "廿九", "三十"
    ];
    const lunarDayName = chineseDayNames[day - 1];
    lunarDate = `${lunarMonth}${lunarDayName}`;
  } catch (error) {
    console.error('获取农历信息失败:', error);
    lunarDate = "获取失败";
  }
  
  const weekDay = ['日', '一', '二', '三', '四', '五', '六'][selectedDate.getDay()];
  const formattedDate = `${selectedDate.getFullYear()}年${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日`;
  
  return (
    <div className="day-detail-container">
      <div className="day-detail-header">
        <div className="solar-date">{formattedDate} 星期{weekDay}</div>
        <div className="lunar-date-main">{lunarDate}</div>
      </div>
      
      <div className="day-almanac-result">
        <div className="almanac-title">获取失败</div>
      </div>
      
      {/* 硬编码的宜忌信息 */}
      <div className="day-yi-ji">
        <div className="yi-section">
          <div className="yi-icon">宜</div>
          <div className="yi-content">诸事不宜</div>
        </div>
        <div className="ji-section">
          <div className="ji-icon">忌</div>
          <div className="ji-content">无</div>
        </div>
      </div>
    </div>
  );
}

export default DiaryCalendar; 